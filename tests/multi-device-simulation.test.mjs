/**
 * Multi-Device Simulation Test
 *
 * Simuliert 3 Geräte (Tabs/Browser) die gleichzeitig im selben Turnier aktiv sind.
 * Alle verbinden sich gegen die echte Firestore-Datenbank — kein Mock, keine Emulatoren.
 *
 * Szenarien:
 *  1. Turnier-Setup: 4 Spieler, 3 KO-Matches (SF1, SF2, Finale)
 *  2. Watcher-Claim Race: 3 Geräte versuchen gleichzeitig denselben Match zu claimen → nur 1 gewinnt
 *  3. Parallele Matches: Gerät A watcht SF1, Gerät B watcht SF2 gleichzeitig → beide schreiben korrekt
 *  4. Heartbeat-Takeover: Gerät A "stirbt" (kein Heartbeat) → Gerät B übernimmt nach Stale-Timeout
 *  5. Datenintegrität: Nach allen Matches sind Spielerstatistiken korrekt aggregiert
 *  6. Aufräumen: Turnier-Dokument und alle Subcollections werden gelöscht
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { TournamentDB } from '../src/TournamentDB.js';

// ─── Konstanten ──────────────────────────────────────────────────────────────

const STALE_MS_TEST = 5000;   // Im Test: Claim gilt nach 5 s als stale (statt 15 s)
const HEARTBEAT_MS  = 1000;   // Heartbeat-Intervall im Test (statt 4 s)
const TICK_MS       = 500;    // Polling-Intervall für Warte-Schleifen

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Erzeugt eine eindeutige Client-ID wie clientSession.js es tun würde. */
function makeClientId(label) {
  return `test-${label}-${randomUUID()}`;
}

/** Wartet bis eine Bedingung wahr ist oder ein Timeout abläuft. */
async function waitFor(fn, { timeoutMs = 8000, intervalMs = TICK_MS, label = '' } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await sleep(intervalMs);
  }
  throw new Error(`waitFor timeout${label ? ` (${label})` : ''}`);
}

/**
 * Simuliert watchMatchUntilFinished() für einen einzelnen "Tick-Zyklus":
 * - versucht Claim zu holen
 * - sendet Heartbeats
 * - schreibt Zwischenstand
 * - beendet Match wenn finishedAt gesetzt ist
 *
 * Gibt { claimed, finished } zurück.
 */
async function simulateWatcher({ db, tournamentId, match, clientId, fakeStats, intervalMs = HEARTBEAT_MS }) {
  const claimed = await db.tryClaimMatchWatcher(tournamentId, match.id, clientId, STALE_MS_TEST);
  if (!claimed) return { claimed: false, finished: false };

  let finished = false;
  let ticks = 0;
  const maxTicks = 20;

  while (ticks < maxTicks) {
    ticks++;
    await sleep(intervalMs);

    const current = await db.getMatchById(tournamentId, match.id);
    if (!current || current.status === 'finished' || current.status === 'aborted') {
      finished = true;
      break;
    }

    // Heartbeat senden — wirft MATCH_WATCHER_CLAIM_LOST wenn übernommen
    try {
      await db.heartbeatMatchWatcher(tournamentId, match.id, clientId, new Date().toISOString());
    } catch (err) {
      if (err?.message === 'MATCH_WATCHER_CLAIM_LOST') break;
      throw err;
    }

    // Zwischenstand schreiben
    const stats = fakeStats(ticks);
    await db.saveMatchScore(tournamentId, match.id, {
      scorePlayer1: stats.scorePlayer1,
      scorePlayer2: stats.scorePlayer2,
      lobbyId: match.lobbyId || 'fake-lobby',
    });

    // Match abschließen wenn fertig
    if (stats.finishedAt) {
      await db.setMatchFinished(
        tournamentId,
        match.id,
        stats.winner,
        stats.loser,
        {
          lobbyId: match.lobbyId || 'fake-lobby',
          scorePlayer1: stats.scorePlayer1,
          scorePlayer2: stats.scorePlayer2,
          finalPlayerStats: stats.finalPlayerStats,
          finishedAt: stats.finishedAt,
          resultSource: 'autodarts',
        },
      );
      finished = true;
      break;
    }
  }

  await db.releaseMatchWatcher(tournamentId, match.id, clientId).catch(() => {});
  return { claimed: true, finished };
}

