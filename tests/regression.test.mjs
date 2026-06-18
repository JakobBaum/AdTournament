import test from 'node:test';
import assert from 'node:assert/strict';

import { Logik } from '../src/Logik.js';
import {
  buildSmartMatchQueue,
  validateTournamentDataConsistency,
} from '../src/tournament/helpers/matchHelpers.js';

const logic = new Logik();

test('generateTournamentFromGroups preserves group assignment and produces numeric knockout rounds', () => {
  const groups = [
    {
      id: 'g-a',
      name: 'Gruppe A',
      players: ['A1', 'A2', 'A3', 'A4'].map((name, index) => ({ id: `a-${index + 1}`, type: 'player', name, groupId: 'g-a' })),
    },
    {
      id: 'g-b',
      name: 'Gruppe B',
      players: ['B1', 'B2', 'B3', 'B4'].map((name, index) => ({ id: `b-${index + 1}`, type: 'player', name, groupId: 'g-b' })),
    },
  ];

  const tournament = logic.generateTournamentFromGroups(groups, 2, { playAllPlaces: false });

  const groupAMatches = tournament.matches.filter((match) => match.group === 'Gruppe A');
  assert.ok(groupAMatches.length > 0);
  assert.equal(groupAMatches.every((match) => [match.player1, match.player2].every((player) => player.groupId === 'g-a')), true);

  const koRounds = tournament.matches.filter((match) => !match.group).map((match) => Number(match.round));
  assert.equal(koRounds.every((round) => Number.isFinite(round) && round >= 2), true);
});

test('buildSmartMatchQueue avoids duplicate players while alternatives exist', () => {
  const p = (id) => ({ type: 'player', id, name: id });
  const matches = [
    { matchNumber: '1', status: 'pending', player1: p('A'), player2: p('B') },
    { matchNumber: '2', status: 'pending', player1: p('A'), player2: p('C') },
    { matchNumber: '3', status: 'pending', player1: p('D'), player2: p('E') },
    { matchNumber: '4', status: 'pending', player1: p('F'), player2: p('G') },
  ];

  const queue = buildSmartMatchQueue(matches, 3);
  assert.deepEqual(queue.map((match) => match.matchNumber), ['1', '3', '4']);
});

test('validateTournamentDataConsistency detects invalid rounds and duplicate match numbers', () => {
  const players = [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }];
  const report = validateTournamentDataConsistency(
    [
      {
        matchNumber: '1',
        round: NaN,
        status: 'pending',
        player1: { type: 'player', id: '1', name: 'Alice' },
        player2: { type: 'player', id: '2', name: 'Bob' },
      },
      {
        matchNumber: '1',
        round: 2,
        status: 'finished',
        player1: { type: 'player', id: '1', name: 'Alice' },
        player2: { type: 'player', id: '2', name: 'Bob' },
      },
    ],
    players,
  );

  assert.equal(report.valid, false);
  assert.equal(report.errors.some((entry) => entry.includes('ungültige Runde')), true);
  assert.equal(report.errors.some((entry) => entry.includes('doppelte Match-Nummer')), true);
  assert.equal(report.errors.some((entry) => entry.includes('finished ohne winner/loser')), true);
});
