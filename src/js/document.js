import { renderDocumentSurface } from '../components/document-surface.js';
import { renderDocumentTextPreview } from '../components/document-text-preview.js';
import { escapeHtml } from './html.js';
import {
  buildDocumentCardRoute,
  buildDocumentLegacyRoute,
  buildDocumentPrintRoute,
  buildDocumentRoute,
  withBase
} from './paths.js';
import { buildDocumentSignals, formatMigrationStatusLabel, formatReaderModeLabel, formatSourceTypeLabel, formatThemeLabel } from './document-signals.js';

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
          <p class="platform-status-label">Import source</p>
          <strong>${escapeHtml(formatSourceTypeLabel(document.sourceType))}</strong>
          <p>${document.supportsPackageManifest
            ? 'Документ управляется через package manifest и может включать редакции, вложения и assets.'
            : 'Документ использует прямой import contract без package manifest.'}</p>
        </article>
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
            : 'Документ пока использует auto-generated migration слой без ручной верификации.'}
            ${document.curationIssuesCount ? ` Открытых QA issues: ${escapeHtml(document.curationIssuesCount)}.` : ''}</p>
        </article>
        <article class="platform-status-card">
          <p class="platform-status-label">Canonical coverage</p>
          <strong>${escapeHtml(document.v2BlockCount ?? 0)} блоков</strong>
          <p>${escapeHtml(document.v2DefinitionsCount ?? 0)} определений · ${escapeHtml(document.v2RelatedNormsCount ?? 0)} связанных норм</p>
        </article>
        <article class="platform-status-card">
          <p class="platform-status-label">Package payload</p>
          <strong>${escapeHtml(document.editionCount ?? 0)} редакций · ${escapeHtml(document.attachmentCount ?? 0)} вложений</strong>
          <p>${escapeHtml(document.assetCount ?? 0)} assets · ${document.hasLegacyViewer ? 'legacy fallback доступен' : 'legacy fallback отсутствует'}</p>
        </article>
      </div>
    </section>
  `;
}

function renderWorkspaceOutline(document) {
  const navItems = Array.isArray(document.navItems) ? document.navItems : [];

  return `
    <aside class="document-workspace-side document-workspace-outline">
      <div class="document-workspace-panel">
        <p class="eyebrow">Содержание</p>
        <h2>Структура документа</h2>
        ${navItems.length
          ? `
            <ol class="document-outline-list">
              ${navItems.map((item) => `
                <li class="document-outline-item">
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>Источник: стр. ${escapeHtml(Number(item.targetPageIndex ?? 0) + 1)}</span>
                </li>
              `).join('')}
            </ol>
          `
          : '<p class="muted-copy">Структура будет показана после импорта или migration pass.</p>'}
      </div>
    </aside>
  `;
}

function renderWorkspaceRail(document, { mode = 'summary' } = {}) {
  const title = mode === 'print'
    ? 'Print route surface'
    : mode === 'legacy'
      ? 'Legacy route surface'
      : 'Документная поверхность';

  return `
    <aside class="document-workspace-side document-workspace-rail">
      <div class="document-workspace-panel document-workspace-panel-surface">
        ${renderDocumentSurface(document, { mode, title })}
      </div>
      <div class="document-workspace-panel">
        <p class="eyebrow">Краткая сводка</p>
        <div class="document-brief-grid">
          <div class="document-brief-item">
            <span>Источник</span>
            <strong>${escapeHtml(formatSourceTypeLabel(document.sourceType))}</strong>
          </div>
          <div class="document-brief-item">
            <span>Режим</span>
            <strong>${escapeHtml(formatReaderModeLabel(document.readerMode))}</strong>
          </div>
          <div class="document-brief-item">
            <span>Блоки</span>
            <strong>${escapeHtml(document.v2BlockCount ?? 0)}</strong>
          </div>
          <div class="document-brief-item">
            <span>Редакции</span>
            <strong>${escapeHtml(document.editionCount ?? 0)}</strong>
          </div>
        </div>
      </div>
    </aside>
  `;
}

function renderDocumentOverview(document, { mode = 'summary', anchor = '' } = {}) {
  const legacyUrl = document.legacyViewerUrl ? buildDocumentLegacyRoute(document.slug ?? '', anchor) : '';
  const printUrl = buildDocumentPrintRoute(document.slug ?? '', anchor);
  const readerUrl = buildDocumentRoute(document.slug ?? '');
  const cardUrl = buildDocumentCardRoute(document.slug ?? '');
  const importedAt = document.importedAt ? new Date(document.importedAt).toLocaleString('ru-RU') : '—';
  const updatedAt = document.updatedAt ? new Date(document.updatedAt).toLocaleString('ru-RU') : '—';
  const tags = (document.tags ?? []).map((tag) => `<li class="tag-chip">${escapeHtml(tag)}</li>`).join('');
  const title = mode === 'legacy'
    ? 'Legacy-режим'
    : mode === 'print'
      ? 'Print A4'
      : document.gostNumber;
  const lead = mode === 'legacy'
    ? 'Legacy-режим остаётся только совместимым архивным слоем. Пользовательский маршрут должен работать как часть платформы, а не как пустая обёртка над старым viewer.'
    : mode === 'print'
      ? 'Print A4 остаётся отдельным представлением того же документа. Экран и печать больше не должны расходиться по источнику правды.'
      : (document.description ?? 'Профессиональный нормативный документ с экранным и печатным представлением.');

  return `
    <section class="document-workspace-panel document-workspace-hero-panel">
      <p class="eyebrow">${escapeHtml(title)}</p>
      <h1>${escapeHtml(document.title)}</h1>
      <p class="document-lead">${escapeHtml(lead)}</p>
      ${renderSignalChips(document)}
      <div class="document-overview-grid">
        <article class="document-overview-card">
          <span>Документ</span>
          <strong>${escapeHtml(document.gostNumber)}</strong>
          <p>${escapeHtml(document.year ?? '—')} · ${escapeHtml(document.pages ?? 0)} стр. · ${escapeHtml(document.language?.toUpperCase() ?? 'RU')}</p>
        </article>
        <article class="document-overview-card">
          <span>Импорт и обновление</span>
          <strong>${escapeHtml(importedAt)}</strong>
          <p>Обновление: ${escapeHtml(updatedAt)}</p>
        </article>
        <article class="document-overview-card">
          <span>Migration</span>
          <strong>${escapeHtml(formatMigrationStatusLabel(document.migrationStatus))}</strong>
          <p>${document.curationApplied ? 'Кураторская верификация применена.' : 'Документ ещё требует ручной верификации.'}</p>
        </article>
      </div>
      <ul class="tag-list">${tags}</ul>
      <div class="hero-actions">
        <a class="button button-primary" href="${escapeHtml(readerUrl)}" data-link>Reader V2</a>
        ${mode !== 'summary' ? `<a class="button button-secondary" href="${escapeHtml(cardUrl)}" data-link>Карточка документа</a>` : ''}
        ${mode !== 'legacy' && legacyUrl ? `<a class="button button-secondary" href="${escapeHtml(legacyUrl)}" data-link>Legacy-режим</a>` : ''}
        ${mode !== 'print'
          ? `<a class="button button-secondary" href="${escapeHtml(printUrl)}" data-link>Print A4</a>`
          : `<button class="button button-secondary" type="button" onclick="window.print()">Печать</button>`}
      </div>
    </section>
  `;
}

function renderRouteSummary(document, { mode = 'summary' } = {}) {
  const routePath = mode === 'legacy'
    ? `/doc/${document.slug}/legacy`
    : mode === 'print'
      ? `/doc/${document.slug}/print`
      : `/doc/${document.slug}`;

  return `
    <section class="document-workspace-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Рабочий режим</p>
          <h2>${mode === 'legacy' ? 'Архивный вход документа' : mode === 'print' ? 'Печатное представление' : 'Карточка документа'}</h2>
        </div>
      </div>
      <div class="document-overview-grid">
        <article class="document-overview-card">
          <span>Маршрут</span>
          <strong><code>${escapeHtml(routePath)}</code></strong>
          <p>Пользовательский URL остаётся чистым и не показывает внутренний <code>.html</code> artifact.</p>
        </article>
        <article class="document-overview-card">
          <span>Источник импорта</span>
          <strong>${escapeHtml(formatSourceTypeLabel(document.sourceType))}</strong>
          <p>${document.supportsPackageManifest
            ? 'Документ поддерживает package manifest, редакции, вложения и assets.'
            : 'Документ импортирован без package manifest.'}</p>
        </article>
        <article class="document-overview-card">
          <span>Пакет</span>
          <strong>${escapeHtml(document.editionCount ?? 0)} редакций · ${escapeHtml(document.attachmentCount ?? 0)} вложений</strong>
          <p>${escapeHtml(document.assetCount ?? 0)} assets · ${document.hasLegacyViewer ? 'legacy fallback доступен' : 'legacy fallback отсутствует'}</p>
        </article>
      </div>
    </section>
  `;
}

function renderDocumentContentSection(document) {
  const preview = renderDocumentTextPreview(document, {
    title: 'Текст документа',
    limit: 4
  });

  if (!preview) {
    return '';
  }

  return `
    <section class="document-workspace-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Содержимое</p>
          <h2>Текст документа</h2>
        </div>
      </div>
      ${preview}
    </section>
  `;
}

function renderDocumentWorkspace(document, {
  mode = 'summary',
  anchor = ''
} = {}) {
  return `
    <section class="document-workspace document-workspace-${escapeHtml(mode)}">
      ${renderWorkspaceOutline(document)}
      <div class="document-workspace-main">
        ${renderDocumentOverview(document, { mode, anchor })}
        ${renderDocumentContentSection(document)}
        ${renderRouteSummary(document, { mode })}
        ${renderPlatformStatus(document)}
        ${renderNavItems(document)}
      </div>
      ${renderWorkspaceRail(document, { mode })}
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
  const readerUrl = buildDocumentRoute(document.slug ?? '');
  const cardUrl = buildDocumentCardRoute(document.slug ?? '');
  const legacyUrl = document.legacyViewerUrl ? buildDocumentLegacyRoute(document.slug ?? '') : '';
  const printUrl = buildDocumentPrintRoute(document.slug ?? '');
  const themeLabel = document.themeId || 'regulation';

  return `
    <section class="v2-entry v2-theme-${escapeHtml(themeLabel)}">
      <div class="v2-entry-copy">
        <p class="eyebrow">Reader V2</p>
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
          ${legacyUrl ? `<a class="button button-secondary" href="${escapeHtml(legacyUrl)}" data-link>Legacy-режим</a>` : ''}
          <a class="button button-ghost" href="${escapeHtml(printUrl)}" data-link>Print A4</a>
        </div>
      </div>
      <div class="document-hero-preview">
        ${renderDocumentSurface(document, { mode: 'summary', title: 'Reader entry surface' })}
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

export function renderDocumentArtifactPage(document, { mode = 'legacy', anchor = '' } = {}) {
  return renderDocumentWorkspace(document, { mode, anchor });
}

export function renderDocumentPage(document, { showEmbeddedViewer, showV2Reader = false, anchor = '' }) {
  if (showV2Reader) {
    return renderV2Scaffold(document);
  }

  return renderDocumentWorkspace(document, { mode: 'summary', anchor });
}
