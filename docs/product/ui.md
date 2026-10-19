# The review UI

The same UI in every integration; colours and fonts are the danwos ones
({need}`DEC_DANWOS_TOKENS`).

## The deciwa button

A round deciwa logo sits at the bottom right. Hover it to see the counters
and the two switches:

- **Review** – turns reviewing on: hover outlines, the feedback card and the
  keys. Off by default, so the page reads normally.
- **Panel** – the list of all feedback.

While review or the panel is on, the button stays open.

## Feedback card

Click an element (or press a key while hovering it) to open its card at the
element ({need}`DEC_FEEDBACK_CARD`) – beside the text when there is room,
otherwise below it, above only at the end of the page; it never covers the
element:

- a bar with the element, its state and whether it must be approved,
- a question the AI asked about it – answer yes, no or in words,
- **Verdict** – an optional comment, then approve, reject, approve & freeze,
  delete – the comment goes with the verdict – or **Comment only** to save
  the comment without a verdict,
- **Quality** – zero to five stars,
- the history, with the old wording of changed texts.

Drag the card by its bar if it is in the way; the next card opens at its
usual place again. A click next to the content, `Esc` or × closes the card.

## On phones and tablets

Tap instead of hover: tap the deciwa logo for the switches, tap an element
for its card, tap next to it to close. Buttons and stars are larger, keys
are not shown, and the panel takes the whole screen – choosing an entry
closes it and opens the card.

## Keys

| Key | Does |
|---|---|
| `a` | approve |
| `r` | reject |
| `f` | approve & freeze |
| `d` | delete |
| `0`–`5` | quality stars |
| `n` | write a comment |
| `Ctrl+Enter` | comment only – save the comment without a verdict |
| `Alt` + hover | select the parent element |
| `v` | guided review on/off |
| `j` / `k` | next / previous open element |
| `Shift+R` | review on/off |
| `Shift+P` | panel on/off |
| `Esc` | close the card |

## Guided review

**▶ Guided review** in the panel (or `v`) walks through every element that
must be approved and has no verdict yet: the card opens on the first one,
and after each verdict the next one follows – on this page, then on the
next pages. `j` / `k` skip forward and back (also without guided review);
**Stop guided** in the panel or `v` ends it. Stars
and notes do not move on; it stays on across pages until you stop it.

## State bars

A coloured bar beside each element with feedback shows its state; a `?`
marks an open question; a grey dashed line marks an element that must still
be approved.

## Panel

- **This page** – a bar with two shares of the required elements (with a
  verdict, with stars), the review rules, what still has no verdict and all
  feedback of the page, grouped by state.
- **Project** – the same for every page, with a click jumping to the element
  on its page.
- **Im/Export** – download all review data of the project as one deciwa
  file, look into it with **Show**, or load one: the panel shows what is in it (export time, last change,
  entries, authors, sources) before it replaces the current data. With a
  server everything is saved already; without one, this is how a review
  leaves the browser – see [offline review](../integrations/sphinx/workflow.md#offline).

The panel stays open across pages.
