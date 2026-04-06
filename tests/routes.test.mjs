import test from 'node:test';
import assert from 'node:assert/strict';

import { canUseDefaultV2Reader, shouldOpenV2Reader } from '../src/js/document-route-state.js';

test('canUseDefaultV2Reader keeps unmigrated legacy documents on legacy route', () => {
  assert.equal(canUseDefaultV2Reader({
    canonicalDocumentUrl: '/data/canonical/gost-1-0-2015.json',
    readerMode: 'legacy',
    migrationStatus: 'imported'
  }), false);
});

test('shouldOpenV2Reader allows explicit V2 preview without changing default cutover policy', () => {
  const document = {
    canonicalDocumentUrl: '/data/canonical/gost-1-0-2015.json',
    readerMode: 'legacy',
    migrationStatus: 'imported'
  };

  assert.equal(shouldOpenV2Reader(document, ''), false);
  assert.equal(shouldOpenV2Reader(document, 'card'), false);
  assert.equal(shouldOpenV2Reader(document, 'v2'), true);
});

test('shouldOpenV2Reader uses V2 by default for hybrid and v2-ready reader modes', () => {
  assert.equal(shouldOpenV2Reader({
    canonicalDocumentUrl: '/data/canonical/gost-29319-2025.json',
    readerMode: 'hybrid',
    migrationStatus: 'entity-linked'
  }), true);

  assert.equal(shouldOpenV2Reader({
    canonicalDocumentUrl: '/data/canonical/gost-29319-2025.json',
    readerMode: 'v2',
    migrationStatus: 'v2-ready'
  }), true);
});
