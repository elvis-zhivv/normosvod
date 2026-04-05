import { inferThemeId } from './theme.mjs';

function normalizeReaderMode(value) {
  const supported = new Set(['legacy', 'hybrid', 'v2']);
  return supported.has(value) ? value : 'legacy';
}

function normalizeMigrationStatus(value) {
  const supported = new Set(['imported', 'segmented', 'entity-linked', 'print-verified', 'v2-ready']);
  return supported.has(value) ? value : 'imported';
}

export function enrichDocumentRecord(record) {
  const viewerUrl = record.viewerUrl || `/docs/${record.slug}/viewer.html`;
  const slug = record.slug;
  const printUrl = record.printUrl || `/docs/${slug}/print.html`;

  return {
    ...record,
    themeId: record.themeId || inferThemeId(record),
    readerMode: normalizeReaderMode(record.readerMode),
    migrationStatus: normalizeMigrationStatus(record.migrationStatus),
    v2DocumentUrl: record.v2DocumentUrl || `/data/v2/${slug}.json`,
    legacyViewerUrl: record.legacyViewerUrl || viewerUrl,
    printUrl,
    hasV2Scaffold: record.hasV2Scaffold ?? true
  };
}
