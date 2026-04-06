import { escapeHtml } from '../js/html.js';

function formatBlockTypeLabel(type = '') {
  switch (type) {
    case 'references':
      return 'Нормативные ссылки';
    case 'definition-set':
      return 'Термины и определения';
    case 'requirements':
      return 'Требования';
    case 'procedure':
      return 'Порядок';
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

function normalizeTextParts(value = '') {
  return String(value)
    .split(/\n{2,}/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderBodyParagraphs(text = '') {
  const paragraphs = normalizeTextParts(text);

  if (!paragraphs.length) {
    return '';
  }

  return paragraphs.map((paragraph) => `
    <p class="document-fulltext-paragraph">${escapeHtml(paragraph)}</p>
  `).join('');
}

function renderUnits(block = {}) {
  const units = Array.isArray(block.units) ? block.units : [];
  const items = units
    .map((unit) => {
      const text = String(unit?.text ?? unit?.summary ?? '').trim();

      if (!text) {
        return '';
      }

      return `
        <p class="document-fulltext-paragraph document-fulltext-unit document-fulltext-unit-${escapeHtml(unit.type ?? 'paragraph')}">
          ${escapeHtml(text)}
        </p>
      `;
    })
    .filter(Boolean);

  return items.join('');
}

function renderBlock(block = {}) {
  const pageNumber = block?.print?.pageNumber ?? block?.legacy?.pageIndex + 1;
  const typeLabel = formatBlockTypeLabel(block?.type);
  const bodyMarkup = renderUnits(block) || renderBodyParagraphs(block?.bodyText ?? block?.summary ?? '');

  if (!bodyMarkup) {
    return '';
  }

  return `
    <article class="document-fulltext-block" id="${escapeHtml(block.id ?? '')}">
      <header class="document-fulltext-block-head">
        <div>
          <h3>${escapeHtml(block.title ?? 'Блок документа')}</h3>
          ${typeLabel ? `<p class="document-fulltext-block-type">${escapeHtml(typeLabel)}</p>` : ''}
        </div>
        ${pageNumber ? `<span class="document-fulltext-block-page">Стр. ${escapeHtml(pageNumber)}</span>` : ''}
      </header>
      <div class="document-fulltext-block-body">
        ${bodyMarkup}
      </div>
    </article>
  `;
}

export function renderDocumentTextContent(model) {
  const blocks = Array.isArray(model?.blocks) ? model.blocks : [];
  const content = blocks.map((block) => renderBlock(block)).filter(Boolean).join('');

  if (!content) {
    return '';
  }

  return `
    <section class="document-text-content">
      <p class="document-surface-label">Полный текст</p>
      <div class="document-fulltext-list">
        ${content}
      </div>
    </section>
  `;
}
