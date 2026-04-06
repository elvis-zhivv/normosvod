function normalizeDocTypeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .trim();
}

const SUPPORTED_DOC_TYPES = new Set([
  'gost',
  'standard',
  'code',
  'rule',
  'recommendation',
  'collection',
  'other'
]);

export function inferDocType(document) {
  const haystack = normalizeDocTypeText([
    document?.docType,
    document?.slug,
    document?.gostNumber,
    document?.title,
    document?.shortTitle
  ].join(' '));

  if (haystack.includes('гост') || haystack.includes('gost')) {
    return 'gost';
  }

  if (haystack.includes('свод правил') || haystack.includes(' code ') || /^сп\s*\d/u.test(haystack) || haystack.includes(' сп ')) {
    return 'code';
  }

  if (/рекомендац|recommend/u.test(haystack)) {
    return 'recommendation';
  }

  if (/правил|rule/u.test(haystack)) {
    return 'rule';
  }

  if (/сборник|collection/u.test(haystack)) {
    return 'collection';
  }

  return 'standard';
}

export function normalizeDocType(value, fallbackDocument = null) {
  const normalized = normalizeDocTypeText(value);

  if (SUPPORTED_DOC_TYPES.has(normalized)) {
    return normalized;
  }

  return inferDocType(fallbackDocument ?? { docType: value });
}
