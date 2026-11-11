# Grunewald Strategy & Systems — site

Static one-page site (no build step). Open `index.html`, or serve the folder: `python3 -m http.server`.

- `index.html` — content/markup
- `styles.css` — brand tokens (`--maroon #450404`, `--gold #B8860B`, white) + layout
- `main.js` — GSAP/ScrollTrigger animation (intro curtain, section transitions, pinned horizontal scroll, counters)
- `vendor/` — GSAP 3.12.5 + ScrollTrigger (vendored, no CDN dependency)
- `assets/` — logo files

## Live stats backend (Railway)

`server.js` (zero dependencies, `npm start`) serves the site and `GET /api/stats`, which pulls
`hours_saved` / `cost_saved` from each automation project and returns the summed totals the Results section shows.
Results are cached 60s; if a project is down its last good numbers are kept so totals never dip, and if nothing
is reachable the page keeps the fallback numbers in `index.html`.

Railway variables: `GSS_SOURCES` (JSON array of `{name,url}`), `GSS_STATS_KEY` (shared secret),
optional `GSS_ADMIN_KEY` (enables `GET /api/stats/detail`, per-project breakdown, for the future portal).
To connect another project, paste `docs/GSS_STATS_PROMPT.md` into it, then add it to `GSS_SOURCES`.
