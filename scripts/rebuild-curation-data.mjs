import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readDocumentsManifest } from './lib/manifest.mjs';
import { enrichDocumentRecord } from './lib/document-record.mjs';
import { readCanonicalDocument } from './lib/canonical-document.mjs';
import { buildCurationReportEntry } from './lib/curation-report.mjs';
import { CONTENT_DOCS_DIR, CURATION_REPORT_PATH } from './lib/project-paths.mjs';
import { assertSchema } from './lib/schema-validation.mjs';
import { writeJson, writeJsonAtomic } from './lib/write-json.mjs';

export async function rebuildCurationData(manifestOverride = null) {
  const manifest = (manifestOverride ?? await readDocumentsManifest()).map(enrichDocumentRecord);
  const report = [];

  for (const document of manifest) {
    const canonicalDocument = await readCanonicalDocument(document.slug);

    if (!canonicalDocument) {
      continue;
    }

    const entry = buildCurationReportEntry(canonicalDocument, document);
    await assertSchema('curation-report-entry.schema.json', entry, {
      label: `curation report ${document.slug}`
    });
    report.push(entry);

    const outputDirectory = path.join(CONTENT_DOCS_DIR, document.slug);
    await mkdir(outputDirectory, { recursive: true });
    await writeJson(path.join(outputDirectory, 'curation-report.json'), entry);
  }

  await writeJsonAtomic(CURATION_REPORT_PATH, report);
  return report;
}

async function main() {
  const report = await rebuildCurationData();
  console.log(`Curation reports rebuilt: ${report.length} documents.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
