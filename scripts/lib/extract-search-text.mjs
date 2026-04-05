import { cleanText, normalizeWhitespace } from './text-utils.mjs';

function withoutScriptsAndStyles(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

export function extractSearchEntries(html) {
  const source = withoutScriptsAndStyles(html);
  const pageMatches = Array.from(
    source.matchAll(/<section[^>]*class="[^"]*\bpage\b[^"]*"[^>]*?(?:id="([^"]+)")?[^>]*>([\s\S]*?)<\/section>/gi)
  );

  return pageMatches
    .map((match, index) => {
      const pageHtml = match[2];
      const firstAnchor = pageHtml.match(/id="([^"]+)"/i)?.[1] ?? match[1] ?? null;
      const text = normalizeWhitespace(cleanText(pageHtml));

      if (!text) {
        return null;
      }

      return {
        pageIndex: index,
        anchor: firstAnchor ? `#${firstAnchor}` : null,
        text
      };
    })
    .filter(Boolean);
}

function normalizeCanonicalPageIndex(block, index) {
  const pageNumber = Number(
    block?.print?.sourcePageNumber
    ?? block?.print?.pageNumber
    ?? index + 1
  );

  if (!Number.isFinite(pageNumber) || pageNumber <= 0) {
    return index;
  }

  return pageNumber - 1;
}

function buildCanonicalBlockText(block) {
  return normalizeWhitespace([
    block?.title,
    block?.summary,
    block?.bodyText,
    ...(block?.references ?? []),
    ...(block?.units ?? []).flatMap((unit) => [
      unit?.title,
      unit?.summary,
      unit?.text,
      ...(unit?.references ?? [])
    ])
  ].filter(Boolean).join(' '));
}

export function extractCanonicalSearchEntries(canonicalDocument) {
  return (canonicalDocument?.blocks ?? [])
    .map((block, index) => {
      const text = buildCanonicalBlockText(block);

      if (!text) {
        return null;
      }

      return {
        pageIndex: normalizeCanonicalPageIndex(block, index),
        anchor: block?.id ? `#${block.id}` : null,
        text
      };
    })
    .filter(Boolean);
}
