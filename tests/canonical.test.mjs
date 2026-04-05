import test from 'node:test';
import assert from 'node:assert/strict';

import { applyCanonicalOverrides } from '../scripts/lib/canonical-overrides.mjs';
import { buildMetaFromCanonicalPackage, normalizeCanonicalPackage } from '../scripts/lib/canonical-package.mjs';
import { normalizeDocumentPackageManifest, resolvePackagePath } from '../scripts/lib/document-package.mjs';
import { buildCanonicalDocument, inferBlockType } from '../scripts/lib/document-segmentation.mjs';
import { extractCanonicalSearchEntries } from '../scripts/lib/extract-search-text.mjs';
import { extractBlockFragmentsFromViewer } from '../scripts/lib/viewer-fragments.mjs';

const legacyDocument = {
  slug: 'gost-29319-2025',
  gostNumber: 'ГОСТ 29319—2025',
  title: 'Материалы лакокрасочные. Метод визуального сравнения цвета',
  shortTitle: 'Метод визуального сравнения цвета',
  description: 'Автономный viewer ГОСТ 29319—2025.',
  year: 2025,
  status: 'active',
  language: 'ru',
  pages: 26,
  tags: ['ГОСТ', 'Материалы лакокрасочные', 'Метод визуального сравнения цвета'],
  viewerUrl: '/docs/gost-29319-2025/viewer.html',
  navItems: [
    { label: '2. Нормативные ссылки', targetPageIndex: 4, targetSelector: '#section-2-normative' },
    { label: '3. Термины и определения', targetPageIndex: 5, targetSelector: '#section-3-terms' }
  ]
};

const searchIndexEntry = {
  slug: 'gost-29319-2025',
  entries: [
    {
      pageIndex: 4,
      anchor: '#section-2-normative',
      text: '2. Нормативные ссылки В настоящем стандарте использованы ГОСТ 29317—92 и ISO 3668:2017.'
    },
    {
      pageIndex: 5,
      anchor: '#section-3-terms',
      text: '3. Термины и определения Метамерное соответствие и сравнение цвета выполняют по ГОСТ 29319—2025.'
    }
  ]
};

const viewerHtml = `
<!doctype html>
<html lang="ru">
  <body>
    <section class="page" data-page="1">
      <div class="content doc">
        <div class="section" id="section-1">1 Область применения</div>
        <p>Текст первого раздела.</p>
        <div class="section" id="section-2">2 Нормативные ссылки</div>
        <p>Текст второго раздела на первой странице.</p>
      </div>
    </section>
    <section class="page" data-page="2">
      <div class="content doc">
        <p>Продолжение второго раздела на второй странице.</p>
        <div class="section" id="section-3">3 Термины и определения</div>
        <p>Текст третьего раздела.</p>
      </div>
    </section>
  </body>
</html>
`;

const semanticViewerHtml = `
<!doctype html>
<html lang="ru">
  <body>
    <section class="page" data-page="1">
      <div class="content doc">
        <div class="section" id="section-3">3 Термины и определения</div>
        <p>3.1 контрольный образец: образец покрытия, применяемый для сравнения.</p>
        <div class="section" id="section-4">4 Требования</div>
        <p>При сравнении цвета не допускается использовать загрязненные панели. Оператор должен применять ГОСТ 29317—92 и ISO 3668:2017.</p>
      </div>
    </section>
  </body>
</html>
`;

test('inferBlockType classifies major semantic sections', () => {
  assert.equal(inferBlockType('2. Нормативные ссылки'), 'references');
  assert.equal(inferBlockType('3. Термины и определения'), 'definition-set');
  assert.equal(inferBlockType('7. Проведение испытаний'), 'procedure');
});

test('buildCanonicalDocument creates canonical blocks with body text and extracted references', () => {
  const documentModel = buildCanonicalDocument({
    ...legacyDocument,
    navItems: [
      { label: '1. Область применения', targetPageIndex: 0, targetSelector: '#section-1' },
      { label: '2. Нормативные ссылки', targetPageIndex: 0, targetSelector: '#section-2' },
      { label: '3. Термины и определения', targetPageIndex: 1, targetSelector: '#section-3' }
    ]
  }, {
    slug: 'gost-29319-2025',
    entries: [
      { pageIndex: 0, anchor: '#section-1', text: 'Полный текст страницы 1' },
      { pageIndex: 1, anchor: '#section-3', text: 'Полный текст страницы 2' }
    ]
  }, viewerHtml);

  assert.equal(documentModel.kind, 'normosvod-canonical-document');
  assert.equal(documentModel.meta.themeId, 'coatings');
  assert.equal(documentModel.blocks.length, 3);
  assert.match(documentModel.blocks[0].bodyText, /Текст первого раздела/);
  assert.ok(documentModel.blocks[1].references.length === 0);
  assert.ok(documentModel.blocks[0].units.length > 0);
  assert.ok(documentModel.blocks[0].print.layout.estimatedUnits >= 6);
  assert.equal(documentModel.blocks[0].print.sourcePageNumber, 1);
});

