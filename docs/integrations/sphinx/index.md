# Sphinx

Review your Sphinx docs where readers read them: on the built HTML pages.
The deciwa Sphinx extension adds the review overlay to every page and knows
the elements of each page – sections, paragraphs, list items, table rows,
code blocks, notes, pictures and every Sphinx-Needs object by its id.

```{raw} html
<figure class="diagram">
<svg viewBox="0 0 760 250" role="img" aria-labelledby="sphinx-t">
  <defs><marker id="dw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrowhead"/></marker></defs>
  <title id="sphinx-t">Sphinx integration: sources are built into pages with the overlay; deciwa serve stores feedback in .deciwa; the AI works on the open jobs and changes the sources</title>
  <g class="box"><rect x="10" y="30" width="150" height="70" rx="10"/><text x="85" y="58">sources</text><text x="85" y="78" class="small">.md · .rst · needs</text></g>
  <g class="box main"><rect x="220" y="30" width="170" height="70" rx="10"/><text x="305" y="58" class="strong">sphinx-build</text><text x="305" y="78" class="small">+ deciwa extension</text></g>
  <g class="box alt"><rect x="450" y="30" width="150" height="70" rx="10"/><text x="525" y="58">HTML pages</text><text x="525" y="78" class="small">with review overlay</text></g>
  <g class="box"><rect x="650" y="30" width="100" height="70" rx="10"/><text x="700" y="58">you</text><text x="700" y="78" class="small">review</text></g>
  <g class="box warm"><rect x="450" y="160" width="150" height="70" rx="10"/><text x="525" y="188">.deciwa/</text><text x="525" y="208" class="small">feedback, in Git</text></g>
  <g class="box"><rect x="220" y="160" width="170" height="70" rx="10"/><text x="305" y="188">AI or developer</text><text x="305" y="208" class="small">deciwa todo · resolve</text></g>
  <g class="arrow"><path d="M160 65 H215"/><path d="M390 65 H445"/><path d="M600 65 H645"/><path d="M700 100 V195 H605"/><path d="M450 195 H395"/><path d="M220 195 H85 V105"/></g>
  <text x="680" y="140" class="label">deciwa serve</text>
</svg>
<figcaption>Build, review, work, rebuild – deciwa serve keeps the loop running.</figcaption>
</figure>
```

## Two ways to run it

| | With `deciwa serve` | Offline |
|---|---|---|
| Who | the team working on the docs | anyone with the built pages – also a public demo |
| Feedback is stored | in `.deciwa/` of the repository | in the browser, exported as one file |
| Rebuild on change | automatic, the page reloads | your own build |
| AI and CLI see feedback | at once | after `deciwa import` |

```{figure} ../../_static/screens/review-page.webp
:alt: The Sphinx docs of deciwa with the review overlay

These docs with the review overlay.
```


## Pages

- [Installation](install.md) – the extension and the CLI
- [Configuration](configuration.md) – `conf.py` options and `.deciwa/config.toml`
- [Workflow](workflow.md) – serve, review, work, rebuild; offline review and export

```{toctree}
:hidden:

install
configuration
workflow
```
