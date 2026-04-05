import { matchesQuery, normalizeText } from './search.js';

export const SORT_OPTIONS = {
  updated: 'updated-desc',
  yearDesc: 'year-desc',
  yearAsc: 'year-asc',
  title: 'title-asc'
};

export function collectFilterOptions(documents) {
  const years = new Set();
  const tags = new Set();

  for (const document of documents) {
    if (document.year) {
      years.add(Number(document.year));
    }

    for (const tag of document.tags ?? []) {
      if (tag) {
        tags.add(tag);
      }
    }
  }

  return {
    years: Array.from(years).sort((left, right) => right - left),
    tags: Array.from(tags).sort((left, right) => left.localeCompare(right, 'ru'))
  };
}

export function sortDocuments(documents, sort) {
  const nextDocuments = [...documents];

  switch (sort) {
    case SORT_OPTIONS.yearAsc:
      return nextDocuments.sort((left, right) => Number(left.year) - Number(right.year));
    case SORT_OPTIONS.yearDesc:
      return nextDocuments.sort((left, right) => Number(right.year) - Number(left.year));
    case SORT_OPTIONS.title:
      return nextDocuments.sort((left, right) =>
        normalizeText(left.gostNumber || left.title).localeCompare(
          normalizeText(right.gostNumber || right.title),
          'ru'
        )
      );
    case SORT_OPTIONS.updated:
    default:
      return nextDocuments.sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
  }
}

export function applyDocumentFilters(documents, filters) {
  const filtered = documents.filter((document) => {
    if (!matchesQuery(document, filters.query)) {
      return false;
    }

    if (filters.year && Number(document.year) !== Number(filters.year)) {
      return false;
    }

    if (filters.tag) {
      const normalizedTag = normalizeText(filters.tag);
      const documentTags = (document.tags ?? []).map((tag) => normalizeText(tag));

      if (!documentTags.includes(normalizedTag)) {
        return false;
      }
    }

    return true;
  });

  return sortDocuments(filtered, filters.sort);
}
