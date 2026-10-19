# Adapters

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude – not binding until Daniel approves them.
:::

An adapter knows which objects exist in its format. It turns the text of a
source file into a tree of elements, each with a structural selector, a text
range and the text used for the fingerprint.

```{prop} One small adapter interface for all formats
:id: PROP_ADAPTER_API
:status: draft
:refines: DEC_NO_MARKERS, DEC_HOVER_SELECT
```

```python
@dataclass(frozen=True)
class Element:
    selector: str            # "md:heading:Career/Advisor"
    kind: str                # "heading", "paragraph", "need", ...
    label: str               # short text for UIs and the CLI
    start: int               # character offsets in the source
    end: int
    line: int                # 1-based, for humans and editors
    text: str                # source text of the element (fingerprint input)
    children: tuple["Element", ...] = ()

class Adapter(Protocol):
    name: str                         # "md", "rst", "text"
    suffixes: tuple[str, ...]         # (".md",), (".rst",), (".txt",)
    def elements(self, source: str, path: str) -> list[Element]: ...
```

Adapters are pure: no file access, no state. That keeps them fast to test
with golden files (source in, element list as JSON out) and lets the Sphinx
extension reuse them later.

## Structural selectors

A selector is a string `<adapter>:<kind>:<path>`. It is what users see in the
CLI and what the file format stores.

| Adapter | Selector | Element |
|---|---|---|
| md | `md:heading:Career/Advisor` | the section under that heading path, including its content |
| md | `md:paragraph:Career/Advisor#2` | the 2nd paragraph inside that section |
| md | `md:item:Open#3` · `md:row:Formats#5` · `md:code:Setup#1` | list item, table row, code block – numbered per section |
| md | `md:front:summary` | a frontmatter field |
| rst | `rst:section:Install/Linux` · `rst:paragraph:Install/Linux#1` | as in Markdown |
| rst | `sphinx-needs:REQ_042` | a need, found by id – the most robust selector there is |
| rst | `sphinx-needs:REQ_042:status` | one option of a need |
| rst | `rst:directive:Install/Linux#note1` | the first `note` directive in that section |
| text | `text:paragraph#4` · `text:line#17` | plain text |

```{prop} Element selectors are paths of headings plus a per-section counter
:id: PROP_SELECTORS
:status: draft
:refines: PROP_ADAPTER_API

Heading paths survive moves of whole sections and edits in other sections.
The counter (`#2`) breaks when a paragraph is inserted above – that is why
every annotation also stores a text quote ({doc}`file-format`), which the
engine tries next. Duplicate heading names in one path get a suffix
(`Notes~2`).
```

## Markdown

- Parser: markdown-it-py (CommonMark + tables), token maps give line ranges;
  offsets come from the line ranges.
- Elements: heading sections, paragraphs, list items (nested), table rows,
  code blocks, frontmatter fields (YAML keys at the top level).

## rST and Sphinx-Needs

```{prop} The rST adapter parses with docutils, without running Sphinx
:id: PROP_RST_DOCUTILS
:status: draft
:refines: PROP_PYTHON_CORE

docutils keeps source lines on every node. Unknown directives and roles
(Sphinx, Sphinx-Needs, any extension) are registered as generic
placeholders, so a file parses without `conf.py` and without importing
extensions. Need directives are recognised by name; their `:id:` gives the
`sphinx-needs:` selector.
```

```{question} Which directive names count as needs?
:id: Q_NEED_TYPES
:status: open
:to: Daniel
:refines: PROP_RST_DOCUTILS

Proposal: read them from `needs.json` if the project builds one, otherwise
from `.deciwa/config.toml` (`needs.directives = ["req", "spec", ...]`), and
fall back to the Sphinx-Needs defaults (`req`, `spec`, `impl`, `test`,
`need`). OK, or should deciwa read `conf.py` / `ubproject.toml` directly?
```

## Plain text

Paragraphs are blocks separated by blank lines; lines are a second level.
Everything else is free text selection.

## Free text selection

```{prop} A free text selection is a text quote inside its nearest element
:id: PROP_FREE_TEXT
:status: draft
:refines: DEC_HOVER_SELECT

Selecting a word stores the structural selector of the element that contains
it plus a `TextQuoteSelector` (exact, prefix, suffix) and a
`TextPositionSelector` relative to that element. This works in every format,
and the fingerprint covers only the selected text.
```
