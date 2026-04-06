import { withBase } from '../js/paths.js';
import { escapeHtml } from '../js/html.js';
import { buildFallbackV2Document, normalizeV2Document } from './model.js';
import { renderV2Reader } from './render.js';

async function loadV2Document(document) {
  const fallback = buildFallbackV2Document(document);
  const v2Url = document.canonicalDocumentUrl || document.v2DocumentUrl || `/data/canonical/${document.slug}.json`;

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

function bindOutlineState(container) {
  const outlineLinks = Array.from(container.querySelectorAll('[data-v2-outline-link]'));
  const blocks = Array.from(container.querySelectorAll('[data-v2-scroll-anchor]'));

  if (!outlineLinks.length || !blocks.length || typeof IntersectionObserver === 'undefined') {
    return;
  }

  const linkMap = new Map(outlineLinks.map((link) => [link.dataset.v2OutlineLink, link]));

  function setActiveBlock(id) {
    for (const link of outlineLinks) {
      const active = link.dataset.v2OutlineLink === id;
      link.classList.toggle('is-active', active);
      if (active) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  const observer = new IntersectionObserver((entries) => {
    const visibleEntries = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);

    if (!visibleEntries.length) {
      return;
    }

    const current = visibleEntries[0].target;

    if (!(current instanceof HTMLElement)) {
      return;
    }

    if (linkMap.has(current.id)) {
      setActiveBlock(current.id);
    }
  }, {
    root: null,
    rootMargin: '-120px 0px -65% 0px',
    threshold: [0, 0.1, 0.4]
  });

  for (const block of blocks) {
    observer.observe(block);
  }
}

function bindSidebarToggle(container) {
  const root = container.querySelector('[data-v2-reader-root]');
  const toggle = container.querySelector('[data-v2-sidebar-toggle]');

  if (!(root instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement)) {
    return;
  }

  toggle.addEventListener('click', () => {
    const collapsed = root.classList.toggle('v2-reader-sidebar-collapsed');
    toggle.textContent = collapsed ? 'Показать колонку' : 'Колонка';
  });
}

function clearFindMarks(root) {
  const marks = Array.from(root.querySelectorAll('mark[data-v2-find-mark]'));

  for (const mark of marks) {
    const parent = mark.parentNode;

    if (!parent) {
      continue;
    }

    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  }
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectSearchableTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node.parentElement instanceof HTMLElement)) {
        return NodeFilter.FILTER_REJECT;
      }

      if (!node.nodeValue || !node.nodeValue.trim()) {
        return NodeFilter.FILTER_REJECT;
      }

      if (node.parentElement.closest('mark[data-v2-find-mark]')) {
        return NodeFilter.FILTER_REJECT;
      }

      if (node.parentElement.closest('[data-v2-context-panel], .v2-toolbar, script, style')) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  return nodes;
}

function bindFindInDocument(container) {
  const root = container.querySelector('[data-v2-document-body]');
  const form = container.querySelector('[data-v2-find-form]');
  const input = container.querySelector('[data-v2-find-input]');
  const count = container.querySelector('[data-v2-find-count]');
  const prevButton = container.querySelector('[data-v2-find-prev]');
  const nextButton = container.querySelector('[data-v2-find-next]');
  const clearButton = container.querySelector('[data-v2-find-clear]');

  if (
    !(root instanceof HTMLElement)
    || !(form instanceof HTMLFormElement)
    || !(input instanceof HTMLInputElement)
    || !(count instanceof HTMLElement)
    || !(prevButton instanceof HTMLButtonElement)
    || !(nextButton instanceof HTMLButtonElement)
    || !(clearButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  let marks = [];
  let currentIndex = -1;

  function updateCount() {
    count.textContent = marks.length
      ? `${currentIndex + 1}/${marks.length}`
      : '0';
    clearButton.hidden = !input.value.trim();
  }

  function setCurrentMark(nextIndex, { scroll = true } = {}) {
    if (!marks.length) {
      currentIndex = -1;
      updateCount();
      return;
    }

    currentIndex = ((nextIndex % marks.length) + marks.length) % marks.length;

    for (const [index, mark] of marks.entries()) {
      mark.classList.toggle('is-current', index === currentIndex);
    }

    const currentMark = marks[currentIndex];

    if (scroll && currentMark instanceof HTMLElement) {
      currentMark.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    updateCount();
  }

  function runSearch() {
    clearFindMarks(root);
    marks = [];
    currentIndex = -1;

    const query = input.value.trim();

    if (!query) {
      updateCount();
      return;
    }

    const pattern = new RegExp(escapeRegExp(query), 'giu');
    const textNodes = collectSearchableTextNodes(root);

    for (const textNode of textNodes) {
      const text = textNode.nodeValue ?? '';
      pattern.lastIndex = 0;

      if (!pattern.test(text)) {
        continue;
      }

      pattern.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const matchText = match[0];
        const start = match.index;

        if (start > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
        }

        const mark = document.createElement('mark');
        mark.dataset.v2FindMark = 'true';
        mark.textContent = matchText;
        fragment.appendChild(mark);
        marks.push(mark);
        lastIndex = start + matchText.length;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    }

    setCurrentMark(0, { scroll: false });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch();
  });

  input.addEventListener('input', () => {
    runSearch();
  });

  prevButton.addEventListener('click', () => {
    setCurrentMark(currentIndex - 1);
  });

  nextButton.addEventListener('click', () => {
    setCurrentMark(currentIndex + 1);
  });

  clearButton.addEventListener('click', () => {
    input.value = '';
    clearFindMarks(root);
    marks = [];
    currentIndex = -1;
    updateCount();
  });

  updateCount();
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
    bindOutlineState(container);
    bindSidebarToggle(container);
    bindFindInDocument(container);
    const hash = window.location.hash;

    if (hash) {
      const target = container.querySelector(hash);

      if (target instanceof HTMLElement) {
        target.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    }
  }
}
