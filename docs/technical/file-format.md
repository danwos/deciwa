# File format

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude – not binding until Daniel approves them.
:::

```text
.deciwa/
├── config.toml                          optional settings
└── annotations/
    ├── 20_facts/company/founder.md.json one file per annotated source
    └── _web/danwos.dev/services.json    web pages without a mapped source
```

```{prop} One annotation file per source, deterministic JSON
:id: PROP_FILE_LAYOUT
:status: draft
:refines: DEC_DECIWA_FOLDER, DEC_GIT_COMMITTED

The path under `annotations/` mirrors the source path relative to the folder
that holds `.deciwa/`. The CLI writes sorted keys, two-space indent, one
annotation after the other by creation time and a final newline – so Git
diffs stay small and merge conflicts stay rare.
```

```{prop} Annotation structure
:id: PROP_ANNOTATION
:status: draft
:refines: DEC_THREE_MODES, DEC_VERDICTS, DEC_FREEZE
```

```json
{
  "deciwa": "0.1",
  "source": "20_facts/company/founder.md",
  "annotations": [
    {
      "id": "k7q2m9xa",
      "kind": "feedback",
      "target": {
        "selectors": [
          {"type": "structural", "value": "md:paragraph:Career/Advisor#1"},
          {"type": "TextQuoteSelector", "exact": "advisor since October 2026",
           "prefix": "Daniel works as ", "suffix": "."},
          {"type": "TextPositionSelector", "start": 1204, "end": 1230}
        ],
        "fingerprint": "sha256:9c1e…",
        "snapshot": "Daniel works as advisor since October 2026."
      },
      "author": "daniel",
      "created": "2026-10-19T10:12:00Z",
      "verdict": "rephrase",
      "comment": "too stiff, say it like a person",
      "status": "open",
      "replies": []
    }
  ]
}
```

| Field | Values | Note |
|---|---|---|
| `kind` | `feedback` · `rating` · `request` | the three ways of working stay separate in the data |
| `verdict` | `approve` · `reject` · `freeze` · `delete` · `note` | only for `feedback`; `note` = a comment without verdict |
| `stars` | 0–5 | only for `rating` |
| `question`, `to` | text, list of authors | only for `request`; answers are `replies` with an optional `verdict` |
| `snapshot` | element text when the annotation was made | needed for `deciwa diff`, stale views and the freeze alarm |
| `status` | `open` · `resolved` | jobs start `open`: delete, reject, note (a comment for the AI) and requests; approvals, freezes and ratings start `resolved` |
| `author` | `daniel`, `agent:claude` | from `git config user.email` or `DECIWA_AUTHOR` |
| `id` | 8 characters, lowercase base32, random | short enough to type in the CLI |

```{prop} While an element is unchanged, an author's latest verdict and latest rating replace the earlier ones
:id: PROP_LATEST_WINS
:status: draft
:refines: PROP_ANNOTATION, DEC_THREE_MODES

A misclick or a second thought must not pile up entries. As long as the
element's fingerprint is the same, a new verdict of the same author replaces
the old verdict, and a new rating the old rating. Once the element changed,
earlier annotations stay as history (that is how `stale` works). Notes and
questions are never replaced; a comment that came with a replaced verdict is
kept as a note. That is also how a freeze ends: the author gives another verdict
({need}`DEC_FREEZE_BY_VERDICT`).
```

```{prop} The snapshot of the element text is stored with every annotation
:id: PROP_SNAPSHOT
:status: draft
:refines: PROP_ANNOTATION

Without it deciwa can tell *that* an approved or frozen text changed, but not
*what* it looked like – and the freeze alarm must show the old wording
({need}`DEC_FREEZE`). The cost is some duplicate text in `.deciwa/`.
```

```{prop} A JSON Schema is the documented contract
:id: PROP_SCHEMA
:status: draft
:refines: DEC_CLI_MASTER

`schema/deciwa-0.1.schema.json` is published with the CLI and in these docs.
The CLI validates every file it reads. A new major field means a new schema
version; the CLI reads older versions and writes the newest.
```

## config.toml

```toml
author = "daniel"                 # overrides git config

[adapters]
"**/*.md"  = "md"
"**/*.rst" = "rst"
"**/*.txt" = "text"

[needs]
directives = ["req", "spec", "dec", "prop", "question"]

[ignore]
paths = ["90_archive/**", "_build/**"]
```

## Web sources

```{prop} Web pages without a source file are stored under their address
:id: PROP_WEB_FILES
:status: draft
:refines: PROP_FILE_LAYOUT, PROP_WEB_SOURCE

A page reviewed with the web script whose source is the fallback
`web:<host><path>` is stored as `annotations/_web/<host>/<path>.json`; the
path `/` becomes `index`. `deciwa import` applies the rules of `[web]` first,
so mapped pages land in the file of their source. When a rule is added later,
`deciwa import --remap` moves the annotations of `_web/` to their source
files. Their structural selectors stay `html:…`; in the source file the
engine finds the element by the text quote and the snapshot.
```

```toml
[web]
site = "danwos.dev"                                   # optional, the host of the pages
sources = [                                           # optional, first match wins
  { url = "/",       file = "src/content/pages/index.md" },
  { url = "/blog/*", file = "src/content/blog/*.md" },
  { url = "/*",      file = "src/content/pages/*.md" },
]
```

Without `[web]` – or without `.deciwa/` at all, when only the browser is
used – every page keeps its address.
