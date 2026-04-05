import { cleanText } from './text-utils.mjs';

function findSelectorOffset(pageHtml, targetSelector) {
  if (!targetSelector || !String(targetSelector).startsWith('#')) {
    return 0;
  }

  const selectorId = String(targetSelector).slice(1);

  if (!selectorId) {
    return 0;
  }

  const patterns = [
    `id="${selectorId}"`,
    `id='${selectorId}'`
  ];

  for (const pattern of patterns) {
    const index = pageHtml.indexOf(pattern);
    if (index >= 0) {
      const tagStart = pageHtml.lastIndexOf('<', index);
      return tagStart >= 0 ? tagStart : index;
    }
  }

  return 0;
}

export function extractPageMarkupEntries(html) {
  const source = String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const pageMatches = Array.from(
    source.matchAll(/<section[^>]*class="[^"]*\bpage\b[^"]*"[^>]*>([\s\S]*?)<\/section>/gi)
  );

  return pageMatches.map((match, index) => ({
    pageIndex: index,
    pageHtml: match[1]
  }));
}

function buildBoundaries(navItems, pages) {
  return (navItems ?? []).map((item, index) => {
    const pageIndex = Number(item?.targetPageIndex ?? index);
    const pageHtml = pages[pageIndex]?.pageHtml ?? '';
    const offset = findSelectorOffset(pageHtml, item?.targetSelector);

    return {
      index,
      pageIndex,
      offset
    };
  });
}

function sliceAcrossPages(pages, startBoundary, endBoundary) {
  if (!startBoundary || !pages.length) {
    return '';
  }

  const startPageIndex = Math.max(0, startBoundary.pageIndex);
  const endPageIndex = endBoundary ? Math.max(startPageIndex, endBoundary.pageIndex) : pages.length - 1;
  const parts = [];

  for (let pageIndex = startPageIndex; pageIndex <= endPageIndex; pageIndex += 1) {
    const pageHtml = pages[pageIndex]?.pageHtml ?? '';

    if (!pageHtml) {
      continue;
    }

    if (pageIndex === startPageIndex && pageIndex === endPageIndex) {
      parts.push(pageHtml.slice(startBoundary.offset, endBoundary ? endBoundary.offset : undefined));
      continue;
    }

    if (pageIndex === startPageIndex) {
      parts.push(pageHtml.slice(startBoundary.offset));
      continue;
    }

    if (pageIndex === endPageIndex) {
      parts.push(pageHtml.slice(0, endBoundary ? endBoundary.offset : undefined));
      continue;
    }

    parts.push(pageHtml);
  }

  return parts.join('\n');
}

export function extractBlockFragmentsFromViewer(html, navItems = []) {
  const pages = extractPageMarkupEntries(html);
  const boundaries = buildBoundaries(navItems, pages);

  return boundaries.map((boundary, index) => {
    const nextBoundary = boundaries[index + 1] ?? null;
    const fragmentHtml = sliceAcrossPages(pages, boundary, nextBoundary);

    return {
      pageIndex: boundary.pageIndex,
      targetSelector: navItems[index]?.targetSelector ?? null,
      html: fragmentHtml,
      text: cleanText(fragmentHtml)
    };
  });
}
