import { cleanText } from './text-utils.mjs';
import { paginatePrintSegments } from './print-layout.mjs';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderReferences(references = []) {
  if (!references.length) {
    return '';
  }

  return `
    <ul class="print-reference-list">
      ${references.map((reference) => `<li>${escapeHtml(reference)}</li>`).join('')}
    </ul>
  `;
}

function renderParagraphUnit(unit) {
  return `
    <section class="print-unit print-unit-${escapeHtml(unit.type ?? 'paragraph')}">
      <div class="print-unit-head">
        <span class="print-unit-type">${escapeHtml(unit.type ?? 'paragraph')}</span>
        ${unit.title ? `<strong>${escapeHtml(unit.title)}</strong>` : ''}
      </div>
      <p>${escapeHtml(cleanText(unit.text ?? unit.summary ?? ''))}</p>
      ${renderReferences(unit.references ?? [])}
    </section>
  `;
}

function renderListItemUnit(unit) {
  return `
    <section class="print-unit print-unit-list-item">
      <div class="print-list-marker">Пункт</div>
      <div class="print-list-body">
        ${unit.title ? `<strong>${escapeHtml(unit.title)}</strong>` : ''}
        <p>${escapeHtml(cleanText(unit.text ?? unit.summary ?? ''))}</p>
        ${renderReferences(unit.references ?? [])}
      </div>
    </section>
  `;
}

function renderTableGroup(captionUnit, tableUnit) {
  return `
    <section class="print-table-group">
      ${captionUnit
        ? `<div class="print-table-caption">${escapeHtml(cleanText(captionUnit.text ?? captionUnit.summary ?? captionUnit.title ?? 'Таблица'))}</div>`
        : ''}
      <div class="print-table-box">
        <div class="print-table-head">
          <span class="print-unit-type">table</span>
          <strong>${escapeHtml(tableUnit.title || 'Таблица')}</strong>
        </div>
        <p class="print-table-text">${escapeHtml(cleanText(tableUnit.text ?? tableUnit.summary ?? ''))}</p>
        ${renderReferences(tableUnit.references ?? [])}
      </div>
    </section>
  `;
}

function renderUnits(units = []) {
  if (!units.length) {
    return '';
  }

  const renderedUnits = [];

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const nextUnit = units[index + 1];

    if (unit?.type === 'table-caption' && nextUnit?.type === 'table') {
      renderedUnits.push(renderTableGroup(unit, nextUnit));
      index += 1;
      continue;
    }

    if (unit?.type === 'table') {
      renderedUnits.push(renderTableGroup(null, unit));
      continue;
    }

    if (unit?.type === 'list-item') {
      renderedUnits.push(renderListItemUnit(unit));
      continue;
    }

    renderedUnits.push(renderParagraphUnit(unit));
  }

  return `
    <div class="print-unit-list">
      ${renderedUnits.join('')}
    </div>
  `;
}

function renderBlockSegment(segment) {
  const segmentLead = segment.type === 'appendix'
    ? `<div class="print-block-band print-block-band-appendix">Приложение</div>`
    : segment.type === 'procedure'
      ? `<div class="print-block-band print-block-band-procedure">Процедура</div>`
      : '';

  return `
    <article class="print-block print-block-${escapeHtml(segment.type ?? 'section')}${segment.isContinuation ? ' print-block-continuation' : ''}" id="${escapeHtml(segment.id)}" data-block-id="${escapeHtml(segment.blockId)}" data-source-page-number="${escapeHtml(segment.sourcePageNumber ?? '—')}">
      ${segmentLead}
      <div class="print-block-head">
        <p class="print-block-type">${escapeHtml(segment.type ?? 'section')}</p>
        <p class="print-block-anchor">Источник: ${escapeHtml(segment.pageAnchor ?? '')}</p>
      </div>
      <h2>
        ${escapeHtml(segment.title ?? 'Без названия')}
        ${segment.isContinuation ? '<span class="print-block-continuation-label"> (продолжение)</span>' : ''}
      </h2>
      ${segment.summary ? `<p class="print-block-summary">${escapeHtml(cleanText(segment.summary))}</p>` : ''}
      ${renderReferences(segment.references ?? [])}
      ${renderUnits(segment.units ?? [])}
    </article>
  `;
}

function renderPages(model) {
  const groupedPages = paginatePrintSegments(model.blocks ?? []);

  if (!groupedPages.length) {
    return `
      <section class="print-page">
        <div class="print-page-body">
          <article class="print-block print-block-empty">
            <h2>${escapeHtml(model.meta?.gostNumber ?? '')}</h2>
            <p>Для этого документа canonical print content пока не сформирован.</p>
          </article>
        </div>
        <footer class="print-page-footer">1</footer>
      </section>
    `;
  }

  return groupedPages.map((page) => `
    <section class="print-page" data-page-number="${escapeHtml(page.pageNumber)}">
      <header class="print-page-header">
        <div>
          <p class="print-doc-number">${escapeHtml(model.meta?.gostNumber ?? '')}</p>
          <h1>${escapeHtml(model.meta?.shortTitle || model.meta?.title || '')}</h1>
        </div>
        <span class="print-page-marker">A4 стр. ${escapeHtml(page.pageNumber)}</span>
      </header>
      <div class="print-page-body">
        ${page.segments.map(renderBlockSegment).join('')}
      </div>
      <footer class="print-page-footer">${escapeHtml(page.pageNumber)}</footer>
    </section>
  `).join('');
}

