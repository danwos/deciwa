# Layers

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude – not binding until Daniel approves them.
:::

```{raw} html
<figure class="diagram">
<svg viewBox="0 0 760 360" role="img" aria-labelledby="layers-t">
  <defs><marker id="dw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrowhead"/></marker></defs>
  <title id="layers-t">Core layers: cli and server on top, engine in the middle, adapters and store below, model at the bottom</title>
  <g class="box alt">
    <rect x="20" y="20" width="230" height="56" rx="10"/><text x="135" y="44">cli</text><text x="135" y="62" class="small">click commands, --json</text>
    <rect x="265" y="20" width="230" height="56" rx="10"/><text x="380" y="44">server (0.2)</text><text x="380" y="62" class="small">deciwa serve, JSON API</text>
    <rect x="510" y="20" width="230" height="56" rx="10"/><text x="625" y="44">sphinx (0.3)</text><text x="625" y="62" class="small">tags rendered HTML</text>
  </g>
  <g class="arrow"><path d="M135 76 V120"/><path d="M380 76 V120"/><path d="M625 76 V178"/></g>
  <g class="box main">
    <rect x="20" y="125" width="475" height="56" rx="12"/>
    <text x="257" y="149" class="strong">engine</text>
    <text x="257" y="167" class="small">resolve selectors · fingerprints · states · todo</text>
  </g>
  <g class="arrow"><path d="M140 181 V225"/><path d="M380 181 V225"/></g>
  <g class="box">
    <rect x="20" y="230" width="240" height="56" rx="10"/><text x="140" y="254">store</text><text x="140" y="272" class="small">find .deciwa/, read, write</text>
    <rect x="275" y="183" width="465" height="103" rx="10"/><text x="507" y="232">adapters</text><text x="507" y="252" class="small">md · rst (+ Sphinx-Needs) · text → elements</text>
  </g>
  <g class="arrow"><path d="M140 286 V300"/><path d="M507 286 V300"/></g>
  <g class="box warm">
    <rect x="20" y="305" width="720" height="44" rx="10"/><text x="380" y="332">model – Annotation, Selector, Element, State (plain dataclasses, no I/O)</text>
  </g>
</svg>
<figcaption>Arrows point to what a layer may use. Nothing points up.</figcaption>
</figure>
```

```{prop} The core is split into five layers with a strict dependency direction
:id: PROP_LAYERS
:status: draft
:refines: DEC_CLI_MASTER

| Package | Contains | May use |
|---|---|---|
| `deciwa.model` | dataclasses, JSON (de)serialisation, schema version | – |
| `deciwa.adapters` | one module per format; text in, elements out | model |
| `deciwa.store` | finding `.deciwa/`, reading and writing annotation files, config | model |
| `deciwa.engine` | resolving selectors, fingerprints, states, todo lists | model, adapters, store |
| `deciwa.cli`, `deciwa.server`, `deciwa.sphinx` | front ends | engine (never store or files directly) |

The engine is the public Python API. Front ends never touch files, so the
hosted service can later replace `store` without changing them.
```

```{prop} Repository layout
:id: PROP_REPO_LAYOUT
:status: draft
:refines: PROP_LAYERS
```

```text
deciwa/
├── src/deciwa/
│   ├── model/        annotation.py, selector.py, element.py, state.py
│   ├── adapters/     markdown.py, rst.py, text.py, base.py
│   ├── store/        discover.py, files.py, config.py
│   ├── engine/       resolve.py, fingerprint.py, state.py, todo.py
│   └── cli/          main.py
├── schema/           deciwa-0.1.schema.json
├── skills/           deciwa-work/SKILL.md, deciwa-ask/SKILL.md
├── tests/            fixtures/ per adapter, golden files, edit scenarios
├── integrations/     vscode/, chrome/ (0.2+)
├── mockups/          clickable prototype, demo recorder
└── docs/             these docs
```
