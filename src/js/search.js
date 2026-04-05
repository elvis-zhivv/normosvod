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

export function buildDocumentSearchHit(document, query, indexEntry = null) {
  const tokens = tokenizeQuery(query);

  if (tokens.length === 0) {
    return null;
  }

  return buildFullTextSearchHit(document, indexEntry, tokens);
}

export function matchesQuery(document, query, indexEntry = null) {
  return Boolean(buildDocumentSearchHit(document, query, indexEntry));
}
