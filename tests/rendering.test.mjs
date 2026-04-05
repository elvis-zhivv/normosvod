import test from 'node:test';
import assert from 'node:assert/strict';

import { renderDocCard } from '../src/components/doc-card.js';
import { renderCatalogPage } from '../src/js/catalog.js';
import { renderCurationDocumentPage, renderCurationIndexPage, renderMissingWorkbench } from '../src/js/curation.js';
import { renderDocumentPage, renderMissingDocument } from '../src/js/document.js';
import { normalizeDocumentUrl } from '../src/js/paths.js';

test('normalizeDocumentUrl blocks unsafe protocols and schemeless URLs', () => {
  assert.equal(normalizeDocumentUrl('javascript:alert(1)'), 'about:blank');
  assert.equal(normalizeDocumentUrl('data:text/html,<script>alert(1)</script>'), 'about:blank');
  assert.equal(normalizeDocumentUrl('//evil.example/test'), 'about:blank');
});

test('renderDocCard escapes document fields in generated markup', () => {
  const html = renderDocCard({
    slug: 'gost-1-0-2015',
    gostNumber: 'ГОСТ <img src=x onerror=alert(1)>',
    title: '<script>alert(1)</script>Заголовок',
    year: '2025',
    pages: '12',
    language: 'ru',
    description: 'Описание & <b>жирный</b>',
    tags: ['<svg onload=alert(1)>', 'Безопасный тег'],
    previewUrl: 'javascript:alert(1)',
    viewerUrl: 'data:text/html,test',
    searchHit: {
      totalMatches: 4,
      matchedPages: [0, 2],
      snippet: '<b>совпадение</b>',
      anchor: '#match-1'
    },
    searchQuery: 'совпадение'
  });

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;Заголовок/);
  assert.match(html, /&lt;b&gt;<mark>совпадение<\/mark>&lt;\/b&gt;/);
  assert.match(html, /&lt;svg onload=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /src="javascript:alert\(1\)"/);
  assert.doesNotMatch(html, /href="data:text\/html,test"/);
  assert.match(html, /Быстрый обзор/);
  assert.match(html, /href="\/doc\/gost-1-0-2015\/legacy#match-1"/);
  assert.match(html, /Совпадения: 4 · стр. 1, 3/);
  assert.match(html, /Page hit/);
});

test('renderDocCard renders semantic search preview for V2 hits', () => {
  const html = renderDocCard({
    slug: 'gost-29319-2025',
    gostNumber: 'ГОСТ 29319—2025',
    title: 'Метод визуального сравнения цвета',
    year: '2025',
    pages: '26',
    language: 'ru',
    description: 'Описание документа',
    tags: ['лакокрасочные материалы'],
    previewUrl: '/docs/gost-29319-2025/preview.html',
    viewerUrl: '/docs/gost-29319-2025/viewer.html',
    themeId: 'coatings',
    readerMode: 'hybrid',
    migrationStatus: 'entity-linked',
    curationApplied: true,
    v2BlockCount: 24,
    v2DefinitionsCount: 5,
    v2RelatedNormsCount: 18,
    searchHit: {
      kind: 'v2-definition',
      totalMatches: 2,
      snippet: 'Контрольный образец используют для сравнения цвета.',
      contextLabel: 'Определение: контрольный образец',
      actionUrl: '/doc/gost-29319-2025#block-definition',
      pageNumber: 7
    },
    searchQuery: 'контрольный образец'
  });

  assert.match(html, /Определение/);
  assert.match(html, /Определение: контрольный образец/);
  assert.match(html, /Печать A4: стр\. 7/);
  assert.match(html, /Кураторски проверено/);
  assert.match(html, /24 блоков/);
  assert.match(html, /5 определений/);
  assert.match(html, /href="\/doc\/gost-29319-2025#block-definition"/);
  assert.doesNotMatch(html, /target="_blank" rel="noreferrer">К semantic-блоку/);
});

