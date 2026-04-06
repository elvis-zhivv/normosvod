import { escapeHtml } from '../js/html.js';
import {
  buildDocumentLegacyRoute,
  buildDocumentPrintRoute,
  normalizeDocumentUrl
} from '../js/paths.js';
import { buildDocumentSignals, formatMigrationStatusLabel, formatReaderModeLabel, formatThemeLabel } from '../js/document-signals.js';

function normalizeComparableText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'()]/g, ' ')
    .replace(/[—–-]/g, ' ')
    .replace(/[.,:;!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFrontMatterTitle(title = '') {
  const normalized = normalizeComparableText(title);

  return normalized === 'обложка'
    || normalized === 'содержание'
    || normalized.includes('предисловие')
    || normalized.includes('информационные сведения')
    || normalized.includes('издательские сведения')
    || normalized.includes('ключевые слова')
    || normalized.includes('введение')
    || normalized.startsWith('страница ');
}

function isAncillaryBlock(block = {}) {
  return block?.type === 'meta' || isFrontMatterTitle(block?.title);
}

function splitReaderBlocks(blocks = []) {
  const frontMatter = [];
  const mainBlocks = [];

  for (const block of blocks) {
    if (isAncillaryBlock(block)) {
      frontMatter.push(block);
      continue;
    }

    mainBlocks.push(block);
  }

  return {
    frontMatter,
    mainBlocks: mainBlocks.length ? mainBlocks : blocks
  };
}

function formatBlockTypeLabel(blockType = '') {
  switch (blockType) {
    case 'references':
      return 'Нормативный блок';
    case 'definition-set':
      return 'Термины';
    case 'requirements':
      return 'Требования';
    case 'procedure':
      return 'Процедура';
    case 'analysis':
      return 'Анализ';
    case 'appendix':
      return 'Приложение';
    case 'bibliography':
      return 'Библиография';
    case 'meta':
      return 'Служебный блок';
    default:
      return '';
  }
}

function formatUnitTypeLabel(unitType = '') {
  switch (unitType) {
    case 'definition':
      return 'Определение';
    case 'note':
      return 'Примечание';
    case 'advice':
      return 'Рекомендуется';
    case 'requirement':
      return 'Требование';
    case 'warning':
      return 'Не допускается';
    case 'list-item':
      return 'Пункт';
    case 'table':
      return 'Таблица';
    case 'table-caption':
      return 'Подпись таблицы';
    case 'section-heading':
      return 'Раздел';
    case 'subsection-heading':
      return 'Подраздел';
    case 'heading':
      return 'Заголовок';
    default:
      return unitType;
  }
}

function isSkippableUnit(unit, block) {
  const text = normalizeComparableText(unit?.text ?? unit?.summary ?? '');
  const blockTitle = normalizeComparableText(block?.title);
  const gostNumber = normalizeComparableText(block?.gostNumber);

  if (!text) {
    return true;
  }

  if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x|\d+)$/.test(text)) {
    return true;
  }

  if (text === blockTitle || (gostNumber && text === gostNumber)) {
    return true;
  }

  return false;
}

function isProseUnit(unit) {
  return unit?.type === 'paragraph';
}

function parseDashListParagraph(text) {
  const value = String(text ?? '').trim();

  if (!value) {
    return null;
  }

  let lead = '';
  let body = value;
  const leadMatch = value.match(/^(.*?:)\s*-\s+/u);

  if (leadMatch) {
    lead = leadMatch[1].trim();
    body = value.slice(leadMatch[0].length);
  } else if (value.startsWith('- ')) {
    body = value.slice(2);
  } else {
    return null;
  }

  const items = body
    .split(/;\s*-\s+/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length < 2) {
    return null;
  }

  return {
    kind: 'dash',
    lead,
    items: items.map((item) => ({ marker: '—', content: item }))
  };
}

