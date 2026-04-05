import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildStats, readJsonFile, sortManifestEntries } from './lib/manifest.mjs';
import { enrichDocumentRecord } from './lib/document-record.mjs';
import { DATA_DIR, DOCS_DIR, DOCUMENTS_MANIFEST_PATH, SEARCH_INDEX_PATH, STATS_PATH, V2_SEARCH_INDEX_PATH } from './lib/project-paths.mjs';
import { writeJsonAtomic } from './lib/write-json.mjs';
import { buildSearchIndex } from './build-search-index.mjs';
import { buildV2SearchIndex } from './build-v2-search-index.mjs';
import { rebuildCanonicalDocs } from './rebuild-canonical-docs.mjs';
import { rebuildV2Data } from './rebuild-v2-data.mjs';

export async function rebuildManifest() {
  const directoryEntries = await readdir(DOCS_DIR, { withFileTypes: true }).catch(() => []);
  const metaEntries = [];

  for (const directoryEntry of directoryEntries) {
    if (!directoryEntry.isDirectory()) {
      continue;
    }

    const metaPath = path.join(DOCS_DIR, directoryEntry.name, 'meta.json');
    const meta = await readJsonFile(metaPath, null);

    if (meta) {
      metaEntries.push(enrichDocumentRecord(meta));
    }
  }

  const manifest = sortManifestEntries(metaEntries);
  const stats = buildStats(manifest);
  const searchIndex = await buildSearchIndex(manifest);

  await Promise.all([
    writeJsonAtomic(DOCUMENTS_MANIFEST_PATH, manifest),
    writeJsonAtomic(STATS_PATH, stats),
    writeJsonAtomic(SEARCH_INDEX_PATH, searchIndex)
  ]);
  await rebuildCanonicalDocs();
  await rebuildV2Data();
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