// ─── Fake AutoDarts Stats ─────────────────────────────────────────────────────

function makeFakeMatchStats(player1, player2, winnerIsPlayer1 = true) {
  return (tick) => {
    const scoreP1 = winnerIsPlayer1 ? Math.min(tick, 2) : Math.min(Math.floor(tick / 2), 1);
    const scoreP2 = winnerIsPlayer1 ? Math.min(Math.floor(tick / 2), 1) : Math.min(tick, 2);
    const done = tick >= 4;

    return {
      scorePlayer1: { legs: scoreP1, sets: 0 },
      scorePlayer2: { legs: scoreP2, sets: 0 },
      finishedAt: done ? new Date().toISOString() : null,
      winner: done ? player1 : null,
      loser:  done ? player2 : null,
      finalPlayerStats: done ? [
        {
          playerId: player1.id,
          name:     player1.name,
          stats: {
            average:        85.4,
            dartsThrown:    54,
            legsWon:        2,
            plus100:        4,
            checkoutsHit:   2,
            checkoutsAttempted: 3,
          },
        },
        {
          playerId: player2.id,
          name:     player2.name,
          stats: {
            average:        72.1,
            dartsThrown:    60,
            legsWon:        1,
            plus100:        2,
            checkoutsHit:   1,
            checkoutsAttempted: 4,
          },
        },
      ] : null,
    };
  };
}

// ─── Cleanup-Hilfsfunktion ────────────────────────────────────────────────────

