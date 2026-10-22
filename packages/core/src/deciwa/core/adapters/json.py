"""JSON adapter: every value of a standard JSON file is an element – the
document, every object member, every array item, leaves included. Selectors
are JSON Pointers (RFC 6901): ``json:`` for the document, ``json:/color/primary``,
``json:/versions/0``. Kinds: ``object``, ``array``, ``value``.

The standard library gives no positions, so a small scanner reads the file
once and records the lines of every key and value. The text of an element is
its value in canonical form (sorted keys, no whitespace): reformatting or
reordering keys keeps the review state. Lines are 1-based; an object member
starts at the line of its key. Only standard JSON – no JSON Lines, no
comments, no NaN; invalid JSON gives no elements.
"""

from __future__ import annotations

import json  # absolute import: the standard library, not this module
import re
from bisect import bisect_right
from json.decoder import scanstring

from . import _data

name = "json"
suffixes = (".json",)

_NUMBER = re.compile(r"-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?")
_WS = re.compile(r"[ \t\n\r]*")
_LITERALS = {"true": True, "false": False, "null": None}


def _reject(constant: str):
    raise ValueError(f"not standard JSON: {constant}")


class _Scanner:
    def __init__(self, text: str):
        self.s = text
        self.newlines = [m.start() for m in re.finditer("\n", text)]

    def line(self, i: int) -> int:
        return bisect_right(self.newlines, i - 1) + 1

    def ws(self, i: int) -> int:
        return _WS.match(self.s, i).end()

    def value(self, i: int) -> tuple[_data.Node, int]:
        """The value starting at i (no whitespace before it) and the index after it."""
        s, start = self.s, self.line(i)
        c = s[i]
        if c == "{":
            members: dict[str, tuple[str, int, _data.Node]] = {}
            i = self.ws(i + 1)
            if s[i] != "}":
                while True:
                    kline = self.line(i)
                    key, i = scanstring(s, i + 1)
                    i = self.ws(self.ws(i) + 1)  # past ':'
                    child, i = self.value(i)
                    members.pop(key, None)  # a repeated key: the last one counts, as in json.loads
                    members[key] = (key, kline, child)
                    i = self.ws(i)
                    if s[i] == "}":
                        break
                    i = self.ws(i + 1)  # past ','
            members_ = list(members.values())
            return _data.Node({k: n.value for k, _, n in members_}, start, self.line(i), members_), i + 1
        if c == "[":
            items: list[tuple[str, int, _data.Node]] = []
            i = self.ws(i + 1)
            if s[i] != "]":
                while True:
                    child, i = self.value(i)
                    items.append((str(len(items)), child.line, child))
                    i = self.ws(i)
                    if s[i] == "]":
                        break
                    i = self.ws(i + 1)
            return _data.Node([n.value for _, _, n in items], start, self.line(i), items), i + 1
        if c == '"':
            text, j = scanstring(s, i + 1)
            return _data.Node(text, start, self.line(j - 1)), j
        for word, val in _LITERALS.items():
            if s.startswith(word, i):
                return _data.Node(val, start, start), i + len(word)
        m = _NUMBER.match(s, i)
        return _data.Node(json.loads(m.group(0)), start, start), m.end()


def tree(source: str) -> _data.Node | None:
    """The value tree of a JSON text, or None when it is not standard JSON."""
    source = source.removeprefix("﻿")
    try:
        json.loads(source, parse_constant=_reject)  # strict check first; the scanner trusts the syntax
        scanner = _Scanner(source)
        return scanner.value(scanner.ws(0))[0]
    except (ValueError, RecursionError):
        return None


def elements(source: str, path: str = "") -> list[dict]:
    root = tree(source)
    return _data.elements(name, root) if root is not None else []


def title(source: str, fallback: str) -> str:
    return fallback
