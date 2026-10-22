"""Markdown adapter (PROP_ADAPTER_API, PROP_SELECTORS): sections by heading
path, paragraphs, list items, table rows, code blocks and pictures, counted
per section – the same selectors the Sphinx extension gives Markdown pages:
``md:<kind>:<heading path>#<n>``.

The text of an element is what a reader sees (inline markup removed), as in
the Sphinx and browser adapters, so a quote selected in a rendered view is
found in it. Lines are 1-based and count the frontmatter.
"""

from __future__ import annotations

import re

from markdown_it import MarkdownIt

from ..model import fingerprint, normalise

name = "md"
suffixes = (".md", ".markdown")

_md = MarkdownIt("commonmark").enable("table").enable("strikethrough")
_FRONT = re.compile(r"\A---\r?\n.*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|\Z)", re.S)
_VISUAL = re.compile(r"<(svg|figure|img|picture|canvas)\b", re.I)


def _label(text: str, n: int = 70) -> str:
    text = normalise(text)
    return text if len(text) <= n else text[: n - 1] + "…"


def _plain(inline) -> str:
    """Visible text of an inline token: markup and HTML tags removed, image alt text kept."""
    out = []
    for c in inline.children or []:
        if c.type in ("text", "code_inline"):
            out.append(c.content)
        elif c.type in ("softbreak", "hardbreak"):
            out.append(" ")
        elif c.type == "image":
            out.append(_plain(c))
    return "".join(out)


def _only_image(inline) -> bool:
    kids = [c for c in inline.children or [] if not (c.type == "text" and not c.content.strip())]
    return bool(kids) and all(c.type == "image" for c in kids)


def _image_text(inline) -> str:
    return " ".join(f"image {c.attrGet('src')} {_plain(c)}" for c in inline.children or [] if c.type == "image")


def front_lines(text: str) -> int:
    """Number of lines the frontmatter block takes (0 without one)."""
    m = _FRONT.match(text)
    return m.group(0).count("\n") if m else 0


def elements(source: str, path: str = "") -> list[dict]:
    offset = front_lines(source)
    body = source.splitlines(keepends=True)[offset:]
    tokens = _md.parse("".join(body))

    out: list[dict] = []
    sections: list[dict] = []      # open sections: level, name, element, texts, counters
    seen: dict[str, int] = {}      # heading paths, for duplicates (Notes~2)
    root_counters: dict[str, int] = {}
    items: list[dict] = []         # open list items, innermost last

    def path_() -> str:
        return "/".join(s["name"] for s in sections)

    def counters() -> dict:
        return sections[-1]["counters"] if sections else root_counters

    def parent() -> str | None:
        if items:
            return items[-1]["selector"]
        return sections[-1]["element"]["selector"] if sections else None

    def add(kind: str, text: str, mapping, label: str | None = None, element_text: str | None = None) -> dict:
        c = counters()
        c[kind] = c.get(kind, 0) + 1
        text_ = normalise(element_text if element_text is not None else text)
        e = {"key": str(len(out) + 1), "selector": f"md:{kind}:{path_()}#{c[kind]}", "kind": kind,
             "label": label or _label(text), "line": mapping[0] + offset + 1, "end": mapping[1] + offset,
             "text": text_, "fingerprint": fingerprint(text_), "parent": parent()}
        for s in sections:
            s["texts"].append(text_)
        out.append(e)
        return e

    def close_section():
        s = sections.pop()
        e = s["element"]
        e["text"] = normalise(" ".join(s["texts"]))
        e["fingerprint"] = fingerprint(e["text"])

    def inline_after(i: int):
        return tokens[i + 1] if i + 1 < len(tokens) and tokens[i + 1].type == "inline" else None

    def close_of(i: int) -> int:
        """Index of the token that closes the block opened at i."""
        depth = 0
        for j in range(i, len(tokens)):
            depth += tokens[j].nesting
            if depth == 0:
                return j
        return len(tokens) - 1

    item_ends: list[int] = []
    in_thead = False
    for i, t in enumerate(tokens):
        while item_ends and i > item_ends[-1]:
            item_ends.pop()
            items.pop()
        if t.type == "heading_open":
            level = int(t.tag[1])
            while sections and sections[-1]["level"] >= level:
                close_section()
            inline = inline_after(i)
            title = normalise(_plain(inline)) if inline else "?"
            title = title or "?"
            full = f"{path_()}/{title}"
            seen[full] = seen.get(full, 0) + 1
            nm = (title if seen[full] == 1 else f"{title}~{seen[full]}").replace("/", "∕")
            for s in sections:
                s["texts"].append(title)
            e = {"key": str(len(out) + 1), "selector": "", "kind": "heading", "label": _label(title),
                 "line": t.map[0] + offset + 1, "end": t.map[1] + offset, "text": "", "fingerprint": "",
                 "parent": sections[-1]["element"]["selector"] if sections else None}
            sections.append({"level": level, "name": nm, "element": e, "texts": [title], "counters": {}})
            e["selector"] = f"md:heading:{path_()}"
            out.append(e)
            items.clear()
            item_ends.clear()
        elif t.type == "list_item_open":
            end = close_of(i)
            text = " ".join(_plain(x) for x in tokens[i:end] if x.type == "inline")
            e = add("item", text, t.map)
            items.append(e)
            item_ends.append(end)
        elif t.type == "paragraph_open" and not items:
            inline = inline_after(i)
            if inline is None:
                continue
            if _only_image(inline):
                add("figure", _image_text(inline), t.map, label=_label(_plain(inline) or "picture"))
            else:
                add("paragraph", _plain(inline), t.map)
        elif t.type == "thead_open":
            in_thead = True
        elif t.type == "thead_close":
            in_thead = False
        elif t.type == "tr_open" and not in_thead and not items:
            end = close_of(i)
            add("row", " | ".join(_plain(x) for x in tokens[i:end] if x.type == "inline"), t.map)
        elif t.type in ("fence", "code_block") and not items:
            add("code", t.content, t.map)
        elif t.type == "html_block" and not items and _VISUAL.search(t.content):
            add("figure", t.content, t.map, label=_label(re.sub(r"<[^>]+>", " ", t.content) or "picture"))
    while sections:
        close_section()
    return out


def title(source: str, fallback: str) -> str:
    """The first top-level heading, else the fallback."""
    for e in elements(source):
        if e["kind"] == "heading":
            return e["label"]
    return fallback
