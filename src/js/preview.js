const previewCache = new Map();

function buildPreviewDocument({ styleText, pageHtml, viewerUrl }) {
  const escapedBaseUrl = viewerUrl.replace(/"/g, '&quot;');

  return `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <base href="${escapedBaseUrl}" />
        <style>${styleText}</style>
        <style>
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(246, 239, 228, 0.92)),
              linear-gradient(135deg, #f5efe4, #e5edf5) !important;
          }

          body {
            display: grid !important;
            place-items: start center !important;
            padding: 12px !important;
            color: #1d2430 !important;
          }

          .preview-stage {
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
            display: grid !important;
            place-items: start center !important;
          }

          .page-frame {
            width: max-content !important;
            margin: 0 auto !important;
            padding: 0 !important;
            transform-origin: top center !important;
          }

          .page {
            margin: 0 auto !important;
            box-shadow: 0 26px 46px rgba(18, 28, 39, 0.22) !important;
          }
        </style>
      </head>
      <body>
        <div class="preview-stage">
          <div class="page-frame">${pageHtml}</div>
        </div>
      </body>
    </html>
  `;
}

async function fetchPreviewSource(viewerUrl) {
  if (!previewCache.has(viewerUrl)) {
    previewCache.set(
      viewerUrl,
      (async () => {
        const response = await fetch(viewerUrl, { cache: 'force-cache' });

        if (!response.ok) {
          throw new Error(`Failed to fetch viewer preview: HTTP ${response.status}`);
        }

        const html = await response.text();
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const firstPage = parsed.querySelector('.page');
        const styleText = Array.from(parsed.querySelectorAll('style'))
          .map((node) => node.textContent || '')
          .join('\n');

        if (!firstPage || !styleText.trim()) {
          throw new Error('Viewer preview source is incomplete.');
        }

        return buildPreviewDocument({
          styleText,
          pageHtml: firstPage.outerHTML,
          viewerUrl
        });
      })()
    );
  }

  return previewCache.get(viewerUrl);
}

function updateLoadingMessage(root, message) {
  const loadingNode = root.querySelector('.document-cover-preview-loading');
  if (!loadingNode) {
    return;
  }

  const card = loadingNode.querySelector('.doc-cover-card');
  if (card) {
    const note = loadingNode.querySelector('.doc-cover-card-note');

    if (message && !note) {
      const noteNode = document.createElement('small');
      noteNode.className = 'doc-cover-card-note';
      noteNode.textContent = message;
      card.appendChild(noteNode);
    } else if (message && note) {
      note.textContent = message;
    }

    return;
  }

  loadingNode.textContent = message;
}

function scalePreviewFrame(root, iframe) {
  const frameDocument = iframe.contentDocument;
  const page = frameDocument?.querySelector('.page');
  const pageFrame = frameDocument?.querySelector('.page-frame');

  if (!page || !pageFrame) {
    throw new Error('Preview frame markup is missing.');
  }

  const availableWidth = root.clientWidth - 24;
  const availableHeight = root.clientHeight - 24;
  const pageRect = page.getBoundingClientRect();

  if (pageRect.width === 0 || pageRect.height === 0) {
    iframe.contentWindow?.requestAnimationFrame(() => scalePreviewFrame(root, iframe));
    return;
  }

  const scale = Math.min(availableWidth / pageRect.width, availableHeight / pageRect.height, 1);
  pageFrame.style.transform = `scale(${scale})`;
  iframe.style.opacity = '1';
  root.dataset.previewReady = 'true';
  root.dataset.previewState = 'ready';

  const loadingNode = root.querySelector('.document-cover-preview-loading');
  if (loadingNode) {
    loadingNode.hidden = true;
  }
}

async function configurePreviewFrame(root) {
  if (root.dataset.previewReady === 'true') {
    return;
  }

  const iframe = root.querySelector('iframe');
  const viewerUrl = root.dataset.viewerUrl;

  if (!iframe || !viewerUrl) {
    return;
  }

  root.dataset.previewState = 'loading';
  updateLoadingMessage(root, 'Загружаем титульный лист…');

  try {
    const srcdoc = await fetchPreviewSource(viewerUrl);

    iframe.addEventListener('load', () => {
      try {
        scalePreviewFrame(root, iframe);

        const resizeObserver = new ResizeObserver(() => {
          root.dataset.previewReady = 'false';
          scalePreviewFrame(root, iframe);
        });

        resizeObserver.observe(root);
      } catch (error) {
        console.warn('Cover preview layout failed:', error);
        root.dataset.previewState = 'failed';
        updateLoadingMessage(root, 'Не удалось показать титульный лист.');
      }
    }, { once: true });

    iframe.srcdoc = srcdoc;
  } catch (error) {
    console.warn('Cover preview failed:', error);
    root.dataset.previewState = 'failed';
    updateLoadingMessage(root, 'Не удалось загрузить титульный лист.');
  }
}

export function initCoverPreviews() {
  const previewRoots = document.querySelectorAll('[data-cover-preview]');
  previewRoots.forEach((root) => {
    void configurePreviewFrame(root);
  });
}
