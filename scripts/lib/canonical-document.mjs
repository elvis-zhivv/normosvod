import path from 'node:path';
import { CONTENT_DOCS_DIR } from './project-paths.mjs';
import { readJsonFile } from './manifest.mjs';

export async function readCanonicalDocument(slug) {
  return readJsonFile(path.join(CONTENT_DOCS_DIR, slug, 'document.json'), null);
}
