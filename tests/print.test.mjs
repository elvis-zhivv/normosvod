import test from 'node:test';
import assert from 'node:assert/strict';

import { enrichDocumentRecord } from '../scripts/lib/document-record.mjs';
import { paginatePrintSegments } from '../scripts/lib/print-layout.mjs';
import { buildPrintHtml } from '../scripts/lib/print-renderer.mjs';

test('enrichDocumentRecord points printUrl to canonical print renderer by default', () => {
  const record = enrichDocumentRecord({
    slug: 'gost-29319-2025',
    viewerUrl: '/docs/gost-29319-2025/viewer.html'
  });

  assert.equal(record.printUrl, '/docs/gost-29319-2025/print.html');
  assert.equal(record.legacyViewerUrl, '/docs/gost-29319-2025/viewer.html');
});

test('buildPrintHtml renders A4 print pages from canonical block source', () => {
  const html = buildPrintHtml({
    slug: 'gost-29319-2025',
    meta: {
      gostNumber: 'ГОСТ 29319—2025',
      shortTitle: 'Метод визуального сравнения цвета',
      themeId: 'coatings'
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
            text: 'Образец для визуального сравнения.'
          }
        ],
        print: {
          sourcePageNumber: 4,
          pageNumber: 4,
          pageAnchor: '#section-2'
        },
        legacy: {
          targetSelector: '#section-2'
        }
      }
    ]
  });

  assert.match(html, /Print A4/);
  assert.match(html, /data-page-number="1"/);
  assert.match(html, /data-source-page-number="4"/);
  assert.match(html, /id="block-a"/);
  assert.match(html, /2 Нормативные ссылки/);
  assert.match(html, /ISO 3668:2017/);
  assert.match(html, /window\.print\(\)/);
});

test('buildPrintHtml uses specialized renderers for tables and appendix/procedure blocks', () => {
  const html = buildPrintHtml({
    slug: 'doc-specialized',
    meta: {
      gostNumber: 'ГОСТ 9999—2026',
      shortTitle: 'Специализированный print renderer',
      themeId: 'regulation'
    },
    blocks: [
      {
        id: 'block-procedure',
        type: 'procedure',
        title: '7 Проведение испытаний',
        summary: 'Порядок действий.',
        references: [],
        units: [
          { id: 'u1', type: 'list-item', title: '7.1 Подготовка', text: 'Подготовить образец.' }
        ],
        print: {
          sourcePageNumber: 5,
          pageAnchor: '#section-7',
          layout: {
            estimatedUnits: 12
          }
        }
      },
      {
        id: 'block-appendix',
        type: 'appendix',
        title: 'Приложение А',
        summary: 'Справочные таблицы.',
        references: [],
        units: [
          { id: 'u2', type: 'table-caption', text: 'Т а б л и ц а А.1' },
          { id: 'u3', type: 'table', title: 'Таблица', text: 'Колонка 1 Значение 1 Колонка 2 Значение 2' }
        ],
        print: {
          sourcePageNumber: 7,
          pageAnchor: '#appendix-a',
          layout: {
            estimatedUnits: 20
          }
        }
      }
    ]
  });

  assert.match(html, /print-block-band-procedure/);
  assert.match(html, /print-block-band-appendix/);
  assert.match(html, /print-table-group/);
  assert.match(html, /print-list-marker/);
});

test('paginatePrintSegments splits oversized canonical blocks into continuation segments', () => {
  const pages = paginatePrintSegments([
    {
      id: 'block-large',
      type: 'procedure',
      title: '7 Проведение испытаний',
      summary: 'Длинный procedural block.',
      references: ['ISO 3668:2017'],
      units: Array.from({ length: 8 }, (_, index) => ({
        id: `unit-${index + 1}`,
        type: index === 3 ? 'table' : 'paragraph',
        text: 'Подробный фрагмент испытаний. '.repeat(index === 3 ? 40 : 18)
      })),
      print: {
        sourcePageNumber: 10,
        pageAnchor: '#section-7',
        layout: {
          estimatedUnits: 96,
          minUnits: 48,
          keepWithNext: false,
          forcePageBreakBefore: false,
          prefersSoloPage: false,
          splittable: true,
          segmentTargetUnits: 26,
          introUnits: 8,
          unitEstimates: Array.from({ length: 8 }, (_, index) => ({
            unitId: `unit-${index + 1}`,
            type: index === 3 ? 'table' : 'paragraph',
            estimatedUnits: index === 3 ? 18 : 7,
            prefersSoloSegment: index === 3
          }))
        }
      }
    }
  ]);

  assert.ok(pages.length >= 2);
  assert.equal(pages[0].segments[0].id, 'block-large');
  assert.ok(pages.flatMap((page) => page.segments).some((segment) => segment.isContinuation));
});
