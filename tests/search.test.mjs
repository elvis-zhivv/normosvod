import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDocumentFilters, SORT_OPTIONS } from '../src/js/filters.js';
import { buildDocumentSearchHit } from '../src/js/search.js';

const documents = [
  {
    slug: 'doc-a',
    gostNumber: 'ГОСТ 1000—2024',
    title: 'Испытание покрытий',
    shortTitle: 'Покрытия',
    year: 2024,
    pages: 12,
    updatedAt: '2026-04-05T08:59:59.287Z',
    description: 'Описание документа',
    tags: ['лакокрасочные материалы']
  },
  {
    slug: 'doc-b',
    gostNumber: 'ГОСТ 2000—2020',
    title: 'Методы определения цвета',
    shortTitle: 'Цвет',
    year: 2020,
    pages: 8,
    updatedAt: '2026-04-04T08:59:59.287Z',
    description: 'Визуальное сравнение',
    tags: ['цвет']
  }
];

const searchIndex = [
  {
    slug: 'doc-a',
    entries: [
      { pageIndex: 0, anchor: '#p1', text: 'Испытание покрытий и методы нанесения покрытия.' },
      { pageIndex: 2, anchor: '#p3', text: 'Покрытие проверяют визуально и инструментально.' }
    ]
  },
  {
    slug: 'doc-b',
    entries: [
      { pageIndex: 1, anchor: '#p2', text: 'Визуальное сравнение цвета и оттенков.' }
    ]
  }
];

test('buildDocumentSearchHit returns ranked hit with snippet and anchor', () => {
  const hit = buildDocumentSearchHit(documents[0], 'покрытие визуально', searchIndex[0]);

  assert.ok(hit);
  assert.equal(hit.anchor, '#p3');
  assert.equal(hit.pageIndex, 2);
  assert.match(hit.snippet, /визуально/i);
  assert.deepEqual(hit.matchedPages, [2]);
});

test('applyDocumentFilters uses fulltext index and relevance sorting', () => {
  const results = applyDocumentFilters(documents, {
    query: 'визуально',
    year: '',
    tag: '',
    sort: SORT_OPTIONS.relevance
  }, searchIndex);

  assert.equal(results.length, 2);
  assert.equal(results[0].slug, 'doc-b');
  assert.ok(results[0].searchHit.score >= results[1].searchHit.score);
});

test('applyDocumentFilters still applies metadata filters on top of fulltext', () => {
  const results = applyDocumentFilters(documents, {
    query: 'визуально',
    year: '2024',
    tag: '',
    sort: SORT_OPTIONS.relevance
  }, searchIndex);

  assert.deepEqual(results.map((item) => item.slug), ['doc-a']);
});
