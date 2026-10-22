"""The logic: resolving annotations, computing states, todo lists.

Every front end (server, CLI, Sphinx overlay) goes through this module.
"""

from __future__ import annotations

import json
import re
from fnmatch import fnmatch
from pathlib import Path

from . import adapters, store
from .model import QUICK_ACTIONS, fingerprint, new_annotation, new_id, normalise, now

INDEX = "_deciwa/elements.json"

# element kinds a review rule can name; "all" means every element
KINDS = ("need", "heading", "paragraph", "item", "row", "code", "note", "figure", "class", "function", "statement",
         "object", "array", "value")
DONE = ("approved", "frozen")
FILE = "file:"  # the whole file of a facts file: one approval for all of it (DEC_FACT_BLOCKS)
# groups of the facts view, in this order: what a fact's state means for Daniel
FACT_GROUPS = ("approved", "open", "stale", "question", "unverified")
ASSUMPTION = "[ASSUMPTION]"
VERDICTS_ = ("approve", "reject", "freeze", "delete", "rephrase", "details")


def has_verdict(st: dict | None) -> bool:
    return bool(st) and any(a["kind"] == "feedback" and a.get("verdict") in VERDICTS_ for a in st["annotations"])


class Project:
    def __init__(self, start: Path | None = None):
        self.root = store.find_root(start or Path.cwd())
        self.cfg = store.config(self.root)
        self.build = self.root / self.cfg["sphinx"]["build"]
        self.docs = self.root / self.cfg["sphinx"]["docs"]
        self._parsed: dict[str, tuple[float, dict]] = {}  # source -> (mtime, page), adapter results

    def reload(self):
        """Pick up hand edits of .deciwa/config.toml."""
        self.cfg = store.config(self.root)

    # -- elements index (written by the Sphinx extension) ------------------

    def index(self) -> dict:
        """The Sphinx elements index plus the web pages imported from browsers.
        A web page whose source file an adapter reads is left out: the adapter
        knows its elements with their source lines."""
        path = self.build / INDEX
        index = json.loads(path.read_text()) if path.exists() else {"pages": {}}
        for url, page in store.web_pages(self.root).items():
            if self.parse(page.get("source", "")) is None:
                index["pages"].setdefault(url, page)
        return index

    # -- web pages: address -> source file ([web] in config.toml) ------------

    def web_source(self, host: str, path: str) -> str:
        """The first [web] rule whose file exists, else the address itself."""
        web = self.cfg.get("web", {})
        if not web.get("site") or web["site"] == host:
            for rule in web.get("sources", []):
                parts = _match_url(rule["url"], path)
                if parts is None:
                    continue
                file = rule["file"]
                for part in parts:
                    file = file.replace("*", part, 1)
                if (self.root / file).is_file():
                    return file
        return f"{store.WEB}{host}{path}"

    def page_of_source(self, index: dict, source: str) -> tuple[str | None, dict]:
        """The page of a source: from the elements index (a build, a browser), else
        from the adapter for its file type, so plain Markdown files need no build."""
        for docname, page in index["pages"].items():
            if page["source"] == source:
                return docname, page
        page = self.parse(source)
        if page:
            return source, page
        return None, {"elements": []}

    def parse(self, source: str) -> dict | None:
        """The elements of a source file read by its adapter; None without an adapter or file."""
        adapter = adapters.for_path(source)
        path = self.root / source
        if adapter is None or source.startswith(store.WEB) or not path.is_file():
            return None
        mtime = path.stat().st_mtime
        cached = self._parsed.get(source)
        if cached and cached[0] == mtime:
            return cached[1]
        text = path.read_text(errors="replace")
        page = {"source": source, "title": adapter.title(text, path.name), "elements": adapter.elements(text, source)}
        if self.is_fact_file(source):
            # the whole file, frontmatter included: any change makes its approval stale
            page["elements"].append({"key": "file", "selector": FILE, "kind": "file", "label": page["title"],
                                     "line": 1, "end": text.count("\n") + 1, "text": text,
                                     "fingerprint": fingerprint(text), "parent": None})
        self._parsed[source] = (mtime, page)
        return page

    def pages(self) -> dict:
        """Every page deciwa knows: the elements index, plus the files read by an
        adapter that have review data or fall under the review paths."""
        index = self.index()
        pages = dict(index["pages"])
        known = {p["source"] for p in pages.values()}
        extra = set(store.sources(self.root))
        for pattern in self.cfg["review"]["paths"]:
            extra.update(p.relative_to(self.root).as_posix() for p in self.root.glob(pattern)
                         if p.is_file() and store.FOLDER not in p.relative_to(self.root).parts[:1])
        for source in sorted(extra - known):
            page = self.parse(source)
            if page:
                pages[source] = page
        return pages

    def host_page(self, source: str, title: str, elements: list[dict]) -> dict:
        """Elements a host found in a page it rendered itself (an HTML file scanned in
        the browser), kept like the pages of a website."""
        index = store.web_pages(self.root)
        keep = ("selector", "kind", "label", "text", "fingerprint", "parent")
        index[source] = {"source": source, "title": title or source,
                         "elements": [{k: e.get(k) for k in keep} for e in elements]}
        store.save_web_pages(self.root, index)
        return {"source": source, "elements": len(elements)}

    # -- review rules: which elements must be approved ---------------------

    def is_required(self, source: str, element: dict) -> bool:
        rules = self.cfg["review"]
        if rules["paths"] and not any(fnmatch(source, p) for p in rules["paths"]):
            return False
        for rule in rules["required"]:
            if rule == "all" or rule == element["kind"]:
                return True
            if ":" in rule and fnmatch(element["selector"], rule):
                return True
        return False

    def set_required(self, kinds: list[str]) -> dict:
        """Replace the kind rules; selector patterns written by hand stay."""
        unknown = [k for k in kinds if k not in KINDS + ("all",)]
        if unknown:
            raise ValueError(f"unknown element kind(s): {', '.join(unknown)}")
        patterns = [r for r in self.cfg["review"]["required"] if ":" in r]
        self.cfg["review"]["required"] = list(kinds) + patterns
        store.save_config(self.root, self.cfg)
        return self.cfg["review"]

    # -- facts: files that hold facts, one element per fact (DEC_FACT_BLOCKS) --

    def is_fact_file(self, source: str) -> bool:
        rules = self.cfg["facts"]
        return (any(fnmatch(source, p) for p in rules["paths"])
                and not any(fnmatch(source, p) for p in rules["exclude"]))

    def fact_files(self, paths: list[str] | None = None) -> list[str]:
        """Every facts file of the project, or only those in these files or folders."""
        out = []
        for p in self.root.rglob("*"):
            rel = p.relative_to(self.root)
            if rel.parts[0] in (store.FOLDER, "node_modules", ".git") or not p.is_file():
                continue
            source = rel.as_posix()
            if self.is_fact_file(source) and adapters.for_path(source) and (paths is None or _under(source, paths)):
                out.append(source)
        return sorted(out)

    @staticmethod
    def fact_group(st: dict | None, assumption: bool) -> str:
        state = st["state"] if st else "unreviewed"
        if st and st["requested"]:
            return "question"
        if state in ("stale", "frozen, but changed"):
            return "stale"
        if assumption:
            return "unverified"  # marked as not backed – approving it confirms the mark, not the fact
        if state in DONE:
            return "approved"
        return "open"

    def facts(self, sources: list[str] | None = None) -> dict:
        """The facts of these files (default: every facts file): per file its facts with their
        state and group, the state of the file approval, and the counts per group."""
        index = self.index()
        kinds = self.cfg["facts"]["kinds"]
        files = []
        total = {g: 0 for g in FACT_GROUPS}
        for source in sources if sources is not None else self.fact_files():
            _, page = self.page_of_source(index, source)
            view = self.view(source, page["elements"])
            facts = []
            counts = {g: 0 for g in FACT_GROUPS}
            for e in page["elements"]:
                if e["kind"] not in kinds:
                    continue
                st = view["elements"].get(e["selector"])
                assumption = ASSUMPTION in e["text"]
                group = self.fact_group(st, assumption)
                counts[group] += 1
                facts.append({"selector": e["selector"], "kind": e["kind"], "label": e["label"],
                              "context": _context(e["selector"]), "line": e.get("line"), "end": e.get("end"),
                              "state": st["state"] if st else "unreviewed", "group": group,
                              "assumption": assumption})
            for g, n in counts.items():
                total[g] += n
            whole = view["elements"].get(FILE)
            files.append({"source": source, "title": page.get("title", source), "facts": facts, "counts": counts,
                          "file": whole["state"] if whole else "unreviewed", "orphans": len(view["orphans"])})
        return {"groups": list(FACT_GROUPS), "counts": total, "facts": sum(total.values()), "files": files}

    def approve_facts(self, sources: list[str], author: str | None = None) -> dict:
        """Approve every fact of these files that is not approved yet, and each file as a whole.
        Facts with an open question, an open job or a reject are left alone – they wait for an answer."""
        approved = 0
        for source in sources:
            if not self.is_fact_file(source):
                raise ValueError(f"{source} is not a facts file")
            _, page = self.page_of_source(self.index(), source)
            view = self.view(source, page["elements"])
            kinds = self.cfg["facts"]["kinds"] + ["file"]
            for e in page["elements"]:
                st = view["elements"].get(e["selector"])
                if e["kind"] not in kinds or (st and (st["requested"] or st["state"] in
                                                      DONE + ("changes requested", "rejected"))):
                    continue
                self.add(source, e["selector"], "feedback", author=author, verdict="approve")
                approved += 1
        return {"approved": approved, "files": len(sources)}

    # -- resolving and states ----------------------------------------------

    @staticmethod
    def resolve(ann: dict, elements: list[dict]) -> tuple[dict | None, bool]:
        """Find the element of an annotation. Returns (element, changed)."""
        target = ann["target"]
        by_selector = {e["selector"]: e for e in elements}
        structural = next((s["value"] for s in target["selectors"] if s["type"] == "structural"), None)
        quote = next((s for s in target["selectors"] if s["type"] == "TextQuoteSelector"), None)

        element = by_selector.get(structural)
        if element is None:
            # text quote: the snapshot is found unchanged in exactly one element
            snap = normalise(target["snapshot"])
            hits = [e for e in elements if (normalise(e["text"]) == snap) or (quote and snap in normalise(e["text"]))]
            if len(hits) != 1:
                return None, False
            element = hits[0]
        if quote:
            changed = normalise(quote["exact"]) not in normalise(element["text"])
        else:
            changed = element["fingerprint"] != target["fingerprint"]
            if changed and element["selector"] == structural:
                moved = Project._moved(element, target, elements)
                if moved is not None:
                    return moved, False
        return element, changed

    @staticmethod
    def _moved(element: dict, target: dict, elements: list[dict]) -> dict | None:
        """The element under the selector changed: an element of the same kind whose
        selector differs only in its numbers (an array index, a counter) and that
        still has the reviewed text, if there is exactly one – the reviewed element
        moved when something was inserted or removed in front of it."""
        pattern = re.sub(r"\d+", "#", element["selector"])
        snap = normalise(target["snapshot"])
        hits = [e for e in elements if e is not element and e["kind"] == element["kind"]
                and re.sub(r"\d+", "#", e["selector"]) == pattern and normalise(e["text"]) == snap]
        return hits[0] if len(hits) == 1 else None

    def view(self, source: str, elements: list[dict]) -> dict:
        """Every annotated element of a source with its state, plus orphans."""
        per_element: dict[str, list[dict]] = {}
        orphans = []
        for ann in store.load(self.root, source):
            element, changed = self.resolve(ann, elements)
            item = dict(ann, changed=changed)
            if element is None:
                orphans.append(dict(item, state="orphaned"))
                continue
            item["element"] = element["selector"]
            item["current"] = element["text"]
            per_element.setdefault(element["selector"], []).append(item)
        states = {sel: self.state(anns) for sel, anns in per_element.items()}
        required = [e["selector"] for e in elements if self.is_required(source, e)]
        return {"source": source, "elements": states, "orphans": orphans, "required": required,
                "rules": self.cfg["review"]}

    @staticmethod
    def state(anns: list[dict]) -> dict:
        feedback = [a for a in anns if a["kind"] == "feedback"]
        freezes = [a for a in feedback if a.get("verdict") == "freeze"]
        open_actions = [a for a in feedback if a.get("verdict") in QUICK_ACTIONS and a["status"] == "open"]
        # a reject counts until the job is resolved (the text was fixed)
        decisive = [a for a in feedback if a.get("verdict") == "approve"
                    or (a.get("verdict") == "reject" and a["status"] == "open")]
        requests = [a for a in anns if a["kind"] == "request" and a["status"] == "open"]
        ratings = [a for a in anns if a["kind"] == "rating"]

        if freezes:
            state = "frozen, but changed" if freezes[-1]["changed"] else "frozen"
        elif open_actions:
            state = "changes requested"
        elif decisive and decisive[-1]["verdict"] == "reject":
            state = "rejected"
        elif decisive:
            state = "stale" if decisive[-1]["changed"] else "approved"
        elif requests:
            state = "requested"
        else:
            state = "unreviewed"
        return {
            "state": state,
            "requested": bool(requests),
            "stars": ratings[-1]["stars"] if ratings else None,
            "annotations": anns,
        }

    # -- changes -------------------------------------------------------------

    def add(self, source: str, selector: str, kind: str, author: str | None = None, **fields) -> dict:
        _, page = self.page_of_source(self.index(), source)
        element = next((e for e in page["elements"] if e["selector"] == selector), None)
        if element is None:
            raise KeyError(f"element {selector!r} not found in {source} – rebuild the docs?")
        ann = new_annotation(kind, element, author or self.cfg["author"], **fields)
        anns = [a for a in store.load(self.root, source) if not self._replaced_by(ann, a, selector)]
        replaced = [a for a in store.load(self.root, source) if a not in anns]
        # a comment that came with a replaced verdict stays as a note
        for old in replaced:
            if old.get("comment") and old["comment"] != ann.get("comment"):
                anns.append(dict(old, id=new_id(), verdict="note", status="resolved"))
        anns.append(ann)
        store.save(self.root, source, anns)
        return ann

    @staticmethod
    def _replaced_by(new: dict, old: dict, selector: str) -> bool:
        """While the element is unchanged, only the latest verdict and the latest
        rating of an author count – a new one replaces the old one. Notes and
        questions are never replaced."""
        if old["author"] != new["author"] or old["kind"] != new["kind"]:
            return False
        if old["target"]["fingerprint"] != new["target"]["fingerprint"]:
            return False  # the element changed since: keep as history
        if not any(s.get("value") == selector for s in old["target"]["selectors"] if s["type"] == "structural"):
            return False
        if [s for s in old["target"]["selectors"] if s["type"] == "TextQuoteSelector"] != \
           [s for s in new["target"]["selectors"] if s["type"] == "TextQuoteSelector"]:
            return False  # feedback on a selection is separate from the whole element
        if new["kind"] == "rating":
            return True
        return new["kind"] == "feedback" and "note" not in (new.get("verdict"), old.get("verdict"))

    def export(self) -> dict:
        """All review data of the project in one file, with the time of the last change."""
        return {"deciwa": "0.1", "exported": now(), "updated": store.updated(self.root), "origin": "server",
                "files": {src: store.load(self.root, src) for src in store.sources(self.root)}}

    def import_data(self, data: dict, force: bool = False) -> dict:
        """Replace all review data with the file's – no merge. Refused when the
        project has newer data than the file, unless forced. A website export
        (it carries the elements of its pages) only replaces its own pages."""
        if not isinstance(data.get("files"), dict):
            raise ValueError("not a deciwa export")
        if isinstance(data.get("pages"), dict):
            return self.import_web(data, force)
        mine, theirs = store.updated(self.root), data.get("updated")
        if mine and not force and (not theirs or theirs < mine):
            raise ValueError(f"the project has newer data ({mine}) than the file ({theirs or 'no timestamp'})")
        store.clear(self.root)
        count = 0
        for source, anns in data["files"].items():
            store.save(self.root, source, anns)
            count += len(anns)
        return {"annotations": count, "sources": len(data["files"]), "updated": store.updated(self.root)}

    def import_web(self, data: dict, force: bool = False) -> dict:
        """A browser export of a website: replaces the review data of its pages
        only, mapped to source files where a [web] rule fits."""
        mine, theirs = store.updated(self.root), data.get("updated")
        if mine and not force and (not theirs or theirs < mine):
            raise ValueError(f"the project has newer data ({mine}) than the file ({theirs or 'no timestamp'})")
        index = store.web_pages(self.root)
        targets: dict[str, list[dict]] = {}
        for doc, page in data["pages"].items():
            source = page["source"]
            url = page.get("url") or (source[len(store.WEB):] if source.startswith(store.WEB) else source)
            target = self.web_source(url.split("/", 1)[0], doc) if source.startswith(store.WEB) else source
            targets.setdefault(target, []).extend(data["files"].get(source, []))
            index[url] = {"source": target, "url": url, "title": page.get("title") or url, "elements": page["elements"]}
        for source, anns in data["files"].items():  # annotations of pages the export has no elements for
            if not any(source == p["source"] for p in data["pages"].values()):
                targets.setdefault(source, []).extend(anns)
        for target, anns in targets.items():
            store.save(self.root, target, anns)
        store.save_web_pages(self.root, index)
        mapped = sorted(t for t in targets if not t.startswith(store.WEB))
        return {"annotations": sum(len(a) for a in targets.values()), "sources": sum(1 for a in targets.values() if a),
                "mapped": mapped, "updated": store.updated(self.root)}

    def remap(self) -> list[dict]:
        """Apply the [web] rules again: web pages kept under their address move to their source file."""
        index = store.web_pages(self.root)
        moved = []
        for url, page in index.items():
            source = page["source"]
            if not source.startswith(store.WEB):
                continue
            host, _, rest = source[len(store.WEB):].partition("/")
            target = self.web_source(host, "/" + rest)
            if target == source:
                continue
            anns = store.load(self.root, target)
            known = {a["id"] for a in anns}
            moving = [a for a in store.load(self.root, source) if a["id"] not in known]
            store.save(self.root, target, anns + moving)
            store.save(self.root, source, [])
            page["source"] = target
            moved.append({"url": url, "from": source, "to": target, "annotations": len(moving)})
        if moved:
            store.save_web_pages(self.root, index)
        return moved

    def import_file(self, path: Path, force: bool = False) -> dict:
        return self.import_data(json.loads(Path(path).read_text()), force)

    def find(self, ann_id: str) -> tuple[str, list[dict], dict]:
        for source in store.sources(self.root):
            anns = store.load(self.root, source)
            for ann in anns:
                if ann["id"] == ann_id:
                    return source, anns, ann
        raise KeyError(f"annotation {ann_id!r} not found")

    def reply(self, ann_id: str, text: str = "", verdict: str | None = None,
              status: str | None = None, author: str | None = None) -> dict:
        source, anns, ann = self.find(ann_id)
        entry = {"author": author or self.cfg["author"], "created": now()}
        if text:
            entry["text"] = text
        if verdict:
            entry["verdict"] = verdict
        if text or verdict:
            ann.setdefault("replies", []).append(entry)
        if status:
            ann["status"] = status
        store.save(self.root, source, anns)
        return ann

    def resolve_job(self, ann_id: str, note: str = "", author: str | None = None) -> dict:
        return self.reply(ann_id, text=note, status="resolved", author=author)

    def delete(self, ann_id: str) -> None:
        source, anns, ann = self.find(ann_id)
        store.save(self.root, source, [a for a in anns if a["id"] != ann_id])

    # -- overviews -----------------------------------------------------------

    def all_views(self) -> list[tuple[dict, dict]]:
        index = self.index()
        out = []
        for source in store.sources(self.root):
            _, page = self.page_of_source(index, source)
            out.append((page, self.view(source, page["elements"])))
        return out

    def status(self) -> dict:
        counts: dict[str, int] = {}
        total = required = done = 0
        views = {view["source"]: view for _, view in self.all_views()}
        for page in self.pages().values():
            view = views.get(page["source"], {"elements": {}, "orphans": []})
            for e in page["elements"]:
                total += 1
                state = view["elements"].get(e["selector"], {}).get("state", "unreviewed")
                counts[state] = counts.get(state, 0) + 1
                if self.is_required(page["source"], e):
                    required += 1
                    done += state in DONE
            if view["orphans"]:
                counts["orphaned"] = counts.get("orphaned", 0) + len(view["orphans"])
        return {"elements": total, "states": counts,
                "required": {"total": required, "done": done, "rules": self.cfg["review"]}}

    def project(self) -> dict:
        """Overview of all pages: required coverage and every annotated or required element."""
        pages = []
        total = done = decided = rated = 0
        index = {"pages": self.pages()}
        order = sorted(index["pages"], key=lambda d: (d != "index", d))
        for doc in order:
            page = index["pages"][doc]
            view = self.view(page["source"], page["elements"])
            required = set(view["required"])
            items = []
            for e in page["elements"]:
                st = view["elements"].get(e["selector"])
                if not st and e["selector"] not in required:
                    continue
                last = st["annotations"][-1] if st else {}
                items.append({"selector": e["selector"], "label": e["label"], "kind": e["kind"],
                              "decided": has_verdict(st), "rated": bool(st) and st["stars"] is not None,
                              "state": st["state"] if st else "unreviewed", "required": e["selector"] in required,
                              "stars": st["stars"] if st else None, "requested": st["requested"] if st else False,
                              "last": last.get("comment") or last.get("question") or last.get("verdict") or ""})
            n_done = sum(1 for i in items if i["required"] and i["state"] in DONE)
            n_decided = sum(1 for i in items if i["required"] and i["decided"])
            n_rated = sum(1 for i in items if i["required"] and i["rated"])
            total += len(required)
            done += n_done
            decided += n_decided
            rated += n_rated
            pages.append({"doc": doc, "source": page["source"], "title": page.get("title", doc),
                          "required": len(required), "done": n_done, "decided": n_decided, "rated": n_rated,
                          "items": items, "orphans": len(view["orphans"])})
        return {"required": total, "done": done, "decided": decided, "rated": rated, "pages": pages,
                "rules": self.cfg["review"]}

    def summary(self, sources: list[str] | None = None) -> dict:
        """Counts per file for trees and lists: states, open questions, jobs for the
        AI, required elements and how many of them are done. Without sources: every
        file that has review data."""
        index = self.index()
        out = {}
        for source in sources if sources is not None else store.sources(self.root):
            _, page = self.page_of_source(index, source)
            view = self.view(source, page["elements"])
            states: dict[str, int] = {}
            questions = jobs = 0
            for st in view["elements"].values():
                states[st["state"]] = states.get(st["state"], 0) + 1
                for a in st["annotations"]:
                    if a["status"] != "open":
                        continue
                    if a["kind"] == "request":
                        questions += 1
                        jobs += 1
                    elif a["kind"] == "feedback":
                        jobs += 1
                jobs += st["state"] == "frozen, but changed"
            if view["orphans"]:
                states["orphaned"] = len(view["orphans"])
            required = set(view["required"])
            done = sum(1 for sel in required if view["elements"].get(sel, {}).get("state") in DONE)
            decided = sum(1 for sel in required if has_verdict(view["elements"].get(sel)))
            out[source] = {"states": states, "questions": questions, "jobs": jobs + len(view["orphans"]),
                           "required": len(required), "done": done, "decided": decided,
                           "annotations": sum(len(st["annotations"]) for st in view["elements"].values()) + len(view["orphans"])}
        return out

    def todo(self, for_author: str | None = None, sources: list[str] | None = None) -> list[dict]:
        """Open jobs and questions; with sources only those of these files or folders (root-relative)."""
        jobs = []
        for page, view in self.all_views():
            if sources is not None and not _under(view["source"], sources):
                continue
            lines = {e["selector"]: e.get("line") for e in page["elements"]}
            for sel, st in view["elements"].items():
                for a in st["annotations"]:
                    job = None
                    if a["kind"] == "feedback" and a["status"] == "open":
                        job = {"reject": "fix", "note": "comment"}.get(a.get("verdict"), "change")
                    elif a["kind"] == "request" and a["status"] == "open":
                        if for_author and for_author not in a.get("to", []):
                            continue
                        job = "answer"
                    if job:
                        jobs.append({"job": job, "id": a["id"], "source": view["source"],
                                     "line": lines.get(sel), "element": sel, **({"url": page["url"]} if page.get("url") else {}),
                                     "verdict": a.get("verdict"), "question": a.get("question"),
                                     "comment": a.get("comment"), "quote": a["target"]["snapshot"],
                                     "current": a["current"], "author": a["author"], "state": st["state"]})
                if st["state"] == "frozen, but changed":
                    frz = [a for a in st["annotations"] if a.get("verdict") == "freeze"][-1]
                    jobs.append({"job": "restore", "id": frz["id"], "source": view["source"],
                                 "line": lines.get(sel), "element": sel,
                                 "frozen": frz["target"]["snapshot"], "current": frz["current"]})
            for o in view["orphans"]:
                if o["status"] != "open" and o.get("verdict") not in VERDICTS_:
                    continue  # a resolved note or answered question whose element is gone: nothing to do
                jobs.append({"job": "relink", "id": o["id"], "source": view["source"],
                             "element": o["target"]["selectors"][0]["value"], "quote": o["target"]["snapshot"]})
        return jobs


def _context(selector: str) -> str:
    """The heading path of a Markdown element without the document title:
    md:item:Founder/Career#3 → Career."""
    if not selector.startswith("md:"):
        return ""
    path = selector.split(":", 2)[2].rsplit("#", 1)[0]
    return " / ".join(path.split("/")[1:])


def _under(source: str, paths: list[str]) -> bool:
    """Whether a source is one of these files or lies in one of these folders (root-relative)."""
    return any(source == s or source.startswith(s + "/") for s in (p.strip("/") for p in paths) if s)


def _match_url(pattern: str, path: str) -> list[str] | None:
    """Match a page path against a rule like "/blog/*"; returns what the stars stand for."""
    norm = lambda p: p.rstrip("/") or "/"
    regex = "^" + re.escape(norm(pattern)).replace(r"\*", "(.+)") + "$"
    m = re.match(regex, norm(path))
    return list(m.groups()) if m else None

