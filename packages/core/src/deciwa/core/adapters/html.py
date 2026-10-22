"""HTML adapter for HTML files: the elements of a page with their source lines,
following the rules of the browser's DOM scan (PROP_DOM_ADAPTER, js/dom.js):
sections by the heading outline, paragraphs, list items, table rows, code
blocks, notes and pictures, counted per section –
``html:<kind>:<heading path>#<n>``.

A host shows the page and marks every start tag with its source line, so the
rendered page and the source view share these elements. Each element also
names its ``tag``, so the host matches the right tag on a line. Without a
browser there is no layout: hidden-by-CSS elements and tiny icons count.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser

from ..model import fingerprint, normalise

name = "html"
suffixes = (".html", ".htm")

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
SKIP = {"script", "style", "noscript", "template", "nav", "form", "dialog", "iframe", "button", "select", "textarea", "head"}
HEADING = re.compile(r"^h[1-6]$")
TEXT_TAGS = {"p", "blockquote", "dd", "dt", "address", "figcaption"}
BLOCK_TAGS = {"div", "section", "article", "main", "aside", "header", "footer", "details", "li", "ul", "ol", "dl", "dt",
              "dd", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "figure", "pre", "p", "blockquote"}
CONTAINERS = {"table", "thead", "tbody", "tfoot", "ul", "ol", "dl", "section", "article", "main", "header", "footer", "details"}
PICTURES = {"img", "svg", "picture", "canvas", "video"}
# a start tag of these closes an open <p>
CLOSES_P = BLOCK_TAGS | {"h1", "h2", "h3", "h4", "h5", "h6", "hr", "nav", "form"}


class Node:
    __slots__ = ("tag", "attrs", "line", "end", "children", "parent")

    def __init__(self, tag: str, attrs: dict, line: int, parent: "Node | None"):
        self.tag, self.attrs, self.line, self.end, self.parent = tag, attrs, line, line, parent
        self.children: list = []  # Node or str

    def text(self) -> str:
        return "".join(c if isinstance(c, str) else ("" if c.tag in ("script", "style") else c.text()) for c in self.children)

    def own_text(self) -> str:
        return normalise("".join(c if isinstance(c, str) else (c.text() if c.tag not in BLOCK_TAGS and not HEADING.match(c.tag) else "")
                                 for c in self.children))

    def has_blocks(self) -> bool:
        return any(isinstance(c, Node) and (c.tag in BLOCK_TAGS or HEADING.match(c.tag)) for c in self.children)

    def find(self, pred) -> "Node | None":
        for c in self.children:
            if isinstance(c, Node):
                if pred(c):
                    return c
                hit = c.find(pred)
                if hit:
                    return hit
        return None

    def closest(self, tags: set) -> "Node | None":
        n = self.parent
        while n:
            if n.tag in tags:
                return n
            n = n.parent
        return None


class _Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#document", {}, 1, None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        if tag in CLOSES_P and self.cur.tag == "p":
            self.cur = self.cur.parent
        if tag == "li" and self.cur.tag == "li":
            self.cur = self.cur.parent
        if tag == "tr" and self.cur.tag == "tr":
            self.cur = self.cur.parent
        node = Node(tag, {k: v or "" for k, v in attrs}, self.getpos()[0], self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, {k: v or "" for k, v in attrs}, self.getpos()[0], self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is self.root:
            return  # a stray end tag
        line = self.getpos()[0]
        m = self.cur
        while True:
            m.end = line
            if m is n:
                break
            m = m.parent
        self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def _parse(source: str) -> Node:
    b = _Builder()
    b.feed(source)
    b.close()
    # unclosed elements end at the last line
    last = source.count("\n") + 1
    n = b.cur
    while n is not b.root:
        n.end = last
        n = n.parent
    return b.root


def _short(t: str, n: int = 70) -> str:
    t = normalise(t)
    return t if len(t) <= n else t[: n - 1] + "…"


def _review_root(doc: Node) -> Node:
    main = doc.find(lambda n: n.tag == "main")
    if main:
        return main
    articles = []
    stack = [doc]
    while stack:
        n = stack.pop()
        for c in n.children:
            if isinstance(c, Node):
                if c.tag == "article":
                    articles.append(c)
                stack.append(c)
    if len(articles) == 1:
        return articles[0]
    return doc.find(lambda n: n.tag == "body") or doc


def _skipped(n: Node) -> bool:
    a = n.attrs
    return (n.tag in SKIP or "hidden" in a or a.get("aria-hidden") == "true" or "data-deciwa-ignore" in a
            or ((n.tag in ("header", "footer")) and not n.closest({"article", "main", "section"})))


def _picture(n: Node) -> bool:
    if n.tag == "figure":
        return True
    return n.tag in PICTURES and not n.closest({"a", "button"})


def _picture_text(n: Node) -> str:
    img = n if n.tag == "img" else n.find(lambda c: c.tag == "img")
    cap_node = n.find(lambda c: c.tag == "figcaption")
    cap = cap_node.text() if cap_node else ""
    if img:
        return f"image {img.attrs.get('src', '')} {img.attrs.get('alt', '')} {cap}"
    return f"figure {normalise(n.text())} {cap}"


def _picture_label(n: Node) -> str:
    img = n if n.tag == "img" else n.find(lambda c: c.tag == "img")
    cap = n.find(lambda c: c.tag == "figcaption")
    title = n.find(lambda c: c.tag == "title")
    return _short((cap.text() if cap else "") or (img.attrs.get("alt") if img else "") or n.attrs.get("aria-label", "")
                  or (title.text() if title else "") or "picture")


def elements(source: str, path: str = "") -> list[dict]:
    root = _review_root(_parse(source))
    out: list[dict] = []
    stack: list[dict] = []   # open sections: level, name, element, texts
    seen: dict[str, int] = {}
    counters: dict[str, int] = {}

    def path_() -> str:
        return "/".join(s["name"] for s in stack)

    def parent() -> str | None:
        return stack[-1]["element"]["selector"] if stack else None

    def add(n: Node, kind: str, text: str, label: str | None = None, line: int | None = None):
        counters[kind] = counters.get(kind, 0) + 1
        t = normalise(text)
        e = {"key": str(len(out) + 1), "selector": f"html:{kind}:{path_()}#{counters[kind]}", "kind": kind,
             "label": label or _short(t), "line": line or n.line, "end": n.end, "tag": n.tag, "text": t,
             "fingerprint": fingerprint(t), "parent": parent()}
        for s in stack:
            s["texts"].append(t)
        out.append(e)

    def close():
        s = stack.pop()
        e = s["element"]
        e["text"] = normalise(" ".join(s["texts"]))
        e["fingerprint"] = fingerprint(e["text"])

    def heading(h: Node):
        nonlocal counters
        level = int(h.tag[1])
        while stack and stack[-1]["level"] >= level:
            close()
        title = normalise(h.text()) or "?"
        full = f"{path_()}/{title}"
        seen[full] = seen.get(full, 0) + 1
        nm = (title if seen[full] == 1 else f"{title}~{seen[full]}").replace("/", "∕")
        for s in stack:
            s["texts"].append(title)
        e = {"key": str(len(out) + 1), "selector": "", "kind": "heading", "label": _short(title), "line": h.line,
             "end": h.end, "tag": h.tag, "text": "", "fingerprint": "", "parent": parent()}
        stack.append({"level": level, "name": nm, "element": e, "texts": [title]})
        e["selector"] = f"html:heading:{path_()}"
        out.append(e)
        counters = {}

    def walk(el: Node, in_item: bool):
        for c in el.children:
            if not isinstance(c, Node) or _skipped(c):
                continue
            tag = c.tag
            if HEADING.match(tag):
                heading(c)
                continue
            if _picture(c):
                add(c, "figure", _picture_text(c), _picture_label(c))
                continue
            if tag == "pre":
                add(c, "code", c.text())
                continue
            if tag == "li":
                add(c, "item", c.text())
                walk(c, True)
                continue
            if tag == "tr":
                cells = [x for x in c.children if isinstance(x, Node) and x.tag in ("td", "th")]
                if not c.closest({"thead"}) and not all(x.tag == "th" for x in cells):
                    add(c, "row", " | ".join(normalise(x.text()) for x in cells))
                continue
            if tag == "aside" or c.attrs.get("role") == "note":
                add(c, "note", c.text())
                if len([x for x in c.children if isinstance(x, Node)]) > 1:
                    walk(c, False)
                continue
            if tag in CONTAINERS or in_item:
                walk(c, in_item)
                continue
            if tag in TEXT_TAGS and not c.has_blocks():
                if normalise(c.text()):
                    add(c, "paragraph", c.text())
                continue
            if not c.has_blocks() and len(c.own_text().split(" ")) >= 3:
                add(c, "paragraph", c.text())
                continue
            walk(c, in_item)

    walk(root, False)
    while stack:
        close()
    return out


def title(source: str, fallback: str) -> str:
    m = re.search(r"<title[^>]*>(.*?)</title>", source, re.I | re.S)
    return normalise(re.sub(r"<[^>]+>", "", m.group(1))) if m else fallback
