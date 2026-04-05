import { escapeHtml } from '../js/html.js';
import { normalizeDocumentUrl } from '../js/paths.js';
import { buildDocumentSignals, formatMigrationStatusLabel, formatReaderModeLabel, formatThemeLabel } from '../js/document-signals.js';

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
      <small>${escapeHtml(item.type)} · источник стр. ${escapeHtml(item.pageNumber ?? '—')}</small>
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

function renderStandardUnit(unit, relatedNormIndex, definitionIndex) {
  return `
    <div class="v2-unit v2-unit-${escapeHtml(unit.type)}" id="${escapeHtml(unit.id)}">
      <div class="v2-unit-head">
        <span class="v2-unit-type">${escapeHtml(unit.type)}</span>
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
      <p>${escapeHtml(unit.summary ?? unit.text ?? '')}</p>
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
          <span class="v2-unit-type">${escapeHtml(unit.type)}</span>
          ${unit.title ? `<strong>${escapeHtml(unit.title)}</strong>` : ''}
        </div>
        <p>${escapeHtml(unit.summary ?? unit.text ?? '')}</p>
        ${renderReferenceTokens(unit.references, relatedNormIndex)}
      </div>
    </div>
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
          <span class="v2-unit-type">table</span>
          <strong>${escapeHtml(tableUnit.title || 'Таблица')}</strong>
        </div>
        <p class="v2-table-text">${escapeHtml(tableUnit.summary ?? tableUnit.text ?? '')}</p>
        ${renderReferenceTokens(tableUnit.references, relatedNormIndex)}
      </div>
    </section>
  `;
}

function renderUnitList(units = [], relatedNormIndex = new Map(), definitionIndex = new Map(), blockType = 'section') {
  const renderedUnits = [];

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const nextUnit = units[index + 1];

    if (unit?.type === 'table-caption' && nextUnit?.type === 'table') {
      renderedUnits.push(renderTableGroup(unit, nextUnit, relatedNormIndex));
      index += 1;
      continue;
    }

    if (unit?.type === 'table') {
      renderedUnits.push(renderTableGroup(null, unit, relatedNormIndex));
      continue;
    }

    if (blockType === 'procedure' && unit?.type === 'list-item') {
      renderedUnits.push(renderProcedureItem(unit, relatedNormIndex));
      continue;
    }

    renderedUnits.push(renderStandardUnit(unit, relatedNormIndex, definitionIndex));
  }

  return renderedUnits.join('');
}

function renderBlocks(blocks = [], entryPoints = {}, options = {}) {
  const legacyBaseUrl = entryPoints?.legacyUrl ?? '';
  const printBaseUrl = entryPoints?.printUrl ?? '';
  const relatedNormIndex = options.relatedNormIndex ?? new Map();
  const definitionIndex = options.definitionIndex ?? new Map();

  return blocks.map((block) => `
    <article class="v2-block v2-block-${escapeHtml(block.type)}" id="${escapeHtml(block.id)}">
      ${renderBlockBand(block.type)}
      <div class="v2-block-head">
        <p class="v2-block-type">${escapeHtml(block.type)}</p>
        <p class="v2-block-page">Source page ${escapeHtml(block.print?.sourcePageNumber ?? block.print?.pageNumber ?? '—')}</p>
      </div>
      <h2>${escapeHtml(block.title)}</h2>
      <p>${escapeHtml(block.summary ?? '')}</p>
      ${renderHighlights(block.highlights)}
      ${renderReferenceTokens(block.references, relatedNormIndex)}
      ${block.units?.length
        ? `<div class="v2-unit-list">${renderUnitList(block.units, relatedNormIndex, definitionIndex, block.type)}</div>`
        : ''}
      <div class="v2-block-links">
        ${block.legacy?.targetSelector
          ? `<a class="v2-block-link" href="${escapeHtml(buildAnchorUrl(legacyBaseUrl, block.legacy.targetSelector))}" target="_blank" rel="noreferrer">Источник: ${escapeHtml(block.legacy.targetSelector)}</a>`
          : ''}
        ${block.print?.pageNumber
          ? `<a class="v2-block-link" href="${escapeHtml(buildAnchorUrl(printBaseUrl, `#${block.id}`))}" target="_blank" rel="noreferrer">Печать A4</a>`
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
  const legacyUrl = normalizeDocumentUrl(model.entryPoints?.legacyUrl || legacyDocument.legacyViewerUrl || legacyDocument.viewerUrl);
  const printUrl = normalizeDocumentUrl(model.entryPoints?.printUrl || legacyDocument.printUrl || legacyDocument.viewerUrl);
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
          ${renderOutline(model.outline)}
        </nav>
      </aside>
      <section class="v2-flow">
        <header class="v2-flow-hero">
          <p class="eyebrow">Screen Flow</p>
          <h1>${escapeHtml(model.meta?.title ?? legacyDocument.title)}</h1>
          <p>${escapeHtml(model.synopsis?.description ?? '')}</p>
          ${renderSignalChips(signalDocument)}
          <p class="v2-source-note">Source: ${escapeHtml(model.source?.type ?? 'unknown')} · migration ${escapeHtml(formatMigrationStatusLabel(model.meta?.migrationStatus ?? 'imported'))} · ${model.curation?.applied ? 'curated' : 'auto-generated'}</p>
          <div class="hero-actions">
            <a class="button button-secondary" href="${escapeHtml(legacyUrl)}" target="_blank" rel="noreferrer">Legacy viewer</a>
            <a class="button button-ghost" href="${escapeHtml(printUrl)}" target="_blank" rel="noreferrer">Print A4</a>
          </div>
        </header>
        <div class="v2-block-list">
          ${renderBlocks(model.blocks, model.entryPoints, { relatedNormIndex, definitionIndex })}
        </div>
      </section>
      <aside class="v2-rail">
        ${renderRail(model)}
      </aside>
      <div class="v2-tooltip-layer" data-v2-tooltip-layer hidden></div>
    </div>
  `;
}
