# State engine

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude – not binding until Daniel approves them.
:::

State is never stored, always computed from the annotations plus the current
source. The engine does it in three steps for every annotated file.

```{raw} html
<figure class="diagram">
<svg viewBox="0 0 760 210" role="img" aria-labelledby="engine-t">
  <defs><marker id="dw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrowhead"/></marker></defs>
  <title id="engine-t">State engine pipeline: resolve the target, compare the fingerprint, compute the state</title>
  <g class="box">
    <rect x="10" y="20" width="160" height="70" rx="10"/><text x="90" y="50">source file</text><text x="90" y="70" class="small">+ annotation file</text>
  </g>
  <g class="box main">
    <rect x="215" y="20" width="160" height="70" rx="10"/><text x="295" y="50" class="strong">1 · resolve</text><text x="295" y="70" class="small">structural → quote → position</text>
    <rect x="420" y="20" width="160" height="70" rx="10"/><text x="500" y="50" class="strong">2 · compare</text><text x="500" y="70" class="small">fingerprint now vs. then</text>
  </g>
  <g class="box alt">
    <rect x="625" y="20" width="125" height="70" rx="10"/><text x="687" y="50" class="strong">3 · state</text><text x="687" y="70" class="small">per element</text>
  </g>
  <g class="arrow"><path d="M170 55 H210"/><path d="M375 55 H415"/><path d="M580 55 H620"/><path d="M295 90 V140"/><path d="M500 90 V140"/></g>
  <g class="box warm">
    <rect x="215" y="145" width="160" height="50" rx="10"/><text x="295" y="175">not found → orphaned</text>
    <rect x="420" y="145" width="160" height="50" rx="10"/><text x="500" y="175">changed → stale / alarm</text>
  </g>
</svg>
</figure>
```

## 1 · Resolve

```{prop} Selectors are tried in a fixed order and the first unique hit wins
:id: PROP_RESOLVE
:status: draft
:refines: DEC_NO_MARKERS, PROP_SELECTORS

1. **Structural** – the adapter's element list has an element with exactly
   this selector.
2. **Text quote** – the exact text occurs once in the file; if it occurs
   several times, prefix and suffix decide. Whitespace differences are
   ignored.
3. **Position** – only if the text at that position still matches the
   fingerprint.

If the selector that hit is not the first one, the engine reports a
`relinked` hint so `deciwa` can update the stored selectors (only on an
explicit `deciwa relink`, never silently). Nothing hits → `orphaned`.
```

## 2 · Compare

```{prop} The fingerprint covers the source text with whitespace normalised
:id: PROP_FINGERPRINT
:status: draft
:refines: PROP_RESOLVE

`sha256` over the element's source text after Unicode NFC, trimming and
collapsing runs of whitespace into one space. Markup stays in: turning a word
bold makes an approval `stale`.
```

```{question} Should pure formatting changes make an approval stale?
:id: Q_FINGERPRINT_MARKUP
:status: open
:to: Daniel
:refines: PROP_FINGERPRINT

With markup in the fingerprint, bold, a new link or a re-wrapped table makes
an approved statement `stale`. Without it, only changes to the words do – but
deciwa then has to strip markup per format. Proposal: keep markup in for 0.1
(simple, safe); revisit if it is too noisy in the knowledge base.
```

## 3 · State

Ratings and notes never change the state. For everything else the engine
looks at the open and the latest annotations of an element and picks the
first rule that applies:

| # | Rule | State |
|---|---|---|
| 1 | target not found | `orphaned` |
| 2 | latest freeze is in force and the fingerprint changed | `frozen, but changed` |
| 3 | latest freeze is in force | `frozen` |
| 4 | an open quick action (rephrase, details, delete) | `changes requested` |
| 5 | latest verdict is reject | `rejected` |
| 6 | latest verdict is approve and the fingerprint changed | `stale` |
| 7 | latest verdict is approve | `approved` |
| 8 | an open request | `requested` |
| 9 | none of these | `unreviewed` |

```{prop} State rules in this order
:id: PROP_STATE_RULES
:status: draft
:refines: DEC_THREE_MODES, DEC_FREEZE, DEC_DECISION_IS_APPROVAL

An open request is shown as a badge on top of every other state, so
`approved` with an open question is still visible as approved. A resolved
quick action does not approve anything: after `deciwa resolve` the element
falls back to its previous state, and the `stale` check shows that it was
changed.
```

```{question} How is a freeze lifted?
:id: Q_UNFREEZE
:status: open
:to: Daniel
:refines: PROP_STATE_RULES

Options: (a) a new verdict `approve` on the element ends the freeze;
(b) an explicit `deciwa unfreeze <id>` that only humans may run; (c) only by
deleting the freeze annotation. Proposal: (b) – a freeze is strong on
purpose, and agents must never lift it.
```
