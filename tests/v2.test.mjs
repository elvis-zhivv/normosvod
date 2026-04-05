import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFallbackV2Document, normalizeV2Document } from '../src/v2/model.js';
import { renderV2Reader } from '../src/v2/render.js';

const legacyDocument = {
  slug: 'gost-29319-2025',
  gostNumber: 'ГОСТ 29319—2025',
  title: 'Материалы лакокрасочные. Метод визуального сравнения цвета',
  description: 'Автономный viewer ГОСТ 29319—2025.',
  year: 2025,
  pages: 26,
  tags: ['ГОСТ', 'Материалы лакокрасочные', 'Метод визуального сравнения цвета'],
  viewerUrl: '/docs/gost-29319-2025/viewer.html',
  navItems: [
    { label: '2. Нормативные ссылки', targetPageIndex: 4, targetSelector: '#section-2-normative' },
    { label: '3. Термины и определения', targetPageIndex: 5, targetSelector: '#section-3-terms' }
  ]
};

test('buildFallbackV2Document derives a coatings theme and scaffold blocks from legacy nav', () => {
  const model = buildFallbackV2Document(legacyDocument);

  assert.equal(model.meta.themeId, 'coatings');
  assert.equal(model.blocks.length, 2);
  assert.equal(model.blocks[0].type, 'references');
  assert.equal(model.blocks[1].type, 'definition-set');
});

test('normalizeV2Document overlays payload on top of fallback model', () => {
  const model = normalizeV2Document({
    synopsis: {
      description: 'Structured V2 document.'
    },
    meta: {
      migrationStatus: 'segmented'
    },
    blocks: [
      {
        id: 'block-a',
        references: ['ГОСТ 1.2—2015'],
        units: [
          {
            id: 'unit-a',
            references: ['ISO 3668:2017']
          }
        ]
      }
    ]
  }, legacyDocument);

  assert.equal(model.synopsis.description, 'Structured V2 document.');
  assert.equal(model.meta.migrationStatus, 'segmented');
  assert.equal(model.meta.gostNumber, legacyDocument.gostNumber);
  assert.deepEqual(model.referenceBadges, ['ГОСТ 1.2—2015', 'ISO 3668:2017']);
});

test('renderV2Reader includes contextual rail and interactive tooltip triggers', () => {
  const model = normalizeV2Document({
    meta: {
      themeId: 'coatings',
      migrationStatus: 'segmented'
    },
    blocks: [
      {
        id: 'block-a',
        type: 'references',
        title: '2 Нормативные ссылки',
        summary: 'Связанные документы для применения метода.',
        references: ['ISO 3668:2017'],
        units: [
          {
            id: 'unit-a',
            type: 'definition',
            title: 'контрольный образец',
            summary: 'Образец для визуального сравнения.',
            references: ['ISO 3668:2017']
          }
        ],
        highlights: [],
        print: {
          pageNumber: 4,
          pageAnchor: '#section-2'
        },
        legacy: {
          targetSelector: '#section-2'
        }
      }
    ],
    definitions: [
      {
        id: 'definition-1',
        term: 'контрольный образец',
        summary: 'Образец для визуального сравнения.',
        blockId: 'block-a'
      }
    ],
    relatedNorms: [
      {
        id: 'related-1',
        label: 'ISO 3668:2017',
        type: 'reference',
        sourceBlockIds: ['block-a'],
        occurrenceCount: 2
      }
    ],
    entryPoints: {
      legacyUrl: '/docs/gost-29319-2025/viewer.html',
      printUrl: '/docs/gost-29319-2025/viewer.html'
    }
  }, legacyDocument);

  const html = renderV2Reader(model, legacyDocument);

  assert.match(html, /data-v2-context-panel/);
  assert.match(html, /data-v2-tooltip-layer/);
  assert.match(html, /data-v2-context-kind="related-norm"/);
  assert.match(html, /data-v2-context-kind="definition"/);
  assert.match(html, /Верификация/);
  assert.match(html, /Выберите определение, связанную норму или ссылку в потоке/);
});

test('renderV2Reader uses specialized screen-flow renderers for procedure, appendix and tables', () => {
  const model = normalizeV2Document({
    meta: {
      themeId: 'coatings',
      migrationStatus: 'segmented'
    },
    blocks: [
      {
        id: 'block-procedure',
        type: 'procedure',
        title: '7 Проведение испытаний',
        summary: 'Порядок проведения испытаний.',
        references: [],
        units: [
          {
            id: 'unit-step',
            type: 'list-item',
            title: '7.1 Подготовка',
            summary: 'Подготовить образец к испытанию.',
            references: []
          }
        ],
        highlights: [],
        print: {
          sourcePageNumber: 10
        },
        legacy: {}
      },
      {
        id: 'block-appendix',
        type: 'appendix',
        title: 'Приложение А',
        summary: 'Справочные таблицы.',
        references: [],
        units: [
          {
            id: 'unit-caption',
            type: 'table-caption',
            summary: 'Т а б л и ц а А.1',
            references: []
          },
          {
            id: 'unit-table',
            type: 'table',
            title: 'Таблица',
            summary: 'Колонка 1 Значение 1 Колонка 2 Значение 2',
            references: []
          }
        ],
        highlights: [],
        print: {
          sourcePageNumber: 14
        },
        legacy: {}
      }
    ],
    entryPoints: {
      legacyUrl: '/docs/gost-29319-2025/viewer.html',
      printUrl: '/docs/gost-29319-2025/print.html'
    }
  }, legacyDocument);

  const html = renderV2Reader(model, legacyDocument);

  assert.match(html, /v2-block-band-procedure/);
  assert.match(html, /v2-block-band-appendix/);
  assert.match(html, /v2-unit-procedure-item/);
  assert.match(html, /v2-table-group/);
});
