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
| html | `html:heading:Services/Consulting` · `html:paragraph:Services/Consulting#2` | a rendered web page, found in the browser ({doc}`web`) |
| py | `py:class:Engine` · `py:function:Engine.start` · `py:function:main` | a class, method or function, named by its path in the code ({need}`DEC_PYTHON_ADAPTER`) |
| py | `py:statement:imports` · `py:statement:API` · `py:statement:#2` | statements outside functions: the import block, an assignment by name, any other statement counted per scope |

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

Built first, for host apps ({need}`DEC_HOST_ELEMENTS`):
`deciwa.core.adapters.markdown` returns the elements as dicts in the shape of
the Sphinx elements index (`selector`, `kind`, `label`, `line`, `end`, `text`,
`fingerprint`, `parent`) – sections, paragraphs, list items, table rows, code
blocks and pictures. Frontmatter fields and character offsets are still
missing. The text of an element is what a reader sees (inline markup
removed), as in the Sphinx and browser adapters, so a quote selected in a
rendered view is found in it; a changed link target alone does not make an
element stale. Lines are 1-based and count the frontmatter. The engine uses
the adapter for every file that no build index knows.

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

## Python

{need}`DEC_PYTHON_ADAPTER` – `deciwa.core.adapters.python` reads `.py` and
`.pyi` files with the standard library `ast`:

- Elements: classes, functions and methods, nested as in the code (a method's
  parent is its class, a nested function's parent the function around it);
  definitions inside `if`, `try` or `with` blocks count at their level.
- Statements outside functions – at module level and in a class body – are
  elements of the kind `statement`: the docstring (`py:statement:__doc__`), a
  block of imports (`py:statement:imports`), an assignment by its name
  (`py:statement:API`, `py:statement:Engine.size`), any other statement
  counted per scope (`py:statement:#1` – e.g. `if __name__ == "__main__":`;
  `py:statement:Engine#2`). Statements inside a function belong to the
  function.
- Selectors: `py:<class|function>:<path>` – `py:function:Engine.start`; a second
  definition with the same path (a property setter, a redefinition) gets `~2`.
- Text: the source of the definition, decorators included – any change to an
  approved function makes it stale. Label: its first line
  (`def start(self) -> Handshake:`).
- Lines: `line` is the first line (the first decorator), `end` the last one.
- A file with a syntax error has no elements.
- The element kinds `class`, `function` and `statement` can be named in the
  review rules.

Not yet: comments as elements; JS, TS and C (tree-sitter, next).

## HTML files

{need}`DEC_HTML_ADAPTER` – `deciwa.core.adapters.html` reads `.html` and
`.htm` files with the standard library `html.parser` and follows the rules of
the browser's DOM scan ({need}`PROP_DOM_ADAPTER`): the review root (`main`, a
single `article`, else `body`), sections by the heading outline, paragraphs,
list items, table rows, code blocks, notes and pictures, counted per section –
the same `html:` selectors. Each element carries its start line, its end line
and its `tag`. Without a browser there is no layout, so elements hidden by CSS
and small icons count as well.

A host marks every start tag of the rendered page with its source line;
the overlay matches each element to the tag of its kind on its line. The
rendered page and the source view therefore share their elements, and
feedback on the page points at the source line. A web page kept under its
address (from a browser) gives way to the adapter once its source file is
known.

In a host the lines of each element are grouped into one block of the code
view ([Host apps](hosts.md)).

## Plain text

Paragraphs are blocks separated by blank lines; lines are a second level.
Everything else is free text selection.

## HTML in the browser

```{prop} The web script finds the elements of a rendered page itself
:id: PROP_DOM_ADAPTER
:status: draft
:refines: PROP_ADAPTER_API, PROP_SELECTORS, PROP_PYTHON_CORE

A small adapter in JavaScript reads the DOM of the review root and returns
the same element list as the other adapters:

- sections from the heading outline `h1`–`h6` (web pages rarely nest real
  `<section>` elements), named by their heading path,
- paragraphs, list items, table rows (`tr` outside `thead`), code blocks
  (`pre`), notes (`aside`, `[role=note]`), pictures (`img`, `svg`,
  `figure`, `picture`) – counted per section as in Markdown,
- left out: `nav`, `header`, `footer`, `form`, `[hidden]`, `[aria-hidden=true]`,
  `script`, `style` and everything matching `data-ignore`.

The fingerprint is SHA-256 over the normalised text, computed with
`crypto.subtle` – the same value as `model.fingerprint` in Python, so the CLI
and the browser agree on stale elements. The offline overlay switches from
its local FNV hash to this one. Pictures are fingerprinted by `src`, `alt`
and caption.

Pages with build hints (`#deciwa-page`, as the Sphinx extension writes it)
skip the scan and use the hints.
```

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
