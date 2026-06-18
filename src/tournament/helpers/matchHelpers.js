import {
  DEFAULT_MATCH_SETTINGS,
  DEFAULT_TOURNAMENT_TYPE,
} from "../../TournamentAppShared.js";
import { extractMatchSettings, getEffectiveMatchSettings } from "../../tournamentSettings.js";
import { normalizePlayerKey } from "../../utils/playerKey.js";

export const cx = (...classes) => classes.filter(Boolean).join(" ");

export function getDisplayName(player) {
  if (!player) return "—";

  if (typeof player === "string") {
    if (player === "__BYE__") return "Freilos";
    if (!Number.isNaN(Number(player))) return `Sieger Spiel ${player}`;
    return player;
  }

  if (player.type === "bye") return "Freilos";
  if (player.type === "player") return player.name || "—";
  if (player.type === "match") {
    const sourceLabel = player.source === "loser" ? "Verlierer" : "Sieger";
    return `${sourceLabel} Spiel ${player.ref}`;
  }
  if (player.type === "qualifier") return player.ref;
  if (player.name) return player.name;

  return "—";
}

export function getMatchTitle(match, labelPrefix = "") {
  if (!match) return "Spiel";

  const roundName = String(match.displayRoundName || "").trim();
  const matchNumber = String(match.matchNumber || "").trim();
  const matchNumberLabel = `${labelPrefix || "Spiel"} ${matchNumber}`;
  const isGroupMatch = /^[A-Z]-(\d+)$/i.test(matchNumber);
  const isGroupRound = /^Gruppe\s+[A-Z]$/i.test(roundName);

  if (isGroupMatch && isGroupRound) return matchNumberLabel;
  if (match.bracketType === "main" && Number(match.round) === 1) return matchNumberLabel;
  if (!roundName) return matchNumberLabel;

  const shouldSwapOrder =
    /^Plätze\s+\d+\s*-\s*\d+$/i.test(roundName) ||
    /^Platz\s+\d+$/i.test(roundName);

  return shouldSwapOrder
    ? `${matchNumberLabel} – ${roundName}`
    : `${roundName} – ${matchNumberLabel}`;
}

export function formatStatValue(value, digits = 1) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(digits) : (0).toFixed(digits);
}

export function getFinalStatsColumns(matchMode, tournamentType = DEFAULT_TOURNAMENT_TYPE) {
  if (tournamentType === "Cricket") {
    return [
      { header: "Platz", key: "place", width: 8 },
      { header: "Spieler", key: "name", width: 20 },
      { header: "Siege", key: "wins", width: 10 },
      { header: "Niederlagen", key: "losses", width: 12 },
      ...(matchMode === "Sets" ? [{ header: "Sets", key: "sets", width: 12 }] : [{ header: "Legs", key: "legs", width: 12 },]),
      { header: "MPR", key: "mpr", width: 10 },
      { header: "First 9 MPR", key: "first9Mpr", width: 14 },
      { header: "5 Mark", key: "mark5", width: 10 },
      { header: "6 Mark", key: "mark6", width: 10 },
      { header: "7 Mark", key: "mark7", width: 10 },
      { header: "8 Mark", key: "mark8", width: 10 },
      { header: "9 Mark", key: "mark9", width: 10 },
      { header: "White Horse", key: "whiteHorse", width: 14 },
    ];
  }

  return [
    { header: "Platz", key: "place", width: 8 },
    { header: "Spieler", key: "name", width: 20 },
    { header: "Siege", key: "wins", width: 10 },
    { header: "Niederlagen", key: "losses", width: 12 },
     ...(matchMode === "Sets" ? [{ header: "Sets", key: "sets", width: 12 }] : [{ header: "Legs", key: "legs", width: 12 },]),
    { header: "Average", key: "avg", width: 10 },
    { header: "Checkout %", key: "co", width: 12 },
    { header: "60+", key: "p60", width: 8 },
    { header: "100+", key: "p100", width: 8 },
    { header: "140+", key: "p140", width: 8 },
    { header: "170+/180", key: "p180", width: 12 },
    { header: "Bestes Checkout", key: "best", width: 18 },
  ];
}

