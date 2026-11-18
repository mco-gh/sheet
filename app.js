import { INSTRUMENTS, byId, mentions, isSolo } from './instruments.js';

const $ = (sel) => document.querySelector(sel);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(`sheet:${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`sheet:${key}`, JSON.stringify(value)); } catch {} },
};

// Instruments shown before "More instruments" is pressed.
const FIRST = ['piano', 'guitar', 'voice', 'violin', 'cello', 'flute', 'clarinet', 'sax', 'trumpet', 'ukulele'];

const SOURCES = {
  imslp: { name: 'IMSLP', home: 'https://imslp.org/' },
  mutopia: { name: 'Mutopia', home: 'https://www.mutopiaproject.org/' },
  archive: { name: 'Internet Archive', home: 'https://archive.org/details/sheetmusic' },
};
// Mutopia's own instrument filter names, for the "Keep looking" link.
const MUTOPIA = { piano: 'Piano', guitar: 'Guitar', voice: 'Voice', violin: 'Violin', cello: 'Cello', viola: 'Viola', bass: 'Double', flute: 'Flute', clarinet: 'Clarinet', oboe: 'Oboe', bassoon: 'Bassoon', trumpet: 'Trumpet', trombone: 'Trombone', horn: 'Horn', recorder: 'Recorder', harp: 'Harp', organ: 'Organ', mandolin: 'Mandolin', accordion: 'Accordion', choir: 'Voice' };

// Same rules as the server: lower case, no accents, no little words.
const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'for', 'my', 'de', 'la', 'le', 'el', 'der', 'die', 'das', 'op', 'no']);
const words = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((w) => w && !STOP.has(w));
const allIn = (need, hay) => { const h = new Set(words(hay)); return need.every((w) => h.has(w)); };

let instrument = byId.has(store.get('instrument')) ? store.get('instrument') : 'piano';
let showAll = false;
let current = null; // { q, results: Map(source -> list | Error | null), abort }

// ───────── Instrument picker ─────────
function renderInstruments() {
  const list = $('#inst-list');
  const visible = showAll ? INSTRUMENTS : INSTRUMENTS.filter((i) => FIRST.includes(i.id) || i.id === instrument);
  list.replaceChildren(...visible.map((i) => {
    const label = document.createElement('label');
    label.className = 'inst';
    label.style.setProperty('--h', i.hue);
    label.innerHTML = `<input type="radio" name="instrument" value="${i.id}"><span>${i.name}</span>`;
    label.querySelector('input').checked = i.id === instrument;
    return label;
  }));
  $('#more-inst').textContent = showAll ? 'Fewer instruments' : `More instruments (${INSTRUMENTS.length - visible.length})`;
  $('#more-inst').setAttribute('aria-expanded', showAll);
}

function setInstrument(id, { rerun = true } = {}) {
  instrument = id;
  store.set('instrument', id);
  const inst = byId.get(id);
  const hero = $('#hero-inst');
  hero.textContent = inst.name.toLowerCase();
  document.documentElement.style.setProperty('--inst-h', inst.hue);
  hero.animate?.([{ opacity: 0, translate: '0 0.25em' }, { opacity: 1, translate: '0 0' }], { duration: 260, easing: 'ease-out' });
  renderSuggestions();
  if (rerun && current) { updateUrl(current.q, false); render(); }
}

$('#inst-list').addEventListener('change', (e) => setInstrument(e.target.value));
$('#more-inst').addEventListener('click', () => { showAll = !showAll; renderInstruments(); });

// ───────── Suggestions and recent searches ─────────
function renderSuggestions() {
  const recent = store.get('recent', []);
  const ideas = byId.get(instrument).try.filter((t) => !recent.some((r) => r.toLowerCase() === t.toLowerCase()));
  const chip = (text, isRecent) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = isRecent ? 'chip recent' : 'chip';
    b.textContent = text;
    b.addEventListener('click', () => { $('#q').value = text; search(text); });
    li.append(b);
    return li;
  };
  $('#suggest-label').textContent = recent.length ? 'Recent' : 'Try';
  $('#suggest-list').replaceChildren(...recent.slice(0, 4).map((t) => chip(t, true)), ...ideas.slice(0, recent.length ? 3 : 5).map((t) => chip(t)));
}

function remember(q) {
  const recent = store.get('recent', []).filter((r) => r.toLowerCase() !== q.toLowerCase());
  store.set('recent', [q, ...recent].slice(0, 8));
}

// ───────── Searching ─────────
async function fetchServer(src, q, signal) {
  const res = await fetch(`/api/sheet?src=${src}&q=${encodeURIComponent(q)}`, { signal });
  if (res.status === 404) throw new Error('not available here'); // e.g. a local copy without mco.dev's server
  if (res.status === 429) throw new Error('busy, try again in a minute');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `error ${res.status}`);
  return data.results;
}

async function fetchArchive(q, signal) {
  const need = words(q);
  const clean = q.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').trim();
  const query = `title:(${clean}) AND mediatype:texts AND subject:"sheet music"`;
  const params = new URLSearchParams({ q: query, rows: '40', output: 'json' });
  for (const f of ['identifier', 'title', 'creator', 'date', 'year', 'subject', 'description']) params.append('fl[]', f);
  const res = await fetch(`https://archive.org/advancedsearch.php?${params}`, { signal });
  if (!res.ok) throw new Error(`error ${res.status}`);
  const docs = (await res.json()).response?.docs ?? [];
  const list = (v) => [].concat(v ?? []).flatMap((s) => String(s).split(/\s*[;,]\s*(?=[A-Z])/));
  return docs.filter((d) => allIn(need, d.title)).map((d) => {
    const subjects = list(d.subject);
    const creator = list(d.creator).filter((c) => !/library of congress/i.test(c))[0] ?? '';
    // Subjects such as "Songs with piano" or "Guitar music" say what it's for.
    const forText = subjects.filter((s) => INSTRUMENTS.some((i) => mentions(i.id, s))).slice(0, 3).join(', ');
    const description = [].concat(d.description ?? []).join(' ').replace(/<[^>]*>/g, ' ').slice(0, 400);
    return {
      source: 'archive',
      title: String(d.title).replace(/\s*\((\d{4})?,?\s*Library of Congress\)\s*$/, '').replace(/_/g, ' '),
      composer: creator.replace(/,\s*\d{4}-(\d{4})?\.?$/, '').replace(/^(.+), (.+)$/, '$2 $1'),
      forText,
      instruments: `${forText} ${d.title} ${subjects.join(' ')} ${description}`.toLowerCase(),
      year: String(d.year ?? d.date ?? '').match(/\d{4}/)?.[0] ?? '',
      style: '',
      license: subjects.some((s) => /public domain/i.test(s)) ? 'Public domain' : '',
      url: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
      thumb: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
      files: 1,
    };
  });
}

