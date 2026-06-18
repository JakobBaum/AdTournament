import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areCollectionsEquivalent,
  replaceCollectionIfChanged,
} from '../src/utils/stateEquality.js';

test('areCollectionsEquivalent erkennt gleiche Snapshots', () => {
  const prev = [
    { id: '1', status: 'pending', updatedAt: 'a' },
    { id: '2', status: 'started', updatedAt: 'b' },
  ];
  const next = [
    { id: '1', status: 'pending', updatedAt: 'a' },
    { id: '2', status: 'started', updatedAt: 'b' },
  ];

  assert.equal(areCollectionsEquivalent(prev, next, ['id', 'status', 'updatedAt']), true);
});

test('replaceCollectionIfChanged gibt alte Referenz bei unverändertem Inhalt zurück', () => {
  const prev = [{ id: '1', status: 'free', currentMatchId: null }];
  const next = [{ id: '1', status: 'free', currentMatchId: null }];

  const result = replaceCollectionIfChanged(prev, next, ['id', 'status', 'currentMatchId']);
  assert.equal(result, prev);
});

test('replaceCollectionIfChanged übernimmt neue Referenz bei Änderung', () => {
  const prev = [{ id: '1', status: 'free', currentMatchId: null }];
  const next = [{ id: '1', status: 'busy', currentMatchId: 'm-1' }];

  const result = replaceCollectionIfChanged(prev, next, ['id', 'status', 'currentMatchId']);
  assert.equal(result, next);
});