export function getFinalStatsRow(player, index, matchMode, tournamentType = DEFAULT_TOURNAMENT_TYPE) {
  const row = {
    place: player.finalPlace ?? index + 1,
    name: player.name,
    wins: Number(player.wins || 0),
    losses: Number(player.losses || 0),
    ...(matchMode === "Sets" ? { sets: `${player.setsWon || 0}:${player.setsLost || 0}` } : {}),
    legs: `${player.legsWon || 0}:${player.legsLost || 0}`,
  };

  if (tournamentType === "Cricket") {
    return {
      ...row,
      mpr: formatStatValue(player.mpr, 2),
      first9Mpr: formatStatValue(player.first9MPR, 2),
      mark5: Number(player.mark5 || 0),
      mark6: Number(player.mark6 || 0),
      mark7: Number(player.mark7 || 0),
      mark8: Number(player.mark8 || 0),
      mark9: Number(player.mark9 || 0),
      whiteHorse: Number(player.whiteHorse || 0),
    };
  }

  return {
    ...row,
    avg: formatStatValue(player.average, 1),
    co: formatStatValue(player.checkoutPercent, 1),
    p60: Number(player.plus60 || 0),
    p100: Number(player.plus100 || 0),
    p140: Number(player.plus140 || 0),
    p180: Number(player.plus170Or180 || 0),
    best: Number(player.bestCheckout || 0),
  };
}

export function getPlayerScore(match, slot, matchMode = "Legs") {
  if (!match) return null;

  const score = slot === "player1" ? match.scorePlayer1 : match.scorePlayer2;
  if (score === null || score === undefined) return null;

  if (typeof score === "object") {
    const sets = typeof score.sets === "number" ? score.sets : 0;
    const legs = typeof score.legs === "number" ? score.legs : 0;
    return matchMode === "Sets" ? `${sets}:${legs}` : String(legs);
  }

  if (typeof score === "number" || typeof score === "string") {
    return String(score);
  }

  return null;
}

export function getManualEditTargetWins(match, globalSettings, roundSettings = {}) {
  const effectiveSettings = getEffectiveMatchSettings(match, globalSettings, roundSettings);
  return effectiveSettings.matchMode === "Sets"
    ? Number(effectiveSettings.sets) || DEFAULT_MATCH_SETTINGS.sets
    : Number(effectiveSettings.legs) || DEFAULT_MATCH_SETTINGS.legs;
}

export function getManualEditScoreLabel(match, globalSettings, roundSettings = {}) {
  const effectiveSettings = getEffectiveMatchSettings(match, globalSettings, roundSettings);
  return effectiveSettings.matchMode === "Sets" ? "Sets" : "Legs";
}

export function validateManualMatchResult(
  match,
  winnerSlot,
  rawScore1,
  rawScore2,
  globalSettings,
  roundSettings = {},
) {
  if (!match) {
    return { valid: false, message: "Kein Spiel ausgewählt." };
  }

  const targetWins = getManualEditTargetWins(match, globalSettings, roundSettings);
  const scoreLabel = getManualEditScoreLabel(match, globalSettings, roundSettings);
  const score1 = Number(rawScore1);
  const score2 = Number(rawScore2);

  if (!Number.isInteger(score1) || !Number.isInteger(score2)) {
    return { valid: false, message: `Bitte nur ganze ${scoreLabel}-Zahlen eingeben.` };
  }
  if (score1 < 0 || score2 < 0) {
    return { valid: false, message: `${scoreLabel} dürfen nicht negativ sein.` };
  }
  if (score1 === score2) {
    return { valid: false, message: "Ein Spiel kann nicht mit Gleichstand gespeichert werden." };
  }

  const winnerScore = winnerSlot === "player1" ? score1 : score2;
  const loserScore = winnerSlot === "player1" ? score2 : score1;

  if (winnerScore !== targetWins) {
    return { valid: false, message: `Der Sieger muss genau ${targetWins} ${scoreLabel} haben.` };
  }
  if (loserScore >= targetWins) {
    return { valid: false, message: `Der Verlierer darf maximal ${targetWins - 1} ${scoreLabel} haben.` };
  }

  return { valid: true, score1, score2, targetWins, scoreLabel };
}

export function compareMatchNumbers(a, b) {
  const parseMatchNumber = (value) => {
    const str = String(value);
    const groupMatch = str.match(/^([A-Z])-(\d+)$/);

    if (groupMatch) {
      return { type: "group", group: groupMatch[1].charCodeAt(0), num: Number(groupMatch[2]) };
    }

    if (!Number.isNaN(Number(str))) {
      return { type: "ko", group: 999, num: Number(str) };
    }

    return { type: "other", group: 9999, num: 9999 };
  };

  const parsedA = parseMatchNumber(a);
  const parsedB = parseMatchNumber(b);

  if (parsedA.group !== parsedB.group) return parsedA.group - parsedB.group;
  return parsedA.num - parsedB.num;
}

