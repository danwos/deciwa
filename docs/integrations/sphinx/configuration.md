# Configuration

## `conf.py`

| Option | Default | Meaning |
|---|---|---|
| `deciwa_mode` | `"auto"` | `auto`: use `deciwa serve` when it answers, otherwise review offline · `offline`: never ask for a server (static sites, demos) · `server`: never go offline |
| `deciwa_offline_annotations` | `True` | ship the feedback from `.deciwa/` with the build, so offline readers see it; set `False` for public builds |
| `deciwa_root` | the folder that holds `.deciwa/` above `conf.py` | where `.deciwa/` lives, if it is not above the docs |

Options can also be given on the command line, e.g.
`sphinx-build -D deciwa_mode=offline …`.

## `.deciwa/config.toml`

```toml
author = "daniel"                  # name on your feedback (or DECIWA_AUTHOR)

[sphinx]
docs = "docs"                      # source folder for deciwa serve
build = "docs/_build/html"         # where deciwa serve builds to

[review]
required = ["need"]                # what must be approved
paths = []                         # only these sources, e.g. ["docs/technical/*"]
```

`required` takes element kinds (`need`, `heading`, `paragraph`, `item`,
`row`, `code`, `note`, `figure`), `all`, or selector patterns such as
`sphinx-needs:PROP_*` – see [what must be approved](../../product/review-rules.md).
The kinds can also be switched in the panel; patterns and paths are set
here.

## Elements the extension finds

| Kind | In the page |
|---|---|
| `need` | every Sphinx-Needs object, by its id |
| `heading` | a section, picked through its heading |
| `paragraph`, `item`, `row`, `code`, `note` | paragraphs, list items, table rows, code blocks, admonitions |
| `figure` | images, figures and inline HTML pictures such as SVG diagrams |

Generated content (tables of needs, the table of contents) is not
reviewable; review its source instead.
