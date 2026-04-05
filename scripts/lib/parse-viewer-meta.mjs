import path from 'node:path';
import { extractNavItems } from './extract-nav-items.mjs';
import { cleanText, decodeHtmlEntities, escapeRegExp, normalizeWhitespace, sentenceCaseIfNeeded } from './text-utils.mjs';

function extractTagText(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match ? cleanText(match[1]) : '';
}

function extractClassText(html, className) {
  const classPattern = `class="(?:[^"]*\\s)?${escapeRegExp(className)}(?:\\s[^"]*)?"`;
  const match = html.match(new RegExp(`${classPattern}[^>]*>([\\s\\S]*?)<`, 'i'));
  return match ? normalizeWhitespace(decodeHtmlEntities(match[1])) : '';
}

function extractClassBlock(html, className) {
  const classPattern = `class="(?:[^"]*\\s)?${escapeRegExp(className)}(?:\\s[^"]*)?"`;
  const match = html.match(new RegExp(`<([a-z0-9-]+)[^>]*${classPattern}[^>]*>([\\s\\S]*?)</\\1>`, 'i'));
  return match ? match[2] : '';
}

function removeServicePhrases(value) {
  return normalizeWhitespace(
    String(value ?? '')
      .replace(/автономный html-viewer/gi, ' ')
      .replace(/исправленная версия a4/gi, ' ')
      .replace(/\bviewer\b/gi, ' ')
      .replace(/\(\s*iso[^)]*\)/gi, ' ')
      .replace(/издание официальное/gi, ' ')
  );
}

function removeGostNumberFromTitle(title, gostNumber) {
  if (!title) {
    return '';
  }

  const normalizedGost = escapeRegExp(gostNumber).replace(/[—-]/g, '[—-]');
  const pattern = new RegExp(normalizedGost, 'i');
  return normalizeWhitespace(title.replace(pattern, ' '));
}

function extractGostNumberFromText(value) {
  const match = String(value ?? '').match(/ГОСТ\s+[A-ZА-ЯЁ0-9./ -]+(?:—|-)\d{2,4}/i);
  return match ? normalizeWhitespace(match[0].replace(/\s+/g, ' ')) : '';
}

function normalizeGostNumber(gostNumber) {
  const trimmed = normalizeWhitespace(gostNumber);

  if (!trimmed) {
    return '';
  }

  const match = trimmed.match(/^(ГОСТ\s+.+?)(?:—|-)(\d{2,4})$/i);

  if (!match) {
    return trimmed.replace(/\s+/g, ' ');
  }

  return `${match[1].toUpperCase()}—${match[2]}`;
}

function inferGostNumberFromFilename(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const match = baseName.match(/^gost-(.+)$/i);

  if (!match) {
    return '';
  }

  const stem = match[1].replace(/-/g, ' ');
  const yearMatch = stem.match(/(.+)\s(\d{2,4})$/);

  if (!yearMatch) {
    return normalizeWhitespace(`ГОСТ ${stem.toUpperCase()}`);
  }

  return normalizeWhitespace(`ГОСТ ${yearMatch[1].toUpperCase()}—${yearMatch[2]}`);
}

function inferYear(gostNumber) {
  const yearPart = gostNumber.match(/(\d{2,4})$/)?.[1];

  if (!yearPart) {
    return null;
  }

  if (yearPart.length === 4) {
    return Number(yearPart);
  }

  const shortYear = Number(yearPart);
  return shortYear <= 30 ? 2000 + shortYear : 1900 + shortYear;
}

