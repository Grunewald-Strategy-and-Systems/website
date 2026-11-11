/* Hero background: a circuit board of arrows.
   Dozens of traces walk a hidden grid, turning only at right angles, each starting at a solder pad and
   ending in an arrowhead. Traces near the pointer light up; a few signal pulses run along them on their own. */
(() => {
  const canvas = document.querySelector('.hero__circuit');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const GOLD = '184,134,11';
  const GLOW = '232,190,90';
  const BASE_ALPHA = 0.26;
  const RADIUS = 120;        // how close the pointer must be to an arrow for it to glow (px)
  const ARROW = 7;           // arrowhead length (px)

  let W = 0, H = 0, dpr = 1, G = 36;
  let traces = [];
  let base = document.createElement('canvas');
  let pointer = null;        // {x, y} in canvas px, or null when away
  let pulses = [];
  let visible = true, raf = 0, lastPulse = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

  function build() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    G = W < 700 ? 28 : 36;

    const cols = Math.floor(W / G) + 1, rows = Math.floor(H / G) + 1;
    const ox = (W - (cols - 1) * G) / 2, oy = (H - (rows - 1) * G) / 2;
    const used = new Uint8Array(cols * rows);
    const free = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !used[r * cols + c];
    const target = Math.max(28, Math.min(110, Math.round((cols * rows) / 13)));

    traces = [];
    for (let tries = 0; traces.length < target && tries < target * 30; tries++) {
      let c = randi(0, cols - 1), r = randi(0, rows - 1);
      if (!free(c, r)) continue;
      let d = randi(0, 3), sinceTurn = 0;
      const nodes = [[c, r]], seen = new Set([r * cols + c]);
      const len = randi(4, 15);
      for (let s = 0; s < len; s++) {
        if (sinceTurn >= 2 && Math.random() < 0.32) { d = (d + (Math.random() < 0.5 ? 1 : 3)) % 4; sinceTurn = 0; }
        let nc = c + DIRS[d][0], nr = r + DIRS[d][1];
        if (!free(nc, nr) || seen.has(nr * cols + nc)) {
          // blocked: try turning once instead of giving up
          const alt = (d + (Math.random() < 0.5 ? 1 : 3)) % 4;
          const ac = c + DIRS[alt][0], ar = r + DIRS[alt][1];
          if (sinceTurn < 1 || !free(ac, ar) || seen.has(ar * cols + ac)) break;
          d = alt; nc = ac; nr = ar; sinceTurn = 0;
        }
        c = nc; r = nr; sinceTurn++;
        nodes.push([c, r]); seen.add(r * cols + c);
      }
      if (nodes.length < 4) continue;
      nodes.forEach(([nc, nr]) => (used[nr * cols + nc] = 1));
      traces.push(makeTrace(nodes.map(([nc, nr]) => [ox + nc * G, oy + nr * G])));
    }
    drawBase();
  }

  // collapse straight runs into corner points, shorten the end to make room for the arrowhead
  function makeTrace(pts) {
    const p = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
      if ((a[0] === b[0]) !== (b[0] === c[0])) p.push(b);
    }
    const end = pts[pts.length - 1], prev = p[p.length - 1];
    const dx = Math.sign(end[0] - prev[0]), dy = Math.sign(end[1] - prev[1]);
    p.push(end);
    const segs = [];
    let length = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < p.length; i++) {
      minX = Math.min(minX, p[i][0]); maxX = Math.max(maxX, p[i][0]);
      minY = Math.min(minY, p[i][1]); maxY = Math.max(maxY, p[i][1]);
      if (i) { const l = Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]); segs.push(l); length += l; }
    }
    return { p, segs, length, dx, dy, glow: 0, box: [minX, minY, maxX, maxY] };
  }

  function path(t, c = ctx) {
    const { p, dx, dy } = t;
    c.beginPath();
    c.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) c.lineTo(p[i][0], p[i][1]);
    const e = p[p.length - 1];
    c.lineTo(e[0] - dx * ARROW * 0.6, e[1] - dy * ARROW * 0.6);
  }

  function ends(t, c) {
    const s = t.p[0], e = t.p[t.p.length - 1], { dx, dy } = t;
    // solder pad
    c.beginPath(); c.arc(s[0], s[1], 3, 0, Math.PI * 2); c.stroke();
    // arrowhead
    const px = -dy, py = dx;
    c.beginPath();
    c.moveTo(e[0] + dx * 2, e[1] + dy * 2);
    c.lineTo(e[0] - dx * ARROW + px * ARROW * 0.6, e[1] - dy * ARROW + py * ARROW * 0.6);
    c.lineTo(e[0] - dx * ARROW - px * ARROW * 0.6, e[1] - dy * ARROW - py * ARROW * 0.6);
    c.closePath(); c.fill();
  }

  function drawBase() {
    base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.lineWidth = 1; b.lineJoin = 'miter'; b.lineCap = 'square';
    b.strokeStyle = `rgba(${GOLD},${BASE_ALPHA})`;
    b.fillStyle = `rgba(${GOLD},${BASE_ALPHA + 0.08})`;
    traces.forEach(t => { path(t, b); b.stroke(); ends(t, b); });
    render();
  }

  function distTo(t, x, y) {
    const [a, b, c, d] = t.box;
    if (x < a - RADIUS || x > c + RADIUS || y < b - RADIUS || y > d + RADIUS) return Infinity;
    let best = Infinity;
    for (let i = 1; i < t.p.length; i++) {
      const [x1, y1] = t.p[i - 1], [x2, y2] = t.p[i];
      const cx = Math.max(Math.min(x1, x2), Math.min(Math.max(x1, x2), x));
      const cy = Math.max(Math.min(y1, y2), Math.min(Math.max(y1, y2), y));
      best = Math.min(best, Math.hypot(x - cx, y - cy));
    }
    return best;
  }

  function pointAt(t, f) {
    let d = f * t.length;
    for (let i = 0; i < t.segs.length; i++) {
      if (d <= t.segs[i] || i === t.segs.length - 1) {
        const [x1, y1] = t.p[i], [x2, y2] = t.p[i + 1], k = t.segs[i] ? Math.min(1, d / t.segs[i]) : 0;
        return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k];
      }
      d -= t.segs[i];
    }
    return t.p[t.p.length - 1];
  }

  function render(now = performance.now()) {
    raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'miter'; ctx.lineCap = 'square';

    let busy = false;
    for (const t of traces) {
      const d = pointer ? distTo(t, pointer.x, pointer.y) : Infinity;
      const target = d < RADIUS ? Math.min(1, (1 - d / RADIUS) * 1.6) : 0;
      t.glow += (target - t.glow) * (reduced ? 1 : target > t.glow ? 0.25 : 0.06);
      if (t.glow < 0.01) { t.glow = 0; continue; }
      if (Math.abs(target - t.glow) > 0.01) busy = true;
      const g = t.glow;
      ctx.shadowColor = `rgba(${GLOW},${g})`;
      ctx.shadowBlur = 14 * g;
      ctx.lineWidth = 1 + g;
      ctx.strokeStyle = `rgba(${GLOW},${0.3 + 0.7 * g})`;
      ctx.fillStyle = ctx.strokeStyle;
      path(t); ctx.stroke(); ends(t, ctx);
    }

    if (!reduced && visible) {
      if (now - lastPulse > 700 && pulses.length < 5 && traces.length) {
        pulses.push({ t: traces[randi(0, traces.length - 1)], start: now, dur: rand(1400, 2400) });
        lastPulse = now;
      }
      ctx.lineCap = 'round';
      pulses = pulses.filter(pu => {
        const f = (now - pu.start) / pu.dur;
        if (f >= 1) return false;
        const fade = Math.min(1, f * 6, (1 - f) * 6);
        const [hx, hy] = pointAt(pu.t, f);
        const tail = Math.max(0, f - 40 / pu.t.length);
        ctx.shadowColor = `rgba(${GLOW},${0.9 * fade})`;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = `rgba(${GLOW},${0.55 * fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) { const [x, y] = pointAt(pu.t, tail + (f - tail) * (k / 8)); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
        ctx.fillStyle = `rgba(${GLOW},${fade})`;
        ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill();
        return true;
      });
      busy = true;
    }
    ctx.shadowBlur = 0;
    if (busy && visible) raf = requestAnimationFrame(render);
  }

  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(render); };

  addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    pointer = x >= -RADIUS && y >= -RADIUS && x <= r.width + RADIUS && y <= r.height + RADIUS ? { x, y } : null;
    kick();
  }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer = null; kick(); });

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) kick(); });

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
  build();
  kick();
})();
