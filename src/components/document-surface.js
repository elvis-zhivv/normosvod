import { escapeHtml } from '../js/html.js';

function renderSectionPreviewItems(navItems = [], limit = 6) {
  const items = Array.isArray(navItems) ? navItems.slice(0, limit) : [];

  if (!items.length) {
    return '<li class="document-surface-empty">Структура документа ещё не подготовлена.</li>';
  }

  return items.map((item) => `
    <li>
      <strong>${escapeHtml(item.label ?? 'Раздел')}</strong>
      <span>Источник: стр. ${escapeHtml(Number(item.targetPageIndex ?? 0) + 1)}</span>
    </li>
  `).join('');
}

function renderBadgeRow(document) {
  const badges = [
    document.year ? `Год ${document.year}` : '',
    document.pages ? `${document.pages} стр.` : '',
    document.status ? document.status : '',
    document.language ? String(document.language).toUpperCase() : '',
    document.editionCount ? `${document.editionCount} ред.` : '',
    document.attachmentCount ? `${document.attachmentCount} влож.` : '',
    document.assetCount ? `${document.assetCount} assets` : ''
  ].filter(Boolean);

  return `
    <div class="document-surface-badges">
      ${badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')}
    </div>
  `;
}

export function renderDocumentSurface(document, { mode = 'summary', title = '' } = {}) {
  const heading = title || (
    mode === 'print'
      ? 'Печатная поверхность'
      : mode === 'legacy'
        ? 'Архивная структура'
        : 'Поверхность документа'
  );
  const summary = mode === 'print'
    ? 'Печатный режим строится из canonical данных документа и не зависит от прямой пользовательской ссылки на HTML-файл.'
    : mode === 'legacy'
      ? 'Legacy-слой сохранён как архивный источник, но пользовательский маршрут уже работает как нативное представление платформы.'
      : (document.description ?? 'Документ открыт как структурированная нормативная поверхность.');

  return `
    <section class="document-surface document-surface-${escapeHtml(mode)}" aria-label="${escapeHtml(document.gostNumber ?? document.title ?? heading)}">
      <p class="document-surface-mode-title">${escapeHtml(heading)}</p>
      <div class="document-surface-head">
        <p class="document-surface-kicker">${escapeHtml(document.gostNumber ?? 'Normosvod')}</p>
        <h2>${escapeHtml(document.title ?? heading)}</h2>
        <p>${escapeHtml(summary)}</p>
      </div>
      ${renderBadgeRow(document)}
      <div class="document-surface-grid">
        <section class="document-surface-panel">
          <p class="document-surface-label">Ключевые разделы</p>
          <ul class="document-surface-list">
            ${renderSectionPreviewItems(document.navItems)}
          </ul>
        </section>
        <section class="document-surface-panel">
          <p class="document-surface-label">Теги и тематика</p>
          <div class="document-surface-tags">
            ${(document.tags ?? []).length
              ? (document.tags ?? []).slice(0, 8).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')
              : '<span>Тематика будет уточнена после migration pass.</span>'}
          </div>
        </section>
        ${document.editionCount || document.attachmentCount || document.assetCount ? `
          <section class="document-surface-panel">
            <p class="document-surface-label">Пакет документа</p>
            <ul class="document-surface-list">
              ${document.editionCount ? `<li><strong>Редакции</strong><span>${escapeHtml(document.editionCount)} записей в package manifest</span></li>` : ''}
              ${document.attachmentCount ? `<li><strong>Вложения</strong><span>${escapeHtml(document.attachmentCount)} файлов и материалов пакета</span></li>` : ''}
              ${document.assetCount ? `<li><strong>Assets</strong><span>${escapeHtml(document.assetCount)} внутренних ресурсов пакета</span></li>` : ''}
            </ul>
          </section>
        ` : ''}
      </div>
    </section>
  `;
}
