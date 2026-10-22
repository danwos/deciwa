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
    <rect x="265" y="20" width="230" height="56" rx="10"/><text x="380" y="44">server</text><text x="380" y="62" class="small">deciwa serve, JSON API</text>
    <rect x="510" y="20" width="230" height="56" rx="10"/><text x="625" y="44">sphinx</text><text x="625" y="62" class="small">tags rendered HTML</text>
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

```{prop} The core is split into layers with a strict dependency direction
:id: PROP_LAYERS
:status: draft
:refines: DEC_CLI_MASTER, DEC_PACKAGES

Inside `deciwa.core`:

| Module | Contains | May use |
|---|---|---|
| `deciwa.core.model` | annotations, ids, fingerprints, schema version | – |
| `deciwa.core.adapters` (0.1) | one module per format; text in, elements out | model |
| `deciwa.core.store` | finding `.deciwa/`, reading and writing annotation files, config | model |
| `deciwa.core.engine` | resolving selectors, states, review rules, todo lists, export/import | model, adapters, store |

Every other package is a front end and uses only `deciwa.core.Project`
(never the store or the files directly), so the hosted service can later
replace `store` without changing them.
```

The packages themselves: {ref}`Technical overview <packages>`.