function parseMarkedListParagraph(text, markerPattern, kind) {
  const value = String(text ?? '').trim();

  if (!value) {
    return null;
  }

  const leadStart = new RegExp(`^(.*?:)\\s*(${markerPattern})\\s+`, 'u');
  const directStart = new RegExp(`^(${markerPattern})\\s+`, 'u');
  let lead = '';
  let body = value;

  const leadMatch = value.match(leadStart);
  if (leadMatch) {
    lead = leadMatch[1].trim();
    body = value.slice(leadMatch[1].length).trim();
  } else if (!directStart.test(value)) {
    return null;
  }

  const itemSplitPattern = new RegExp(`;\\s*(?=${markerPattern}\\s+)`, 'u');
  const itemPattern = new RegExp(`^(${markerPattern})\\s+(.+)$`, 'u');
  const items = body
    .split(itemSplitPattern)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(itemPattern);

      if (!match) {
        return null;
      }

      return {
        marker: match[1],
        content: match[2].trim()
      };
    })
    .filter(Boolean);

  if (items.length < 2) {
    return null;
  }

  return {
    kind,
    lead,
    items
  };
}

function parseStructuredParagraph(text) {
  return parseDashListParagraph(text)
    || parseMarkedListParagraph(text, '[а-яё]\\)', 'alpha')
    || parseMarkedListParagraph(text, '\\d+\\)', 'numeric');
}

function buildRelatedNormIndex(model) {
  return new Map((model.relatedNorms ?? []).map((item) => [item.label, item.id]));
}

function buildDefinitionIndex(model) {
  return new Map((model.definitions ?? []).map((item) => [item.term, item.id]));
}

function buildAnchorUrl(baseUrl, anchor) {
  const safeBaseUrl = normalizeDocumentUrl(baseUrl);

  if (!safeBaseUrl) {
    return '';
  }

  if (!anchor || !String(anchor).startsWith('#')) {
    return safeBaseUrl;
  }

  return `${safeBaseUrl}${anchor}`;
}

function renderOutline(items = []) {
  return items.map((item) => `
    <a class="v2-outline-link" href="#${escapeHtml(item.id)}" data-v2-outline-link="${escapeHtml(item.id)}">
      <span>${escapeHtml(item.title)}</span>
      <small>стр. ${escapeHtml(item.pageNumber ?? '—')}</small>
    </a>
  `).join('');
}

