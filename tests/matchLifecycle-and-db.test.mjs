import test from 'node:test';
import assert from 'node:assert/strict';

import { extractFinalPlayerStatsFromAutodartsStats } from '../src/matchStats.js';
import { TournamentDB } from '../src/TournamentDB.js';

test('extractFinalPlayerStatsFromAutodartsStats liest verschachtelte players stats korrekt', () => {
  const result = extractFinalPlayerStatsFromAutodartsStats({
    players: [
      {
        id: 'p1',
        name: 'Alice',
        stats: {
          average: 61.5,
          checkoutsHit: 2,
          checkouts: 5,
          plus100: 3,
          dartsThrown: 18,
          legsWon: 2,
        },
      },
    ],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Alice');
  assert.equal(result[0].playerId, 'p1');
  assert.equal(result[0].stats.average, 61.5);
  assert.equal(result[0].stats.plus100, 3);
  assert.equal(result[0].stats.legsWon, 2);
});

test('extractFinalPlayerStatsFromAutodartsStats liest matchStats im alten TournamentExtension Format', () => {
  const result = extractFinalPlayerStatsFromAutodartsStats({
    players: [
      { id: 'p1', name: 'Ingrid' },
      { id: 'p2', name: 'Hans' },
    ],
    matchStats: [
      {
        playerId: 'p1',
        dartsThrown: 6,
        average: 121,
        checkouts: 2,
        checkoutsHit: 2,
        plus100: 2,
        legsWon: 2,
      },
      {
        playerId: 'p2',
        dartsThrown: 3,
        average: 60,
        checkouts: 0,
        checkoutsHit: 0,
        plus60: 1,
        legsWon: 0,
      },
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((entry) => entry.name), ['Ingrid', 'Hans']);
  assert.equal(result[0].playerId, 'p1');
  assert.equal(result[0].stats.average, 121);
  assert.equal(result[0].stats.dartsThrown, 6);
  assert.equal(result[0].stats.legsWon, 2);
  assert.equal(result[1].stats.plus60, 1);
});

test('buildPlayerStatsFromMatches verarbeitet finalPlayerStats auch per playerId', () => {
  const db = new TournamentDB();
  const players = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ];
  const matches = [
    {
      status: 'finished',
      player1: { type: 'player', id: '1', name: 'Alice' },
      player2: { type: 'player', id: '2', name: 'Bob' },
      winner: { type: 'player', id: '1', name: 'Alice' },
      scorePlayer1: { legs: 2, sets: 0 },
      scorePlayer2: { legs: 1, sets: 0 },
      finalPlayerStats: [
        { playerId: '1', stats: { average: 60, dartsThrown: 18, plus100: 2, checkoutsHit: 1, checkouts: 3 } },
        { playerId: '2', stats: { average: 55, dartsThrown: 21, plus100: 1, checkoutsHit: 0, checkouts: 2 } },
      ],
    },
  ];

  const stats = db.buildPlayerStatsFromMatches(matches, players);
  assert.equal(stats.get('alice').wins, 1);
  assert.equal(stats.get('alice').legsWon, 2);
  assert.equal(stats.get('alice').plus100, 2);
  assert.equal(stats.get('bob').dartsThrown, 21);
});

test('isRetryableFirestoreError erkennt Konfliktfehler', () => {
  const db = new TournamentDB();
  assert.equal(db.isRetryableFirestoreError({ code: 'failed-precondition' }), true);
  assert.equal(db.isRetryableFirestoreError({ code: 'aborted' }), true);
  assert.equal(db.isRetryableFirestoreError({ code: 'permission-denied' }), false);
});
