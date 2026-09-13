import { eligible, choose } from './selection.mjs';
const status = document.querySelector('#design-status');
const profile = document.querySelector('#profile');
const footer = document.querySelector('body > footer');
const buttons = [...document.querySelectorAll('[data-model]')];
let current = null, frame = null, request = 0, data;
function active(model) {
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.model === model));
}
async function readData() {
  if (!data) data = Promise.all(['designs/manifest.json', 'content.json'].map(async path => {
    const response = await fetch(path, {cache:'no-cache'});
    if (!response.ok) throw new Error('Unavailable');
    return response.json();
  })).catch(error => {data = null; throw error;});
  return data;
}
async function loadDesign(variation, signal) {
  const response = await fetch(variation.entry, {signal});
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
  next.src = variation.entry;
  document.body.append(next);
  try {await loaded; return next;} catch(error) {next.remove(); throw error;}
}
let controller;
for (const button of buttons) button.addEventListener('click', async () => {
  const token = ++request;
  controller?.abort();
  const model = button.dataset.model;
  if (model === 'base') {
    frame?.remove(); frame = null; current = null;
    profile.hidden = false; footer.hidden = false;
    document.body.classList.remove('viewing-design');
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
    const variation = choose(eligible(manifest.variations, model, content.version), current);
    if (!variation) throw new Error('Unavailable');
    pending = await loadDesign(variation, thisController.signal);
    if (token !== request) {pending.remove(); return;}
    frame?.remove(); frame = pending; current = variation.id;
    profile.hidden = true; footer.hidden = false;
    document.body.classList.add('viewing-design');
    pending.hidden = false;
    active(model);
    status.textContent = `${button.textContent} · ${variation.name}`;
  } catch {
    pending?.remove();
    if (token === request) status.textContent = 'Unable to load this design. Try again.';
  } finally {clearTimeout(timeout);}
});
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
  } catch { /* Profile stays readable without the collection. */ }
}
revealAvailableCollections();
