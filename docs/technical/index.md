# Technical overview

:::{admonition} Status: draft
:class: status-draft
How the next version (0.1) is built – updated for every version. Proposals by Claude,
2026-10-19; nothing on these pages is binding until Daniel approves it. Questions that block work are collected in
[Open questions](questions.md).
:::

## Goal

Build release 0.1 ({doc}`../product/roadmap`): the CLI with the open file
format, the adapters Markdown, rST/Sphinx-Needs and plain text, and the
agent skills `deciwa-work` and `deciwa-ask` – good enough that Daniel uses
deciwa in his knowledge base instead of `[CHECK]` markers.

**Not in 0.1:** `push` / `pull`, VS Code, Chrome, hosted
service, Python/HTML adapters. The design must not block them, though –
especially review on results ({need}`DEC_REVIEW_ON_RESULTS`).

## Architecture

Every front end – the integrations as well as the agent skills – talks to
the deciwa CLI and its core library, never to the files directly
({need}`DEC_CLI_MASTER`). The CLI stores reviews in `.deciwa/` inside the
repository or, later, in the hosted service.

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


## Repository

```text
deciwa/
├── packages/            one package per part – see below
│   ├── core/            deciwa-core     model, .deciwa/ store, engine
│   ├── server/          deciwa-server   review server
│   ├── cli/             deciwa-cli      the deciwa command
│   ├── ui/              deciwa-ui       review overlay (JS/CSS)
│   └── sphinx/          deciwa-sphinx   Sphinx extension
├── docs/                these docs – product, integrations, decisions,
│                        technical details
├── .deciwa/             review data of these docs (config.toml: what must be approved)
├── mockups/             first clickable mock-up of the feedback UI, demo recorder
├── pyproject.toml       the uv workspace (all packages + docs tools)
└── uv.lock
```

## Packages

The split into packages is {need}`DEC_PACKAGES`.

deciwa is one repository with one package per part – a uv workspace. All
packages share the Python namespace `deciwa`.

```{raw} html
<figure class="diagram">
<svg viewBox="0 0 760 340" role="img" aria-labelledby="pkg-t">
  <defs><marker id="dw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrowhead"/></marker></defs>
  <title id="pkg-t">Packages: cli depends on server and core; sphinx on core and ui; server on core. At run time the review UI calls the server's JSON API, and the server runs the Sphinx build.</title>
  <g class="box alt"><rect x="20" y="20" width="220" height="60" rx="10"/><text x="130" y="44">deciwa-cli</text><text x="130" y="64" class="small">the deciwa command</text></g>
  <g class="box alt"><rect x="270" y="20" width="220" height="60" rx="10"/><text x="380" y="44">deciwa-sphinx</text><text x="380" y="64" class="small">Sphinx extension</text></g>
  <g class="box alt"><rect x="520" y="20" width="220" height="60" rx="10"/><text x="630" y="44">later: VS Code, Chrome …</text><text x="630" y="64" class="small">own repos or integrations/</text></g>
  <g class="box"><rect x="20" y="140" width="220" height="60" rx="10"/><text x="130" y="164">deciwa-server</text><text x="130" y="184" class="small">site + JSON API + rebuild</text></g>
  <g class="box"><rect x="520" y="140" width="220" height="60" rx="10"/><text x="630" y="164">deciwa-ui</text><text x="630" y="184" class="small">review overlay JS / CSS</text></g>
  <g class="box main"><rect x="20" y="245" width="720" height="56" rx="12"/><text x="380" y="267" class="strong">deciwa-core</text><text x="380" y="287" class="small">model · store · engine – all the logic</text></g>
  <g class="arrow">
    <path d="M130 80 V135"/><path d="M60 80 V240"/><path d="M130 200 V240"/>
    <path d="M380 80 V240"/><path d="M430 80 L590 135"/>
    <path d="M630 80 V135"/><path d="M540 80 L240 145"/><path d="M710 80 V240"/>
  </g>
  <g class="arrow run">
    <path d="M520 178 H245"/>
    <path d="M200 140 C230 110 255 90 265 62"/>
  </g>
  <text x="382" y="170" class="label">HTTP · JSON API</text>
  <text x="210" y="112" class="label">runs the build</text>
  <g class="legend-key">
    <path d="M30 325 H70" class="dep"/><text x="78" y="325" class="small" style="text-anchor:start">package dependency</text>
    <path d="M250 325 H290" class="runl"/><text x="298" y="325" class="small" style="text-anchor:start">at run time (with deciwa serve)</text>
  </g>
</svg>
<figcaption>Solid: what a package imports. Dashed: how the parts talk to each other while reviewing with a server.</figcaption>
</figure>
```

