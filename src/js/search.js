export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuery(query) {
  return normalizeText(query)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildSearchHaystack(document) {
  return normalizeText([
    document.gostNumber,
    document.title,
    document.shortTitle,
    document.year,
    document.description,
    ...(document.tags ?? [])
  ].join(' '));
}

export function matchesQuery(document, query) {
  const tokens = tokenizeQuery(query);

  if (tokens.length === 0) {
    return true;
  }

  const haystack = buildSearchHaystack(document);
  return tokens.every((token) => haystack.includes(token));
}
