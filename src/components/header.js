import { withBase } from '../js/paths.js';

export function renderHeader(currentPath) {
  const isHome = currentPath === '/';
  const isCatalog = currentPath.startsWith('/catalog');

  return `
    <header class="site-header shell">
      <a class="brand" href="${withBase('/')}" data-link>
        <span class="brand-mark">N</span>
        <span class="brand-copy">
          <strong>Normosvod</strong>
          <small>HTML-viewer каталог ГОСТ</small>
        </span>
      </a>
      <nav class="site-nav" aria-label="Основная навигация">
        <a class="${isHome ? 'is-active' : ''}" href="${withBase('/')}" data-link>Главная</a>
        <a class="${isCatalog ? 'is-active' : ''}" href="${withBase('/catalog')}" data-link>Каталог</a>
      </nav>
    </header>
  `;
}
