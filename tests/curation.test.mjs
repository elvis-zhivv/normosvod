import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCurationReportEntry } from '../scripts/lib/curation-report.mjs';
import { normalizeCurationDraft } from '../scripts/lib/curation-draft.mjs';
import { buildCurationWorkbenchEntry } from '../scripts/lib/curation-workbench.mjs';
import { applyCanonicalFieldsToRecord } from '../scripts/lib/manifest-overlay.mjs';

test('buildCurationReportEntry marks curated v2-ready documents as curated', () => {
  const report = buildCurationReportEntry({
    slug: 'doc-a',
    meta: {
      gostNumber: 'ГОСТ 1000—2024',
      title: 'Испытание покрытия',
      themeId: 'coatings',
      readerMode: 'v2',
      migrationStatus: 'v2-ready'
    },
    blocks: [
      {
        id: 'block-1',
        type: 'references',
        bodyText: 'ГОСТ 29317—92.',
        legacy: {
          targetSelector: '#section-2'
        },
        print: {
          sourcePageNumber: 2
        },
        units: []
      }
    ],
    definitions: [],
    relatedNorms: [
      {
        id: 'related-1',
        label: 'ГОСТ 29317—92'
      }
    ],
    curation: {
      applied: true,
      hiddenBlocksCount: 0
    }
  });

  assert.equal(report.reviewStatus, 'curated');
  assert.equal(report.counts.errors, 0);
  assert.equal(report.counts.warnings, 0);
});

test('buildCurationReportEntry flags missing manual curation and semantic gaps', () => {
  const report = buildCurationReportEntry({
    slug: 'doc-b',
    meta: {
      gostNumber: 'ГОСТ 2000—2020',
      title: 'Термины и методы',
      themeId: 'regulation',
      readerMode: 'legacy',
      migrationStatus: 'imported'
    },
    blocks: [
      {
        id: 'block-def',
        type: 'definition-set',
        bodyText: '3 Термины и определения',
        legacy: {},
        print: {
          sourcePageNumber: 3
        },
        units: []
      },
      {
        id: 'block-ref',
        type: 'references',
        bodyText: '2 Нормативные ссылки',
        legacy: {
          targetSelector: '#section-2'
        },
        print: {
          sourcePageNumber: 2
        },
        units: []
      }
    ],
    definitions: [],
    relatedNorms: [],
    curation: {
      applied: false,
      hiddenBlocksCount: 0
    }
  });

  assert.equal(report.reviewStatus, 'needs-review');
  assert.ok(report.counts.warnings >= 4);
  assert.ok(report.issues.some((issue) => issue.code === 'manual-curation-missing'));
  assert.ok(report.issues.some((issue) => issue.code === 'definitions-missing'));
  assert.ok(report.issues.some((issue) => issue.code === 'related-norms-missing'));
});

test('applyCanonicalFieldsToRecord enriches manifest records with curation counts', () => {
  const record = applyCanonicalFieldsToRecord({
    slug: 'doc-c',
    gostNumber: 'ГОСТ 3000—2018',
    title: 'Испытание',
    themeId: 'coatings',
    readerMode: 'legacy',
    migrationStatus: 'imported'
  }, {
    slug: 'doc-c',
    meta: {
      gostNumber: 'ГОСТ 3000—2018',
      title: 'Испытание',
      themeId: 'coatings',
      readerMode: 'hybrid',
      migrationStatus: 'entity-linked'
    },
    synopsis: {
      description: 'Curated synopsis'
    },
    blocks: [
      {
        id: 'block-1',
        type: 'section',
        bodyText: 'Полный текст блока для проверки manifest overlay.',
        legacy: {
          targetSelector: '#section-1'
        },
        print: {
          sourcePageNumber: 1
        },
        units: []
      }
    ],
    definitions: [],
    relatedNorms: [],
    curation: {
      applied: true,
      overrideVersion: 2,
      hiddenBlocksCount: 1
    }
  });

  assert.equal(record.description, 'Curated synopsis');
  assert.equal(record.readerMode, 'hybrid');
  assert.equal(record.migrationStatus, 'entity-linked');
  assert.equal(record.curationApplied, true);
  assert.equal(record.curationVersion, 2);
  assert.equal(record.hiddenBlocksCount, 1);
  assert.ok(Number.isFinite(record.curationIssuesCount));
});

