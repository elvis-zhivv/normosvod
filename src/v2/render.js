import { escapeHtml } from '../js/html.js';
import { normalizeDocumentUrl } from '../js/paths.js';

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
      <small>${escapeHtml(item.type)} · стр. ${escapeHtml(item.pageNumber ?? '—')}</small>
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

function renderBlocks(blocks = [], entryPoints = {}, options = {}) {
  const legacyBaseUrl = entryPoints?.legacyUrl ?? '';
  const printBaseUrl = entryPoints?.printUrl ?? '';
  const relatedNormIndex = options.relatedNormIndex ?? new Map();
  const definitionIndex = options.definitionIndex ?? new Map();
  const renderUnits = (units = []) => units.map((unit) => `
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
  `).join('');

  return blocks.map((block) => `
    <article class="v2-block v2-block-${escapeHtml(block.type)}" id="${escapeHtml(block.id)}">
      <div class="v2-block-head">
        <p class="v2-block-type">${escapeHtml(block.type)}</p>
        <p class="v2-block-page">Print page ${escapeHtml(block.print?.pageNumber ?? '—')}</p>
      </div>
      <h2>${escapeHtml(block.title)}</h2>
      <p>${escapeHtml(block.summary ?? '')}</p>
      ${renderHighlights(block.highlights)}
      ${renderReferenceTokens(block.references, relatedNormIndex)}
      ${block.units?.length
        ? `<div class="v2-unit-list">${renderUnits(block.units)}</div>`
        : ''}
      <div class="v2-block-links">
        ${block.legacy?.targetSelector
          ? `<a class="v2-block-link" href="${escapeHtml(buildAnchorUrl(legacyBaseUrl, block.legacy.targetSelector))}" target="_blank" rel="noreferrer">Источник: ${escapeHtml(block.legacy.targetSelector)}</a>`
          : ''}
        ${block.print?.pageNumber
          ? `<a class="v2-block-link" href="${escapeHtml(buildAnchorUrl(printBaseUrl, block.print?.pageAnchor))}" target="_blank" rel="noreferrer">Печать A4: стр. ${escapeHtml(block.print.pageNumber)}</a>`
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

  return `
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
          <p class="v2-source-note">Source: ${escapeHtml(model.source?.type ?? 'unknown')} · migration ${escapeHtml(model.meta?.migrationStatus ?? '—')}</p>
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
