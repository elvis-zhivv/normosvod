import { applyDocumentFilters, collectFilterOptions, SORT_OPTIONS } from './filters.js';
import { renderDocCard } from '../components/doc-card.js';
import { withBase } from './paths.js';

function renderEmptyState() {
  return `
    <section class="empty-state">
      <h2>Ничего не найдено</h2>
      <p>Измените поисковый запрос или снимите часть фильтров.</p>
    </section>
  `;
}

function renderFilterForm({ filters, options, actionPath, heading, lead, compact = false }) {
  const yearsOptions = options.years
    .map((year) => `<option value="${year}" ${String(filters.year) === String(year) ? 'selected' : ''}>${year}</option>`)
    .join('');

  const tagOptions = options.tags
    .map((tag) => `<option value="${tag}" ${filters.tag === tag ? 'selected' : ''}>${tag}</option>`)
    .join('');

  return `
    <section class="search-panel ${compact ? 'search-panel-compact' : ''}">
      <div class="search-panel-copy">
        <p class="eyebrow">Каталог</p>
        <h1>${heading}</h1>
        <p>${lead}</p>
      </div>
      <form class="filter-grid" action="${actionPath}" data-filter-form>
        <label>
          <span>Поиск</span>
          <input type="search" name="q" value="${filters.query ?? ''}" placeholder="ГОСТ, название, теги, год" />
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
          <select name="sort">
            <option value="${SORT_OPTIONS.updated}" ${filters.sort === SORT_OPTIONS.updated ? 'selected' : ''}>По обновлению</option>
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
    ['Документов', stats.totalDocuments ?? 0],
    ['Страниц', stats.totalPages ?? 0],
    ['Лет охвата', stats.yearRange ? `${stats.yearRange.min}–${stats.yearRange.max}` : '—'],
    ['Последний импорт', stats.lastImportedLabel ?? '—']
  ];

  return `
    <section class="stats-grid">
      ${cards
        .map(
          ([label, value]) => `
            <article class="stat-card">
              <p>${label}</p>
              <strong>${value}</strong>
            </article>
          `
        )
        .join('')}
    </section>
  `;
}

export function renderHomePage({ documents, stats, filters }) {
  const options = collectFilterOptions(documents);
  const filtered = applyDocumentFilters(documents, filters);
  const recent = filtered.slice(0, 6);

  return `
    ${renderFilterForm({
      filters,
      options,
      actionPath: withBase('/catalog'),
      heading: 'Каталог автономных HTML-viewer документов ГОСТ',
      lead: 'Каталог не смешивает runtime документов. Каждый viewer публикуется отдельно, а сайт работает как слой навигации, метаданных и поиска по manifest.'
    })}
    ${renderStats(stats)}
    <section class="content-block">
      <div class="section-head">
        <div>
          <p class="eyebrow">Последние документы</p>
          <h2>Новые и обновлённые viewer</h2>
        </div>
        <a class="button button-secondary" href="${withBase('/catalog')}" data-link>Открыть полный каталог</a>
      </div>
      <div class="doc-grid">
        ${recent.length > 0 ? recent.map(renderDocCard).join('') : renderEmptyState()}
      </div>
    </section>
  `;
}

export function renderCatalogPage({ documents, filters }) {
  const options = collectFilterOptions(documents);
  const filtered = applyDocumentFilters(documents, filters);

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
        <div>
          <p class="eyebrow">Результаты</p>
          <h2>${filtered.length} документов</h2>
        </div>
      </div>
      <div class="doc-grid">
        ${filtered.length > 0 ? filtered.map(renderDocCard).join('') : renderEmptyState()}
      </div>
    </section>
  `;
}
