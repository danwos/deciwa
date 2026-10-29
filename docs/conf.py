"""Sphinx configuration for the deciwa developer docs."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "_ext"))


project = "deciwa"
author = "danwos"
copyright = "2026, danwos"

extensions = ["myst_parser", "sphinx_needs", "sphinx.ext.graphviz", "deciwa.sphinx", "docs_i18n", "sphinxext.opengraph"]  # deciwa.sphinx: review these docs in deciwa itself

source_suffix = {".md": "markdown", ".rst": "restructuredtext"}
exclude_patterns = ["_build", "README.md"]
myst_enable_extensions = ["colon_fence", "deflist", "fieldlist"]
myst_heading_anchors = 3

# -- Languages ---------------------------------------------------------------
# English is the source; translations live in locales/<lang>/LC_MESSAGES/*.po
# (sphinx-build -b gettext, then sphinx-intl update). Build one language with
# -D language=de; every language gets its own folder on the published site.

language = "en"
locale_dirs = ["locales/"]
gettext_compact = False
gettext_uuid = False
# every language and its folder on the site; English stays at the root
DOCS_LANGUAGES = {"en": ("English", ""), "de": ("Deutsch", "de/")}
DOCS_URL = "https://deciwa.danwos.dev/"

# -- Link previews (Open Graph, Twitter Card) ------------------------------------
# sphinxext-opengraph writes og:title, og:description (the page's first
# paragraph), og:url and og:image on every page. The card image is the tool's
# card from danwos.dev (built there from src/pages/og/), so docs and website
# share one look; _languages picks the language.
ogp_site_name = "deciwa"
ogp_image_alt = "deciwa – danwos"
ogp_social_cards = {"enable": False}
OGP_TAGS = [
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
]


def _languages(app, config):
    """Switcher and hreflang links: the same page in every other language."""
    here = DOCS_LANGUAGES.get(config.language, DOCS_LANGUAGES["en"])[1]
    up = "../" * here.count("/")  # from this build's root to the site root
    config.html_baseurl = DOCS_URL + here
    # link previews: the tool's card from the website, in this build's language
    lang = config.language if config.language in DOCS_LANGUAGES else "en"
    config.ogp_site_url = DOCS_URL + here
    config.ogp_image = f"https://danwos.dev/og/{lang}/tools/deciwa.png"
    config.ogp_custom_meta_tags = [*OGP_TAGS, f'<meta property="og:locale" content="{"de_DE" if lang == "de" else "en_US"}">']
    config.html_context["docs_languages"] = [
        {"code": code, "name": name, "rel": up + folder, "url": DOCS_URL + folder, "current": code == config.language}
        for code, (name, folder) in DOCS_LANGUAGES.items()
    ]


def _gettext(app):
    """Sphinx-Needs writes needs.json with its own builder at the end of every
    build; on the gettext environment that builder fails. The catalogs need
    neither needs.json nor the rendered needflow diagrams."""
    if app.builder.name == "gettext":
        app.config.needs_build_json = False
        app.config.suppress_warnings = [*app.config.suppress_warnings, "needs.needflow"]


def setup(app):
    app.connect("config-inited", _languages)
    app.connect("builder-inited", _gettext)

# -- Theme -------------------------------------------------------------------

html_theme = "furo"
html_title = "deciwa"
html_logo = "_static/img/deciwa.webp"
html_favicon = "_static/img/logo.svg"
html_static_path = ["_static"]
templates_path = ["_templates"]
html_css_files = ["danwos.css"]
html_show_sourcelink = False
html_context = {}
html_sidebars = {"**": ["sidebar/brand.html", "sidebar/search.html", "sidebar/languages.html",
                        "sidebar/scroll-start.html", "sidebar/navigation.html", "sidebar/scroll-end.html"]}
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
