import { escapeHtml } from './html.js';
import {
  buildDocumentLegacyRoute,
  buildDocumentPrintRoute,
  buildDocumentRoute,
  normalizeDocumentUrl,
  withBase
} from './paths.js';
import { formatMigrationStatusLabel, formatReaderModeLabel, formatThemeLabel } from './document-signals.js';

function buildFilteredItems(index = [], filters = {}) {
  const query = String(filters.query ?? '').trim().toLowerCase();
  const draft = String(filters.draft ?? '').trim();
  const migration = String(filters.migration ?? '').trim();
  const theme = String(filters.theme ?? '').trim();

  return (Array.isArray(index) ? index : []).filter((item) => {
    const haystack = [
      item?.gostNumber,
      item?.title,
      item?.themeId,
      item?.readerMode,
      item?.migrationStatus,
      item?.reviewStatus,
      item?.draftState
    ].join(' ').toLowerCase();

    if (query && !haystack.includes(query)) {
      return false;
    }

    if (draft && item?.draftState !== draft) {
      return false;
    }

    if (migration && item?.migrationStatus !== migration) {
      return false;
    }

    if (theme && item?.themeId !== theme) {
      return false;
    }

    return true;
  });
}

function collectOptions(items, field) {
  return Array.from(new Set(
    items
      .map((item) => item?.[field])
      .filter(Boolean)
  )).sort((left, right) => String(left).localeCompare(String(right), 'ru'));
}

