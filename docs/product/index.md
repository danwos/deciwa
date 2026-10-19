# What deciwa is

deciwa is a review and decision tool for everyone who works with docs and
code ({need}`DEC_PURPOSE`). You point at any element of a doc, website or
source file and say what you think of it – deciwa keeps that tied to exactly
that element, notices when the element changes, and shows at any time what is
confirmed, open or frozen.

deciwa collects, evaluates and shows; it does not watch that decisions are
kept ({need}`DEC_NO_ENFORCING`). Doing the work is the job of the AI or the
developer.

## How a review goes

1. **Open the result** – the built docs page, the website, the file in your
   editor – and switch review on.
2. **Point and decide** – hover an element, press a key: approve, reject,
   approve & freeze, delete; add stars and a comment if you like.
3. **Let the work happen** – an AI agent or a developer picks up the open
   jobs, changes the text and marks the jobs as done.
4. **See what changed** – an approved text that was changed since shows up
   as `stale`; a frozen one that was changed raises an alarm.
5. **Track coverage** – the panel shows per page and for the whole project
   how many of the elements that must be approved are approved.

## Not deciwa

| Task | Who does it |
|---|---|
| Making or checking the change itself | AI agent or developer |
| Testing whether code follows a decision | quawa, normal tests |
| Managing facts and generating views from them | faktwerk |
