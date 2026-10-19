# UI and integrations

One pattern in every integration; colours and fonts come from the danwos
tokens ({need}`DEC_DANWOS_TOKENS`).

1. **Point** – hover outlines the element; Alt moves one level up; selecting
   text targets single words.
2. **Feedback card** at the element – the default; a side panel is the
   alternative ({need}`DEC_FEEDBACK_CARD`). AI question on top, stars,
   feedback buttons, comment field, history with diff for stale or frozen
   elements.
3. **State** – coloured bars beside each annotated element; a side panel
   lists all annotations of the file with coverage ("x of y elements covered
   by an approval"); a click jumps to the element.
4. **Review mode** (`v`) – walks element by element through a file.

## Integrations

Reviews happen where people already work ({need}`DEC_INTEGRATIONS`).

| Integration | Use |
|---|---|
| VS Code | editor and docs preview – first integration |
| Chrome | any rendered page – docs or website |
| Claude UI | go through a file with the AI; Claude asks its questions in deciwa |
| Desktop app | for people without a development environment |
