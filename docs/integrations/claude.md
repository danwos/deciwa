# Claude

Claude works on your feedback and asks its questions where they belong – at
the element, not in the chat.

## Today

With the prototype, ask Claude in the repository to work through the
feedback. Claude then

1. runs `deciwa todo` and reads every open job and question,
2. changes the sources – applies comments, fixes rejected statements,
   removes elements marked for deletion, never touches frozen ones,
3. marks each job as done with `deciwa resolve <id> --note "…"`,
4. asks back on the element when something is unclear:

   ```console
   $ deciwa request docs/guide.md sphinx-needs:REQ_042 \
       --to daniel --question "Is 30 days the right limit?" --author agent:claude
   ```

   The question appears in the card of that element; answer it there.

## Agent skills (0.1)

`deciwa-work` and `deciwa-ask` package these steps, so Claude does them
without extra prompting – see [CLI and agent skills](../product/cli.md).

## Claude UI (later)

Go through a file together with Claude inside the chat, with the same card
and states.
