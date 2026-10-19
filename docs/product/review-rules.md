# What must be approved

Not every element needs a decision. A rule says which ones must be approved;
everything else can still get feedback, it just does not count.

## Rules

Rules name element kinds, `all`, or patterns, and can be limited to some
pages:

| Rule | Must be approved |
|---|---|
| `need` | every Sphinx-Needs object |
| `heading`, `paragraph`, `item`, `row`, `code`, `note`, `figure` | every element of that kind |
| `all` | everything |
| `sphinx-needs:PROP_*` | every element whose selector matches the pattern |
| paths `docs/technical/*` | only on these pages |

Switch the kinds in the panel under **Must be approved**; patterns and paths
are set in the [configuration](../integrations/sphinx/configuration.md).

## What you see

- Elements that must be approved and have no feedback yet carry a grey
  dashed line beside them.
- The panel lists the ones without a verdict under **To review**, page by
  page or for the whole project.
- One bar shows two shares of the required elements: **Verdict** – how many
  got any verdict (approve, reject, approve & freeze, delete) – and
  **Quality** – how many got stars.
- The card of such an element says **must be approved**.
