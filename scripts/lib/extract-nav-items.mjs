import vm from 'node:vm';
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

function parseNavItemsLiteral(html) {
  const match = html.match(/const\s+NAV_ITEMS\s*=\s*(\[[\s\S]*?\]);/);

  if (!match) {
    return [];
  }

  try {
    const value = vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 200 });
    return sanitizeNavItems(Array.isArray(value) ? value : []);
  } catch {
    return [];
  }
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
