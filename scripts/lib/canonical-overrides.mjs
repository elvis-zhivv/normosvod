import path from 'node:path';
import { readJsonFile } from './manifest.mjs';
import { CONTENT_DOCS_DIR } from './project-paths.mjs';

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeUniqueStrings(base = [], extra = []) {
  return Array.from(new Set([
    ...(Array.isArray(base) ? base : []).filter(Boolean),
    ...(Array.isArray(extra) ? extra : []).filter(Boolean)
  ]));
}

function applyItemOverrides(items = [], overrides = {}, appendItems = []) {
  const nextItems = [];

  for (const item of Array.isArray(items) ? items : []) {
    const override = overrides?.[item.id] ?? null;

    if (override?.hidden) {
      continue;
    }

    nextItems.push({
      ...item,
      ...(override ?? {}),
      references: override?.referencesReplace
        ? [...override.referencesReplace]
        : mergeUniqueStrings(item.references, override?.referencesAppend)
    });
  }

  return [...nextItems, ...(Array.isArray(appendItems) ? appendItems : [])];
}

function rebuildRelatedNorms(blocks = [], existingRelatedNorms = [], appendItems = [], overrides = {}) {
  const relationMap = new Map();

  for (const block of blocks) {
    const labels = mergeUniqueStrings(
      block.references,
      (block.units ?? []).flatMap((unit) => unit.references ?? [])
    );

    for (const label of labels) {
      const key = normalizeText(label);

      if (!key) {
        continue;
      }

      const current = relationMap.get(key) ?? {
        id: `related-${key.replace(/[^a-z0-9а-я]+/giu, '-').replace(/^-+|-+$/g, '') || relationMap.size + 1}`,
        label,
        type: 'reference',
        sourceBlockIds: [],
        occurrenceCount: 0
      };

      current.sourceBlockIds = Array.from(new Set([...current.sourceBlockIds, block.id]));
      current.occurrenceCount += 1;
      relationMap.set(key, current);
    }
  }

  const mergedBase = [
    ...relationMap.values(),
    ...(Array.isArray(existingRelatedNorms) ? existingRelatedNorms : []),
    ...(Array.isArray(appendItems) ? appendItems : [])
  ];
  const mergedMap = new Map();

  for (const item of mergedBase) {
    const key = normalizeText(item.label || item.id);

    if (!key) {
      continue;
    }

    const current = mergedMap.get(key) ?? {
      id: item.id,
      label: item.label,
      type: item.type ?? 'reference',
      sourceBlockIds: [],
      occurrenceCount: 0
    };

    current.id = item.id ?? current.id;
    current.label = item.label ?? current.label;
    current.type = item.type ?? current.type;
    current.sourceBlockIds = Array.from(new Set([
      ...current.sourceBlockIds,
      ...(item.sourceBlockIds ?? [])
    ]));
    current.occurrenceCount = Math.max(
      Number(current.occurrenceCount ?? 0),
      Number(item.occurrenceCount ?? 0),
      current.sourceBlockIds.length
    );
    mergedMap.set(key, current);
  }

  const result = Array.from(mergedMap.values()).map((item) => {
    const override = overrides?.[item.id] ?? null;

    if (override?.hidden) {
      return null;
    }

    return {
      ...item,
      ...(override ?? {}),
      sourceBlockIds: Array.from(new Set([
        ...(item.sourceBlockIds ?? []),
        ...(override?.sourceBlockIds ?? [])
      ])),
      occurrenceCount: Number(override?.occurrenceCount ?? item.occurrenceCount ?? 0)
    };
  }).filter(Boolean);

  return result;
}

function rebuildEntities(existingEntities = [], relatedNorms = [], appendItems = [], overrides = {}) {
  const referenceEntities = relatedNorms.map((item, index) => ({
    id: item.id ? `entity-${item.id}` : `entity-reference-${index + 1}`,
    type: 'reference',
    label: item.label
  }));
  const merged = [...(Array.isArray(existingEntities) ? existingEntities : []), ...referenceEntities, ...(Array.isArray(appendItems) ? appendItems : [])];
  const entityMap = new Map();

  for (const entity of merged) {
    const key = normalizeText(entity.label || entity.id);

    if (!key) {
      continue;
    }

    const current = entityMap.get(key) ?? entity;
    entityMap.set(key, { ...current, ...entity });
  }

  return Array.from(entityMap.values())
    .map((entity) => {
      const override = overrides?.[entity.id] ?? null;

      if (override?.hidden) {
        return null;
      }

      return { ...entity, ...(override ?? {}) };
    })
    .filter(Boolean);
}

