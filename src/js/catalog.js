import { applyDocumentFilters, collectFilterOptions, SORT_OPTIONS } from './filters.js';
import { renderDocCard } from '../components/doc-card.js';
import { escapeHtml } from './html.js';
import { withBase } from './paths.js';

const SEARCH_GROUPS = [
  { id: 'v2-definition', label: 'Определения', eyebrow: 'Semantic Results' },
  { id: 'v2-related-norm', label: 'Связанные нормы', eyebrow: 'Linked Norms' },
  { id: 'v2-block', label: 'Блоки документа', eyebrow: 'Screen Flow' },
  { id: 'v2-entity', label: 'Сущности', eyebrow: 'Entity Hits' },
  { id: 'legacy', label: 'Документы', eyebrow: 'Legacy / Document Hits' }
];

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
        <p class="eyebrow">Поисковая выдача</p>
        <h2>${filtered.length} документов с совпадениями по запросу «${escapeHtml(filters.query.trim())}»</h2>
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

function getSearchGroupId(document) {
  const kind = document.searchHit?.kind;

  if (kind && SEARCH_GROUPS.some((group) => group.id === kind)) {
    return kind;
  }

  return 'legacy';
}

function groupSearchResults(documents) {
  const grouped = new Map(SEARCH_GROUPS.map((group) => [group.id, []]));

  for (const document of documents) {
    grouped.get(getSearchGroupId(document)).push(document);
  }

  return SEARCH_GROUPS
    .map((group) => ({
      ...group,
      items: grouped.get(group.id) ?? []
    }))
    .filter((group) => group.items.length > 0);
}

function renderSearchSummary(groups) {
  return `
    <div class="search-result-summary">
      ${groups.map((group) => `
        <span class="search-result-chip">
          <strong>${escapeHtml(group.items.length)}</strong>
          <span>${escapeHtml(group.label)}</span>
        </span>
      `).join('')}
    </div>
  `;
}

function renderSearchGroups(documents, filters) {
  const groups = groupSearchResults(documents);

  if (groups.length === 0) {
    return renderEmptyState();
  }

  return `
    ${renderSearchSummary(groups)}
    <div class="search-result-groups">
      ${groups.map((group) => `
        <section class="search-result-group">
          <div class="section-head">
            <div>
              <p class="eyebrow">${escapeHtml(group.eyebrow)}</p>
              <h3>${escapeHtml(group.label)}</h3>
            </div>
            <p class="muted-copy">${escapeHtml(group.items.length)} результата</p>
          </div>
          <div class="doc-grid">
            ${group.items.map((item) => renderDocCard({ ...item, searchQuery: filters.query ?? '' })).join('')}
          </div>
        </section>
      `).join('')}
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

export function renderHomePage({ documents, searchIndex, v2SearchIndex, stats, filters }) {
  const options = collectFilterOptions(documents);
  const filtered = applyDocumentFilters(documents, filters, searchIndex, v2SearchIndex);
  const hasQuery = Boolean(filters.query?.trim());
  const recent = filtered.slice(0, 6);

  return `
    ${renderFilterForm({
      filters,
      options,
      actionPath: withBase('/catalog'),
      heading: 'Каталог автономных HTML-viewer документов ГОСТ',
      lead: hasQuery
        ? 'Поиск использует semantic block/entity index V2 и page-based fallback legacy viewer.'
        : 'Каталог больше не ограничен page-based поиском: при наличии canonical V2 model результаты ранжируются по блокам, сущностям и связанным нормам.'
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
      ${hasQuery
        ? renderSearchGroups(filtered, filters)
        : `<div class="doc-grid">
            ${recent.length > 0 ? recent.map(renderDocCard).join('') : renderEmptyState()}
          </div>`}
    </section>
  `;
}

export function renderCatalogPage({ documents, searchIndex, v2SearchIndex, filters }) {
  const options = collectFilterOptions(documents);
  const filtered = applyDocumentFilters(documents, filters, searchIndex, v2SearchIndex);

  return `
    ${renderFilterForm({
      filters,
      options,
      actionPath: withBase('/catalog'),
      heading: 'Полный каталог документов',
      lead: 'Каталог использует manifest-фильтры и semantic search по canonical V2 blocks с fallback на legacy page index.',
      compact: true
    })}
    <section class="content-block">
      <div class="section-head">
        ${renderResultsHeading(filtered, filters)}
      </div>
      ${filters.query?.trim()
        ? renderSearchGroups(filtered, filters)
        : `<div class="doc-grid">
            ${filtered.length > 0 ? filtered.map(renderDocCard).join('') : renderEmptyState()}
          </div>`}
    </section>
  `;
}
