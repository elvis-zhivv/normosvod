import { readFile } from 'node:fs/promises';
import {
  DOCUMENTS_MANIFEST_PATH
} from './project-paths.mjs';

export async function readJsonFile(filePath, fallback) {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

export async function readDocumentsManifest() {
  const manifest = await readJsonFile(DOCUMENTS_MANIFEST_PATH, []);
  return Array.isArray(manifest) ? manifest : [];
}

export function sortManifestEntries(entries) {
  return [...entries].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function upsertDocumentRecord(entries, nextRecord) {
  const filtered = entries.filter((entry) => entry.slug !== nextRecord.slug);
  filtered.push(nextRecord);
  return sortManifestEntries(filtered);
}

export function buildStats(entries) {
  const years = entries.map((entry) => Number(entry.year)).filter(Number.isFinite);
  const lastImported = entries
    .map((entry) => entry.importedAt)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

  return {
    totalDocuments: entries.length,
    totalPages: entries.reduce((sum, entry) => sum + Number(entry.pages || 0), 0),
    yearRange: years.length > 0 ? { min: Math.min(...years), max: Math.max(...years) } : null,
    lastImportedAt: lastImported,
    lastImportedLabel: lastImported ? new Date(lastImported).toLocaleString('ru-RU') : '—'
  };
}