function renderHighlights(highlights = []) {
  if (!highlights.length) {
    return '';
  }

  return `
    <div class="v2-highlight-list">
      ${highlights.map((item) => `
        <article class="v2-highlight v2-highlight-${escapeHtml(item.type)}">
          <p class="v2-highlight-label">${escapeHtml(item.label)}</p>
          <p>${escapeHtml(item.text)}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderContextTrigger({ kind, id, label, variant = 'reference' }) {
  if (!id) {
    return `<span class="v2-inline-pill v2-inline-pill-${escapeHtml(variant)}">${escapeHtml(label)}</span>`;
  }

  return `
    <button
      type="button"
      class="v2-inline-pill v2-inline-pill-${escapeHtml(variant)}"
      data-v2-context-trigger="true"
      data-v2-context-kind="${escapeHtml(kind)}"
      data-v2-context-id="${escapeHtml(id)}"
    >${escapeHtml(label)}</button>
  `;
}

function renderReferenceTokens(references = [], relatedNormIndex = new Map()) {
  if (!references.length) {
    return '';
  }

  return `
    <div class="v2-inline-pill-list">
      ${references.map((reference) => renderContextTrigger({
        kind: 'related-norm',
        id: relatedNormIndex.get(reference) ?? '',
        label: reference,
        variant: 'reference'
      })).join('')}
    </div>
  `;
}

function renderDefinitions(definitions = [], definitionIndex = new Map()) {
  if (!definitions.length) {
    return '<p class="v2-rail-empty">Автоматические определения пока не извлечены.</p>';
  }

  return `
    <ul class="v2-definition-list">
      ${definitions.map((item) => `
        <li>
          ${renderContextTrigger({
            kind: 'definition',
            id: definitionIndex.get(item.term) ?? item.id,
            label: item.term,
            variant: 'definition'
          })}
          <p>${escapeHtml(item.summary)}</p>
          <a class="v2-context-jump" href="#${escapeHtml(item.blockId)}">К блоку</a>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderRelatedNorms(relatedNorms = []) {
  if (!relatedNorms.length) {
    return '<ul class="v2-reference-list"><li>Автоматические ссылки пока не извлечены.</li></ul>';
  }

  return `
    <ul class="v2-reference-list">
      ${relatedNorms.map((item) => `
        <li>
          ${renderContextTrigger({
            kind: 'related-norm',
            id: item.id,
            label: item.label,
            variant: 'reference'
          })}
          <span>Упоминаний: ${escapeHtml(item.occurrenceCount)}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderContextPanel() {
  return `
    <section class="v2-sidebar-panel v2-context-card" data-v2-context-panel>
      <p class="eyebrow">Контекст</p>
      <div data-v2-context-body>
        <p class="v2-rail-empty">Выберите определение, связанную норму или ссылку в потоке, чтобы увидеть контекст и быстрые переходы.</p>
      </div>
    </section>
  `;
}

function renderSignalChips(document) {
  const signals = buildDocumentSignals(document);

  if (!signals.length) {
    return '';
  }

  return `
    <div class="document-signal-list document-signal-list-v2">
      ${signals.map((signal) => `
        <span class="document-signal document-signal-${escapeHtml(signal.tone)}">
          ${escapeHtml(signal.label)}
        </span>
      `).join('')}
    </div>
  `;
}

function renderBlockBand(blockType) {
  if (blockType === 'appendix') {
    return '<div class="v2-block-band v2-block-band-appendix">Приложение</div>';
  }

  if (blockType === 'procedure') {
    return '<div class="v2-block-band v2-block-band-procedure">Процедура</div>';
  }

  return '';
}

function renderInlineHeading(unit, level = 3) {
  const tagName = level === 4 ? 'h4' : 'h3';

  return `
    <${tagName} class="v2-inline-heading v2-inline-heading-${escapeHtml(unit.type)}" id="${escapeHtml(unit.id)}">
      ${escapeHtml(unit.title ?? unit.summary ?? unit.text ?? '')}
    </${tagName}>
  `;
}

function isDuplicateHeadingUnit(unit, block) {
  const unitTitle = normalizeComparableText(unit?.title ?? unit?.summary ?? unit?.text ?? '');
  const blockTitle = normalizeComparableText(block?.title ?? '');

  return Boolean(unitTitle) && unitTitle === blockTitle;
}

function renderProseGroup(units = [], relatedNormIndex = new Map()) {
  if (!units.length) {
    return '';
  }

  return `
    <section class="v2-prose-group">
      ${units.map((unit) => `
        <p class="v2-prose-paragraph" id="${escapeHtml(unit.id)}">${escapeHtml(unit.text ?? unit.summary ?? '')}</p>
        ${renderReferenceTokens(unit.references, relatedNormIndex)}
      `).join('')}
    </section>
  `;
}

function renderStructuredParagraph(unit, relatedNormIndex = new Map()) {
  const parsed = parseStructuredParagraph(unit?.text ?? unit?.summary ?? '');

  if (!parsed) {
    return '';
  }

  return `
    <section class="v2-structured-block v2-structured-block-${escapeHtml(parsed.kind)}" id="${escapeHtml(unit.id)}">
      ${parsed.lead ? `<p class="v2-prose-paragraph">${escapeHtml(parsed.lead)}</p>` : ''}
      <ul class="v2-structured-list">
        ${parsed.items.map((item) => `
          <li class="v2-structured-item">
            <span class="v2-structured-marker">${escapeHtml(item.marker)}</span>
            <div class="v2-structured-content">${escapeHtml(item.content)}</div>
          </li>
        `).join('')}
      </ul>
      ${renderReferenceTokens(unit.references, relatedNormIndex)}
    </section>
  `;
}

function isCalloutUnit(unit) {
  return ['note', 'advice', 'requirement', 'warning'].includes(unit?.type);
}

function renderCalloutBody(unit) {
  const text = String(unit?.text ?? unit?.summary ?? '').trim();

  if (!text) {
    return '<p></p>';
  }

  if (/^Примечания?\s+1\b/u.test(text)) {
    const normalized = text.replace(/^Примечания?\s+/u, '').trim();
    const parts = normalized.split(/\s(?=\d+\s)/u).map((item) => item.trim()).filter(Boolean);

    if (parts.length > 1) {
      return `
        <ol class="v2-callout-list">
          ${parts.map((item) => {
            const content = item.replace(/^\d+\s+/u, '').trim();
            return `<li>${escapeHtml(content)}</li>`;
          }).join('')}
        </ol>
      `;
    }
  }

  return `<p>${escapeHtml(text)}</p>`;
}

function renderCalloutUnit(unit, relatedNormIndex) {
  return `
    <aside class="v2-callout v2-callout-${escapeHtml(unit.type)}" id="${escapeHtml(unit.id)}">
      <div class="v2-callout-head">${escapeHtml(formatUnitTypeLabel(unit.type))}</div>
      ${renderCalloutBody(unit)}
      ${renderReferenceTokens(unit.references, relatedNormIndex)}
    </aside>
  `;
}

function renderStandardUnit(unit, relatedNormIndex, definitionIndex) {
  return `
    <div class="v2-unit v2-unit-${escapeHtml(unit.type)}" id="${escapeHtml(unit.id)}">
      <div class="v2-unit-head">
        <span class="v2-unit-type">${escapeHtml(formatUnitTypeLabel(unit.type))}</span>
        ${unit.title ? `<strong>${escapeHtml(unit.title)}</strong>` : ''}
        ${unit.type === 'definition' && unit.title
          ? renderContextTrigger({
            kind: 'definition',
            id: definitionIndex.get(unit.title) ?? '',
            label: 'Контекст',
            variant: 'definition'
          })
          : ''}
      </div>
      <p>${escapeHtml(unit.text ?? unit.summary ?? '')}</p>
      ${renderReferenceTokens(unit.references, relatedNormIndex)}
    </div>
  `;
}

function splitClauseTitle(title = '') {
  const value = String(title ?? '').trim();
  const match = value.match(/^((?:\d+\)|\d+(?:\.\d+)*|[а-яё]\)))\s*(.*)$/iu);

  if (!match) {
    return {
      marker: '',
      heading: value
    };
  }

  return {
    marker: match[1],
    heading: match[2].trim()
  };
}

function stripRepeatedClauseTitle(title = '', text = '') {
  const normalizedTitle = normalizeComparableText(title);
  const value = String(text ?? '').trim();

  if (!normalizedTitle || !value) {
    return value;
  }

  const exactPattern = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s.:;,-]*`, 'iu');

  if (exactPattern.test(value)) {
    return value.replace(exactPattern, '').trim();
  }

  const clause = splitClauseTitle(title);

  if (clause.marker) {
    const markerPattern = new RegExp(`^${clause.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s.:;,-]*`, 'iu');

    if (markerPattern.test(value)) {
      return value.replace(markerPattern, '').trim();
    }
  }

  return value;
}

function renderClauseItem(unit, relatedNormIndex) {
  const { marker, heading } = splitClauseTitle(unit.title ?? '');
  const bodyText = stripRepeatedClauseTitle(unit.title ?? '', unit.text ?? unit.summary ?? '');
  const contentText = bodyText.trim();
  const clauseText = [
    heading ? `<span class="v2-clause-inline-title">${escapeHtml(heading)}</span>` : '',
    contentText ? escapeHtml(contentText) : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="v2-clause-row" id="${escapeHtml(unit.id)}">
      ${marker ? `<div class="v2-clause-marker">${escapeHtml(marker)}</div>` : ''}
      <div class="v2-clause-body">
        ${clauseText ? `<p class="v2-clause-text">${clauseText}</p>` : ''}
        ${renderReferenceTokens(unit.references, relatedNormIndex)}
      </div>
    </div>
  `;
}

