# CLI and agent skills

## CLI – the master

The CLI is the master, with an openly documented file format
({need}`DEC_CLI_MASTER`). Every integration talks to the CLI (library /
local server), never to the files directly. Every command has `--json`.

| Command | Does |
|---|---|
| `deciwa init [--at <folder>]` | create `.deciwa/` |
| `deciwa serve` | build the docs, serve them with the review overlay, rebuild on change |
| `deciwa elements <file>` | the elements of a source, with their selectors |
| `deciwa show <file>` | all feedback of a source with the element states |
| `deciwa status` | states and coverage of the whole project |
| `deciwa todo [path …]` | open jobs for the AI or developer, and open questions – with paths only those of these files or folders |
| `deciwa annotate <file> <element> --verdict … [--comment …]` | give feedback |
| `deciwa rate <file> <element> <0-5>` | give stars |
| `deciwa request <file> <element> --to … --question …` | ask someone about an element |
| `deciwa answer <id> [--verdict …] [--text …]` | answer a question |
| `deciwa resolve <id> [--note …]` | mark a job as done |
| `deciwa export [file]` | all review data as one file |
| `deciwa import <file> [--force]` | replace the review data with a file – refused if it is older; an export of a website replaces only its own pages |
| `deciwa remap` | move feedback on web pages kept under their address to the files of new `[web]` rules |
| `deciwa diff <id>` | approved vs. current wording (0.1) |
| `deciwa push / pull` | sync with the hosted service (0.5) |

Proposed details for 0.1: [CLI concept](../technical/cli.md).

## Agent skills

- **`deciwa-work`** – fetch `deciwa todo`, apply comments, fix rejected
  statements and delete elements, never touch frozen elements, `deciwa resolve`,
  request a re-review.
- **`deciwa-ask`** – instead of a `[CHECK]` marker in the text, ask a
  question on the element.

How to use them with Claude: [Claude](../integrations/claude.md).
