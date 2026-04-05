import { buildSlug } from './slugify.mjs';
import { inferThemeId } from './theme.mjs';
import { extractBlockFragmentsFromViewer } from './viewer-fragments.mjs';
import { cleanText } from './text-utils.mjs';

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceCase(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeReferenceLabel(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!text) {
    return '';
  }

  if (/^ISO(?:\/CIE)?/i.test(text)) {
    return text.replace(/^iso(?:\/cie)?/i, (match) => match.toUpperCase());
  }

  if (/^ASTM/i.test(text)) {
    return text.replace(/^astm/i, 'ASTM');
  }

  if (/^ГОСТ(?:\s*Р)?/iu.test(text)) {
    return text.replace(/^гост(?:\s*р)?/iu, (match) => match.toUpperCase());
  }

  if (/^ФЗ/iu.test(text)) {
    return text.replace(/^фз/iu, 'ФЗ');
  }

  return sentenceCase(text);
}

function buildUnitId(blockId, label, index) {
  return buildSlug(`${blockId}-${label || `unit-${index + 1}`}`) || `${blockId}-unit-${index + 1}`;
}

export function inferBlockType(label) {
  const normalizedLabel = normalizeText(label);

  if (normalizedLabel.includes('термины') || normalizedLabel.includes('определени')) {
    return 'definition-set';
  }

  if (normalizedLabel.includes('нормативные ссылки')) {
    return 'references';
  }

  if (normalizedLabel.includes('требования')) {
    return 'requirements';
  }

  if (normalizedLabel.includes('испытан') || normalizedLabel.includes('проведение')) {
    return 'procedure';
  }

  if (normalizedLabel.includes('обработка результатов') || normalizedLabel.includes('оценка')) {
    return 'analysis';
  }

  if (normalizedLabel.includes('протокол')) {
    return 'report';
  }

  if (normalizedLabel.includes('приложение')) {
    return 'appendix';
  }

  if (normalizedLabel.includes('библиограф')) {
    return 'bibliography';
  }

  if (
    normalizedLabel.includes('предислов') ||
    normalizedLabel.includes('введение') ||
    normalizedLabel.includes('издательские сведения') ||
    normalizedLabel.includes('ключевые слова')
  ) {
    return 'meta';
  }

  return 'section';
}

function pickPageEntry(searchEntries, pageIndex) {
  return searchEntries.find((entry) => Number(entry.pageIndex) === Number(pageIndex)) ?? null;
}

function tokenizeLabel(label) {
  const normalized = normalizeText(label)
    .replace(/[«»"'()]/g, ' ')
    .replace(/\s+/g, ' ');

  return normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 8);
}

function buildSnippet(text, label, maxLength = 460) {
  const compactText = String(text ?? '').replace(/\s+/g, ' ').trim();

  if (!compactText) {
    return '';
  }

  const tokens = tokenizeLabel(label);
  const normalizedPageText = normalizeText(compactText);

  let matchIndex = -1;

  for (const token of tokens) {
    const tokenIndex = normalizedPageText.indexOf(token);
    if (tokenIndex >= 0) {
      matchIndex = tokenIndex;
      break;
    }
  }

  if (matchIndex < 0) {
    return compactText.slice(0, maxLength).trim();
  }

  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(compactText.length, start + maxLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < compactText.length ? '…' : '';

  return `${prefix}${compactText.slice(start, end).trim()}${suffix}`;
}

function buildUnitSnippet(text, maxLength = 220) {
  const compactText = String(text ?? '').replace(/\s+/g, ' ').trim();

  if (!compactText) {
    return '';
  }

  return compactText.length > maxLength
    ? `${compactText.slice(0, maxLength).trim()}…`
    : compactText;
}

function buildHighlightId(blockId, type, index) {
  return `${blockId}-${type}-${index + 1}`;
}

function buildRelatedNormId(label, index) {
  return buildSlug(`related-${label}`) || `related-${index + 1}`;
}

function extractReferencesFromText(text) {
  const source = String(text ?? '');
  const patterns = [
    /ГОСТ(?:\s*Р)?\s*[\d]+(?:[.\-—]\d+)*(?:\s*[—-]\s*\d{2,4})?/giu,
    /ФЗ\s*№?\s*[\d-]+/giu,
    /ISO(?:\/CIE)?\s*\d+(?:-\d+)?(?::\d{4})?/giu,
    /ASTM\s*[A-ZА-Я]\d+(?:-\d+)*(?::\d{4})?/giu
  ];

  const found = new Set();

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = sentenceCase(String(match[0]).replace(/\s+/g, ' ').trim());
      const normalizedValue = normalizeReferenceLabel(value);

      if (normalizedValue) {
        found.add(normalizedValue);
      }
    }
  }

  return Array.from(found).slice(0, 12);
}

