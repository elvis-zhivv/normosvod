import { renderViewerFrame } from '../components/viewer-frame.js';
import { escapeHtml } from './html.js';
import { normalizeDocumentUrl, withBase } from './paths.js';
import { buildDocumentSignals, formatMigrationStatusLabel, formatReaderModeLabel, formatThemeLabel } from './document-signals.js';

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

function renderPlatformStatus(document) {
  return `
    <section class="content-block">
      <div class="section-head">
        <div>
          <p class="eyebrow">Платформенный статус</p>
          <h2>Состояние reader и migration layer</h2>
        </div>
      </div>
      <div class="platform-status-grid">
        <article class="platform-status-card">
          <p class="platform-status-label">Тематический режим</p>
          <strong>${escapeHtml(formatThemeLabel(document.themeId))}</strong>
          <p>Тема применяется к screen-flow и print-A4 представлениям.</p>
        </article>
        <article class="platform-status-card">
          <p class="platform-status-label">Reader mode</p>
          <strong>${escapeHtml(formatReaderModeLabel(document.readerMode))}</strong>
          <p>Текущий маршрут /doc/:slug переключается по manifest-контракту.</p>
        </article>
        <article class="platform-status-card">
          <p class="platform-status-label">Migration status</p>
          <strong>${escapeHtml(formatMigrationStatusLabel(document.migrationStatus))}</strong>
          <p>${document.curationApplied
            ? 'Документ прошёл ручную верификацию canonical-модели.'
            : 'Документ пока использует auto-generated migration слой без ручной верификации.'}</p>
        </article>
        <article class="platform-status-card">
          <p class="platform-status-label">Canonical coverage</p>
          <strong>${escapeHtml(document.v2BlockCount ?? 0)} блоков</strong>
          <p>${escapeHtml(document.v2DefinitionsCount ?? 0)} определений · ${escapeHtml(document.v2RelatedNormsCount ?? 0)} связанных норм</p>
        </article>
      </div>
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

function renderV2Scaffold(document) {
  const readerUrl = withBase(`/doc/${encodeURIComponent(document.slug ?? '')}?view=v2`);
  const cardUrl = withBase(`/doc/${encodeURIComponent(document.slug ?? '')}`);
  const previewUrl = normalizeDocumentUrl(document.previewUrl);
  const legacyUrl = normalizeDocumentUrl(document.legacyViewerUrl || document.viewerUrl);
  const printUrl = normalizeDocumentUrl(document.printUrl || legacyUrl);
  const themeLabel = document.themeId || 'regulation';

  return `
    <section class="v2-entry v2-theme-${escapeHtml(themeLabel)}">
      <div class="v2-entry-copy">
        <p class="eyebrow">Reader V2 Beta</p>
        <h1>${escapeHtml(document.title)}</h1>
        <p class="document-lead">${escapeHtml(document.description ?? 'Структурированный экранный режим документа.')}</p>
        ${renderSignalChips(document)}
        <ul class="meta-list">
          <li><strong>Документ:</strong> ${escapeHtml(document.gostNumber)}</li>
          <li><strong>Тема:</strong> ${escapeHtml(formatThemeLabel(themeLabel))}</li>
          <li><strong>Режим:</strong> ${escapeHtml(formatReaderModeLabel(document.readerMode ?? 'legacy'))}</li>
          <li><strong>Миграция:</strong> ${escapeHtml(formatMigrationStatusLabel(document.migrationStatus ?? 'imported'))}</li>
          <li><strong>Кураторский слой:</strong> ${escapeHtml(document.curationApplied ? 'применён' : 'не применён')}</li>
        </ul>
        <div class="hero-actions">
          <a class="button button-primary" href="${escapeHtml(readerUrl)}" data-link>Reader V2</a>
          <a class="button button-secondary" href="${escapeHtml(cardUrl)}" data-link>Карточка legacy</a>
          <a class="button button-secondary" href="${escapeHtml(legacyUrl)}" target="_blank" rel="noreferrer">Legacy viewer</a>
          <a class="button button-ghost" href="${escapeHtml(printUrl)}" target="_blank" rel="noreferrer">Print A4</a>
        </div>
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
    ${renderPlatformStatus(document)}
    <section
      class="v2-reader-shell"
      data-v2-reader
      data-slug="${escapeHtml(document.slug)}"
      data-theme-id="${escapeHtml(document.themeId ?? 'regulation')}"
      aria-label="Reader V2 ${escapeHtml(document.gostNumber)}"
    >
      <div class="v2-reader-loading">
        <strong>Загрузка V2 scaffold...</strong>
        <p>Если structured document model недоступен, будет показан migration fallback.</p>
      </div>
    </section>
  `;
}

export function renderDocumentPage(document, { showEmbeddedViewer, showV2Reader = false }) {
  const previewUrl = normalizeDocumentUrl(document.previewUrl);
  const viewerUrl = normalizeDocumentUrl(document.viewerUrl);
  const printUrl = normalizeDocumentUrl(document.printUrl || document.viewerUrl);
  const embedUrl = withBase(`/doc/${encodeURIComponent(document.slug ?? '')}?embed=${showEmbeddedViewer ? '0' : '1'}`);
  const readerUrl = withBase(`/doc/${encodeURIComponent(document.slug ?? '')}?view=v2`);
  const tags = (document.tags ?? []).map((tag) => `<li class="tag-chip">${escapeHtml(tag)}</li>`).join('');
  const importedAt = document.importedAt ? new Date(document.importedAt).toLocaleString('ru-RU') : '—';
  const updatedAt = document.updatedAt ? new Date(document.updatedAt).toLocaleString('ru-RU') : '—';

  if (showV2Reader) {
    return renderV2Scaffold(document);
  }

  return `
    <section class="document-hero">
      <div class="document-hero-copy">
        <p class="eyebrow">${escapeHtml(document.gostNumber)}</p>
        <h1>${escapeHtml(document.title)}</h1>
        <p class="document-lead">${escapeHtml(document.description ?? 'Автономный HTML-viewer документа ГОСТ.')}</p>
        ${renderSignalChips(document)}
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
          <a class="button button-primary" href="${escapeHtml(readerUrl)}" data-link>Reader V2</a>
          <a class="button button-secondary" href="${escapeHtml(viewerUrl)}" target="_blank" rel="noreferrer">Открыть viewer</a>
          <a class="button button-secondary" href="${escapeHtml(printUrl)}" target="_blank" rel="noreferrer">Print A4</a>
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
    ${renderPlatformStatus(document)}
    ${renderNavItems(document)}
  `;
}
