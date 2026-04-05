import { fileURLToPath } from 'node:url';
import { readDocumentsManifest } from './lib/manifest.mjs';
import { enrichDocumentRecord } from './lib/document-record.mjs';
import { readCanonicalDocument } from './lib/canonical-document.mjs';
import { V2_SEARCH_INDEX_PATH } from './lib/project-paths.mjs';
import { writeJsonAtomic } from './lib/write-json.mjs';

function buildFallbackEntry(document) {
  return {
    slug: document.slug,
    gostNumber: document.gostNumber,
    title: document.title,
    shortTitle: document.shortTitle,
    themeId: document.themeId,
    readerMode: document.readerMode,
    migrationStatus: document.migrationStatus,
    blocks: (document.navItems ?? []).map((item, index) => ({
      id: `${document.slug}-fallback-${index + 1}`,
      title: item.label ?? `Block ${index + 1}`,
      type: 'section',
      text: '',
      summary: '',
      pageNumber: Number(item.targetPageIndex ?? index) + 1,
      legacyTargetSelector: item.targetSelector ?? null,
      printAnchor: item.targetSelector ?? null
    })),
    entities: [],
    definitions: [],
    relatedNorms: []
  };
}

function buildV2SearchEntry(document, canonicalDocument) {
  if (!canonicalDocument || typeof canonicalDocument !== 'object') {
    return buildFallbackEntry(document);
  }

  return {
    slug: document.slug,
    gostNumber: document.gostNumber,
    title: document.title,
    shortTitle: document.shortTitle,
    themeId: canonicalDocument.meta?.themeId ?? document.themeId,
    readerMode: canonicalDocument.meta?.readerMode ?? document.readerMode,
    migrationStatus: canonicalDocument.meta?.migrationStatus ?? document.migrationStatus,
    blocks: (canonicalDocument.blocks ?? []).map((block) => ({
      id: block.id,
      title: block.title,
      type: block.type,
      text: block.bodyText ?? '',
      summary: block.summary ?? '',
      pageNumber: Number(block.print?.pageNumber ?? 0) || null,
      legacyTargetSelector: block.legacy?.targetSelector ?? null,
      printAnchor: block.print?.pageAnchor ?? null,
      references: block.references ?? [],
      highlightLabels: (block.highlights ?? []).map((item) => item.label),
      unitLabels: (block.units ?? []).map((unit) => unit.title || unit.summary || unit.text).filter(Boolean)
    })),
    entities: (canonicalDocument.entities ?? []).map((entity) => ({
      id: entity.id,
      label: entity.label,
      type: entity.type
    })),
    definitions: (canonicalDocument.definitions ?? []).map((definition) => ({
      id: definition.id,
      term: definition.term,
      summary: definition.summary,
      blockId: definition.blockId
    })),
    relatedNorms: (canonicalDocument.relatedNorms ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      type: item.type,
      sourceBlockIds: item.sourceBlockIds ?? [],
      occurrenceCount: item.occurrenceCount ?? 0
    }))
  };
}

export async function buildV2SearchIndex(manifestOverride = null) {
  const manifest = (manifestOverride ?? await readDocumentsManifest()).map(enrichDocumentRecord);
  const index = [];

  for (const document of manifest) {
    const canonicalDocument = await readCanonicalDocument(document.slug);
    index.push(buildV2SearchEntry(document, canonicalDocument));
  }

  return index;
}

async function main() {
  const index = await buildV2SearchIndex();
  await writeJsonAtomic(V2_SEARCH_INDEX_PATH, index);
  console.log(`V2 search index rebuilt: ${index.length} documents.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
