"""Adapters turn the text of a source file into its reviewable elements.

Adapters are pure: text in, element list out – no file access, no state.
Each element is a dict like the ones the Sphinx extension writes into the
elements index: ``key, selector, kind, label, line, end, text, fingerprint,
parent``.
"""

from __future__ import annotations

from . import html, json, markdown, python, yaml

ADAPTERS = {".md": markdown, ".markdown": markdown, ".py": python, ".pyi": python,
            ".html": html, ".htm": html, ".json": json, ".yaml": yaml, ".yml": yaml}


def for_path(path: str):
    """The adapter for a file name, or None."""
    dot = path.rfind(".")
    return ADAPTERS.get(path[dot:].lower()) if dot >= 0 else None


__all__ = ["ADAPTERS", "for_path", "html", "json", "markdown", "python", "yaml"]
