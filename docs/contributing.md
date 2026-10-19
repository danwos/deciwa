# Working on deciwa

## The docs are the truth

Product description, integrations, decisions and technical details live in
`docs/` as Markdown
(MyST). The HTML pages are generated; nobody edits them.

```console
$ uv venv && uv pip install -r docs/requirements.txt
$ .venv/bin/sphinx-autobuild docs docs/_build/html --port 4336   # live preview
$ .venv/bin/sphinx-build -W -b html docs docs/_build/html         # CI build, warnings fail
```

## Reviewing these docs in deciwa

These docs use the [Sphinx integration](integrations/sphinx/index.md)
themselves: `uv pip install -e prototype`, then `.venv/bin/deciwa serve`
and open `http://127.0.0.1:4337`. What must be approved is set in
`.deciwa/config.toml` (today: every need). The full loop – review, work
with `deciwa todo` / `deciwa resolve`, rebuild – is described in the
[workflow](integrations/sphinx/workflow.md).

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

Code follows the decisions. If code and a decision disagree, the decision
wins – or a new proposal changes the decision first.
