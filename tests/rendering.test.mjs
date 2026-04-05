import test from 'node:test';
import assert from 'node:assert/strict';

import { renderDocCard } from '../src/components/doc-card.js';
import { renderDocumentPage, renderMissingDocument } from '../src/js/document.js';
import { normalizeDocumentUrl } from '../src/js/paths.js';

test('normalizeDocumentUrl blocks unsafe protocols and schemeless URLs', () => {
  assert.equal(normalizeDocumentUrl('javascript:alert(1)'), 'about:blank');
  assert.equal(normalizeDocumentUrl('data:text/html,<script>alert(1)</script>'), 'about:blank');
  assert.equal(normalizeDocumentUrl('//evil.example/test'), 'about:blank');
});

test('renderDocCard escapes document fields in generated markup', () => {
  const html = renderDocCard({
    slug: 'gost-1-0-2015',
    gostNumber: 'ГОСТ <img src=x onerror=alert(1)>',
    title: '<script>alert(1)</script>Заголовок',
    year: '2025',
    pages: '12',
    language: 'ru',
    description: 'Описание & <b>жирный</b>',
    tags: ['<svg onload=alert(1)>', 'Безопасный тег'],
    previewUrl: 'javascript:alert(1)',
    viewerUrl: 'data:text/html,test',
    searchHit: {
      totalMatches: 4,
      matchedPages: [0, 2],
      snippet: '<b>совпадение</b>',
      anchor: '#match-1'
    },
    searchQuery: 'совпадение'
  });

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;Заголовок/);
  assert.match(html, /&lt;b&gt;<mark>совпадение<\/mark>&lt;\/b&gt;/);
  assert.match(html, /&lt;svg onload=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /src="javascript:alert\(1\)"/);
  assert.doesNotMatch(html, /href="data:text\/html,test"/);
  assert.match(html, /src="about:blank"/);
  assert.match(html, /href="about:blank#match-1"/);
  assert.match(html, /Совпадения: 4 · стр. 1, 3/);
});

test('renderDocumentPage escapes route and manifest content', () => {
  const html = renderDocumentPage({
    slug: 'bad slug"><img src=x onerror=alert(1)>',
    gostNumber: 'ГОСТ 1.0—2015',
    title: 'Документ <script>alert(1)</script>',
    description: 'Описание <iframe src=evil></iframe>',
    year: 2015,
    pages: 24,
    status: 'active',
    language: 'ru',
    importedAt: '2026-04-05T08:58:44.090Z',
    updatedAt: '2026-04-05T08:59:59.287Z',
    tags: ['<img src=x onerror=alert(1)>'],
    previewUrl: '/docs/gost-1-0-2015/preview.html',
    viewerUrl: 'javascript:alert(1)',
    navItems: [
      {
        label: '<img src=x onerror=alert(1)>',
        targetPageIndex: 0,
        targetSelector: '#section-1"><script>alert(1)</script>'
      }
    ]
  }, { showEmbeddedViewer: true });

  assert.match(html, /Документ &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Описание &lt;iframe src=evil&gt;&lt;\/iframe&gt;/);
  assert.match(html, /bad%20slug%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert\(1\)%3E\?embed=0/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /#section-1&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /href="javascript:alert\(1\)"/);
  assert.match(html, /href="about:blank"/);
});

test('renderMissingDocument escapes slug from URL', () => {
  const html = renderMissingDocument('<img src=x onerror=alert(1)>');
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
});
