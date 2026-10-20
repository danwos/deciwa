# Rollout in the knowledge base

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude – not binding until Daniel approves them.
:::

The first real user of 0.1 is Daniel's knowledge base (a Git repository of
Markdown files with `[CHECK]` and `[ASSUMPTION]` markers).

```{prop} .deciwa/ at the root of the knowledge base, committed
:id: PROP_ROLLOUT_LOCATION
:status: draft
:refines: DEC_DECIWA_FOLDER, DEC_GIT_COMMITTED

`deciwa init` in the root. Archive and source folders go into
`[ignore]`, because they are never reviewed.
```

```{prop} Existing [CHECK] markers are migrated once into requests
:id: PROP_ROLLOUT_MIGRATE
:status: draft
:refines: PROP_SKILLS_FORMAT, DEC_NO_MARKERS

A one-off script finds every `[CHECK]` line, creates a `request` on the
element that contains it (question and addressee from the marker text) and
removes the marker from the text. After that, agents use `deciwa-ask`
instead of writing markers.
```

```{question} Does deciwa replace [CHECK] and [ASSUMPTION], or only [CHECK]?
:id: Q_MARKERS
:status: open
:to: Daniel
:refines: PROP_ROLLOUT_MIGRATE

`[CHECK]` maps directly onto a request. `[ASSUMPTION]` says "this number has
no evidence" – it could become a request too, or stay as a marker because it
must also be visible to readers of a PDF or slide built from the text.
```

```{question} How does Daniel review in 0.1 without an editor integration?
:id: Q_REVIEW_UI_01
:status: open
:to: Daniel

VS Code comes in 0.3. In 0.1 reviewing happens through the CLI and through
Claude ("go through this file with me", using the skills). Options: (a) that
is enough for 0.1; (b) pull a minimal HTML overlay into 0.1, built from the
clickable prototype and served by a first `deciwa serve`.
```
