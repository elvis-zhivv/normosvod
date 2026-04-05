import { applyDocumentFilters, collectFilterOptions, SORT_OPTIONS } from './filters.js';
import { renderDocCard } from '../components/doc-card.js';
import { escapeHtml } from './html.js';
import { withBase } from './paths.js';

function renderEmptyState() {
  return `
    <section class="empty-state">
      <h2>Ничего не найдено</h2>
      <p>Измените поисковый запрос или снимите часть фильтров.</p>
    </section>
  `;
}

function renderResultsHeading(filtered, filters) {
  if (filters.query?.trim()) {
    return `
      <div>
        <p class="eyebrow">Полнотекстовый поиск</p>
        <h2>${filtered.length} документов по запросу «${escapeHtml(filters.query.trim())}»</h2>
      </div>
    `;
  }

  return `
    <div>
      <p class="eyebrow">Результаты</p>
      <h2>${filtered.length} документов</h2>
    </div>
  `;
}

function renderFilterForm({ filters, options, actionPath, heading, lead, compact = false }) {
  const yearsOptions = options.years
    .map((year) => {
      const escapedYear = escapeHtml(year);
      return `<option value="${escapedYear}" ${String(filters.year) === String(year) ? 'selected' : ''}>${escapedYear}</option>`;
    })
    .join('');

  const tagOptions = options.tags
    .map((tag) => {
      const escapedTag = escapeHtml(tag);
      return `<option value="${escapedTag}" ${filters.tag === tag ? 'selected' : ''}>${escapedTag}</option>`;
    })
    .join('');

  const escapedQuery = escapeHtml(filters.query ?? '');

  return `
    <section class="search-panel ${compact ? 'search-panel-compact' : ''}">
      <div class="search-panel-copy">
        <p class="eyebrow">Каталог</p>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(lead)}</p>
      </div>
      <form class="filter-grid" action="${actionPath}" data-filter-form>
        <label>
          <span>Поиск</span>
          <input type="search" name="q" value="${escapedQuery}" placeholder="ГОСТ, название, теги, год" data-search-input autocomplete="off" />
        </label>
        <label>
          <span>Год</span>
          <select name="year">
            <option value="">Все</option>
            ${yearsOptions}
          </select>
        </label>
        <label>
          <span>Тег</span>
          <select name="tag">
            <option value="">Все</option>
            ${tagOptions}
          </select>
        </label>
        <label>
          <span>Сортировка</span>
          <select name="sort" data-sort-select data-explicit="${filters.hasExplicitSort ? 'true' : 'false'}">
            <option value="${SORT_OPTIONS.updated}" ${filters.sort === SORT_OPTIONS.updated ? 'selected' : ''}>По обновлению</option>
            <option value="${SORT_OPTIONS.relevance}" ${filters.sort === SORT_OPTIONS.relevance ? 'selected' : ''}>По релевантности</option>
            <option value="${SORT_OPTIONS.yearDesc}" ${filters.sort === SORT_OPTIONS.yearDesc ? 'selected' : ''}>Год: новые сверху</option>
            <option value="${SORT_OPTIONS.yearAsc}" ${filters.sort === SORT_OPTIONS.yearAsc ? 'selected' : ''}>Год: старые сверху</option>
            <option value="${SORT_OPTIONS.title}" ${filters.sort === SORT_OPTIONS.title ? 'selected' : ''}>По номеру/названию</option>
          </select>
        </label>
        <div class="filter-actions">
          <button class="button button-primary" type="submit">Применить</button>
          <a class="button button-ghost" href="${actionPath}" data-link>Сбросить</a>
        </div>
      </form>
    </section>
  `;
}

function renderStats(stats) {
  const cards = [
    ['Документов', escapeHtml(stats.totalDocuments ?? 0)],
    ['Страниц', escapeHtml(stats.totalPages ?? 0)],
    ['Лет охвата', escapeHtml(stats.yearRange ? `${stats.yearRange.min}–${stats.yearRange.max}` : '—')],
    ['Последний импорт', escapeHtml(stats.lastImportedLabel ?? '—')]
  ];

  return `
    <section class="stats-grid">
      ${cards
        .map(
          ([label, value]) => `
            <article class="stat-card">
              <p>${escapeHtml(label)}</p>
              <strong>${value}</strong>
            </article>
          `
        )
        .join('')}
    </section>
  `;
}

export function renderHomePage({ documents, searchIndex, stats, filters }) {
  const options = collectFilterOptions(documents);
  const filtered = applyDocumentFilters(documents, filters, searchIndex);
  const recent = filtered.slice(0, 6);
  const hasQuery = Boolean(filters.query?.trim());

  return `
    ${renderFilterForm({
      filters,
      options,
      actionPath: withBase('/catalog'),
      heading: 'Каталог автономных HTML-viewer документов ГОСТ',
      lead: hasQuery
        ? 'Поиск использует полнотекстовый индекс страниц документов и ранжирует результаты по релевантности.'
        : 'Каталог не смешивает runtime документов. Каждый viewer публикуется отдельно, а сайт работает как слой навигации, метаданных и поиска по manifest.'
    })}
    ${renderStats(stats)}
    <section class="content-block">
      <div class="section-head">
        ${hasQuery
          ? renderResultsHeading(filtered, filters)
          : `
            <div>
              <p class="eyebrow">Последние документы</p>
              <h2>Новые и обновлённые viewer</h2>
            </div>
          `}
        <a class="button button-secondary" href="${withBase('/catalog')}" data-link>Открыть полный каталог</a>
      </div>
      <div class="doc-grid">
        ${recent.length > 0 ? recent.map(renderDocCard).join('') : renderEmptyState()}
      </div>
    </section>
  `;
}

export function renderCatalogPage({ documents, searchIndex, filters }) {
  const options = collectFilterOptions(documents);
  const filtered = applyDocumentFilters(documents, filters, searchIndex);

  return `
    ${renderFilterForm({
      filters,
      options,
      actionPath: withBase('/catalog'),
      heading: 'Полный каталог документов',
      lead: 'Фильтрация работает только по manifest-данным. Viewer остаются полностью автономными HTML-файлами.',
      compact: true
    })}
    <section class="content-block">
      <div class="section-head">
        ${renderResultsHeading(filtered, filters)}
      </div>
      <div class="doc-grid">
        ${filtered.length > 0 ? filtered.map(renderDocCard).join('') : renderEmptyState()}
      </div>
    </section>
  `;
}
