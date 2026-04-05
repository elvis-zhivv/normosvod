import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readDocumentsManifest } from './lib/manifest.mjs';
import { enrichDocumentRecord } from './lib/document-record.mjs';
import { DOCS_DIR } from './lib/project-paths.mjs';
import { readCanonicalDocument } from './lib/canonical-document.mjs';
import { buildPrintHtml } from './lib/print-renderer.mjs';

export async function rebuildPrintDocs() {
  const manifest = (await readDocumentsManifest()).map(enrichDocumentRecord);

  for (const document of manifest) {
    const canonicalDocument = await readCanonicalDocument(document.slug);

    if (!canonicalDocument) {
      continue;
    }

    const outputDirectory = path.join(DOCS_DIR, document.slug);
    await mkdir(outputDirectory, { recursive: true });
    const outputPath = path.join(outputDirectory, 'print.html');
    const printHtml = buildPrintHtml(canonicalDocument);
    await writeFile(outputPath, printHtml, 'utf8');
  }

  return manifest.length;
}

async function main() {
  const count = await rebuildPrintDocs();
  console.log(`Print documents rebuilt: ${count}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