function search(q, { push = true } = {}) {
  q = q.trim();
  if (!q) return;
  current?.abort.abort();
  const abort = new AbortController();
  current = { q, abort, results: new Map(Object.keys(SOURCES).map((s) => [s, null])) };
  remember(q);
  renderSuggestions();
  updateUrl(q, push);
  document.title = `${q} — Sheet`;
  $('#results').hidden = false;
  $('#others').open = false;
  render();
  $('#results').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

  const run = current;
  const jobs = {
    imslp: () => fetchServer('imslp', q, abort.signal),
    mutopia: () => fetchServer('mutopia', q, abort.signal),
    archive: () => fetchArchive(q, abort.signal),
  };
  for (const [src, job] of Object.entries(jobs)) {
    job()
      .then((list) => run.results.set(src, list))
      .catch((err) => { if (err.name !== 'AbortError') run.results.set(src, err); })
      .finally(() => { if (current === run && !abort.signal.aborted) render(); });
  }
}

$('#finder').addEventListener('submit', (e) => { e.preventDefault(); search($('#q').value); });

// ───────── Ranking ─────────
// 3: just your instrument ("piano", "guitar solo"); 2: your instrument with others
// ("violin, piano"); 1: the page also has an arrangement for it; 0: not for it.
function fit(r) {
  const primary = r.forText;
  if (isSolo(instrument, primary)) return 3;
  if (mentions(instrument, primary)) return 2;
  if (mentions(instrument, r.instruments)) return 1;
  return 0;
}

function ranked() {
  const need = words(current.q).join(' ');
  const all = [];
  for (const [src, list] of current.results) {
    if (Array.isArray(list)) list.forEach((r, i) => all.push({ r, i, src, fit: fit(r), exact: words(r.title).join(' ') === need }));
  }
  const order = { mutopia: 0, imslp: 1, archive: 2 };
  // Within a fit, exact titles first, then each source's own order, interleaving sources.
  all.sort((a, b) => b.fit - a.fit || b.exact - a.exact || a.i - b.i || order[a.src] - order[b.src]);
  return all;
}

// ───────── Rendering ─────────
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

