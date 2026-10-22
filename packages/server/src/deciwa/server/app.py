"""Local server: serves a built site, rebuilds it when sources change, and
relays the review UI's requests to the engine. No logic of its own and no
knowledge of the build tool – the caller passes the build command."""

from __future__ import annotations

import json
import os
import queue
import secrets
import subprocess
import sys
import threading
import time
from functools import partial
from importlib import metadata
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from deciwa.core import Project, store

WATCH_SUFFIXES = {".md", ".rst", ".py", ".css", ".js", ".svg", ".toml"}

API = 1  # major version of the JSON API; a host refuses an engine with another one


def app_version() -> str:
    try:
        return metadata.version("deciwa-cli")
    except metadata.PackageNotFoundError:
        return "0.0.0"


class Events:
    """Change events for hosts (/api/events): the review data in .deciwa/ or a
    reviewed source file changed. Polls once a second – no watcher library."""

    def __init__(self, project: Project, interval: float = 1.0):
        self.project = project
        self.interval = interval
        self.subscribers: list[queue.Queue] = []
        self.lock = threading.Lock()

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue()
        with self.lock:
            self.subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue):
        with self.lock:
            if q in self.subscribers:
                self.subscribers.remove(q)

    def publish(self, event: dict):
        with self.lock:
            for q in self.subscribers:
                q.put(event)

    def snapshot(self) -> tuple[dict, dict]:
        root = self.project.root
        review = {}
        for p in (root / store.FOLDER).rglob("*"):
            if p.is_file():
                review[p.relative_to(root / store.FOLDER).as_posix()] = p.stat().st_mtime
        sources = {}
        for src in store.sources(root):
            path = root / src
            if not src.startswith(store.WEB) and path.is_file():
                sources[src] = path.stat().st_mtime
        return review, sources

    def watch(self):
        review, sources = self.snapshot()
        while True:
            time.sleep(self.interval)
            try:
                review2, sources2 = self.snapshot()
            except OSError:
                continue
            changed_review = {k for k in set(review) | set(review2) if review.get(k) != review2.get(k)}
            changed_sources = {k for k in set(sources) | set(sources2) if sources.get(k) != sources2.get(k)}
            review, sources = review2, sources2
            if not changed_review and not changed_sources:
                continue
            touched = set(changed_sources)
            for rel in changed_review:
                if rel.startswith("annotations/") and rel.endswith(".json") and not rel.startswith("annotations/_web/"):
                    touched.add(rel[len("annotations/"):-len(".json")])
            self.publish({"type": "changed", "sources": sorted(touched),
                          "config": "config.toml" in changed_review,
                          "review": bool(changed_review)})


class Builder:
    """Runs a build command, and again whenever a watched file changes.

    ``command`` builds incrementally, ``full_command`` from scratch (used at
    start and when code changes). Without a command the server only serves.
    """

    def __init__(self, command: list[str] | None = None, full_command: list[str] | None = None,
                 watch: list[Path] | None = None):
        self.command = command
        self.full_command = full_command or command
        self.watch_paths = [Path(p) for p in (watch or [])]
        self.version = 0
        self.building = False
        self.error = ""
        self.lock = threading.Lock()

    def _sources(self):
        for root in self.watch_paths:
            for p in root.rglob("*"):
                if p.suffix in WATCH_SUFFIXES and "_build" not in p.parts and "__pycache__" not in p.parts:
                    yield p

    def snapshot(self) -> dict:
        return {str(p): p.stat().st_mtime for p in self._sources()}

    def build(self, full: bool = False):
        cmd = self.full_command if full else self.command
        if not cmd:
            return
        with self.lock:
            self.building = True
            res = subprocess.run(cmd, capture_output=True, text=True)
            self.error = res.stderr.strip() if res.returncode else ""
            self.building = False
            self.version += 1
            print(f"deciwa: build {self.version} {'failed' if res.returncode else 'ok'}", flush=True)
            if res.stderr.strip():
                print(res.stderr.strip(), flush=True)

    def watch(self):
        seen = self.snapshot()
        while True:
            time.sleep(1)
            now = self.snapshot()
            changed = {p for p in set(now) | set(seen) if now.get(p) != seen.get(p)}
            if changed:
                seen = now
                # code changes need a full rebuild; text changes are incremental
                self.build(full=any(Path(p).suffix == ".py" for p in changed))


