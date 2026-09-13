import { eligible, choose, remember } from './selection.mjs?v=cycles-1';
const status = document.querySelector('#design-status');
const profile = document.querySelector('#profile');
const footer = document.querySelector('body > footer');
const buttons = [...document.querySelectorAll('[data-model]')];
let current = null, frame = null, request = 0, data;
const secondary = profile.classList.contains('secondary-page');
let history = {}, saved;
try { history = JSON.parse(sessionStorage.getItem('design-history') || '{}'); saved = sessionStorage.getItem('design-choice'); } catch {}
if (!history || typeof history !== 'object' || Array.isArray(history)) history = {};
function persist(choice) {
  try {sessionStorage.setItem('design-history', JSON.stringify(history)); sessionStorage.setItem('design-choice', choice);} catch {}
}
let themeStyle;
async function applyPageDesign(variation, signal) {
  const response = await fetch('/designs/themes.json', {cache:'no-cache', signal});
  if (!response.ok) throw new Error('Unavailable');
  const themes = await response.json();
  if (!themes[variation.id]) throw new Error('Unavailable');
  return themes[variation.id];
}
function active(model) {
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.model === model));
}
async function readData() {
  if (!data) data = Promise.all(['/designs/manifest.json', '/content.json'].map(async path => {
    const response = await fetch(path, {cache:'no-cache'});
    if (!response.ok) throw new Error('Unavailable');
    return response.json();
  })).catch(error => {data = null; throw error;});
  return data;
}
async function loadDesign(variation, signal) {
  const entry = `/${variation.entry}?v=${encodeURIComponent(variation.sha256 || variation.contentVersion)}`;
  const response = await fetch(entry, {signal});
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Unavailable');
  const next = document.createElement('iframe');
  next.title = `${variation.name} — ${variation.modelVersion}`;
  next.className = 'design-frame';
  next.hidden = true;
  next.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
  next.referrerPolicy = 'no-referrer';
  const loaded = new Promise((resolve, reject) => {
    next.onload = resolve;
    next.onerror = () => reject(new Error('Unavailable'));
    signal.addEventListener('abort', () => reject(new Error('Cancelled')), {once:true});
  });
  next.src = entry;
  document.body.insertBefore(next, footer);
  try {await loaded; return next;} catch(error) {next.remove(); throw error;}
}
let controller;
async function selectDesign(button, initialId = null) {
  const token = ++request;
  controller?.abort();
  const model = button.dataset.model;
  if (model === 'base') {
    frame?.remove(); frame = null; current = null;
    profile.hidden = false; footer.hidden = false;
    document.body.classList.remove('viewing-design', 'themed-page');
    themeStyle?.remove(); themeStyle = null; delete profile.dataset.design; persist('base');
    active('base'); status.textContent = '';
    return;
  }
  controller = new AbortController();
  const thisController = controller;
  const timeout = setTimeout(() => thisController.abort(), 15000);
  let pending;
  try {
    status.textContent = 'Rendering…';
    const [manifest, content] = await readData();
    if (token !== request) return;
    const pool = eligible(manifest.variations, model, content.version);
    const seen = Array.isArray(history[model]) ? history[model] : [];
    const variation = pool.find(v => v.id === initialId) || choose(pool, seen, current);
    if (!variation) throw new Error('Unavailable');
    const pageTheme = secondary ? await applyPageDesign(variation, thisController.signal) : null;
    if (!secondary) pending = await loadDesign(variation, thisController.signal);
    if (token !== request) {pending?.remove(); return;}
    frame?.remove(); frame = pending; current = variation.id;
    footer.hidden = false;
    if (secondary) {
      themeStyle?.remove(); themeStyle = document.createElement('style');
      themeStyle.textContent = pageTheme; document.head.append(themeStyle);
      profile.dataset.design = variation.id;
      document.body.classList.add('themed-page');
    } else {
      profile.hidden = true; document.body.classList.add('viewing-design'); pending.hidden = false;
    }
    if (!initialId || !seen.includes(variation.id)) history[model] = remember(pool, seen, variation.id);
    persist(variation.id);
    active(model);
    status.textContent = `${button.textContent} · ${variation.name}`;
  } catch {
    pending?.remove();
    if (token === request) status.textContent = 'Unable to load this design. Try again.';
  } finally {clearTimeout(timeout);}
}
for (const button of buttons) button.addEventListener('click', () => selectDesign(button));
async function revealAvailableCollections() {
  try {
    const [manifest, content] = await readData();
    let available = 0;
    for (const button of buttons) {
      if (button.dataset.model === 'base') continue;
      const pool = eligible(manifest.variations, button.dataset.model, content.version);
      button.hidden = !pool.length;
      if (pool.length) {available++; button.title = `Pre-generated with ${pool[0].modelVersion}`;}
    }
    document.querySelector('.design-bar').hidden = available === 0;
    if (request === 0 && saved !== 'base') {
      const initial = manifest.variations.find(v => v.id === saved) || manifest.variations.find(v => v.id === 'claude-04');
      const button = buttons.find(b => b.dataset.model === initial?.model);
      if (button) await selectDesign(button, initial.id);
    }
  } catch { /* Profile stays readable without the collection. */ }
}
revealAvailableCollections();
