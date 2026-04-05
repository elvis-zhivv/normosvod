import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildStats, readJsonFile, sortManifestEntries } from './lib/manifest.mjs';
import { DATA_DIR, DOCS_DIR, DOCUMENTS_MANIFEST_PATH, SEARCH_INDEX_PATH, STATS_PATH } from './lib/project-paths.mjs';
import { writeJsonAtomic } from './lib/write-json.mjs';
import { buildSearchIndex } from './build-search-index.mjs';

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
      metaEntries.push(meta);
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

  return { manifest, stats, searchIndex };
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
