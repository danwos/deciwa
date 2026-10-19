# Agent skills

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude – not binding until Daniel approves them.
:::

```{prop} Two skills in the Agent Skills format, shipped in the repository
:id: PROP_SKILLS_FORMAT
:status: draft
:refines: DEC_SKILLS

`skills/deciwa-work/SKILL.md` and `skills/deciwa-ask/SKILL.md`, each a short
instruction plus the CLI calls it uses. The skills only call the CLI with
`--json` – never the files – and sign as `agent:<name>`.
```

## deciwa-work

1. `deciwa todo --json` – the work list.
2. Per job: read the element, apply rephrase / more details / delete or the
   comment.
3. Never edit an element in state `frozen`; if a job collides with a freeze,
   skip it and say so.
4. `deciwa resolve <id> --note "<what changed>"`.
5. `deciwa request … --to <author> --question "Changed – OK?"` for every
   element it touched, so the human sees the change.

## deciwa-ask

When the agent writes something it is not sure about – an inferred wording, a
number without a source – it writes the text as it thinks is right and puts
a request on that element instead of a `[CHECK]` marker:

```console
$ deciwa request 20_facts/company/founder.md --quote "since October 2026" \
    --to daniel --question "Is October 2026 the start date of the advisor role?"
```

```{question} How do the skills get into a project?
:id: Q_SKILL_INSTALL
:status: open
:to: Daniel
:refines: PROP_SKILLS_FORMAT

Options: (a) `deciwa skills install` copies them into `.claude/skills/` of the
current project; (b) a Claude Code plugin that bundles both skills; (c) both.
Proposal: (a) for 0.1, (b) once the CLI is published.
```

```{question} Which quick actions besides rephrase, delete and more details?
:id: Q_QUICK_ACTIONS
:status: open
:to: Daniel
:refines: DEC_VERDICTS

Candidates: shorten, split, add source, translate. A fixed set, or
configurable in `.deciwa/config.toml`?
```
