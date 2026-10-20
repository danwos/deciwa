"""Sphinx configuration for the deciwa developer docs."""


project = "deciwa"
author = "danwos"
copyright = "2026, danwos"

extensions = ["myst_parser", "sphinx_needs", "sphinx.ext.graphviz", "deciwa.sphinx"]  # deciwa.sphinx: review these docs in deciwa itself

source_suffix = {".md": "markdown", ".rst": "restructuredtext"}
exclude_patterns = ["_build", "README.md"]
myst_enable_extensions = ["colon_fence", "deflist", "fieldlist"]
myst_heading_anchors = 3

# -- Theme -------------------------------------------------------------------

html_theme = "furo"
html_title = "deciwa"
html_logo = "_static/img/deciwa.webp"
html_favicon = "_static/img/logo.svg"
html_static_path = ["_static"]
templates_path = ["_templates"]
html_css_files = ["danwos.css"]
html_show_sourcelink = False
html_theme_options = {
    "sidebar_hide_name": True,
    "navigation_with_keys": True,
    "light_css_variables": {
        "color-brand-primary": "#0F766E",
        "color-brand-content": "#0F766E",
        "color-brand-visited": "#0F766E",
        "color-background-primary": "#FFFFFF",
        "color-foreground-primary": "#1B1A22",
        "font-stack": "Inter, system-ui, sans-serif",
        "font-stack--monospace": "'JetBrains Mono', ui-monospace, monospace",
        "font-stack--headings": "'Bricolage Grotesque', Inter, system-ui, sans-serif",
    },
    "dark_css_variables": {
        "color-brand-primary": "#14B8A6",
        "color-brand-content": "#14B8A6",
        "color-brand-visited": "#14B8A6",
        "color-background-primary": "#0D1B2A",
        "color-background-secondary": "#0A1622",
        "color-foreground-primary": "#E8EDF3",
    },
}

# -- Sphinx-Needs ------------------------------------------------------------

needs_id_required = True
needs_id_regex = r"^[A-Z]+_[0-9A-Z_]+$"

needs_types = [
    {"directive": "dec", "title": "Decision", "prefix": "DEC_", "color": "#9FE3D9", "style": "rectangle"},
    {"directive": "prop", "title": "Proposal", "prefix": "PROP_", "color": "#EFE4D4", "style": "rectangle"},
    {"directive": "question", "title": "Question", "prefix": "Q_", "color": "#F6C9BF", "style": "rectangle"},
    # only for the examples on the demo page
    {"directive": "req", "title": "Requirement", "prefix": "REQ_", "color": "#D9E4F2", "style": "rectangle"},
]

STATUSES = ["approved", "draft", "review", "rejected", "open", "answered"]

def _text(description):
    return {"description": description, "nullable": True, "schema": {"type": "string"}}

needs_fields = {
    "status": {"schema": {"type": "string", "enum": STATUSES}, "nullable": True},
    # metadata is folded away; the toggle on each need shows it
    "collapse": {"default": True},
    "decided": _text("date of the decision (YYYY-MM-DD)"),
    "reason": _text("why it was decided this way"),
    "alternatives": _text("options that were considered and not taken"),
    "to": _text("who has to answer a question"),
}

needs_links = {
    "refines": {"incoming": "refined by", "outgoing": "refines"},
    "answers": {"incoming": "answered by", "outgoing": "answers"},
}

needs_default_layout = "clean"
needs_table_style = "TABLE"
needs_build_json = True

needs_flow_engine = "graphviz"
graphviz_output_format = "svg"
needs_graphviz_styles = {
    "danwos": {
        "graph": {"rankdir": "LR", "bgcolor": "transparent", "nodesep": "0.25", "ranksep": "0.9",
                  "fontname": "Helvetica,Arial,sans-serif"},
        "node": {"fontname": "Helvetica,Arial,sans-serif", "fontsize": "10", "style": "rounded,filled",
                 "color": "#1B1A22", "penwidth": "1.2", "margin": "0.12,0.06"},
        "edge": {"color": "#5B6470", "arrowsize": "0.7", "penwidth": "1"},
    }
}
