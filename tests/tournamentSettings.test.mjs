import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractMatchSettings,
  normalizeTournamentSettings,
  buildTournamentSettingsPayload,
  pruneRoundSettings,
  getEffectiveMatchSettings,
} from '../src/tournamentSettings.js';

test('extractMatchSettings normalisiert Zahlen und Defaults', () => {
  const result = extractMatchSettings({
    variant: 'Cricket',
    legs: '5',
    sets: '2',
    maxRounds: '20',
  });

  assert.equal(result.tournamentType, 'Cricket');
  assert.equal(result.legs, 5);
  assert.equal(result.sets, 2);
  assert.equal(result.maxRounds, 20);
  assert.ok(result.bullOffMode);
});

test('normalizeTournamentSettings trennt global, format und Runden', () => {
  const result = normalizeTournamentSettings({
    defaultMatchSettings: { baseScore: 301 },
    tournamentFormat: { groupSize: 6, qualifiers: 3, playAllPlaces: true },
    roundSettings: {
      2: { baseScore: 701, legs: 5 },
    },
  });

  assert.equal(result.global.baseScore, 301);
  assert.equal(result.format.groupSize, 6);
  assert.equal(result.format.qualifiers, 3);
  assert.equal(result.format.playAllPlaces, true);
  assert.equal(result.roundSettings['2'].baseScore, 701);
  assert.equal(result.roundSettings['2'].legs, 5);
});

test('buildTournamentSettingsPayload und pruneRoundSettings arbeiten zusammen', () => {
  const global = { tournamentType: 'X01', baseScore: 501, legs: 3 };
  const rounds = {
    1: { tournamentType: 'X01', baseScore: 501, legs: 3 },
    2: { tournamentType: 'X01', baseScore: 701, legs: 5 },
  };

  const pruned = pruneRoundSettings(rounds, global);
  const payload = buildTournamentSettingsPayload(global, { qualifiers: 2 }, pruned);

  assert.deepEqual(Object.keys(pruned), ['2']);
  assert.equal(payload.variant, 'X01');
  assert.equal(payload.defaultMatchSettings.baseScore, 501);
  assert.equal(payload.roundSettings['2'].baseScore, 701);
});

test('getEffectiveMatchSettings bevorzugt Runden-Override', () => {
  const settings = getEffectiveMatchSettings(
    { round: 3 },
    { baseScore: 501, legs: 3 },
    { '3': { baseScore: 301, legs: 7 } },
  );

  assert.equal(settings.baseScore, 301);
  assert.equal(settings.legs, 7);
});
