# Technical details – 0.1

:::{admonition} Status: draft
:class: status-draft
How 0.1 is built – updated for every version. Proposals by Claude,
2026-10-19; nothing on these pages is binding until Daniel approves it. Questions that block work are collected in
[Open questions](questions.md).
:::

## Goal

Build release 0.1 ({doc}`../product/roadmap`): the CLI with the open file
format, the adapters Markdown, rST/Sphinx-Needs and plain text, and the
agent skills `deciwa-work` and `deciwa-ask` – good enough that Daniel uses
deciwa in his knowledge base instead of `[CHECK]` markers.

**Not in 0.1:** `deciwa serve`, `push` / `pull`, VS Code, Chrome, hosted
service, Python/HTML adapters. The design must not block them, though –
especially review on results ({need}`DEC_REVIEW_ON_RESULTS`).

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
