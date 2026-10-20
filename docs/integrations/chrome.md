# Chrome

*Planned for 0.4.*

Review any rendered page – built docs or a live website – without changing
its build:

- the extension injects the [web script](web.md), so it also works on pages
  you cannot change; the script recognises the elements of the page (block containers,
  headings, paragraphs, images) and adds the review UI,
- for Sphinx pages it uses the same elements as the [Sphinx integration](sphinx/index.md),
- feedback goes to the local CLI or, for teams, to the hosted service.
