// Grunewald Strategy & Systems — site server (Railway).
//
// Serves the static site AND exposes GET /api/stats, which pulls "hours saved" / "cost saved" from each
// automation project's standard /api/gss-stats endpoint (see docs/GSS_STATS_PROMPT.md), adds them up, and
// returns the totals the Results section displays. Zero dependencies — Node 18+.
//
// Configuration (Railway → Variables):
//   GSS_SOURCES   JSON array of projects to pull from, e.g.
//                 [{"name":"Shipment Automation","url":"https://shipment-automation-production.up.railway.app/api/gss-stats"}]
//                 Each entry may also set "key" (overrides GSS_STATS_KEY) and "enabled": false.
//   GSS_STATS_KEY Shared secret sent to every project as `Authorization: Bearer <key>`.
//   GSS_ADMIN_KEY Optional. Enables GET /api/stats/detail (per-project breakdown) for a future portal.
//   CACHE_TTL_S   Seconds to cache results (default 60).  PORT is set by Railway.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const CACHE_TTL_MS = (Number(process.env.CACHE_TTL_S) || 60) * 1000;
const FETCH_TIMEOUT_MS = 8000;
const STATS_KEY = process.env.GSS_STATS_KEY || '';
const ADMIN_KEY = process.env.GSS_ADMIN_KEY || '';
const ROOT = __dirname;

function loadSources() {
  const raw = process.env.GSS_SOURCES;
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error('must be a JSON array');
    return list.filter(s => s && s.url && s.enabled !== false).map((s, i) => ({
      name: String(s.name || `source-${i + 1}`), url: String(s.url), key: s.key || STATS_KEY,
    }));
  } catch (e) {
    console.error('GSS_SOURCES is not valid JSON:', e.message);
    return [];
  }
}
const SOURCES = loadSources();

/* ---------- stats aggregation ---------- */
const last = new Map();   // source name -> { hours, money, asOf, ok, error, at } (last good values are kept on failure)
let cache = null;         // { at, payload }
let inflight = null;

const num = v => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);

async function pullOne(src) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers = { Accept: 'application/json' };
    if (src.key) headers.Authorization = `Bearer ${src.key}`;
    const res = await fetch(src.url, { headers, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    // Contract: { hours_saved, cost_saved, currency, as_of }
    if (d.hours_saved === undefined && d.cost_saved === undefined) throw new Error('missing hours_saved/cost_saved');
    last.set(src.name, { hours: num(d.hours_saved), money: num(d.cost_saved), currency: d.currency || 'USD',
      asOf: d.as_of || null, ok: true, error: null, at: Date.now() });
  } catch (e) {
    const prev = last.get(src.name);   // keep the last good numbers so one outage never makes the total dip
    last.set(src.name, { ...(prev || { hours: 0, money: 0, currency: 'USD', asOf: null, at: null }),
      ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message });
  } finally { clearTimeout(timer); }
}

async function refresh() {
  await Promise.all(SOURCES.map(pullOne));
  const rows = SOURCES.map(s => ({ name: s.name, ...last.get(s.name) }));
  const counted = rows.filter(r => r.at);   // sources that have succeeded at least once
  const payload = {
    hours: Math.round(counted.reduce((a, r) => a + r.hours, 0) * 100) / 100,
    money: Math.round(counted.reduce((a, r) => a + r.money, 0) * 100) / 100,
    currency: 'USD',
    sources: { total: rows.length, live: rows.filter(r => r.ok).length },
    updated: new Date().toISOString(),
  };
  cache = { at: Date.now(), payload, detail: { ...payload, projects: rows } };
  return cache;
}

async function getStats() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
  if (!inflight) inflight = refresh().finally(() => { inflight = null; });
  return inflight;
}

/* ---------- http ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
// Only these are public — never serve server.js, package.json, .git, docs, etc.
const PUBLIC_FILES = new Set(['index.html', 'main.js', 'chat.js', 'circuit.js', 'styles.css']);
const PUBLIC_DIRS = ['assets', 'vendor'];

const json = (res, code, body, extra = {}) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
};
const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const ok = PUBLIC_FILES.has(rel) || PUBLIC_DIRS.some(d => rel.startsWith(d + '/'));
  const file = path.join(ROOT, rel);
  if (!ok || !file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': rel === 'index.html' ? 'no-cache' : 'public, max-age=3600' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }

    if (pathname === '/healthz') return json(res, 200, { ok: true });

    if (pathname === '/api/stats') {
      if (!SOURCES.length) return json(res, 503, { error: 'no sources configured' });
      const { payload } = await getStats();
      // Nothing has ever succeeded → 503 so the page keeps its fallback numbers instead of showing zeros.
      if (!payload.sources.live && !payload.hours && !payload.money) return json(res, 503, { error: 'sources unavailable' });
      return json(res, 200, payload, { 'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}` });
    }

    if (pathname === '/api/stats/detail') {
      const auth = req.headers.authorization || '';
      if (!ADMIN_KEY || !safeEq(auth, `Bearer ${ADMIN_KEY}`)) return json(res, 401, { error: 'unauthorized' });
      const { detail } = await getStats();
      return json(res, 200, detail);
    }

    serveStatic(req, res, pathname);
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'server error' });
  }
}).listen(PORT, () => console.log(`GSS site on :${PORT} — ${SOURCES.length} stats source(s)`));
