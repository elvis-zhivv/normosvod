function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export const PAGE_CAPACITY_UNITS = 48;

export function estimateTextUnits(text, scale = 240) {
  const compactText = normalizeText(text);

  if (!compactText) {
    return 0;
  }

  return Math.max(1, Math.ceil(compactText.length / scale));
}

export function estimateUnitPrintUnits(unit) {
  const type = unit?.type ?? 'paragraph';
  const textUnits = estimateTextUnits(unit?.text ?? unit?.summary ?? '', 170);
  const referenceUnits = Math.ceil(Number(unit?.references?.length ?? 0) / 2);

  switch (type) {
    case 'table':
      return 12 + textUnits + referenceUnits;
    case 'table-caption':
      return 2 + textUnits;
    case 'definition':
      return 3 + textUnits;
    case 'section-heading':
    case 'subsection-heading':
    case 'heading':
      return 2 + textUnits;
    case 'note':
      return 3 + textUnits;
    case 'bibliography-item':
    case 'list-item':
      return 2 + textUnits;
    case 'paragraph':
    default:
      return 2 + textUnits + referenceUnits;
  }
}

export function buildPrintLayoutForBlock({ blockType, title, sourceText, units, references, highlights, order }) {
  const baseUnitsByType = {
    meta: 8,
    references: 10,
    'definition-set': 11,
    requirements: 11,
    procedure: 12,
    analysis: 10,
    appendix: 14,
    bibliography: 8,
    report: 9,
    section: 9
  };
  const normalizedTitle = String(title ?? '');
  const unitEstimates = (units ?? []).map((unit) => ({
    unitId: unit.id,
    type: unit.type ?? 'paragraph',
    estimatedUnits: estimateUnitPrintUnits(unit),
    prefersSoloSegment: unit.type === 'table'
  }));
  const unitUnits = unitEstimates.reduce((sum, item) => sum + item.estimatedUnits, 0);
  const textUnits = estimateTextUnits(sourceText);
  const referenceUnits = Math.ceil((references?.length ?? 0) / 2);
  const highlightUnits = highlights?.length ?? 0;
  const titleUnits = estimateTextUnits(normalizedTitle, 48);
  const estimatedUnits = Math.max(
    6,
    (baseUnitsByType[blockType] ?? 9) + unitUnits + textUnits + referenceUnits + highlightUnits + titleUnits
  );
  const isCoverLike = order === 0 || /^страница\s+[ivxlcdm\d]+/iu.test(normalizedTitle);
  const isAppendix = blockType === 'appendix';
  const isMeta = blockType === 'meta';
  const hasHeavyTable = unitEstimates.some((item) => item.type === 'table');
  const splittable = (units?.length ?? 0) >= 3 && !isCoverLike && !isMeta;

  return {
    estimatedUnits,
    minUnits: Math.max(4, Math.ceil(estimatedUnits * 0.65)),
    avoidBreakInside: !splittable,
    keepWithNext: isMeta && estimatedUnits <= 12,
    forcePageBreakBefore: isCoverLike,
    prefersSoloPage: isCoverLike || (isAppendix && estimatedUnits >= 24),
    pageFillWeight: Math.min(3, Math.max(1, Math.ceil(estimatedUnits / 14))),
    splittable,
    segmentTargetUnits: hasHeavyTable ? 24 : (blockType === 'procedure' ? 30 : (isAppendix ? 26 : 32)),
    introUnits: Math.max(4, titleUnits + estimateTextUnits(sourceText, 320) + referenceUnits + highlightUnits),
    unitEstimates
  };
}