class Handler(SimpleHTTPRequestHandler):
    project: Project
    builder: Builder
    token: str | None = None      # hosts: every API request must carry it
    api_only: bool = False        # hosts render the content themselves: no site
    events: Events | None = None

    def log_message(self, fmt, *args):  # keep the console for builds
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _call(self, fn):
        try:
            self._json({"ok": True, "result": fn()})
        except (KeyError, ValueError) as e:
            self._json({"ok": False, "error": str(e).strip("'\"")}, 400)

    def _allowed(self) -> bool:
        if self.token and not secrets.compare_digest(self.headers.get("X-Deciwa-Token", ""), self.token):
            self._json({"ok": False, "error": "missing or wrong token"}, 403)
            return False
        return True

    def _stream(self):
        """Server-sent events: one JSON object per change, a comment every 15 s."""
        if not self.events:
            return self._json({"ok": False, "error": "no events here"}, 404)
        q = self.events.subscribe()
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            self.wfile.write(b": deciwa\n\n")
            self.wfile.flush()
            while True:
                try:
                    event = q.get(timeout=15)
                    self.wfile.write(f"data: {json.dumps(event)}\n\n".encode())
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            self.events.unsubscribe(q)

    def do_GET(self):
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            if self.api_only:
                return self._json({"ok": False, "error": "API only"}, 404)
            return super().do_GET()
        if not self._allowed():
            return
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        p, b = self.project, self.builder
        p.reload()
        if url.path == "/api/version":
            return self._json({"version": b.version, "building": b.building, "error": b.error,
                               "app": app_version(), "api": API, "root": str(p.root)})
        if url.path == "/api/events":
            return self._stream()
        if url.path == "/api/elements":
            def elements():
                _, pg = p.page_of_source(p.index(), q["source"])
                return {"source": q["source"], "title": pg.get("title"), "elements": pg["elements"]}
            return self._call(elements)
        if url.path == "/api/summary":
            sources = [s for s in q["sources"].split(",") if s] if "sources" in q else None
            return self._call(lambda: p.summary(sources))
        if url.path == "/api/page":
            def page():
                _, pg = p.page_of_source(p.index(), q["source"])
                return p.view(q["source"], pg["elements"])
            return self._call(page)
        if url.path == "/api/export":
            return self._call(p.export)
        if url.path == "/api/project":
            return self._call(p.project)
        if url.path == "/api/status":
            return self._call(p.status)
        if url.path == "/api/facts":
            sources = [s for s in q["sources"].split(",") if s] if "sources" in q else None
            return self._call(lambda: p.facts(sources))
        if url.path == "/api/todo":
            sources = [s for s in q["sources"].split(",") if s] if "sources" in q else None
            return self._call(lambda: p.todo(q.get("for"), sources))
        self._json({"ok": False, "error": "unknown endpoint"}, 404)

    def do_POST(self):
        url = urlparse(self.path)
        if not self._allowed():
            return
        length = int(self.headers.get("Content-Length") or 0)
        data = json.loads(self.rfile.read(length) or b"{}")
        p = self.project
        p.reload()
        routes = {
            "/api/annotate": lambda: p.add(data.pop("source"), data.pop("selector"), data.pop("kind"), **data),
            "/api/reply": lambda: p.reply(data["id"], data.get("text", ""), data.get("verdict"), data.get("status")),
            "/api/delete": lambda: p.delete(data["id"]),
            "/api/rules": lambda: p.set_required(data["required"]),
            "/api/approve-facts": lambda: p.approve_facts(data["sources"], data.get("author")),
            "/api/import": lambda: p.import_data(data.get("data", {}), bool(data.get("force"))),
            "/api/elements": lambda: p.host_page(data["source"], data.get("title", ""), data["elements"]),
        }
        if url.path not in routes:
            return self._json({"ok": False, "error": "unknown endpoint"}, 404)
        self._call(routes[url.path])


def serve(project: Project, site: Path, builder: Builder | None = None, port: int = 4337,
          host: str = "127.0.0.1"):
    """Serve ``site`` with the review API on ``host:port``."""
    builder = builder or Builder()
    if builder.command:
        print("deciwa: building …", flush=True)
        builder.build(full=True)
        threading.Thread(target=builder.watch, daemon=True).start()
    Handler.project, Handler.builder = project, builder
    handler = partial(Handler, directory=str(site))
    server = ThreadingHTTPServer((host, port), handler)
    print(f"deciwa: review at http://{host}:{port}/", flush=True)
    server.serve_forever()


def serve_api(project: Project, port: int = 0, host: str = "127.0.0.1", token: str | None = None,
              watch_stdin: bool = True):
    """The JSON API for a host app, without a site (PROP_SERVE_API_ONLY).

    Prints one handshake line to stdout – ``{"port", "token", "api", ...}`` – and
    stops when stdin closes, so the engine never outlives the host."""
    events = Events(project)
    threading.Thread(target=events.watch, daemon=True).start()
    Handler.project, Handler.builder = project, Builder()
    Handler.token = token or os.environ.get("DECIWA_TOKEN") or secrets.token_urlsafe(24)
    Handler.api_only, Handler.events = True, events
    server = ThreadingHTTPServer((host, port), partial(Handler, directory=str(project.root)))
    server.daemon_threads = True
    print(json.dumps({"deciwa": app_version(), "api": API, "port": server.server_address[1],
                      "token": Handler.token, "root": str(project.root)}), flush=True)
    if watch_stdin:
        def wait_for_eof():
            try:
                while sys.stdin.buffer.read(4096):
                    pass
            except (OSError, ValueError):
                pass
            os._exit(0)
        threading.Thread(target=wait_for_eof, daemon=True).start()
    server.serve_forever()