function extractKeywordSnippet(text, keyword, maxLength = 220) {
  const compactText = String(text ?? '').replace(/\s+/g, ' ').trim();

  if (!compactText) {
    return '';
  }

  const normalizedText = normalizeText(compactText);
  const normalizedKeyword = normalizeText(keyword);
  const matchIndex = normalizedText.indexOf(normalizedKeyword);

  if (matchIndex < 0) {
    return buildUnitSnippet(compactText, maxLength);
  }

  const start = Math.max(0, matchIndex - 60);
  const end = Math.min(compactText.length, start + maxLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < compactText.length ? '…' : '';

  return `${prefix}${compactText.slice(start, end).trim()}${suffix}`;
}

function extractNestedUnits(fragmentHtml, block) {
  const source = String(fragmentHtml ?? '');

  if (!source.trim()) {
    return [];
  }

  const matches = Array.from(
    source.matchAll(/<(?<tag>div|p|table)(?<attrs>[^>]*)>(?<inner>[\s\S]*?)<\/\1>/gi)
  );

  const units = [];

  for (const [index, match] of matches.entries()) {
    const tagName = String(match.groups?.tag ?? match[1] ?? '').toLowerCase();
    const attrs = String(match.groups?.attrs ?? '');
    const className = (
      attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.[1] ??
      attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.[2] ??
      ''
    );
    const innerHtml = String(match.groups?.inner ?? match[3] ?? '');
    const text = innerHtml ? cleanText(innerHtml) : '';

    if (!text) {
      continue;
    }

    let type = 'paragraph';
    let title = '';

    if (/\bsection\b/i.test(className)) {
      type = 'section-heading';
      title = text;
    } else if (/\bsubsection\b/i.test(className)) {
      type = 'subsection-heading';
      title = text;
    } else if (/\bappendix-title\b/i.test(className) || /\btitle-md\b/i.test(className)) {
      type = 'heading';
      title = text;
    } else if (/\btbl-caption\b/i.test(className)) {
      type = 'table-caption';
      title = text;
    } else if (tagName === 'table') {
      type = 'table';
      title = 'Таблица';
    } else if (/note-label/i.test(innerHtml)) {
      type = 'note';
      title = 'Примечание';
    } else if (block.type === 'definition-set' && /^\d+(?:\.\d+)+/.test(text)) {
      type = 'definition';
      title = text.split(':')[0] || text;
    } else if (block.type === 'bibliography' && /^\[\d+\]/.test(text)) {
      type = 'bibliography-item';
      title = text.split(' ').slice(0, 4).join(' ');
    } else if (/^[а-яa-z]\)|^\d+[.)]/i.test(text)) {
      type = 'list-item';
      title = text.split(' ').slice(0, 4).join(' ');
    }

    units.push({
      id: buildUnitId(block.id, title || text.slice(0, 48), index),
      order: units.length,
      type,
      title: title || null,
      text,
      summary: buildUnitSnippet(text),
      references: extractReferencesFromText(text)
    });
  }

  return units;
}

function buildBlockHighlights(block, sourceText, units = []) {
  const candidates = [
    { text: sourceText, unitId: null },
    ...units.map((unit) => ({ text: unit.text, unitId: unit.id }))
  ];
  const highlightRules = [
    { type: 'warning', keyword: 'не допускается', label: 'Не допускается' },
    { type: 'warning', keyword: 'запрещается', label: 'Запрещается' },
    { type: 'requirement', keyword: 'должен', label: 'Требование' },
    { type: 'requirement', keyword: 'следует', label: 'Следует' },
    { type: 'requirement', keyword: 'необходимо', label: 'Необходимо' },
    { type: 'advice', keyword: 'рекомендуется', label: 'Рекомендуется' },
    { type: 'note', keyword: 'примечание', label: 'Примечание' }
  ];
  const highlights = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate.text);

    if (!normalizedCandidate) {
      continue;
    }

    for (const rule of highlightRules) {
      if (!normalizedCandidate.includes(rule.keyword)) {
        continue;
      }

      const snippet = extractKeywordSnippet(candidate.text, rule.keyword);
      const dedupeKey = `${rule.type}:${snippet}`;

      if (!snippet || seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      highlights.push({
        id: buildHighlightId(block.id, rule.type, highlights.length),
        type: rule.type,
        label: rule.label,
        text: snippet,
        unitId: candidate.unitId
      });

      if (highlights.length >= 4) {
        return highlights;
      }
    }
  }

  return highlights;
}

