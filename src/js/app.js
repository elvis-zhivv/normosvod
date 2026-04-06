import { renderHeader } from '../components/header.js';
import { SORT_OPTIONS } from './filters.js';
import { renderCatalogPage, renderHomePage } from './catalog.js';
import { renderCurationDocumentPage, renderCurationIndexPage, renderMissingWorkbench } from './curation.js';
import { renderDocumentArtifactPage, renderDocumentPage, renderMissingDocument } from './document.js';
import { shouldOpenV2Reader } from './document-route-state.js';
import { safeDecodePathSegment, stripBasePath, withBase } from './paths.js';
import { enhanceV2Readers } from '../v2/enhance.js';

const appNode = document.getElementById('app');
const SEARCH_INPUT_SELECTOR = 'input[data-search-input]';
const SORT_SELECT_SELECTOR = 'select[data-sort-select]';
const AUTO_SEARCH_DELAY_MS = 280;

const state = {
  documents: [],
  searchIndex: [],
  v2SearchIndex: [],
  curationWorkbenchIndex: [],
  curationWorkbenchBySlug: new Map(),
  stats: {
    totalDocuments: 0,
    totalPages: 0,
    yearRange: null,
    lastImportedLabel: '—'
  }
};
let autoSearchTimerId = null;

async function loadJson(url, fallback) {
  try {
    const response = await fetch(withBase(url), { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn(`Failed to load ${url}:`, error);
    return fallback;
  }
}

function getRoute() {
  const url = new URL(window.location.href);
  const pathname = stripBasePath(url.pathname).replace(/\/+$/, '') || '/';
  const segments = pathname.split('/').filter(Boolean);

  if (pathname === '/') {
    return { name: 'home', currentPath: pathname, params: {}, query: url.searchParams };
  }

  if (pathname === '/catalog') {
    return { name: 'catalog', currentPath: pathname, params: {}, query: url.searchParams };
  }

  if (pathname === '/curation') {
    return { name: 'curation-index', currentPath: pathname, params: {}, query: url.searchParams };
  }

  if (segments[0] === 'curation' && segments[1]) {
    return {
      name: 'curation-document',
      currentPath: pathname,
      params: { slug: safeDecodePathSegment(segments.slice(1).join('/')) },
      query: url.searchParams
    };
  }

  if (segments[0] === 'doc' && segments[1]) {
    const slug = safeDecodePathSegment(segments[1]);
    const mode = segments[2] ?? '';

    if (!mode) {
      return {
        name: 'document',
        currentPath: pathname,
        params: { slug },
        query: url.searchParams,
        hash: url.hash
      };
    }

    if (mode === 'legacy') {
      return {
        name: 'document-legacy',
        currentPath: pathname,
        params: { slug },
        query: url.searchParams,
        hash: url.hash
      };
    }

    if (mode === 'print') {
      return {
        name: 'document-print',
        currentPath: pathname,
        params: { slug },
        query: url.searchParams,
        hash: url.hash
      };
    }

    return {
      name: 'not-found',
      currentPath: pathname,
      params: {},
      query: url.searchParams,
      hash: url.hash
    };
  }

  return { name: 'not-found', currentPath: pathname, params: {}, query: url.searchParams, hash: url.hash };
}

function getFilters(query) {
  const queryValue = query.get('q') ?? '';

  return {
    query: queryValue,
    year: query.get('year') ?? '',
    tag: query.get('tag') ?? '',
    sort: query.get('sort') ?? (queryValue.trim() ? SORT_OPTIONS.relevance : SORT_OPTIONS.updated),
    hasExplicitSort: query.has('sort')
  };
}

function getCurationFilters(query) {
  return {
    query: query.get('q') ?? '',
    draft: query.get('draft') ?? '',
    migration: query.get('migration') ?? '',
    theme: query.get('theme') ?? ''
  };
}

async function loadWorkbenchDocument(slug) {
  if (state.curationWorkbenchBySlug.has(slug)) {
    return state.curationWorkbenchBySlug.get(slug);
  }

  const workbenchDocument = await loadJson(`/data/curation-workbench/${encodeURIComponent(slug)}.json`, null);

  if (workbenchDocument) {
    state.curationWorkbenchBySlug.set(slug, workbenchDocument);
  }

  return workbenchDocument;
}

function renderLayout(content, route) {
  appNode.innerHTML = `
    ${renderHeader(route.currentPath)}
    <main class="shell page-shell">
      ${content}
    </main>
  `;

  document.title = route.name === 'document'
    ? `${route.pageTitle ?? route.params.slug} — Normosvod`
      : route.name === 'document-legacy'
      ? `${route.pageTitle ?? route.params.slug} · Legacy — Normosvod`
      : route.name === 'document-print'
      ? `${route.pageTitle ?? route.params.slug} · Print A4 — Normosvod`
      : route.name === 'catalog'
      ? 'Каталог — Normosvod'
      : route.name.startsWith('curation')
      ? 'Curation Workbench — Normosvod'
      : 'Normosvod — нормативная платформа';
}

async function renderRoute() {
  const route = getRoute();
  const filters = getFilters(route.query);

  if (route.name === 'home') {
    renderLayout(renderHomePage({
      documents: state.documents,
      searchIndex: state.searchIndex,
      v2SearchIndex: state.v2SearchIndex,
      stats: state.stats,
      filters
    }), route);
    return;
  }

  if (route.name === 'catalog') {
    renderLayout(renderCatalogPage({
      documents: state.documents,
      searchIndex: state.searchIndex,
      v2SearchIndex: state.v2SearchIndex,
      filters
    }), route);
    return;
  }

  if (route.name === 'curation-index') {
    renderLayout(renderCurationIndexPage({
      index: state.curationWorkbenchIndex,
      filters: getCurationFilters(route.query)
    }), route);
    return;
  }

  if (route.name === 'curation-document') {
    const workbenchDocument = await loadWorkbenchDocument(route.params.slug);
    const documentItem = state.documents.find((item) => item.slug === route.params.slug) ?? null;
    route.pageTitle = documentItem?.gostNumber ?? route.params.slug;
    renderLayout(
      workbenchDocument
        ? renderCurationDocumentPage(workbenchDocument, documentItem)
        : renderMissingWorkbench(route.params.slug),
      route
    );
    return;
  }

  if (route.name === 'document') {
    const documentItem = state.documents.find((item) => item.slug === route.params.slug);
    const requestedView = route.query.get('view');
    const showEmbeddedViewer = requestedView === 'card' && route.query.get('embed') === '1';
    const showV2Reader = shouldOpenV2Reader(documentItem, requestedView ?? '');
    route.pageTitle = documentItem?.gostNumber ?? route.params.slug;

    renderLayout(
      documentItem
        ? renderDocumentPage(documentItem, { showEmbeddedViewer, showV2Reader, anchor: route.hash })
        : renderMissingDocument(route.params.slug),
      route
    );
    await enhanceV2Readers(state.documents);
    return;
  }

  if (route.name === 'document-legacy' || route.name === 'document-print') {
    const documentItem = state.documents.find((item) => item.slug === route.params.slug);
    route.pageTitle = documentItem?.gostNumber ?? route.params.slug;

    renderLayout(
      documentItem
        ? renderDocumentArtifactPage(documentItem, {
          mode: route.name === 'document-print' ? 'print' : 'legacy',
          anchor: route.hash
        })
        : renderMissingDocument(route.params.slug),
      route
    );
    return;
  }

  renderLayout(`
    <section class="content-block narrow-block">
      <p class="eyebrow">404</p>
      <h1>Маршрут не найден</h1>
      <p>Откройте каталог или главную страницу.</p>
      <a class="button button-primary" href="${withBase('/catalog')}" data-link>В каталог</a>
    </section>
  `, route);
  await enhanceV2Readers(state.documents);
}

function navigate(url, { replace = false } = {}) {
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({}, '', url);
  void renderRoute();
}

function buildFormUrl(form) {
  const data = new FormData(form);
  const params = new URLSearchParams();
  const rawQuery = String(data.get('q') ?? '');
  const normalizedQuery = rawQuery.trim();
  const sortSelect = form.querySelector(SORT_SELECT_SELECTOR);
  const isExplicitSort = sortSelect?.dataset.explicit === 'true';

  for (const [key, value] of data.entries()) {
    if (String(value).trim()) {
      params.set(key, String(value));
    }
  }

  if (normalizedQuery && sortSelect && !isExplicitSort && sortSelect.value === SORT_OPTIONS.updated) {
    params.set('sort', SORT_OPTIONS.relevance);
  }

  const action = form.getAttribute('action') || '/catalog';
  return params.toString() ? `${action}?${params.toString()}` : action;
}

function submitFilterForm(form, options = {}) {
  const nextUrl = buildFormUrl(form);
  navigate(nextUrl, options);
}

function handleFormSubmit(event) {
  const form = event.target.closest('[data-filter-form]');

  if (!form) {
    return;
  }

  event.preventDefault();
  submitFilterForm(form);
}

function handleLinkClick(event) {
  const anchor = event.target.closest('a[data-link]');

  if (!anchor) {
    return;
  }

  const href = anchor.getAttribute('href');

  if (!href || href.startsWith('http')) {
    return;
  }

  event.preventDefault();
  navigate(href);
}

function handleFormChange(event) {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const form = target.closest('[data-filter-form]');

  if (!form) {
    return;
  }

  if (target.matches(SORT_SELECT_SELECTOR)) {
    target.dataset.explicit = 'true';
  }

  if (target.matches('select[name="year"], select[name="tag"], select[name="sort"], select[name="draft"], select[name="migration"], select[name="theme"]')) {
    submitFilterForm(form);
  }
}

function handleSearchInput(event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement) || !target.matches(SEARCH_INPUT_SELECTOR)) {
    return;
  }

  const form = target.closest('[data-filter-form]');

  if (!form) {
    return;
  }

  window.clearTimeout(autoSearchTimerId);
  autoSearchTimerId = window.setTimeout(() => {
    submitFilterForm(form, { replace: true });
  }, AUTO_SEARCH_DELAY_MS);
}

