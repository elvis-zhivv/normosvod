import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

export const ROOT_DIR = path.resolve(currentDirectory, '../..');
export const CONTENT_DIR = path.join(ROOT_DIR, 'content');
export const CONTENT_DOCS_DIR = path.join(CONTENT_DIR, 'docs');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const DOCS_DIR = path.join(PUBLIC_DIR, 'docs');
export const DATA_DIR = path.join(PUBLIC_DIR, 'data');
export const V2_DATA_DIR = path.join(DATA_DIR, 'v2');
export const CURATION_WORKBENCH_DIR = path.join(DATA_DIR, 'curation-workbench');
export const INCOMING_DIR = path.join(ROOT_DIR, 'incoming');
export const ARCHIVE_DIR = path.join(ROOT_DIR, 'archive');
export const DOCUMENTS_MANIFEST_PATH = path.join(DATA_DIR, 'documents.json');
export const SEARCH_INDEX_PATH = path.join(DATA_DIR, 'search-index.json');
export const V2_SEARCH_INDEX_PATH = path.join(DATA_DIR, 'v2-search-index.json');
export const CURATION_REPORT_PATH = path.join(DATA_DIR, 'curation-report.json');
export const CURATION_WORKBENCH_INDEX_PATH = path.join(DATA_DIR, 'curation-workbench-index.json');
export const STATS_PATH = path.join(DATA_DIR, 'stats.json');
