"""Python adapter: classes, functions and methods, read with the standard
library `ast` – exact line ranges, no dependency. Selectors name the
definition by its path in the code: ``py:class:Engine``,
``py:function:Engine.start``, ``py:function:main``; a second definition
with the same path (a property setter, a redefinition) gets ``~2``.

The text of an element is its source, decorators included, so any change to
an approved function makes it stale. Lines are 1-based; ``end`` is the last
line of the definition.
"""

from __future__ import annotations

import ast

from ..model import fingerprint, normalise

name = "py"
suffixes = (".py", ".pyi")

KINDS = {ast.ClassDef: "class", ast.FunctionDef: "function", ast.AsyncFunctionDef: "function"}


def _label(node: ast.AST, lines: list[str]) -> str:
    """The first line of the definition, e.g. ``def start(self) -> Handshake:``."""
    text = lines[node.lineno - 1].strip() if node.lineno - 1 < len(lines) else node.name
    return text if len(text) <= 70 else text[:69] + "…"


def elements(source: str, path: str = "") -> list[dict]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []
    lines = source.splitlines()
    out: list[dict] = []
    seen: dict[str, int] = {}

    def walk(body: list[ast.stmt], prefix: str, parent: str | None):
        for node in body:
            kind = KINDS.get(type(node))
            if kind is None:
                # definitions inside if/try/with blocks at the same level still count
                for field in ("body", "orelse", "finalbody", "handlers"):
                    sub = getattr(node, field, None)
                    if isinstance(sub, list):
                        walk([n for n in sub if isinstance(n, ast.stmt)] +
                             [s for h in sub if isinstance(h, ast.ExceptHandler) for s in h.body], prefix, parent)
                continue
            full = f"{prefix}{node.name}"
            seen[full] = seen.get(full, 0) + 1
            nm = full if seen[full] == 1 else f"{full}~{seen[full]}"
            first = min([node.lineno] + [d.lineno for d in node.decorator_list])
            text = "\n".join(lines[first - 1:node.end_lineno])
            sel = f"py:{kind}:{nm}"
            out.append({"key": str(len(out) + 1), "selector": sel, "kind": kind, "label": _label(node, lines),
                        "line": first, "end": node.end_lineno, "text": normalise(text),
                        "fingerprint": fingerprint(text), "parent": parent})
            walk(node.body, nm + ".", sel)

    walk(tree.body, "", None)
    return out


def title(source: str, fallback: str) -> str:
    return fallback
