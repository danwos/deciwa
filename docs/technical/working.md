# Working on deciwa

How the docs work and how a proposal becomes a decision. The repository and
its packages: [Technical overview](index.md).

## The docs are the truth

These docs are the single source of truth for everyone who develops deciwa.
Decisions are requirements: every feature and every piece of code must fit
them. Each statement is a Sphinx-Needs object with an id and a status.

| Object | Prefix | Status | Meaning |
|---|---|---|---|
| Decision | `DEC_` | `approved` | decided by Daniel – binding |
| Proposal | `PROP_` | `draft` → `review` → `approved` / `rejected` | part of the technical details of a version, not binding yet |
| Question | `Q_` | `open` → `answered` | someone has to decide something – see [Open questions](questions.md) |

An approved proposal becomes a decision: it gets a `DEC_` object in
[Decisions](../decisions/index.md), and the technical page links to it.

Product description, integrations, decisions and technical details live in
`docs/` as Markdown
(MyST). The HTML pages are generated; nobody edits them.

```console
$ uv sync                                                         # packages + docs tools
$ .venv/bin/sphinx-autobuild docs docs/_build/html --port 4336   # live preview
$ .venv/bin/sphinx-build -W -b html docs docs/_build/html         # CI build, warnings fail
```

## Published docs

`.github/workflows/docs.yml` checks the docs (warnings fail) on every push
and pull request. From `main` it publishes them to the `gh-pages` branch of
the public repository `danwos/deciwa.docs`, whose GitHub Pages serve them at
<https://deciwa.danwos.dev> –
the code here stays private. The published build is an offline review build
without the review data of `.deciwa/`, so visitors can try deciwa on these
pages in their own browser.

## Translations

The docs are published in English and German; more languages can follow
the same way.

```{prop} English is the source of the docs; German is a translation in gettext catalogs
:id: PROP_DOCS_TRANSLATION
:status: draft
:refines: DEC_DOCS_IN_REPO

Everybody writes and changes the English Markdown. The translations live in
`docs/locales/<language>/LC_MESSAGES/*.po`, one catalog per page plus
`needs.po` for the titles and fields of needs. When an English paragraph
changes, its translation becomes `fuzzy` and the old one stays visible
until somebody updates it. English is published at the root, German in
`de/`; a switcher in the sidebar leads to the same page in the other
language.
```

```{prop} Reviews and decisions happen only on the English docs
:id: PROP_DOCS_REVIEW_SOURCE
:status: draft
:refines: PROP_DOCS_TRANSLATION

A translation is checked like any wording, but the binding statement is
the English one: `.deciwa/` only holds reviews of the English pages. The
German pages carry the overlay only as the offline demo for visitors.
```

```{question} Should the overlay speak German on German pages?
:id: Q_OVERLAY_LANGUAGE
:status: open
:to: Daniel
:refines: PROP_DOCS_TRANSLATION

Today every label of the overlay is English. It could take its language
from `<html lang>` and ship a small dictionary per language.
```

Update the catalogs after changing the English docs:

```console
$ .venv/bin/sphinx-build -E -b gettext -D needs_build_json=0 docs docs/_build/gettext
$ .venv/bin/sphinx-intl update -p docs/_build/gettext -d docs/locales -l de
$ .venv/bin/sphinx-intl stat -d docs/locales -l de                  # what is left to translate
$ .venv/bin/sphinx-build -W -b html -D language=de docs docs/_build/html/de
```

## Reviewing these docs in deciwa

These docs use the [Sphinx integration](../integrations/sphinx/index.md)
themselves: `uv sync`, then `.venv/bin/deciwa serve`
and open `http://127.0.0.1:4337`. What must be approved is set in
`.deciwa/config.toml` (today: every need). The full loop – review, work
with `deciwa todo` / `deciwa resolve`, rebuild – is described in the
[workflow](../integrations/sphinx/workflow.md).

Approving a `prop` or answering a `question` in deciwa is the decision; the
proposal is then turned into a `dec` as described below.

## From proposal to decision

1. The technical details of the next version live in `technical/` (today
   for 0.1). Every statement that needs a decision is a `prop` with status
   `draft`.
2. Every open point is a `question` with `to:` naming who decides.
3. When a page is ready for review, its proposals go to `review`.
4. Daniel decides: a proposal becomes `approved` or `rejected`, a question
   becomes `answered`.
5. Every approved proposal gets a `dec` in `decisions/index.md` with
   `decided`, `reason` and `alternatives`; the product pages are updated to
   match. The technical page can then be shortened to what is still open.

## Objects

````md
```{dec} Short statement of the decision
:id: DEC_SOMETHING
:status: approved
:decided: 2026-10-19
:reason: Why.
:alternatives: What else was considered.
```
````

| Type | Prefix | Fields |
|---|---|---|
| `dec` | `DEC_` | `decided`, `reason`, `alternatives` |
| `prop` | `PROP_` | `refines` – the decisions it details |
| `question` | `Q_` | `to`, `answers` / `refines` |

Reference an object in text with `` {need}`DEC_SOMETHING` ``.

## Code

The code is split into packages – {ref}`packages <packages>`. Logic
belongs into `deciwa-core`; front ends only use `deciwa.core.Project`.

Code follows the decisions. If code and a decision disagree, the decision
wins – or a new proposal changes the decision first.
