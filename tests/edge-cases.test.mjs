// Edge-case test suite for AdTournament bracket generation
// Tests KO, League, and GROUP_KO with unusual player/group/qualifier counts
// to ensure every configuration either produces a valid tournament (exactly 1 final)
// or throws a clear error — never silently ends up in an unresolvable state.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Logik } from '../src/Logik.js';

const logic = new Logik();

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    type: 'player',
    name: `Player ${i + 1}`,
  }));
}

function mainMatches(matches) {
  return matches.filter((m) => m.bracketType === 'main');
}

function groupMatches(matches) {
  return matches.filter((m) => m.group != null);
}

/** Returns the single final match in the main bracket (highest round, only 1 match). */
function getFinal(matches) {
  const main = mainMatches(matches);
  if (main.length === 0) return null;
  const maxRound = Math.max(...main.map((m) => m.round));
  const finalsInRound = main.filter((m) => m.round === maxRound);
  return finalsInRound.length === 1 ? finalsInRound[0] : null;
}

function nextPowerOfTwo(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function byeMatchCount(matches, bracketType = 'main') {
  return matches.filter(
    (m) =>
      m.bracketType === bracketType &&
      (m.player1?.type === 'bye' || m.player2?.type === 'bye'),
  ).length;
}

// ─── KO Tournament ──────────────────────────────────────────────────────────

describe('KO: guard conditions', () => {
  test('0 players throws', () => {
    assert.throws(() => logic.generateKOTournament([]));
  });

  test('1 player throws', () => {
    assert.throws(() => logic.generateKOTournament(makePlayers(1)));
  });

  test('null input throws', () => {
    assert.throws(() => logic.generateKOTournament(null));
  });
});

describe('KO: exact match counts for each player count', () => {
  // For N players: bracket size = nextPowerOf2(N), total matches = bracket size - 1
  const cases = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 24, 32];

  for (const n of cases) {
    test(`${n} players → ${nextPowerOfTwo(n) - 1} total main matches, ${nextPowerOfTwo(n) - n} byes`, () => {
      const { matches } = logic.generateKOTournament(makePlayers(n), { playAllPlaces: false });
      const expectedTotal = nextPowerOfTwo(n) - 1;
      const expectedByes = nextPowerOfTwo(n) - n;
      assert.equal(mainMatches(matches).length, expectedTotal, `total main matches for n=${n}`);
      assert.equal(byeMatchCount(matches), expectedByes, `bye matches for n=${n}`);
    });
  }
});

describe('KO: always exactly 1 final', () => {
  const cases = [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 16, 17, 25, 32];

  for (const n of cases) {
    test(`${n} players → exactly 1 final`, () => {
      const { matches } = logic.generateKOTournament(makePlayers(n), { playAllPlaces: false });
      const final = getFinal(matches);
      assert.ok(final !== null, `No final found for ${n} players`);
    });
  }
});

describe('KO: bye matches are auto-finished', () => {
  const cases = [3, 5, 6, 7, 9, 10, 11];

  for (const n of cases) {
    test(`${n} players → all bye matches status=finished`, () => {
      const { matches } = logic.generateKOTournament(makePlayers(n), { playAllPlaces: false });
      const byeMatches = matches.filter(
        (m) => m.player1?.type === 'bye' || m.player2?.type === 'bye',
      );
      for (const m of byeMatches) {
        assert.equal(m.status, 'finished', `Bye match ${m.matchNumber} not auto-finished`);
        assert.ok(m.winner != null, `Bye match ${m.matchNumber} has no winner`);
      }
    });
  }
});

describe('KO: no adjacent bye-vs-bye in first round', () => {
  const cases = [3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];

  for (const n of cases) {
    test(`${n} players → no adjacent double-bye first-round pairs`, () => {
      const { matches } = logic.generateKOTournament(makePlayers(n), { playAllPlaces: false });
      const minRound = Math.min(...mainMatches(matches).map((m) => m.round));
      const firstRound = mainMatches(matches).filter((m) => m.round === minRound);

      // Pairs that are adjacent in bracket (same parent) should not both be bye-vs-bye
      for (let i = 0; i < firstRound.length - 1; i += 2) {
        const a = firstRound[i];
        const b = firstRound[i + 1];
        const aDoubleBye = a.player1?.type === 'bye' && a.player2?.type === 'bye';
        const bDoubleBye = b.player1?.type === 'bye' && b.player2?.type === 'bye';
        assert.ok(
          !(aDoubleBye && bDoubleBye),
          `Adjacent double-bye pair at index ${i} for n=${n}`,
        );
      }
    });
  }
});