async function deleteTournament(db, tournamentId) {
  const { getFirestore, collection, getDocs, doc, deleteDoc, writeBatch } = await import('firebase/firestore');
  const fs = getFirestore();

  const subcollections = ['players', 'matches', 'boards', 'groups'];
  for (const sub of subcollections) {
    const snap = await getDocs(collection(fs, 'tournaments', tournamentId, sub));
    if (snap.empty) continue;
    const batch = writeBatch(fs);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(fs, 'tournaments', tournamentId));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let tournamentId = null;
let players      = [];
let matches      = [];
const db         = new TournamentDB();

// Geräte-IDs (simulieren 3 verschiedene Browser-Tabs)
const deviceA = makeClientId('GeraetA');
const deviceB = makeClientId('GeraetB');
const deviceC = makeClientId('GeraetC');

// ── 1. Setup ──────────────────────────────────────────────────────────────────

test('Setup: Turnier mit 4 Spielern und KO-Bracket erstellen', async () => {
  tournamentId = await db.createTournament(
    'Multi-Device Test Cup',
    'MDTEST-' + Date.now().toString(36).toUpperCase(),
    'KO',
    { defaultMatchSettings: { variant: 'X01', legs: 2, sets: 0 } },
  );

  assert.ok(tournamentId, 'Turnier-ID muss vorhanden sein');

  players = await db.createPlayers(tournamentId, [
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Charlie' },
    { name: 'Diana' },
  ]);

  assert.equal(players.length, 4, '4 Spieler erstellt');

  const [alice, bob, charlie, diana] = players;

  // Manuell KO-Bracket: SF1, SF2, Finale
  await db.createMatches(
    tournamentId,
    [
      { matchNumber: 1, round: 1, player1: alice.name,   player2: bob.name,     status: 'pending', displayRoundName: 'Halbfinale' },
      { matchNumber: 2, round: 1, player1: charlie.name, player2: diana.name,   status: 'pending', displayRoundName: 'Halbfinale' },
      { matchNumber: 3, round: 2, player1: { type: 'match', ref: 1, source: 'winner' }, player2: { type: 'match', ref: 2, source: 'winner' }, status: 'pending', displayRoundName: 'Finale' },
    ],
    players,
  );

  // Boards hinzufügen (2 Boards für parallele Matches)
  await db.addBoards(tournamentId, [
    { id: 'board-uuid-001', name: 'Board 1' },
    { id: 'board-uuid-002', name: 'Board 2' },
  ]);

  matches = await db.getMatchesByTournamentId(tournamentId);
  assert.equal(matches.length, 3, '3 Matches erstellt');

  console.log(`  Turnier erstellt: ${tournamentId}`);
  console.log(`  Spieler: ${players.map((p) => p.name).join(', ')}`);
});

// ── 2. Matches starten ────────────────────────────────────────────────────────

test('Setup: SF1 und SF2 parallel auf "started" setzen', async () => {
  const sf1 = matches.find((m) => m.matchNumber === 1);
  const sf2 = matches.find((m) => m.matchNumber === 2);

  assert.ok(sf1, 'SF1 muss existieren');
  assert.ok(sf2, 'SF2 muss existieren');

  await Promise.all([
    db.setMatchStarted(tournamentId, sf1.id, { lobbyId: 'lobby-sf1', boardId: 'board-uuid-001' }),
    db.setMatchStarted(tournamentId, sf2.id, { lobbyId: 'lobby-sf2', boardId: 'board-uuid-002' }),
  ]);

  matches = await db.getMatchesByTournamentId(tournamentId);
  const sf1Updated = matches.find((m) => m.matchNumber === 1);
  const sf2Updated = matches.find((m) => m.matchNumber === 2);

  assert.equal(sf1Updated.status, 'started', 'SF1 gestartet');
  assert.equal(sf2Updated.status, 'started', 'SF2 gestartet');

  console.log('  SF1 und SF2 gestartet');
});

// ── 3. Watcher-Claim Race Condition ───────────────────────────────────────────

test('Race Condition: 3 Geräte claimen gleichzeitig denselben Match → nur 1 gewinnt', async () => {
  const sf1 = matches.find((m) => m.matchNumber === 1);

  // Alle 3 Geräte versuchen gleichzeitig zu claimen
  const [resultA, resultB, resultC] = await Promise.all([
    db.tryClaimMatchWatcher(tournamentId, sf1.id, deviceA, STALE_MS_TEST),
    db.tryClaimMatchWatcher(tournamentId, sf1.id, deviceB, STALE_MS_TEST),
    db.tryClaimMatchWatcher(tournamentId, sf1.id, deviceC, STALE_MS_TEST),
  ]);

  const winners = [resultA, resultB, resultC].filter(Boolean);
  console.log(`  Claim-Ergebnisse: A=${resultA}, B=${resultB}, C=${resultC}`);
  console.log(`  Gewinner: ${winners.length}`);

  assert.equal(winners.length, 1, 'Genau 1 Gerät muss den Claim gewinnen');

  // Prüfen wer gewonnen hat
  const sf1AfterRace = await db.getMatchById(tournamentId, sf1.id);
  const claimHolder = sf1AfterRace.watcherClientId;

  assert.ok(
    [deviceA, deviceB, deviceC].includes(claimHolder),
    'watcherClientId muss einer der 3 Geräte-IDs sein',
  );

  console.log(`  Claim-Inhaber: ${claimHolder === deviceA ? 'Gerät A' : claimHolder === deviceB ? 'Gerät B' : 'Gerät C'}`);

  // Claim freigeben für nächsten Test
  await db.releaseMatchWatcher(tournamentId, sf1.id, claimHolder);
});

// ── 4. Parallele Matches: Gerät A watcht SF1, Gerät B watcht SF2 ──────────────

test('Parallele Watcher: SF1 (Gerät A) und SF2 (Gerät B) gleichzeitig → beide korrekt abgeschlossen', async () => {
  const sf1 = matches.find((m) => m.matchNumber === 1);
  const sf2 = matches.find((m) => m.matchNumber === 2);
  const [alice, bob, charlie, diana] = players;

  console.log('  Starte parallele Watcher für SF1 und SF2...');

  const [watcherResultA, watcherResultB] = await Promise.all([
    simulateWatcher({
      db,
      tournamentId,
      match: { ...sf1, lobbyId: 'lobby-sf1' },
      clientId: deviceA,
      fakeStats: makeFakeMatchStats(
        { type: 'player', id: alice.id, name: alice.name },
        { type: 'player', id: bob.id, name: bob.name },
        true,  // Alice gewinnt SF1
      ),
    }),
    simulateWatcher({
      db,
      tournamentId,
      match: { ...sf2, lobbyId: 'lobby-sf2' },
      clientId: deviceB,
      fakeStats: makeFakeMatchStats(
        { type: 'player', id: charlie.id, name: charlie.name },
        { type: 'player', id: diana.id, name: diana.name },
        true,  // Charlie gewinnt SF2
      ),
    }),
  ]);

  assert.ok(watcherResultA.claimed, 'Gerät A muss SF1 geclaimed haben');
  assert.ok(watcherResultB.claimed, 'Gerät B muss SF2 geclaimed haben');
  assert.ok(watcherResultA.finished, 'SF1 muss abgeschlossen sein');
  assert.ok(watcherResultB.finished, 'SF2 muss abgeschlossen sein');

  // Firestore prüfen
  matches = await db.getMatchesByTournamentId(tournamentId);
  const sf1Final = matches.find((m) => m.matchNumber === 1);
  const sf2Final = matches.find((m) => m.matchNumber === 2);

  assert.equal(sf1Final.status, 'finished', 'SF1 status = finished');
  assert.equal(sf2Final.status, 'finished', 'SF2 status = finished');
  assert.equal(sf1Final.winner?.name, 'Alice', 'Alice gewinnt SF1');
  assert.equal(sf2Final.winner?.name, 'Charlie', 'Charlie gewinnt SF2');

  // Scores prüfen
  assert.ok(sf1Final.scorePlayer1 != null, 'SF1 scorePlayer1 gespeichert');
  assert.ok(sf2Final.scorePlayer1 != null, 'SF2 scorePlayer1 gespeichert');

  console.log(`  SF1: ${sf1Final.winner?.name} gewinnt (${sf1Final.scorePlayer1?.legs}:${sf1Final.scorePlayer2?.legs})`);
  console.log(`  SF2: ${sf2Final.winner?.name} gewinnt (${sf2Final.scorePlayer1?.legs}:${sf2Final.scorePlayer2?.legs})`);
});

// ── 5. Finale: Propagation prüfen ─────────────────────────────────────────────

test('Bracket-Propagation: Finale hat Alice vs. Charlie nach SF-Abschluss', async () => {
  const finale = await waitFor(
    async () => {
      const all = await db.getMatchesByTournamentId(tournamentId);
      const f = all.find((m) => m.matchNumber === 3);
      const p1IsPlayer = f?.player1?.type === 'player';
      const p2IsPlayer = f?.player2?.type === 'player';
      return p1IsPlayer && p2IsPlayer ? f : null;
    },
    { timeoutMs: 10000, label: 'Finale Propagation' },
  );

  assert.equal(finale.player1?.name, 'Alice',   'Finale Slot 1 = Alice (SF1 Gewinner)');
  assert.equal(finale.player2?.name, 'Charlie', 'Finale Slot 2 = Charlie (SF2 Gewinner)');
  assert.equal(finale.status, 'pending', 'Finale ist noch ausstehend');

  console.log(`  Finale: ${finale.player1?.name} vs. ${finale.player2?.name}`);
});

// ── 6. Heartbeat-Takeover Simulation ─────────────────────────────────────────

test('Heartbeat-Takeover: Gerät C übernimmt Finale wenn Gerät A aufhört zu heartbeaten', async () => {
  matches = await db.getMatchesByTournamentId(tournamentId);
  const finale = matches.find((m) => m.matchNumber === 3);

  // Finale starten
  await db.setMatchStarted(tournamentId, finale.id, { lobbyId: 'lobby-finale' });

  // Gerät A claimed das Finale
  const claimedByA = await db.tryClaimMatchWatcher(tournamentId, finale.id, deviceA, STALE_MS_TEST);
  assert.ok(claimedByA, 'Gerät A muss Finale claimen können');
  console.log('  Gerät A hat Finale-Claim');

  // Gerät A sendet kurz Heartbeats, dann "stirbt" es
  await db.heartbeatMatchWatcher(tournamentId, finale.id, deviceA, new Date().toISOString());
  await sleep(500);
  await db.heartbeatMatchWatcher(tournamentId, finale.id, deviceA, new Date().toISOString());

  console.log(`  Gerät A sendet letzten Heartbeat, dann Pause für ${STALE_MS_TEST} ms...`);
  // Gerät A stirbt — kein weiterer Heartbeat

  // Gerät B versucht sofort zu übernehmen → sollte NICHT klappen (Claim noch frisch)
  const earlyAttemptByB = await db.tryClaimMatchWatcher(tournamentId, finale.id, deviceB, STALE_MS_TEST);
  assert.equal(earlyAttemptByB, false, 'Gerät B darf nicht sofort übernehmen (Claim noch frisch)');
  console.log('  Gerät B abgewiesen (Claim noch gültig) ✓');

  // Warten bis Claim stale ist
  await sleep(STALE_MS_TEST + 500);

  // Gerät B versucht erneut → muss jetzt klappen
  const lateAttemptByB = await db.tryClaimMatchWatcher(tournamentId, finale.id, deviceB, STALE_MS_TEST);
  assert.ok(lateAttemptByB, 'Gerät B muss nach Stale-Timeout übernehmen können');
  console.log('  Gerät B hat Claim übernommen ✓');

  // Prüfen ob Firestore den richtigen Claim-Inhaber zeigt
  const finaleAfterTakeover = await db.getMatchById(tournamentId, finale.id);
  assert.equal(finaleAfterTakeover.watcherClientId, deviceB, 'Firestore zeigt Gerät B als neuen Claim-Inhaber');

  // Claim freigeben
  await db.releaseMatchWatcher(tournamentId, finale.id, deviceB);
});

// ── 7. Finale abspielen (Gerät C) ─────────────────────────────────────────────

test('Finale: Gerät C watcht und schließt das Finale ab', async () => {
  matches = await db.getMatchesByTournamentId(tournamentId);
  const finale = matches.find((m) => m.matchNumber === 3);
  const alice   = players.find((p) => p.name === 'Alice');
  const charlie = players.find((p) => p.name === 'Charlie');

  const result = await simulateWatcher({
    db,
    tournamentId,
    match: { ...finale, lobbyId: 'lobby-finale' },
    clientId: deviceC,
    fakeStats: makeFakeMatchStats(
      { type: 'player', id: alice.id, name: alice.name },
      { type: 'player', id: charlie.id, name: charlie.name },
      true,  // Alice gewinnt das Finale
    ),
  });

  assert.ok(result.claimed, 'Gerät C muss Finale claimen');
  assert.ok(result.finished, 'Finale muss abgeschlossen sein');

  matches = await db.getMatchesByTournamentId(tournamentId);
  const finaleFinal = matches.find((m) => m.matchNumber === 3);

  assert.equal(finaleFinal.status, 'finished', 'Finale status = finished');
  assert.equal(finaleFinal.winner?.name, 'Alice', 'Alice gewinnt das Turnier');
  assert.equal(finaleFinal.loser?.name, 'Charlie', 'Charlie verliert das Finale');

  console.log(`  Turnier-Sieger: ${finaleFinal.winner?.name} 🎯`);
});

// ── 8. Spielerstatistiken prüfen ──────────────────────────────────────────────

test('Statistiken: Spielerstatistiken nach allen Matches korrekt aggregiert', async () => {
  // Stats werden von setMatchFinished() automatisch aktualisiert — kurz warten
  await sleep(2000);

  const playerDocs = await db.getPlayersByTournamentId(tournamentId);
  const stats = Object.fromEntries(
    playerDocs.map((p) => [p.name.toLowerCase(), p]),
  );

  console.log('  Spielerstatistiken:');
  for (const [name, s] of Object.entries(stats)) {
    console.log(`    ${name}: ${s.matchesPlayed} Spiele, ${s.wins}W/${s.losses}L, Ø ${(s.average || 0).toFixed(1)}`);
  }

  // Alice: 2 Matches gespielt (SF1 + Finale), 2 Siege
  assert.equal(stats['alice'].matchesPlayed, 2, 'Alice: 2 Spiele');
  assert.equal(stats['alice'].wins, 2, 'Alice: 2 Siege (Turniersiegerin)');
  assert.equal(stats['alice'].losses, 0, 'Alice: 0 Niederlagen');

  // Charlie: 2 Matches (SF2 + Finale), 1 Sieg, 1 Niederlage
  assert.equal(stats['charlie'].matchesPlayed, 2, 'Charlie: 2 Spiele');
  assert.equal(stats['charlie'].wins, 1, 'Charlie: 1 Sieg');
  assert.equal(stats['charlie'].losses, 1, 'Charlie: 1 Niederlage');

  // Bob und Diana: je 1 Match, 0 Siege
  assert.equal(stats['bob'].matchesPlayed, 1, 'Bob: 1 Spiel');
  assert.equal(stats['bob'].wins, 0, 'Bob: 0 Siege');
  assert.equal(stats['diana'].matchesPlayed, 1, 'Diana: 1 Spiel');
  assert.equal(stats['diana'].wins, 0, 'Diana: 0 Siege');

  // Average muss > 0 sein (finalPlayerStats wurden gespeichert)
  assert.ok((stats['alice'].average || 0) > 0, 'Alice: Average > 0');
  assert.ok((stats['charlie'].average || 0) > 0, 'Charlie: Average > 0');

  // Legs geprüft
  assert.ok(stats['alice'].legsWon >= 2, 'Alice: mind. 2 Legs gewonnen');
});

// ── 9. Gleichzeitige Schreibkonflikte auf demselben Match ─────────────────────

test('Schreibkonflikt: 3 Geräte schreiben gleichzeitig Scores → kein Datenverlust, letzter Stand gewinnt', async () => {
  // Neues Test-Match erstellen (standalone, kein Bracket-Einfluss)
  const [alice, bob] = players;

  await db.createMatches(
    tournamentId,
    [{ matchNumber: 99, round: 99, player1: alice.name, player2: bob.name, status: 'pending', displayRoundName: 'Konflikt-Test' }],
    players,
  );

  const allMatches = await db.getMatchesByTournamentId(tournamentId);
  const testMatch = allMatches.find((m) => m.matchNumber === 99);
  assert.ok(testMatch, 'Test-Match erstellt');

  await db.setMatchStarted(tournamentId, testMatch.id);

  // 3 Geräte schreiben gleichzeitig unterschiedliche Scores
  const writes = await Promise.allSettled([
    db.saveMatchScore(tournamentId, testMatch.id, { scorePlayer1: { legs: 1, sets: 0 }, scorePlayer2: { legs: 0, sets: 0 } }),
    db.saveMatchScore(tournamentId, testMatch.id, { scorePlayer1: { legs: 1, sets: 0 }, scorePlayer2: { legs: 1, sets: 0 } }),
    db.saveMatchScore(tournamentId, testMatch.id, { scorePlayer1: { legs: 2, sets: 0 }, scorePlayer2: { legs: 1, sets: 0 } }),
  ]);

  const errors = writes.filter((r) => r.status === 'rejected');
  console.log(`  Schreibversuche: ${writes.length}, Fehler: ${errors.length}`);

  // Alle 3 Writes müssen gelingen (saveMatchScore nutzt updateDoc, kein Transaction-Konflikt)
  assert.equal(errors.length, 0, 'Alle 3 parallelen Writes müssen gelingen');

  // Dokument muss noch konsistent les- und schreibbar sein
  const afterConflict = await db.getMatchById(tournamentId, testMatch.id);
  assert.ok(afterConflict, 'Match nach Schreibkonflikten noch lesbar');
  assert.ok(afterConflict.scorePlayer1 != null, 'scorePlayer1 gesetzt nach Konflikten');
  assert.equal(afterConflict.status, 'started', 'Status nicht korrumpiert');

  console.log(`  Endstand nach Konflikten: ${afterConflict.scorePlayer1?.legs}:${afterConflict.scorePlayer2?.legs}`);
});

// ── 10. Cleanup ───────────────────────────────────────────────────────────────

test('Cleanup: Turnier und alle Subcollections aus Firestore löschen', async () => {
  assert.ok(tournamentId, 'Turnier-ID muss bekannt sein');

  await deleteTournament(db, tournamentId);

  // Turnier darf nicht mehr existieren
  const ghost = await db.getTournamentById(tournamentId);
  assert.equal(ghost, null, 'Turnier wurde vollständig gelöscht');

  console.log(`  Turnier ${tournamentId} gelöscht ✓`);
  tournamentId = null;
});