function renderWorkbenchFilters(index, filters) {
  const draftOptions = collectOptions(index, 'draftState');
  const migrationOptions = collectOptions(index, 'migrationStatus');
  const themeOptions = collectOptions(index, 'themeId');

  return `
    <section class="search-panel search-panel-compact">
      <div class="search-panel-copy">
        <p class="eyebrow">Curation Workbench</p>
        <h1>Очередь ручной верификации</h1>
        <p>Маршрут показывает draft-state, QA issues и очереди проверки для canonical blocks, definitions и связанных норм.</p>
      </div>
      <form class="filter-grid" action="${withBase('/curation')}" data-filter-form>
        <label>
          <span>Поиск</span>
          <input type="search" name="q" value="${escapeHtml(filters.query ?? '')}" placeholder="ГОСТ, статус, тема" data-search-input autocomplete="off" />
        </label>
        <label>
          <span>Draft state</span>
          <select name="draft">
            <option value="">Все</option>
            ${draftOptions.map((value) => `<option value="${escapeHtml(value)}" ${filters.draft === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Migration</span>
          <select name="migration">
            <option value="">Все</option>
            ${migrationOptions.map((value) => `<option value="${escapeHtml(value)}" ${filters.migration === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Theme</span>
          <select name="theme">
            <option value="">Все</option>
            ${themeOptions.map((value) => `<option value="${escapeHtml(value)}" ${filters.theme === value ? 'selected' : ''}>${escapeHtml(formatThemeLabel(value))}</option>`).join('')}
          </select>
        </label>
        <div class="filter-actions">
          <button class="button button-primary" type="submit">Применить</button>
          <a class="button button-ghost" href="${withBase('/curation')}" data-link>Сбросить</a>
        </div>
      </form>
    </section>
  `;
}

function renderWorkbenchStats(items = []) {
  const total = items.length;
  const needsReview = items.filter((item) => item.reviewStatus === 'needs-review').length;
  const readyForCutover = items.filter((item) => item.migrationStatus === 'v2-ready').length;
  const pendingBlocks = items.reduce((sum, item) => sum + Number(item?.queueSummary?.blocksPending ?? 0), 0);

  const cards = [
    ['Документов в очереди', total],
    ['Требуют review', needsReview],
    ['V2 ready', readyForCutover],
    ['Блоков в работе', pendingBlocks]
  ];

  return `
    <section class="stats-grid">
      ${cards.map(([label, value]) => `
        <article class="stat-card">
          <p>${escapeHtml(label)}</p>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `).join('')}
    </section>
  `;
}

function renderWorkbenchCard(item) {
  return `
    <article class="workbench-card">
      <div class="workbench-card-head">
        <div>
          <p class="doc-card-kicker">${escapeHtml(item.gostNumber)}</p>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        <div class="document-signal-list">
          <span class="document-signal document-signal-${escapeHtml(item.themeId || 'regulation')}">${escapeHtml(formatThemeLabel(item.themeId))}</span>
          <span class="document-signal document-signal-${escapeHtml(item.reviewStatus === 'curated' ? 'curated' : 'needs-review')}">${escapeHtml(item.reviewStatus)}</span>
          <span class="document-signal document-signal-${escapeHtml(item.readerMode || 'legacy')}">${escapeHtml(formatReaderModeLabel(item.readerMode))}</span>
          <span class="document-signal document-signal-${escapeHtml(item.migrationStatus || 'imported')}">${escapeHtml(formatMigrationStatusLabel(item.migrationStatus))}</span>
        </div>
      </div>
      <div class="workbench-metrics">
        <div><strong>${escapeHtml(item.queueSummary?.blocksPending ?? 0)}</strong><span>блоков pending</span></div>
        <div><strong>${escapeHtml(item.queueSummary?.definitionsPending ?? 0)}</strong><span>definitions pending</span></div>
        <div><strong>${escapeHtml(item.queueSummary?.relatedNormsPending ?? 0)}</strong><span>related norms pending</span></div>
        <div><strong>${escapeHtml(item.issueCounts?.warnings ?? 0)}</strong><span>warnings</span></div>
      </div>
      <div class="hero-actions">
        <a class="button button-primary" href="${withBase(`/curation/${encodeURIComponent(item.slug)}`)}" data-link>Открыть workbench</a>
        <a class="button button-secondary" href="${buildDocumentRoute(item.slug)}" data-link>Reader V2</a>
      </div>
    </article>
  `;
}

export function renderCurationIndexPage({ index, filters }) {
  const filtered = buildFilteredItems(index, filters);

  return `
    ${renderWorkbenchFilters(index, filters)}
    ${renderWorkbenchStats(filtered)}
    <section class="content-block">
      <div class="section-head">
        <div>
          <p class="eyebrow">Очередь</p>
          <h2>${escapeHtml(filtered.length)} документов в workbench</h2>
        </div>
      </div>
      <div class="workbench-grid">
        ${filtered.length
          ? filtered.map((item) => renderWorkbenchCard(item)).join('')
          : `<section class="empty-state"><h2>Ничего не найдено</h2><p>Измените фильтры curator workbench.</p></section>`}
      </div>
    </section>
  `;
}

function renderQueueTable(title, eyebrow, items, columnsRenderer) {
  return `
    <section class="content-block">
      <div class="section-head">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <p class="muted-copy">${escapeHtml(items.length)} записей</p>
      </div>
      <div class="workbench-list">
        ${items.map((item) => columnsRenderer(item)).join('')}
      </div>
    </section>
  `;
}

export function renderMissingWorkbench(slug) {
  return `
    <section class="content-block narrow-block">
      <p class="eyebrow">Curation Workbench</p>
      <h1>Документ не найден</h1>
      <p>В curator workbench нет записи для slug <code>${escapeHtml(slug)}</code>.</p>
      <a class="button button-primary" href="${withBase('/curation')}" data-link>К очереди</a>
    </section>
  `;
}

export function renderCurationDocumentPage(workbench, documentItem) {
  const printUrl = documentItem ? buildDocumentPrintRoute(documentItem.slug) : normalizeDocumentUrl('');
  const legacyUrl = documentItem ? buildDocumentLegacyRoute(documentItem.slug) : normalizeDocumentUrl('');

  return `
    <section class="document-hero">
      <div class="document-hero-copy">
        <p class="eyebrow">Curation Workbench</p>
        <h1>${escapeHtml(workbench.title)}</h1>
        <p class="document-lead">${escapeHtml(workbench.draftSummary?.notes || 'Документ готовится к следующему migration-status через curator workflow.')}</p>
        <div class="document-signal-list">
          <span class="document-signal document-signal-${escapeHtml(workbench.themeId || 'regulation')}">${escapeHtml(formatThemeLabel(workbench.themeId))}</span>
          <span class="document-signal document-signal-${escapeHtml(workbench.readerMode || 'legacy')}">${escapeHtml(formatReaderModeLabel(workbench.readerMode))}</span>
          <span class="document-signal document-signal-${escapeHtml(workbench.migrationStatus || 'imported')}">${escapeHtml(formatMigrationStatusLabel(workbench.migrationStatus))}</span>
          <span class="document-signal document-signal-${escapeHtml(workbench.reportSummary?.reviewStatus === 'curated' ? 'curated' : 'needs-review')}">${escapeHtml(workbench.reportSummary?.reviewStatus || 'needs-review')}</span>
        </div>
        <ul class="meta-list">
          <li><strong>Документ:</strong> ${escapeHtml(workbench.gostNumber)}</li>
          <li><strong>Draft state:</strong> ${escapeHtml(workbench.draftState)}</li>
          <li><strong>Target status:</strong> ${escapeHtml(workbench.targetMigrationStatus || '—')}</li>
          <li><strong>Override version:</strong> ${escapeHtml(workbench.overrideVersion || 0)}</li>
          <li><strong>Warnings:</strong> ${escapeHtml(workbench.reportSummary?.counts?.warnings ?? 0)}</li>
          <li><strong>Info:</strong> ${escapeHtml(workbench.reportSummary?.counts?.info ?? 0)}</li>
        </ul>
        <div class="hero-actions">
          <a class="button button-primary" href="${buildDocumentRoute(workbench.slug)}" data-link>Reader V2</a>
          ${documentItem?.printUrl ? `<a class="button button-secondary" href="${escapeHtml(printUrl)}" data-link>Print A4</a>` : ''}
          ${documentItem?.legacyViewerUrl ? `<a class="button button-secondary" href="${escapeHtml(legacyUrl)}" data-link>Legacy-режим</a>` : ''}
          <a class="button button-ghost" href="${withBase('/curation')}" data-link>К очереди</a>
        </div>
      </div>
      <div class="platform-status-grid">
        <article class="platform-status-card">
          <p class="platform-status-label">Suggested actions</p>
          <ul class="workbench-compact-list">
            ${(workbench.reportSummary?.suggestedActions ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
        <article class="platform-status-card">
          <p class="platform-status-label">Queue summary</p>
          <ul class="workbench-compact-list">
            <li>Блоков pending: ${escapeHtml(workbench.queueSummary?.blocksPending ?? 0)}</li>
            <li>Definitions pending: ${escapeHtml(workbench.queueSummary?.definitionsPending ?? 0)}</li>
            <li>Related norms pending: ${escapeHtml(workbench.queueSummary?.relatedNormsPending ?? 0)}</li>
          </ul>
        </article>
      </div>
    </section>
    ${renderQueueTable('Document Issues', 'QA', workbench.documentIssues ?? [], (item) => `
      <article class="workbench-row">
        <div class="document-signal-list">
          <span class="document-signal document-signal-${escapeHtml(item.severity === 'error' ? 'needs-review' : 'metric')}">${escapeHtml(item.severity)}</span>
          <span class="document-signal document-signal-metric">${escapeHtml(item.code)}</span>
        </div>
        <p>${escapeHtml(item.message)}</p>
      </article>
    `)}
    ${renderQueueTable('Block Queue', 'Blocks', workbench.blockQueue ?? [], (item) => `
      <article class="workbench-row">
        <div class="workbench-row-head">
          <strong>${escapeHtml(item.title)}</strong>
          <div class="document-signal-list">
            <span class="document-signal document-signal-metric">${escapeHtml(item.type)}</span>
            <span class="document-signal document-signal-${escapeHtml(item.reviewStatus === 'accepted' ? 'curated' : 'needs-review')}">${escapeHtml(item.reviewStatus)}</span>
            <span class="document-signal document-signal-metric">стр. ${escapeHtml(item.sourcePageNumber ?? '—')}</span>
            ${item.hasOverride ? '<span class="document-signal document-signal-curated">override</span>' : ''}
          </div>
        </div>
        <p>${item.note ? escapeHtml(item.note) : 'Комментарий к блоку пока не добавлен.'}</p>
        ${item.issueCodes?.length ? `<p class="muted-copy">Issues: ${escapeHtml(item.issueCodes.join(', '))}</p>` : ''}
      </article>
    `)}
    ${renderQueueTable('Definition Queue', 'Definitions', workbench.definitionQueue ?? [], (item) => `
      <article class="workbench-row">
        <div class="workbench-row-head">
          <strong>${escapeHtml(item.term)}</strong>
          <div class="document-signal-list">
            <span class="document-signal document-signal-${escapeHtml(item.reviewStatus === 'accepted' ? 'curated' : 'needs-review')}">${escapeHtml(item.reviewStatus)}</span>
            <span class="document-signal document-signal-metric">${escapeHtml(item.blockId)}</span>
          </div>
        </div>
        <p>${item.note ? escapeHtml(item.note) : 'Комментарий к определению пока не добавлен.'}</p>
      </article>
    `)}
    ${renderQueueTable('Related Norm Queue', 'Related Norms', workbench.relatedNormQueue ?? [], (item) => `
      <article class="workbench-row">
        <div class="workbench-row-head">
          <strong>${escapeHtml(item.label)}</strong>
          <div class="document-signal-list">
            <span class="document-signal document-signal-${escapeHtml(item.reviewStatus === 'accepted' ? 'curated' : 'needs-review')}">${escapeHtml(item.reviewStatus)}</span>
            <span class="document-signal document-signal-metric">блоков: ${escapeHtml(item.sourceBlockIds?.length ?? 0)}</span>
          </div>
        </div>
        <p>${item.note ? escapeHtml(item.note) : 'Комментарий к связанной норме пока не добавлен.'}</p>
      </article>
    `)}
  `;
}