function rebuildOutline(blocks = []) {
  return blocks.map((block) => ({
    id: block.id,
    title: block.title,
    type: block.type,
    pageNumber: block.print?.sourcePageNumber ?? block.print?.pageNumber ?? null
  }));
}

function rebuildPrintMap(blocks = []) {
  return blocks.map((block) => ({
    blockId: block.id,
    sourcePageNumber: block.print?.sourcePageNumber ?? block.print?.pageNumber ?? null,
    pageNumber: block.print?.pageNumber ?? null,
    pageAnchor: block.print?.pageAnchor ?? null,
    estimatedUnits: block.print?.layout?.estimatedUnits ?? null
  }));
}

function rebuildTakeaways(document) {
  const blocks = document.blocks ?? [];
  const definitionCount = document.definitions?.length ?? 0;
  const relatedNormsCount = document.relatedNorms?.length ?? 0;
  const hiddenBlocks = Number(document.curation?.hiddenBlocksCount ?? 0);

  return [
    `${document.meta?.gostNumber ?? document.slug} сегментирован в ${blocks.length} block units для V2 reader.`,
    definitionCount > 0
      ? `В документе выявлены или подтверждены определения: ${definitionCount}.`
      : 'Определения для документа пока не подтверждены.',
    relatedNormsCount > 0
      ? `Связанные нормы в curated graph: ${relatedNormsCount}.`
      : 'Связанные нормы пока не подтверждены вручную.',
    hiddenBlocks > 0
      ? `Ручной кураторский слой скрыл технические блоки: ${hiddenBlocks}.`
      : 'Кураторский слой не скрывал блоки.'
  ];
}

export function applyCanonicalOverrides(document, overrides = null) {
  if (!overrides || typeof overrides !== 'object') {
    return document;
  }

  const blockOverrides = overrides.blockOverrides ?? {};
  let hiddenBlocksCount = 0;
  const blocks = (document.blocks ?? []).reduce((items, block) => {
    const override = blockOverrides?.[block.id] ?? null;

    if (override?.hidden) {
      hiddenBlocksCount += 1;
      return items;
    }

    const units = applyItemOverrides(block.units, override?.unitOverrides, override?.unitsAppend);
    const nextBlock = {
      ...block,
      ...(override ?? {}),
      units,
      references: override?.referencesReplace
        ? [...override.referencesReplace]
        : mergeUniqueStrings(block.references, override?.referencesAppend),
      highlights: [
        ...(override?.highlightsReplace ?? block.highlights ?? []),
        ...(Array.isArray(override?.highlightsAppend) ? override.highlightsAppend : [])
      ],
      print: {
        ...(block.print ?? {}),
        ...(override?.print ?? {}),
        layout: {
          ...(block.print?.layout ?? {}),
          ...(override?.print?.layout ?? {})
        }
      }
    };

    items.push(nextBlock);
    return items;
  }, []);

  const definitions = applyItemOverrides(document.definitions, overrides.definitionOverrides, overrides.definitionsAppend);
  const relatedNorms = rebuildRelatedNorms(
    blocks,
    overrides.relatedNormsReplace ? [] : document.relatedNorms,
    overrides.relatedNormsAppend,
    overrides.relatedNormOverrides
  );
  const entities = rebuildEntities(
    overrides.entitiesReplace ? [] : document.entities,
    relatedNorms,
    overrides.entitiesAppend,
    overrides.entityOverrides
  );

  const nextDocument = {
    ...document,
    meta: {
      ...(document.meta ?? {}),
      ...(overrides.meta ?? {})
    },
    synopsis: {
      ...(document.synopsis ?? {}),
      ...(overrides.synopsis ?? {})
    },
    source: {
      ...(document.source ?? {}),
      ...(overrides.source ?? {})
    },
    entryPoints: {
      ...(document.entryPoints ?? {}),
      ...(overrides.entryPoints ?? {})
    },
    blocks,
    definitions,
    relatedNorms,
    entities,
    relations: overrides.relationsReplace ?? document.relations ?? [],
    outline: rebuildOutline(blocks),
    printMap: rebuildPrintMap(blocks),
    curation: {
      applied: true,
      hiddenBlocksCount,
      overrideVersion: overrides.version ?? 1
    }
  };

  nextDocument.synopsis.keyTakeaways = overrides.synopsis?.keyTakeaways ?? rebuildTakeaways(nextDocument);
  return nextDocument;
}

export async function readCanonicalOverrides(slug) {
  return readJsonFile(path.join(CONTENT_DOCS_DIR, slug, 'overrides.json'), null);
}
