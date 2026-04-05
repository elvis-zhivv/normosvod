import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cleanText } from './lib/text-utils.mjs';

function extractFirstPageMarkup(html) {
  const match = html.match(/<section[^>]*class="[^"]*\bpage\b[^"]*"[\s\S]*?<\/section>/i);
  return match ? match[0] : '';
}

function extractInlineStyles(html) {
  return Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean)
    .join('\n');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFallbackHtml({ gostNumber = '', title = '', year = '' }) {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #ffffff;
      }
      body {
        display: grid;
        place-items: start center;
        font-family: Arial, Helvetica, sans-serif;
      }
      .viewport {
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: grid;
        place-items: start center;
      }
      .scale-wrap {
        position: relative;
        overflow: hidden;
      }
      .scale-target {
        width: max-content;
        transform-origin: top left;
      }
      .page {
        width: 840px;
        height: 1188px;
        box-sizing: border-box;
        padding: 64px 72px;
        background: #fff;
        color: #141a22;
        display: grid;
        align-content: space-between;
      }
      .gost {
        font-size: 30px;
        font-weight: 700;
        letter-spacing: 4px;
        color: #617087;
      }
      .title {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 64px;
        line-height: 1.04;
        font-weight: 700;
      }
      .year {
        justify-self: start;
        padding: 10px 16px;
        border-radius: 999px;
        background: #edf4fa;
        color: #0c4a6e;
        font-size: 28px;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <div class="viewport">
      <div class="scale-wrap">
        <div class="scale-target">
          <article class="page">
            <div class="gost">${escapeHtml(gostNumber)}</div>
            <div class="title">${escapeHtml(title)}</div>
            <div class="year">${escapeHtml(year)}</div>
          </article>
        </div>
      </div>
    </div>
    <script>
      (function () {
        const wrap = document.querySelector('.scale-wrap');
        const target = document.querySelector('.scale-target');
        const page = document.querySelector('.page');
        const viewport = document.querySelector('.viewport');

        function fit() {
          if (!wrap || !target || !page || !viewport) return;
          const pageRect = page.getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          const viewportWidth = viewportRect.width;
          const viewportHeight = viewportRect.height;
          const scale = Math.min(viewportWidth / pageRect.width, viewportHeight / pageRect.height, 1);
          wrap.style.width = (pageRect.width * scale) + 'px';
          wrap.style.height = (pageRect.height * scale) + 'px';
          target.style.transform = 'scale(' + scale + ')';
        }

        window.addEventListener('resize', fit);
        fit();
      })();
    </script>
  </body>
</html>`;
}

function buildPreviewHtml({ html, meta }) {
  const firstPageMarkup = extractFirstPageMarkup(html);
  const styleText = extractInlineStyles(html);

  if (!firstPageMarkup || !styleText) {
    return buildFallbackHtml(meta);
  }

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
${styleText}
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: white;
}
body {
  display: grid;
  place-items: start center;
  background: white;
}
.viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: grid;
  place-items: start center;
}
.scale-wrap {
  position: relative;
  overflow: hidden;
}
.scale-target {
  width: max-content;
  transform-origin: top left;
}
.page {
  margin: 0 !important;
  box-shadow: none !important;
}
    </style>
  </head>
  <body>
    <div class="viewport">
      <div class="scale-wrap">
        <div class="scale-target">
          ${firstPageMarkup}
        </div>
      </div>
    </div>
    <script>
      (function () {
        const wrap = document.querySelector('.scale-wrap');
        const target = document.querySelector('.scale-target');
        const page = document.querySelector('.page');
        const viewport = document.querySelector('.viewport');

        function fit() {
          if (!wrap || !target || !page || !viewport) return;
          const pageRect = page.getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          const viewportWidth = viewportRect.width;
          const viewportHeight = viewportRect.height;
          const scale = Math.min(viewportWidth / pageRect.width, viewportHeight / pageRect.height, 1);
          wrap.style.width = (pageRect.width * scale) + 'px';
          wrap.style.height = (pageRect.height * scale) + 'px';
          target.style.transform = 'scale(' + scale + ')';
        }

        window.addEventListener('resize', fit);
        fit();
      })();
    </script>
  </body>
</html>`;
}

export async function generatePreviewOrPlaceholder({ outputDirectory, html = '', meta = {} }) {
  await mkdir(outputDirectory, { recursive: true });
  const previewPath = path.join(outputDirectory, 'preview.html');
  const previewHtml = buildPreviewHtml({
    html,
    meta: {
      gostNumber: meta.gostNumber ?? '',
      title: cleanText(meta.shortTitle || meta.title || meta.gostNumber || ''),
      year: meta.year ?? ''
    }
  });
  await writeFile(previewPath, previewHtml, 'utf8');
  return previewPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Этот скрипт используется как модуль генерации preview HTML.');
}
