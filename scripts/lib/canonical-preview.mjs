function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength = 320) {
  const text = cleanText(value);

  if (text.length <= maxLength) {
    return text;
  }

  const sliced = text.slice(0, maxLength);
  const cutIndex = Math.max(sliced.lastIndexOf(' '), Math.floor(maxLength * 0.72));
  return `${sliced.slice(0, cutIndex).trim()}…`;
}

function isMeaningfulBlock(block) {
  if (!block || typeof block !== 'object') {
    return false;
  }

  const title = cleanText(block.title).toLowerCase();
  const bodyText = cleanText(block.bodyText || block.summary);

  if (!bodyText || bodyText.length < 40) {
    return false;
  }

  if (block.type === 'meta' || block.type === 'bibliography') {
    return false;
  }

  if (title === 'обложка' || title === 'содержание' || title === 'издательские сведения') {
    return false;
  }

  return true;
}

export function buildCanonicalPreview(canonicalDocument) {
  const blocks = Array.isArray(canonicalDocument?.blocks) ? canonicalDocument.blocks : [];
  const previewBlocks = blocks.filter(isMeaningfulBlock).slice(0, 4);
  const primaryBlock = previewBlocks[0] || blocks.find((block) => cleanText(block?.bodyText || block?.summary));

  return {
    previewExcerpt: truncateText(primaryBlock?.bodyText || primaryBlock?.summary || canonicalDocument?.synopsis?.description || '', 420),
    previewSections: previewBlocks.map((block) => ({
      blockId: block.id,
      title: cleanText(block.title || 'Раздел'),
      pageNumber: Number(block?.print?.sourcePageNumber ?? block?.print?.pageNumber ?? 0) || 0,
      excerpt: truncateText(block.bodyText || block.summary || '', 240)
    }))
  };
}
