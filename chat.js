/* Onboarding chat — opened by [data-chat-open] (rail chat button, "Start a conversation").
 *
 * BACKEND (optional until wired up). Set these two URLs and the widget uses them; with them empty it falls back
 * to sample availability (next 5 weekdays) and a prefilled mailto so no lead is lost.
 *
 *   availabilityUrl  GET  -> { "days": [ { "date": "2026-11-03", "slots": ["2026-11-03T15:00:00Z", ...] } ] }
 *                            (slots are ISO timestamps; they are shown in the visitor's local time)
 *   submitUrl        POST <- { name, organization, needs, email, wantsCall, slot, timezone }  (JSON) -> 2xx on success
 *                            A non-2xx or network error on a booking makes the widget offer other times.
 *
 * Both endpoints must allow CORS for this site.
 */
(() => {
  const CONFIG = { availabilityUrl: '', submitUrl: '', contactEmail: 'birkley.grunewald@gmail.com' };

  const panel = document.getElementById('chat');
  if (!panel) return;
  const log = panel.querySelector('.chat__log');
  const form = panel.querySelector('.chat__form');
  const input = panel.querySelector('.chat__input');
  const sendBtn = panel.querySelector('.chat__send');
  const closeBtn = panel.querySelector('.chat__close');
  const opener = { el: null };

  const data = { name: '', organization: '', needs: '', email: '', wantsCall: false, slot: '' };
  let step = 'idle';        // idle | name | org | needs | email | schedule | day | time | done
  let started = false;
  let dayBlock = null;      // the "pick a day" message, so "none of these work" can scroll back to it
  let timeBlock = null;
  let days = [];
  let booked = false;
  let fallbackHref = '';

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const scrollDown = () => { log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' }); };

  function bubble(who, text) {
    const el = document.createElement('div');
    el.className = 'chat__msg chat__msg--' + who;
    el.textContent = text;
    log.appendChild(el);
    scrollDown();
    return el;
  }

  async function say(text, delay = 650) {
    const typing = document.createElement('div');
    typing.className = 'chat__msg chat__msg--bot chat__typing';
    typing.setAttribute('aria-label', 'Typing');
    typing.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(typing);
    scrollDown();
    await sleep(delay);
    typing.remove();
    return bubble('bot', text);
  }

  function choices(items, onPick, cls) {
    const wrap = document.createElement('div');
    wrap.className = 'chat__choices' + (cls ? ' ' + cls : '');
    items.forEach(it => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat__chip' + (it.alt ? ' chat__chip--alt' : '');
      b.textContent = it.label;
      b.addEventListener('click', () => onPick(it, b, wrap));
      wrap.appendChild(b);
    });
    log.appendChild(wrap);
    scrollDown();
    return wrap;
  }

  const lock = wrap => wrap && wrap.querySelectorAll('button').forEach(b => { b.disabled = true; });
  const setInput = (on, placeholder, type) => {
    input.disabled = sendBtn.disabled = !on;
    input.placeholder = placeholder || '';
    input.type = type || 'text';
    input.setAttribute('autocomplete', type === 'email' ? 'email' : step === 'name' ? 'name' : 'off');
    if (on) input.focus({ preventScroll: true });
  };

  /* ---------- flow ---------- */
  async function start() {
    if (started) return;
    started = true;
    step = 'name';
    await say('Hi, we are incredibly excited to start working with you, and learning a little about your company and operations. First, what can we call you?', 500);
    setInput(true, 'Your name');
  }

  async function onText(value) {
    const text = value.trim();
    if (!text) return;

    if (step === 'name') {
      data.name = text;
      bubble('user', text);
      setInput(false);
      step = 'org';
      await say(`Great. Tell us a little about your organization, ${data.name}.`);
      setInput(true, 'Your organization');
    } else if (step === 'org') {
      data.organization = text;
      bubble('user', text);
      setInput(false);
      step = 'needs';
      await say('Where do you see us helping?');
      setInput(true, 'Where could we help?');
    } else if (step === 'needs') {
      data.needs = text;
      bubble('user', text);
      setInput(false);
      step = 'email';
      await say(`Thanks so much for letting us know. We will review your needs. What is the best email address to contact you at, ${data.name}?`);
      setInput(true, 'you@company.com', 'email');
    } else if (step === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
        bubble('user', text);
        setInput(false);
        await say('That doesn’t look quite right. Could you double-check the email address?', 450);
        setInput(true, 'you@company.com', 'email');
        return;
      }
      data.email = text;
      bubble('user', text);
      setInput(false);
      step = 'schedule';
      await say('If you would like to go ahead and schedule a call, I would be happy to set one up for you.');
      const wrap = choices([{ label: 'Yes', v: true }, { label: 'No', v: false }], async (it) => {
        lock(wrap);
        bubble('user', it.label);
        data.wantsCall = it.v;
        if (it.v) await offerDays(); else await finish(false);
      });
    }
  }

  async function loadAvailability() {
    if (CONFIG.availabilityUrl) {
      try {
        const r = await fetch(CONFIG.availabilityUrl, { headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        return (j.days || []).filter(d => d.slots && d.slots.length);
      } catch (e) { return null; }
    }
    // Sample availability until the backend exists: next 5 weekdays, four slots each (local time).
    const out = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    while (out.length < 5) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const slots = [[10, 0], [11, 30], [14, 0], [15, 30]].map(([h, m]) => {
        const s = new Date(d); s.setHours(h, m, 0, 0); return s.toISOString();
      });
      out.push({ date: dayKey(d), slots });
    }
    return out;
  }

  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parseDay = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayLabel = key => parseDay(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const dayLong = d => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const timeLabel = iso => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  async function offerDays() {
    step = 'day';
    await say('Great! What day would work best for you:', 500);
    days = await loadAvailability();
    if (!days || !days.length) {
      await say('I’m having trouble pulling up our calendar just now. We have your details and will email you shortly to find a time.', 500);
      return finish(false, true);
    }
    dayBlock = choices(days.map(d => ({ label: dayLabel(d.date), day: d })), async (it, btn) => {
      if (booked) return;
      dayBlock.querySelectorAll('button').forEach(b => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      if (timeBlock) { lock(timeBlock); timeBlock.classList.add('is-stale'); }
      bubble('user', it.label);
      await offerTimes(it.day);
    }, 'chat__choices--days');
  }

  async function offerTimes(day) {
    step = 'time';
    await say('Please select your preferred time.', 450);
    const items = day.slots.map(s => ({ label: timeLabel(s), slot: s }));
    items.push({ label: 'None of these work', none: true, alt: true });
    const wrap = timeBlock = choices(items, async (it, btn) => {
      if (it.none) {
        lock(wrap);
        wrap.classList.add('is-stale');
        bubble('user', 'None of these work');
        step = 'day';
        dayBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        dayBlock.classList.add('is-flash');
        setTimeout(() => dayBlock.classList.remove('is-flash'), 1600);
        return;
      }
      lock(wrap);
      lock(dayBlock);
      bubble('user', it.label);
      data.slot = it.slot;
      await book(day, it.slot);
    });
  }

  async function book(day, slot) {
    const ok = await submit();
    if (!ok) {
      await say('Sorry, that time could not be confirmed. Please choose another.', 500);
      dayBlock.querySelectorAll('button').forEach(b => { b.disabled = false; });
      timeBlock.classList.add('is-stale');
      data.slot = '';
      step = 'day';
      dayBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    booked = true;
    step = 'done';
    const when = new Date(slot);
    await say(`Wonderful. We have you scheduled for ${dayLong(when)} at ${timeLabel(slot)}. Looking forward to speaking then.`, 700);
    showFallback();
    setInput(false, 'Conversation complete');
  }

  async function finish(withBooking, trouble) {
    step = 'done';
    await submit();
    if (!trouble) await say(`Thank you, ${data.name}. We will review your needs and reach out by email soon. We look forward to working with you.`, 700);
    showFallback();
    setInput(false, 'Conversation complete');
  }

  // Returns true when the details were delivered. With no backend configured it hands off to a prefilled email.
  async function submit() {
    const payload = { ...data, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    if (CONFIG.submitUrl) {
      try {
        const r = await fetch(CONFIG.submitUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        return r.ok;
      } catch (e) { return false; }
    }
    const lines = [
      `Name: ${payload.name}`, `Organization: ${payload.organization}`, `Where we can help: ${payload.needs}`,
      `Email: ${payload.email}`, payload.slot ? `Requested call: ${new Date(payload.slot).toString()}` : 'Call: not requested'
    ];
    const href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent('New conversation from ' + payload.name)}&body=${encodeURIComponent(lines.join('\n'))}`;
    fallbackHref = href;
    return true;
  }

  function showFallback() {
    if (!fallbackHref) return;
    const a = document.createElement('a');
    a.className = 'chat__fallback';
    a.href = fallbackHref;
    a.textContent = 'Send these details to our team →';
    log.appendChild(a);
    scrollDown();
    fallbackHref = '';
  }

  /* ---------- open / close ---------- */
  function open(from) {
    opener.el = from || null;
    panel.hidden = false;
    document.body.classList.add('chat-open');
    requestAnimationFrame(() => panel.classList.add('is-open'));
    start();
    if (!input.disabled) input.focus({ preventScroll: true });
  }
  function close() {
    panel.classList.remove('is-open');
    document.body.classList.remove('chat-open');
    setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 350);
    if (opener.el) opener.el.focus({ preventScroll: true });
  }

  document.querySelectorAll('[data-chat-open]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    open(el);
  }));
  closeBtn.addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('is-open')) close(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (input.disabled) return;
    const v = input.value;
    input.value = '';
    onText(v);
  });
})();
