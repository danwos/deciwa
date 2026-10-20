# Stack

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude – not binding until Daniel approves them.
:::

The core language is the one decision everything else depends on. It is
driven by the MVP formats ({need}`DEC_FORMATS`): Markdown, rST with
Sphinx-Needs, and plain text.

| | Python | TypeScript / Node | Rust |
|---|---|---|---|
| rST + Sphinx-Needs | **docutils / Sphinx – the only complete rST parser** | no complete rST parser | no complete rST parser |
| Markdown | markdown-it-py (same rules as markdown-it) | markdown-it | pulldown-cmark, comrak |
| Code formats later | tree-sitter bindings | tree-sitter bindings | tree-sitter (native) |
| Same language as VS Code / Chrome extensions | no – they call `deciwa serve` / `--json` | yes | no, but WASM possible |
| Sphinx extension for review on results | native | – | – |
| Install for users | `uv tool install deciwa`, `pipx` | `npm i -g` | single binary |
| Speed to 0.1 | fast | medium (rST gap) | slow |

```{prop} The core and the CLI are written in Python
:id: PROP_PYTHON_CORE
:status: draft
:refines: DEC_CLI_MASTER, DEC_FORMATS, DEC_REVIEW_ON_RESULTS

rST with Sphinx-Needs is an MVP format, and only docutils parses rST fully.
The same code then runs inside a Sphinx build to tag the rendered HTML with
selectors – the base for review on results. The TypeScript integrations of
0.3/0.4 talk to the CLI through `--json` and `deciwa serve`, as
{need}`DEC_CLI_MASTER` demands anyway. If the browser ever needs element
finding without a local CLI, a WASM or TypeScript port of single adapters
stays possible because the selectors are a documented format.
```

```{prop} Tooling: Python 3.12+, uv, ruff, pytest, click
:id: PROP_TOOLING
:status: draft
:refines: PROP_PYTHON_CORE

- **uv** for environments, locking and `uv tool install deciwa`.
- **ruff** for lint and format, **pytest** for tests, **mypy** strict for
  `src/deciwa/model` and `src/deciwa/engine`.
- **click** for the CLI – small, stable, no magic.
- **pydantic** is not used; the model is plain dataclasses plus a JSON
  Schema in `schema/` so other languages can validate the files too.
- Runtime dependencies for 0.1: `click`, `markdown-it-py`, `docutils`,
  `pyyaml` (frontmatter). Sphinx only as an optional extra
  (`deciwa[sphinx]`).
```

```{question} Python for the core and the CLI?
:id: Q_CORE_LANG
:status: open
:to: Daniel
:answers: PROP_PYTHON_CORE

Yes → PROP_PYTHON_CORE and PROP_TOOLING become decisions. No → which
language, and how should the rST/Sphinx-Needs adapter work?
```
