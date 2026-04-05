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

const v2SearchIndex = [
  {
    slug: 'doc-a',
    blocks: [
      {
        id: 'doc-a-block-1',
        title: '4 Требования',
        type: 'requirements',
        text: 'Не допускается использовать загрязненные панели. Оператор должен применять ISO 3668:2017.',
        summary: 'Практические требования к испытанию.',
        pageNumber: 3,
        references: ['ISO 3668:2017'],
        highlightLabels: ['Не допускается'],
        unitLabels: ['Требования']
      }
    ],
    entities: [
      { id: 'entity-topic-1', label: 'лакокрасочные материалы', type: 'topic' }
    ],
    definitions: [
      { id: 'definition-1', term: 'контрольный образец', summary: 'Образец для сравнения.', blockId: 'doc-a-block-1' }
    ],
    relatedNorms: [
      { id: 'related-iso-3668-2017', label: 'ISO 3668:2017', sourceBlockIds: ['doc-a-block-1'], occurrenceCount: 1 }
    ]
  },
  {
    slug: 'doc-b',
    blocks: [
      {
        id: 'doc-b-block-1',
        title: '3 Визуальное сравнение',
        type: 'procedure',
        text: 'Визуальное сравнение цвета проводят при дневном освещении.',
        summary: 'Базовая процедура сравнения.',
        pageNumber: 2,
        references: [],
        highlightLabels: [],
        unitLabels: ['Визуальное сравнение']
      }
    ],
    entities: [],
    definitions: [],
    relatedNorms: []
  }
];

test('buildDocumentSearchHit returns ranked legacy page hit with snippet and anchor', () => {
  const hit = buildDocumentSearchHit(documents[0], 'покрытие визуально', searchIndex[0], null);

  assert.ok(hit);
  assert.equal(hit.anchor, '#p3');
  assert.equal(hit.pageIndex, 2);
  assert.match(hit.snippet, /визуально/i);
  assert.deepEqual(hit.matchedPages, [2]);
});

test('buildDocumentSearchHit prefers semantic V2 block hits when canonical match is stronger', () => {
  const hit = buildDocumentSearchHit(documents[0], 'загрязненные панели', searchIndex[0], v2SearchIndex[0]);

  assert.ok(hit);
  assert.equal(hit.kind, 'v2-block');
  assert.equal(hit.anchor, '#doc-a-block-1');
  assert.equal(hit.actionUrl, '/doc/doc-a?view=v2#doc-a-block-1');
  assert.match(hit.snippet, /загрязненные панели/i);
});

test('applyDocumentFilters uses semantic index and relevance sorting', () => {
  const results = applyDocumentFilters(documents, {
    query: 'визуально',
    year: '',
    tag: '',
    sort: SORT_OPTIONS.relevance
  }, searchIndex, v2SearchIndex);

  assert.equal(results.length, 2);
  assert.equal(results[0].slug, 'doc-b');
  assert.ok(results[0].searchHit.score >= results[1].searchHit.score);
});

test('applyDocumentFilters still applies metadata filters on top of fulltext', () => {
  const results = applyDocumentFilters(documents, {
    query: 'iso 3668',
    year: '2024',
    tag: '',
    sort: SORT_OPTIONS.relevance
  }, searchIndex, v2SearchIndex);

  assert.deepEqual(results.map((item) => item.slug), ['doc-a']);
  assert.equal(results[0].searchHit.kind, 'v2-related-norm');
});
