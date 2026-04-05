import { tokenizeQuery } from './search.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightSearchTerms(text, query) {
  const sourceText = String(text ?? '');
  const tokens = tokenizeQuery(query)
    .map((token) => token.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  if (!sourceText || tokens.length === 0) {
    return escapeHtml(sourceText);
  }

  const pattern = new RegExp(tokens.map(escapeRegExp).join('|'), 'gi');
  const parts = [];
  let lastIndex = 0;

  for (const match of sourceText.matchAll(pattern)) {
    const matchedText = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      parts.push(escapeHtml(sourceText.slice(lastIndex, matchIndex)));
    }

    parts.push(`<mark>${escapeHtml(matchedText)}</mark>`);
    lastIndex = matchIndex + matchedText.length;
  }

  if (lastIndex < sourceText.length) {
    parts.push(escapeHtml(sourceText.slice(lastIndex)));
  }

  return parts.join('');
}
