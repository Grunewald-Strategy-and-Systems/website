(() => {
  const body = document.body;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n, sep) => (sep ? Math.round(n).toLocaleString('en-US') : String(Math.round(n)));

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

  $('#year').textContent = new Date().getFullYear();

  // Graceful fallback: no GSAP or reduced motion → static, fully readable page.
  if (!window.gsap || !window.ScrollTrigger || reduce) {
    body.classList.remove('is-loading');
    const c = $('.curtain'); if (c) c.remove();
    liveReady.then(() => $$('.num').forEach(n => (n.textContent = fmt(+n.dataset.count, n.dataset.sep))));
    $$('.num').forEach(n => (n.textContent = fmt(+n.dataset.count, n.dataset.sep)));
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const gutter = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 0;

  /* ---------- text splitting ---------- */
  const wrapWords = root => {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(' '));
            const w = document.createElement('span'); w.className = 'w';
            const i = document.createElement('span'); i.textContent = part;
            w.appendChild(i); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(root);
    return $$('.w > span', root);
  };
  $$('.split-words').forEach(el => { el._words = wrapWords(el); });

  const titleEl = $('[data-chars]');
  const chars = [...titleEl.textContent].map(ch => {
    const s = document.createElement('span'); s.className = 'c'; s.textContent = ch; return s;
  });
  titleEl.textContent = ''; chars.forEach(c => titleEl.appendChild(c));

  /* ---------- initial states ---------- */
  gsap.set(chars, { yPercent: 115, rotate: 6 });
  gsap.set('.hero .split-words .w > span', { yPercent: 110 });
  gsap.set(['.hero .eyebrow', '.hero__trio li', '.scroll-cue', '.hero__dot'], { opacity: 0, y: 30 });
  gsap.set('.nav', { yPercent: -100 });
  gsap.set('.index', { opacity: 0 });
  $$('.fade-up').forEach(el => gsap.set(el, { opacity: 0, y: 50 }));
  $$('.split-words:not(.hero__lead):not(.quote)').forEach(el => gsap.set(el._words, { yPercent: 110 }));
  gsap.set($('.quote')._words, { opacity: 0.12 });
  $$('.num').forEach(n => (n.textContent = fmt(0, n.dataset.sep)));

  /* ---------- intro / page curtain ---------- */
  const strips = $$('.curtain__strip');
  const badge = $('.curtain__badge');
  const intro = gsap.timeline({ defaults: { ease: 'power4.inOut' } });
  intro
    .set(strips, { scaleY: 1, transformOrigin: 'top' })
    .to(badge, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.1)
    .to(badge, { opacity: 0, y: -30, duration: 0.5, ease: 'power2.in' }, 1.2)
    .set(strips, { transformOrigin: 'bottom' }, 1.5)
    .to(strips, { scaleY: 0, duration: 1.0, stagger: 0.07 }, 1.5)
    .add(() => { body.classList.remove('is-loading'); heroIn(); }, 1.9);

  gsap.set(badge, { scale: 0.9 });

  function heroIn() {
    const t = gsap.timeline({ defaults: { ease: 'power4.out' } });
    t.to('.nav', { yPercent: 0, duration: 1 }, 0)
      .to('.hero .eyebrow', { opacity: 1, y: 0, duration: 1 }, 0.1)
      .to('.hero__lead .w > span', { yPercent: 0, duration: 1.1, stagger: 0.04 }, 0.2)
      .to(chars, { yPercent: 0, rotate: 0, duration: 1.4, stagger: 0.055 }, 0.35)
      .to('.hero__dot', { opacity: 1, y: 0, duration: 0.8 }, 1.1)
      .to('.hero__trio li', { opacity: 1, y: 0, duration: 1, stagger: 0.12 }, 1.0)
      .to(['.scroll-cue', '.index'], { opacity: 1, y: 0, duration: 1 }, 1.4);
  }

  /* ---------- hero: drifting background ---------- */
  const rings = $('.hero__rings');
  gsap.to(rings, { rotation: 360, duration: 140, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
  gsap.to('.hero__rings g:first-child circle', { scale: 1.06, duration: 4, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: { each: 0.5, from: 'start' } });
  gsap.to('.hero__bg', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__title', { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  const glowX = gsap.quickTo('.hero__glow', 'x', { duration: 1.2, ease: 'power3' });
  const glowY = gsap.quickTo('.hero__glow', 'y', { duration: 1.2, ease: 'power3' });
  gsap.set('.hero__glow', { x: innerWidth * 0.7, y: innerHeight * 0.4 });
  addEventListener('pointermove', e => {
    const r = $('.hero').getBoundingClientRect();
    if (r.bottom < 0) return;
    glowX(e.clientX); glowY(e.clientY - r.top);
  });

  /* ---------- section-to-section transitions (dark sections open & close like cards) ---------- */
  const mm = gsap.matchMedia();
  const inset = (t, s, b, r, rr) => `inset(${t}px ${s}% ${b}px ${s}% round ${rr}px ${rr}px ${r}px ${r}px)`;
  $$('.sec--dark').forEach(sec => {
    const bg = $('.sec__bg', sec);
    gsap.fromTo(bg, { clipPath: inset(90, 4, 0, 0, 56) }, {
      clipPath: inset(0, 0, 0, 0, 0), ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 30%', scrub: true }
    });
    if (sec.id !== 'contact') {
      gsap.fromTo(bg, { clipPath: inset(0, 0, 0, 0, 0) }, {
        clipPath: inset(0, 4, 90, 56, 0), ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: sec, start: 'bottom 85%', end: 'bottom 15%', scrub: true }
      });
    }
  });

  /* ---------- reveals ---------- */
  $$('.split-words:not(.hero__lead):not(.quote)').forEach(el => {
    gsap.to(el._words, {
      yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.05,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });
  ScrollTrigger.batch('.fade-up', {
    start: 'top 90%', once: true,
    onEnter: els => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.12, overwrite: true })
  });

  // Testimonial: words light up as you scroll
  const q = $('.quote');
  gsap.to(q._words, {
    opacity: 1, ease: 'none', stagger: 0.5,
    scrollTrigger: { trigger: q, start: 'top 80%', end: 'bottom 45%', scrub: true }
  });
  gsap.fromTo('.quote-mark', { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.testimonial', start: 'top 80%', end: 'top 30%', scrub: true } });

  /* ---------- problem: marquee + counters ---------- */
  gsap.to('.marquee__track', { xPercent: -50, ease: 'none', scrollTrigger: { trigger: '.problem', start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
  gsap.fromTo('.problem__card', { y: 80, opacity: 0 }, {
    y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.15,
    scrollTrigger: { trigger: '.problem__cols', start: 'top 85%', once: true }
  });

  $$('.num').forEach(n => {
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: n, start: 'top 90%', once: true,
      onEnter: () => liveReady.then(() => { const end = +n.dataset.count; gsap.to(o, {
        v: end, duration: end > 1000 ? 2.6 : 1.8, ease: 'power3.out',
        onUpdate: () => (n.textContent = fmt(o.v, n.dataset.sep)),
        onComplete: () => gsap.fromTo(n, { scale: 1.08 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' })
      }); })
    });
  });

  /* ---------- philosophy: chart draws on scroll ---------- */
  $$('.chart__line').forEach(path => {
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(path, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.chart', start: 'top 80%', end: 'bottom 45%', scrub: 0.6 } });
  });
  gsap.from('.chart__dots rect', { scale: 0, transformOrigin: '50% 50%', stagger: 0.1, ease: 'back.out(3)', scrollTrigger: { trigger: '.chart', start: 'bottom 60%', toggleActions: 'play none none reverse' } });
  gsap.from('.chart__tag', { opacity: 0, x: 20, stagger: 0.15, scrollTrigger: { trigger: '.chart', start: 'center 60%', toggleActions: 'play none none reverse' } });

  /* ---------- horizontal scroll ---------- */
  let hscrollStart = null;
  mm.add('(min-width: 701px)', () => {
    const track = $('.hscroll__track');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth + gutter());
    const tl = gsap.timeline({
      scrollTrigger: {
        id: 'hscroll', refreshPriority: 1, trigger: '.hscroll', start: 'top top', end: () => '+=' + dist(),
        pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true
      }
    });
    tl.to(track, { x: () => -dist(), ease: 'none' }, 0)
      .to('.hscroll__bgtext', { x: () => -dist() * 0.35, ease: 'none' }, 0);
    // cards tilt in as they travel
    $$('.panel--card').forEach(p => {
      gsap.fromTo(p, { rotate: 3, y: 40 }, {
        rotate: 0, y: 0, ease: 'none',
        scrollTrigger: { trigger: p, containerAnimation: tl, start: 'left 105%', end: 'left 55%', scrub: true }
      });
    });
    return () => {};
  });
  mm.add('(max-width: 700px)', () => {
    gsap.from('.panel', { opacity: 0, y: 50, stagger: 0.12, scrollTrigger: { trigger: '.hscroll__track', start: 'top 85%', once: true } });
  });

  /* ---------- team / contact flourishes ---------- */
  gsap.from('.team__tags li, .team__flow li', { opacity: 0, y: 24, stagger: 0.08, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: '.team__copy', start: 'top 60%', once: true } });
  gsap.to('.contact__rings svg', { rotation: 90, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  gsap.from('.why__half--yes', { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'power4.inOut', scrollTrigger: { trigger: '.why__pair', start: 'top 70%', once: true } });

  /* ---------- nav state + progress ---------- */
  const nav = $('#nav');
  $$('.sec--dark').forEach(sec => ScrollTrigger.create({
    trigger: sec, start: 'top 40px', end: 'bottom 40px',
    onToggle: s => nav.classList.toggle('on-dark', s.isActive)
  }));
  gsap.to('.nav__progress i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.documentElement, start: 0, end: 'max', scrub: 0.3 } });
  gsap.to('.index__line i', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: document.documentElement, start: 0, end: 'max', scrub: 0.3 } });

  const idxNow = $('.index__now');
  $$('[data-label]').forEach(sec => ScrollTrigger.create({
    trigger: sec, start: 'top 50%', end: 'bottom 50%',
    onToggle: s => {
      if (!s.isActive || idxNow.textContent === sec.dataset.label) return;
      gsap.fromTo(idxNow, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
      idxNow.textContent = sec.dataset.label;
    }
  }));

  /* ---------- page-transition jumps ---------- */
  let jumping = false;
  const yFor = el => {
    if (el.id === 'what') { const st = ScrollTrigger.getById('hscroll'); if (st) return st.start; }
    return el.getBoundingClientRect().top + scrollY;
  };
  $$('[data-jump]').forEach(a => a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (jumping) return;
    jumping = true;
    gsap.timeline({ onComplete: () => { jumping = false; } })
      .set(strips, { transformOrigin: 'top' })
      .set('.curtain', { pointerEvents: 'auto' })
      .to(strips, { scaleY: 1, duration: 0.7, ease: 'power4.inOut', stagger: 0.06 })
      .add(() => { window.scrollTo(0, yFor(target)); ScrollTrigger.update(); history.replaceState(null, '', a.getAttribute('href')); })
      .set(strips, { transformOrigin: 'bottom' })
      .to(strips, { scaleY: 0, duration: 0.8, ease: 'power4.inOut', stagger: 0.06 }, '+=0.1')
      .set('.curtain', { pointerEvents: 'none' });
  }));

  /* ---------- cursor + magnetic ---------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const cur = $('.cursor');
    const cx = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
    const cy = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
    addEventListener('pointermove', e => { cx(e.clientX); cy(e.clientY); });
    document.addEventListener('pointerover', e => cur.classList.toggle('is-link', !!e.target.closest('a, button')));

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

  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
