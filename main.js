(() => {
  const root = document.documentElement;
  const body = document.body;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const fmt = (n, sep) => (sep ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));
  const finalNum = n => fmt(+n.dataset.count, n.dataset.sep);

  // Live "time saved / money saved" feed. Set to your dashboard endpoint returning
  // JSON like {"hours": 60, "money": 1750}. Empty = keep the static fallback numbers in index.html.
  const GSS_LIVE_URL = '';
  const liveReady = !GSS_LIVE_URL ? Promise.resolve() : fetch(GSS_LIVE_URL, { headers: { Accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(d => $$('[data-live-key]').forEach(n => {
      const v = Number(d[n.dataset.liveKey]);
      if (!isFinite(v)) return;
      n.dataset.count = v;
      const tag = $('.live-tag', n.parentElement); if (tag) tag.hidden = false;
    }))
    .catch(() => {});

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
     One master timeline, driven 1:1 by scroll distance (no smoothing, no snapping), runs the whole site:
       slide-in  →  content plays (scrub: reverses when you scroll back)  →  in-pane scroll  →  margin  →  next slide.
     Everything inside a pane (headline, cards, counters, chart, quote) is a tween on this timeline,
     so it moves with the scrollbar in both directions. */
  const T = 0.9;        // slide length, in timeline units (1 unit = 0.8 screen heights of scroll)
  const MARGIN = 0.25;  // breathing room after a pane finishes, before the next one slides up
  const DWELL = { problem: 0.9, philosophy: 1.0, what: 0.35, team: 0.6, why: 0.7, experience: 1.0, testimonial: 1.5, contact: 0.5 };
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

  function build() {
    const prevProgress = tl ? tl.progress() : 0;
    if (tl) { tl.scrollTrigger.kill(); tl.kill(); }
    gsap.set(panes, { clearProps: 'transform' });
    gsap.set('.pane-inner', { clearProps: 'transform' });
    gsap.set('.hscroll__track', { clearProps: 'transform' });
    gsap.set($$('.fade-up, .quote-mark, .chart__dots, .chart__tag, .why__half--yes, .quote .w > span, .split-words:not(.quote):not(.hero__lead) .w > span', $('.stage')), { clearProps: 'opacity,transform,clipPath' });

    unit = innerHeight * 0.8;
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
        const dist = Math.max(0, track.scrollWidth - innerWidth + gutter());
        span = dist / unit;
        tl.to(track, { x: -dist, duration: span }, t);
        tl.to('.hscroll__bgtext', { x: -dist * 0.2, duration: span }, t);
      } else if (overflow > 40) {
        span = overflow / unit;
        tl.to(inner, { y: -overflow, duration: span }, t);
      }
      rest.push({ rs, ready: rs + D });
      t += span;
    });
    total = t;
    tl.set({}, {}, total); // pad to exact length

    const space = $('#space');
    space.style.height = (total * unit + innerHeight) + 'px';

    ScrollTrigger.create({ animation: tl, trigger: space, start: 'top top', end: 'bottom bottom', scrub: true });

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
