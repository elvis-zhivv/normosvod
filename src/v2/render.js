import { escapeHtml } from '../js/html.js';
import {
  buildDocumentLegacyRoute,
  buildDocumentPrintRoute,
  buildDocumentRoute,
  normalizeDocumentUrl
} from '../js/paths.js';
import { buildDocumentSignals, formatMigrationStatusLabel, formatReaderModeLabel, formatThemeLabel } from '../js/document-signals.js';

function normalizeComparableText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'()]/g, ' ')
    .replace(/[—–-]/g, ' ')
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

function shouldRenderProcedureAsSteps(block = {}) {
  const normalizedTitle = normalizeComparableText(block?.title);

  return block?.type === 'procedure'
    && (normalizedTitle.includes('проведение испытаний')
      || normalizedTitle.startsWith('7 '));
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
    <a class="v2-outline-link" href="#${escapeHtml(item.id)}">
      <span>${escapeHtml(item.title)}</span>
      <small>Источник: стр. ${escapeHtml(item.pageNumber ?? '—')}</small>
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
    <section class="v2-rail-card v2-context-card" data-v2-context-panel>
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

function isCalloutUnit(unit) {
  return ['note', 'advice', 'requirement', 'warning'].includes(unit?.type);
}

function renderCalloutUnit(unit, relatedNormIndex) {
  return `
    <aside class="v2-callout v2-callout-${escapeHtml(unit.type)}" id="${escapeHtml(unit.id)}">
      <div class="v2-callout-head">${escapeHtml(formatUnitTypeLabel(unit.type))}</div>
      <p>${escapeHtml(unit.summary ?? unit.text ?? '')}</p>
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

function renderListItem(unit, relatedNormIndex) {
  return `
    <div class="v2-list-row" id="${escapeHtml(unit.id)}">
      ${unit.title ? `<div class="v2-list-label">${escapeHtml(unit.title)}</div>` : ''}
      <p class="v2-list-text">${escapeHtml(unit.text ?? unit.summary ?? '')}</p>
      ${renderReferenceTokens(unit.references, relatedNormIndex)}
    </div>
  `;
}

function renderProcedureItem(unit, relatedNormIndex) {
  return `
    <div class="v2-unit v2-unit-procedure-item" id="${escapeHtml(unit.id)}">
      <div class="v2-procedure-marker">Шаг</div>
      <div class="v2-procedure-body">
        <div class="v2-unit-head">
          <span class="v2-unit-type">${escapeHtml(formatUnitTypeLabel(unit.type))}</span>
          ${unit.title ? `<strong>${escapeHtml(unit.title)}</strong>` : ''}
        </div>
        <p>${escapeHtml(unit.text ?? unit.summary ?? '')}</p>
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
        <p class="v2-table-text">${escapeHtml(tableUnit.text ?? tableUnit.summary ?? '')}</p>
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

    if (shouldRenderProcedureAsSteps(block) && unit?.type === 'list-item') {
      renderedUnits.push(renderProcedureItem(unit, relatedNormIndex));
      continue;
    }

    if (unit?.type === 'list-item') {
      renderedUnits.push(renderListItem(unit, relatedNormIndex));
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
      <p class="v2-preface-copy">Титул, предисловие, введение и издательские страницы вынесены из основного потока, чтобы документ читался как нормативный текст, а не как OCR-лента.</p>
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

function renderRail(model) {
  const entities = (model.entities ?? [])
    .map((entity) => `<li><strong>${escapeHtml(entity.label)}</strong><span>${escapeHtml(entity.type)}</span></li>`)
    .join('');
  const takeaways = (model.synopsis?.keyTakeaways ?? [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const references = (model.referenceBadges ?? [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const highlightItems = (model.highlights ?? []).slice(0, 6);
  const definitionIndex = buildDefinitionIndex(model);
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

  return `
    <section class="v2-rail-card">
      <p class="eyebrow">Верификация</p>
      ${renderSignalChips(signalDocument)}
      <ul class="v2-rail-list">
        <li>${escapeHtml(formatThemeLabel(model.meta?.themeId))}</li>
        <li>${escapeHtml(formatReaderModeLabel(model.meta?.readerMode))}</li>
        <li>${escapeHtml(formatMigrationStatusLabel(model.meta?.migrationStatus))}</li>
        <li>${model.curation?.applied ? 'Кураторский слой активен' : 'Без ручной верификации'}</li>
        <li>${model.curation?.applied ? 'Документ прошёл curator review.' : 'Требуется manual QA по canonical blocks.'}</li>
      </ul>
    </section>
    <section class="v2-rail-card">
      <p class="eyebrow">Сводка</p>
      <p>${escapeHtml(model.synopsis?.description ?? '')}</p>
      <ul class="v2-rail-list">${takeaways}</ul>
    </section>
    <section class="v2-rail-card">
      <p class="eyebrow">Практические акценты</p>
      ${renderHighlights(highlightItems) || '<p class="v2-rail-empty">Автоматические акценты пока не выделены.</p>'}
    </section>
    <section class="v2-rail-card">
      <p class="eyebrow">Определения</p>
      ${renderDefinitions((model.definitions ?? []).slice(0, 8), definitionIndex)}
    </section>
    <section class="v2-rail-card">
      <p class="eyebrow">Сущности</p>
      <ul class="v2-entity-list">${entities}</ul>
    </section>
    <section class="v2-rail-card">
      <p class="eyebrow">Связанные нормы</p>
      ${renderRelatedNorms(model.relatedNorms?.length ? model.relatedNorms : (references ? model.referenceBadges.map((item) => ({ label: item, occurrenceCount: 1 })) : []))}
    </section>
    ${renderContextPanel()}
  `;
}

export function renderV2Reader(model, legacyDocument) {
  const legacyUrl = legacyDocument.legacyViewerUrl ? buildDocumentLegacyRoute(legacyDocument.slug) : '';
  const printUrl = buildDocumentPrintRoute(legacyDocument.slug);
  const screenUrl = buildDocumentRoute(legacyDocument.slug);
  const { frontMatter, mainBlocks } = splitReaderBlocks(model.blocks ?? []);
  const primaryBlock = mainBlocks[0] ?? null;
  const primaryAnchor = primaryBlock?.id ? `#${primaryBlock.id}` : '';
  const outlineItems = (model.outline ?? [])
    .filter((item) => !isAncillaryBlock(item));
  const relatedNormIndex = buildRelatedNormIndex(model);
  const definitionIndex = buildDefinitionIndex(model);
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

  return `
    <div class="v2-reader v2-theme-${escapeHtml(model.meta?.themeId ?? 'regulation')}">
      <aside class="v2-outline">
        <div class="v2-pane-head">
          <p class="eyebrow">Структура</p>
          <h2>${escapeHtml(model.meta?.gostNumber ?? legacyDocument.gostNumber)}</h2>
        </div>
        <nav class="v2-outline-nav">
          ${renderOutline(outlineItems.length ? outlineItems : model.outline)}
        </nav>
      </aside>
      <section class="v2-flow">
        <header class="v2-flow-hero">
          <p class="eyebrow">Режим чтения</p>
          <h1>${escapeHtml(model.meta?.title ?? legacyDocument.title)}</h1>
          <p>${escapeHtml(model.synopsis?.description ?? '')}</p>
          ${renderSignalChips(signalDocument)}
          <p class="v2-source-note">Источник: ${escapeHtml(model.source?.type ?? 'unknown')} · миграция ${escapeHtml(formatMigrationStatusLabel(model.meta?.migrationStatus ?? 'imported'))} · ${model.curation?.applied ? 'кураторски подтверждено' : 'автоматическая сборка'}</p>
          <div class="hero-actions">
            ${primaryAnchor ? `<a class="button button-primary" href="${escapeHtml(primaryAnchor)}">Начать чтение</a>` : ''}
            <a class="button button-secondary" href="${escapeHtml(screenUrl)}" data-link>Поток чтения</a>
            ${legacyUrl ? `<a class="button button-secondary" href="${escapeHtml(legacyUrl)}" data-link>Legacy-режим</a>` : ''}
            <a class="button button-ghost" href="${escapeHtml(printUrl)}" data-link>Print A4</a>
          </div>
        </header>
        <div class="v2-reading-start">
          ${frontMatter.length && primaryBlock
            ? `
              <section class="v2-reading-note">
                <div class="v2-reading-note-copy">
                  <p class="eyebrow">Основной текст</p>
                  <h2>Чтение начинается с раздела «${escapeHtml(primaryBlock.title)}»</h2>
                  <p>Служебные страницы вынесены отдельно. Основной поток показывает только рабочие разделы, определения, требования, процедуры и приложения.</p>
                </div>
                ${primaryAnchor ? `<a class="button button-secondary" href="${escapeHtml(primaryAnchor)}">Перейти к первому разделу</a>` : ''}
              </section>
            `
            : ''}
          ${renderFrontMatterSummary(frontMatter)}
        </div>
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
      </section>
      <aside class="v2-rail">
        ${renderRail(model)}
      </aside>
      <div class="v2-tooltip-layer" data-v2-tooltip-layer hidden></div>
    </div>
  `;
}
