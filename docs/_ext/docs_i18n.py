"""Translates what Sphinx's gettext leaves out in these docs.

- **Needs:** a need's title, type name and fields like ``reason`` live in the
  need data and are rendered from there, not from the doctree. They go into
  the catalog ``needs.pot``.
- **Raw HTML** (inline SVG diagrams, the video): Sphinx can extract raw
  blocks (``gettext_additional_targets``), but wraps the translation in rST
  literal syntax, which MyST pages cannot parse. They go into the catalog
  of their page instead.

With ``-b gettext`` both are added to the catalogs; in every other build
whose language is not English they are replaced with the translations from
``locales/<language>/LC_MESSAGES/``. Everything else (including the need
content) is translated by Sphinx itself.
"""

from __future__ import annotations

from pathlib import Path

from babel.messages.pofile import read_po
from docutils import nodes
from sphinx.application import Sphinx
from sphinx.builders.gettext import MsgOrigin
from sphinx.util.i18n import docname_to_domain
from sphinx_needs.data import SphinxNeedsData

FIELDS = ("title", "type_name", "reason", "alternatives")
NEEDS = "needs"


def _translations(app: Sphinx, domain: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for d in app.config.locale_dirs:
        po = Path(app.srcdir, d, app.config.language, "LC_MESSAGES", f"{domain}.po")
        if po.is_file():
            with po.open("rb") as f:
                for m in read_po(f):
                    if m.id and m.string and not m.fuzzy:
                        found[m.id] = m.string
    return found


def _translating(app: Sphinx) -> bool:
    return app.builder.name != "gettext" and app.config.language not in (None, "en")


def _raw_html(doctree: nodes.document):
    for node in doctree.findall(nodes.raw):
        if "html" in node.get("format", "").split():
            yield node


def on_doctree_read(app: Sphinx, doctree: nodes.document):
    if not _translating(app):
        return
    tr = _translations(app, docname_to_domain(app.env.docname, app.config.gettext_compact))
    for node in _raw_html(doctree):
        if node.astext() in tr:
            node.children = [nodes.Text(tr[node.astext()])]


def on_env_updated(app: Sphinx, env):
    data = SphinxNeedsData(env)
    if app.builder.name == "gettext":
        catalogs = app.builder.catalogs
        for need in data.get_needs_view().values():
            source = str(env.doc2path(need["docname"])) if need["docname"] else ""
            for field in FIELDS:
                if need.get(field):
                    catalogs[NEEDS].add(need[field], MsgOrigin(source, need.get("lineno") or 0))
        for docname in env.found_docs:
            domain = docname_to_domain(docname, app.config.gettext_compact)
            for node in _raw_html(env.get_doctree(docname)):
                catalogs[domain].add(node.astext(), MsgOrigin(str(env.doc2path(docname)), node.line or 0))
        return
    if not _translating(app):
        return
    tr = _translations(app, NEEDS)
    for need in data.get_needs_mutable().values():
        for field in FIELDS:
            if need.get(field) in tr:
                need[field] = tr[need[field]]


def setup(app: Sphinx):
    app.connect("doctree-read", on_doctree_read)
    app.connect("env-updated", on_env_updated)
    return {"version": "0.1", "parallel_read_safe": True, "parallel_write_safe": True}