export function sortMatchesByMatchNumber(matches) {
  return [...matches].sort((a, b) => compareMatchNumbers(a.matchNumber, b.matchNumber));
}

export function groupMatchesByRound(matches) {
  const roundMap = new Map();

  for (const match of matches) {
    const roundKey = String(match.round);
    if (!roundMap.has(roundKey)) roundMap.set(roundKey, []);
    roundMap.get(roundKey).push(match);
  }

  return [...roundMap.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([round, roundMatches]) => ({ round: Number(round), matches: roundMatches }));
}

export function buildGroupTables(matches = [], groups = [], qualifiedPerGroup = 2) {
  const groupMatches = matches.filter((match) => !!match.group);
  const groupNames = [
    ...new Set([
      ...groupMatches.map((match) => match.group).filter(Boolean),
      ...groups.map((group) => group?.name).filter(Boolean),
    ]),
  ];

  return groupNames.map((groupName) => {
    const matchesOfGroup = sortMatchesByMatchNumber(
      groupMatches.filter((match) => match.group === groupName),
    );
    const table = new Map();

    const ensurePlayer = (player) => {
      if (!player || player.type !== "player") return null;
      const key = normalizePlayerKey(player);
      if (!key) return null;

      if (!table.has(key)) {
        table.set(key, {
          key,
          player,
          played: 0,
          wins: 0,
          losses: 0,
          points: 0,
          legsWon: 0,
          legsLost: 0,
          legDiff: 0,
          setsWon: 0,
          setsLost: 0,
          setDiff: 0,
        });
      }

      return table.get(key);
    };

    for (const match of matchesOfGroup) {
      ensurePlayer(match.player1);
      ensurePlayer(match.player2);
      if (match.status !== "finished") continue;
      if (match.player1?.type !== "player" || match.player2?.type !== "player") continue;

      const entry1 = ensurePlayer(match.player1);
      const entry2 = ensurePlayer(match.player2);
      if (!entry1 || !entry2) continue;

      entry1.played += 1;
      entry2.played += 1;

      const score1 = Number(match.scorePlayer1?.legs ?? match.scorePlayer1 ?? 0) || 0;
      const score2 = Number(match.scorePlayer2?.legs ?? match.scorePlayer2 ?? 0) || 0;
      const sets1 = Number(match.scorePlayer1?.sets ?? 0) || 0;
      const sets2 = Number(match.scorePlayer2?.sets ?? 0) || 0;

      entry1.legsWon += score1;
      entry1.legsLost += score2;
      entry2.legsWon += score2;
      entry2.legsLost += score1;
      entry1.setsWon += sets1;
      entry1.setsLost += sets2;
      entry2.setsWon += sets2;
      entry2.setsLost += sets1;

      const winnerKey = String(match.winner?.id || match.winner?.name || "").trim().toLowerCase();
      if (winnerKey && winnerKey === entry1.key) {
        entry1.wins += 1;
        entry1.points += 2;
        entry2.losses += 1;
      } else if (winnerKey && winnerKey === entry2.key) {
        entry2.wins += 1;
        entry2.points += 2;
        entry1.losses += 1;
      }
    }

    const standings = [...table.values()]
      .map((entry) => ({
        ...entry,
        legDiff: entry.legsWon - entry.legsLost,
        setDiff: entry.setsWon - entry.setsLost,
      }))
      .sort((a, b) => {
        const pointsDiff = b.points - a.points;
        if (pointsDiff !== 0) return pointsDiff;
        const winsDiff = b.wins - a.wins;
        if (winsDiff !== 0) return winsDiff;
        const legDiff = b.legDiff - a.legDiff;
        if (legDiff !== 0) return legDiff;
        const legsWonDiff = b.legsWon - a.legsWon;
        if (legsWonDiff !== 0) return legsWonDiff;
        const setDiff = b.setDiff - a.setDiff;
        if (setDiff !== 0) return setDiff;
        return String(a.player?.name || "").localeCompare(String(b.player?.name || ""), "de", {
          sensitivity: "base",
        });
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        isQualified: index < qualifiedPerGroup,
      }));

    const finishedMatches = matchesOfGroup.filter((match) => match.status === "finished").length;

    return {
      name: groupName,
      matches: matchesOfGroup,
      standings,
      totalMatches: matchesOfGroup.length,
      finishedMatches,
      isComplete: matchesOfGroup.length > 0 && finishedMatches === matchesOfGroup.length,
    };
  });
}

