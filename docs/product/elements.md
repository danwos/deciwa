# Elements and formats

No markers in the source: elements come from the content
({need}`DEC_NO_MARKERS`). A Sphinx-Needs requirement, a heading, a Python
function, an HTML container or a selected word – all of them are elements as
they are.

## Review on results

The main review surface is the result: the built Sphinx page, rendered
Markdown, the live website ({need}`DEC_REVIEW_ON_RESULTS`). Every element of
the result maps back to its source element (same selector), so the source
view shows the same annotations. Source review stays for code. deciwa must
not look like a pull-request code review.

## Element identity

Each annotation stores several selectors plus a fingerprint; deciwa tries
them in order:

| Selector | Example | Robust against |
|---|---|---|
| Structural (format adapter) | `sphinx-needs:REQ_042`, `python:function:deciwa.core.load`, `md:heading:Career/Advisor`, `html:css:#main > section:nth-of-type(2)` | moves, edits elsewhere |
| Text quote | exact text plus some words before and after | reformatting, moves in the file |
| Position | line/column, offset | nothing – last fallback |

Fingerprint = hash of the normalised element text:

- equal → unchanged
- different → `stale` (or `frozen, but changed`) with a diff
- element missing → `orphaned`, offered for relinking

Text quote and position follow the
[W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/).

## Formats

Format objects are highlighted on hover and directly selectable; free text
selection works down to single words ({need}`DEC_HOVER_SELECT`). Supported
formats: {need}`DEC_FORMATS`.

| Format | Objects on hover | Priority |
|---|---|---|
| Markdown | section, paragraph, list item, table row, code block, frontmatter field | MVP |
| rST + Sphinx-Needs | need (by id), option, directive, section, paragraph | MVP |
| Plain text | paragraph, line | MVP |
| Python | module, class, function, method, docstring, statement | next |
| HTML | block containers, headings, paragraphs, images | next |
| AsciiDoc | section, block | later |
| C, JS, TS | function, class, struct (tree-sitter) | later |

Free text selection works in every format and falls back to the text quote
selector.
