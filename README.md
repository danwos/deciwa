# deciwa

decision watcher – a review and decision tool for elements in docs, websites
and code. Concept and decisions live in Daniel's brain
(`danwos/20_facts/projects/deciwa/`).

## mockups/

- `feedback-ui.html` – clickable prototype of the feedback UI. Serve the
  folder (`python3 -m http.server 4330 --directory mockups`) and open
  `http://localhost:4330/feedback-ui.html`.
  - URL parameters for fixed states (screenshots): `clean`, `shot`,
    `theme`, `file`, `mode`, `variant`, `open`, `rating`, `comment`, `scroll`.
  - `?demo=de|en` plays the scripted walk-through used for the product video.
- `record-demo.mjs` – records the demo as MP4, GIF and poster image
  (needs google-chrome and ffmpeg): `node mockups/record-demo.mjs de ./out`.
- `assets/` – downscaled deciwa pictures from the brain's branding assets.
