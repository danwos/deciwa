# What deciwa is

deciwa is a review and decision tool for everyone who works with docs and
code ({need}`DEC_PURPOSE`). You point at any element of a doc, website or
source file and say what you think of it – deciwa keeps that tied to exactly
that element, notices when the element changes, and shows at any time what is
confirmed, open or frozen.

deciwa collects, evaluates and shows; it does not watch that decisions are
kept ({need}`DEC_NO_ENFORCING`). Doing the work is the job of the AI or the
developer.

## Where it came from

Daniel needed a simple way to review content and agree to statements in his
own knowledge base – today that happens with `[CHECK]` markers in the text
and a feedback toolbar on the website. deciwa replaces both; Daniel's own
work is the first user.

## Not deciwa

| Task | Who does it |
|---|---|
| Making or checking the change itself | AI agent or developer |
| Testing whether code follows a decision | quawa, normal tests |
| Managing facts and generating views from them | faktwerk |

## Prototype

A clickable prototype of the feedback UI lives in `mockups/feedback-ui.html`
(see the repository README). It shows the feedback card, quality stars, AI
questions, a stale approval in Sphinx-Needs docs and a freeze alarm in
Python.
