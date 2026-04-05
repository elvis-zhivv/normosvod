function pushIssue(target, issue) {
  target.push({
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    blockId: issue.blockId ?? null
  });
}

function getDefinitionSetBlocks(blocks = []) {
  return blocks.filter((block) => block?.type === 'definition-set');
}

function getReferenceBlocks(blocks = []) {
  return blocks.filter((block) => block?.type === 'references');
}

export function buildCurationReportEntry(canonicalDocument, manifestDocument = {}) {
  const issues = [];
  const blocks = canonicalDocument?.blocks ?? [];
  const definitions = canonicalDocument?.definitions ?? [];
  const relatedNorms = canonicalDocument?.relatedNorms ?? [];
  const curationApplied = Boolean(canonicalDocument?.curation?.applied);
  const readerMode = canonicalDocument?.meta?.readerMode ?? manifestDocument?.readerMode ?? 'legacy';
  const migrationStatus = canonicalDocument?.meta?.migrationStatus ?? manifestDocument?.migrationStatus ?? 'imported';

  if (!blocks.length) {
    pushIssue(issues, {
      severity: 'error',
      code: 'missing-blocks',
      message: 'Canonical document не содержит ни одного блока.'
    });
  }

  if (!curationApplied) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'manual-curation-missing',
      message: 'Для документа не применён ручной curation слой.'
    });
  }

  if (readerMode !== 'v2') {
    pushIssue(issues, {
      severity: readerMode === 'hybrid' ? 'warning' : 'info',
      code: 'reader-cutover-pending',
      message: `Документ ещё не переведён в полный V2 reader mode (${readerMode}).`
    });
  }

  if (migrationStatus !== 'v2-ready') {
    pushIssue(issues, {
      severity: migrationStatus === 'print-verified' ? 'info' : 'warning',
      code: 'migration-incomplete',
      message: `Migration status документа: ${migrationStatus}.`
    });
  }

  if (getDefinitionSetBlocks(blocks).length > 0 && definitions.length === 0) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'definitions-missing',
      message: 'В документе есть definition-set блоки, но definitions graph пуст.'
    });
  }

  if (getReferenceBlocks(blocks).length > 0 && relatedNorms.length === 0) {
    pushIssue(issues, {
      severity: 'warning',
      code: 'related-norms-missing',
      message: 'В документе есть references блоки, но related norms graph пуст.'
    });
  }

  for (const block of blocks) {
    if (!Number.isFinite(Number(block?.print?.sourcePageNumber))) {
      pushIssue(issues, {
        severity: 'error',
        code: 'missing-source-page',
        message: 'У блока отсутствует source page locator.',
        blockId: block?.id ?? null
      });
    }

    if (!block?.legacy?.targetSelector && !['meta', 'section'].includes(block?.type)) {
      pushIssue(issues, {
        severity: 'info',
        code: 'missing-legacy-anchor',
        message: 'У блока нет legacy selector anchor для обратной трассировки.',
        blockId: block?.id ?? null
      });
    }

    if ((block?.bodyText ?? '').length < 40 && (block?.units ?? []).length === 0) {
      pushIssue(issues, {
        severity: 'info',
        code: 'thin-block',
        message: 'Блок слишком короткий и, вероятно, требует ручной проверки сегментации.',
        blockId: block?.id ?? null
      });
    }
  }

  const counts = {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length
  };

  const reviewStatus = curationApplied && counts.errors === 0 && counts.warnings === 0
    ? 'curated'
    : 'needs-review';

  const suggestedActions = [
    counts.errors > 0 ? 'Исправить ошибки canonical schema и print/source locators.' : null,
    counts.warnings > 0 ? 'Дополнить manual overrides для блоков, определений и связанных норм.' : null,
    !curationApplied ? 'Создать и применить overrides.json для документа.' : null,
    readerMode !== 'v2' ? 'Подготовить документ к полному cutover в Reader V2.' : null
  ].filter(Boolean);

  return {
    slug: canonicalDocument?.slug ?? manifestDocument?.slug ?? '',
    gostNumber: canonicalDocument?.meta?.gostNumber ?? manifestDocument?.gostNumber ?? '',
    title: canonicalDocument?.meta?.title ?? manifestDocument?.title ?? '',
    themeId: canonicalDocument?.meta?.themeId ?? manifestDocument?.themeId ?? 'regulation',
    readerMode,
    migrationStatus,
    curationApplied,
    reviewStatus,
    blockCount: blocks.length,
    definitionsCount: definitions.length,
    relatedNormsCount: relatedNorms.length,
    hiddenBlocksCount: Number(canonicalDocument?.curation?.hiddenBlocksCount ?? 0) || 0,
    counts,
    issues,
    suggestedActions
  };
}
