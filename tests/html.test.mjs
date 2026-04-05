import test from 'node:test';
import assert from 'node:assert/strict';

import { highlightSearchTerms } from '../src/js/html.js';

test('highlightSearchTerms wraps matched query tokens in mark tags', () => {
  const html = highlightSearchTerms('Визуальное сравнение цвета', 'визуальное цвет');

  assert.match(html, /<mark>Визуальное<\/mark>/);
  assert.match(html, /<mark>цвет<\/mark>а/);
});

test('highlightSearchTerms escapes HTML before highlighting', () => {
  const html = highlightSearchTerms('<b>опасно</b> совпадение', 'совпадение');

  assert.match(html, /&lt;b&gt;опасно&lt;\/b&gt; <mark>совпадение<\/mark>/);
  assert.doesNotMatch(html, /<b>опасно<\/b>/);
});
