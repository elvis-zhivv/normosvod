import { escapeHtml } from '../js/html.js';

function renderPreviewSections(previewSections = [], { compact = false, limit = 3 } = {}) {
  const items = Array.isArray(previewSections) ? previewSections.slice(0, limit) : [];

  if (!items.length) {
    return '';
  }

  return `
    <div class="document-preview-sections ${compact ? 'document-preview-sections-compact' : ''}">
      ${items.map((item) => `
        <article class="document-preview-section">
          <p class="document-preview-title">${escapeHtml(item.title)}</p>
          ${item.pageNumber ? `<p class="document-preview-meta">Стр. ${escapeHtml(item.pageNumber)}</p>` : ''}
          <p class="document-preview-excerpt">${escapeHtml(item.excerpt)}</p>
        </article>
      `).join('')}
    </div>
  `;
}

export function renderDocumentTextPreview(document, {
  title = 'Фрагменты документа',
  compact = false,
  limit = 3
} = {}) {
  const excerpt = String(document?.previewExcerpt ?? '').trim();
  const sections = Array.isArray(document?.previewSections) ? document.previewSections : [];

  if (!excerpt && !sections.length) {
    return '';
  }

  return `
    <section class="document-text-preview ${compact ? 'document-text-preview-compact' : ''}">
      <p class="document-surface-label">${escapeHtml(title)}</p>
      ${excerpt ? `<p class="document-text-preview-lead">${escapeHtml(excerpt)}</p>` : ''}
      ${renderPreviewSections(sections, { compact, limit })}
    </section>
  `;
}