| Folder | Distribution | Import | Contains | Depends on |
|---|---|---|---|---|
| `packages/core` | `deciwa-core` | `deciwa.core` | model, `.deciwa/` store, engine – states, review rules, project overview, export/import | – |
| `packages/server` | `deciwa-server` | `deciwa.server` | local review server: serves a built site, the JSON API for the review UI, rebuilds and reloads on change; knows no build tool – the caller passes the build command | core |
| `packages/cli` | `deciwa-cli` | `deciwa.cli` | the `deciwa` command; `deciwa serve` passes the Sphinx build to the server | core, server |
| `packages/ui` | `deciwa-ui` | `deciwa.ui` | the review overlay (JavaScript, CSS, logo) in the danwos tool UI kit, including the offline engine and the web script; sources in `js/`, built with `npm run build` into `static/`; no Python logic | – |
| `packages/sphinx` | `deciwa-sphinx` | `deciwa.sphinx` | Sphinx extension: finds the elements of every page, writes the elements index, ships the review UI | core, ui |

`deciwa-sphinx` does not import `deciwa-server`: a static (offline) build
needs no server. With `deciwa serve`, the server runs the Sphinx build, and
the review UI in the pages talks to the server's JSON API.

Rules:

- Logic lives in `deciwa-core` only. The offline engine in `deciwa-ui` mirrors
  its rules for reviews without a server and must be kept in step.
- `deciwa-server` and `deciwa-cli` are reused by every integration that
  reviews in a browser or calls the CLI.
- An integration package depends on `deciwa-core` and, for a browser UI, on
  `deciwa-ui` – never on another integration.

### Setting up

```console
$ uv sync                          # all packages, editable, plus the docs tools
$ .venv/bin/deciwa serve           # the CLI from packages/cli
```

Using deciwa in another Sphinx project:

```console
$ cd ~/workspace/deciwa/packages
$ uv pip install --python <project>/.venv/bin/python -e core -e server -e cli -e ui -e sphinx
```

## Pages

| Page | Decides |
|---|---|
| [Stack](stack.md) | language, packaging, tooling |
| [Layers](layers.md) | modules of the core and how they depend on each other |
| [Adapters](adapters.md) | how a format turns into elements and selectors |
| [File format](file-format.md) | the JSON inside `.deciwa/` |
| [State engine](state-engine.md) | how the state of an element is computed |
| [CLI](cli.md) | commands, element addressing, JSON output |
| [Skills](skills.md) | what the two agent skills do and how they ship |
| [Rollout](rollout.md) | how 0.1 gets into Daniel's knowledge base |
| [Working on deciwa](working.md) | docs as the truth, reviewing them in deciwa, from proposal to decision |

## All proposals

```{needtable}
:types: prop
:columns: id, title, status, docname as "page"
:style: table
```

## How the proposals relate to the decisions

```{needflow}
:types: prop, dec
:filter: type == "prop" or id in ["DEC_CLI_MASTER", "DEC_NO_MARKERS", "DEC_DECIWA_FOLDER", "DEC_REVIEW_ON_RESULTS", "DEC_SKILLS", "DEC_FREEZE", "DEC_FORMATS", "DEC_THREE_MODES", "DEC_GIT_COMMITTED"]
:config: danwos
```
