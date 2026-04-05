import { escapeHtml, highlightSearchTerms } from '../js/html.js';
import { normalizeDocumentUrl, withBase } from '../js/paths.js';
import { buildDocumentSignals } from '../js/document-signals.js';

function getSearchHitBadge(searchHit) {
  switch (searchHit?.kind) {
    case 'v2-definition':
      return { label: 'Определение', className: 'doc-card-hit-definition' };
    case 'v2-related-norm':
      return { label: 'Связанная норма', className: 'doc-card-hit-related-norm' };
    case 'v2-entity':
      return { label: 'Сущность', className: 'doc-card-hit-entity' };
    case 'v2-block':
      return { label: 'Semantic блок', className: 'doc-card-hit-block' };
    default:
      return { label: 'Page hit', className: 'doc-card-hit-legacy' };
  }
}

function renderSearchPreview(searchHit, query, matchedPagesLabel) {
  if (!searchHit) {
    return '';
  }

  const badge = getSearchHitBadge(searchHit);
  const contextLabel = searchHit.contextLabel ? escapeHtml(searchHit.contextLabel) : 'Найденный фрагмент';
  const locationLabel = searchHit.pageNumber
    ? `Печать A4: стр. ${escapeHtml(searchHit.pageNumber)}`
    : (matchedPagesLabel ? `Legacy: стр. ${escapeHtml(matchedPagesLabel)}` : 'Экранный результат');

  return `
    <section class="doc-card-search-hit ${escapeHtml(badge.className)}">
      <div class="doc-card-search-head">
        <span class="doc-card-hit-chip">${escapeHtml(badge.label)}</span>
        <span class="doc-card-hit-meta">${locationLabel}</span>
      </div>
      <strong class="doc-card-hit-title">${contextLabel}</strong>
      <p class="doc-card-hit-snippet">${highlightSearchTerms(searchHit.snippet ?? '', query ?? '')}</p>
    </section>
  `;
}

function renderSignalChips(document) {
  const signals = buildDocumentSignals(document);

  if (!signals.length) {
    return '';
  }

  return `
    <div class="document-signal-list">
      ${signals.map((signal) => `
        <span class="document-signal document-signal-${escapeHtml(signal.tone)}">
          ${escapeHtml(signal.label)}
        </span>
      `).join('')}
    </div>
  `;
}

export function renderDocCard(document) {
  const previewUrl = normalizeDocumentUrl(document.previewUrl);
  const viewerUrl = normalizeDocumentUrl(document.viewerUrl);
  const documentUrl = withBase(`/doc/${encodeURIComponent(document.slug ?? '')}`);
  const searchHit = document.searchHit ?? null;
  const isV2Hit = Boolean(searchHit?.kind?.startsWith('v2-'));
  const matchUrl = searchHit?.actionUrl
    ? withBase(searchHit.actionUrl)
    : (searchHit?.anchor ? `${viewerUrl}${searchHit.anchor}` : viewerUrl);
  const tags = (document.tags ?? [])
    .map((tag) => `<li class="tag-chip">${escapeHtml(tag)}</li>`)
    .join('');
  const matchedPagesLabel = searchHit?.matchedPages?.length
    ? searchHit.matchedPages
      .slice(0, 3)
      .map((pageIndex) => Number(pageIndex) + 1)
      .join(', ')
    : '';
  const searchMetaLabel = searchHit
    ? [
      `Совпадения: ${escapeHtml(searchHit.totalMatches)}`,
      searchHit.contextLabel ? escapeHtml(searchHit.contextLabel) : '',
      matchedPagesLabel ? `стр. ${escapeHtml(matchedPagesLabel)}` : ''
    ].filter(Boolean).join(' · ')
    : '';
  const primaryLabel = searchHit
    ? (isV2Hit ? 'К semantic-блоку' : 'К совпадению')
    : 'Открыть';
  const description = document.description ?? 'Автономный HTML-viewer документа ГОСТ.';

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
        ${renderSignalChips(document)}
        <p class="doc-card-description">${escapeHtml(description)}</p>
        ${renderSearchPreview(searchHit, document.searchQuery ?? '', matchedPagesLabel)}
        ${searchHit
          ? `<p class="doc-card-search-meta">${searchMetaLabel}</p>`
          : ''}
        <ul class="tag-list">${tags}</ul>
      </div>
      <div class="doc-card-actions">
        <a class="button button-secondary" href="${escapeHtml(documentUrl)}" data-link>Карточка документа</a>
        ${isV2Hit
          ? `<a class="button button-primary" href="${escapeHtml(matchUrl)}" data-link>${primaryLabel}</a>`
          : `<a class="button button-primary" href="${escapeHtml(matchUrl)}" target="_blank" rel="noreferrer">${primaryLabel}</a>`}
      </div>
    </article>
  `;
}
