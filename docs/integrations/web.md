# Web script

*Planned for 0.2 – technical details: [Web script](../technical/web.md).*

Review any website – built with Astro, Hugo, WordPress or by hand – without
changing its build. One line in the page is enough:

```html
<script src="https://deciwa.danwos.dev/js/0.2/deciwa.js" defer></script>
```

The deciwa button appears at the bottom right of every page that loads the
script. deciwa finds the elements of the page by itself – sections,
paragraphs, list items, table rows, code blocks and pictures – and shows the
same [review UI](../product/ui.md) as the [Sphinx integration](sphinx/index.md).

## What you need to know – nothing

| Without any setting | |
|---|---|
| Elements | found in `<main>`, otherwise `<article>`, otherwise `<body>`; navigation, header, footer and forms are left out |
| Feedback is stored | in your browser, per website; **Export** hands it over as one file |
| A page is identified by | its address, e.g. `danwos.dev/services/` |

In review mode a click selects an element. Links inside a text keep working;
a link that wraps or covers a whole element – a card that is one big link –
opens the review card instead.

## Optional settings

All settings are attributes on the script tag. Leave them out until you need
them.

| Attribute | Effect |
|---|---|
| `data-root="main"` | review only this part of the page (a CSS selector) |
| `data-ignore=".cookie-banner, aside"` | leave these parts out |
| `data-activate="param"` | show deciwa only after `?deciwa` was in the address – for public sites whose visitors must not see it; it stays on in that tab until `?deciwa=off` |
| `data-server="http://127.0.0.1:4337"` | store feedback with a deciwa server instead of the browser (later, see [Roadmap](../product/roadmap.md)) |

A page can name its source file, so the AI knows which file to change:

```html
<meta name="deciwa-source" content="src/content/pages/services.md">
```

Instead of tagging every page, the repository can map addresses to files once
in `.deciwa/config.toml` ([File format](../technical/file-format.md#web-sources)).
Both are optional: without them every page is kept under its address, and
nothing is lost when a mapping is added later.

## From the browser to the repository

1. Review the pages; feedback stays in the browser.
2. **Export** in the panel saves one JSON file.
3. `deciwa import export.json` in the website's repository stores it in
   `.deciwa/` – mapped to source files where a mapping exists.
4. `deciwa todo` lists the open jobs for the AI or a developer, as for any
   other source.

The [Chrome extension](chrome.md) will use the same script, so it also works
on pages that cannot be changed.
