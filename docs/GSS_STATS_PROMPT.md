# Reusable prompt: expose GSS stats from any automation project

Paste everything inside the block below into Claude Code (or any coding agent) while it is open in the
**other** project's codebase. It works for any language/framework.

Before you paste: pick the shared secret. Use the **same** value in every project and in this site's
Railway variable `GSS_STATS_KEY` (generate one with `openssl rand -hex 32`).

````text
Add a read-only "stats" endpoint to this project that reports how much time and money its automation has saved.
It will be polled server-to-server by my main site (Grunewald Strategy & Systems), which adds up the totals
across all my projects. Follow this contract EXACTLY — it must be identical in every project I own.

## Contract

GET /api/gss-stats        (if the framework reserves /api, use /gss-stats and tell me the final path)

Auth: header `Authorization: Bearer <GSS_STATS_KEY>`
  - Read the secret from the environment variable GSS_STATS_KEY. Never hard-code it or log it.
  - Compare with a constant-time comparison (e.g. crypto.timingSafeEqual / hmac.compare_digest).
  - If GSS_STATS_KEY is unset, or the header is missing/wrong, respond 401 `{"error":"unauthorized"}`.
    (Fail closed: an unset key must never mean "open".)

Success: 200, Content-Type application/json, `Cache-Control: no-store`, body:
  {
    "hours_saved": 123.5,      // number, lifetime total, >= 0, up to 2 decimals
    "cost_saved": 4120.75,     // number, lifetime total, >= 0, in `currency`
    "currency": "USD",         // ISO 4217
    "as_of": "2026-11-11T18:30:00Z"   // ISO 8601 UTC, when this was computed
  }

Rules:
  - Aggregate numbers only. NEVER include customer names, order/record data, PII, or per-item detail.
  - Read-only: GET only (other methods -> 405). No side effects, no writes.
  - Must be fast and cheap: compute from existing data/counters with a single query, or cache the result
    in memory for up to 60s. Don't scan large tables on every request.
  - Must not require a user session/login and must not be blocked by this project's auth middleware,
    CSRF protection, or catch-all routes (check for a catch-all that returns HTML — mine are often Next.js).
    CORS is NOT needed (it is called server-to-server); do not enable it.

## How to compute the numbers

1. First look for where this project ALREADY tracks its work (processed records, runs, jobs, shipments,
   emails handled, rows cleaned, etc.). Use that as the source of truth.
2. hours_saved = (lifetime count of automated units) x MINUTES_SAVED_PER_UNIT / 60
3. cost_saved  = hours_saved x HOURLY_RATE
4. Put the assumptions in environment variables with sensible defaults, not in code:
     GSS_MINUTES_SAVED_PER_UNIT   (default: estimate from what the manual task would take — state your estimate)
     GSS_HOURLY_RATE              (default 35)
     GSS_CURRENCY                 (default USD)
   If this project saves money in another way too (e.g. fewer errors, avoided fees) and that is already
   tracked, add it to cost_saved and explain how in a code comment.
5. If nothing is tracked yet, add the smallest possible persistent counter (a single table/row/file/KV key)
   incremented where one unit of work completes successfully, and read it here. Do not backfill invented data.

## Deliverables

- The endpoint, in this project's existing style and framework (no new dependencies unless unavoidable).
- A small test (or a curl example if there is no test setup) covering: 401 with no key, 401 with wrong key,
  200 with correct key and the exact response shape above.
- Add GSS_STATS_KEY, GSS_MINUTES_SAVED_PER_UNIT, GSS_HOURLY_RATE and GSS_CURRENCY to .env.example / README.
- When done, tell me: the final endpoint path, the env vars I must set on the host (Railway), how you derived
  hours_saved and cost_saved, and any assumption I should double-check.
````

## Then, on this site

Add the project to the `GSS_SOURCES` variable in Railway (JSON array, one entry per project):

```json
[
  {"name": "Shipment Automation", "url": "https://shipment-automation-production.up.railway.app/api/gss-stats"},
  {"name": "Next Project",        "url": "https://next-project.up.railway.app/api/gss-stats"}
]
```

Test a project directly:

```bash
curl -H "Authorization: Bearer $GSS_STATS_KEY" https://<project>.up.railway.app/api/gss-stats
```
