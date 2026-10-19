# deciwa

**decision watcher** – point at an element of a doc, website or source file
and say what you think of it. deciwa keeps that tied to exactly that element,
notices when the element changes and shows at any time what is confirmed,
open or frozen. It collects, evaluates and shows; the work itself is done by
the AI or the developer.

```{raw} html
<figure class="diagram">
<svg viewBox="0 0 760 330" role="img" aria-labelledby="arch-t">
  <defs><marker id="dw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrowhead"/></marker></defs>
  <title id="arch-t">deciwa architecture: integrations and agent skills use the CLI, the CLI stores in .deciwa or the hosted service</title>
  <g class="box">
    <rect x="20" y="20" width="130" height="50" rx="10"/><text x="85" y="50">VS Code</text>
    <rect x="165" y="20" width="130" height="50" rx="10"/><text x="230" y="50">Chrome</text>
    <rect x="310" y="20" width="130" height="50" rx="10"/><text x="375" y="50">Claude UI</text>
    <rect x="455" y="20" width="130" height="50" rx="10"/><text x="520" y="50">Desktop app</text>
  </g>
  <g class="box alt">
    <rect x="610" y="20" width="130" height="50" rx="10"/><text x="675" y="42">agent skills</text><text x="675" y="60" class="small">work · ask</text>
  </g>
  <text x="302" y="92" class="label">integrations</text>
  <g class="arrow">
    <path d="M85 70 V120"/><path d="M230 70 V120"/><path d="M375 70 V120"/><path d="M520 70 V120"/><path d="M675 70 V120"/>
  </g>
  <g class="box main">
    <rect x="20" y="125" width="720" height="80" rx="14"/>
    <text x="380" y="157" class="strong">deciwa CLI / core library – the master</text>
    <text x="380" y="183" class="small">format adapters · selectors and fingerprints · state engine · JSON API (--json, serve)</text>
  </g>
  <g class="arrow"><path d="M200 205 V250"/><path d="M560 205 V250"/></g>
  <g class="box">
    <rect x="40" y="255" width="320" height="60" rx="10"/>
    <text x="200" y="280">.deciwa/ in the repository</text>
    <text x="200" y="300" class="small">open format · Git is the history · default</text>
  </g>
  <g class="box warm">
    <rect x="400" y="255" width="320" height="60" rx="10"/>
    <text x="560" y="280">hosted service (paid)</text>
    <text x="560" y="300" class="small">sync · task lists · evaluations · audit</text>
  </g>
</svg>
<figcaption>Every front end talks to the CLI, never to the files directly.</figcaption>
</figure>
```

## How these docs work

These docs are the single source of truth for everyone who develops deciwa.
Decisions are requirements: every feature and every piece of code must fit
them. Each statement is a Sphinx-Needs object with an id and a status.

| Object | Prefix | Status | Meaning |
|---|---|---|---|
| Decision | `DEC_` | `approved` | decided by Daniel – binding |
| Proposal | `PROP_` | `draft` → `review` → `approved` / `rejected` | part of the technical details of a version, not binding yet |
| Question | `Q_` | `open` → `answered` | someone has to decide something |

An approved proposal becomes a decision: it gets a `DEC_` object in
[Decisions](decisions/index.md), and the technical page links to it.

## Waiting for a decision

```{needtable}
:filter: type == "question" and status == "open"
:columns: id, title, to, docname as "page"
:style: table
```

```{toctree}
:caption: Product
:maxdepth: 2
:hidden:

product/index
product/ways-of-working
product/elements
product/review-rules
product/ui
product/cli
product/data
product/roadmap
```

```{toctree}
:caption: Integrations
:maxdepth: 2
:hidden:

integrations/index
integrations/sphinx/index
integrations/vscode
integrations/chrome
integrations/claude
integrations/desktop
```

```{toctree}
:caption: Decisions
:hidden:

decisions/index
```

```{toctree}
:caption: Technical details
:maxdepth: 2
:hidden:

technical/index
technical/stack
technical/layers
technical/adapters
technical/file-format
technical/state-engine
technical/cli
technical/skills
technical/rollout
technical/questions
technical/working
```

