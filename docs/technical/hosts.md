# Host apps and the standalone engine

:::{admonition} Status: hosts decided, standalone engine draft
:class: status-draft
The engine server, the host element source and the client are decided
(2026-10-22) and built; monsterbrain is the first host
({need}`DEC_HOST_ORDER`). The standalone engine further down is still a
proposal.
:::

A **host** is an app that renders content itself and shows deciwa inside
it: [monsterbrain](../integrations/monsterbrain.md) first, then
[VS Code](../integrations/vscode.md). Two decisions frame this page:

- {need}`DEC_HOST_EXTENSIONS` – the host only offers generic extension
  points; everything deciwa-specific is an extension in this repository.
- {need}`DEC_STANDALONE_ENGINE` – the Python parts ship as a standalone
  binary, so a host works without Python on the machine.

## Parts

| Part | Where | Task |
|---|---|---|
| engine | `deciwa` binary: core, CLI, server and the overlay files | all logic, `.deciwa/`, the JSON API |
| client | `packages/client` (TypeScript, npm `@danwos/deciwa-client`) | find, start and stop the engine, check its version, typed calls to the JSON API |
| overlay | `packages/ui` | card, panel, bars, guided review – with a third element source for hosts (`js/host.js`) |
| host adapter | `packages/monsterbrain`, later `packages/vscode` | maps the host's extension points to client and overlay – small, no logic |

The host adapters depend on client and overlay, never on each other
({need}`DEC_PACKAGES`). Logic stays in `deciwa-core` ({need}`DEC_CLI_MASTER`);
the TypeScript parts only call the engine.

## Engine as a server for a host

{need}`DEC_SERVE_API_ONLY`

```console
$ deciwa serve --api-only --root <folder> --port 0
{"deciwa": "0.0.1", "api": 1, "port": 41873, "token": "…", "root": "/home/daniel/brain"}
```

- **Handshake:** the first line on stdout. `root` is the folder that holds
  `.deciwa/` – it may lie above the folder the host opened; the host maps its
  paths by the difference. Without `.deciwa/` the line is
  `{"api": 1, "error": {"code": "no-deciwa", …}}` and the engine exits with 2;
  the host can then offer `deciwa init --at <folder>`.
- **Token:** every request carries the header `X-Deciwa-Token`; other local
  pages cannot call the API. `--token` or `DECIWA_TOKEN` set it, otherwise it
  is random.
- **Lifetime:** the engine stops when its stdin closes, so it never outlives
  the host. `--keep-running` turns this off (for trying it in a terminal).
- **No site:** everything outside `/api/` answers 404.

Endpoints for hosts, next to the ones of the review server (`/api/page`,
`/api/annotate`, `/api/reply`, `/api/project`, `/api/todo`, …):

| Endpoint | Returns |
|---|---|
| `GET /api/version` | `app` (engine version), `api` (major of the JSON API), `root` |
| `GET /api/elements?source=<path>` | the elements of a file with selector, kind, label, line, text and fingerprint – from the elements index of a build, else from the adapter for the file type |
| `POST /api/elements` `{source, title, elements}` | keeps the elements of a page the host scanned itself (rendered HTML), like the pages of a website in `.deciwa/web-pages.json` |
| `GET /api/summary[?sources=a,b]` | per file: counts per state, open questions, jobs for the AI, required and done – without `sources` for every file with review data |
| `GET /api/events` | server-sent events `{"type": "changed", "sources": […], "review": …, "config": …}` when `.deciwa/` or a reviewed file changes |

Files without a build are read by their adapter on the fly
([Adapters](adapters.md)), so a plain Markdown folder such as a knowledge
base needs no Sphinx: `deciwa todo`, `show` and the project overview cover
every file with review data and every file under `review.paths`.

## Overlay in a host

{need}`DEC_HOST_ELEMENTS`

The host marks its rendered view:

- every block carries `data-line="<first source line, 0-based>"` – what
  markdown-it does with its token maps and what the VS Code Markdown preview
  already does; lines count the frontmatter,
