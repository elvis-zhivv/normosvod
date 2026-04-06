import test from 'node:test';
import assert from 'node:assert/strict';

import { assertSchema } from '../scripts/lib/schema-validation.mjs';

test('manifest entry schema requires docType and routing artifacts', async () => {
  await assert.doesNotReject(() => assertSchema('manifest-entry.schema.json', {
    slug: 'gost-29319-2025',
    gostNumber: 'ГОСТ 29319—2025',
    title: 'Материалы лакокрасочные. Метод визуального сравнения цвета',
    shortTitle: 'Метод визуального сравнения цвета',
    docType: 'gost',
    themeId: 'coatings',
    status: 'active',
    year: 2025,
    readerMode: 'v2',
    migrationStatus: 'v2-ready',
    legacyViewerUrl: '/docs/gost-29319-2025/viewer.html',
    printUrl: '/docs/gost-29319-2025/print.html',
    canonicalDocumentUrl: '/data/canonical/gost-29319-2025.json'
  }));
});

test('canonical schema rejects document without docType', async () => {
  await assert.rejects(() => assertSchema('canonical-document.schema.json', {
    kind: 'normosvod-canonical-document',
    slug: 'gost-29319-2025',
    meta: {
      gostNumber: 'ГОСТ 29319—2025',
      title: 'Материалы лакокрасочные. Метод визуального сравнения цвета',
      shortTitle: 'Метод визуального сравнения цвета',
      themeId: 'coatings',
      status: 'active',
      readerMode: 'v2',
      migrationStatus: 'v2-ready'
    },
    blocks: [
      {
        id: 'block-a',
        title: '1. Область применения',
        type: 'section',
        print: {
          sourcePageNumber: 1,
          pageNumber: 1
        }
      }
    ],
    entities: [],
    relations: [],
    printMap: []
  }), /docType/);
});
