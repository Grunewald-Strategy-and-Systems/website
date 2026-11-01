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

  /* ---------- "See the Work" pop-up ----------
     Slides in from the right; scrolling inside it walks through the steps (each scene animates as it
     reaches the middle of the screen, in both directions). Reaching the bottom closes it. */
  function initWork(useGsap) {
    const modal = $('#work'); if (!modal) return;
    const panel = $('.work__panel', modal);
    const clamp01 = v => Math.min(1, Math.max(0, v));
    const fmtN = (n, sep) => (sep ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));
    let scenes = [], closeTimer = null, isOpen = false;

    const build = () => {
      if (!useGsap || scenes.length) return;
      const mk = () => gsap.timeline({ paused: true, defaults: { ease: 'none' } });
      const seq = (tl, els, from, to, at, span, ease = 'power2.out') => {
        if (!els.length) return;
        const dur = span * 0.55, each = els.length > 1 ? (span - dur) / (els.length - 1) : 0;
        tl.fromTo(els, from, { ...to, duration: dur, ease, stagger: each }, at);
      };
      const rnd = (i, n) => { const x = Math.sin(i * 91.7 + n * 12.9) * 43758.5453; return x - Math.floor(x); };
      $$('[data-scene]', modal).forEach(el => {
        const tl = mk(), vis = $('.scene__vis', el) || $$('.out__line', el)[1] || el;
        switch (el.dataset.scene) {
          case 'problem': {
            const flies = $$('.fly', el), counts = $$('.count', el), tray = $('.tray', el);
            const R = Math.max(el.clientWidth * 0.5, 260);
            flies.forEach((f, i) => {
              const a = rnd(i, 1) * Math.PI * 2, d = R * (0.8 + rnd(i, 2) * 0.5);
              const sx = Math.cos(a) * d, sy = -Math.abs(Math.sin(a)) * d * 0.9 - 40;
              const at = 0.04 + (i / flies.length) * 0.78;
              tl.fromTo(f, { x: sx, y: sy, rotation: (rnd(i, 3) - 0.5) * 80, scale: 1.25 },
                { x: 0, y: 56, rotation: 0, scale: 0.4, duration: 0.2, ease: 'power2.in' }, at)
                .fromTo(f, { opacity: 0 }, { opacity: 1, duration: 0.03 }, at)
                .to(f, { opacity: 0, duration: 0.03 }, at + 0.17);
            });
            const o = { v: 0 };
            tl.fromTo(o, { v: 0 }, { v: 200, duration: 0.95, ease: 'power3.in', onUpdate: () => counts.forEach(c => (c.textContent = fmtN(o.v))) }, 0);
            tl.fromTo(tray, { scale: 1 }, { scale: 1.14, duration: 0.95, ease: 'power2.in' }, 0);
            const ring = $('.tray__ring', el);
            tl.fromTo(ring, { scale: 0.6, opacity: 0.1 }, { scale: 1.6, opacity: 0.6, duration: 0.95, ease: 'power2.in' }, 0);
            counts.forEach(c => (c.textContent = '0'));
            break;
          }
          case 'chaos': {
            const chips = $$('.chip', el);
            chips.forEach((c, i) => {
              const sx = (rnd(i, 5) - 0.5) * 700, sy = 260 + rnd(i, 6) * 220;
              tl.fromTo(c, { x: sx, y: sy, rotation: (rnd(i, 7) - 0.5) * 120, opacity: 0 },
                { x: 0, y: 0, rotation: +c.dataset.rot, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.03 + (i / chips.length) * 0.5);
            });
            break;
          }
          case 'divider':
            seq(tl, $$('.divider__line', el), { scaleX: 0 }, { scaleX: 1 }, 0.1, 0.8, 'power2.out'); break;
          case 'read':
            seq(tl, $$('.hl', el), { scaleX: 0 }, { scaleX: 1 }, 0, 0.55, 'none');
            seq(tl, $$('.fld', el), { opacity: 0, x: 24 }, { opacity: 1, x: 0 }, 0.35, 0.65); break;
          case 'track': {
            seq(tl, $$('.tick.m-a', el), { scale: 0 }, { scale: 1 }, 0, 1, 'back.out(2)');
            tl.fromTo($('.pbar i', el), { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
            const m = $('.mini-count', el), o = { v: 0 }, suf = m.dataset.suffix || '';
            tl.fromTo(o, { v: 0 }, { v: +m.dataset.mini, duration: 1, onUpdate: () => (m.textContent = Math.round(o.v) + suf) }, 0);
            m.textContent = '0' + suf; break;
          }
          case 'act': seq(tl, $$('.act', el), { opacity: 0, y: 24 }, { opacity: 1, y: 0 }, 0, 1); break;
          case 'out': seq(tl, $$('.out__line', el), { opacity: 0, y: 30 }, { opacity: 1, y: 0 }, 0, 1); break;
        }
        scenes.push({ el, vis, tl });
      });
    };

    // a card rises into place as it nears the middle; its animation plays as its visual reaches the middle
    const parts = $$('.work__steps span', modal), prog = $('.work__prog i', modal);
    const divider = $('[data-part-start]', modal);
    const update = () => {
      const H = panel.clientHeight, top = panel.getBoundingClientRect().top;
      $$('.wcard', modal).forEach(card => {
        const r = card.getBoundingClientRect(), c = r.top - top + r.height / 2;
        const q = clamp01((H * 1.05 - c) / (H * 0.5));
        card.style.transform = `translateY(${(1 - q) * 70}px) scale(${0.93 + 0.07 * q})`;
        card.style.opacity = 0.35 + 0.65 * q;
      });
      scenes.forEach(s => {
        const r = s.vis.getBoundingClientRect();
        const center = r.top - top + r.height / 2;
        s.tl.progress(clamp01((H * 0.96 - center) / (H * 0.4)));
      });
      if (divider) {
        const dr = divider.getBoundingClientRect(), solution = dr.top - top + dr.height / 2 < H * 0.55;
        parts.forEach(p => p.classList.toggle('is-on', (p.dataset.part === 'solution') === solution));
      }
      const max = panel.scrollHeight - panel.clientHeight;
      prog.style.transform = `scaleX(${max > 0 ? panel.scrollTop / max : 0})`;
      const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 3;
      if (isOpen && atBottom && panel.scrollTop > 40) { if (!closeTimer) closeTimer = setTimeout(close, 1600); }
      else if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    };

    const open = () => {
      if (isOpen) return;
      isOpen = true;
      modal.hidden = false;   // build while visible: GSAP re-parents hidden elements while measuring them
      build();
      root.classList.add('work-open');
      panel.scrollTop = 0;
      update();
      requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
      panel.focus({ preventScroll: true });
    };
    function close() {
      if (!isOpen) return;
      isOpen = false;
      clearTimeout(closeTimer); closeTimer = null;
      modal.classList.remove('is-open');
      root.classList.remove('work-open');
      setTimeout(() => { if (!isOpen) { modal.hidden = true; panel.scrollTop = 0; update(); } }, 950);
    }

    panel.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', () => { if (isOpen) update(); });
    $$('[data-open-work]').forEach(b => b.addEventListener('click', open));
    $$('[data-close-work]', modal).forEach(b => b.addEventListener('click', close));
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  // Static fallback: reduced motion, or GSAP failed to load → plain scrolling page.
  if (!root.classList.contains('js') || !window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    body.classList.remove('is-loading');
    const c = $('.curtain'); if (c) c.remove();
    liveReady.then(() => $$('.num').forEach(n => (n.textContent = finalNum(n))));
    initWork(false);
    $$('.num').forEach(n => (n.textContent = finalNum(n)));
    $('#year').textContent = new Date().getFullYear();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  initWork(true);
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
  const IN_PANE = 0.5;  // in-pane scrolling (cards, tall content) moves at half speed: 2px of scroll per 1px of travel
  const IN_PANE_WHAT = 0.5;
  const MARGIN = 0.25;  // breathing room after a pane finishes, before the next one slides up
  const DWELL = { results: 1.0, what: 0.35, philosophy: 1.0, team: 0.6, contact: 0.5 };
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
      n.style.minWidth = '';
      n.textContent = fmt(end, n.dataset.sep);
      n.style.minWidth = n.getBoundingClientRect().width + 'px';   // reserve the final width so nothing wobbles
      n.textContent = fmt(0, n.dataset.sep);
      tl.fromTo(o, { v: 0 }, { v: end, duration: 0.7 * L, ease: 'power1.out', onUpdate: () => (n.textContent = fmt(o.v, n.dataset.sep)) }, P(0.3));
    });
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
      if (D) addContent(pane, rs - T * 0.15, T * 0.15 + D);
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
