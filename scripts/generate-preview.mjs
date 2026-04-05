import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cleanText } from './lib/text-utils.mjs';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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

function buildFallbackSvg({ gostNumber = '', title = '', year = '' }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="840" height="1188" viewBox="0 0 840 1188">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f7f1e5"/>
      <stop offset="100%" stop-color="#e5edf5"/>
    </linearGradient>
  </defs>
  <rect width="840" height="1188" fill="url(#bg)"/>
  <rect x="44" y="44" width="752" height="1100" rx="28" fill="#fffdf9" stroke="#d7d3cb"/>
  <text x="88" y="130" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#617087" letter-spacing="4">${escapeXml(gostNumber)}</text>
  <foreignObject x="88" y="200" width="664" height="760">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Georgia, 'Times New Roman', serif; color: #1b2430; display: flex; height: 100%; align-items: center;">
      <div>
        <div style="font-size: 58px; line-height: 1.05; font-weight: 700;">${escapeXml(title)}</div>
        <div style="margin-top: 36px; font-family: Arial, Helvetica, sans-serif; font-size: 26px; font-weight: 700; color: #0c4a6e;">${escapeXml(year)}</div>
      </div>
    </div>
  </foreignObject>
</svg>`;
}

function buildPreviewSvg({ html, meta }) {
  const firstPageMarkup = extractFirstPageMarkup(html);
  const styleText = extractInlineStyles(html);

  if (!firstPageMarkup || !styleText) {
    return buildFallbackSvg(meta);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="840" height="1188" viewBox="0 0 840 1188">
  <foreignObject x="0" y="0" width="840" height="1188">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width: 840px; height: 1188px; overflow: hidden; background: white;">
      <style>
${styleText}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
  overflow: hidden !important;
  background: white !important;
}
body {
  display: grid !important;
  place-items: start center !important;
}
.page {
  margin: 0 !important;
  box-shadow: none !important;
}
      </style>
      ${firstPageMarkup}
    </div>
  </foreignObject>
</svg>`;
}

export async function generatePreviewOrPlaceholder({ outputDirectory, html = '', meta = {} }) {
  await mkdir(outputDirectory, { recursive: true });
  const previewPath = path.join(outputDirectory, 'preview.svg');
  const svg = buildPreviewSvg({
    html,
    meta: {
      gostNumber: meta.gostNumber ?? '',
      title: cleanText(meta.shortTitle || meta.title || meta.gostNumber || ''),
      year: meta.year ?? ''
    }
  });
  await writeFile(previewPath, svg, 'utf8');
  return previewPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Этот скрипт используется как модуль генерации preview SVG.');
}
