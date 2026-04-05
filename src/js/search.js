export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuery(query) {
  return normalizeText(query)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildSearchHaystack(document) {
  return normalizeText([
    document.gostNumber,
    document.title,
    document.shortTitle,
    document.year,
    document.description,
    ...(document.tags ?? [])
  ].join(' '));
}

export function buildSearchIndexMap(searchIndex) {
  return new Map(
    (Array.isArray(searchIndex) ? searchIndex : [])
      .filter((entry) => entry?.slug)
      .map((entry) => [entry.slug, entry])
  );
}

export function buildV2SearchIndexMap(searchIndex) {
  return new Map(
    (Array.isArray(searchIndex) ? searchIndex : [])
      .filter((entry) => entry?.slug)
      .map((entry) => [entry.slug, entry])
  );
}

function countOccurrences(haystack, token) {
  if (!token) {
    return 0;
  }

  let startIndex = 0;
  let count = 0;

  while (startIndex < haystack.length) {
    const matchIndex = haystack.indexOf(token, startIndex);

    if (matchIndex === -1) {
      break;
    }

    count += 1;
    startIndex = matchIndex + token.length;
  }

  return count;
}

function buildSnippet(text, tokens, maxLength = 180) {
  const sourceText = String(text ?? '').replace(/\s+/g, ' ').trim();

  if (!sourceText) {
    return '';
  }

  const normalizedSource = normalizeText(sourceText);
  const firstMatchIndex = tokens.reduce((bestIndex, token) => {
    const tokenIndex = normalizedSource.indexOf(token);

    if (tokenIndex === -1) {
      return bestIndex;
    }

    if (bestIndex === -1 || tokenIndex < bestIndex) {
      return tokenIndex;
    }

    return bestIndex;
  }, -1);

  if (firstMatchIndex === -1 || sourceText.length <= maxLength) {
    return sourceText;
  }

  const start = Math.max(0, firstMatchIndex - 48);
  const end = Math.min(sourceText.length, start + maxLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < sourceText.length ? '…' : '';

  return `${prefix}${sourceText.slice(start, end).trim()}${suffix}`;
}

function buildSemanticSnippet(candidate, tokens) {
  return buildSnippet([
    candidate.title,
    candidate.summary,
    candidate.text,
    ...(candidate.references ?? [])
  ].filter(Boolean).join(' '), tokens);
}

function buildSemanticCandidates(document, indexEntry) {
  if (!indexEntry || typeof indexEntry !== 'object') {
    return [];
  }

  const blockCandidates = (indexEntry.blocks ?? []).map((block) => ({
    kind: 'v2-block',
    id: block.id,
    anchor: block.id ? `#${block.id}` : null,
    title: block.title ?? '',
    type: block.type ?? 'section',
    text: block.text ?? '',
    summary: block.summary ?? '',
    references: [
      ...(block.references ?? []),
      ...(block.highlightLabels ?? []),
      ...(block.unitLabels ?? [])
    ],
    pageNumber: block.pageNumber ?? null,
    actionUrl: `/doc/${encodeURIComponent(document.slug ?? '')}?view=v2${block.id ? `#${block.id}` : ''}`,
    contextLabel: block.title ?? block.type ?? 'Block'
  }));

  const definitionCandidates = (indexEntry.definitions ?? []).map((definition) => ({
    kind: 'v2-definition',
    id: definition.id,
    anchor: definition.blockId ? `#${definition.blockId}` : null,
    title: definition.term ?? '',
    type: 'definition',
    text: definition.summary ?? '',
    summary: definition.summary ?? '',
    references: [],
    pageNumber: blockCandidates.find((block) => block.id === definition.blockId)?.pageNumber ?? null,
    actionUrl: `/doc/${encodeURIComponent(document.slug ?? '')}?view=v2${definition.blockId ? `#${definition.blockId}` : ''}`,
    contextLabel: `Определение: ${definition.term ?? 'термин'}`
  }));

  const relatedNormCandidates = (indexEntry.relatedNorms ?? []).map((item) => ({
    kind: 'v2-related-norm',
    id: item.id,
    anchor: item.sourceBlockIds?.[0] ? `#${item.sourceBlockIds[0]}` : null,
    title: item.label ?? '',
    type: 'related-norm',
    text: item.label ?? '',
    summary: item.label ?? '',
    references: [],
    pageNumber: blockCandidates.find((block) => block.id === item.sourceBlockIds?.[0])?.pageNumber ?? null,
    actionUrl: `/doc/${encodeURIComponent(document.slug ?? '')}?view=v2${item.sourceBlockIds?.[0] ? `#${item.sourceBlockIds[0]}` : ''}`,
    contextLabel: `Связанная норма: ${item.label ?? 'ссылка'}`
  }));

  const entityCandidates = (indexEntry.entities ?? []).map((entity) => ({
    kind: 'v2-entity',
    id: entity.id,
    anchor: blockCandidates[0]?.anchor ?? null,
    title: entity.label ?? '',
    type: entity.type ?? 'entity',
    text: entity.label ?? '',
    summary: entity.label ?? '',
    references: [],
    pageNumber: blockCandidates[0]?.pageNumber ?? null,
    actionUrl: `/doc/${encodeURIComponent(document.slug ?? '')}?view=v2${blockCandidates[0]?.anchor ?? ''}`,
    contextLabel: `Сущность: ${entity.label ?? 'entity'}`
  }));

  return [...blockCandidates, ...definitionCandidates, ...relatedNormCandidates, ...entityCandidates];
}

function buildSemanticSearchHit(document, indexEntry, tokens) {
  const candidates = buildSemanticCandidates(document, indexEntry);
  let bestHit = null;

  for (const candidate of candidates) {
    const haystack = normalizeText([
      candidate.title,
      candidate.type,
      candidate.text,
      candidate.summary,
      ...(candidate.references ?? [])
    ].join(' '));
    const occurrences = tokens.reduce((sum, token) => sum + countOccurrences(haystack, token), 0);

    if (occurrences === 0) {
      continue;
    }

    const containsAllTokens = tokens.every((token) => haystack.includes(token));
    const typeBonus = candidate.kind === 'v2-definition'
      ? 60
      : candidate.kind === 'v2-related-norm'
        ? 52
        : candidate.kind === 'v2-entity'
          ? 34
          : 44;
    const score = 120 + typeBonus + occurrences * 11 + (containsAllTokens ? 90 : 0);
    const hit = {
      kind: candidate.kind,
      score,
      totalMatches: occurrences,
      matchedPages: candidate.pageNumber ? [Number(candidate.pageNumber) - 1] : [],
      matchedBlocks: candidate.id ? [candidate.id] : [],
      pageIndex: candidate.pageNumber ? Number(candidate.pageNumber) - 1 : 0,
      anchor: candidate.anchor,
      snippet: buildSemanticSnippet(candidate, tokens),
      actionUrl: candidate.actionUrl,
      contextLabel: candidate.contextLabel,
      pageNumber: candidate.pageNumber ?? null,
      containsAllTokens
    };

    if (
      !bestHit
      || Number(hit.containsAllTokens) > Number(bestHit.containsAllTokens)
      || hit.score > bestHit.score
    ) {
      bestHit = hit;
    }
  }

  return bestHit;
}

function buildFullTextSearchHit(document, indexEntry, tokens) {
  const manifestHaystack = buildSearchHaystack(document);
  const pageEntries = Array.isArray(indexEntry?.entries) ? indexEntry.entries : [];
  const documentText = normalizeText(pageEntries.map((entry) => entry.text ?? '').join(' '));
  const combinedHaystack = `${manifestHaystack} ${documentText}`.trim();

  if (!tokens.every((token) => combinedHaystack.includes(token))) {
    return null;
  }

  const titleText = normalizeText([document.gostNumber, document.title, document.shortTitle].join(' '));
  const matchedPages = [];
  let bestPage = null;

  for (const entry of pageEntries) {
    const entryText = String(entry?.text ?? '');
    const normalizedEntryText = normalizeText(entryText);
    const entryOccurrences = tokens.reduce(
      (sum, token) => sum + countOccurrences(normalizedEntryText, token),
      0
    );

    if (entryOccurrences === 0) {
      continue;
    }

    const containsAllTokens = tokens.every((token) => normalizedEntryText.includes(token));
    const pageHit = {
      pageIndex: Number(entry?.pageIndex ?? 0),
      anchor: entry?.anchor ?? null,
      occurrences: entryOccurrences,
      containsAllTokens,
      snippet: buildSnippet(entryText, tokens)
    };

    matchedPages.push(pageHit.pageIndex);

    if (
      !bestPage
      || Number(containsAllTokens) > Number(bestPage.containsAllTokens)
      || entryOccurrences > bestPage.occurrences
    ) {
      bestPage = pageHit;
    }
  }

  const manifestOccurrences = tokens.reduce(
    (sum, token) => sum + countOccurrences(manifestHaystack, token),
    0
  );
  const titleBonus = tokens.reduce((sum, token) => {
    if (titleText.startsWith(token)) {
      return sum + 80;
    }

    if (titleText.includes(token)) {
      return sum + 35;
    }

    return sum;
  }, 0);

  const primaryPage = bestPage ?? {
    pageIndex: 0,
    anchor: null,
    occurrences: 0,
    containsAllTokens: false,
    snippet: buildSnippet(document.description || document.title || document.gostNumber, tokens)
  };
  const uniquePages = Array.from(new Set(matchedPages)).sort((left, right) => left - right);

  return {
    score: titleBonus
      + manifestOccurrences * 12
      + primaryPage.occurrences * 8
      + (primaryPage.containsAllTokens ? 60 : 0)
      + uniquePages.length * 5,
    totalMatches: manifestOccurrences + matchedPages.length,
    matchedPages: uniquePages,
    pageIndex: primaryPage.pageIndex,
    anchor: primaryPage.anchor,
    snippet: primaryPage.snippet || buildSnippet(document.description || document.title, tokens)
  };
}

function buildCombinedHaystack(document, indexEntry, v2IndexEntry) {
  return normalizeText([
    buildSearchHaystack(document),
    ...(Array.isArray(indexEntry?.entries) ? indexEntry.entries.map((entry) => entry.text ?? '') : []),
    ...(Array.isArray(v2IndexEntry?.blocks)
      ? v2IndexEntry.blocks.flatMap((block) => [
        block.title,
        block.summary,
        block.text,
        ...(block.references ?? []),
        ...(block.highlightLabels ?? []),
        ...(block.unitLabels ?? [])
      ])
      : []),
    ...(Array.isArray(v2IndexEntry?.entities) ? v2IndexEntry.entities.map((entity) => entity.label ?? '') : []),
    ...(Array.isArray(v2IndexEntry?.definitions)
      ? v2IndexEntry.definitions.flatMap((item) => [item.term ?? '', item.summary ?? ''])
      : []),
    ...(Array.isArray(v2IndexEntry?.relatedNorms) ? v2IndexEntry.relatedNorms.map((item) => item.label ?? '') : [])
  ].join(' '));
}

export function buildDocumentSearchHit(document, query, indexEntry = null, v2IndexEntry = null) {
  const tokens = tokenizeQuery(query);

  if (tokens.length === 0) {
    return null;
  }

  const combinedHaystack = buildCombinedHaystack(document, indexEntry, v2IndexEntry);

  if (!tokens.every((token) => combinedHaystack.includes(token))) {
    return null;
  }

  const semanticHit = buildSemanticSearchHit(document, v2IndexEntry, tokens);
  const legacyHit = buildFullTextSearchHit(document, indexEntry, tokens);

  if (semanticHit && legacyHit) {
    return semanticHit.score >= legacyHit.score ? semanticHit : legacyHit;
  }

  return semanticHit ?? legacyHit;
}

export function matchesQuery(document, query, indexEntry = null, v2IndexEntry = null) {
  return Boolean(buildDocumentSearchHit(document, query, indexEntry, v2IndexEntry));
}
