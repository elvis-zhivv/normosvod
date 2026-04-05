import { normalizeDocumentUrl, withBase } from '../js/paths.js';

export function renderDocCard(document) {
  const viewerUrl = normalizeDocumentUrl(document.viewerUrl);
  const documentUrl = withBase(`/doc/${document.slug}`);
  const tags = (document.tags ?? [])
    .map((tag) => `<li class="tag-chip">${tag}</li>`)
    .join('');

  return `
    <article class="doc-card">
      <div class="doc-card-preview">
        <div
          class="document-cover-preview document-cover-preview-card"
          data-cover-preview
          data-preview-kind="card"
          data-viewer-url="${viewerUrl}"
          data-gost-number="${document.gostNumber}"
          data-title="${document.shortTitle || document.title}"
          data-year="${document.year ?? ''}"
        >
          <div class="document-cover-preview-shell">
            <div class="document-cover-preview-loading">
              <div class="doc-cover-card" aria-label="Обложка ${document.gostNumber}">
                <p class="doc-cover-card-kicker">${document.gostNumber}</p>
                <strong>${document.shortTitle || document.title}</strong>
                <span>${document.year}</span>
              </div>
            </div>
            <iframe
              title="Титульный лист ${document.gostNumber}"
              loading="lazy"
              tabindex="-1"
            ></iframe>
          </div>
        </div>
      </div>
      <div class="doc-card-body">
        <p class="doc-card-kicker">${document.gostNumber}</p>
        <h3>${document.title}</h3>
        <p class="doc-card-meta">${document.year} · ${document.pages} стр. · ${document.language?.toUpperCase() ?? 'RU'}</p>
        <p class="doc-card-description">${document.description ?? 'Автономный HTML-viewer документа ГОСТ.'}</p>
        <ul class="tag-list">${tags}</ul>
      </div>
      <div class="doc-card-actions">
        <a class="button button-secondary" href="${documentUrl}" data-link>Карточка документа</a>
        <a class="button button-primary" href="${viewerUrl}" target="_blank" rel="noreferrer">Открыть</a>
      </div>
    </article>
  `;
}