test('renderDocumentPage escapes route and manifest content', () => {
  const html = renderDocumentPage({
    slug: 'bad slug"><img src=x onerror=alert(1)>',
    gostNumber: 'ГОСТ 1.0—2015',
    title: 'Документ <script>alert(1)</script>',
    description: 'Описание <iframe src=evil></iframe>',
    year: 2015,
    pages: 24,
    status: 'active',
    language: 'ru',
    importedAt: '2026-04-05T08:58:44.090Z',
    updatedAt: '2026-04-05T08:59:59.287Z',
    tags: ['<img src=x onerror=alert(1)>'],
    previewUrl: '/docs/gost-1-0-2015/preview.html',
    viewerUrl: 'javascript:alert(1)',
    themeId: 'regulation',
    sourceType: 'document-package',
    sourceCategory: 'package',
    supportsPackageManifest: true,
    readerMode: 'legacy',
    migrationStatus: 'imported',
    editionCount: 2,
    attachmentCount: 4,
    assetCount: 3,
    navItems: [
      {
        label: '<img src=x onerror=alert(1)>',
        targetPageIndex: 0,
        targetSelector: '#section-1"><script>alert(1)</script>'
      }
    ]
  }, { showEmbeddedViewer: true });

  assert.match(html, /Документ &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Описание &lt;iframe src=evil&gt;&lt;\/iframe&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /#section-1&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Документная поверхность/);
  assert.match(html, /Состояние reader и migration layer/);
  assert.match(html, /Document package/);
  assert.match(html, /2 редакций · 4 вложений/);
  assert.doesNotMatch(html, /href="javascript:alert\(1\)"/);
  assert.doesNotMatch(html, /href="\/doc\/bad%20slug%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert\(1\)%3E\/legacy"/);
  assert.match(html, /href="\/doc\/bad%20slug%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert\(1\)%3E\/print"/);
});

test('renderMissingDocument escapes slug from URL', () => {
  const html = renderMissingDocument('<img src=x onerror=alert(1)>');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
});

test('renderCatalogPage groups search results by semantic hit type', () => {
  const html = renderCatalogPage({
    documents: [
      {
        slug: 'doc-a',
        gostNumber: 'ГОСТ 1000—2024',
        title: 'Испытание покрытий',
        shortTitle: 'Покрытия',
        year: 2024,
        pages: 12,
        updatedAt: '2026-04-05T08:59:59.287Z',
        description: 'Описание документа',
        tags: ['лакокрасочные материалы'],
        language: 'ru',
        previewUrl: '/docs/doc-a/preview.html',
        viewerUrl: '/docs/doc-a/viewer.html'
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
        tags: ['цвет'],
        language: 'ru',
        previewUrl: '/docs/doc-b/preview.html',
        viewerUrl: '/docs/doc-b/viewer.html'
      }
    ],
    searchIndex: [
      {
        slug: 'doc-a',
        entries: [
          { pageIndex: 1, anchor: '#p2', text: 'Испытание покрытий и контрольный образец.' }
        ]
      },
      {
        slug: 'doc-b',
        entries: [
          { pageIndex: 1, anchor: '#p2', text: 'Метод сравнения цвета и визуального контроля оттенков.' }
        ]
      }
    ],
    v2SearchIndex: [
      {
        slug: 'doc-a',
        blocks: [
          {
            id: 'doc-a-block-1',
            title: '3 Термины и определения',
            type: 'definition-set',
            text: 'Контрольный образец используют для сравнения.',
            summary: 'Определение термина.',
            pageNumber: 5,
            references: [],
            highlightLabels: [],
            unitLabels: ['контрольный образец']
          }
        ],
        entities: [],
        definitions: [
          {
            id: 'definition-1',
            term: 'контрольный образец',
            summary: 'Образец для визуального сравнения.',
            blockId: 'doc-a-block-1'
          }
        ],
        relatedNorms: []
      },
      {
        slug: 'doc-b',
        blocks: [],
        entities: [],
        definitions: [],
        relatedNorms: []
      }
    ],
    filters: {
      query: 'сравнения',
      year: '',
      tag: '',
      sort: 'relevance-desc',
      hasExplicitSort: true
    }
  });

  assert.match(html, /Поисковая выдача/);
  assert.match(html, /Определения/);
  assert.match(html, /Документы/);
  assert.match(html, /Semantic Results/);
  assert.match(html, /Legacy \/ Document Hits/);
  assert.match(html, /search-result-summary/);
});

test('renderCurationIndexPage renders curator queue and filters', () => {
  const html = renderCurationIndexPage({
    index: [
      {
        slug: 'gost-29319-2025',
        gostNumber: 'ГОСТ 29319—2025',
        title: 'Метод визуального сравнения цвета',
        themeId: 'coatings',
        readerMode: 'hybrid',
        migrationStatus: 'entity-linked',
        draftState: 'needs-review',
        reviewStatus: 'needs-review',
        queueSummary: {
          blocksPending: 23,
          definitionsPending: 4,
          relatedNormsPending: 17
        },
        issueCounts: {
          warnings: 2
        }
      }
    ],
    filters: {
      query: '',
      draft: '',
      migration: '',
      theme: ''
    }
  });

  assert.match(html, /Очередь ручной верификации/);
  assert.match(html, /ГОСТ 29319—2025/);
  assert.match(html, /Открыть workbench/);
  assert.match(html, /23/);
});

test('renderCurationDocumentPage renders detailed queues and safe external links', () => {
  const html = renderCurationDocumentPage({
    slug: 'gost-29319-2025',
    gostNumber: 'ГОСТ 29319—2025',
    title: 'Метод визуального сравнения цвета',
    themeId: 'coatings',
    readerMode: 'hybrid',
    migrationStatus: 'entity-linked',
    draftState: 'needs-review',
    targetMigrationStatus: 'print-verified',
    overrideVersion: 1,
    reportSummary: {
      reviewStatus: 'needs-review',
      counts: {
        warnings: 2,
        info: 1
      },
      suggestedActions: ['Подготовить документ к полному cutover в Reader V2.']
    },
    draftSummary: {
      notes: 'Проверить финальный блок.'
    },
    queueSummary: {
      blocksPending: 23,
      definitionsPending: 4,
      relatedNormsPending: 17
    },
    documentIssues: [
      {
        severity: 'warning',
        code: 'migration-incomplete',
        message: 'Migration status документа: entity-linked.'
      }
    ],
    blockQueue: [
      {
        blockId: 'block-1',
        title: '2. Нормативные ссылки',
        type: 'references',
        sourcePageNumber: 5,
        reviewStatus: 'accepted',
        issueCodes: [],
        hasOverride: true,
        note: 'Проверено.'
      }
    ],
    definitionQueue: [
      {
        definitionId: 'definition-1',
        term: 'контрольный образец',
        blockId: 'block-1',
        reviewStatus: 'accepted',
        note: 'Подтверждено.'
      }
    ],
    relatedNormQueue: [
      {
        relatedNormId: 'related-1',
        label: 'ГОСТ Р 71216—2024',
        sourceBlockIds: ['block-1'],
        reviewStatus: 'accepted',
        note: 'Подтверждено.'
      }
    ]
  }, {
    slug: 'gost-29319-2025',
    printUrl: 'javascript:alert(1)',
    legacyViewerUrl: '/docs/gost-29319-2025/viewer.html'
  });

  assert.match(html, /Document Issues/);
  assert.match(html, /Block Queue/);
  assert.match(html, /Definition Queue/);
  assert.match(html, /Related Norm Queue/);
  assert.match(html, /href="\/doc\/gost-29319-2025\/print"/);
  assert.match(html, /href="\/doc\/gost-29319-2025\/legacy"/);
});

test('renderMissingWorkbench escapes slug from URL', () => {
  const html = renderMissingWorkbench('<img src=x onerror=alert(1)>');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
});
