import { inferThemeId } from './theme.mjs';
import { applySourceProfile, getSourceProfile } from './source-registry.mjs';

function normalizeReaderMode(value) {
  const supported = new Set(['legacy', 'hybrid', 'v2']);
  return supported.has(value) ? value : 'legacy';
}

function normalizeMigrationStatus(value) {
  const supported = new Set(['imported', 'segmented', 'entity-linked', 'print-verified', 'v2-ready']);
  return supported.has(value) ? value : 'imported';
}

export function enrichDocumentRecord(record) {
  const { previewUrl, ...restRecord } = record;
  const slug = record.slug;
  const sourceRecord = applySourceProfile(restRecord);
  const sourceProfile = getSourceProfile(sourceRecord.sourceType);
  const viewerUrl = sourceRecord.viewerUrl || (sourceProfile.allowsImplicitLegacyViewer ? `/docs/${slug}/viewer.html` : '');
  const printUrl = record.printUrl || `/docs/${slug}/print.html`;
  const canonicalDocumentUrl = record.canonicalDocumentUrl || `/data/canonical/${slug}.json`;
  const legacyViewerUrl = record.legacyViewerUrl || viewerUrl || '';

  return {
    ...sourceRecord,
    ...(viewerUrl ? { viewerUrl } : {}),
    themeId: record.themeId || inferThemeId(record),
    readerMode: normalizeReaderMode(record.readerMode),
    migrationStatus: normalizeMigrationStatus(record.migrationStatus),
    canonicalDocumentUrl,
    v2DocumentUrl: record.v2DocumentUrl || canonicalDocumentUrl,
    ...(legacyViewerUrl ? { legacyViewerUrl } : {}),
    printUrl,
    hasV2Scaffold: record.hasV2Scaffold ?? true
  };
}