describe('KO: each real player appears exactly once in first round', () => {
  const cases = [2, 3, 4, 5, 6, 7, 8, 9, 10, 16];

  for (const n of cases) {
    test(`${n} players → every player appears exactly once`, () => {
      const { matches } = logic.generateKOTournament(makePlayers(n), { playAllPlaces: false });
      const minRound = Math.min(...mainMatches(matches).map((m) => m.round));
      const firstRound = mainMatches(matches).filter((m) => m.round === minRound);
      const seen = new Set();
      for (const m of firstRound) {
        for (const slot of [m.player1, m.player2]) {
          if (slot?.type === 'player') {
            assert.ok(!seen.has(slot.id), `Player ${slot.id} appears twice in first round (n=${n})`);
            seen.add(slot.id);
          }
        }
      }
      assert.equal(seen.size, n, `Expected ${n} real players in first round, found ${seen.size}`);
    });
  }
});

describe('KO: match numbers are unique', () => {
  test('16 players → all match numbers unique', () => {
    const { matches } = logic.generateKOTournament(makePlayers(16));
    const nums = matches.map((m) => m.matchNumber);
    assert.equal(new Set(nums).size, nums.length);
  });
});

describe('KO: playAllPlaces produces placement bracket', () => {
  test('8 players with playAllPlaces → has placement bracketType matches', () => {
    const { matches } = logic.generateKOTournament(makePlayers(8), { playAllPlaces: true });
    const placementMatches = matches.filter((m) => m.bracketType === 'placement');
    assert.ok(placementMatches.length > 0, 'No placement matches with playAllPlaces=true');
  });

  test('5 players with playAllPlaces → still has exactly 1 main final', () => {
    const { matches } = logic.generateKOTournament(makePlayers(5), { playAllPlaces: true });
    const final = getFinal(matches);
    assert.ok(final !== null, 'No main final with playAllPlaces=true and 5 players');
  });
});

// ─── League Tournament ───────────────────────────────────────────────────────

describe('League: guard conditions', () => {
  test('0 players throws', () => {
    assert.throws(() => logic.generateLeagueTournament([]));
  });

  test('1 player throws', () => {
    assert.throws(() => logic.generateLeagueTournament(makePlayers(1)));
  });
});

describe('League: correct match count for each player count', () => {
  // Round-robin: N*(N-1)/2 matches
  const cases = [2, 3, 4, 5, 6, 7, 8, 10];

  for (const n of cases) {
    const expected = (n * (n - 1)) / 2;
    test(`${n} players → ${expected} matches`, () => {
      const { matches } = logic.generateLeagueTournament(makePlayers(n), { shufflePlayers: false });
      assert.equal(matches.length, expected);
    });
  }
});

describe('League: each pair plays exactly once (odd player counts)', () => {
  for (const n of [3, 5, 7, 9]) {
    test(`${n} players → unique pairings only`, () => {
      const { matches } = logic.generateLeagueTournament(makePlayers(n), { shufflePlayers: false });
      const pairings = new Set();
      for (const m of matches) {
        const p1 = m.player1?.id;
        const p2 = m.player2?.id;
        if (!p1 || !p2) continue;
        const key = [p1, p2].sort().join('|');
        assert.ok(!pairings.has(key), `Duplicate pairing ${key} in ${n}-player league`);
        pairings.add(key);
      }
      assert.equal(pairings.size, (n * (n - 1)) / 2);
    });
  }
});