function renderFigureUnit(unit, relatedNormIndex) {
  const src = normalizeDocumentUrl(unit?.src ?? '');

  return `
    <figure class="v2-figure" id="${escapeHtml(unit.id)}">
      <div class="v2-figure-frame">
        <img
          class="v2-figure-image"
          src="${escapeHtml(src)}"
          alt="${escapeHtml(unit.alt ?? unit.title ?? unit.summary ?? 'Рисунок')}"
          loading="lazy"
        />
      </div>
      <figcaption class="v2-figure-caption">
        ${escapeHtml(unit.title ?? unit.summary ?? 'Рисунок')}
      </figcaption>
      ${renderReferenceTokens(unit.references, relatedNormIndex)}
    </figure>
  `;
}

function renderTableGroup(captionUnit, tableUnit, relatedNormIndex) {
  const columns = Array.isArray(tableUnit.columns) ? tableUnit.columns : [];
  const rows = Array.isArray(tableUnit.rows) ? tableUnit.rows : [];
  const hasStructuredTable = columns.length > 0 && rows.length > 0;

  return `
    <section class="v2-table-group" id="${escapeHtml(tableUnit.id)}">
      ${captionUnit
        ? `<div class="v2-table-caption">${escapeHtml(captionUnit.summary ?? captionUnit.text ?? captionUnit.title ?? 'Таблица')}</div>`
        : ''}
      <div class="v2-table-box">
        <div class="v2-table-head">
          <span class="v2-unit-type">${escapeHtml(formatUnitTypeLabel('table'))}</span>
          <strong>${escapeHtml(tableUnit.title || 'Таблица')}</strong>
        </div>
        ${hasStructuredTable
          ? `
            <div class="v2-table-scroll">
              <table class="v2-data-table">
                <thead>
                  <tr>
                    ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr>
                      ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `
          : `<p class="v2-table-text">${escapeHtml(tableUnit.text ?? tableUnit.summary ?? '')}</p>`}
        ${renderReferenceTokens(tableUnit.references, relatedNormIndex)}
      </div>
    </section>
  `;
}