- the host adapter sets `data-deciwa-source="<path relative to the root>"`
  on the container.

`hostElements()` in `packages/ui/js/host.js` loads nothing itself: the
adapter passes the elements from `/api/elements`, and each is matched to the
block of its kind that starts on its line (heading → `h1`–`h6`, paragraph →
`p`, item → `li`, row → `tr`, code → `pre`). Elements of a build index whose
lines are not exact (Sphinx) fall back to their text. Blocks without a match
are not reviewable.

`startOverlay()` takes a few options for hosts: `api` (calls go through the
host, not `fetch`), `scroller` (the element the content scrolls in; the UI is
mounted inside it), `keys: "review"` (keys only in review mode – the host keeps
its own shortcuts), `tools: false` (no floating pill), `openDoc` (open another
file in the host) and `focus`. It returns `dock()` / `undock()` to put the
panel into the host's side panel, `setReview()`, `focus()`, `refresh()` and
`destroy()`.

In a diff the overlay runs on the new side only; the old side is read only.
Rendered HTML files keep the DOM scan of the web script, with the file path
as source; their elements go to the engine with `POST /api/elements`.

## Client

{need}`DEC_CLIENT_PACKAGE`

`packages/client` (`@danwos/deciwa-client`) runs in Node – the host's main or
extension process, never in a page, so the token stays there:

- `findEngine()` – the path from the host's settings, the engines bundled
  with the host, then `deciwa` on `PATH`,
- `new Engine({root, enginePath, bundled}).start()` – starts
  `serve --api-only`, reads the handshake, refuses another API major
  (`api-mismatch`), restarts after a crash (at most three times a minute),
- typed calls (`elements`, `page`, `summary`, `todo`, `annotate`, `hostPage`,
  `call` for any endpoint) and `events()` with reconnect,
- `initFolder()` – `deciwa init --at <folder>`.

`npm test` in `packages/client` starts the engine of the checkout against a
temporary folder.

## Standalone engine

```{prop} The engine is built with PyInstaller, one folder per platform
:id: PROP_ENGINE_BINARY
:status: draft
:refines: DEC_STANDALONE_ENGINE, PROP_PYTHON_CORE

- **Content:** `deciwa-core`, `-server`, `-cli` and the overlay files of
  `deciwa-ui`. Not `deciwa-sphinx`: Sphinx builds keep running in the docs
  project's own Python environment.
- **Form:** PyInstaller *one-folder* (starts fast; *one-file* unpacks on every
  start), so the host can sign every file inside.
- **Platforms:** linux-x64, linux-arm64, macos-arm64, macos-x64, windows-x64 –
  built in GitHub Actions on each platform, smoke-tested with
  `deciwa --version` and `serve --api-only` against a test folder.
- **Release:** a zip per platform in the releases of `danwos/deciwa`. A host
  pins an engine version and fetches it at its own build time; it never
  downloads code at run time.
- **Signing:** the host signs the bundled engine together with its own code
  (Apple notarisation requires every binary inside the app to be signed).
- **Size:** expected 20–40 MB per platform; to be measured with the first
  build.
```

```{prop} VS Code ships one package per platform with the engine inside
:id: PROP_VSCODE_PLATFORM
:status: draft
:refines: PROP_ENGINE_BINARY

`vsce package --target <platform>` builds one extension package per platform,
each with its engine. A universal package without engine uses `deciwa` on
`PATH` – for platforms without a build.
```

```{question} Which tool builds the standalone engine?
:id: Q_ENGINE_BINARY_TOOL
:status: open
:to: Daniel
:answers: PROP_ENGINE_BINARY

Proposal: PyInstaller – widely used, simple, no C compiler. Alternatives:
Nuitka (compiles to C: faster and smaller, but long builds and a C compiler
per platform); python-build-standalone plus the installed packages (no
freezing problems, but bigger and many loose files).
```
