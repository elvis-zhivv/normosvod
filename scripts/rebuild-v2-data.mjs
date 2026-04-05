import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readDocumentsManifest } from './lib/manifest.mjs';
import { CANONICAL_DATA_DIR, V2_DATA_DIR } from './lib/project-paths.mjs';
import { writeJson } from './lib/write-json.mjs';
import { enrichDocumentRecord } from './lib/document-record.mjs';
import { buildV2DocumentStub } from './lib/v2-document-stub.mjs';
import { readCanonicalDocument } from './lib/canonical-document.mjs';

export async function rebuildV2Data() {
  const manifest = (await readDocumentsManifest()).map(enrichDocumentRecord);
  await rm(V2_DATA_DIR, { recursive: true, force: true });
  await rm(CANONICAL_DATA_DIR, { recursive: true, force: true });
  await mkdir(CANONICAL_DATA_DIR, { recursive: true });

  for (const document of manifest) {
    const v2Document = await readCanonicalDocument(document.slug) ?? buildV2DocumentStub(document);
    await writeJson(path.join(CANONICAL_DATA_DIR, `${document.slug}.json`), v2Document);
  }

  return manifest.length;
}

async function main() {
  const count = await rebuildV2Data();
  console.log(`Canonical public documents rebuilt for ${count} documents.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
