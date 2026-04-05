import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readDocumentsManifest } from './lib/manifest.mjs';
import { readJsonFile } from './lib/manifest.mjs';
import { CONTENT_DOCS_DIR, DOCS_DIR, SEARCH_INDEX_PATH } from './lib/project-paths.mjs';
import { applyCanonicalOverrides, readCanonicalOverrides } from './lib/canonical-overrides.mjs';
import { enrichDocumentRecord } from './lib/document-record.mjs';
import { buildCanonicalDocument } from './lib/document-segmentation.mjs';
import { writeJson } from './lib/write-json.mjs';

export async function rebuildCanonicalDocs(manifestOverride = null, searchIndexOverride = null) {
  const manifest = (manifestOverride ?? await readDocumentsManifest()).map(enrichDocumentRecord);
  const searchIndex = Array.isArray(searchIndexOverride)
    ? searchIndexOverride
    : await readJsonFile(SEARCH_INDEX_PATH, []);
  const searchIndexMap = new Map(
    (Array.isArray(searchIndex) ? searchIndex : [])
      .filter((entry) => entry?.slug)
      .map((entry) => [entry.slug, entry])
  );

  await mkdir(CONTENT_DOCS_DIR, { recursive: true });

  for (const document of manifest) {
    const html = await readFile(path.join(DOCS_DIR, document.slug, 'viewer.html'), 'utf8').catch(() => '');
    const autoCanonicalDocument = buildCanonicalDocument(document, searchIndexMap.get(document.slug), html);
    const overrides = await readCanonicalOverrides(document.slug);
    const canonicalDocument = applyCanonicalOverrides(autoCanonicalDocument, overrides);
    const outputDirectory = path.join(CONTENT_DOCS_DIR, document.slug);
    await mkdir(outputDirectory, { recursive: true });
    await writeJson(path.join(outputDirectory, 'document.json'), canonicalDocument);
  }

  return manifest.length;
}

async function main() {
  const count = await rebuildCanonicalDocs();
  console.log(`Canonical documents rebuilt: ${count}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
