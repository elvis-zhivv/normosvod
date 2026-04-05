import { escapeHtml, highlightSearchTerms } from '../js/html.js';
import { normalizeDocumentUrl, withBase } from '../js/paths.js';

export function renderDocCard(document) {
  const previewUrl = normalizeDocumentUrl(document.previewUrl);
  const viewerUrl = normalizeDocumentUrl(document.viewerUrl);
  const documentUrl = withBase(`/doc/${encodeURIComponent(document.slug ?? '')}`);
  const searchHit = document.searchHit ?? null;
  const matchUrl = searchHit?.anchor ? `${viewerUrl}${searchHit.anchor}` : viewerUrl;
  const tags = (document.tags ?? [])
    .map((tag) => `<li class="tag-chip">${escapeHtml(tag)}</li>`)
    .join('');
  const matchedPagesLabel = searchHit?.matchedPages?.length
    ? searchHit.matchedPages
      .slice(0, 3)
      .map((pageIndex) => Number(pageIndex) + 1)
      .join(', ')
    : '';

  return `
    <article class="doc-card">
      <div class="doc-card-preview">
        <iframe
          class="doc-preview-frame"
          src="${escapeHtml(previewUrl)}"
          title="Титульный лист ${escapeHtml(document.gostNumber)}"
          loading="lazy"
          tabindex="-1"
        ></iframe>
      </div>
      <div class="doc-card-body">
        <p class="doc-card-kicker">${escapeHtml(document.gostNumber)}</p>
        <h3>${escapeHtml(document.title)}</h3>
        <p class="doc-card-meta">${escapeHtml(document.year)} · ${escapeHtml(document.pages)} стр. · ${escapeHtml(document.language?.toUpperCase() ?? 'RU')}</p>
        <p class="doc-card-description">${highlightSearchTerms(searchHit?.snippet ?? document.description ?? 'Автономный HTML-viewer документа ГОСТ.', document.searchQuery ?? '')}</p>
        ${searchHit
          ? `<p class="doc-card-search-meta">Совпадения: ${escapeHtml(searchHit.totalMatches)}${matchedPagesLabel ? ` · стр. ${escapeHtml(matchedPagesLabel)}` : ''}</p>`
          : ''}
        <ul class="tag-list">${tags}</ul>
      </div>
      <div class="doc-card-actions">
        <a class="button button-secondary" href="${escapeHtml(documentUrl)}" data-link>Карточка документа</a>
        <a class="button button-primary" href="${escapeHtml(matchUrl)}" target="_blank" rel="noreferrer">${searchHit ? 'К совпадению' : 'Открыть'}</a>
      </div>
    </article>
  `;
}
