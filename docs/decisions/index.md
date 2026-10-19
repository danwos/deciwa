# Decisions

Product and technical decisions on deciwa. All decided by Daniel; they are
binding requirements for every feature and every piece of code. Business
decisions (pricing, licence, market) are kept outside this repository.

A new decision comes from an approved proposal of a concept – see
[Working on deciwa](../contributing.md).

```{needtable}
:types: dec
:columns: id, title, decided
:sort: decided
:style: table
```

## Purpose and scope

```{dec} deciwa is a review and decision tool for everyone who works with docs and code
:id: DEC_PURPOSE
:status: approved
:decided: 2026-10-17
:reason: Daniel needs a simple way to review content and agree to statements (trigger: his own work in his knowledge base).
:alternatives: a decision log only; a tool for one group (developers, AI agents or management).
```

```{dec} deciwa collects, evaluates and shows; it does not watch that decisions are kept
:id: DEC_NO_ENFORCING
:status: approved
:decided: 2026-10-17
:reason: Enforcing decisions is not possible; doing the work is the job of the AI or the developer.
:alternatives: a "watcher" that checks the implementation (dropped).
```

```{dec} Three ways of working that stay separate: feedback, quality rating, AI communication
:id: DEC_THREE_MODES
:status: approved
:decided: 2026-10-18
:reason: Stars are a quick judgement independent of any verdict, to focus on weak areas later; AI questions are answered at the element by verdict or text.
:alternatives: stars as part of a verdict.
```

## Feedback and decisions

```{dec} Feedback verdicts plus quick actions for the AI
:id: DEC_VERDICTS
:status: approved
:decided: 2026-10-17
:reason: Approve, reject, note and the quick actions rephrase, more details and delete give the AI a complete instruction with one click.
:alternatives: free comments only.
```

```{dec} New verdict freeze
:id: DEC_FREEZE
:status: approved
:decided: 2026-10-17
:reason: Some wording must survive every edit; the AI must never change it, and deciwa raises an alarm if it changes anyway.
:alternatives: –
```

```{dec} A decision is an approved statement, not an extra object
:id: DEC_DECISION_IS_APPROVAL
:status: approved
:decided: 2026-10-17
:reason: Decisions can then be mapped onto anything that is an element.
:alternatives: separate decision records in the source.
```

## Elements and formats

```{dec} No markers in the source; elements come from the content
:id: DEC_NO_MARKERS
:status: approved
:decided: 2026-10-17
:reason: The source stays clean and every element stays documented (a Sphinx-Needs requirement, a heading, a Python function, an HTML container, a selected word).
:alternatives: [CHECK]-style markers or ids in the text.
```

```{dec} Formats: text, HTML, Python, C, JS, TS, rST, Markdown, AsciiDoc
:id: DEC_FORMATS
:status: approved
:decided: 2026-10-17
:reason: Docs-as-code plus the results and code around it.
:alternatives: Markdown only.
```

```{dec} Format objects are highlighted on hover and directly selectable; free text selection down to single words
:id: DEC_HOVER_SELECT
:status: approved
:decided: 2026-10-17
:reason: Pointing must be as fast as looking.
:alternatives: line-based selection like a code review.
```

```{dec} Reviews happen on results, not only on source
:id: DEC_REVIEW_ON_RESULTS
:status: approved
:decided: 2026-10-17
:reason: Rendered docs and websites are what reviewers see; deciwa must not look like a pull-request code review. The source view shows the same element.
:alternatives: source-only review.
```

## Architecture and data

```{dec} The CLI is the master, with an openly documented file format
:id: DEC_CLI_MASTER
:status: approved
:decided: 2026-10-17
:reason: One logic for all front ends; agents and integrations use the same commands and JSON.
:alternatives: a web app as the core.
```

```{dec} All deciwa files in one .deciwa/ folder at the repository root or in a parent folder
:id: DEC_DECIWA_FOLDER
:status: approved
:decided: 2026-10-17
:reason: The files must not get in the user's way; a parent folder covers several repositories or repositories that must stay untouched.
:alternatives: sidecar files next to each source.
```

```{dec} .deciwa/ is committed to Git by default
:id: DEC_GIT_COMMITTED
:status: approved
:decided: 2026-10-17
:reason: Reviews are versioned together with the content.
:alternatives: git-ignored until a team decides.
```

```{dec} One or two agent skills for working with deciwa
:id: DEC_SKILLS
:status: approved
:decided: 2026-10-17
:reason: Agents should pick up feedback and ask questions without extra prompting (deciwa-work, deciwa-ask).
:alternatives: –
```

## UI and integrations

```{dec} Integrations: VS Code, Chrome, Claude UI, desktop app
:id: DEC_INTEGRATIONS
:status: approved
:decided: 2026-10-17
:reason: Reviews happen where people already work – editor, browser, chat; the desktop app covers people without an IDE.
:alternatives: –
```

```{dec} Feedback card at the element is the default UI; side panel is the alternative; radial menu dropped
:id: DEC_FEEDBACK_CARD
:status: approved
:decided: 2026-10-17
:reason: Compared in the clickable prototype.
:alternatives: radial menu at the cursor.
```

```{dec} deciwa uses the danwos colours and tokens
:id: DEC_DANWOS_TOKENS
:status: approved
:decided: 2026-10-17
:reason: Recognition across all danwos tools; the deciwa monster colours are only for pictures.
:alternatives: an own deciwa colour scheme.
```

## Working on deciwa

```{dec} Decisions, features and concepts live in the repository as Sphinx docs with Sphinx-Needs
:id: DEC_DOCS_IN_REPO
:status: approved
:decided: 2026-10-19
:reason: Others develop in the repository too, and decisions act as requirements; Sphinx-Needs gives every decision an id, a status and links, and deciwa can later review its own docs.
:alternatives: decisions in Daniel's knowledge base only; MkDocs Material (plain text without ids or traceability).
```
