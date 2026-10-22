# Host apps and the standalone engine

:::{admonition} Status: draft
:class: status-draft
Proposals by Claude, 2026-10-22 – not binding until Daniel approves them.
Not part of 0.1, but 0.1 must not block it.
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
| client | `packages/client` (TypeScript, npm) | find, start and stop the engine, check its version, typed calls to the JSON API |
| overlay | `packages/ui` | card, panel, bars, guided review – with a third element source for hosts |
| host adapter | `packages/monsterbrain`, later `packages/vscode` | maps the host's extension points to client and overlay – small, no logic |

The host adapters depend on client and overlay, never on each other
({need}`DEC_PACKAGES`). Logic stays in `deciwa-core` ({need}`DEC_CLI_MASTER`);
the TypeScript parts only call the engine.

## Engine as a server for a host

```{prop} deciwa serve --api-only: the JSON API for a folder, without a build
:id: PROP_SERVE_API_ONLY
:status: draft
:refines: DEC_HOST_EXTENSIONS, DEC_CLI_MASTER

`deciwa serve --api-only --root <folder> --port 0` serves the JSON API and
no site; a host renders the content itself.

- **Handshake:** on start the engine prints one JSON line to stdout –
  `{"port": …, "token": "…", "api": 1}`. Port 0 picks a free port; every
  request must carry the token, so other local pages cannot call the API.
- **Lifetime:** the engine stops when its stdin closes, so it never
  outlives the host.
- **New endpoints** next to the ones of today (`/api/page`, `/api/annotate`,
  …):
  - `/api/elements?source=<path>` – the adapter's elements of a file with
    selector, kind, label and line range,
  - `/api/summary?sources=<path>,…` – counts per file and state (open,
    approved, stale, frozen, questions) for badges in trees and lists,
  - `/api/events` – server-sent events when `.deciwa/` or a reviewed source
    changes, so the host refreshes instead of polling.
```

## Overlay in a host

```{prop} A third element source for the overlay: the host renders, the adapter names the elements
:id: PROP_HOST_ELEMENTS
:status: draft
:refines: PROP_OVERLAY_PARTS, DEC_REVIEW_ON_RESULTS

Next to Sphinx and the DOM scan, the overlay gets the element source
`host`. The host marks its rendered view:

- the container carries `data-deciwa-source="<path relative to the root>"`,
- every block carries `data-line="<first source line, 0-based>"` – what
  markdown-it does with its token maps and what the VS Code Markdown preview
  already does.

The overlay loads `/api/elements?source=…` and matches each block to the
adapter element that starts on that line. Feedback then gets the same
selectors as in the CLI (`md:paragraph:Career/Advisor#2`), so `deciwa todo`
points at the source line. Blocks without a match are not reviewable.
Rendered HTML files keep the DOM scan of the web script, with the file path
as source.

In a diff the overlay runs on the new side only; the old side is read only.
```

```{prop} One TypeScript client for all hosts
:id: PROP_CLIENT_PACKAGE
:status: draft
:refines: DEC_HOST_EXTENSIONS, DEC_STANDALONE_ENGINE

`packages/client` (npm `@danwos/deciwa-client`):

- **finds the engine** in this order: a path from the host's settings, the
  binary bundled with the host, `deciwa` on `PATH`,
- **starts** it with `serve --api-only`, reads the handshake, restarts it
  after a crash,
- **checks the version:** `/api/version` returns the app version and the API
  major; a host refuses an engine with another major and says why,
- **typed calls** for every endpoint and the event stream.

monsterbrain and VS Code use the same client; only the adapter that puts the
results into the host's UI differs.
```

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

```{question} Does monsterbrain come before VS Code?
:id: Q_HOST_ORDER
:status: open
:to: Daniel
:refines: DEC_HOST_EXTENSIONS

Proposal: yes. Daniel uses monsterbrain daily on his knowledge base, which
is also the first use of 0.1 ({doc}`rollout`). It tests the API server,
the host element source and the client that VS Code needs later.
```
