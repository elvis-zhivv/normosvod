import { renderHeader } from '../components/header.js';
import { SORT_OPTIONS } from './filters.js';
import { renderCatalogPage, renderHomePage } from './catalog.js';
import { renderDocumentPage, renderMissingDocument } from './document.js';

const appNode = document.getElementById('app');

const state = {
  documents: [],
  stats: {
    totalDocuments: 0,
    totalPages: 0,
    yearRange: null,
    lastImportedLabel: '—'
  }
};

async function loadJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: 'no-store' });

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
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const segments = pathname.split('/').filter(Boolean);

  if (pathname === '/') {
    return { name: 'home', params: {}, query: url.searchParams };
  }

  if (pathname === '/catalog') {
    return { name: 'catalog', params: {}, query: url.searchParams };
  }

  if (segments[0] === 'doc' && segments[1]) {
    return {
      name: 'document',
      params: { slug: decodeURIComponent(segments.slice(1).join('/')) },
      query: url.searchParams
    };
  }

  return { name: 'not-found', params: {}, query: url.searchParams };
}

function getFilters(query) {
  return {
    query: query.get('q') ?? '',
    year: query.get('year') ?? '',
    tag: query.get('tag') ?? '',
    sort: query.get('sort') ?? SORT_OPTIONS.updated
  };
}

function renderLayout(content, route) {
  appNode.innerHTML = `
    ${renderHeader(window.location.pathname)}
    <main class="shell page-shell">
      ${content}
    </main>
  `;

  document.title = route.name === 'document'
    ? `${route.pageTitle ?? route.params.slug} — Normosvod`
      : route.name === 'catalog'
      ? 'Каталог — Normosvod'
      : 'Normosvod — каталог HTML-viewer ГОСТ';
}

function renderRoute() {
  const route = getRoute();
  const filters = getFilters(route.query);

  if (route.name === 'home') {
    renderLayout(renderHomePage({
      documents: state.documents,
      stats: state.stats,
      filters
    }), route);
    return;
  }

  if (route.name === 'catalog') {
    renderLayout(renderCatalogPage({
      documents: state.documents,
      filters
    }), route);
    return;
  }

  if (route.name === 'document') {
    const documentItem = state.documents.find((item) => item.slug === route.params.slug);
    const showEmbeddedViewer = route.query.get('embed') === '1';
    route.pageTitle = documentItem?.gostNumber ?? route.params.slug;

    renderLayout(
      documentItem
        ? renderDocumentPage(documentItem, { showEmbeddedViewer })
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
      <a class="button button-primary" href="/catalog" data-link>В каталог</a>
    </section>
  `, route);
}

function navigate(url, { replace = false } = {}) {
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({}, '', url);
  renderRoute();
}

function handleFormSubmit(event) {
  const form = event.target.closest('[data-filter-form]');

  if (!form) {
    return;
  }

  event.preventDefault();
  const data = new FormData(form);
  const params = new URLSearchParams();

  for (const [key, value] of data.entries()) {
    if (String(value).trim()) {
      params.set(key, String(value));
    }
  }

  const action = form.getAttribute('action') || '/catalog';
  const nextUrl = params.toString() ? `${action}?${params.toString()}` : action;
  navigate(nextUrl);
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

async function bootstrap() {
  const [documents, stats] = await Promise.all([
    loadJson('/data/documents.json', []),
    loadJson('/data/stats.json', state.stats)
  ]);

  state.documents = documents;
  state.stats = stats;

  document.addEventListener('submit', handleFormSubmit);
  document.addEventListener('click', handleLinkClick);
  window.addEventListener('popstate', renderRoute);

  renderRoute();
}

bootstrap();
