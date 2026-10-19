# deciwa

decision watcher – a review and decision tool for elements in docs, websites
and code.

```console
uv sync                       # all packages (editable) and the docs tools
.venv/bin/deciwa serve        # build docs/, review them at http://127.0.0.1:4337
```

## Layout

| Folder | What |
|---|---|
| `packages/core` | `deciwa-core` – model, `.deciwa/` store, engine: all the logic |
| `packages/server` | `deciwa-server` – review server: built site + JSON API + rebuild |
| `packages/cli` | `deciwa-cli` – the `deciwa` command |
| `packages/ui` | `deciwa-ui` – the review overlay (JS/CSS) for browser integrations |
| `packages/sphinx` | `deciwa-sphinx` – Sphinx extension (`extensions = ["deciwa.sphinx"]`) |
| `docs/` | product description, integrations, decisions, technical details – the requirements for all code here; reviewed with deciwa itself |
| `.deciwa/` | review data of the docs (`config.toml` sets what must be approved) |
| `mockups/` | the first clickable mock-up of the feedback UI and the demo recorder |

Package details and rules: `docs/technical/index.md`. How proposals become
decisions: `docs/technical/working.md`.

## Docs

```console
.venv/bin/sphinx-build -W -b html docs docs/_build/html        # strict build
.venv/bin/sphinx-build -E -b html -D deciwa_mode=offline -D deciwa_offline_annotations=0 \
    docs docs/_build/offline                                   # static review build, works from file://
```

## mockups/

- `feedback-ui.html` – clickable mock-up of the feedback UI. Serve the folder
  (`python3 -m http.server 4330 --directory mockups`) and open
  `http://localhost:4330/feedback-ui.html`.
  - URL parameters for fixed states (screenshots): `clean`, `shot`,
    `theme`, `file`, `mode`, `variant`, `open`, `rating`, `comment`, `scroll`.
  - `?demo=de|en` plays the scripted walk-through used for the product video.
- `record-demo.mjs` – records the demo as MP4, GIF and poster image
  (needs google-chrome and ffmpeg): `node mockups/record-demo.mjs de ./out`.
- `assets/` – downscaled deciwa pictures from the brain's branding assets.