function extractDefinitions(blocks) {
  const definitions = [];

  for (const block of blocks) {
    if (block.type !== 'definition-set') {
      continue;
    }

    const candidates = (block.units?.length ? block.units : [{ id: null, text: block.bodyText ?? '' }])
      .map((item) => ({
        unitId: item.id ?? null,
        text: String(item.text ?? '').replace(/\s+/g, ' ').trim()
      }))
      .filter((item) => item.text);

    for (const candidate of candidates) {
      const match = candidate.text.match(/^\s*(\d+(?:\.\d+)+)\s+(.+?)\s*[—:-]\s*(.+)$/u);

      if (!match) {
        continue;
      }

      const term = String(match[2] ?? '').trim();
      const description = String(match[3] ?? '').trim();

      if (!term || !description) {
        continue;
      }

      definitions.push({
        id: buildSlug(`${block.id}-${term}`) || `${block.id}-definition-${definitions.length + 1}`,
        term,
        summary: buildUnitSnippet(description, 180),
        blockId: block.id,
        unitId: candidate.unitId
      });
    }
  }

  return definitions.slice(0, 16);
}

function buildRelatedNorms(blocks) {
  const relatedNormMap = new Map();

  for (const block of blocks) {
    const labels = [
      ...(block.references ?? []),
      ...(block.units ?? []).flatMap((unit) => unit.references ?? [])
    ];

    for (const label of labels) {
      const key = normalizeText(label);

      if (!key) {
        continue;
      }

      const existing = relatedNormMap.get(key) ?? {
        label,
        sourceBlockIds: new Set(),
        occurrenceCount: 0
      };

      existing.sourceBlockIds.add(block.id);
      existing.occurrenceCount += 1;
      relatedNormMap.set(key, existing);
    }
  }

  return Array.from(relatedNormMap.values())
    .map((entry, index) => ({
      id: buildRelatedNormId(entry.label, index),
      label: entry.label,
      type: 'reference',
      sourceBlockIds: Array.from(entry.sourceBlockIds),
      occurrenceCount: entry.occurrenceCount
    }))
    .slice(0, 20);
}

function buildEntities(document, blocks) {
  const baseEntities = (document.tags ?? [])
    .filter(Boolean)
    .slice(0, 8)
    .map((tag, index) => ({
      id: `entity-topic-${index + 1}`,
      type: index === 0 ? 'document-class' : 'topic',
      label: tag
    }));

  const referenceLabels = Array.from(
    new Set(blocks.flatMap((block) => [
      ...(block.references ?? []),
      ...(block.units ?? []).flatMap((unit) => unit.references ?? [])
    ]))
  ).slice(0, 16);

  const referenceEntities = referenceLabels.map((label, index) => ({
    id: `entity-ref-${index + 1}`,
    type: 'reference',
    label
  }));

  return [...baseEntities, ...referenceEntities];
}

function buildRelations(blocks) {
  const nextRelations = blocks
    .slice(1)
    .map((block, index) => ({
      from: blocks[index].id,
      to: block.id,
      type: 'next-block'
    }));

  const referenceRelations = [];

  for (const block of blocks) {
    for (const reference of block.references ?? []) {
      referenceRelations.push({
        from: block.id,
        toLabel: reference,
        type: 'references-document'
      });
    }
  }

  return [...nextRelations, ...referenceRelations];
}

