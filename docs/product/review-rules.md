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

## Facts

A knowledge base keeps its verified facts in facts files – by default every
Markdown file in a `20_facts/` folder, without the folder indexes
(`_index.md`). In them every list item, table row and free paragraph is one
fact ({need}`DEC_FACT_BLOCKS`), and each one counts in a group:

| Group | The fact … |
|---|---|
| approved | is approved (or frozen) and unchanged since |
| open | has no verdict yet, or a job for the AI |
| stale | changed since it was approved |
| question | has an open question |
| unverified | holds an `[ASSUMPTION]` marker – an approval confirms the mark, not the fact |

A facts file can also be approved **as a whole**; that approval gets stale on
any change in the file, the facts inside keep their own state. `deciwa facts`
counts the groups per folder and file, `deciwa approve-facts` approves every
fact that is not approved yet. In monsterbrain the facts view shows them file
by file ([monsterbrain](../integrations/monsterbrain.md)).

Which files and kinds count is set in `.deciwa/config.toml`:

```toml
[facts]
paths = ["20_facts/*.md", "*/20_facts/*.md"]   # * also matches /
exclude = ["*/_index.md", "_index.md"]
kinds = ["item", "row", "paragraph"]
```

```{figure} ../_static/screens/required.webp
:alt: Dashed lines beside required needs without a verdict

Required needs without a verdict carry a grey dashed line.
```

