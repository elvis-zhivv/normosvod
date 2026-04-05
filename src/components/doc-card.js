import { normalizeDocumentUrl, withBase } from '../js/paths.js';

export function renderDocCard(document) {
  const previewUrl = normalizeDocumentUrl(document.previewUrl);
  const viewerUrl = normalizeDocumentUrl(document.viewerUrl);
  const documentUrl = withBase(`/doc/${document.slug}`);
  const tags = (document.tags ?? [])
    .map((tag) => `<li class="tag-chip">${tag}</li>`)
    .join('');

  return `
    <article class="doc-card">
      <div class="doc-card-preview">
        <img src="${previewUrl}" alt="Титульный лист ${document.gostNumber}" loading="lazy" />
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
