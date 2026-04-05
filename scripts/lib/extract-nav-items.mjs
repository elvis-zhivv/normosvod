import { cleanText, normalizeWhitespace } from './text-utils.mjs';

function sanitizeNavItems(items) {
  return items
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => ({
      label: normalizeWhitespace(item.label ?? item.title ?? `Раздел ${index + 1}`),
      targetPageIndex: Number.isFinite(Number(item.targetPageIndex ?? item.pageIndex ?? item.page))
        ? Number(item.targetPageIndex ?? item.pageIndex ?? item.page)
        : index,
      targetSelector: item.targetSelector ?? item.selector ?? item.target ?? null
    }))
    .filter((item) => item.label);
}

function unescapeJsString(value) {
  return String(value ?? '')
    .replace(/\\'/g, '\'')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function readObjectString(objectLiteral, fieldName) {
  const match = objectLiteral.match(
    new RegExp(`\\b${fieldName}\\s*:\\s*(['"])((?:\\\\.|(?!\\1)[\\s\\S])*?)\\1`)
  );

  return match ? unescapeJsString(match[2]) : null;
}

function readObjectNumber(objectLiteral, fieldName) {
  const match = objectLiteral.match(new RegExp(`\\b${fieldName}\\s*:\\s*(-?\\d+)`));
  return match ? Number(match[1]) : null;
}

function parseNavItemsLiteral(html) {
  const match = html.match(/const\s+NAV_ITEMS\s*=\s*(\[[\s\S]*?\]);/);

  if (!match) {
    return [];
  }

  const arraySource = match[1];
  const objectMatches = Array.from(arraySource.matchAll(/\{[\s\S]*?\}/g));
  const items = [];

  for (const objectMatch of objectMatches) {
    const objectLiteral = objectMatch[0];
    const label = readObjectString(objectLiteral, 'label') ?? readObjectString(objectLiteral, 'title');
    const targetPageIndex = readObjectNumber(objectLiteral, 'targetPageIndex')
      ?? readObjectNumber(objectLiteral, 'pageIndex')
      ?? readObjectNumber(objectLiteral, 'page');
    const targetSelector = readObjectString(objectLiteral, 'targetSelector')
      ?? readObjectString(objectLiteral, 'selector')
      ?? readObjectString(objectLiteral, 'target');

    items.push({
      label,
      targetPageIndex,
      targetSelector
    });
  }

  return sanitizeNavItems(items);
}

function extractFallbackNavItems(html) {
  const pageMatches = Array.from(
    html.matchAll(/<section[^>]*class="[^"]*\bpage\b[^"]*"[^>]*?(?:id="([^"]+)")?[^>]*>([\s\S]*?)<\/section>/gi)
  );

  const navItems = [];

  for (const [pageIndex, pageMatch] of pageMatches.entries()) {
    const pageId = pageMatch[1];
    const pageHtml = pageMatch[2];
    let pageItemsAdded = 0;
    const structuralMatches = Array.from(
      pageHtml.matchAll(
        /<(?:div|h[1-6]|section)[^>]*(?:class="([^"]*)"[^>]*id="([^"]+)"|id="([^"]+)"[^>]*class="([^"]*)")[^>]*>([\s\S]*?)<\/(?:div|h[1-6]|section)>/gi
      )
    );

    for (const match of structuralMatches) {
      const classes = `${match[1] ?? ''} ${match[4] ?? ''}`;
      const id = match[2] ?? match[3];
      const label = cleanText(match[5]);

      if (!id || !label) {
        continue;
      }

      if (!/\b(section|subsection|title|preface-title|std-subtitle)\b/i.test(classes) && match[0][1] !== 'h') {
        continue;
      }

      navItems.push({
        label,
        targetPageIndex: pageIndex,
        targetSelector: `#${id}`
      });
      pageItemsAdded += 1;
    }

    if (pageItemsAdded === 0 && pageId) {
      navItems.push({
        label: pageId,
        targetPageIndex: pageIndex,
        targetSelector: `#${pageId}`
      });
    }
  }

  return navItems.slice(0, 80);
}

export function extractNavItems(html) {
  const fromLiteral = parseNavItemsLiteral(html);
  if (fromLiteral.length > 0) {
    return fromLiteral;
  }

  return extractFallbackNavItems(html);
}
