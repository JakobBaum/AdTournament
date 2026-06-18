import test from 'node:test';
import assert from 'node:assert/strict';
import { Logik } from '../src/Logik.js';

const logic = new Logik();

function namesOfRound(round) {
  return round.flatMap((pairing) => [pairing.player1.name, pairing.player2.name]);
}

test('createRoundRobinSchedule distributes players without duplicates per round', () => {
  const players = ['Doris', 'Frank', 'Bernd', 'Anna', 'Christian', 'Erika'].map((name, index) => ({
    id: String(index + 1),
    type: 'player',
    name,
  }));

  const schedule = logic.createRoundRobinSchedule(players);
  assert.equal(schedule.length, players.length - 1);

  for (const round of schedule) {
    const names = namesOfRound(round);
    assert.equal(new Set(names).size, names.length);
  }

  const uniqueMatches = new Set(
    schedule.flatMap((round) =>
      round.map((pairing) => [pairing.player1.name, pairing.player2.name].sort().join(' vs ')),
    ),
  );

  assert.equal(uniqueMatches.size, (players.length * (players.length - 1)) / 2);
});

test('generateTournament stores a groupRound for each group match', () => {
  const players = ['A', 'B', 'C', 'D'].map((name, index) => ({
    id: String(index + 1),
    type: 'player',
    name,
  }));

  const tournament = logic.generateTournament(players, 4, 2, {});
  const groupMatches = tournament.matches.filter((match) => match.group === 'Gruppe A');

  assert.equal(groupMatches.length, 6);
  assert.deepEqual(
    groupMatches.map((match) => match.groupRound),
    [1, 1, 2, 2, 3, 3],
  );
});


test('createRoundRobinSchedule with return legs doubles pairings and swaps home away', () => {
  const players = ['A', 'B', 'C', 'D'].map((name, index) => ({
    id: String(index + 1),
    type: 'player',
    name,
  }));

  const schedule = logic.createRoundRobinSchedule(players, true);
  assert.equal(schedule.length, 6);

  const matches = schedule.flatMap((round) =>
    round.map((pairing) => `${pairing.player1.name} vs ${pairing.player2.name}`),
  );
  const normalized = matches.map((pairing) => pairing.split(' vs ').sort().join(' vs '));
  assert.equal(normalized.length, 12);
  assert.equal(new Set(normalized).size, 6);
});

test('generateLeagueTournament creates one league group and no knockout matches', () => {
  const players = ['A', 'B', 'C', 'D'].map((name, index) => ({
    id: String(index + 1),
    type: 'player',
    name,
  }));

  const tournament = logic.generateLeagueTournament(players, { leagueReturnLegs: true });
  assert.equal(tournament.groups.length, 1);
  assert.equal(tournament.groups[0].name, 'Liga');
  assert.equal(tournament.matches.every((match) => match.group === 'Liga'), true);
  assert.equal(tournament.matches.length, 12);
});


test('generateKOTournament creates a valid knockout tree with byes', () => {
  const players = ['A', 'B', 'C', 'D', 'E'].map((name, index) => ({
    id: String(index + 1),
    type: 'player',
    name,
  }));

  const tournament = logic.generateKOTournament(players, { playAllPlaces: false });
  assert.equal(tournament.type, 'ko');
  assert.ok(tournament.matches.length >= 4);
  assert.equal(tournament.matches.some((match) => match.bracketType === 'main'), true);
});