export function splitBlockIntoPrintSegments(block) {
  const layout = block?.print?.layout ?? {};
  const units = Array.isArray(block?.units) ? block.units : [];
  const unitEstimateMap = new Map((layout.unitEstimates ?? []).map((item) => [item.unitId, item]));
  const targetUnits = Math.max(18, Number(layout.segmentTargetUnits ?? 32));

  if (!layout.splittable || units.length === 0) {
    return [{
      id: block.id,
      blockId: block.id,
      segmentIndex: 0,
      isContinuation: false,
      title: block.title,
      type: block.type,
      summary: block.summary,
      references: block.references ?? [],
      units,
      estimatedUnits: Math.max(4, Number(layout.estimatedUnits ?? 10)),
      sourcePageNumber: block.print?.sourcePageNumber ?? block.print?.pageNumber ?? 1,
      pageAnchor: block.print?.pageAnchor ?? block.legacy?.targetSelector ?? null,
      forcePageBreakBefore: Boolean(layout.forcePageBreakBefore),
      prefersSoloPage: Boolean(layout.prefersSoloPage)
    }];
  }

  const segments = [];
  let currentUnits = [];
  let currentEstimate = Number(layout.introUnits ?? 6);

  function flushSegment() {
    if (!currentUnits.length) {
      return;
    }

    const segmentIndex = segments.length;
    segments.push({
      id: segmentIndex === 0 ? block.id : `${block.id}--print-${segmentIndex + 1}`,
      blockId: block.id,
      segmentIndex,
      isContinuation: segmentIndex > 0,
      title: block.title,
      type: block.type,
      summary: segmentIndex === 0 ? block.summary : '',
      references: segmentIndex === 0 ? (block.references ?? []) : [],
      units: currentUnits,
      estimatedUnits: currentEstimate,
      sourcePageNumber: block.print?.sourcePageNumber ?? block.print?.pageNumber ?? 1,
      pageAnchor: block.print?.pageAnchor ?? block.legacy?.targetSelector ?? null,
      forcePageBreakBefore: segmentIndex === 0 && Boolean(layout.forcePageBreakBefore),
      prefersSoloPage: segmentIndex === 0 && Boolean(layout.prefersSoloPage)
    });
    currentUnits = [];
    currentEstimate = 6;
  }

  for (const unit of units) {
    const estimate = unitEstimateMap.get(unit.id)?.estimatedUnits ?? estimateUnitPrintUnits(unit);
    const prefersSoloSegment = Boolean(unitEstimateMap.get(unit.id)?.prefersSoloSegment);

    if (prefersSoloSegment && currentUnits.length) {
      flushSegment();
    }

    const shouldFlush = currentUnits.length > 0 && currentEstimate + estimate > targetUnits;

    if (shouldFlush) {
      flushSegment();
    }

    currentUnits.push(unit);
    currentEstimate += estimate;

    if (prefersSoloSegment) {
      flushSegment();
    }
  }

  flushSegment();
  return segments;
}

export function paginatePrintSegments(blocks = []) {
  const segments = blocks.flatMap((block) => splitBlockIntoPrintSegments(block));
  const pages = [];
  let currentPage = [];
  let currentUnits = 0;

  function flushPage() {
    if (!currentPage.length) {
      return;
    }

    pages.push({
      pageNumber: pages.length + 1,
      segments: currentPage
    });
    currentPage = [];
    currentUnits = 0;
  }

  for (const [index, segment] of segments.entries()) {
    const estimatedUnits = Math.max(4, Number(segment.estimatedUnits ?? 10));
    const nextSegment = segments[index + 1] ?? null;
    const nextMinUnits = nextSegment ? Math.max(4, Math.ceil(Number(nextSegment.estimatedUnits ?? 8) * 0.65)) : 0;

    if (segment.forcePageBreakBefore && currentPage.length) {
      flushPage();
    }

    if (segment.prefersSoloPage) {
      flushPage();
      currentPage.push(segment);
      flushPage();
      continue;
    }

    const shouldBreakBefore = currentPage.length > 0 && (
      currentUnits + estimatedUnits > PAGE_CAPACITY_UNITS
      || (currentUnits + estimatedUnits + nextMinUnits > PAGE_CAPACITY_UNITS && segment.isContinuation === false && nextSegment?.blockId === segment.blockId)
    );

    if (shouldBreakBefore) {
      flushPage();
    }

    currentPage.push(segment);
    currentUnits += estimatedUnits;
  }

  flushPage();
  return pages;
}