function buildTakeaways(document, blocks) {
  const blockCount = blocks.length;
  const definitionCount = blocks.filter((block) => block.type === 'definition-set').length;
  const referenceCount = Array.from(new Set(blocks.flatMap((block) => [
    ...(block.references ?? []),
    ...(block.units ?? []).flatMap((unit) => unit.references ?? [])
  ]))).length;
  const unitCount = blocks.reduce((sum, block) => sum + Number(block.units?.length ?? 0), 0);
  const highlightCount = blocks.reduce((sum, block) => sum + Number(block.highlights?.length ?? 0), 0);

  return [
    `${document.gostNumber} сегментирован в ${blockCount} block units для V2 reader.`,
    `Во внутренних fragment-узлах выделено semantic units: ${unitCount}.`,
    highlightCount > 0
      ? `Практические акценты автоматически выделены: ${highlightCount}.`
      : 'Практические акценты пока не выделены автоматически.',
    definitionCount > 0
      ? `В документе выявлены блоки определений: ${definitionCount}.`
      : 'Блоки определений автоматически не выявлены, требуется ручная разметка.',
    referenceCount > 0
      ? `Из текста извлечено нормативных ссылок: ${referenceCount}.`
      : 'Нормативные ссылки автоматически не извлечены, требуется ручная верификация.'
  ];
}

export function buildCanonicalDocument(document, searchIndexEntry, html = '') {
  const searchEntries = Array.isArray(searchIndexEntry?.entries) ? searchIndexEntry.entries : [];
  const navItems = Array.isArray(document.navItems) ? document.navItems : [];
  const themeId = document.themeId || inferThemeId(document);
  const fragments = html ? extractBlockFragmentsFromViewer(html, navItems) : [];

  const blocks = navItems.map((item, index) => {
    const blockId = buildSlug(`${document.slug}-${item.label || `block-${index + 1}`}`) || `${document.slug}-block-${index + 1}`;
    const blockType = inferBlockType(item.label);
    const pageIndex = Number(item.targetPageIndex ?? index);
    const pageEntry = pickPageEntry(searchEntries, pageIndex);
    const fragment = fragments[index] ?? null;
    const sourceText = fragment?.text || pageEntry?.text || '';
    const summary = buildSnippet(sourceText, item.label);
    const references = extractReferencesFromText(sourceText);
    const units = extractNestedUnits(fragment?.html ?? '', { id: blockId, type: blockType });
    const highlights = buildBlockHighlights({ id: blockId, type: blockType }, sourceText, units);

    return {
      id: blockId,
      order: index,
      type: blockType,
      title: item.label || `Блок ${index + 1}`,
      summary,
      bodyText: sourceText,
      references,
      units,
      highlights,
      legacy: {
        pageIndex,
        targetSelector: item.targetSelector ?? null,
        pageAnchor: pageEntry?.anchor ?? null
      },
      print: {
        pageNumber: pageIndex + 1,
        pageAnchor: item.targetSelector ?? pageEntry?.anchor ?? null
      },
      migration: {
        source: 'legacy-viewer',
        confidence: fragment?.text ? 'high' : (item.targetSelector || pageEntry?.anchor ? 'medium' : 'low')
      }
    };
  });

  const definitions = extractDefinitions(blocks);
  const relatedNorms = buildRelatedNorms(blocks);
  const entities = buildEntities(document, blocks);
  const relations = buildRelations(blocks);
  const highlights = blocks.flatMap((block) => block.highlights ?? []).slice(0, 12);

  return {
    version: '0.2.0',
    kind: 'normosvod-canonical-document',
    slug: document.slug,
    meta: {
      gostNumber: document.gostNumber,
      title: document.title,
      shortTitle: document.shortTitle,
      year: document.year,
      status: document.status,
      language: document.language,
      pages: document.pages,
      themeId,
      readerMode: document.readerMode || 'legacy',
      migrationStatus: document.migrationStatus || 'segmented'
    },
    synopsis: {
      description: document.description || `Canonical document model для ${document.gostNumber}.`,
      keyTakeaways: buildTakeaways(document, blocks)
    },
    source: {
      type: 'legacy-viewer',
      viewerUrl: document.legacyViewerUrl || document.viewerUrl,
      searchIndexSource: '/data/search-index.json'
    },
    entryPoints: {
      screenUrl: `/doc/${encodeURIComponent(document.slug)}?view=v2`,
      legacyUrl: document.legacyViewerUrl || document.viewerUrl,
      printUrl: document.printUrl || document.viewerUrl
    },
    outline: blocks.map((block) => ({
      id: block.id,
      title: block.title,
      type: block.type,
      pageNumber: block.print.pageNumber
    })),
    blocks,
    definitions,
    highlights,
    relatedNorms,
    entities,
    relations,
    printMap: blocks.map((block) => ({
      blockId: block.id,
      pageNumber: block.print.pageNumber,
      pageAnchor: block.print.pageAnchor
    }))
  };
}
