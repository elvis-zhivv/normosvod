import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { DOCS_DIR, INCOMING_DIR } from './lib/project-paths.mjs';
import { extractViewerMeta, validateViewerHtmlBasic } from './lib/parse-viewer-meta.mjs';

async function collectTargets(args) {
  if (args.length > 0) {
    return args;
  }

  const incomingFiles = await readdir(INCOMING_DIR, { withFileTypes: true }).catch(() => []);
  const incomingTargets = incomingFiles
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map((entry) => path.join(INCOMING_DIR, entry.name));

  const publicTargets = [];
  const docsDirectories = await readdir(DOCS_DIR, { withFileTypes: true }).catch(() => []);

  for (const directoryEntry of docsDirectories) {
    if (directoryEntry.isDirectory()) {
      publicTargets.push(path.join(DOCS_DIR, directoryEntry.name, 'viewer.html'));
    }
  }

  return [...incomingTargets, ...publicTargets];
}

async function validateFile(filePath) {
  const html = await readFile(filePath, 'utf8');
  validateViewerHtmlBasic(html);
  const meta = extractViewerMeta({ html, filePath });
  return meta;
}

async function main() {
  const targets = await collectTargets(process.argv.slice(2));

  if (targets.length === 0) {
    console.log('Viewer-файлы для проверки не найдены.');
    return;
  }

  let hasErrors = false;

  for (const target of targets) {
    try {
      const meta = await validateFile(target);
      console.log(`OK ${target} -> ${meta.gostNumber}`);
    } catch (error) {
      hasErrors = true;
      console.error(`ERROR ${target}: ${error.message}`);
    }
  }

  if (hasErrors) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