function renderUnitList(units = [], relatedNormIndex = new Map(), definitionIndex = new Map(), block = {}) {
  const renderedUnits = [];
  const bufferedProseUnits = [];

  function flushBufferedProse() {
    if (!bufferedProseUnits.length) {
      return;
    }

    renderedUnits.push(renderProseGroup(bufferedProseUnits, relatedNormIndex));
    bufferedProseUnits.length = 0;
  }

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const nextUnit = units[index + 1];

    if (isSkippableUnit(unit, block)) {
      continue;
    }

    if (isProseUnit(unit)) {
      const structuredParagraph = parseStructuredParagraph(unit?.text ?? unit?.summary ?? '');

      if (structuredParagraph) {
        flushBufferedProse();
        renderedUnits.push(renderStructuredParagraph(unit, relatedNormIndex));
        continue;
      }

      bufferedProseUnits.push(unit);
      continue;
    }

    flushBufferedProse();

    if (unit?.type === 'table-caption' && nextUnit?.type === 'table') {
      renderedUnits.push(renderTableGroup(unit, nextUnit, relatedNormIndex));
      index += 1;
      continue;
    }

    if (isCalloutUnit(unit)) {
      renderedUnits.push(renderCalloutUnit(unit, relatedNormIndex));
      continue;
    }

    if (unit?.type === 'table') {
      renderedUnits.push(renderTableGroup(null, unit, relatedNormIndex));
      continue;
    }

    if (unit?.type === 'figure') {
      renderedUnits.push(renderFigureUnit(unit, relatedNormIndex));
      continue;
    }

    if (unit?.type === 'list-item') {
      renderedUnits.push(renderClauseItem(unit, relatedNormIndex));
      continue;
    }

    if (unit?.type === 'section-heading') {
      if (!isDuplicateHeadingUnit(unit, block)) {
        renderedUnits.push(renderInlineHeading(unit, 3));
      }
      continue;
    }

    if (unit?.type === 'subsection-heading' || unit?.type === 'heading') {
      if (!isDuplicateHeadingUnit(unit, block)) {
        renderedUnits.push(renderInlineHeading(unit, 4));
      }
      continue;
    }

    renderedUnits.push(renderStandardUnit(unit, relatedNormIndex, definitionIndex));
  }

  flushBufferedProse();
  return renderedUnits.join('');
}

