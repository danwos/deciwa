"""Sphinx extension: tags every reviewable element and adds the review overlay.

Each element gets a CSS class ``dw-el-<n>``; the page carries a JSON map from
<n> to the element's selector. The full elements index (selector, line, text,
fingerprint) is written to ``<outdir>/_deciwa/elements.json`` for the engine.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from docutils import nodes
from sphinx.application import Sphinx

from . import store
from .model import fingerprint, normalise

STATIC = Path(__file__).parent / "static"

try:  # Sphinx-Needs is optional
    from sphinx_needs.data import SphinxNeedsData
    from sphinx_needs.nodes import Need
except ImportError:  # pragma: no cover
    Need = ()
    SphinxNeedsData = None

# status is left out: approving a proposal changes it without changing the wording
NEED_FIELDS = ("title", "decided", "reason", "alternatives", "to", "content")

SKIP = (nodes.comment, nodes.target,
        nodes.substitution_definition, nodes.system_message)


VISUAL = re.compile(r"<(svg|figure|img|picture|canvas)\b", re.I)


def _raw_label(html: str) -> str:
    for pattern in (r"<figcaption[^>]*>(.*?)</figcaption>", r"<title[^>]*>(.*?)</title>", r'alt="([^"]+)"'):
        m = re.search(pattern, html, re.I | re.S)
        if m:
            return re.sub(r"<[^>]+>", "", m.group(1))
    return "picture"


def _label(text: str, n: int = 70) -> str:
    text = normalise(text)
    return text if len(text) <= n else text[: n - 1] + "…"


def _image_text(node: nodes.Element, srcdir: Path) -> str:
    """Images are compared by file content, so a redrawn picture becomes stale."""
    parts = []
    for img in node.findall(nodes.image):
        uri = img.get("uri", "")
        path = srcdir / uri
        digest = hashlib.sha256(path.read_bytes()).hexdigest()[:16] if path.is_file() else "missing"
        parts.append(f"image {uri} {digest} {img.get('alt', '')}")
    caption = " ".join(c.astext() for c in node.findall(nodes.caption))
    return " ".join(parts + [caption]).strip()


class Collector:
    def __init__(self, fmt: str, needs=None, srcdir: Path | None = None):
        self.srcdir = srcdir or Path(".")
        self.fmt = fmt
        self.needs = needs or {}
        self.elements: list[dict] = []

    def add(self, node: nodes.Element, kind: str, selector: str, text: str, parent: str | None,
            line: int | None = None, label: str | None = None):
        key = len(self.elements) + 1
        node["classes"].append(f"dw-el-{key}")
        self.elements.append({
            "key": key, "selector": selector, "kind": kind, "label": label or _label(text),
            "line": line or node.line or getattr(node.parent, "line", None),
            "text": normalise(text), "fingerprint": fingerprint(text), "parent": parent,
        })
        return selector

    def walk(self, node: nodes.Element, path: list[str], counters: dict, parent: str | None):
        titles: dict[str, int] = {}
        for child in node.children:
            if not isinstance(child, nodes.Element) or isinstance(child, SKIP):
                continue
            if isinstance(child, nodes.section):
                title = child[0].astext() if child.children and isinstance(child[0], nodes.title) else "?"
                titles[title] = titles.get(title, 0) + 1
                name = title if titles[title] == 1 else f"{title}~{titles[title]}"
                sub = path + [name]
                sel = self.add(child, "heading", f"{self.fmt}:heading:{'/'.join(sub)}", child.astext(), parent,
                               label=_label(title))
                self.walk(child, sub, {}, sel)
                continue
            if Need and isinstance(child, Need):
                need_id = child.get("refid") or (child["ids"][0] if child["ids"] else None)
                need = self.needs.get(need_id)
                if need:
                    # the need's wording: title, fields and content as written in the source
                    text = "\n".join(f"{f}: {need[f]}" for f in NEED_FIELDS if need.get(f))
                    self.add(child, "need", f"sphinx-needs:{need_id}", text, parent,
                             line=need.get("lineno"), label=f"{need_id} – {_label(need['title'], 60)}")
                continue
            if isinstance(child, nodes.raw):
                # inline HTML pictures (SVG diagrams, figures, img) are reviewed as a whole
                html = child.astext()
                if "html" in child.get("format", "").split() and VISUAL.search(html):
                    counters["figure"] = counters.get("figure", 0) + 1
                    key = len(self.elements) + 1
                    sel = f"{self.fmt}:figure:{'/'.join(path)}#{counters['figure']}"
                    self.elements.append({
                        "key": key, "selector": sel, "kind": "figure", "label": _label(_raw_label(html)),
                        "line": child.line, "text": normalise(html), "fingerprint": fingerprint(html), "parent": parent,
                    })
                    child.children = [nodes.Text(f'<div class="dw-el-{key} dw-figure">{html}</div>')]
                continue
            kind = None
            if isinstance(child, nodes.paragraph) and not isinstance(node, (nodes.list_item, nodes.entry)):
                kind = "paragraph"
            elif isinstance(child, nodes.list_item):
                kind = "item"
            elif isinstance(child, nodes.row) and not isinstance(node, nodes.thead):
                kind = "row"
            elif isinstance(child, nodes.literal_block):
                kind = "code"
            elif isinstance(child, (nodes.figure, nodes.image)):
                kind = "figure"
            elif isinstance(child, nodes.Admonition):
                kind = "note"
            if kind:
                counters[kind] = counters.get(kind, 0) + 1
                where = "/".join(path)
                text = _image_text(child, self.srcdir) if kind == "figure" else child.astext()
                label = _label(child.get("alt") or " ".join(c.astext() for c in child.findall(nodes.caption)) or "picture") \
                    if kind == "figure" else None
                sel = self.add(child, kind, f"{self.fmt}:{kind}:{where}#{counters[kind]}", text, parent, label=label)
                if kind in ("item", "note"):
                    self.walk(child, path, counters, sel)
                continue
            self.walk(child, path, counters, parent)


def _source(app: Sphinx, docname: str) -> str:
    path = Path(app.env.doc2path(docname))
    return str(path.resolve().relative_to(app.config.deciwa_root_path))


def on_doctree_resolved(app: Sphinx, doctree: nodes.document, docname: str):
    source = _source(app, docname)
    fmt = "md" if source.endswith(".md") else "rst"
    needs = {}
    if SphinxNeedsData:
        needs = {k: dict(v) for k, v in SphinxNeedsData(app.env).get_needs_view().items() if v["docname"] == docname}
    col = Collector(fmt, needs, Path(app.srcdir))
    col.walk(doctree, [], {}, None)
    title = app.env.titles.get(docname)
    app.deciwa_pages[docname] = {"source": source, "title": title.astext() if title else docname,
                                 "elements": col.elements}


def on_page_context(app: Sphinx, pagename, templatename, context, doctree):
    page = app.deciwa_pages.get(pagename)
    if not page:
        return
    data = {"doc": pagename, "source": page["source"], "mode": app.config.deciwa_mode,
            "keys": {e["key"]: e["selector"] for e in page["elements"]},
            "kinds": {e["key"]: e["kind"] for e in page["elements"]},
            "labels": {e["key"]: e["label"] for e in page["elements"]}}
    script = f'<script type="application/json" id="deciwa-page">{json.dumps(data).replace("</", "<\\/")}</script>'
    context["body"] = context.get("body", "") + script


def on_build_finished(app: Sphinx, exc):
    if exc or app.builder.format != "html":
        return
    out = Path(app.outdir) / "_deciwa"
    out.mkdir(exist_ok=True)
    index_path = out / "elements.json"
    pages = {}
    if index_path.exists():  # incremental builds only write changed pages
        pages = json.loads(index_path.read_text()).get("pages", {})
    pages = {d: p for d, p in pages.items() if d in app.env.found_docs}
    pages.update(app.deciwa_pages)
    index_path.write_text(json.dumps({"deciwa": "0.1", "pages": pages}, indent=1, ensure_ascii=False))
    # offline mode: the overlay works without a server from these two files
    root = app.config.deciwa_root_path
    annotations = {src: store.load(root, src) for src in store.sources(root)} if app.config.deciwa_offline_annotations else {}
    (out / "annotations.json").write_text(json.dumps({"deciwa": "0.1", "files": annotations}, ensure_ascii=False))
    cfg = store.config(root)
    config = {"review": cfg["review"], "mode": app.config.deciwa_mode}
    (out / "config.json").write_text(json.dumps(config))
    if app.config.deciwa_mode == "offline":
        # the same data as a script, so the build also works from file:// (no fetch there)
        data = {"elements": {"deciwa": "0.1", "pages": pages}, "annotations": {"deciwa": "0.1", "files": annotations},
                "config": config}
        js = "window.DECIWA_DATA = " + json.dumps(data, ensure_ascii=False).replace("</", "<\\/") + ";\n"
        (Path(app.outdir) / "_static" / "deciwa-data.js").write_text(js)


def on_config_inited(app: Sphinx, config):
    root = config.deciwa_root or str(store.find_root(Path(app.confdir)))
    config.deciwa_root_path = Path(root).resolve()
    config.html_static_path.append(str(STATIC))
    if config.deciwa_mode == "offline":
        app.add_js_file("deciwa-data.js", priority=400)


def setup(app: Sphinx):
    app.add_config_value("deciwa_root", "", "env")
    app.add_config_value("deciwa_root_path", None, "env")
    # "auto": use deciwa serve when it answers, otherwise review offline in the browser
    app.add_config_value("deciwa_mode", "auto", "html")
    # ship the annotations of .deciwa/ with the build (off for public demos)
    app.add_config_value("deciwa_offline_annotations", True, "html")
    app.deciwa_pages = {}
    app.connect("config-inited", on_config_inited)
    app.connect("doctree-resolved", on_doctree_resolved, priority=400)
    app.connect("html-page-context", on_page_context)
    app.connect("build-finished", on_build_finished)
    app.add_css_file("deciwa-overlay.css")
    app.add_js_file("deciwa-overlay.js", defer="defer")
    return {"version": "0.0.1", "parallel_read_safe": True, "parallel_write_safe": False}
