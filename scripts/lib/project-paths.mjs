import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

export const ROOT_DIR = path.resolve(currentDirectory, '../..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const DOCS_DIR = path.join(PUBLIC_DIR, 'docs');
export const DATA_DIR = path.join(PUBLIC_DIR, 'data');
export const INCOMING_DIR = path.join(ROOT_DIR, 'incoming');
export const ARCHIVE_DIR = path.join(ROOT_DIR, 'archive');
export const DOCUMENTS_MANIFEST_PATH = path.join(DATA_DIR, 'documents.json');
export const SEARCH_INDEX_PATH = path.join(DATA_DIR, 'search-index.json');
export const STATS_PATH = path.join(DATA_DIR, 'stats.json');
