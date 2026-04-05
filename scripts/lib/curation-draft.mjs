import path from 'node:path';
import { CONTENT_DOCS_DIR } from './project-paths.mjs';
import { readJsonFile } from './manifest.mjs';

function normalizeReviewStatus(value, fallback = 'pending') {
  const supported = new Set(['pending', 'accepted', 'rejected', 'needs-review']);
  return supported.has(value) ? value : fallback;
}

function normalizeReviewItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === 'object' && item.blockId)
    .map((item) => ({
      blockId: String(item.blockId),
      status: normalizeReviewStatus(item.status),
      note: item.note ? String(item.note) : '',
      reviewer: item.reviewer ? String(item.reviewer) : '',
      updatedAt: item.updatedAt ? String(item.updatedAt) : ''
    }));
}

function normalizeEntityReviewItems(items = [], idField) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === 'object' && item[idField])
    .map((item) => ({
      [idField]: String(item[idField]),
      status: normalizeReviewStatus(item.status),
      note: item.note ? String(item.note) : '',
      reviewer: item.reviewer ? String(item.reviewer) : '',
      updatedAt: item.updatedAt ? String(item.updatedAt) : ''
    }));
}

export function normalizeCurationDraft(rawDraft) {
  if (!rawDraft || typeof rawDraft !== 'object') {
    return {
      version: 1,
      reviewState: 'pending',
      notes: '',
      targetMigrationStatus: '',
      blockReviews: [],
      definitionReviews: [],
      relatedNormReviews: []
    };
  }

  return {
    version: Number(rawDraft.version ?? 1) || 1,
    reviewState: normalizeReviewStatus(rawDraft.reviewState, 'pending'),
    notes: rawDraft.notes ? String(rawDraft.notes) : '',
    targetMigrationStatus: rawDraft.targetMigrationStatus ? String(rawDraft.targetMigrationStatus) : '',
    blockReviews: normalizeReviewItems(rawDraft.blockReviews),
    definitionReviews: normalizeEntityReviewItems(rawDraft.definitionReviews, 'definitionId'),
    relatedNormReviews: normalizeEntityReviewItems(rawDraft.relatedNormReviews, 'relatedNormId')
  };
}

export async function readCurationDraft(slug) {
  const draft = await readJsonFile(path.join(CONTENT_DOCS_DIR, slug, 'curation-draft.json'), null);
  return normalizeCurationDraft(draft);
}
