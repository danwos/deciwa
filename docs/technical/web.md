# Web script

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude – not binding until Daniel approves them.
:::

How the review overlay runs on any website without a build step. What users
see: [Web script](../integrations/web.md).

Today the overlay depends on the Sphinx build for four things: the
`dw-el-<n>` classes and the `#deciwa-page` map on every page, `elements.json`
(text and fingerprint of every element), `config.json` (review rules) and the
source file of the page. The web script finds all of this in the browser.

```{prop} Loading the script is enough – deciwa always appears
:id: PROP_WEB_ONE_LINE
:status: approved
:refines: DEC_INTEGRATIONS

A single `<script src=".../deciwa.js" defer>` without attributes shows the
deciwa button on every page and works offline in the browser. No
configuration file, no build step, no page mapping is needed to try it.
Everything else is an optional attribute ({doc}`../integrations/web`).
Decided: {need}`DEC_WEB_ONE_LINE`.
`data-activate="param"` is an opt-in for public sites: deciwa then loads
only when the address contains `?deciwa`.
```

```{prop} The overlay is split into element source, store and UI
:id: PROP_OVERLAY_PARTS
:status: draft
:refines: PROP_WEB_ONE_LINE, DEC_CLI_MASTER

| Part | Variants |
|---|---|
| element source | Sphinx (`#deciwa-page` from the build) · DOM scan (the HTML adapter below) |
| store | `deciwa serve` · offline in the browser · a remote deciwa server (later) |
| UI | card, panel, bars, guided review – unchanged |

The parts meet in small interfaces: an element source returns the element
list of the page, a store answers the calls the overlay makes today
(`/api/page`, `/api/annotate`, …). The Sphinx integration keeps working
unchanged and is the test that the split did not break anything.
```

```{prop} One bundle built with esbuild, the UI inside a Shadow DOM
:id: PROP_WEB_BUNDLE
:status: draft
:refines: PROP_OVERLAY_PARTS

The overlay sources become ES modules in `packages/ui/js/`. esbuild (no
framework) builds two files:

- `deciwa-overlay.js` – for the Python package and the Sphinx extension, as today,
- `deciwa.js` – the web script: one file with the CSS and the deciwa picture
  inlined.

On foreign pages the UI lives in a Shadow DOM, so the page's CSS cannot break
the overlay and the overlay's CSS cannot change the page.
```

```{prop} The web script is hosted with the docs under a versioned path
:id: PROP_WEB_HOSTING
:status: approved
:refines: PROP_WEB_BUNDLE

The docs workflow publishes `deciwa.js` to `https://deciwa.danwos.dev/js/<version>/deciwa.js`.
A published version never changes, so sites can pin it with a Subresource
Integrity hash; `/js/latest/deciwa.js` follows the newest version.
Decided: {need}`DEC_WEB_HOSTING`.
```

```{prop} A page is identified by its meta tag, a mapping rule or its address
:id: PROP_WEB_SOURCE
:status: approved
:refines: PROP_WEB_ONE_LINE, DEC_DECIWA_FOLDER

The source of a page is, in this order:

1. `<meta name="deciwa-source" content="…">` on the page,
2. the first matching rule of `[web].sources` in `.deciwa/config.toml`
   (applied by the CLI on import, see {doc}`file-format`),
3. the fallback, which always works: `web:<host><path>`, e.g.
   `web:danwos.dev/services/`. Query and fragment are dropped, `index.html`
   and a missing trailing slash count as the same page.

The browser always stores the address; a mapping added later moves the
annotations to the source file without losing any.
Decided: {need}`DEC_WEB_SOURCE`.
```

```{prop} The browser remembers the elements of every visited page
:id: PROP_WEB_INDEX
:status: draft
:refines: PROP_WEB_SOURCE

Without a build there is no `elements.json`. The web script stores the
element list of each page it has seen (selector, kind, label, text,
fingerprint) in the browser, so the project panel lists all visited pages
and stale elements are found when a page is opened again. An export carries
this index along, so the CLI can resolve web annotations without an HTML
adapter in Python. Reading `sitemap.xml` to list all pages up front can come
later.
```

```{prop} Pages that change after loading are scanned again
:id: PROP_WEB_RESCAN
:status: draft
:refines: PROP_DOM_ADAPTER

The script scans again after client-side navigation (`popstate`,
`astro:page-load`, `turbo:load`) and, throttled, when a `MutationObserver`
sees changes inside the review root. Open cards stay attached to their
element through its selector.
```

```{question} When does the web script come?
:id: Q_WEB_STEP
:status: answered
:to: Daniel
:refines: PROP_WEB_ONE_LINE

Proposal was: right after the prototype, before VS Code – the first real use
is the danwos website, and the Chrome extension builds on it.
Answered by Daniel (2026-10-20): yes, as 0.2 – see {need}`DEC_WEB_SCRIPT_FIRST`.
```

## First use: the danwos website

- `src/layouts/Base.astro` gets the script tag with `data-activate="param"`.
- The website repository gets `.deciwa/config.toml` with `[web].sources` for
  its content collections.
- The self-built feedback tool in the Astro dev toolbar
  (`.feedback/feedback.json`) is replaced once deciwa works there.
