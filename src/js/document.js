import { renderViewerFrame } from '../components/viewer-frame.js';
import { escapeHtml } from './html.js';
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
                <span>${escapeHtml(item.label)}</span>
                <small>Страница ${escapeHtml(Number(item.targetPageIndex ?? 0) + 1)}${item.targetSelector ? ` · ${escapeHtml(item.targetSelector)}` : ''}</small>
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
      <p>В manifest нет записи для slug <code>${escapeHtml(slug)}</code>.</p>
      <a class="button button-primary" href="${withBase('/catalog')}" data-link>Вернуться в каталог</a>
    </section>
  `;
}

export function renderDocumentPage(document, { showEmbeddedViewer }) {
  const previewUrl = normalizeDocumentUrl(document.previewUrl);
  const viewerUrl = normalizeDocumentUrl(document.viewerUrl);
  const embedUrl = withBase(`/doc/${encodeURIComponent(document.slug ?? '')}?embed=${showEmbeddedViewer ? '0' : '1'}`);
  const tags = (document.tags ?? []).map((tag) => `<li class="tag-chip">${escapeHtml(tag)}</li>`).join('');
  const importedAt = document.importedAt ? new Date(document.importedAt).toLocaleString('ru-RU') : '—';
  const updatedAt = document.updatedAt ? new Date(document.updatedAt).toLocaleString('ru-RU') : '—';

  return `
    <section class="document-hero">
      <div class="document-hero-copy">
        <p class="eyebrow">${escapeHtml(document.gostNumber)}</p>
        <h1>${escapeHtml(document.title)}</h1>
        <p class="document-lead">${escapeHtml(document.description ?? 'Автономный HTML-viewer документа ГОСТ.')}</p>
        <ul class="meta-list">
          <li><strong>Год:</strong> ${escapeHtml(document.year)}</li>
          <li><strong>Страниц:</strong> ${escapeHtml(document.pages)}</li>
          <li><strong>Статус:</strong> ${escapeHtml(document.status)}</li>
          <li><strong>Язык:</strong> ${escapeHtml(document.language?.toUpperCase() ?? 'RU')}</li>
          <li><strong>Импорт:</strong> ${escapeHtml(importedAt)}</li>
          <li><strong>Обновление:</strong> ${escapeHtml(updatedAt)}</li>
        </ul>
        <ul class="tag-list">${tags}</ul>
        <div class="hero-actions">
          <a class="button button-primary" href="${escapeHtml(viewerUrl)}" target="_blank" rel="noreferrer">Открыть viewer</a>
          <a class="button button-secondary" href="${escapeHtml(embedUrl)}" data-link>${showEmbeddedViewer ? 'Скрыть встроенный просмотр' : 'Встроенный просмотр'}</a>
          <a class="button button-ghost" href="${escapeHtml(viewerUrl)}" download>Скачать HTML</a>
        </div>
        <p class="direct-link">Прямой URL: <a href="${escapeHtml(viewerUrl)}" target="_blank" rel="noreferrer">${escapeHtml(viewerUrl)}</a></p>
      </div>
      <div class="document-hero-preview">
        <iframe
          class="doc-preview-frame"
          src="${escapeHtml(previewUrl)}"
          title="Титульный лист ${escapeHtml(document.gostNumber)}"
          loading="lazy"
          tabindex="-1"
        ></iframe>
      </div>
    </section>
    ${showEmbeddedViewer ? renderViewerFrame(document) : ''}
    ${renderNavItems(document)}
  `;
}
