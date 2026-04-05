import { escapeHtml } from '../js/html.js';
import {
  buildDocumentLegacyRoute,
  buildDocumentPrintRoute,
  normalizeDocumentUrl
} from '../js/paths.js';

function buildArtifactUrl(baseUrl, anchor = '') {
  const normalizedUrl = normalizeDocumentUrl(baseUrl);

  if (!anchor || !String(anchor).startsWith('#') || normalizedUrl === 'about:blank') {
    return normalizedUrl;
  }

  return `${normalizedUrl}${anchor}`;
}

function renderEmbeddedFrame({ title, heading, src, openUrl, openLabel }) {
  return `
    <section class="viewer-embed" aria-label="${escapeHtml(title)}">
      <div class="viewer-embed-head">
        <strong>${escapeHtml(heading)}</strong>
        <a href="${escapeHtml(openUrl)}" data-link>${escapeHtml(openLabel)}</a>
      </div>
      <iframe
        title="${escapeHtml(title)}"
        src="${escapeHtml(src)}"
        loading="lazy"
        referrerpolicy="no-referrer"
      ></iframe>
    </section>
  `;
}

export function renderViewerFrame(document, { anchor = '' } = {}) {
  const viewerUrl = buildArtifactUrl(document.viewerUrl, anchor);
  const legacyRouteUrl = buildDocumentLegacyRoute(document.slug, anchor);

  return renderEmbeddedFrame({
    title: `Legacy reader ${document.gostNumber}`,
    heading: 'Legacy-режим',
    src: viewerUrl,
    openUrl: legacyRouteUrl,
    openLabel: 'Открыть отдельным маршрутом'
  });
}

export function renderPrintFrame(document, { anchor = '' } = {}) {
  const printUrl = buildArtifactUrl(document.printUrl || document.viewerUrl, anchor);
  const printRouteUrl = buildDocumentPrintRoute(document.slug, anchor);

  return renderEmbeddedFrame({
    title: `Print A4 ${document.gostNumber}`,
    heading: 'Печатный режим A4',
    src: printUrl,
    openUrl: printRouteUrl,
    openLabel: 'Открыть печатный маршрут'
  });
}
