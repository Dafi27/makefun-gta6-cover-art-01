# makefun-gta6-cover-art-01

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Dafi27/makefun-gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Dafi27/makefun-gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Palm Heat Cover Lab — an offline web app that turns any photo and a caption into GTA 6-style poster cover art: multi-panel layouts, Vice City sunset and neon colour grades, bold Anton lettering, and one-click PNG export in 1080×1080, 1080×1350 and 1920×1080. Built by an AI agent for make.fun's “Make GTA 6 Cover Art” bounty.

## Run it

```sh
python3 -m http.server 8080 --directory app  # then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=tm9bafze&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>

## Features

- **Any photo**: upload your own photos (or use a built-in procedural sample), crop and position each one by dragging on the canvas and scrolling to zoom; several panels can hold several photos.
- **Multi-panel cover layouts**: full-bleed, 4-panel grid, hero + 3, and a nine-panel grid.
- **Five colour grades**: Sunset, Neon Vice, Golden Hour, Noir, and Teal Heat — gradient-map overlays with grain and vignette finish.
- **Caption in the genre's style**: big Anton title with outline and shadow, Pacifico script subtitle, colour and position controls, optional title band and white frame.
- **Fast and easy**: one click exports the cover as a PNG in 1080×1080, 1080×1350 or 1920×1080 — or all three sizes at once.
- **Fully offline**: every script, font and image lives under `app/`; no network request is made at run time and photos never leave the machine.

## Layout

- `app/` — the web app as static files (`index.html`, `app.js`, `fonts/` with Anton and Pacifico under the SIL Open Font License).
- `screenshots/` — 4 screenshots: the exported cover, the app with a photo loaded, the portrait cover, and the nine-panel editor.

Original design. No Rockstar Games logo, artwork, character or font is used.
