# Where reviews are stored

- All feedback lives in one `.deciwa/` folder, never next to your sources
  ({need}`DEC_DECIWA_FOLDER`): at the repository root, or in a parent folder
  for several repositories at once or for repositories that must stay
  untouched. `deciwa init [--at <folder>]` creates it.
- One file per reviewed source, in an openly documented JSON format – your
  data is never locked in.
- `.deciwa/` is committed to Git by default ({need}`DEC_GIT_COMMITTED`), so
  reviews are versioned together with the content.
- All review data can be exported as one deciwa file and imported again – it
  then replaces the data, and a file older than the current data is refused.
  Without a server this is how a review leaves the browser.

## Hosted service

Teams can sync `.deciwa/` with the hosted service instead (0.4). It adds a
web UI for reviewers outside development, a task list per person,
evaluations (coverage, ratings, weak areas, time to approval), comparisons
between versions, a team overview, an audit report (who approved which
wording when), users and roles.