export function isTournamentFinished(matches = []) {
  if (!Array.isArray(matches) || matches.length === 0) return false;
  return matches.every((match) => match.status === "finished");
}

export function sortPlayersForFinalTable(players = []) {
  return [...players].sort((a, b) => {
    const pointsDiff = Number(b.points || 0) - Number(a.points || 0);
    if (pointsDiff !== 0) return pointsDiff;
    const winsDiff = Number(b.wins || 0) - Number(a.wins || 0);
    if (winsDiff !== 0) return winsDiff;
    const legsDiffA = Number(a.legsWon || 0) - Number(a.legsLost || 0);
    const legsDiffB = Number(b.legsWon || 0) - Number(b.legsLost || 0);
    if (legsDiffB !== legsDiffA) return legsDiffB - legsDiffA;
    const setsDiffA = Number(a.setsWon || 0) - Number(a.setsLost || 0);
    const setsDiffB = Number(b.setsWon || 0) - Number(b.setsLost || 0);
    if (setsDiffB !== setsDiffA) return setsDiffB - setsDiffA;
    const x01Diff = Number(b.average || 0) - Number(a.average || 0);
    if (x01Diff !== 0) return x01Diff;
    return Number(b.mpr || 0) - Number(a.mpr || 0);
  });
}


export function getMatchPlayerKeys(match) {
  const keys = [];
  for (const slot of ["player1", "player2"]) {
    const player = match?.[slot];
    if (!player || player.type !== "player") continue;
    const key = normalizePlayerKey(player);
    if (key) keys.push(key);
  }
  return keys;
}

export function buildSmartMatchQueue(matches = [], limit = 6) {
  const pendingMatches = sortMatchesByMatchNumber(
    matches.filter((match) => match?.status === "pending" && canStartMatch(match)),
  );

  if (!pendingMatches.length || limit <= 0) return [];

  const queue = [];
  const usedPlayers = new Set();
  const usedGroups = new Set();

  for (const match of pendingMatches) {
    const playerKeys = getMatchPlayerKeys(match);
    const groupKey = String(match?.group || match?.displayRoundName || "ohne-gruppe");

    const hasPlayerConflict = playerKeys.some((key) => usedPlayers.has(key));
    const hasGroupConflict = usedGroups.has(groupKey);

    if (hasPlayerConflict || hasGroupConflict) continue;

    queue.push(match);
    playerKeys.forEach((key) => usedPlayers.add(key));
    usedGroups.add(groupKey);

    if (queue.length >= limit) return queue;
  }

  for (const match of pendingMatches) {
    if (queue.includes(match)) continue;

    const playerKeys = getMatchPlayerKeys(match);
    const hasPlayerConflict = playerKeys.some((key) => usedPlayers.has(key));

    if (hasPlayerConflict) continue;

    queue.push(match);
    playerKeys.forEach((key) => usedPlayers.add(key));

    if (queue.length >= limit) return queue;
  }

  for (const match of pendingMatches) {
    if (queue.includes(match)) continue;
    queue.push(match);
    if (queue.length >= limit) break;
  }

  return queue;
}