async function bootstrap() {
  const redirectUrl = new URL(window.location.href);
  const redirectPath = redirectUrl.searchParams.get('redirect');

  if (redirectPath) {
    redirectUrl.searchParams.delete('redirect');
    const restoredPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
    const queryString = redirectUrl.searchParams.toString();
    const nextUrl = queryString ? `${restoredPath}?${queryString}` : restoredPath;
    window.history.replaceState({}, '', withBase(nextUrl));
  }

  const [documents, stats, searchIndex, v2SearchIndex, curationWorkbenchIndex] = await Promise.all([
    loadJson('/data/documents.json', []),
    loadJson('/data/stats.json', state.stats),
    loadJson('/data/search-index.json', []),
    loadJson('/data/v2-search-index.json', []),
    loadJson('/data/curation-workbench-index.json', [])
  ]);

  state.documents = documents;
  state.stats = stats;
  state.searchIndex = Array.isArray(searchIndex) ? searchIndex : [];
  state.v2SearchIndex = Array.isArray(v2SearchIndex) ? v2SearchIndex : [];
  state.curationWorkbenchIndex = Array.isArray(curationWorkbenchIndex) ? curationWorkbenchIndex : [];

  document.addEventListener('submit', handleFormSubmit);
  document.addEventListener('click', handleLinkClick);
  document.addEventListener('change', handleFormChange);
  document.addEventListener('input', handleSearchInput);
  window.addEventListener('popstate', () => {
    void renderRoute();
  });

  await renderRoute();
}

bootstrap();
