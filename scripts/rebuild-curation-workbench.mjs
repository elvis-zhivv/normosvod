import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readDocumentsManifest } from './lib/manifest.mjs';
import { enrichDocumentRecord } from './lib/document-record.mjs';
import { readCanonicalDocument } from './lib/canonical-document.mjs';
import { readCanonicalOverrides } from './lib/canonical-overrides.mjs';
import { readCurationDraft } from './lib/curation-draft.mjs';
import { buildCurationReportEntry } from './lib/curation-report.mjs';
import { buildCurationWorkbenchEntry } from './lib/curation-workbench.mjs';
import { CONTENT_DOCS_DIR, CURATION_WORKBENCH_DIR, CURATION_WORKBENCH_INDEX_PATH } from './lib/project-paths.mjs';
import { writeJson, writeJsonAtomic } from './lib/write-json.mjs';

export async function rebuildCurationWorkbench(manifestOverride = null) {
  const manifest = (manifestOverride ?? await readDocumentsManifest()).map(enrichDocumentRecord);
  const index = [];

  await mkdir(CURATION_WORKBENCH_DIR, { recursive: true });

  for (const document of manifest) {
    const canonicalDocument = await readCanonicalDocument(document.slug);

    if (!canonicalDocument) {
      continue;
    }

    const overrides = await readCanonicalOverrides(document.slug);
    const draft = await readCurationDraft(document.slug);
    const curationReport = buildCurationReportEntry(canonicalDocument, document);
    const workbench = buildCurationWorkbenchEntry({
      canonicalDocument,
      manifestDocument: document,
      curationReport,
      overrides,
      draft
    });

    index.push({
      slug: workbench.slug,
      gostNumber: workbench.gostNumber,
      title: workbench.title,
      themeId: workbench.themeId,
      readerMode: workbench.readerMode,
      migrationStatus: workbench.migrationStatus,
      draftState: workbench.draftState,
      reviewStatus: workbench.reportSummary.reviewStatus,
      queueSummary: workbench.queueSummary,
      issueCounts: workbench.reportSummary.counts
    });

    const contentDirectory = path.join(CONTENT_DOCS_DIR, document.slug);
    await mkdir(contentDirectory, { recursive: true });
    await writeJson(path.join(contentDirectory, 'curation-workbench.json'), workbench);
    await writeJson(path.join(CURATION_WORKBENCH_DIR, `${document.slug}.json`), workbench);
  }

  await writeJsonAtomic(CURATION_WORKBENCH_INDEX_PATH, index);
  return index;
}

async function main() {
  const index = await rebuildCurationWorkbench();
  console.log(`Curation workbench rebuilt: ${index.length} documents.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
