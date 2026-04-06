import { buildSlug } from './slugify.mjs';
import { normalizeDocType } from './doc-type.mjs';
import { inferThemeId } from './theme.mjs';

function inferBlockType(label) {
  const normalizedLabel = String(label ?? '').toLowerCase();

  if (normalizedLabel.includes('термины') || normalizedLabel.includes('определени')) {
    return 'definition-set';
  }

  if (normalizedLabel.includes('нормативные ссылки')) {
    return 'references';
  }

  if (normalizedLabel.includes('требования')) {
    return 'requirements';
  }

  if (normalizedLabel.includes('испытан') || normalizedLabel.includes('проведение')) {
    return 'procedure';
  }

  if (normalizedLabel.includes('обработка результатов') || normalizedLabel.includes('оценка')) {
    return 'analysis';
  }

  if (normalizedLabel.includes('протокол')) {
    return 'report';
  }

  if (normalizedLabel.includes('приложение')) {
    return 'appendix';
  }

  if (normalizedLabel.includes('библиограф')) {
    return 'bibliography';
  }

  if (
    normalizedLabel.includes('предислов') ||
    normalizedLabel.includes('издательские сведения') ||
    normalizedLabel.includes('ключевые слова')
  ) {
    return 'meta';
  }

  return 'section';
}

function buildKeyTakeaways(document) {
  return [
    `${document.gostNumber} оформлен для режима V2 как структурированный reader shell с переходом в legacy и печать.`,
    `Текущий scaffold использует ${document.navItemsCount || 0} выявленных навигационных узлов как основу block-based модели.`,
    `Тематический режим "${inferThemeId(document)}" назначен автоматически по номеру, названию и тегам документа.`
  ];
}

function buildEntities(document) {
  return (document.tags ?? [])
    .filter(Boolean)
    .slice(0, 8)
    .map((tag, index) => ({
      id: `entity-${index + 1}`,
      type: index === 0 ? 'document-class' : 'topic',
      label: tag
    }));
}

export function buildV2DocumentStub(document) {
  const themeId = document.themeId || inferThemeId(document);
  const docType = normalizeDocType(document.docType, document);
  const blocks = (document.navItems ?? []).map((item, index) => {
    const blockId = buildSlug(`${document.slug}-${item.label || `block-${index + 1}`}`) || `${document.slug}-block-${index + 1}`;
    const pageNumber = Number(item.targetPageIndex ?? index) + 1;

    return {
      id: blockId,
      type: inferBlockType(item.label),
      title: item.label || `Блок ${index + 1}`,
      summary: `Миграционный блок V2, построенный по legacy navigation item. Источник: страница ${pageNumber}.`,
      legacy: {
        pageIndex: Number(item.targetPageIndex ?? index),
        targetSelector: item.targetSelector ?? null
      },
      print: {
        pageNumber,
        pageAnchor: item.targetSelector ?? null
      }
    };
  });

  const relations = blocks
    .slice(1)
    .map((block, index) => ({
      from: blocks[index].id,
      to: block.id,
      type: 'next-block'
    }));

  return {
    version: '0.1.0',
    slug: document.slug,
    docType,
    meta: {
      gostNumber: document.gostNumber,
      title: document.title,
      shortTitle: document.shortTitle,
      docType,
      year: document.year,
      status: document.status,
      language: document.language,
      pages: document.pages,
      themeId,
      readerMode: document.readerMode || 'legacy',
      migrationStatus: document.migrationStatus || 'imported'
    },
    synopsis: {
      description: document.description || `Структурированный V2 scaffold для ${document.gostNumber}.`,
      keyTakeaways: buildKeyTakeaways(document)
    },
    entryPoints: {
      screenUrl: `/doc/${encodeURIComponent(document.slug)}?view=v2`,
      legacyUrl: document.legacyViewerUrl || document.viewerUrl,
      printUrl: document.printUrl || document.viewerUrl
    },
    outline: blocks.map((block) => ({
      id: block.id,
      title: block.title,
      type: block.type,
      pageNumber: block.print.pageNumber
    })),
    blocks,
    entities: buildEntities(document),
    relations,
    printMap: blocks.map((block) => ({
      blockId: block.id,
      pageNumber: block.print.pageNumber,
      pageAnchor: block.print.pageAnchor
    }))
  };
}
