"""Shared part of the data adapters (JSON, YAML): a tree of values with their
lines becomes the element list.

Every value is an element – the document, every object member, every array
item, leaves included. Selectors are JSON Pointers (RFC 6901) behind the
adapter name: ``json:`` for the document, ``json:/color/primary``,
``yaml:/jobs/build/steps/2``. The text of an element is its value in a
canonical form (sorted keys, no whitespace), so reformatting, reindenting or
reordering keys keeps the fingerprint.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from ..model import fingerprint


@dataclass
class Node:
    """A value with its first and last line (1-based). ``members`` lists the
    children as (key, line of the key, node); array items use their index as
    key and their own first line."""
    value: object
    line: int
    end: int
    members: list[tuple[str, int, "Node"]] = field(default_factory=list)


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str)


def preview(value, n: int = 70) -> str:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)
    return text if len(text) <= n else text[: n - 1] + "…"


def escape(key: str) -> str:
    return key.replace("~", "~0").replace("/", "~1")


def kind_of(value) -> str:
    return "object" if isinstance(value, dict) else "array" if isinstance(value, list) else "value"


def _label(key: str | None, value) -> str:
    kind = kind_of(value)
    size = f"{{{len(value)}}}" if kind == "object" else f"[{len(value)}]" if kind == "array" else None
    if key is None:
        return size or preview(value)
    return f"{key} {size}" if size else f"{key}: {preview(value)}"


def elements(name: str, root: Node) -> list[dict]:
    out: list[dict] = []

    def walk(node: Node, pointer: str, key: str | None, line: int, parent: str | None):
        sel = f"{name}:{pointer}"
        text = canonical(node.value)
        out.append({"key": "", "selector": sel, "pointer": pointer, "kind": kind_of(node.value),
                    "label": _label(key, node.value), "line": line, "end": max(line, node.end),
                    "text": text, "fingerprint": fingerprint(text), "parent": parent})
        for k, kline, child in node.members:
            walk(child, f"{pointer}/{escape(k)}", k, kline, sel)

    walk(root, "", None, root.line, None)
    out.sort(key=lambda e: e["line"])  # stable: document order, a parent before its children
    for n, e in enumerate(out, 1):
        e["key"] = str(n)
    return out