test('extractBlockFragmentsFromViewer slices by selector boundaries across pages', () => {
  const fragments = extractBlockFragmentsFromViewer(viewerHtml, [
    { label: '1. Область применения', targetPageIndex: 0, targetSelector: '#section-1' },
    { label: '2. Нормативные ссылки', targetPageIndex: 0, targetSelector: '#section-2' },
    { label: '3. Термины и определения', targetPageIndex: 1, targetSelector: '#section-3' }
  ]);

  assert.equal(fragments.length, 3);
  assert.match(fragments[0].text, /Текст первого раздела/);
  assert.doesNotMatch(fragments[0].text, /Текст второго раздела/);
  assert.match(fragments[1].text, /Текст второго раздела на первой странице/);
  assert.match(fragments[1].text, /Продолжение второго раздела на второй странице/);
  assert.doesNotMatch(fragments[1].text, /Текст третьего раздела/);
  assert.match(fragments[2].text, /Текст третьего раздела/);
});

test('buildCanonicalDocument prefers selector-aware fragment text over full page text', () => {
  const documentModel = buildCanonicalDocument({
    ...legacyDocument,
    navItems: [
      { label: '1. Область применения', targetPageIndex: 0, targetSelector: '#section-1' },
      { label: '2. Нормативные ссылки', targetPageIndex: 0, targetSelector: '#section-2' },
      { label: '3. Термины и определения', targetPageIndex: 1, targetSelector: '#section-3' }
    ]
  }, {
    slug: 'gost-29319-2025',
    entries: [
      { pageIndex: 0, anchor: '#section-1', text: 'Полный текст страницы 1' },
      { pageIndex: 1, anchor: '#section-3', text: 'Полный текст страницы 2' }
    ]
  }, viewerHtml);

  assert.match(documentModel.blocks[0].bodyText, /Текст первого раздела/);
  assert.doesNotMatch(documentModel.blocks[0].bodyText, /Продолжение второго раздела/);
  assert.match(documentModel.blocks[1].bodyText, /Продолжение второго раздела/);
  assert.ok(documentModel.blocks[1].units.some((unit) => unit.type === 'section-heading'));
});

test('buildCanonicalDocument extracts highlights, definitions and related norms from semantic fragments', () => {
  const documentModel = buildCanonicalDocument({
    ...legacyDocument,
    navItems: [
      { label: '3. Термины и определения', targetPageIndex: 0, targetSelector: '#section-3' },
      { label: '4. Требования', targetPageIndex: 0, targetSelector: '#section-4' }
    ]
  }, {
    slug: 'gost-29319-2025',
    entries: [
      {
        pageIndex: 0,
        anchor: '#section-3',
        text: 'Термины и требования из полной страницы.'
      }
    ]
  }, semanticViewerHtml);

  assert.ok(documentModel.definitions.some((item) => item.term === 'контрольный образец'));
  assert.ok(documentModel.highlights.some((item) => item.type === 'warning'));
  assert.ok(documentModel.highlights.some((item) => item.type === 'requirement'));
  assert.ok(documentModel.relatedNorms.some((item) => item.label === 'ГОСТ 29317—92'));
  assert.ok(documentModel.relatedNorms.some((item) => item.label === 'ISO 3668:2017'));
});

test('applyCanonicalOverrides applies curated block, definition and related norm patches', () => {
  const baseDocument = buildCanonicalDocument({
    ...legacyDocument,
    navItems: [
      { label: '2. Нормативные ссылки', targetPageIndex: 0, targetSelector: '#section-2' },
      { label: '3. Термины и определения', targetPageIndex: 1, targetSelector: '#section-3' }
    ]
  }, {
    slug: 'gost-29319-2025',
    entries: [
      { pageIndex: 0, anchor: '#section-2', text: '2 Нормативные ссылки. ГОСТ 29317—92.' },
      { pageIndex: 1, anchor: '#section-3', text: '3 Термины и определения. 3.1 контрольный образец: образец.' }
    ]
  }, semanticViewerHtml);

  const curated = applyCanonicalOverrides(baseDocument, {
    version: 1,
    meta: {
      migrationStatus: 'entity-linked',
      readerMode: 'hybrid'
    },
    blockOverrides: {
      [baseDocument.blocks[0].id]: {
        summary: 'Кураторски уточненный блок нормативных ссылок.',
        referencesAppend: ['ГОСТ Р 71216—2024']
      }
    },
    definitionsAppend: [
      {
        id: 'manual-definition',
        term: 'контрольный образец',
        summary: 'Ручное определение.',
        blockId: baseDocument.blocks[1].id
      }
    ],
    relatedNormsAppend: [
      {
        id: 'manual-related',
        label: 'ГОСТ Р 71216—2024',
        type: 'reference',
        sourceBlockIds: [baseDocument.blocks[0].id],
        occurrenceCount: 1
      }
    ]
  });

  assert.equal(curated.meta.migrationStatus, 'entity-linked');
  assert.equal(curated.meta.readerMode, 'hybrid');
  assert.match(curated.blocks[0].summary, /Кураторски уточненный/);
  assert.ok(curated.blocks[0].references.includes('ГОСТ Р 71216—2024'));
  assert.ok(curated.definitions.some((item) => item.id === 'manual-definition'));
  assert.ok(curated.relatedNorms.some((item) => item.label === 'ГОСТ Р 71216—2024'));
  assert.equal(curated.curation.applied, true);
});

