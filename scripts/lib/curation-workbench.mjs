function countStatuses(items = [], field = 'status') {
  return {
    accepted: items.filter((item) => item?.[field] === 'accepted').length,
    rejected: items.filter((item) => item?.[field] === 'rejected').length,
    pending: items.filter((item) => item?.[field] === 'pending' || item?.[field] === 'needs-review').length
  };
}

function buildIssueMap(issues = []) {
  const issueMap = new Map();

  for (const issue of issues) {
    const key = issue?.blockId || '__document__';
    const current = issueMap.get(key) ?? [];
    current.push(issue);
    issueMap.set(key, current);
  }

  return issueMap;
}

function buildReviewMap(items = [], idField = 'blockId') {
  return new Map(
    (Array.isArray(items) ? items : [])
      .filter((item) => item?.[idField])
      .map((item) => [item[idField], item])
  );
}

function deriveDefaultQueueStatus({ blockIssueList = [], review = null, isFullyCurated = false } = {}) {
  if (review?.status) {
    return review.status;
  }

  if (blockIssueList.some((issue) => issue.severity === 'error' || issue.severity === 'warning')) {
    return 'needs-review';
  }

  if (isFullyCurated) {
    return 'accepted';
  }

  return 'pending';
}

function deriveBlockReviewStatus(blockIssueList = [], blockReview = null, isFullyCurated = false) {
  if (blockReview?.status) {
    return blockReview.status;
  }

  if (blockIssueList.some((issue) => issue.severity === 'error' || issue.severity === 'warning')) {
    return 'needs-review';
  }

  return isFullyCurated ? 'accepted' : 'pending';
}

export function buildCurationWorkbenchEntry({
  canonicalDocument,
  manifestDocument = {},
  curationReport,
  overrides = null,
  draft
}) {
  const blocks = canonicalDocument?.blocks ?? [];
  const issues = curationReport?.issues ?? [];
  const issueMap = buildIssueMap(issues);
  const blockReviewMap = buildReviewMap(draft?.blockReviews, 'blockId');
  const definitionReviewMap = buildReviewMap(draft?.definitionReviews, 'definitionId');
  const relatedNormReviewMap = buildReviewMap(draft?.relatedNormReviews, 'relatedNormId');
  const blockReviewCounts = countStatuses(draft?.blockReviews);
  const definitionReviewCounts = countStatuses(draft?.definitionReviews);
  const relatedNormReviewCounts = countStatuses(draft?.relatedNormReviews);
  const blockOverrides = overrides?.blockOverrides ?? {};
  const isFullyCurated = draft?.reviewState === 'accepted' && curationReport?.reviewStatus === 'curated';

  const blockQueue = blocks.map((block) => {
    const blockIssues = issueMap.get(block.id) ?? [];
    const blockReview = blockReviewMap.get(block.id) ?? null;

    return {
      blockId: block.id,
      title: block.title,
      type: block.type,
      sourcePageNumber: block.print?.sourcePageNumber ?? block.print?.pageNumber ?? null,
      reviewStatus: deriveBlockReviewStatus(blockIssues, blockReview, isFullyCurated),
      issueCodes: blockIssues.map((issue) => issue.code),
      issueCount: blockIssues.length,
      hasOverride: Boolean(blockOverrides[block.id]),
      note: blockReview?.note ?? '',
      reviewer: blockReview?.reviewer ?? '',
      updatedAt: blockReview?.updatedAt ?? ''
    };
  });

  const definitionQueue = (canonicalDocument?.definitions ?? []).map((definition) => {
    const review = definitionReviewMap.get(definition.id) ?? null;

    return {
      definitionId: definition.id,
      term: definition.term,
      blockId: definition.blockId,
      reviewStatus: deriveDefaultQueueStatus({ review, isFullyCurated }),
      note: review?.note ?? '',
      reviewer: review?.reviewer ?? '',
      updatedAt: review?.updatedAt ?? ''
    };
  });

  const relatedNormQueue = (canonicalDocument?.relatedNorms ?? []).map((item) => {
    const review = relatedNormReviewMap.get(item.id) ?? null;

    return {
      relatedNormId: item.id,
      label: item.label,
      sourceBlockIds: item.sourceBlockIds ?? [],
      reviewStatus: deriveDefaultQueueStatus({ review, isFullyCurated }),
      note: review?.note ?? '',
      reviewer: review?.reviewer ?? '',
      updatedAt: review?.updatedAt ?? ''
    };
  });

  return {
    slug: canonicalDocument?.slug ?? manifestDocument?.slug ?? '',
    gostNumber: canonicalDocument?.meta?.gostNumber ?? manifestDocument?.gostNumber ?? '',
    title: canonicalDocument?.meta?.title ?? manifestDocument?.title ?? '',
    themeId: canonicalDocument?.meta?.themeId ?? manifestDocument?.themeId ?? 'regulation',
    readerMode: canonicalDocument?.meta?.readerMode ?? manifestDocument?.readerMode ?? 'legacy',
    migrationStatus: canonicalDocument?.meta?.migrationStatus ?? manifestDocument?.migrationStatus ?? 'imported',
    draftState: draft?.reviewState ?? 'pending',
    targetMigrationStatus: draft?.targetMigrationStatus || '',
    curationApplied: Boolean(canonicalDocument?.curation?.applied),
    overrideVersion: Number(canonicalDocument?.curation?.overrideVersion ?? overrides?.version ?? 0) || 0,
    reportSummary: {
      reviewStatus: curationReport?.reviewStatus ?? 'needs-review',
      counts: curationReport?.counts ?? { errors: 0, warnings: 0, info: 0 },
      suggestedActions: curationReport?.suggestedActions ?? []
    },
    draftSummary: {
      notes: draft?.notes ?? '',
      blockReviews: blockReviewCounts,
      definitionReviews: definitionReviewCounts,
      relatedNormReviews: relatedNormReviewCounts
    },
    queueSummary: {
      blocksPending: blockQueue.filter((item) => item.reviewStatus === 'pending' || item.reviewStatus === 'needs-review').length,
      definitionsPending: definitionQueue.filter((item) => item.reviewStatus === 'pending' || item.reviewStatus === 'needs-review').length,
      relatedNormsPending: relatedNormQueue.filter((item) => item.reviewStatus === 'pending' || item.reviewStatus === 'needs-review').length
    },
    documentIssues: issues.filter((issue) => !issue.blockId),
    blockQueue,
    definitionQueue,
    relatedNormQueue
  };
}