describe('League: return legs double the match count and swap home/away', () => {
  test('4 players with return legs → 12 matches, each pairing twice with swapped order', () => {
    const { matches } = logic.generateLeagueTournament(makePlayers(4), {
      leagueReturnLegs: true,
      shufflePlayers: false,
    });
    assert.equal(matches.length, 12);

    // Each pair appears twice, once in each direction
    const pairingCounts = {};
    for (const m of matches) {
      const key = `${m.player1?.id}|${m.player2?.id}`;
      pairingCounts[key] = (pairingCounts[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(pairingCounts)) {
      assert.equal(count, 1, `Pairing ${key} appears ${count} times, expected 1`);
    }

    // The reversed pairing must also appear
    for (const m of matches) {
      const reversed = `${m.player2?.id}|${m.player1?.id}`;
      assert.ok(pairingCounts[reversed] === 1, `Reversed pairing missing for ${reversed}`);
    }
  });
});

describe('League: every match is in the Liga group', () => {
  test('5 players → all matches belong to "Liga"', () => {
    const { matches } = logic.generateLeagueTournament(makePlayers(5));
    assert.ok(matches.every((m) => m.group === 'Liga'), 'Some matches not in Liga group');
  });
});

// ─── GROUP_KO Tournament ─────────────────────────────────────────────────────

describe('GROUP_KO: guard conditions', () => {
  test('0 players throws', () => {
    assert.throws(() => logic.generateTournament([], 4, 2));
  });

  test('1 player throws', () => {
    assert.throws(() => logic.generateTournament(makePlayers(1), 4, 2));
  });
});

describe('GROUP_KO: power-of-2 qualifier counts → clean KO bracket', () => {
  const cases = [
    { n: 4,  gs: 2, q: 1, desc: '4p/2gs/1q → 2 qualifiers → 1 final' },
    { n: 8,  gs: 4, q: 2, desc: '8p/4gs/2q → 4 qualifiers → 3 KO matches' },
    { n: 16, gs: 4, q: 2, desc: '16p/4gs/2q → 8 qualifiers → 7 KO matches' },
    { n: 32, gs: 8, q: 4, desc: '32p/8gs/4q → 16 qualifiers → 15 KO matches' },
  ];

  for (const { n, gs, q, desc } of cases) {
    test(desc, () => {
      const numGroups = Math.ceil(n / gs);
      const totalQualifiers = numGroups * q;
      const expectedKoMatches = nextPowerOfTwo(totalQualifiers) - 1;
      const { matches } = logic.generateTournament(makePlayers(n), gs, q, { shufflePlayers: false });
      assert.equal(mainMatches(matches).length, expectedKoMatches);
      assert.ok(getFinal(matches) !== null, `No final for: ${desc}`);
    });
  }
});

describe('GROUP_KO: non-power-of-2 qualifier counts → byes injected in KO', () => {
  const cases = [
    { n: 9,  gs: 3, q: 2, totalQ: 6, desc: '9p/3gs/2q → 6 qualifiers → 8-slot bracket (2 KO byes)' },
    { n: 10, gs: 5, q: 3, totalQ: 6, desc: '10p/5gs/3q → 6 qualifiers → 8-slot bracket' },
    { n: 12, gs: 4, q: 3, totalQ: 9, desc: '12p/4gs/3q → 9 qualifiers → 16-slot bracket (7 KO byes)' },
    { n: 15, gs: 5, q: 3, totalQ: 9, desc: '15p/5gs/3q → 9 qualifiers → 16-slot bracket' },
  ];

  for (const { n, gs, q, totalQ, desc } of cases) {
    test(desc, () => {
      const expectedKoMatches = nextPowerOfTwo(totalQ) - 1;
      const { matches } = logic.generateTournament(makePlayers(n), gs, q, { shufflePlayers: false });
      assert.equal(mainMatches(matches).length, expectedKoMatches, desc);
      assert.ok(getFinal(matches) !== null, `No final: ${desc}`);
    });
  }
});

describe('GROUP_KO: uneven groups (player count not divisible by groupSize)', () => {
  test('5 players, groupSize=3 → groups of (3,2), both qualifying', () => {
    // Group A: 3 players, Group B: 2 players
    // qualifiers: min(2,3)=2 + min(2,2)=2 = 4 → clean 4-player KO
    const { matches } = logic.generateTournament(makePlayers(5), 3, 2, { shufflePlayers: false });
    assert.equal(mainMatches(matches).length, 3, '4-player KO should have 3 matches');
    assert.ok(getFinal(matches) !== null);
  });

  test('7 players, groupSize=4 → groups of (4,3), 4 qualifiers total', () => {
    const { matches } = logic.generateTournament(makePlayers(7), 4, 2, { shufflePlayers: false });
    assert.equal(mainMatches(matches).length, 3);
    assert.ok(getFinal(matches) !== null);
  });

  test('7 players, groupSize=3 → groups of (3,3,1), 5 qualifiers → 8-slot bracket', () => {
    // Group C has 1 player, contributes min(2,1)=1 qualifier
    // Total: 2+2+1 = 5 → nextPowerOf2(5) = 8 → 7 KO matches
    const { matches } = logic.generateTournament(makePlayers(7), 3, 2, { shufflePlayers: false });
    assert.equal(mainMatches(matches).length, 7, '5-qualifier → 8-slot bracket → 7 KO matches');
    assert.ok(getFinal(matches) !== null);
  });

  test('7 players, groupSize=3 → group of 1 has 0 group matches (no crash)', () => {
    const { matches } = logic.generateTournament(makePlayers(7), 3, 2, { shufflePlayers: false });
    // Group C (1 player) should have 0 group matches; no crash
    const gMatches = groupMatches(matches);
    // Groups A and B have 3 players each → 3 round-robin matches each → 6 total
    assert.equal(gMatches.length, 6, 'Expected 6 group matches (3 per group × 2 groups)');
  });

  test('11 players, groupSize=4 → groups of (4,4,3), total qualifiers = 3×2=6 → 8-slot bracket', () => {
    const { matches } = logic.generateTournament(makePlayers(11), 4, 2, { shufflePlayers: false });
    assert.equal(mainMatches(matches).length, 7);
    assert.ok(getFinal(matches) !== null);
  });
});

describe('GROUP_KO: qualifiers capped at actual group size', () => {
  test('4 players, groupSize=2, qualifiers=5 → min(5,2)=2 per group → 4 qualifiers → 3 KO matches', () => {
    const { matches } = logic.generateTournament(makePlayers(4), 2, 5, { shufflePlayers: false });
    assert.equal(mainMatches(matches).length, 3);
    assert.ok(getFinal(matches) !== null);
  });

  test('6 players, groupSize=3, qualifiers=10 → min(10,3)=3 per group → 6 qualifiers → 8-slot bracket', () => {
    const { matches } = logic.generateTournament(makePlayers(6), 3, 10, { shufflePlayers: false });
    assert.equal(mainMatches(matches).length, 7);
    assert.ok(getFinal(matches) !== null);
  });
});

describe('GROUP_KO: 1 qualifier per group produces valid bracket', () => {
  test('4 players, groupSize=2, qualifiers=1 → 2 qualifiers → 1 final match', () => {
    const { matches } = logic.generateTournament(makePlayers(4), 2, 1, { shufflePlayers: false });
    assert.equal(mainMatches(matches).length, 1, 'Should produce exactly 1 KO match (the final)');
    assert.ok(getFinal(matches) !== null);
  });

  test('6 players, groupSize=3, qualifiers=1 → 2 qualifiers → 1 final match', () => {
    const { matches } = logic.generateTournament(makePlayers(6), 3, 1, { shufflePlayers: false });
    assert.equal(mainMatches(matches).length, 1);
    assert.ok(getFinal(matches) !== null);
  });

  test('9 players, groupSize=3, qualifiers=1 → 3 qualifiers → 4-slot bracket with 1 bye', () => {
    const { matches } = logic.generateTournament(makePlayers(9), 3, 1, { shufflePlayers: false });
    // 3 qualifiers → nextPowerOf2(3) = 4 → 3 KO matches
    assert.equal(mainMatches(matches).length, 3);
    assert.ok(getFinal(matches) !== null);
  });
});

describe('GROUP_KO: edge case — only 1 group produces no KO bracket', () => {
  // When all players fit in 1 group and qualifiers=1, only 1 qualifier → no KO bracket
  // This is a known limitation: the tournament has group matches but no final.
  // The test documents the current behavior.
  test('4 players, groupSize=4, qualifiers=1 → 1 qualifier → no KO bracket (no final)', () => {
    const { matches } = logic.generateTournament(makePlayers(4), 4, 1, { shufflePlayers: false });
    const main = mainMatches(matches);
    // Document current behavior: no KO bracket produced
    assert.equal(main.length, 0, 'With only 1 qualifier, no KO bracket is generated');
  });

  test('4 players, groupSize=4, qualifiers=2 → 2 qualifiers → 1 final (works correctly)', () => {
    const { matches } = logic.generateTournament(makePlayers(4), 4, 2, { shufflePlayers: false });
    assert.equal(mainMatches(matches).length, 1, '2 qualifiers from 1 group produces 1 KO match');
    assert.ok(getFinal(matches) !== null);
  });
});

describe('GROUP_KO: all match numbers are unique across whole tournament', () => {
  test('16 players, groupSize=4, qualifiers=2 → all match numbers unique', () => {
    const { matches } = logic.generateTournament(makePlayers(16), 4, 2, { shufflePlayers: false });
    const nums = matches.map((m) => m.matchNumber);
    assert.equal(new Set(nums).size, nums.length, 'Duplicate match numbers found');
  });

  test('9 players, groupSize=3, qualifiers=2 → all match numbers unique', () => {
    const { matches } = logic.generateTournament(makePlayers(9), 3, 2, { shufflePlayers: false });
    const nums = matches.map((m) => m.matchNumber);
    assert.equal(new Set(nums).size, nums.length, 'Duplicate match numbers found');
  });
});

describe('GROUP_KO: group round-robin has correct pairing count', () => {
  const cases = [
    { n: 6,  gs: 3, q: 2, groupCount: 2, pairsPerGroup: 3, desc: '2 groups of 3' },
    { n: 8,  gs: 4, q: 2, groupCount: 2, pairsPerGroup: 6, desc: '2 groups of 4' },
    { n: 12, gs: 4, q: 2, groupCount: 3, pairsPerGroup: 6, desc: '3 groups of 4' },
    { n: 9,  gs: 3, q: 2, groupCount: 3, pairsPerGroup: 3, desc: '3 groups of 3' },
  ];

  for (const { n, gs, q, groupCount, pairsPerGroup, desc } of cases) {
    test(`${desc}: ${groupCount} × ${pairsPerGroup} = ${groupCount * pairsPerGroup} group matches`, () => {
      const { matches } = logic.generateTournament(makePlayers(n), gs, q, { shufflePlayers: false });
      assert.equal(groupMatches(matches).length, groupCount * pairsPerGroup, desc);
    });
  }
});

describe('GROUP_KO: KO bye matches are auto-finished', () => {
  test('9 players, groupSize=3, qualifiers=2 → 2 KO bye matches are auto-finished', () => {
    // 6 qualifiers → 8-slot bracket → 2 byes in KO first round
    const { matches } = logic.generateTournament(makePlayers(9), 3, 2, { shufflePlayers: false });
    const koByes = mainMatches(matches).filter(
      (m) => m.player1?.type === 'bye' || m.player2?.type === 'bye',
    );
    assert.equal(koByes.length, 2, 'Expected 2 bye matches in KO bracket');
    for (const m of koByes) {
      assert.equal(m.status, 'finished', `KO bye match ${m.matchNumber} not auto-finished`);
    }
  });
});

describe('GROUP_KO: generateTournamentFromGroups with explicit groups', () => {
  test('2 groups of 4 with 2 qualifiers → 4-player KO → 3 main matches', () => {
    const groups = [
      {
        id: 'g-a',
        name: 'Gruppe A',
        players: ['A1', 'A2', 'A3', 'A4'].map((name, i) => ({
          id: `a-${i + 1}`,
          type: 'player',
          name,
          groupId: 'g-a',
        })),
      },
      {
        id: 'g-b',
        name: 'Gruppe B',
        players: ['B1', 'B2', 'B3', 'B4'].map((name, i) => ({
          id: `b-${i + 1}`,
          type: 'player',
          name,
          groupId: 'g-b',
        })),
      },
    ];

    const { matches } = logic.generateTournamentFromGroups(groups, 2, { playAllPlaces: false });
    assert.equal(mainMatches(matches).length, 3);
    assert.ok(getFinal(matches) !== null);
  });

  test('uneven groups (4+3) with 2 qualifiers each → 4 qualifiers → 3 main matches', () => {
    const groups = [
      {
        id: 'g-a',
        name: 'Gruppe A',
        players: ['A1', 'A2', 'A3', 'A4'].map((name, i) => ({
          id: `a-${i + 1}`, type: 'player', name, groupId: 'g-a',
        })),
      },
      {
        id: 'g-b',
        name: 'Gruppe B',
        players: ['B1', 'B2', 'B3'].map((name, i) => ({
          id: `b-${i + 1}`, type: 'player', name, groupId: 'g-b',
        })),
      },
    ];

    const { matches } = logic.generateTournamentFromGroups(groups, 2, { playAllPlaces: false });
    assert.equal(mainMatches(matches).length, 3);
    assert.ok(getFinal(matches) !== null);
  });

  test('group of 1 player with 1 qualifier + group of 3 with 2 qualifiers → 3 qualifiers → 4-slot bracket', () => {
    const groups = [
      {
        id: 'g-a',
        name: 'Gruppe A',
        players: ['A1', 'A2', 'A3'].map((name, i) => ({
          id: `a-${i + 1}`, type: 'player', name, groupId: 'g-a',
        })),
      },
      {
        id: 'g-b',
        name: 'Gruppe B',
        players: [{ id: 'b-1', type: 'player', name: 'B1', groupId: 'g-b' }],
      },
    ];

    const { matches } = logic.generateTournamentFromGroups(groups, 2, { playAllPlaces: false });
    // Group A: min(2,3)=2, Group B: min(2,1)=1 → 3 qualifiers → nextPowerOf2(3)=4 → 3 KO matches
    assert.equal(mainMatches(matches).length, 3, '3 qualifiers should produce 4-slot bracket');
    assert.ok(getFinal(matches) !== null);
  });
});