function highlight(text) {
  // Mark the instrument's name in "for violin, piano".
  const frag = document.createDocumentFragment();
  const inst = byId.get(instrument);
  const re = new RegExp(`(${inst.terms.map((t) => t.replace(/[.*+?^${}()|[\]\\']/g, '\\$&')).join('|')})(e?s)?`, 'gi');
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (!mentions(instrument, text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 12))) continue;
    frag.append(text.slice(last, m.index), el('mark', '', m[0]));
    last = m.index + m[0].length;
  }
  frag.append(text.slice(last));
  return frag;
}

function card({ r, fit: f }) {
  const node = $('#card-tpl').content.firstElementChild.cloneNode(true);
  const inst = byId.get(instrument);
  node.dataset.source = r.source;
  const thumb = node.querySelector('.thumb');
  thumb.href = r.url;
  thumb.setAttribute('aria-label', `${r.title} on ${SOURCES[r.source].name}`);
  thumb.tabIndex = -1;
  if (r.thumb) {
    const img = el('img');
    img.src = r.thumb; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.addEventListener('error', () => img.remove());
    thumb.append(img);
  }
  thumb.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 40 52" aria-hidden="true"><path d="M7 14h26M7 19h26M7 24h26M7 29h26M7 34h26"/><path d="M16 32V18l11-3v14"/><ellipse cx="13.5" cy="32.3" rx="3" ry="2.3"/><ellipse cx="24.5" cy="29.3" rx="3" ry="2.3"/></svg>');

  node.querySelector('.src-badge').textContent = SOURCES[r.source].name;
  const fitEl = node.querySelector('.fit');
  fitEl.textContent = ['', `Has a ${inst.name.toLowerCase()} arrangement`, `With ${inst.name.toLowerCase()}`, `${inst.name} only`][f];
  fitEl.dataset.fit = f;

  const a = node.querySelector('.card-title a');
  a.href = r.url;
  a.textContent = r.title;
  node.querySelector('.byline').textContent = [r.composer, r.year].filter(Boolean).join(' · ');
  const forEl = node.querySelector('.for');
  if (r.forText) forEl.append('For ', highlight(r.forText.length > 140 ? `${r.forText.slice(0, 137)}…` : r.forText));
  else forEl.remove();

  if (r.preview) {
    const p = node.querySelector('.preview');
    p.hidden = false; p.href = r.pdf || r.url;
    p.setAttribute('aria-label', `Opening bars of ${r.title}`);
    p.querySelector('img').src = r.preview;
  }

  const facts = [r.style, r.files > 1 ? `${r.files >= 50 ? '50+' : r.files} PDFs` : '', r.license].filter(Boolean);
  node.querySelector('.facts').textContent = facts.join(' · ');

  const actions = node.querySelector('.card-actions');
  const btn = (label, href, primary, download) => {
    const b = el('a', primary ? 'act primary' : 'act', label);
    b.href = href; b.target = '_blank'; b.rel = 'noopener';
    if (download) b.setAttribute('download', '');
    actions.append(b);
  };
  if (r.source === 'mutopia') {
    if (r.pdf) btn('PDF', r.pdf, true);
    if (r.pdfA4) btn('A4 PDF', r.pdfA4);
    if (r.midi) btn('MIDI', r.midi, false, true);
    btn('Details', r.url);
  } else if (r.source === 'imslp') {
    btn('Scores on IMSLP', r.url, true);
  } else {
    btn('View the scan', r.url, true);
  }
  return node;
}

function sourceStatus() {
  return [...current.results].map(([src, v]) => {
    const li = el('li', 'source');
    li.dataset.source = src;
    if (v === null) { li.classList.add('loading'); li.append(el('span', 'name', SOURCES[src].name), el('span', 'state', 'searching…')); }
    else if (v instanceof Error) { li.classList.add('failed'); li.append(el('span', 'name', SOURCES[src].name), el('span', 'state', v.message)); li.title = `Couldn't search ${SOURCES[src].name}: ${v.message}`; }
    else li.append(el('span', 'name', SOURCES[src].name), el('b', '', String(v.length)));
    return li;
  });
}

