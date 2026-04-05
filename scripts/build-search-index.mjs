import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extractSearchEntries } from './lib/extract-search-text.mjs';
import { readDocumentsManifest } from './lib/manifest.mjs';
import { DOCS_DIR, SEARCH_INDEX_PATH } from './lib/project-paths.mjs';
import { writeJsonAtomic } from './lib/write-json.mjs';

export async function buildSearchIndex(manifestOverride = null, options = {}) {
  const manifest = manifestOverride ?? await readDocumentsManifest();
  const htmlBySlug = options.htmlBySlug ?? new Map();

  const entries = [];

  for (const document of manifest) {
    const html = htmlBySlug.has(document.slug)
      ? htmlBySlug.get(document.slug)
      : await readFile(path.join(DOCS_DIR, document.slug, 'viewer.html'), 'utf8');

    entries.push({
      slug: document.slug,
      gostNumber: document.gostNumber,
      title: document.title,
      pages: document.pages,
      entries: extractSearchEntries(html)
    });
  }

  return entries;
}

async function main() {
  const index = await buildSearchIndex();
  await writeJsonAtomic(SEARCH_INDEX_PATH, index);
  console.log(`Search index rebuilt: ${index.length} documents.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
