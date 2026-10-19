# deciwa

decision watcher – a review and decision tool for elements in docs, websites
and code.

## docs/

Product description, integrations, decisions and technical details – the requirements for all code
in this repository. Markdown (MyST) with Sphinx-Needs; the HTML is
generated.

```console
uv venv && uv pip install -r docs/requirements.txt
.venv/bin/sphinx-autobuild docs docs/_build/html --port 4336
```

Then open `http://localhost:4336`. How proposals become decisions:
`docs/contributing.md`.

## prototype/

Review overlay for these docs (Sphinx extension, engine, local server, CLI):
`uv pip install -e prototype`, then `.venv/bin/deciwa serve` and open
`http://127.0.0.1:4337`. Details: `docs/contributing.md`.

## mockups/

- `feedback-ui.html` – clickable prototype of the feedback UI. Serve the
  folder (`python3 -m http.server 4330 --directory mockups`) and open
  `http://localhost:4330/feedback-ui.html`.
  - URL parameters for fixed states (screenshots): `clean`, `shot`,
    `theme`, `file`, `mode`, `variant`, `open`, `rating`, `comment`, `scroll`.
  - `?demo=de|en` plays the scripted walk-through used for the product video.
- `record-demo.mjs` – records the demo as MP4, GIF and poster image
  (needs google-chrome and ffmpeg): `node mockups/record-demo.mjs de ./out`.
- `assets/` – downscaled deciwa pictures from the brain's branding assets.
