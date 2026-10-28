(() => {
  const root = document.documentElement;
  const body = document.body;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const fmt = (n, sep) => (sep ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));
  const finalNum = n => fmt(+n.dataset.count, n.dataset.sep);

  // Static fallback: reduced motion, or GSAP failed to load → plain scrolling page.
  if (!root.classList.contains('js') || !window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    body.classList.remove('is-loading');
    const c = $('.curtain'); if (c) c.remove();
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
  const nav = $('#nav');
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
  panes.forEach(p => $$('.fade-up', p).forEach((el, i) => el.style.setProperty('--d', (0.3 + i * 0.1) + 's')));

  // chart lines start undrawn
  $$('.chart__line').forEach(path => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
  });

  /* ---------- initial states ---------- */
  gsap.set(chars, { yPercent: 115, rotate: 6 });
  gsap.set(['.hero .eyebrow', '.hero__trio li', '.scroll-cue', '.hero__dot'], { opacity: 0, y: 30 });
  gsap.set('.nav', { yPercent: -100 });
  gsap.set('.index', { opacity: 0 });
  $$('.num').forEach(n => (n.textContent = fmt(0, n.dataset.sep)));

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
      .to('.nav', { yPercent: 0, duration: 1 }, 0)
      .to('.hero .eyebrow', { opacity: 1, y: 0, duration: 1 }, 0.1)
      .to(chars, { yPercent: 0, rotate: 0, duration: 1.4, stagger: 0.055 }, 0.35)
      .to('.hero__dot', { opacity: 1, y: 0, duration: 0.8 }, 1.1)
      .to('.hero__trio li', { opacity: 1, y: 0, duration: 1, stagger: 0.12 }, 1.0)
      .to(['.scroll-cue', '.index'], { opacity: 1, y: 0, duration: 1 }, 1.4);
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

  /* ---------- counters ---------- */
  const runCounters = pane => $$('.num', pane).forEach(n => {
    const end = +n.dataset.count, o = { v: 0 };
    gsap.to(o, {
      v: end, duration: end > 1000 ? 2.6 : 1.8, delay: 0.5, ease: 'power3.out',
      onUpdate: () => (n.textContent = fmt(o.v, n.dataset.sep)),
      onComplete: () => gsap.fromTo(n, { scale: 1.08 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' })
    });
  });

  /* ---------- the pane engine ----------
     One master timeline drives the whole site: every pane has a "rest" range where the visitor
     is locked in (free scrolling = in-pane content like the horizontal cards), then a small
     margin, then the next pane slides up. Releasing the scroll snaps to the next rest point. */
  const T = 1;          // slide duration (timeline units)
  const MARGIN = 0.3;   // dwell scroll before the next pane lets go
  let tl, unit, rest = [], total = 1, activeIdx = 0, seenUpTo = 0;
  let resizeT;

  function setActive(i) {
    if (i === activeIdx) return;
    activeIdx = i;
    const dark = panes[i].classList.contains('sec--dark');
    nav.classList.toggle('on-dark', dark);
    const idx = $('.index__now');
    if (idx.textContent !== panes[i].dataset.label) {
      gsap.fromTo(idx, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
      idx.textContent = panes[i].dataset.label;
    }
  }
  function markSeen(i) {
    if (panes[i].classList.contains('is-seen')) return;
    panes[i].classList.add('is-seen');
    runCounters(panes[i]);
  }

  function build() {
    const prevProgress = tl ? tl.progress() : 0;
    if (tl) { tl.scrollTrigger.kill(); tl.kill(); }
    gsap.set(panes, { clearProps: 'transform' });
    gsap.set('.pane-inner', { clearProps: 'transform' });
    gsap.set('.hscroll__track', { clearProps: 'transform' });

    unit = innerHeight * 0.8;
    const isMobile = matchMedia('(max-width: 700px)').matches;
    tl = gsap.timeline({ defaults: { ease: 'none' } });
    rest = [];
    let t = 0;

    panes.forEach((pane, i) => {
      if (i > 0) {
        const start = t + MARGIN;
        gsap.set(pane, { yPercent: 115 });
        tl.fromTo(pane, { yPercent: 115 }, { yPercent: 0, duration: T, ease: 'power2.inOut', immediateRender: false }, start);
        tl.to(panes[i - 1], { yPercent: -14, duration: T, ease: 'power2.inOut' }, start);
        t = start + T;
      }
      const rs = t;
      // in-pane scrolling: the horizontal cards, or any content taller than the screen
      const inner = $('.pane-inner', pane);
      const overflow = Math.max(0, inner.scrollHeight - innerHeight);
      const track = pane.id === 'what' && !isMobile ? $('.hscroll__track') : null;
      let span = 0;
      if (track) {
        const dist = Math.max(0, track.scrollWidth - innerWidth + gutter());
        span = dist / unit;
        tl.to(track, { x: -dist, duration: span }, rs);
        tl.to('.hscroll__bgtext', { x: -dist * 0.2, duration: span }, rs);
      } else if (overflow > 40) {
        span = overflow / unit;
        tl.to(inner, { y: -overflow, duration: span }, rs);
      }
      t = rs + span;
      rest.push({ rs, re: t });
    });
    total = t;
    tl.set({}, {}, total); // pad to exact length

    const space = $('#space');
    space.style.height = (total * unit + innerHeight) + 'px';

    const snapTo = (v, self) => {
      const time = v * total;
      for (let i = 0; i < N; i++) {
        if (time >= rest[i].rs - 1e-4 && time <= rest[i].re + 1e-4) return v;      // locked in a pane
        const next = rest[i + 1];
        if (next && time > rest[i].re + 1e-4 && time < next.rs - 1e-4) {                          // between panes
          const to = self.direction > 0 ? next.rs : rest[i].re;
          return to / total;
        }
      }
      return v;
    };

    ScrollTrigger.create({
      animation: tl, trigger: space, start: 'top top', end: 'bottom bottom', scrub: 0.45,
      snap: { snapTo, delay: 0.12, duration: { min: 0.35, max: 0.9 }, ease: 'power2.inOut' }
    });

    tl.eventCallback('onUpdate', () => {
      const time = tl.time();
      let a = 0;
      for (let i = 1; i < N; i++) {
        if (time >= rest[i].rs - T * 0.5) a = i;
        if (time >= rest[i].rs - T * 0.8) markSeen(i);   // start revealing as the pane begins to slide
      }
      setActive(a);
      gsap.set('.nav__progress i', { scaleX: tl.progress() });
      gsap.set('.index__line i', { scaleY: tl.progress() });
    });

    if (prevProgress) scrollTo(0, prevProgress * total * unit);
    ScrollTrigger.refresh();
    tl.time(tl.scrollTrigger.progress * total);
  }

  const start = () => { build(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else addEventListener('load', start);
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(build, 250); });

  /* ---------- page-transition jumps (nav links) ---------- */
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
        const time = rest[i].rs;
        scrollTo(0, (time / total) * total * unit);
        tl.time(time);
        for (let k = 0; k <= i; k++) panes[k].classList.add('is-seen');
        runCounters(panes[i]);
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
