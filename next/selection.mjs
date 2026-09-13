export function eligible(variations, model, version) {
  return variations.filter(v => v.model === model && v.contentVersion === version &&
    v.review?.nate === 'approved' && v.review?.agent === 'approved' &&
    typeof v.modelVersion === 'string' && v.modelVersion.trim() &&
    typeof v.generatedAt === 'string' && !Number.isNaN(Date.parse(v.generatedAt)) &&
    typeof v.id === 'string' && /^[a-z0-9-]+$/.test(v.id) &&
    typeof v.entry === 'string' && /^designs\/[a-z0-9-]+\/$/.test(v.entry));
}
export function choose(pool, seen = [], current = null, random = Math.random) {
  const remaining = pool.filter(v => !seen.includes(v.id));
  const fresh = remaining.length ? remaining : pool;
  const alternatives = fresh.filter(v => v.id !== current);
  const candidates = alternatives.length ? alternatives : fresh;
  return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null;
}
export function remember(pool, seen, id) {
  const valid = seen.filter(item => pool.some(v => v.id === item));
  const cycle = pool.every(v => valid.includes(v.id)) ? [] : valid;
  return [...new Set([...cycle, id])];
}
