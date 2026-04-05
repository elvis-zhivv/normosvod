import test from 'node:test';
import assert from 'node:assert/strict';

import { extractNavItems } from '../scripts/lib/extract-nav-items.mjs';
import { cleanText } from '../scripts/lib/text-utils.mjs';

test('cleanText removes entity-encoded tags before returning text', () => {
  assert.equal(cleanText('&lt;img src=x onerror=alert(1)&gt;Безопасный текст'), 'Безопасный текст');
});

test('cleanText removes encoded script blocks completely', () => {
  assert.equal(
    cleanText('&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;Заголовок'),
    'Заголовок'
  );
});

test('extractNavItems parses NAV_ITEMS literals without executing code', () => {
  const html = `
    <script>
      const NAV_ITEMS = [
        { label: 'Раздел 1', targetPageIndex: 0, targetSelector: '#section-1' },
        { label: 'Раздел 2', targetPageIndex: 1 }
      ];
    </script>
  `;

  assert.deepEqual(extractNavItems(html), [
    { label: 'Раздел 1', targetPageIndex: 0, targetSelector: '#section-1' },
    { label: 'Раздел 2', targetPageIndex: 1, targetSelector: null }
  ]);
});
