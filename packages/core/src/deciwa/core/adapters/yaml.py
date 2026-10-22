"""YAML adapter: the same model as JSON – a mapping is an object, a sequence
an array, a scalar a value. Every value is an element; selectors are JSON
Pointers: ``yaml:`` for the document, ``yaml:/jobs/build/steps/2``. Keys that
are not strings become their JSON form (``1``, ``true``, ``null``).

Read with PyYAML's safe loader: ``yaml.compose`` gives the nodes with their
positions, the safe constructor the values (anchors, aliases and merge keys
resolved). Only the first document of a file is read. Members a mapping gets
from a merge key (``<<: *base``) are part of its value but no elements of
their own – they are reviewed where they are written. The text of an element
is its value in canonical form, as for JSON. Invalid YAML gives no elements.
"""

from __future__ import annotations

import json

import yaml  # absolute import: PyYAML, not this module

from . import _data

name = "yaml"
suffixes = (".yaml", ".yml")

_MERGE = "tag:yaml.org,2002:merge"


class _Loader(yaml.SafeLoader):
    """Safe loader whose aliases get their own node (a copy carrying the alias's
    position), so an alias is found where it is written, not at its anchor."""

    def compose_node(self, parent, index):
        if self.check_event(yaml.AliasEvent):
            event = self.peek_event()
            node = super().compose_node(parent, index)
            alias = type(node)(node.tag, node.value, event.start_mark, event.end_mark)
            alias.alias_of = node
            return alias
        return super().compose_node(parent, index)


def _key(key) -> str:
    if isinstance(key, str):
        return key
    if key is None or isinstance(key, (bool, int, float)):
        return json.dumps(key)
    return str(key)


def _plain(value):
    """The value as JSON data: keys as strings, tuples as lists."""
    if isinstance(value, dict):
        return {_key(k): _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    return value


def tree(source: str) -> _data.Node | None:
    """The value tree of the first YAML document, or None (empty or invalid)."""
    try:
        loader = _Loader(source)
        try:
            root = loader.get_node() if loader.check_node() else None
            if root is None:
                return None
            lines = source.splitlines()

            def end_of(node) -> int:
                mark = node.end_mark
                last = mark.line if mark.column == 0 and mark.line > node.start_mark.line else mark.line + 1
                while last > node.start_mark.line + 1 and last <= len(lines) and not lines[last - 1].strip():
                    last -= 1  # a block scalar ends after its trailing blank lines
                return last

            # constructing a mapping with a merge key rewrites its node: keep the children as written
            written: dict[int, list] = {}

            def snapshot(node):
                if id(node) in written or getattr(node, "alias_of", None) is not None:
                    return
                if isinstance(node, (yaml.MappingNode, yaml.SequenceNode)):
                    written[id(node)] = list(node.value)
                    for child in written[id(node)]:
                        for n in child if isinstance(child, tuple) else (child,):
                            snapshot(n)

            def walk(node) -> _data.Node:
                value = _plain(loader.construct_object(node, deep=True))
                line = node.start_mark.line + 1
                members: list[tuple[str, int, _data.Node]] = []
                if id(node) in written:
                    if isinstance(node, yaml.MappingNode):
                        found: dict[str, tuple[str, int, _data.Node]] = {}
                        for knode, vnode in written[id(node)]:
                            if knode.tag == _MERGE:
                                continue
                            key = _key(loader.construct_object(knode, deep=True))
                            found.pop(key, None)  # a repeated key: the last one counts
                            found[key] = (key, knode.start_mark.line + 1, walk(vnode))
                        members = list(found.values())
                    elif isinstance(node, yaml.SequenceNode):
                        members = [(str(n), item.line, item) for n, item in enumerate(walk(v) for v in written[id(node)])]
                if members and not node.flow_style:
                    end = max(m[2].end for m in members)  # block collections end with their last value
                else:
                    end = end_of(node)
                return _data.Node(value, line, max(line, end), members)

            snapshot(root)
            return walk(root)
        finally:
            loader.dispose()
    except (yaml.YAMLError, ValueError, TypeError, RecursionError):
        return None


def elements(source: str, path: str = "") -> list[dict]:
    root = tree(source)
    return _data.elements(name, root) if root is not None else []


def title(source: str, fallback: str) -> str:
    return fallback
