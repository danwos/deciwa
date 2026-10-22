"""Python adapter: classes, functions, methods and the statements outside
functions, read with the standard library `ast` – exact line ranges, no
dependency. Selectors name the definition by its path in the code:
``py:class:Engine``, ``py:function:Engine.start``, ``py:function:main``; a
second definition with the same path (a property setter) gets ``~2``.
Statements at module and class level: ``py:statement:imports`` (a block of
imports), ``py:statement:API`` (an assignment), ``py:statement:__doc__`` (the
docstring), ``py:statement:#3`` / ``py:statement:Engine#1`` (any other
statement, counted per scope – an ``if __name__ …`` block).

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


def _first_line(lines: list[str], n: int) -> str:
    text = lines[n - 1].strip() if 0 < n <= len(lines) else ""
    return text if len(text) <= 70 else text[:69] + "…"


def _docstring(node: ast.stmt) -> bool:
    return isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str)


def _assigned(node: ast.stmt) -> str | None:
    """The name an assignment binds, e.g. ``API`` for ``API = 1``."""
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        return node.targets[0].id
    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
        return node.target.id
    return None


def elements(source: str, path: str = "") -> list[dict]:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []
    lines = source.splitlines()
    out: list[dict] = []
    seen: dict[str, int] = {}

    def add(kind: str, sel_path: str, first: int, last: int, parent: str | None, label: str) -> str:
        seen[f"{kind}:{sel_path}"] = seen.get(f"{kind}:{sel_path}", 0) + 1
        n = seen[f"{kind}:{sel_path}"]
        sel = f"py:{kind}:{sel_path}" if n == 1 else f"py:{kind}:{sel_path}~{n}"
        text = "\n".join(lines[first - 1:last])
        out.append({"key": str(len(out) + 1), "selector": sel, "kind": kind, "label": label,
                    "line": first, "end": last, "text": normalise(text),
                    "fingerprint": fingerprint(text), "parent": parent})
        return sel

    def defs_inside(node: ast.stmt, prefix: str, parent: str | None):
        """Definitions inside if/try/with/for blocks count at their level."""
        for field in ("body", "orelse", "finalbody", "handlers"):
            sub = getattr(node, field, None)
            if not isinstance(sub, list):
                continue
            for child in sub:
                if isinstance(child, ast.ExceptHandler):
                    walk(child.body, prefix, parent, statements=False)
                elif isinstance(child, ast.stmt):
                    if type(child) in KINDS:
                        walk([child], prefix, parent, statements=False)
                    else:
                        defs_inside(child, prefix, parent)

    def walk(body: list[ast.stmt], prefix: str, parent: str | None, statements: bool = True):
        scope = prefix.rstrip(".")
        counter = 0
        i = 0
        while i < len(body):
            node = body[i]
            kind = KINDS.get(type(node))
            if kind:
                first = min([node.lineno] + [d.lineno for d in node.decorator_list])
                sel = add(kind, f"{prefix}{node.name}", first, node.end_lineno, parent, _label(node, lines))
                # inside a class its statements count (attributes); inside a function only nested definitions
                walk(node.body, f"{prefix}{node.name}.", sel, statements=kind == "class")
                i += 1
                continue
            if not statements:
                i += 1
                continue
            # statements outside functions: docstrings, imports (one per block), assignments, everything else
            if i == 0 and _docstring(node):
                add("statement", f"{prefix}__doc__", node.lineno, node.end_lineno, parent, _first_line(lines, node.lineno))
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                j = i
                while j + 1 < len(body) and isinstance(body[j + 1], (ast.Import, ast.ImportFrom)):
                    j += 1
                add("statement", f"{prefix}imports", node.lineno, body[j].end_lineno, parent, _first_line(lines, node.lineno))
                i = j
            elif _assigned(node):
                add("statement", f"{prefix}{_assigned(node)}", node.lineno, node.end_lineno, parent, _first_line(lines, node.lineno))
            else:
                counter += 1
                sel = add("statement", f"{scope}#{counter}", node.lineno, node.end_lineno, parent,
                          _first_line(lines, node.lineno))
                defs_inside(node, prefix, sel)
            i += 1

    walk(tree.body, "", None)
    out.sort(key=lambda e: (e["line"], -e["end"]))
    for n, e in enumerate(out, 1):
        e["key"] = str(n)
    return out


def title(source: str, fallback: str) -> str:
    return fallback
