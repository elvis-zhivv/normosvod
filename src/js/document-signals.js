export function formatThemeLabel(themeId) {
  switch (themeId) {
    case 'coatings':
      return 'ЛКМ / покрытия';
    case 'fire-safety':
      return 'Пожарная безопасность';
    case 'construction':
      return 'Строительные нормы';
    case 'regulation':
    default:
      return 'Регулирование';
  }
}

export function formatReaderModeLabel(readerMode) {
  switch (readerMode) {
    case 'v2':
      return 'Reader V2';
    case 'hybrid':
      return 'Hybrid reader';
    case 'legacy':
    default:
      return 'Legacy viewer';
  }
}

export function formatMigrationStatusLabel(migrationStatus) {
  switch (migrationStatus) {
    case 'v2-ready':
      return 'V2 ready';
    case 'print-verified':
      return 'Print verified';
    case 'entity-linked':
      return 'Entity linked';
    case 'segmented':
      return 'Segmented';
    case 'imported':
    default:
      return 'Imported';
  }
}

function toFiniteCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function buildDocumentSignals(document) {
  const blockCount = toFiniteCount(document?.v2BlockCount);
  const definitionsCount = toFiniteCount(document?.v2DefinitionsCount);
  const relatedNormsCount = toFiniteCount(document?.v2RelatedNormsCount);
  const hiddenBlocksCount = toFiniteCount(document?.hiddenBlocksCount);

  return [
    {
      kind: 'theme',
      label: formatThemeLabel(document?.themeId),
      tone: document?.themeId || 'regulation'
    },
    {
      kind: 'reader-mode',
      label: formatReaderModeLabel(document?.readerMode),
      tone: document?.readerMode || 'legacy'
    },
    {
      kind: 'migration-status',
      label: formatMigrationStatusLabel(document?.migrationStatus),
      tone: document?.migrationStatus || 'imported'
    },
    document?.curationApplied
      ? {
        kind: 'curation',
        label: 'Кураторски проверено',
        tone: 'curated'
      }
      : null,
    blockCount
      ? {
        kind: 'blocks',
        label: `${blockCount} блоков`,
        tone: 'metric'
      }
      : null,
    definitionsCount
      ? {
        kind: 'definitions',
        label: `${definitionsCount} определений`,
        tone: 'metric'
      }
      : null,
    relatedNormsCount
      ? {
        kind: 'related-norms',
        label: `${relatedNormsCount} связанных норм`,
        tone: 'metric'
      }
      : null,
    document?.curationApplied
      ? {
        kind: 'hidden-blocks',
        label: hiddenBlocksCount ? `Скрыто блоков: ${hiddenBlocksCount}` : 'Скрытых блоков нет',
        tone: 'metric'
      }
      : null
  ].filter(Boolean);
}
