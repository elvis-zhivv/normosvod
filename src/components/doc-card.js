export function renderDocCard(document) {
  const tags = (document.tags ?? [])
    .map((tag) => `<li class="tag-chip">${tag}</li>`)
    .join('');

  return `
    <article class="doc-card">
      <div class="doc-card-preview">
        <img src="${document.previewUrl}" alt="Превью ${document.gostNumber}" loading="lazy" />
      </div>
      <div class="doc-card-body">
        <p class="doc-card-kicker">${document.gostNumber}</p>
        <h3>${document.title}</h3>
        <p class="doc-card-meta">${document.year} · ${document.pages} стр. · ${document.language?.toUpperCase() ?? 'RU'}</p>
        <p class="doc-card-description">${document.description ?? 'Автономный HTML-viewer документа ГОСТ.'}</p>
        <ul class="tag-list">${tags}</ul>
      </div>
      <div class="doc-card-actions">
        <a class="button button-secondary" href="/doc/${document.slug}" data-link>Карточка документа</a>
        <a class="button button-primary" href="${document.viewerUrl}" target="_blank" rel="noreferrer">Открыть</a>
      </div>
    </article>
  `;
}
