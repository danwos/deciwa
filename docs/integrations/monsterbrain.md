# monsterbrain

*Planned – technical details: [Host apps](../technical/hosts.md).*

monsterbrain is the danwos desktop app for keeping track of a knowledge
folder: file tree, the file rendered for its type, links and metadata, and a
change view that shows what agents changed. deciwa adds the review to it:

- **review on the rendered file** – Markdown, HTML and the new side of a
  diff get the same bars, card and keys as in the browser,
- **state in the tree and the change view** – each file shows how much of it
  is open, approved, stale or frozen, and which questions wait for an answer,
- **feedback of the active file** in monsterbrain's right panel,
- **questions instead of `[CHECK]` markers** ({need}`DEC_REPLACES_CHECK`) –
  what the AI asks shows up at the element and in the change view,
- **same data as everywhere else** – feedback goes to `.deciwa/` in the
  folder, so `deciwa todo`, Claude and the other integrations see it.

deciwa comes as a monsterbrain extension and brings its engine along – no
Python, no terminal ({need}`DEC_HOST_EXTENSIONS`,
{need}`DEC_STANDALONE_ENGINE`). Without the extension monsterbrain works as
before, just without review.