function themeVariables(themeId) {
  switch (themeId) {
    case 'coatings':
      return { accent: '#9b6a18', soft: '#ece1ca' };
    case 'fire-safety':
      return { accent: '#7f3740', soft: '#ead7da' };
    case 'construction':
      return { accent: '#4d6278', soft: '#dce3ea' };
    case 'regulation':
    default:
      return { accent: '#284a67', soft: '#dbe5ef' };
  }
}

export function buildPrintHtml(model) {
  const themeId = model.meta?.themeId ?? 'regulation';
  const theme = themeVariables(themeId);

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(model.meta?.gostNumber ?? model.slug ?? 'Документ')} · Print A4</title>
    <style>
      :root {
        --print-accent: ${theme.accent};
        --print-soft: ${theme.soft};
        --print-line: rgba(24, 32, 42, 0.14);
        --print-text: #18202a;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #e8edf2; color: var(--print-text); }
      body { font-family: "Times New Roman", Georgia, serif; }
      .print-toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 24px;
        background: rgba(255, 255, 255, 0.94);
        border-bottom: 1px solid var(--print-line);
      }
      .print-toolbar strong { color: var(--print-accent); }
      .print-toolbar button {
        min-height: 42px;
        padding: 0 16px;
        border-radius: 999px;
        border: 1px solid var(--print-line);
        background: white;
        cursor: pointer;
        font: inherit;
      }
      .print-document {
        width: min(100%, 980px);
        margin: 0 auto;
        padding: 24px 0 48px;
      }
      .print-page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto 16px;
        padding: 16mm 16mm 18mm;
        background: white;
        box-shadow: 0 16px 40px rgba(14, 34, 53, 0.14);
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 10mm;
        page-break-after: always;
      }
      .print-page-header {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 8mm;
        border-bottom: 2px solid var(--print-soft);
      }
      .print-doc-number {
        margin: 0 0 6px;
        font-size: 11pt;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--print-accent);
      }
      .print-page-header h1 {
        margin: 0;
        font-size: 18pt;
        line-height: 1.2;
      }
      .print-page-marker {
        display: inline-flex;
        align-items: center;
        min-height: 28px;
        padding: 0 10px;
        border-radius: 999px;
        background: var(--print-soft);
        color: var(--print-accent);
        font-size: 10pt;
        white-space: nowrap;
      }
      .print-page-body {
        display: grid;
        align-content: start;
        gap: 8mm;
      }
      .print-block {
        border: 1px solid var(--print-line);
        border-radius: 4mm;
        padding: 6mm;
        break-inside: avoid;
      }
      .print-block-band {
        display: inline-flex;
        align-items: center;
        min-height: 9mm;
        padding: 0 4mm;
        margin-bottom: 4mm;
        border-radius: 999px;
        font-size: 9.5pt;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .print-block-band-appendix {
        color: var(--print-accent);
        background: var(--print-soft);
      }
      .print-block-band-procedure {
        color: #29465f;
        background: #e2ebf2;
      }
      .print-block-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 4mm;
      }
      .print-block-type,
      .print-block-anchor,
      .print-unit-type {
        margin: 0;
        font-size: 9.5pt;
        color: #556273;
      }
      .print-block h2 {
        margin: 0 0 3mm;
        font-size: 14pt;
        line-height: 1.25;
      }
      .print-block-continuation-label {
        color: #556273;
        font-size: 11pt;
        font-weight: 400;
      }
      .print-block-summary,
      .print-unit p {
        margin: 0;
        font-size: 11pt;
        line-height: 1.5;
      }
      .print-reference-list {
        margin: 4mm 0 0;
        padding-left: 5mm;
        display: grid;
        gap: 2mm;
      }
      .print-unit-list {
        display: grid;
        gap: 4mm;
        margin-top: 5mm;
      }
      .print-unit {
        padding-top: 4mm;
        border-top: 1px solid rgba(24, 32, 42, 0.08);
      }
      .print-table-group {
        display: grid;
        gap: 2mm;
      }
      .print-table-caption {
        font-size: 10pt;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--print-accent);
      }
      .print-table-box {
        padding: 4mm;
        border-radius: 3mm;
        border: 1px solid rgba(24, 32, 42, 0.14);
        background: rgba(244, 247, 250, 0.72);
      }
      .print-table-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 2mm;
        flex-wrap: wrap;
      }
      .print-table-text {
        margin: 0;
        font-size: 10.2pt;
        line-height: 1.45;
      }
      .print-unit-list-item {
        display: grid;
        grid-template-columns: 16mm 1fr;
        gap: 4mm;
        align-items: start;
      }
      .print-list-marker {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 8mm;
        border-radius: 999px;
        background: rgba(24, 32, 42, 0.06);
        color: #556273;
        font-size: 9pt;
        font-weight: 700;
      }
      .print-list-body p {
        margin-top: 2mm;
      }
      .print-block-continuation .print-block-head {
        padding-bottom: 2mm;
        border-bottom: 1px dashed rgba(24, 32, 42, 0.12);
      }
      .print-unit-head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 2mm;
      }
      .print-page-footer {
        justify-self: end;
        font-size: 10pt;
        color: #556273;
      }
      @media print {
        html, body { background: white; }
        .print-toolbar { display: none; }
        .print-document { width: auto; margin: 0; padding: 0; }
        .print-page {
          margin: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-toolbar">
      <strong>${escapeHtml(model.meta?.gostNumber ?? '')} · Print A4</strong>
      <button type="button" onclick="window.print()">Печать</button>
    </div>
    <main class="print-document">
      ${renderPages(model)}
    </main>
  </body>
</html>`;
}
