export function renderViewerFrame(document) {
  return `
    <section class="viewer-embed" aria-label="Встроенный просмотр ${document.gostNumber}">
      <div class="viewer-embed-head">
        <strong>Встроенный просмотр</strong>
        <a href="${document.viewerUrl}" target="_blank" rel="noreferrer">Открыть в новой вкладке</a>
      </div>
      <iframe
        title="Viewer ${document.gostNumber}"
        src="${document.viewerUrl}"
        loading="lazy"
        referrerpolicy="no-referrer"
      ></iframe>
    </section>
  `;
}
