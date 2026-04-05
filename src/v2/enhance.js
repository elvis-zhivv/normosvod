import { withBase } from '../js/paths.js';
import { escapeHtml } from '../js/html.js';
import { buildFallbackV2Document, normalizeV2Document } from './model.js';
import { renderV2Reader } from './render.js';

async function loadV2Document(document) {
  const fallback = buildFallbackV2Document(document);
  const v2Url = document.v2DocumentUrl || `/data/v2/${document.slug}.json`;

  try {
    const response = await fetch(withBase(v2Url), { cache: 'no-store' });

    if (!response.ok) {
      return fallback;
    }

    const payload = await response.json();
    return normalizeV2Document(payload, document);
  } catch {
    return fallback;
  }
}

function buildContextLookup(model) {
  return {
    definitions: new Map((model.definitions ?? []).map((item) => [item.id, item])),
    relatedNorms: new Map((model.relatedNorms ?? []).map((item) => [item.id, item])),
    blocks: new Map((model.blocks ?? []).map((item) => [item.id, item]))
  };
}

function renderContextBody(context, lookup) {
  if (!context) {
    return '<p class="v2-rail-empty">Контекст для выбранного элемента не найден.</p>';
  }

  if (context.kind === 'definition') {
    const definition = lookup.definitions.get(context.id);
    const block = definition?.blockId ? lookup.blocks.get(definition.blockId) : null;

    if (!definition) {
      return '<p class="v2-rail-empty">Определение недоступно.</p>';
    }

    return `
      <div class="v2-context-body">
        <h3>${escapeHtml(definition.term)}</h3>
        <p>${escapeHtml(definition.summary ?? '')}</p>
        ${block
          ? `<a class="v2-context-jump" href="#${escapeHtml(block.id)}">Перейти к блоку: ${escapeHtml(block.title)}</a>`
          : ''}
      </div>
    `;
  }

  if (context.kind === 'related-norm') {
    const relatedNorm = lookup.relatedNorms.get(context.id);

    if (!relatedNorm) {
      return '<p class="v2-rail-empty">Связанная норма недоступна.</p>';
    }

    const linkedBlocks = (relatedNorm.sourceBlockIds ?? [])
      .map((blockId) => lookup.blocks.get(blockId))
      .filter(Boolean);

    return `
      <div class="v2-context-body">
        <h3>${escapeHtml(relatedNorm.label)}</h3>
        <p class="v2-context-meta">Упоминаний в документе: ${escapeHtml(relatedNorm.occurrenceCount ?? 0)}</p>
        ${linkedBlocks.length
          ? `<ul class="v2-context-links">
              ${linkedBlocks.map((block) => `
                <li>
                  <a class="v2-context-jump" href="#${escapeHtml(block.id)}">${escapeHtml(block.title)}</a>
                  <span>стр. ${escapeHtml(block.print?.pageNumber ?? '—')}</span>
                </li>
              `).join('')}
            </ul>`
          : '<p class="v2-rail-empty">Локальные переходы по этой норме пока не найдены.</p>'}
      </div>
    `;
  }

  return '<p class="v2-rail-empty">Контекст для выбранного элемента не поддерживается.</p>';
}

function renderTooltipMarkup(context, lookup) {
  if (!context) {
    return '';
  }

  if (context.kind === 'definition') {
    const definition = lookup.definitions.get(context.id);

    if (!definition) {
      return '';
    }

    return `
      <div class="v2-tooltip-card">
        <strong>${escapeHtml(definition.term)}</strong>
        <p>${escapeHtml(definition.summary ?? '')}</p>
      </div>
    `;
  }

  if (context.kind === 'related-norm') {
    const relatedNorm = lookup.relatedNorms.get(context.id);

    if (!relatedNorm) {
      return '';
    }

    return `
      <div class="v2-tooltip-card">
        <strong>${escapeHtml(relatedNorm.label)}</strong>
        <p>Упоминаний в документе: ${escapeHtml(relatedNorm.occurrenceCount ?? 0)}</p>
      </div>
    `;
  }

  return '';
}

function bindReaderInteractions(container, model) {
  const panelBody = container.querySelector('[data-v2-context-body]');
  const tooltipLayer = container.querySelector('[data-v2-tooltip-layer]');

  if (!(panelBody instanceof HTMLElement) || !(tooltipLayer instanceof HTMLElement)) {
    return;
  }

  const lookup = buildContextLookup(model);

  function resolveContextFromTrigger(trigger) {
    const kind = trigger.dataset.v2ContextKind;
    const id = trigger.dataset.v2ContextId;

    if (!kind || !id) {
      return null;
    }

    return { kind, id };
  }

  function showTooltip(trigger, context) {
    const markup = renderTooltipMarkup(context, lookup);

    if (!markup) {
      tooltipLayer.hidden = true;
      tooltipLayer.innerHTML = '';
      return;
    }

    tooltipLayer.innerHTML = markup;
    tooltipLayer.hidden = false;
    const rect = trigger.getBoundingClientRect();
    tooltipLayer.style.top = `${window.scrollY + rect.bottom + 8}px`;
    tooltipLayer.style.left = `${window.scrollX + rect.left}px`;
  }

  function hideTooltip() {
    tooltipLayer.hidden = true;
    tooltipLayer.innerHTML = '';
  }

  function setPanelContext(context) {
    panelBody.innerHTML = renderContextBody(context, lookup);
  }

  container.addEventListener('mouseover', (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-v2-context-trigger]')
      : null;

    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    const context = resolveContextFromTrigger(trigger);
    showTooltip(trigger, context);
  });

  container.addEventListener('mouseout', (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-v2-context-trigger]')
      : null;

    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && tooltipLayer.contains(nextTarget)) {
      return;
    }

    hideTooltip();
  });

  container.addEventListener('focusin', (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-v2-context-trigger]')
      : null;

    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    const context = resolveContextFromTrigger(trigger);
    showTooltip(trigger, context);
  });

  container.addEventListener('focusout', () => {
    hideTooltip();
  });

  container.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-v2-context-trigger]')
      : null;

    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    const context = resolveContextFromTrigger(trigger);
    setPanelContext(context);
    showTooltip(trigger, context);
  });
}

export async function enhanceV2Readers(documents = []) {
  const documentMap = new Map((documents ?? []).map((item) => [item.slug, item]));
  const containers = Array.from(document.querySelectorAll('[data-v2-reader]'));

  for (const container of containers) {
    if (!(container instanceof HTMLElement) || container.dataset.initialized === '1') {
      continue;
    }

    const slug = container.dataset.slug;
    const legacyDocument = slug ? documentMap.get(slug) : null;

    if (!legacyDocument) {
      continue;
    }

    container.dataset.initialized = '1';
    const model = await loadV2Document(legacyDocument);
    container.innerHTML = renderV2Reader(model, legacyDocument);
    bindReaderInteractions(container, model);
    const hash = window.location.hash;

    if (hash) {
      const target = container.querySelector(hash);

      if (target instanceof HTMLElement) {
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    }
  }
}
