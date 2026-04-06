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

test('renderV2Reader renders figures and keeps protocol checklists out of step mode', () => {
  const model = normalizeV2Document({
    meta: {
      themeId: 'coatings',
      migrationStatus: 'v2-ready'
    },
    blocks: [
      {
        id: 'block-protocol',
        type: 'procedure',
        title: '11. Протокол испытаний',
        summary: 'Протокол испытаний должен содержать:',
        references: [],
        units: [
          {
            id: 'protocol-head',
            type: 'paragraph',
            text: 'Протокол испытаний должен содержать:',
            references: []
          },
          {
            id: 'protocol-item',
            type: 'list-item',
            title: 'а) сведения',
            text: 'а) сведения об образце;',
            references: []
          }
        ],
        highlights: [],
        print: {
          sourcePageNumber: 12
        },
        legacy: {}
      },
      {
        id: 'block-appendix-figure',
        type: 'appendix',
        title: 'Приложение А',
        summary: 'Рисунок приложения.',
        references: [],
        units: [
          {
            id: 'figure-a1',
            type: 'figure',
            title: 'Рисунок А.1 — Шкала изменения светлоты',
            summary: 'Шкала изменения светлоты.',
            src: '/docs/gost-29319-2025/figures/figure-a1-lightness-scale.svg',
            alt: 'Рисунок А.1',
            references: []
          }
        ],
        highlights: [],
        print: {
          sourcePageNumber: 13
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

  assert.match(html, /class="v2-figure"/);
  assert.match(html, /figure-a1-lightness-scale\.svg/);
  assert.doesNotMatch(html, /protocol-item[\s\S]*v2-procedure-marker/);
});

test('renderV2Reader moves ancillary pages out of the main flow and renders prose as reading text', () => {
  const model = normalizeV2Document({
    meta: {
      themeId: 'coatings',
      migrationStatus: 'v2-ready',
      gostNumber: 'ГОСТ TEST'
    },
    outline: [
      { id: 'front-1', title: 'Страница I — «Титул»', type: 'section', pageNumber: 1 },
      { id: 'main-1', title: '1. Область применения', type: 'section', pageNumber: 5 }
    ],
    blocks: [
      {
        id: 'front-1',
        type: 'section',
        title: 'Страница I — «Титул»',
        summary: 'Служебная страница.',
        references: [],
        units: [
          { id: 'front-unit', type: 'paragraph', text: 'Служебная страница.', references: [] }
        ],
        highlights: [],
        print: { pageNumber: 1 },
        legacy: {}
      },
      {
        id: 'main-1',
        type: 'section',
        title: '1. Область применения',
        summary: 'Основной нормативный текст.',
        references: [],
        units: [
          { id: 'skip-title', type: 'paragraph', text: '1. Область применения', references: [] },
          { id: 'keep-1', type: 'paragraph', text: 'Настоящий стандарт распространяется на материалы.', references: [] },
          { id: 'skip-roman', type: 'paragraph', text: 'III', references: [] },
          { id: 'keep-2', type: 'paragraph', text: 'Сравнение проводят при естественном или искусственном освещении.', references: [] },
          { id: 'note-1', type: 'note', summary: 'Примечание для проверочного чтения.', references: [] }
        ],
        highlights: [],
        print: { pageNumber: 5 },
        legacy: {}
      }
    ],
    entryPoints: {
      legacyUrl: '/docs/gost-29319-2025/viewer.html',
      printUrl: '/docs/gost-29319-2025/print.html'
    }
  }, legacyDocument);

  const html = renderV2Reader(model, legacyDocument);

  assert.match(html, /Вступительные и служебные страницы/);
  assert.match(html, /Чтение начинается с раздела «1\. Область применения»/);
  assert.match(html, /class="v2-prose-group"/);
  assert.equal((html.match(/class="v2-prose-paragraph"/g) ?? []).length, 2);
  assert.equal((html.match(/class="v2-outline-link"/g) ?? []).length, 1);
  assert.match(html, /class="v2-outline-link" href="#main-1"/);
  assert.match(html, /v2-callout-note/);
});

test('renderV2Reader expands structured lists that were flattened into a paragraph', () => {
  const model = normalizeV2Document({
    meta: {
      themeId: 'regulation',
      migrationStatus: 'v2-ready'
    },
    blocks: [
      {
        id: 'block-1',
        type: 'section',
        title: '3. Цели стандартизации',
        summary: 'Список целей.',
        references: [],
        units: [
          {
            id: 'dash-list',
            type: 'paragraph',
            text: '- содействие устранению технических барьеров в торговле; - обеспечение безопасности продукции; - защита интересов потребителей.',
            references: []
          },
          {
            id: 'alpha-list',
            type: 'paragraph',
            text: 'Образцы могут быть осмотрены: а) при естественном дневном освещении; б) при искусственном дневном освещении.',
            references: []
          }
        ],
        highlights: [],
        print: { pageNumber: 4 },
        legacy: {}
      }
    ],
    entryPoints: {
      legacyUrl: '/docs/gost-29319-2025/viewer.html',
      printUrl: '/docs/gost-29319-2025/print.html'
    }
  }, legacyDocument);

  const html = renderV2Reader(model, legacyDocument);

  assert.match(html, /class="v2-structured-block v2-structured-block-dash"/);
  assert.match(html, /class="v2-structured-block v2-structured-block-alpha"/);
  assert.match(html, /содействие устранению технических барьеров/u);
  assert.match(html, /class="v2-structured-marker">а\)/);
  assert.match(html, /class="v2-structured-marker">б\)/);
});

test('renderV2Reader renders structured table data as an HTML table', () => {
  const model = normalizeV2Document({
    meta: {
      themeId: 'coatings',
      migrationStatus: 'v2-ready'
    },
    blocks: [
      {
        id: 'block-table',
        type: 'section',
        title: '6. Требования к образцам',
        summary: 'Таблица расстояний осмотра.',
        references: [],
        units: [
          {
            id: 'table-caption',
            type: 'table-caption',
            text: 'Т а б л и ц а 1',
            references: []
          },
          {
            id: 'table-unit',
            type: 'table',
            title: 'Таблица 1',
            text: 'Плоский текст таблицы.',
            columns: ['Расстояние осмотра, мм', 'Размер отверстия, мм × мм'],
            rows: [
              ['300', '54 × 54'],
              ['500', '87 × 87']
            ],
            references: []
          }
        ],
        highlights: [],
        print: { pageNumber: 8 },
        legacy: {}
      }
    ],
    entryPoints: {
      legacyUrl: '/docs/gost-29319-2025/viewer.html',
      printUrl: '/docs/gost-29319-2025/print.html'
    }
  }, legacyDocument);

  const html = renderV2Reader(model, legacyDocument);

  assert.match(html, /class="v2-data-table"/);
  assert.match(html, /<th>Расстояние осмотра, мм<\/th>/);
  assert.match(html, /<td>300<\/td>/);
  assert.match(html, /<td>54 × 54<\/td>/);
});
