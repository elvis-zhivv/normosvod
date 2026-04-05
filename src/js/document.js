import { renderViewerFrame } from '../components/viewer-frame.js';
import { normalizeDocumentUrl, withBase } from './paths.js';

function renderNavItems(document) {
  if (!document.navItems?.length) {
    return `
      <section class="content-block">
        <div class="section-head">
          <div>
            <p class="eyebrow">Навигация</p>
            <h2>Быстрый список разделов</h2>
          </div>
        </div>
        <p class="muted-copy">В manifest не найден структурированный список разделов.</p>
      </section>
    `;
  }

  return `
    <section class="content-block">
      <div class="section-head">
        <div>
          <p class="eyebrow">Навигация</p>
          <h2>Разделы документа</h2>
        </div>
      </div>
      <ol class="nav-items-list">
        ${document.navItems
          .map(
            (item) => `
              <li>
                <span>${item.label}</span>
                <small>Страница ${Number(item.targetPageIndex ?? 0) + 1}${item.targetSelector ? ` · ${item.targetSelector}` : ''}</small>
              </li>
            `
          )
          .join('')}
      </ol>
    </section>
  `;
}

export function renderMissingDocument(slug) {
  return `
    <section class="content-block narrow-block">
      <p class="eyebrow">Ошибка маршрута</p>
      <h1>Документ не найден</h1>
      <p>В manifest нет записи для slug <code>${slug}</code>.</p>
      <a class="button button-primary" href="${withBase('/catalog')}" data-link>Вернуться в каталог</a>
    </section>
  `;
}

export function renderDocumentPage(document, { showEmbeddedViewer }) {
  const previewUrl = normalizeDocumentUrl(document.previewUrl);
  const viewerUrl = normalizeDocumentUrl(document.viewerUrl);
  const embedUrl = withBase(`/doc/${document.slug}?embed=${showEmbeddedViewer ? '0' : '1'}`);
  const tags = (document.tags ?? []).map((tag) => `<li class="tag-chip">${tag}</li>`).join('');

  return `
    <section class="document-hero">
      <div class="document-hero-copy">
        <p class="eyebrow">${document.gostNumber}</p>
        <h1>${document.title}</h1>
        <p class="document-lead">${document.description ?? 'Автономный HTML-viewer документа ГОСТ.'}</p>
        <ul class="meta-list">
          <li><strong>Год:</strong> ${document.year}</li>
          <li><strong>Страниц:</strong> ${document.pages}</li>
          <li><strong>Статус:</strong> ${document.status}</li>
          <li><strong>Язык:</strong> ${document.language?.toUpperCase() ?? 'RU'}</li>
          <li><strong>Импорт:</strong> ${new Date(document.importedAt).toLocaleString('ru-RU')}</li>
          <li><strong>Обновление:</strong> ${new Date(document.updatedAt).toLocaleString('ru-RU')}</li>
        </ul>
        <ul class="tag-list">${tags}</ul>
        <div class="hero-actions">
          <a class="button button-primary" href="${viewerUrl}" target="_blank" rel="noreferrer">Открыть viewer</a>
          <a class="button button-secondary" href="${embedUrl}" data-link>${showEmbeddedViewer ? 'Скрыть встроенный просмотр' : 'Встроенный просмотр'}</a>
          <a class="button button-ghost" href="${viewerUrl}" download>Скачать HTML</a>
        </div>
        <p class="direct-link">Прямой URL: <a href="${viewerUrl}" target="_blank" rel="noreferrer">${viewerUrl}</a></p>
      </div>
      <div class="document-hero-preview">
        <img src="${previewUrl}" alt="Титульный лист ${document.gostNumber}" loading="lazy" />
      </div>
    </section>
    ${showEmbeddedViewer ? renderViewerFrame(document) : ''}
    ${renderNavItems(document)}
  `;
}
