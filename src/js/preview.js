function configurePreviewFrame(root) {
  if (root.dataset.previewReady === 'true') {
    return;
  }

  const iframe = root.querySelector('iframe');
  const loadingNode = root.querySelector('.document-cover-preview-loading');

  if (!iframe) {
    return;
  }

  const applyPreviewLayout = () => {
    try {
      const frameWindow = iframe.contentWindow;
      const frameDocument = iframe.contentDocument;

      if (!frameWindow || !frameDocument) {
        throw new Error('Viewer iframe is not available.');
      }

      const firstPage = frameDocument.querySelector('.page');
      const app = frameDocument.querySelector('.app');
      const sidebar = frameDocument.querySelector('.sidebar');
      const workspaceScroll = frameDocument.querySelector('.workspace-scroll');
      const pageFrame = frameDocument.querySelector('#pageFrame, .page-frame');

      if (!firstPage || !workspaceScroll || !pageFrame) {
        throw new Error('Viewer structure is not compatible with preview mode.');
      }

      const styleId = 'catalog-cover-preview-style';
      let styleNode = frameDocument.getElementById(styleId);

      if (!styleNode) {
        styleNode = frameDocument.createElement('style');
        styleNode.id = styleId;
        styleNode.textContent = `
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            overflow: hidden !important;
            background: #f3efe7 !important;
          }

          body {
            color: #1d2430 !important;
          }

          .sidebar,
          .viewer-back-btn,
          .theme-toggle,
          .search-suggestions {
            display: none !important;
          }

          .app {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
          }

          .workspace-scroll {
            width: 100% !important;
            height: 100% !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: transparent !important;
          }

          .page-frame {
            margin: 0 auto !important;
            padding: 22px 0 0 !important;
            width: max-content !important;
            transform-origin: top center !important;
          }

          .page {
            display: none !important;
          }

          .page:first-of-type {
            display: block !important;
            margin: 0 auto !important;
            box-shadow: 0 26px 46px rgba(18, 28, 39, 0.22) !important;
          }
        `;
        frameDocument.head.appendChild(styleNode);
      }

      if (sidebar) {
        sidebar.style.display = 'none';
      }

      if (app) {
        app.style.display = 'block';
      }

      const frameWidth = root.clientWidth - 24;
      const frameHeight = root.clientHeight - 24;
      const pageRect = firstPage.getBoundingClientRect();

      if (pageRect.width === 0 || pageRect.height === 0) {
        frameWindow.requestAnimationFrame(applyPreviewLayout);
        return;
      }

      const scale = Math.min(frameWidth / pageRect.width, frameHeight / pageRect.height, 1);
      pageFrame.style.transform = `scale(${scale})`;

      iframe.style.opacity = '1';
      root.dataset.previewReady = 'true';
      root.dataset.previewState = 'ready';

      if (loadingNode) {
        loadingNode.hidden = true;
      }
    } catch (error) {
      console.warn('Cover preview failed:', error);
      root.dataset.previewState = 'failed';
      if (loadingNode) {
        loadingNode.textContent = 'Не удалось загрузить титульный лист.';
      }
    }
  };

  iframe.addEventListener('load', () => {
    applyPreviewLayout();

    const resizeObserver = new ResizeObserver(() => {
      root.dataset.previewReady = 'false';
      applyPreviewLayout();
    });

    resizeObserver.observe(root);
  }, { once: true });
}

export function initCoverPreviews() {
  const previewRoots = document.querySelectorAll('[data-cover-preview]');
  previewRoots.forEach((root) => configurePreviewFrame(root));
}
