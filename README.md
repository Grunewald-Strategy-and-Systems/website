# Grunewald Strategy & Systems — site

Static one-page site (no build step). Open `index.html`, or serve the folder: `python3 -m http.server`.

- `index.html` — content/markup
- `styles.css` — brand tokens (`--maroon #450404`, `--gold #B8860B`, white) + layout
- `main.js` — GSAP/ScrollTrigger animation (intro curtain, section transitions, pinned horizontal scroll, counters)
- `vendor/` — GSAP 3.12.5 + ScrollTrigger (vendored, no CDN dependency)
- `assets/` — logo files
