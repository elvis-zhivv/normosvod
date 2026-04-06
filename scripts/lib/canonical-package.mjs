import { buildSlug } from './slugify.mjs';
import { normalizeDocType } from './doc-type.mjs';
import { inferThemeId } from './theme.mjs';

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function inferPagesFromBlocks(blocks = []) {
  const pageNumbers = blocks
    .map((block) => Number(block?.print?.sourcePageNumber ?? block?.print?.pageNumber))
    .filter(Number.isFinite);

  return pageNumbers.length ? Math.max(...pageNumbers) : 0;
}

function inferNavItemsFromOutline(outline = [], blocks = []) {
  if (outline.length) {
    return outline.map((item, index) => ({
      label: item?.title ?? `Раздел ${index + 1}`,
      targetPageIndex: Math.max(0, Number(item?.pageNumber ?? 1) - 1),
      targetSelector: item?.id ? `#${item.id}` : null
    }));
  }

  return blocks.map((block, index) => ({
    label: block?.title ?? `Раздел ${index + 1}`,
    targetPageIndex: Math.max(0, Number(block?.print?.sourcePageNumber ?? block?.print?.pageNumber ?? 1) - 1),
    targetSelector: block?.id ? `#${block.id}` : null
  }));
}

function collectTags(canonicalDocument) {
  const collected = new Set(
    [
      canonicalDocument?.meta?.gostNumber,
      canonicalDocument?.meta?.shortTitle,
      ...(canonicalDocument?.entities ?? []).map((item) => item?.label)
    ]
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .slice(0, 12)
  );

  if (!collected.has('ГОСТ')) {
    collected.add('ГОСТ');
  }

  return Array.from(collected);
}

export function normalizeCanonicalPackage(rawDocument) {
  if (!rawDocument || typeof rawDocument !== 'object') {
    throw new Error('Canonical package пустой или имеет неверный формат.');
  }

  if (rawDocument.kind !== 'normosvod-canonical-document') {
    throw new Error('Canonical package должен иметь kind="normosvod-canonical-document".');
  }

  const gostNumber = String(rawDocument?.meta?.gostNumber ?? '').trim();

  if (!gostNumber) {
    throw new Error('В canonical package отсутствует meta.gostNumber.');
  }

  const slug = String(rawDocument.slug ?? buildSlug(gostNumber)).trim();

  if (!slug) {
    throw new Error('Не удалось определить slug canonical package.');
  }

  const blocks = normalizeArray(rawDocument.blocks);

  if (!blocks.length) {
    throw new Error('В canonical package отсутствуют blocks.');
  }

  const outline = normalizeArray(rawDocument.outline);
  const pages = Number(rawDocument?.meta?.pages) || inferPagesFromBlocks(blocks);
  const tags = collectTags(rawDocument);
  const docType = normalizeDocType(rawDocument?.meta?.docType ?? rawDocument?.docType, {
    gostNumber,
    title: rawDocument?.meta?.title,
    shortTitle: rawDocument?.meta?.shortTitle
  });

  return {
    ...rawDocument,
    slug,
    docType,
    meta: {
      ...rawDocument.meta,
      gostNumber,
      title: String(rawDocument?.meta?.title ?? gostNumber).trim(),
      shortTitle: String(rawDocument?.meta?.shortTitle ?? rawDocument?.meta?.title ?? gostNumber).trim(),
      docType,
      status: rawDocument?.meta?.status ?? 'active',
      language: rawDocument?.meta?.language ?? 'ru',
      pages,
      themeId: rawDocument?.meta?.themeId || inferThemeId({
        gostNumber,
        title: rawDocument?.meta?.title,
        shortTitle: rawDocument?.meta?.shortTitle,
        description: rawDocument?.synopsis?.description,
        tags
      }),
      readerMode: rawDocument?.meta?.readerMode ?? 'v2',
      migrationStatus: rawDocument?.meta?.migrationStatus ?? 'print-verified'
    },
    outline,
    blocks,
    entities: normalizeArray(rawDocument.entities),
    relations: normalizeArray(rawDocument.relations),
    definitions: normalizeArray(rawDocument.definitions),
    highlights: normalizeArray(rawDocument.highlights),
    relatedNorms: normalizeArray(rawDocument.relatedNorms),
    synopsis: {
      description: rawDocument?.synopsis?.description ?? `Canonical package ${gostNumber}.`,
      keyTakeaways: normalizeArray(rawDocument?.synopsis?.keyTakeaways)
    },
    curation: {
      applied: Boolean(rawDocument?.curation?.applied),
      hiddenBlocksCount: Number(rawDocument?.curation?.hiddenBlocksCount ?? 0) || 0,
      overrideVersion: rawDocument?.curation?.overrideVersion ?? null
    },
    source: {
      type: rawDocument?.source?.type ?? 'canonical-package'
    },
    entryPoints: {
      screenUrl: `/doc/${slug}`,
      legacyUrl: rawDocument?.entryPoints?.legacyUrl ?? '',
      printUrl: `/docs/${slug}/print.html`
    },
    tags,
    navItems: inferNavItemsFromOutline(outline, blocks)
  };
}

export function buildMetaFromCanonicalPackage(canonicalDocument, { fileHash, importedAt, updatedAt }) {
  return {
    id: canonicalDocument.slug,
    slug: canonicalDocument.slug,
    gostNumber: canonicalDocument.meta.gostNumber,
    title: canonicalDocument.meta.title,
    shortTitle: canonicalDocument.meta.shortTitle,
    docType: canonicalDocument.meta.docType ?? canonicalDocument.docType,
    year: canonicalDocument.meta.year ?? null,
    status: canonicalDocument.meta.status,
    language: canonicalDocument.meta.language,
    pages: canonicalDocument.meta.pages,
    metaUrl: `/docs/${canonicalDocument.slug}/meta.json`,
    canonicalDocumentUrl: `/data/canonical/${canonicalDocument.slug}.json`,
    v2DocumentUrl: `/data/canonical/${canonicalDocument.slug}.json`,
    searchTextUrl: '/data/search-index.json',
    tags: canonicalDocument.tags,
    sourceType: 'canonical-document',
    sourceLabel: 'Canonical document',
    importedAt,
    updatedAt,
    fileHash,
    description: canonicalDocument.synopsis?.description ?? `Canonical package ${canonicalDocument.meta.gostNumber}.`,
    navItemsCount: canonicalDocument.navItems.length,
    navItems: canonicalDocument.navItems,
    themeId: canonicalDocument.meta.themeId,
    readerMode: canonicalDocument.meta.readerMode,
    migrationStatus: canonicalDocument.meta.migrationStatus,
    hasInternalSearch: false,
    hasThemeToggle: false,
    hasPrintMode: true,
    hasQuickNav: true,
    hasBackNavigation: false
  };
}