function renderFrontMatterSummary(frontMatter = []) {
  if (!frontMatter.length) {
    return '';
  }

  return `
    <details class="v2-preface-panel">
      <summary>
        <span>Вступительные и служебные страницы</span>
        <small>${escapeHtml(frontMatter.length)} блока</small>
      </summary>
      <p class="v2-preface-copy">Титул, предисловие и издательские страницы вынесены отдельно, чтобы основной маршрут работал как сплошной документ, а не как набор обложек и служебных листов.</p>
      <div class="v2-preface-list">
        ${frontMatter.map((block) => `
          <a class="v2-preface-link" href="#${escapeHtml(block.id)}">
            <strong>${escapeHtml(block.title)}</strong>
            <span>Стр. ${escapeHtml(block.print?.sourcePageNumber ?? block.print?.pageNumber ?? '—')}</span>
          </a>
        `).join('')}
      </div>
    </details>
  `;
}

function renderBlocks(blocks = [], entryPoints = {}, options = {}) {
  const legacyBaseUrl = entryPoints?.legacyUrl ?? '';
  const printBaseUrl = entryPoints?.printUrl ?? '';
  const relatedNormIndex = options.relatedNormIndex ?? new Map();
  const definitionIndex = options.definitionIndex ?? new Map();
  const gostNumber = options.gostNumber ?? '';

  return blocks.map((block, index) => `
    <article
      class="v2-block v2-block-${escapeHtml(block.type)}"
      id="${escapeHtml(block.id)}"
      data-v2-scroll-anchor="${escapeHtml(block.id)}"
      ${index === 0 ? 'data-v2-primary-block="true"' : ''}
    >
      ${renderBlockBand(block.type)}
      <div class="v2-block-head">
        ${formatBlockTypeLabel(block.type)
          ? `<p class="v2-block-type">${escapeHtml(formatBlockTypeLabel(block.type))}</p>`
          : '<span class="v2-block-type-spacer"></span>'}
        <p class="v2-block-page">Стр. ${escapeHtml(block.print?.sourcePageNumber ?? block.print?.pageNumber ?? '—')}</p>
      </div>
      <h2>${escapeHtml(block.title)}</h2>
      ${renderReferenceTokens(block.references, relatedNormIndex)}
      ${block.units?.length
        ? `<div class="v2-unit-list">${renderUnitList(block.units, relatedNormIndex, definitionIndex, {
          type: block.type,
          title: block.title,
          gostNumber
        })}</div>`
        : ''}
      <div class="v2-block-links">
        ${block.legacy?.targetSelector
          ? `<a class="v2-block-link" href="${escapeHtml(buildAnchorUrl(legacyBaseUrl, block.legacy.targetSelector))}" data-link>Источник HTML</a>`
          : ''}
        ${block.print?.pageNumber
          ? `<a class="v2-block-link" href="${escapeHtml(buildAnchorUrl(printBaseUrl, `#${block.id}`))}" data-link>Печать A4</a>`
          : ''}
      </div>
    </article>
  `).join('');
}

