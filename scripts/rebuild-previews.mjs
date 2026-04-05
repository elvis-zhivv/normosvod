import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { DOCS_DIR } from './lib/project-paths.mjs';
import { readJsonFile } from './lib/manifest.mjs';
import { generatePreviewOrPlaceholder } from './generate-preview.mjs';
import { writeJson } from './lib/write-json.mjs';
import { rebuildManifest } from './rebuild-manifest.mjs';

async function main() {
  const directoryEntries = await readdir(DOCS_DIR, { withFileTypes: true }).catch(() => []);

  for (const entry of directoryEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const docDir = path.join(DOCS_DIR, entry.name);
    const html = await readFile(path.join(docDir, 'viewer.html'), 'utf8');
    const meta = await readJsonFile(path.join(docDir, 'meta.json'), {});
    meta.previewUrl = `/docs/${entry.name}/preview.svg`;
    await generatePreviewOrPlaceholder({ outputDirectory: docDir, html, meta });
    await writeJson(path.join(docDir, 'meta.json'), meta);
    console.log(`Preview rebuilt for ${entry.name}`);
  }

  await rebuildManifest();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
