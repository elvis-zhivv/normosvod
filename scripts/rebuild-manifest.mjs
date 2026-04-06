import path from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildStats, readJsonFile, sortManifestEntries } from './lib/manifest.mjs';
import { enrichDocumentRecord } from './lib/document-record.mjs';
import { DATA_DIR, DOCS_DIR, DOCUMENTS_MANIFEST_PATH, SEARCH_INDEX_PATH, STATS_PATH, V2_DATA_DIR, V2_SEARCH_INDEX_PATH } from './lib/project-paths.mjs';
import { writeJson, writeJsonAtomic } from './lib/write-json.mjs';
import { buildSearchIndex } from './build-search-index.mjs';
import { buildV2SearchIndex } from './build-v2-search-index.mjs';
import { rebuildCanonicalDocs } from './rebuild-canonical-docs.mjs';
import { rebuildCurationData } from './rebuild-curation-data.mjs';
import { rebuildCurationWorkbench } from './rebuild-curation-workbench.mjs';
import { rebuildPrintDocs } from './rebuild-print-docs.mjs';
import { rebuildV2Data } from './rebuild-v2-data.mjs';
import { overlayManifestWithCanonicalData } from './lib/manifest-overlay.mjs';
import { assertSchema } from './lib/schema-validation.mjs';

async function sanitizeDocumentDirectory(docDirectoryPath) {
  const metaPath = path.join(docDirectoryPath, 'meta.json');
  const meta = await readJsonFile(metaPath, null);

  if (meta) {
    if (Object.hasOwn(meta, 'previewUrl')) {
      delete meta.previewUrl;
    }

    if (Object.hasOwn(meta, 'v2DocumentUrl')) {
      delete meta.v2DocumentUrl;
    }

    meta.canonicalDocumentUrl = `/data/canonical/${meta.slug}.json`;
    await writeJson(metaPath, meta);
  }

  await rm(path.join(docDirectoryPath, 'preview.html'), { force: true });
  await rm(path.join(docDirectoryPath, 'v2.json'), { force: true });
}

export async function rebuildManifest() {
  const directoryEntries = await readdir(DOCS_DIR, { withFileTypes: true }).catch(() => []);
  const metaEntries = [];

  for (const directoryEntry of directoryEntries) {
    if (!directoryEntry.isDirectory()) {
      continue;
    }

    const docDirectoryPath = path.join(DOCS_DIR, directoryEntry.name);
    await sanitizeDocumentDirectory(docDirectoryPath);
    const metaPath = path.join(docDirectoryPath, 'meta.json');
    const meta = await readJsonFile(metaPath, null);

    if (meta) {
      metaEntries.push(enrichDocumentRecord(meta));
    }
  }

  const draftManifest = sortManifestEntries(metaEntries);
  const searchIndex = await buildSearchIndex(draftManifest);

  await rebuildCanonicalDocs(draftManifest, searchIndex);
  const manifest = sortManifestEntries(await overlayManifestWithCanonicalData(draftManifest));
  for (const entry of manifest) {
    await assertSchema('manifest-entry.schema.json', entry, {
      label: `manifest entry ${entry.slug}`
    });
  }
  const stats = buildStats(manifest);
  await rebuildCurationData(manifest);
  await rebuildCurationWorkbench(manifest);

  await Promise.all([
    writeJsonAtomic(DOCUMENTS_MANIFEST_PATH, manifest),
    writeJsonAtomic(STATS_PATH, stats),
    writeJsonAtomic(SEARCH_INDEX_PATH, searchIndex)
  ]);
  await rebuildPrintDocs();
  await rebuildV2Data();
  await rm(V2_DATA_DIR, { recursive: true, force: true });
  const v2SearchIndex = await buildV2SearchIndex(manifest);
  await writeJsonAtomic(V2_SEARCH_INDEX_PATH, v2SearchIndex);

  return { manifest, stats, searchIndex, v2SearchIndex };
}

async function main() {
  await readdir(DATA_DIR).catch(async () => {
    return [];
  });

  const result = await rebuildManifest();
  console.log(`Manifest rebuilt: ${result.manifest.length} documents.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