function renderSidebarMeta(model, legacyDocument, signalDocument) {
  const metaItems = [
    ['Документ', model.meta?.gostNumber ?? legacyDocument.gostNumber],
    ['Год', model.meta?.year ?? legacyDocument.year ?? '—'],
    ['Страниц', model.meta?.pages ?? legacyDocument.pages ?? '—'],
    ['Режим', formatReaderModeLabel(model.meta?.readerMode)],
    ['Миграция', formatMigrationStatusLabel(model.meta?.migrationStatus)],
    ['Источник', model.source?.type ?? 'legacy-viewer']
  ];

  return `
    <section class="v2-sidebar-panel">
      <p class="eyebrow">Документ</p>
      <h2>${escapeHtml(model.meta?.gostNumber ?? legacyDocument.gostNumber)}</h2>
      <p class="v2-sidebar-title">${escapeHtml(model.meta?.title ?? legacyDocument.title)}</p>
      ${renderSignalChips(signalDocument)}
      <dl class="v2-sidebar-meta-list">
        ${metaItems.map(([label, value]) => `
          <div class="v2-sidebar-meta-row">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>
        `).join('')}
      </dl>
    </section>
  `;
}

function renderSidebarOutline(items = []) {
  return `
    <section class="v2-sidebar-panel">
      <p class="eyebrow">Содержание</p>
      <div class="v2-outline-nav">
        ${renderOutline(items)}
      </div>
    </section>
  `;
}

function renderSidebarSupplemental(model) {
  const definitionIndex = buildDefinitionIndex(model);
  const entities = (model.entities ?? [])
    .slice(0, 8)
    .map((entity) => `<li><strong>${escapeHtml(entity.label)}</strong><span>${escapeHtml(entity.type)}</span></li>`)
    .join('');

  return `
    <section class="v2-sidebar-panel">
      <p class="eyebrow">Определения</p>
      ${renderDefinitions((model.definitions ?? []).slice(0, 8), definitionIndex)}
    </section>
    <section class="v2-sidebar-panel">
      <p class="eyebrow">Связанные нормы</p>
      ${renderRelatedNorms(model.relatedNorms ?? [])}
    </section>
    <section class="v2-sidebar-panel">
      <p class="eyebrow">Сущности и тема</p>
      <p class="v2-sidebar-caption">${escapeHtml(formatThemeLabel(model.meta?.themeId))}</p>
      <ul class="v2-entity-list">${entities}</ul>
    </section>
  `;
}