function extractTitleParts(html) {
  const leadTitle = sentenceCaseIfNeeded(extractClassText(html, 'cover-main-title'));
  const material = sentenceCaseIfNeeded(extractClassText(html, 'material')) || leadTitle;
  const method = sentenceCaseIfNeeded(extractClassText(html, 'method') || extractClassText(html, 'subtitle'));
  const coverBlock = extractClassBlock(html, 'cover-main-title')
    .replace(/<span[^>]*class="[^"]*\b(official|iso|en)\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ');
  const coverText = sentenceCaseIfNeeded(removeServicePhrases(cleanText(coverBlock)));
  const titleTag = removeServicePhrases(extractTagText(html, 'title'));

  if (material && method) {
    return {
      title: `${material}. ${method}`,
      shortTitle: method
    };
  }

  if (coverText) {
    const parts = coverText
      .split(/\s{2,}|\.\s+/)
      .map((part) => sentenceCaseIfNeeded(part))
      .filter(Boolean)
      .filter((part) => !/издание официальное/i.test(part) && !/\(iso/i.test(part));

    if (parts.length >= 2) {
      return {
        title: `${parts[0]}. ${parts[1]}`,
        shortTitle: parts[1]
      };
    }

    if (parts.length === 1) {
      return {
        title: parts[0],
        shortTitle: parts[0]
      };
    }
  }

  const cleanedTitle = normalizeWhitespace(titleTag);
  if (cleanedTitle) {
    return {
      title: sentenceCaseIfNeeded(cleanedTitle),
      shortTitle: sentenceCaseIfNeeded(cleanedTitle.split('. ').slice(-1)[0])
    };
  }

  return {
    title: '',
    shortTitle: ''
  };
}

function extractTags(title, shortTitle) {
  const tags = new Set(['ГОСТ']);
  const phrases = [title, shortTitle]
    .flatMap((value) => String(value ?? '').split('.'))
    .map((value) => normalizeWhitespace(value))
    .filter((value) => value && value.length <= 48);

  for (const phrase of phrases) {
    tags.add(phrase);
  }

  return Array.from(tags);
}

export function validateViewerHtmlBasic(html) {
  if (!String(html ?? '').trim()) {
    throw new Error('Viewer-файл пустой.');
  }

  const checks = [
    ['<html>', /<html[\s>]/i],
    ['<body>', /<body[\s>]/i],
    ['.app', /class="[^"]*\bapp\b[^"]*"/i],
    ['.sidebar', /class="[^"]*\bsidebar\b[^"]*"/i],
    ['.workspace', /class="[^"]*\bworkspace(?:-[a-z]+)?\b[^"]*"/i],
    ['.page', /class="[^"]*\bpage\b[^"]*"/i]
  ];

  for (const [label, pattern] of checks) {
    if (!pattern.test(html)) {
      throw new Error(`Viewer не прошёл базовую валидацию: отсутствует ${label}.`);
    }
  }
}

export function extractViewerMeta({ html, filePath }) {
  const sidebarTitle = extractClassText(html, 'sidebar-title');
  const titleTag = removeServicePhrases(extractTagText(html, 'title'));
  const firstHeading = sentenceCaseIfNeeded(
    extractClassText(html, 'cover-main-title') ||
    extractClassText(html, 'title-lg') ||
    extractClassText(html, 'preface-title')
  );

  const gostNumber = normalizeGostNumber(
    extractGostNumberFromText(sidebarTitle) ||
    extractGostNumberFromText(titleTag) ||
    extractGostNumberFromText(firstHeading) ||
    inferGostNumberFromFilename(filePath)
  );

  if (!gostNumber) {
    throw new Error('Не удалось определить номер ГОСТ по содержимому viewer или имени файла.');
  }

  const titleParts = extractTitleParts(html);
  const titleFromTag = removeGostNumberFromTitle(titleTag, gostNumber);
  const pages = Array.from(html.matchAll(/class="[^"]*\bpage\b[^"]*"/gi)).length;

  return {
    gostNumber,
    title: titleParts.title || titleFromTag || gostNumber,
    shortTitle: titleParts.shortTitle || titleParts.title || titleFromTag || gostNumber,
    year: inferYear(gostNumber),
    pages,
    language: 'ru',
    status: 'active',
    sourceType: 'html-viewer',
    viewerVersion: '1.0.0',
    description: `Автономный viewer ${gostNumber}.`,
    tags: extractTags(titleParts.title, titleParts.shortTitle),
    hasInternalSearch: /id="docSearchInput"/i.test(html),
    hasThemeToggle: /id="themeToggleBtn"/i.test(html) || /data-theme="dark"/i.test(html),
    hasPrintMode: /@media\s+print/i.test(html),
    hasQuickNav: /id="pageList"/i.test(html),
    hasBackNavigation: /id="biblioBackBtn"/i.test(html) && /(history\.back|biblioBackBtn\.addEventListener)/i.test(html),
    navItems: extractNavItems(html)
  };
}
