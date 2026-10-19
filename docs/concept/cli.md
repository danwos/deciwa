# CLI

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude – not binding until Daniel approves them.
:::

```{prop} Commands in 0.1
:id: PROP_CLI_COMMANDS
:status: draft
:refines: DEC_CLI_MASTER
```

| Command | Does |
|---|---|
| `deciwa init [--at <folder>]` | create `.deciwa/` |
| `deciwa elements <file>` | list elements with selector, kind, line and label |
| `deciwa annotate <file> <element> --verdict <v> [--comment …]` | feedback |
| `deciwa rate <file> <element> <1-5>` | quality rating |
| `deciwa request <file> <element> --to <who> --question …` | ask someone |
| `deciwa answer <id> [--verdict approve\|reject] [--text …]` | answer a request |
| `deciwa show <file>` | every annotation of a file with its element state |
| `deciwa status [path]` | counts per state, coverage |
| `deciwa todo [--for <who>]` | open quick actions and requests |
| `deciwa resolve <id> [--note …]` | mark a job as done |
| `deciwa diff <id>` | snapshot vs. current text |
| `deciwa relink <id> [<element>]` | update the selectors of a moved or orphaned annotation |
| `deciwa unfreeze <id>` | lift a freeze – depends on {need}`Q_UNFREEZE` |

`serve`, `push` and `pull` follow in 0.2 and 0.4.

## Addressing an element

The element argument is a structural selector, as printed by
`deciwa elements`, or a text quote:

```console
$ deciwa elements 20_facts/company/founder.md
md:heading:Career                    3  heading    Career
md:heading:Career/Advisor            9  heading    Advisor
md:paragraph:Career/Advisor#1       11  paragraph  Daniel works as advisor since …

$ deciwa annotate 20_facts/company/founder.md md:paragraph:Career/Advisor#1 \
    --verdict rephrase --comment "too stiff"
k7q2m9xa

$ deciwa annotate 20_facts/company/founder.md --quote "since October 2026" \
    --verdict approve
```

```{prop} JSON output has one envelope for every command
:id: PROP_CLI_JSON
:status: draft
:refines: DEC_CLI_MASTER

`--json` prints `{"deciwa": "0.1", "command": "<name>", "ok": true,
"result": …}`; errors print `"ok": false` with an `error` object
(`code`, `message`). Exit codes: `0` ok, `1` error, `2` usage error. Human
output may change between versions; the JSON envelope may not.
```

```{prop} deciwa status can fail a CI run on freeze alarms
:id: PROP_CLI_CHECK
:status: draft
:refines: DEC_NO_ENFORCING, DEC_FREEZE

`deciwa status --fail-on frozen-changed,orphaned` exits with `3` when such
elements exist. deciwa still only shows – the team decides whether CI stops.
Optional for 0.1.
```
