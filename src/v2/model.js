function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е');
}

function inferThemeId(document) {
  const haystack = normalizeText([
    document?.gostNumber,
    document?.title,
    document?.description,
    ...(document?.tags ?? [])
  ].join(' '));

  if (/(лакокрас|покрыт|укрывист|цвет|метамери|испытан)/.test(haystack)) {
    return 'coatings';
  }

  if (/(пожар|огне|эвакуац|горюч|дым)/.test(haystack)) {
    return 'fire-safety';
  }

  if (/(строит|инженер|монтаж|конструкц|здание)/.test(haystack)) {
    return 'construction';
  }

  return 'regulation';
}

function inferBlockType(label) {
  const normalized = normalizeText(label);

  if (normalized.includes('термины') || normalized.includes('определени')) {
    return 'definition-set';
  }

  if (normalized.includes('нормативные ссылки')) {
    return 'references';
  }

  if (normalized.includes('требования')) {
    return 'requirements';
  }

  if (normalized.includes('испытан') || normalized.includes('проведение')) {
    return 'procedure';
  }

  if (normalized.includes('обработка результатов') || normalized.includes('оценка')) {
    return 'analysis';
  }

  if (normalized.includes('приложение')) {
    return 'appendix';
  }

  if (normalized.includes('библиограф')) {
    return 'bibliography';
  }

  return 'section';
}

function buildReferenceBadges(blocks = []) {
  return Array.from(new Set(blocks.flatMap((block) => [
    ...(block.references ?? []),
    ...(block.units ?? []).flatMap((unit) => unit.references ?? [])
  ]))).slice(0, 10);
}

export function buildFallbackV2Document(document) {
  const themeId = document.themeId || inferThemeId(document);
  const blocks = (document.navItems ?? []).map((item, index) => ({
    id: `${document.slug}-fallback-${index + 1}`,
    type: inferBlockType(item.label),
    title: item.label,
    summary: `Fallback V2 block, сформированный из legacy navigation item. Страница ${Number(item.targetPageIndex ?? index) + 1}.`,
    legacy: {
      pageIndex: Number(item.targetPageIndex ?? index),
      targetSelector: item.targetSelector ?? null
    },
    print: {
      pageNumber: Number(item.targetPageIndex ?? index) + 1
    }
  }));

  return {
    slug: document.slug,
    meta: {
      gostNumber: document.gostNumber,
      title: document.title,
      year: document.year,
      pages: document.pages,
      themeId,
      readerMode: document.readerMode ?? 'legacy',
      migrationStatus: document.migrationStatus ?? 'imported'
    },
    synopsis: {
      description: document.description ?? `Fallback-модель V2 для ${document.gostNumber}.`,
      keyTakeaways: [
        'Документ открыт в scaffold режиме V2.',
        'Контент reader собран из manifest и navigation данных legacy viewer.',
        'Полная semantic migration ещё не выполнена.'
      ]
    },
    source: {
      type: 'legacy-fallback'
    },
    outline: blocks.map((block) => ({
      id: block.id,
      title: block.title,
      type: block.type,
      pageNumber: block.print.pageNumber
    })),
    blocks,
    entities: (document.tags ?? []).slice(0, 6).map((tag, index) => ({
      id: `${document.slug}-entity-${index + 1}`,
      type: index === 0 ? 'document-class' : 'topic',
      label: tag
    })),
    relations: blocks.slice(1).map((block, index) => ({
      from: blocks[index].id,
      to: block.id,
      type: 'next-block'
    })),
    definitions: [],
    highlights: [],
    relatedNorms: [],
    curation: {
      applied: false,
      hiddenBlocksCount: 0,
      overrideVersion: null
    },
    entryPoints: {
      legacyUrl: document.legacyViewerUrl || document.viewerUrl,
      printUrl: document.printUrl || document.viewerUrl
    },
    referenceBadges: buildReferenceBadges(blocks)
  };
}

export function normalizeV2Document(rawDocument, fallbackDocument) {
  const fallback = buildFallbackV2Document(fallbackDocument);

  if (!rawDocument || typeof rawDocument !== 'object') {
    return fallback;
  }

  return {
    ...fallback,
    ...rawDocument,
    meta: {
      ...fallback.meta,
      ...(rawDocument.meta ?? {})
    },
    synopsis: {
      ...fallback.synopsis,
      ...(rawDocument.synopsis ?? {})
    },
    source: {
      ...(fallback.source ?? {}),
      ...(rawDocument.source ?? {})
    },
    referenceBadges: Array.isArray(rawDocument.referenceBadges)
      ? rawDocument.referenceBadges
      : buildReferenceBadges(rawDocument.blocks ?? fallback.blocks)
  };
}
