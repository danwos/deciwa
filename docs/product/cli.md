# CLI and agent skills

## CLI – the master

The CLI is the master, with an openly documented file format
({need}`DEC_CLI_MASTER`). Every integration talks to the CLI (library /
local server), never to the files directly. Every command has `--json`.

| Command | Does |
|---|---|
| `deciwa elements <file>` | elements an adapter finds, with selectors – the base for every hover UI |
| `deciwa annotate …` | add feedback or a rating |
| `deciwa request … --to … --question …` | ask someone about an element |
| `deciwa status [path]` | counts per state |
| `deciwa todo` | open jobs for the AI or developer |
| `deciwa resolve <id>` | mark a job as done |
| `deciwa diff <id>` | approved vs. current wording |
| `deciwa serve` | local JSON API for the integrations |
| `deciwa push / pull` | sync with the hosted service |

Proposed details for 0.1: [CLI concept](../concept/cli.md).

## Agent skills

Agents pick up feedback and ask questions without extra prompting
({need}`DEC_SKILLS`).

- **`deciwa-work`** – fetch `deciwa todo`, apply rephrase / more details /
  delete and comments, never touch frozen elements, `deciwa resolve`,
  request a re-review.
- **`deciwa-ask`** – instead of a `[CHECK]` marker in the text, ask a
  question on the element.
