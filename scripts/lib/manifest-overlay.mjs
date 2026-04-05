import { readCanonicalDocument } from './canonical-document.mjs';
import { enrichDocumentRecord } from './document-record.mjs';

function getCount(items) {
  return Array.isArray(items) ? items.length : 0;
}

export function applyCanonicalFieldsToRecord(record, canonicalDocument) {
  if (!canonicalDocument || typeof canonicalDocument !== 'object') {
    return enrichDocumentRecord(record);
  }

  return enrichDocumentRecord({
    ...record,
    description: canonicalDocument.synopsis?.description || record.description,
    themeId: canonicalDocument.meta?.themeId || record.themeId,
    readerMode: canonicalDocument.meta?.readerMode || record.readerMode,
    migrationStatus: canonicalDocument.meta?.migrationStatus || record.migrationStatus,
    curationApplied: Boolean(canonicalDocument.curation?.applied),
    curationVersion: Number.isFinite(Number(canonicalDocument.curation?.overrideVersion))
      ? Number(canonicalDocument.curation.overrideVersion)
      : null,
    hiddenBlocksCount: Number(canonicalDocument.curation?.hiddenBlocksCount ?? 0) || 0,
    v2BlockCount: getCount(canonicalDocument.blocks),
    v2DefinitionsCount: getCount(canonicalDocument.definitions),
    v2RelatedNormsCount: getCount(canonicalDocument.relatedNorms)
  });
}

export async function overlayManifestWithCanonicalData(manifest) {
  const nextManifest = [];

  for (const record of manifest) {
    const canonicalDocument = await readCanonicalDocument(record.slug);
    nextManifest.push(applyCanonicalFieldsToRecord(record, canonicalDocument));
  }

  return nextManifest;
}
