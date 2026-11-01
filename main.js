(() => {
  const root = document.documentElement;
  const body = document.body;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const fmt = (n, sep) => (sep ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));
  const finalNum = n => fmt(+n.dataset.count, n.dataset.sep);

  // Live "costs saved / hours saved" totals. List the JSON endpoints of the back ends to add up, each returning
  // {"hours": 60, "money": 1750}; the page sums them. Empty = keep the fallback numbers written in index.html.
  // (Endpoints must be public, read-only, aggregate-only and allow CORS for this site.)
  const GSS_LIVE_URLS = [];
  const LIVE_POLL_MS = 60000;
  const fetchLive = () => Promise.all(GSS_LIVE_URLS.map(u => fetch(u, { headers: { Accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : Promise.reject())).catch(() => null)))
    .then(all => {
      const got = all.filter(Boolean);
      if (!got.length) return false;
      let changed = false;
      $$('[data-live-key]').forEach(n => {
        const v = got.reduce((sum, d) => sum + (Number(d[n.dataset.liveKey]) || 0), 0);
        if (+n.dataset.count !== v) { n.dataset.count = v; changed = true; }
        const tag = $('.live-tag', n.closest('[data-live-card]') || document); if (tag) tag.hidden = false;
      });
      return changed;
    });
  const liveReady = GSS_LIVE_URLS.length ? fetchLive().catch(() => {}) : Promise.resolve();

  // Static fallback: reduced motion, or GSAP failed to load → plain scrolling page.
  if (!root.classList.contains('js') || !window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    body.classList.remove('is-loading');
    const c = $('.curtain'); if (c) c.remove();
    liveReady.then(() => $$('.num').forEach(n => (n.textContent = finalNum(n))));
    $$('.num').forEach(n => (n.textContent = finalNum(n)));
    $('#year').textContent = new Date().getFullYear();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  $('#year').textContent = new Date().getFullYear();

  const panes = $$('.sec');
  const N = panes.length;
  $('.rail__total').textContent = String(N).padStart(2, '0');
  const gutter = () => parseFloat(getComputedStyle(root).getPropertyValue('--gutter')) || 0;

  /* ---------- text splitting ---------- */
  const wrapWords = el => {
    let i = 0;
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(' '));
          const w = document.createElement('span'); w.className = 'w';
          const s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
          w.appendChild(s); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(el);
  };
  $$('.split-words').forEach(wrapWords);

  const titleEl = $('[data-chars]');
  const chars = [...titleEl.textContent].map(ch => {
    const s = document.createElement('span'); s.className = 'c'; s.textContent = ch; return s;
  });
  titleEl.textContent = ''; chars.forEach(c => titleEl.appendChild(c));

  // stagger delay for reveal items inside each pane

  /* ---------- initial states ---------- */
  gsap.set(chars, { yPercent: 115, rotate: 6 });
  gsap.set(['.hero .eyebrow', '.hero__trio li', '.scroll-cue', '.hero__dot'], { opacity: 0, y: 30 });
  gsap.set('.rail', { opacity: 0 });

  /* ---------- intro curtain ---------- */
  const strips = $$('.curtain__strip');
  const badge = $('.curtain__badge');
  gsap.set(badge, { scale: 0.9 });
  gsap.timeline({ defaults: { ease: 'power4.inOut' } })
    .set(strips, { scaleY: 1, transformOrigin: 'top' })
    .to(badge, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.1)
    .to(badge, { opacity: 0, y: -30, duration: 0.5, ease: 'power2.in' }, 1.2)
    .set(strips, { transformOrigin: 'bottom' }, 1.5)
    .to(strips, { scaleY: 0, duration: 1.0, stagger: 0.07 }, 1.5)
    .add(() => { body.classList.remove('is-loading'); heroIn(); }, 1.9);

  function heroIn() {
    panes[0].classList.add('is-seen');
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .to('.hero .eyebrow', { opacity: 1, y: 0, duration: 1 }, 0.1)
      .to(chars, { yPercent: 0, rotate: 0, duration: 1.4, stagger: 0.055 }, 0.35)
      .to('.hero__dot', { opacity: 1, y: 0, duration: 0.8 }, 1.1)
      .to('.hero__trio li', { opacity: 1, y: 0, duration: 1, stagger: 0.12 }, 1.0)
      .to('.scroll-cue', { opacity: 1, y: 0, duration: 1 }, 1.4)
      .to('.rail', { opacity: 1, duration: 1 }, 1.4);
  }

  /* ---------- ambient (kept calm) ---------- */
  gsap.to('.hero__rings', { rotation: 360, duration: 160, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
  gsap.to('.hero__rings g:first-child circle', { scale: 1.05, duration: 5, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.6 });
  gsap.to('.contact__rings svg', { rotation: 360, duration: 220, repeat: -1, ease: 'none' });
  gsap.to('.marquee__track', { xPercent: -50, duration: 60, repeat: -1, ease: 'none' });

  const glowX = gsap.quickTo('.hero__glow', 'x', { duration: 1.4, ease: 'power3' });
  const glowY = gsap.quickTo('.hero__glow', 'y', { duration: 1.4, ease: 'power3' });
  gsap.set('.hero__glow', { x: innerWidth * 0.7, y: innerHeight * 0.4 });
  addEventListener('pointermove', e => { if (activeIdx === 0) { glowX(e.clientX); glowY(e.clientY); } });

  /* ---------- the pane engine ----------
     One master timeline, driven by scroll distance (eased gently, never snapped), runs the whole site:
       slide-in  →  content plays (scrub: reverses when you scroll back)  →  in-pane scroll  →  margin  →  next slide.
     Everything inside a pane (headline, cards, counters, chart, quote) is a tween on this timeline,
     so it moves with the scrollbar in both directions. */
  const T = 0.9;        // slide length, in timeline units (1 unit = 1.1 screen heights of scroll)
  const IN_PANE = 0.5;
  const IN_PANE_WHAT = 0.65; // the long case-study track scrolls a touch faster so it doesn't drag  // in-pane scrolling (cards, tall content) moves at half speed: 2px of scroll per 1px of travel
  const MARGIN = 0.25;  // breathing room after a pane finishes, before the next one slides up
  const DWELL = { results: 1.0, what: 0.35, problem: 0.9, philosophy: 1.0, team: 0.6, contact: 0.5 };
  let tl, unit, rest = [], total = 1, activeIdx = 0;
  let resizeT;

  function setActive(i) {
    if (i === activeIdx) return;
    activeIdx = i;
    const idx = $('.index__now');
    if (idx.textContent !== panes[i].dataset.label) {
      gsap.fromTo(idx, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
      idx.textContent = panes[i].dataset.label;
    }
  }

  // scroll-linked content for one pane: every piece gets a slice [a, b] of the pane's content window
  function addContent(pane, cs, L) {
    const P = f => cs + f * L;
    const seq = (els, from, to, a, b, ease = 'power2.out') => {
      if (!els.length) return;
      const span = (b - a) * L, dur = span * 0.55, each = els.length > 1 ? (span - dur) / (els.length - 1) : 0;
      tl.fromTo(els, from, { ...to, duration: dur, ease, stagger: each }, P(a));
    };
    const words = $$('.split-words:not(.quote) .w > span', pane);
    seq(words, { yPercent: 112 }, { yPercent: 0 }, 0, 0.3);

    const qm = $$('.quote-mark', pane);
    seq(qm, { opacity: 0, y: 30 }, { opacity: 1, y: 0 }, 0, 0.15);

    const fades = $$('.fade-up', pane).filter(el => !el.classList.contains('quote__by'));
    seq(fades, { opacity: 0, y: 44 }, { opacity: 1, y: 0 }, 0.15, 0.6);

    $$('.quote .w > span', pane).forEach((w, k, all) =>
      tl.fromTo(w, { opacity: 0.12 }, { opacity: 1, duration: (0.7 * L) / all.length * 2, ease: 'none' }, P(0.2) + (k / all.length) * 0.7 * L));
    seq($$('.quote__by', pane), { opacity: 0, y: 30 }, { opacity: 1, y: 0 }, 0.88, 1);

    $$('.chart__line', pane).forEach(path => {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      tl.fromTo(path, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.6 * L, ease: 'none' }, P(0.25));
    });
    seq($$('.chart__dots, .chart__tag', pane), { opacity: 0 }, { opacity: 1 }, 0.82, 1, 'none');
    $$('.why__half--yes', pane).forEach(el =>
      tl.fromTo(el, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.4 * L, ease: 'power2.inOut' }, P(0.4)));

    $$('.num', pane).forEach(n => {
      const end = +n.dataset.count, o = { v: 0 };
      n.textContent = fmt(0, n.dataset.sep);
      tl.fromTo(o, { v: 0 }, { v: end, duration: 0.7 * L, ease: 'power1.out', onUpdate: () => (n.textContent = fmt(o.v, n.dataset.sep)) }, P(0.3));
    });
  }

  // The case-study mock-ups animate as their panel travels into view (scroll-linked, reversible)
  function addShowcase(track, t0, span, dist) {
    const trackLeft = track.getBoundingClientRect().left;
    const W = innerWidth, rs = t0 - DWELL.what - 0;
    const win = el => {
      const left = el.getBoundingClientRect().left - trackLeft;
      const s = Math.max(rs + 0.05, t0 + span * ((left - 0.92 * W) / dist));
      const e = Math.max(s + 0.12, t0 + span * ((left - 0.4 * W) / dist));
      return [s, e - s];
    };
    const seq = (els, from, to, s, d, ease = 'power2.out') => {
      if (!els.length) return;
      const dur = d * 0.55, each = els.length > 1 ? (d - dur) / (els.length - 1) : 0;
      tl.fromTo(els, from, { ...to, duration: dur, ease, stagger: each }, s);
    };
    const mini = (el, s, d) => {
      const end = +el.dataset.mini, o = { v: 0 }, suf = el.dataset.suffix || '';
      el.textContent = '0' + suf;
      tl.fromTo(o, { v: 0 }, { v: end, duration: d, ease: 'none', onUpdate: () => (el.textContent = Math.round(o.v) + suf) }, s);
    };
    $$('.panel--show', track).forEach(p => {
      const [s, d] = win(p);
      switch (p.dataset.show) {
        case 'inbox':
          seq($$('.mrow', p), { opacity: 0, x: 40 }, { opacity: 1, x: 0 }, s, d);
          mini($('.mini-count', p), s, d); break;
        case 'read':
          seq($$('.hl', p), { scaleX: 0 }, { scaleX: 1 }, s, d * 0.6, 'none');
          seq($$('.fld', p), { opacity: 0, x: 24 }, { opacity: 1, x: 0 }, s + d * 0.4, d * 0.6); break;
        case 'track':
          seq($$('.tick.m-a', p), { scale: 0 }, { scale: 1 }, s, d, 'back.out(2)');
          tl.fromTo($('.pbar i', p), { scaleX: 0 }, { scaleX: 1, duration: d, ease: 'none' }, s);
          mini($('.mini-count', p), s, d); break;
        case 'act':
          seq($$('.act', p), { opacity: 0, y: 24 }, { opacity: 1, y: 0 }, s, d); break;
      }
    });
    const out = $('.panel--out', track);
    if (out) { const [s, d] = win(out); seq($$('.out__line', out), { opacity: 0, y: 30 }, { opacity: 1, y: 0 }, s, d); }
  }

  function build() {
    const prevProgress = tl ? tl.progress() : 0;
    if (tl) { tl.scrollTrigger.kill(); tl.kill(); }
    gsap.set(panes, { clearProps: 'transform' });
    gsap.set('.pane-inner', { clearProps: 'transform' });
    gsap.set('.hscroll__track', { clearProps: 'transform' });
    gsap.set($$('.fade-up, .quote-mark, .chart__dots, .chart__tag, .why__half--yes, .quote .w > span, .m-a, .split-words:not(.quote):not(.hero__lead) .w > span', $('.stage')), { clearProps: 'all' });

    unit = innerHeight * 1.1;
    const isMobile = matchMedia('(max-width: 700px)').matches;
    tl = gsap.timeline({ defaults: { ease: 'none' } });
    rest = [];
    let t = 0;

    panes.forEach((pane, i) => {
      if (i > 0) {
        const start = t + MARGIN;
        gsap.set(pane, { yPercent: 115 });
        tl.fromTo(pane, { yPercent: 115 }, { yPercent: 0, duration: T, ease: 'none', immediateRender: false }, start);
        tl.to(panes[i - 1], { yPercent: -14, duration: T, ease: 'none' }, start);
        t = start + T;
      }
      const rs = t;
      const D = DWELL[pane.id] || 0;
      if (D) addContent(pane, rs - T * 0.5, T * 0.5 + D);
      t = rs + D;
      // then in-pane scrolling: the horizontal cards, or any content taller than the screen
      const inner = $('.pane-inner', pane);
      const overflow = Math.max(0, inner.scrollHeight - innerHeight);
      const track = pane.id === 'what' && !isMobile ? $('.hscroll__track') : null;
      let span = 0;
      if (track) {
        const dist = Math.max(0, track.scrollWidth - (innerWidth - 84));
        span = dist / (unit * IN_PANE_WHAT);
        tl.to(track, { x: -dist, duration: span }, t);
        addShowcase(track, t, span, dist);
        tl.to('.hscroll__bgtext', { x: -dist * 0.2, duration: span }, t);
      } else if (overflow > 40) {
        span = overflow / (unit * IN_PANE);
        tl.to(inner, { y: -overflow, duration: span }, t);
      }
      rest.push({ rs, ready: rs + D });
      t += span;
    });
    total = t;
    tl.set({}, {}, total); // pad to exact length

    const space = $('#space');
    space.style.height = (total * unit + innerHeight) + 'px';

    ScrollTrigger.create({ animation: tl, trigger: space, start: 'top top', end: 'bottom bottom', scrub: 1 });

    tl.eventCallback('onUpdate', () => {
      const time = tl.time();
      let a = 0;
      for (let i = 1; i < N; i++) if (time >= rest[i].rs - T * 0.5) a = i;
      setActive(a);
      gsap.set('.index__line i', { scaleY: tl.progress() });
    });

    if (prevProgress) scrollTo(0, prevProgress * total * unit);
    ScrollTrigger.refresh();
    tl.time(tl.scrollTrigger.progress * total);
  }

  const start = () => liveReady.then(build);
  if (GSS_LIVE_URLS.length) setInterval(() => fetchLive().then(ch => { if (ch) build(); }).catch(() => {}), LIVE_POLL_MS);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else addEventListener('load', start);
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(build, 250); });

  /* ---------- page-transition jumps (rail buttons) ---------- */
  let jumping = false;
  $$('[data-jump]').forEach(a => a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    const i = panes.indexOf(target);
    if (i < 0 || !tl) return;
    e.preventDefault();
    if (jumping || i === activeIdx) return;
    jumping = true;
    gsap.timeline({ onComplete: () => { jumping = false; } })
      .set(strips, { transformOrigin: 'top' })
      .set('.curtain', { pointerEvents: 'auto' })
      .to(strips, { scaleY: 1, duration: 0.7, ease: 'power4.inOut', stagger: 0.06 })
      .add(() => {
        const time = rest[i].ready;
        scrollTo(0, time * unit);
        tl.time(time);
        history.replaceState(null, '', a.getAttribute('href'));
      })
      .set(strips, { transformOrigin: 'bottom' })
      .to(strips, { scaleY: 0, duration: 0.8, ease: 'power4.inOut', stagger: 0.06 }, '+=0.1')
      .set('.curtain', { pointerEvents: 'none' });
  }));

  /* ---------- magnetic buttons ---------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.magnetic').forEach(el => {
      const mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
      const my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.3); my((e.clientY - r.top - r.height / 2) * 0.4);
      });
      el.addEventListener('pointerleave', () => { mx(0); my(0); });
    });
  }
})();