test('normalizeCurationDraft returns stable draft structure', () => {
  const draft = normalizeCurationDraft({
    reviewState: 'needs-review',
    targetMigrationStatus: 'print-verified',
    blockReviews: [
      {
        blockId: 'block-1',
        status: 'accepted',
        note: 'Проверено'
      }
    ],
    definitionReviews: [
      {
        definitionId: 'definition-1',
        status: 'pending'
      }
    ]
  });

  assert.equal(draft.reviewState, 'needs-review');
  assert.equal(draft.targetMigrationStatus, 'print-verified');
  assert.equal(draft.blockReviews[0].blockId, 'block-1');
  assert.equal(draft.definitionReviews[0].definitionId, 'definition-1');
  assert.deepEqual(draft.relatedNormReviews, []);
});

test('buildCurationWorkbenchEntry combines report, overrides and draft review queues', () => {
  const canonicalDocument = {
    slug: 'doc-d',
    meta: {
      gostNumber: 'ГОСТ 4000—2022',
      title: 'Метод испытаний',
      themeId: 'coatings',
      readerMode: 'hybrid',
      migrationStatus: 'entity-linked'
    },
    blocks: [
      {
        id: 'block-1',
        title: '2 Нормативные ссылки',
        type: 'references',
        print: { sourcePageNumber: 2 },
        legacy: { targetSelector: '#section-2' }
      },
      {
        id: 'block-2',
        title: 'Страница 20',
        type: 'section',
        print: { sourcePageNumber: 20 },
        legacy: {}
      }
    ],
    definitions: [
      {
        id: 'definition-1',
        term: 'контрольный образец',
        blockId: 'block-1'
      }
    ],
    relatedNorms: [
      {
        id: 'related-1',
        label: 'ГОСТ 29317—92',
        sourceBlockIds: ['block-1']
      }
    ],
    curation: {
      applied: true,
      overrideVersion: 1
    }
  };
  const report = buildCurationReportEntry(canonicalDocument, {});
  const workbench = buildCurationWorkbenchEntry({
    canonicalDocument,
    curationReport: report,
    overrides: {
      version: 1,
      blockOverrides: {
        'block-1': {
          summary: 'Уточнено'
        }
      }
    },
    draft: normalizeCurationDraft({
      reviewState: 'needs-review',
      targetMigrationStatus: 'print-verified',
      blockReviews: [
        {
          blockId: 'block-1',
          status: 'accepted',
          note: 'Раздел подтвержден'
        }
      ],
      definitionReviews: [
        {
          definitionId: 'definition-1',
          status: 'accepted'
        }
      ],
      relatedNormReviews: [
        {
          relatedNormId: 'related-1',
          status: 'pending'
        }
      ]
    })
  });

  assert.equal(workbench.draftState, 'needs-review');
  assert.equal(workbench.targetMigrationStatus, 'print-verified');
  assert.equal(workbench.overrideVersion, 1);
  assert.equal(workbench.blockQueue[0].hasOverride, true);
  assert.equal(workbench.blockQueue[0].reviewStatus, 'accepted');
  assert.ok(workbench.queueSummary.relatedNormsPending >= 1);
});

test('buildCurationWorkbenchEntry does not keep curated documents in pending queues by default', () => {
  const canonicalDocument = {
    slug: 'doc-e',
    meta: {
      gostNumber: 'ГОСТ 5000—2026',
      title: 'Полностью подтвержденный документ',
      themeId: 'coatings',
      readerMode: 'v2',
      migrationStatus: 'v2-ready'
    },
    blocks: [
      {
        id: 'block-1',
        title: '1 Область применения',
        type: 'section',
        bodyText: 'Подтвержденный блок без замечаний.',
        print: { sourcePageNumber: 1 },
        legacy: { targetSelector: '#section-1' }
      }
    ],
    definitions: [
      {
        id: 'definition-1',
        term: 'контрольный образец',
        blockId: 'block-1'
      }
    ],
    relatedNorms: [
      {
        id: 'related-1',
        label: 'ГОСТ 29317—92',
        sourceBlockIds: ['block-1']
      }
    ],
    curation: {
      applied: true,
      overrideVersion: 1
    }
  };
  const report = buildCurationReportEntry(canonicalDocument, {});
  const workbench = buildCurationWorkbenchEntry({
    canonicalDocument,
    curationReport: report,
    overrides: { version: 1 },
    draft: normalizeCurationDraft({
      reviewState: 'accepted',
      targetMigrationStatus: 'v2-ready'
    })
  });

  assert.equal(workbench.reportSummary.reviewStatus, 'curated');
  assert.equal(workbench.queueSummary.blocksPending, 0);
  assert.equal(workbench.queueSummary.definitionsPending, 0);
  assert.equal(workbench.queueSummary.relatedNormsPending, 0);
  assert.equal(workbench.blockQueue[0].reviewStatus, 'accepted');
  assert.equal(workbench.definitionQueue[0].reviewStatus, 'accepted');
  assert.equal(workbench.relatedNormQueue[0].reviewStatus, 'accepted');
});
