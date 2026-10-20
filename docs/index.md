# deciwa

**decision watcher** – point at any part of a doc, a website or a source
file and say what you think of it. deciwa keeps your verdict tied to exactly
that spot, notices when it changes and shows at any time what is confirmed,
what is still open and what must not be touched.

```{raw} html
<figure class="video">
<video src="_static/video/deciwa-product-en.mp4" poster="_static/video/deciwa-product-en.jpg" controls muted playsinline preload="metadata"></video>
<figcaption>deciwa in 50 seconds – recorded from these docs.</figcaption>
</figure>
```

## Why deciwa

Feedback usually ends up in chats, tickets and comment threads, far away
from the text it is about. A week later nobody knows which wording was
agreed on, and after the next edit nobody notices that an agreed sentence
quietly changed. deciwa puts the feedback where it belongs – on the element
itself – and keeps watching it.

- **Feedback stays at the element.** A verdict on a paragraph, a
  requirement or a single word stays with it, even when the text moves.
- **Changes do not slip through.** An approved text that is edited later
  shows up as `stale`, with old and new wording side by side. A frozen text
  that changes raises an alarm.
- **Decisions you can see.** An approved statement *is* the decision – no
  extra list to keep in sync.
- **The AI asks instead of guessing.** Claude puts its questions right at
  the element; you answer with yes, no or a few words.
- **You know where you stand.** Per page and for the whole project, deciwa
  shows how much of what must be approved is approved.
- **Your data stays yours.** Reviews live in an open format inside your
  repository and are versioned with Git.

## What you can do

| | |
|---|---|
| **Give feedback** | approve, reject, approve & freeze or delete – one key or click, with an optional comment – [Three ways of working](product/ways-of-working.md) |
| **Rate quality** | zero to five stars, independent of any verdict, to find the weak spots |
| **Answer the AI** | questions from Claude appear at the element they are about |
| **Review anything you can point at** | requirements, headings, paragraphs, table rows, pictures, a selected word – no markers in the source – [What you can review](product/elements.md) |
| **Decide what must be approved** | every requirement, every heading, only some pages – [What must be approved](product/review-rules.md) |
| **Work through a page** | guided review jumps from one open element to the next – [The review UI](product/ui.md) |
| **Keep the overview** | the panel lists all feedback, open jobs and coverage per page and project |

```{figure} _static/screens/review-page.webp
:alt: A docs page under review: coloured bars beside the reviewed elements, the deciwa button at the bottom right

The bar beside each element shows its state; the deciwa button at the bottom right counts them.
```

## How a review goes

1. **Open the result** – the built docs page, the website, the file in your
   editor – and switch review on.
2. **Point and decide** – hover an element, press a key: approve, reject,
   approve & freeze, delete; add stars and a comment if you like.
3. **Let the work happen** – an AI agent or a developer picks up the open
   jobs, changes the text and marks them as done.
4. **See what changed** – changed approvals come back as `stale`, a changed
   frozen text as an alarm.
5. **Track coverage** – watch the share of approved elements grow until the
   page or the whole project is through.

deciwa is a review and decision tool for everyone who works with docs and
code ({need}`DEC_PURPOSE`). It collects, evaluates and shows; it does not
watch that decisions are kept ({need}`DEC_NO_ENFORCING`). The change itself
is made by the AI or the developer – deciwa makes sure nobody loses track of
it.

| Not deciwa | Who does it |
|---|---|
| Making or checking the change itself | AI agent or developer |
| Testing whether code follows a decision | quawa, normal tests |
| Managing facts and generating views from them | faktwerk |

## Try it on these pages

These docs run deciwa themselves. Hover the round deciwa button at the
bottom right, switch on **Review** and give feedback on anything you see.
Everything stays in your browser.
A first round to follow: [Demo](demo.md).

## Where deciwa runs

| | Where you review | Status |
|---|---|---|
| [Sphinx](integrations/sphinx/index.md) | built docs in the browser, with Sphinx-Needs | prototype, usable now |
| [VS Code](integrations/vscode.md) | the editor and its docs preview | 0.3 |
| [Web script](integrations/web.md) | any website, with one line in the page | 0.2 |
| [Chrome](integrations/chrome.md) | any rendered page – docs or website | 0.4 |
| [Claude](integrations/claude.md) | a conversation with the AI | skills in 0.1 |
| [Desktop app](integrations/desktop.md) | without a development environment | later |

What comes when: [Roadmap](product/roadmap.md). How deciwa is built:
[Technical overview](technical/index.md).

```{toctree}
:caption: Product
:maxdepth: 2
:hidden:

What deciwa is <self>
demo
product/ways-of-working
product/elements
product/review-rules
product/ui
product/cli
product/data
product/roadmap
```

```{toctree}
:caption: Integrations
:maxdepth: 2
:hidden:

integrations/index
integrations/sphinx/index
integrations/web
integrations/vscode
integrations/chrome
integrations/claude
integrations/desktop
```

```{toctree}
:caption: Decisions
:hidden:

decisions/index
```

```{toctree}
:caption: Technical details
:maxdepth: 2
:hidden:

technical/index
technical/stack
technical/layers
technical/adapters
technical/file-format
technical/state-engine
technical/web
technical/cli
technical/skills
technical/rollout
technical/questions
technical/working
```