function render() {
  if (!current) return;
  const inst = byId.get(instrument);
  const lower = inst.name.toLowerCase();
  const all = ranked();
  const matches = all.filter((x) => x.fit > 0);
  const others = all.filter((x) => x.fit === 0);
  const pending = [...current.results.values()].some((v) => v === null);

  $('#results-title').textContent = `“${current.q}” for ${lower}`;
  $('#sources').replaceChildren(...sourceStatus());
  $('#match-list').replaceChildren(...matches.map(card));
  $('#other-list').replaceChildren(...others.map(card));
  $('#others').hidden = !others.length;
  $('#others-title').textContent = matches.length
    ? `${others.length} more ${others.length === 1 ? 'version' : 'versions'} for other instruments`
    : `${others.length} ${others.length === 1 ? 'version' : 'versions'} for other instruments`;

  const empty = $('#empty');
  empty.hidden = matches.length > 0;
  if (!matches.length) {
    empty.textContent = pending
      ? 'Searching the libraries…'
      : others.length
        ? `None of these are written for ${lower}, but a melody line from one of the versions below is often easy to play or adapt.`
        : `No free scores matched “${current.q}”. Check the spelling, try the original title or the composer’s name, or look on the sites below.`;
    empty.classList.toggle('loading', pending);
  }
  // With nothing for your instrument, show the other versions straight away.
  if (!pending && !matches.length && others.length && !current.opened) { $('#others').open = true; current.opened = true; }
  renderLinks();
}

function renderLinks() {
  const q = current.q;
  const name = byId.get(instrument).name.toLowerCase();
  const enc = encodeURIComponent;
  const links = [
    ['MuseScore', `https://musescore.com/sheetmusic?text=${enc(`${q} ${name}`)}`, 'Huge community library of arrangements'],
    ['8notes', `https://www.8notes.com/school/search_fsm.asp?keyword=${enc(q)}`, 'Free lessons and easy arrangements'],
    ['IMSLP', `https://imslp.org/index.php?title=Special:Search&search=${enc(q)}`, 'Search the full library'],
  ];
  if (MUTOPIA[instrument]) links.push(['Mutopia', `https://www.mutopiaproject.org/cgibin/make-table.cgi?searchingfor=${enc(q)}&Instrument=${MUTOPIA[instrument]}`, `Mutopia’s ${name} section`]);
  links.push(['The web', `https://duckduckgo.com/?q=${enc(`"${q}" ${name} free sheet music pdf`)}`, 'A search for free PDFs']);
  $('#links').replaceChildren(...links.map(([label, href, note]) => {
    const li = el('li');
    const a = el('a', 'link-card');
    a.href = href; a.target = '_blank'; a.rel = 'noopener';
    a.append(el('b', '', label), el('span', '', note));
    a.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 16 16 8M9.5 8H16v6.5"/></svg>');
    li.append(a);
    return li;
  }));
}

// ───────── URL state: ?q=moon+river&i=guitar ─────────
function updateUrl(q, push) {
  const url = new URL(location.href);
  url.searchParams.set('q', q);
  url.searchParams.set('i', instrument);
  if (url.href === location.href) return;
  history[push ? 'pushState' : 'replaceState']({}, '', url);
}

function fromUrl() {
  const params = new URLSearchParams(location.search);
  const i = params.get('i');
  if (byId.has(i) && i !== instrument) { setInstrument(i, { rerun: false }); if (!FIRST.includes(i)) renderInstruments(); }
  renderInstruments();
  const q = params.get('q');
  if (q) { $('#q').value = q; if (q !== current?.q) search(q, { push: false }); else render(); }
  else { current?.abort.abort(); current = null; $('#results').hidden = true; $('#q').value = ''; document.title = 'Sheet — find free sheet music for your instrument'; }
}
addEventListener('popstate', fromUrl);

// ───────── Settings ─────────
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
for (const input of document.querySelectorAll('#scheme input')) {
  input.checked = input.value === schemeMeta.content;
  input.addEventListener('change', () => {
    schemeMeta.content = input.value;
    try { localStorage.setItem('sheet:scheme', input.value); } catch {}
  });
}
$('#clear-recent').addEventListener('click', (e) => {
  store.set('recent', []);
  renderSuggestions();
  e.target.textContent = 'Forgotten';
  setTimeout(() => { e.target.textContent = 'Forget recent searches'; }, 1600);
});

let installPrompt;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; $('#install').hidden = false; });
$('#install').addEventListener('click', async () => { await installPrompt?.prompt(); installPrompt = null; $('#install').hidden = true; });

// Older browsers without the Invoker Commands API (command / commandfor).
if (!('command' in HTMLButtonElement.prototype)) {
  for (const b of document.querySelectorAll('button[commandfor]')) b.addEventListener('click', () => document.getElementById(b.getAttribute('commandfor'))?.showModal());
}

// ───────── Start ─────────
setInstrument(instrument, { rerun: false });
fromUrl();
