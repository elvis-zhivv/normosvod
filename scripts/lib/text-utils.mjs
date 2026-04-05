export function decodeHtmlEntities(input) {
  return String(input ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCharCode(Number(codePoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCharCode(parseInt(codePoint, 16)));
}

export function stripTags(input) {
  return decodeHtmlEntities(String(input ?? '').replace(/<[^>]+>/g, ' '));
}

export function normalizeWhitespace(input) {
  return String(input ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanText(input) {
  return normalizeWhitespace(stripTags(input));
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sentenceCaseIfNeeded(value) {
  const text = normalizeWhitespace(value);

  if (!text) {
    return '';
  }

  if (/^[^a-zа-яё]*[A-ZА-ЯЁ0-9\s.,():"/-]+$/.test(text)) {
    const lower = text.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  return text;
}
