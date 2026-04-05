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
