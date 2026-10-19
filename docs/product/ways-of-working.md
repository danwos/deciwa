# Three ways of working

They stay separate – in the UI, in the data and on the website
({need}`DEC_THREE_MODES`).

| Mode | What the human does | What it is for |
|---|---|---|
| 1. Feedback | approve, reject, rephrase, more details, delete, freeze, note | decide what happens to an element; drives element state and the AI's work list |
| 2. Quality rating | 1–5 stars, one click, saved on its own | quick judgement without a decision; an approved element can still get two stars; evaluations show the weak areas |
| 3. AI communication | answer a question the AI (e.g. Claude) asked on an element – by verdict ("approve" = yes) or in text | the AI asks instead of guessing; the question lives at the element, not in a chat |

## Feedback (mode 1)

Verdicts plus quick actions give the AI a complete instruction with one click
({need}`DEC_VERDICTS`).

| Button | Key | Meaning |
|---|---|---|
| Approve | `a` | the statement is confirmed – it becomes a decision |
| Rephrase | `r` | job for the AI: say it better |
| More details | `m` | job for the AI: expand it |
| Delete | `d` | job for the AI: remove the element |
| Freeze | `f` | keep exactly as it is; the AI must never change it ({need}`DEC_FREEZE`) |
| Reject | `x` | the statement is wrong |
| Note | `n` | just a note (needs a comment) |

One click saves; the comment is optional except for Note. A frozen element
that changes anyway raises an alarm and shows the old wording.

A decision is an approved statement, not an extra object
({need}`DEC_DECISION_IS_APPROVAL`) – so decisions can be mapped onto anything
that is an element.

## Terms

| Term | Meaning |
|---|---|
| Element | anything that can be pointed at: a structural object of the format (need, section, function, HTML container …) or a free text range down to one word. Found from the content – never a marker in the source. |
| Annotation | one piece of feedback, one rating or one answer on an element; author (person or agent), status `open` / `resolved` |
| Request | an annotation that asks someone (often the AI asking the human) a question about an element |
| Decision | an approved statement – not a separate object |
| State | computed, never stored – see below |

## Element states

| State | Meaning |
|---|---|
| `unreviewed` | nobody gave a verdict yet |
| `requested` | someone was asked about it |
| `approved` | the current wording is confirmed |
| `frozen` | must stay exactly as it is |
| `changes requested` | a quick action (rephrase, more details, delete) is open |
| `rejected` | the statement is wrong |
| `stale` | approved, but the text changed since |
| `frozen, but changed` | alarm: a frozen text was changed – restore it |
| `orphaned` | the element is not found any more – offered for relinking |

How states are computed: [state engine](../concept/state-engine.md) (concept).