export function validateTournamentDataConsistency(matches = [], players = []) {
  const errors = [];
  const warnings = [];
  const playerKeys = new Set(
    players
      .map((player) => normalizePlayerKey(player))
      .filter(Boolean),
  );
  const matchNumberSet = new Set();

  for (const match of matches) {
    const label = `Spiel ${match?.matchNumber ?? match?.id ?? "?"}`;
    const roundNumber = Number(match?.round);

    if (!Number.isFinite(roundNumber)) {
      errors.push(`${label}: ungültige Runde ${String(match?.round)}`);
    }

    const matchNumberKey = String(match?.matchNumber || "").trim();
    if (!matchNumberKey) {
      errors.push(`${label}: fehlende Match-Nummer`);
    } else if (matchNumberSet.has(matchNumberKey)) {
      errors.push(`${label}: doppelte Match-Nummer ${matchNumberKey}`);
    } else {
      matchNumberSet.add(matchNumberKey);
    }

    for (const slot of ["player1", "player2", "winner", "loser"]) {
      const player = match?.[slot];
      if (!player || player.type !== "player") continue;
      const key = normalizePlayerKey(player);
      if (!key) {
        errors.push(`${label}: ${slot} ohne id/name`);
        continue;
      }
      if (playerKeys.size && !playerKeys.has(key)) {
        warnings.push(`${label}: ${slot} ${player.name || player.id} fehlt in players-Collection`);
      }
    }

    if (match?.status === "finished") {
      if (!match?.winner || !match?.loser) {
        errors.push(`${label}: finished ohne winner/loser`);
      }
      if (match?.finishedAt == null) {
        warnings.push(`${label}: finished ohne finishedAt`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function canStartMatch(match) {
  if (!match || match.status !== "pending") return false;
  return isRealPlayer(match.player1) && isRealPlayer(match.player2);
}

export function isLiveMatch(match) {
  return !!match && ["started", "live", "running"].includes(match.status);
}

export function canGiveUp(match) {
  if (!match || match.status === "finished" || isLiveMatch(match)) return false;
  return isRealPlayer(match.player1) && isRealPlayer(match.player2);
}

export function canEditResult(match) {
  if (!match || !["finished", "aborted"].includes(match.status)) return false;
  return isRealPlayer(match.player1) && isRealPlayer(match.player2);
}

export function canRestartMatch(match) {
  if (!match || !["finished", "aborted"].includes(match.status)) return false;
  return isRealPlayer(match.player1) && isRealPlayer(match.player2);
}

export function isDoubleByeMatch(match) {
  return match?.player1?.type === "bye" && match?.player2?.type === "bye";
}

export function getStatusLabel(matchOrStatus) {
  if (typeof matchOrStatus === "object" && isDoubleByeMatch(matchOrStatus)) {
    return "Freilose";
  }

  const status = typeof matchOrStatus === "string" ? matchOrStatus : matchOrStatus?.status;
  if (status === "finished") return "Fertig";
  if (status === "aborted") return "Abgebrochen";
  if (status === "started" || status === "live" || status === "running") return "Live";
  if (status === "pending") return "Offen";
  return status || "Unbekannt";
}

export function getMatchResultLabel(match) {
  if (!match) return "Ergebnis";
  if (isDoubleByeMatch(match)) return "Freilose";

  if (match?.status === "finished") {
    if (typeof match?.winnerPlace === "number" && match?.winner?.type === "player") {
      return `Platz ${match.winnerPlace}`;
    }
    if (match?.winner?.type === "player") return "Sieger";
  }

  return "Sieger";
}

export function getStatusClass(status) {
  if (status === "finished") return "status-finished";
  if (status === "aborted") return "status-default";
  if (status === "started" || status === "live" || status === "running") return "status-live";
  if (status === "pending") return "status-pending";
  return "status-default";
}

export function buildFinalPlacements(matches = [], players = []) {
  const placements = new Map();

  for (const match of matches) {
    if (match?.status !== "finished") continue;

    if (typeof match?.winnerPlace === "number" && match?.winner?.type === "player" && match?.winner?.name) {
      placements.set(String(match.winner.name).trim().toLowerCase(), match.winnerPlace);
    }

    if (typeof match?.loserPlace === "number" && match?.loser?.type === "player" && match?.loser?.name) {
      placements.set(String(match.loser.name).trim().toLowerCase(), match.loserPlace);
    }
  }

  const sortedByStats = sortPlayersForFinalTable(players);
  const statsOrderMap = new Map(
    sortedByStats.map((player, index) => [String(player.name || "").trim().toLowerCase(), index]),
  );

  return [...players]
    .map((player) => ({
      ...player,
      finalPlace: placements.get(String(player.name || "").trim().toLowerCase()) ?? null,
    }))
    .sort((a, b) => {
      const aPlaced = typeof a.finalPlace === "number";
      const bPlaced = typeof b.finalPlace === "number";
      if (aPlaced && bPlaced) return a.finalPlace - b.finalPlace;
      if (aPlaced) return -1;
      if (bPlaced) return 1;

      const aOrder = statsOrderMap.get(String(a.name || "").trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = statsOrderMap.get(String(b.name || "").trim().toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
}

function isRealPlayer(player) {
  return player && typeof player === "object" && player.type === "player";
}

export function isCricketSettings(settings = {}) {
  return extractMatchSettings(settings).tournamentType === "Cricket";
}