export function renderV2Reader(model, legacyDocument) {
  const legacyUrl = legacyDocument.legacyViewerUrl ? buildDocumentLegacyRoute(legacyDocument.slug) : '';
  const printUrl = buildDocumentPrintRoute(legacyDocument.slug);
  const { frontMatter, mainBlocks } = splitReaderBlocks(model.blocks ?? []);
  const primaryBlock = mainBlocks[0] ?? null;
  const outlineItems = (model.outline ?? [])
    .filter((item) => !isAncillaryBlock(item));
  const relatedNormIndex = buildRelatedNormIndex(model);
  const definitionIndex = buildDefinitionIndex(model);
  const canonicalUrl = normalizeDocumentUrl(
    legacyDocument.canonicalDocumentUrl
    || legacyDocument.v2DocumentUrl
    || `/data/canonical/${legacyDocument.slug}.json`
  );
  const rawViewerUrl = normalizeDocumentUrl(
    legacyDocument.legacyViewerUrl
    || legacyDocument.viewerUrl
    || model.entryPoints?.legacyUrl
  );
  const signalDocument = {
    themeId: model.meta?.themeId,
    readerMode: model.meta?.readerMode,
    migrationStatus: model.meta?.migrationStatus,
    curationApplied: model.curation?.applied,
    hiddenBlocksCount: model.curation?.hiddenBlocksCount,
    v2BlockCount: model.blocks?.length,
    v2DefinitionsCount: model.definitions?.length,
    v2RelatedNormsCount: model.relatedNorms?.length
  };
  const quickFacts = [
    model.meta?.gostNumber ?? legacyDocument.gostNumber,
    model.meta?.year ? `${model.meta.year}` : '',
    model.meta?.pages ? `${model.meta.pages} стр.` : '',
    formatThemeLabel(model.meta?.themeId)
  ].filter(Boolean);

  return `
    <div class="v2-reader v2-theme-${escapeHtml(model.meta?.themeId ?? 'regulation')}" data-v2-reader-root>
      <aside class="v2-sidebar">
        <div class="v2-sidebar-inner">
          ${renderSidebarMeta(model, legacyDocument, signalDocument)}
          ${renderSidebarOutline(outlineItems.length ? outlineItems : model.outline)}
          ${renderSidebarSupplemental(model)}
          ${renderContextPanel()}
        </div>
      </aside>
      <section class="v2-main">
        <header class="v2-toolbar" data-v2-toolbar>
          <div class="v2-toolbar-doc">
            <span class="v2-toolbar-kicker">Viewer</span>
            <strong>${escapeHtml(model.meta?.gostNumber ?? legacyDocument.gostNumber)}</strong>
          </div>
          <form class="v2-toolbar-search" data-v2-find-form>
            <input type="search" placeholder="Поиск по тексту документа" autocomplete="off" data-v2-find-input />
            <span class="v2-toolbar-search-count" data-v2-find-count>0</span>
            <button class="v2-toolbar-icon" type="button" data-v2-find-prev aria-label="Предыдущее совпадение">↑</button>
            <button class="v2-toolbar-icon" type="button" data-v2-find-next aria-label="Следующее совпадение">↓</button>
            <button class="v2-toolbar-text" type="button" data-v2-find-clear hidden>Очистить</button>
          </form>
          <div class="v2-toolbar-actions">
            <button class="v2-toolbar-text" type="button" data-v2-sidebar-toggle>Колонка</button>
            ${legacyUrl ? `<a class="v2-toolbar-link" href="${escapeHtml(legacyUrl)}" data-link>Legacy</a>` : ''}
            <a class="v2-toolbar-link" href="${escapeHtml(printUrl)}" data-link>Печать</a>
            ${rawViewerUrl ? `<a class="v2-toolbar-link" href="${escapeHtml(rawViewerUrl)}" download>HTML</a>` : ''}
            ${canonicalUrl ? `<a class="v2-toolbar-link" href="${escapeHtml(canonicalUrl)}" download>JSON</a>` : ''}
          </div>
        </header>
        <div class="v2-canvas">
          <header class="v2-document-head">
            <p class="eyebrow">Нормативный документ</p>
            <h1>${escapeHtml(model.meta?.title ?? legacyDocument.title)}</h1>
            <p class="v2-document-summary">${escapeHtml(model.synopsis?.description ?? '')}</p>
            ${renderSignalChips(signalDocument)}
            <div class="v2-document-facts">
              ${quickFacts.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
            </div>
          </header>
          <div class="v2-document-body" data-v2-document-body>
            ${renderFrontMatterSummary(frontMatter)}
            <div class="v2-block-list">
              ${renderBlocks(mainBlocks, {
                legacyUrl,
                printUrl
              }, {
                relatedNormIndex,
                definitionIndex,
                gostNumber: model.meta?.gostNumber ?? legacyDocument.gostNumber
              })}
            </div>
          </div>
        </div>
      </section>
      <div class="v2-tooltip-layer" data-v2-tooltip-layer hidden></div>
    </div>
  `;
}
