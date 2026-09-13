export function eligible(variations, model, version) {
  return variations.filter(v => v.model === model && v.contentVersion === version &&
    v.review?.nate === 'approved' && v.review?.agent === 'approved' &&
    typeof v.modelVersion === 'string' && v.modelVersion.trim() &&
    typeof v.generatedAt === 'string' && !Number.isNaN(Date.parse(v.generatedAt)) &&
    typeof v.id === 'string' && /^[a-z0-9-]+$/.test(v.id) &&
    typeof v.entry === 'string' && /^designs\/[a-z0-9-]+\/$/.test(v.entry));
}
export function choose(pool, current, random = Math.random) {
  const alternatives = pool.filter(v => v.id !== current);
  const candidates = alternatives.length ? alternatives : pool;
  return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null;
}
