# Data – the `.deciwa` folder

- All deciwa files live in one `.deciwa/` folder, never next to the sources
  ({need}`DEC_DECIWA_FOLDER`): at the repository root (default) or in any
  parent folder – for several repositories at once, or for repositories that
  must stay untouched.
- The CLI finds the nearest `.deciwa/` like Git finds `.git/`;
  `deciwa init [--at <folder>]` creates it. Paths inside are relative to the
  folder that holds `.deciwa/`.
- One JSON file per annotated source file
  (`.deciwa/annotations/<path>.json`), versioned schema (`"deciwa": "0.1"`).
- Committed to Git by default ({need}`DEC_GIT_COMMITTED`) – reviews are
  versioned together with the content.
- The format is publicly documented, so data is never locked in.
- Element state is never stored, always computed from the annotations plus
  the current source.

Detailed format: [file format](../concept/file-format.md) (concept).

## Hosted service

The storage backend is switchable: local files by default, the hosted
service when configured – same format in both. The hosted service adds
central storage synced by the CLI, a web UI for reviewers outside
development, a task list per person, evaluations (coverage, ratings and weak
areas, time to approval), comparisons between versions, a team overview, an
audit report (who approved which wording when), users and roles.
