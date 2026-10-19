"""Local server: serves the built docs, rebuilds on change, and relays the
overlay's requests to the engine. No logic of its own."""

from __future__ import annotations

import json
import subprocess
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .engine import Project

WATCH_SUFFIXES = {".md", ".rst", ".py", ".css", ".js", ".svg", ".toml"}


class Builder:
    def __init__(self, project: Project):
        self.project = project
        self.version = 0
        self.building = False
        self.error = ""
        self.lock = threading.Lock()

    def _sources(self):
        roots = [self.project.docs, Path(__file__).parent]
        for root in roots:
            for p in root.rglob("*"):
                if p.suffix in WATCH_SUFFIXES and "_build" not in p.parts and "__pycache__" not in p.parts:
                    yield p

    def snapshot(self) -> dict:
        return {str(p): p.stat().st_mtime for p in self._sources()}

    def build(self, full: bool = False):
        with self.lock:
            self.building = True
            cmd = [sys.executable, "-m", "sphinx", "-q", "-b", "html", str(self.project.docs), str(self.project.build)]
            if full:
                cmd.insert(3, "-E")
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
                # code or config changes need a full rebuild; text changes are incremental
                self.build(full=any(Path(p).suffix == ".py" for p in changed))


class Handler(SimpleHTTPRequestHandler):
    project: Project
    builder: Builder

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

    def do_GET(self):
        url = urlparse(self.path)
        if not url.path.startswith("/api/"):
            return super().do_GET()
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        p, b = self.project, self.builder
        p.reload()
        if url.path == "/api/version":
            return self._json({"version": b.version, "building": b.building, "error": b.error})
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
        if url.path == "/api/todo":
            return self._call(lambda: p.todo(q.get("for")))
        self._json({"ok": False, "error": "unknown endpoint"}, 404)

    def do_POST(self):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        data = json.loads(self.rfile.read(length) or b"{}")
        p = self.project
        p.reload()
        routes = {
            "/api/annotate": lambda: p.add(data.pop("source"), data.pop("selector"), data.pop("kind"), **data),
            "/api/reply": lambda: p.reply(data["id"], data.get("text", ""), data.get("verdict"), data.get("status")),
            "/api/delete": lambda: p.delete(data["id"]),
            "/api/rules": lambda: p.set_required(data["required"]),
            "/api/import": lambda: p.import_data(data.get("data", {}), bool(data.get("force"))),
        }
        if url.path not in routes:
            return self._json({"ok": False, "error": "unknown endpoint"}, 404)
        self._call(routes[url.path])


def serve(project: Project, port: int = 4337, host: str = "127.0.0.1"):
    builder = Builder(project)
    print(f"deciwa: building {project.docs} …", flush=True)
    builder.build(full=True)
    threading.Thread(target=builder.watch, daemon=True).start()
    Handler.project, Handler.builder = project, builder
    handler = partial(Handler, directory=str(project.build))
    server = ThreadingHTTPServer((host, port), handler)
    print(f"deciwa: review at http://{host}:{port}/", flush=True)
    server.serve_forever()