test('normalizeCanonicalPackage prepares canonical-first import contract', () => {
  const normalized = normalizeCanonicalPackage({
    kind: 'normosvod-canonical-document',
    slug: 'custom-doc',
    meta: {
      gostNumber: 'ГОСТ 9999—2026',
      title: 'Тестовый canonical document'
    },
    synopsis: {
      description: 'Импорт из canonical package.'
    },
    blocks: [
      {
        id: 'block-a',
        title: '1 Область применения',
        summary: 'Краткое описание.',
        bodyText: 'Полный текст блока.',
        print: {
          pageNumber: 3
        }
      }
    ]
  });

  const metaRecord = buildMetaFromCanonicalPackage(normalized, {
    fileHash: 'sha256-test',
    importedAt: '2026-04-05T00:00:00.000Z',
    updatedAt: '2026-04-05T00:00:00.000Z'
  });

  assert.equal(normalized.meta.readerMode, 'v2');
  assert.equal(normalized.meta.migrationStatus, 'print-verified');
  assert.equal(normalized.entryPoints.screenUrl, '/doc/custom-doc');
  assert.equal(metaRecord.sourceType, 'canonical-document');
  assert.equal(metaRecord.canonicalDocumentUrl, '/data/canonical/custom-doc.json');
  assert.equal(metaRecord.v2DocumentUrl, '/data/canonical/custom-doc.json');
  assert.equal(metaRecord.navItemsCount, 1);
});

test('extractCanonicalSearchEntries builds page-like search entries from canonical blocks', () => {
  const entries = extractCanonicalSearchEntries({
    blocks: [
      {
        id: 'block-a',
        title: '1 Область применения',
        summary: 'Описание области применения.',
        bodyText: 'Полный текст первого блока.',
        units: [
          {
            id: 'unit-a',
            title: '1.1 Общие положения',
            summary: 'Уточняющий текст.'
          }
        ],
        print: {
          sourcePageNumber: 5
        }
      }
    ]
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].pageIndex, 4);
  assert.equal(entries[0].anchor, '#block-a');
  assert.match(entries[0].text, /Область применения/);
  assert.match(entries[0].text, /Уточняющий текст/);
});

test('normalizeDocumentPackageManifest validates document package manifest with editions and attachments', () => {
  const manifest = normalizeDocumentPackageManifest({
    kind: 'normosvod-document-package',
    version: '0.2.0',
    slug: 'custom-doc',
    documentPath: 'document.json',
    legacyViewerPath: 'legacy/viewer.html',
    attachmentsDir: 'attachments',
    assetsDir: 'assets',
    editions: [
      {
        id: 'edition-2026',
        label: 'Редакция 2026',
        status: 'active',
        effectiveDate: '2026-01-01'
      }
    ],
    attachments: [
      {
        path: 'attachments/sheet-a.pdf',
        label: 'Лист A',
        kind: 'pdf'
      }
    ],
    assets: [
      {
        path: 'assets/cover.png',
        label: 'Cover',
        kind: 'image'
      }
    ]
  });

  assert.equal(manifest.slug, 'custom-doc');
  assert.equal(manifest.legacyViewerPath, 'legacy/viewer.html');
  assert.equal(manifest.assetsDir, 'assets');
  assert.equal(manifest.editions.length, 1);
  assert.equal(manifest.attachments.length, 1);
  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.attachments[0].path, 'attachments/sheet-a.pdf');
  assert.equal(manifest.assets[0].path, 'assets/cover.png');
});

test('resolvePackagePath blocks path traversal outside document package directory', () => {
  assert.throws(() => resolvePackagePath('D:/normosvod/incoming/pkg', '../outside.json'));
});
