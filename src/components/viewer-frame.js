import { escapeHtml } from '../js/html.js';
import { normalizeDocumentUrl } from '../js/paths.js';

export function renderViewerFrame(document) {
  const viewerUrl = normalizeDocumentUrl(document.viewerUrl);

  return `
    <section class="viewer-embed" aria-label="Встроенный просмотр ${escapeHtml(document.gostNumber)}">
      <div class="viewer-embed-head">
        <strong>Встроенный просмотр</strong>
        <a href="${escapeHtml(viewerUrl)}" target="_blank" rel="noreferrer">Открыть в новой вкладке</a>
      </div>
      <iframe
        title="Viewer ${escapeHtml(document.gostNumber)}"
        src="${escapeHtml(viewerUrl)}"
        loading="lazy"
        referrerpolicy="no-referrer"
      ></iframe>
    </section>
  `;
}
