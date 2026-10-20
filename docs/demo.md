# Demo

There is nothing to install: deciwa already runs on these docs. Every page
here is the demo – give feedback on any text, requirement or picture you
see.

You start it with the round **deciwa logo at the bottom right**. Hover it (on
a phone: tap it) and switch on **Review**. From then on every element you
point at gets an outline and a click opens its feedback card.

Your feedback stays in this browser only – nobody else sees it, and it
survives reloads and page changes. **Im/Export** in the panel downloads it
as a file or resets everything.

More on using it:

- [The review UI](product/ui.md) – the button, the card, the keys and the panel
- [Three ways of working](product/ways-of-working.md) – verdicts, stars and questions from the AI
- {ref}`Offline review <offline>` – how this demo works without a server

## A first round

Everything happens on this page – the example requirements are right below
the steps.

1. **Switch on review** – hover the deciwa logo at the bottom right and turn
   on **Review**.
2. **Approve a requirement** – click {need}`REQ_DEMO_START <REQ_DEMO_START>`
   and press **Approve** (key `a`). The bar beside it and the counter on the
   logo change.
3. **Reject another one** – click {need}`REQ_DEMO_SPEED <REQ_DEMO_SPEED>`,
   write in the comment what is wrong with it and press **Reject**
   (key `r`).
4. **Rate a text** – hover this list or any paragraph and give it stars
   with the keys `0`–`5`.
5. **Select a few words** – mark a few words in
   {need}`REQ_DEMO_WATER <REQ_DEMO_WATER>` and give feedback on just those.
6. **Look at the panel** – switch on **Panel**: **This page** shows how much
   of the page is reviewed and what is still open.
7. **Run a guided review** – press **▶ Guided review** in the panel (or
   `v`): the card jumps from one element without a verdict to the next.
8. **Take it with you** – export your review under **Im/Export** and look at
   it with **Show**.

## Example requirements

A made-up coffee machine, only here to be reviewed.

```{req} The machine is ready for the first coffee 60 seconds after switching on
:id: REQ_DEMO_START
:status: review
```

```{req} A cup of coffee is ready in under 5 seconds
:id: REQ_DEMO_SPEED
:status: review
```

```{req} The machine warns when the water tank holds less than 200 ml, so a full cup can still be made
:id: REQ_DEMO_WATER
:status: review
```

```{req} Every setting can be changed with one hand while holding a cup in the other
:id: REQ_DEMO_ONE_HAND
:status: review
```
