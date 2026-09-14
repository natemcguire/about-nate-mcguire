export function eligible(variations, model, version) {
  return variations.filter(v => v.model === model && v.contentVersion === version &&
    v.review?.nate === 'approved' && v.review?.agent === 'approved' &&
    typeof v.modelVersion === 'string' && v.modelVersion.trim() &&
    typeof v.generatedAt === 'string' && !Number.isNaN(Date.parse(v.generatedAt)) &&
    typeof v.id === 'string' && /^[a-z0-9-]+$/.test(v.id) &&
    typeof v.entry === 'string' && /^designs\/[a-z0-9-]+\/$/.test(v.entry));
}
export function choose(pool, seen = [], current = null) {
  const ordered = [...pool].sort((a,b) => a.id.localeCompare(b.id));
  const last = ordered.findIndex(v => v.id === current);
  const cycle = [...ordered.slice(last + 1), ...ordered.slice(0, last + 1)];
  return cycle.find(v => !seen.includes(v.id)) || cycle[0] || null;
}
export function sharedVariation(variations, version, search) {
  const id = new URLSearchParams(search).get('design');
  const match = variations.find(v => v.id === id);
  return match && eligible(variations, match.model, version).find(v => v.id === id) || null;
}
export function remember(pool, seen, id) {
  const valid = seen.filter(item => pool.some(v => v.id === item));
  const cycle = pool.every(v => valid.includes(v.id)) ? [] : valid;
  return [...new Set([...cycle, id])];
}
