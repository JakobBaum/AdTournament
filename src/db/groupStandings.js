import { extractScoreSummary } from "../utils/statsHelpers.js";

/**
 * Builds a sorted standings table for a single group from a flat list of matches.
 * Pure function — no Firebase dependencies.
 *
 * Returns an array sorted by: points → wins → leg diff → legs won → set diff → name.
 * Each entry is annotated with `rank` (1-based) and `isQualified`.
 */
export function buildGroupStandings(matches = [], groupName, qualifiedPerGroup = 2) {
  const groupMatches = matches.filter((m) => m?.group === groupName);
  const table = new Map();

  const ensurePlayer = (player) => {
    if (!player || player.type !== "player") return null;

    const key = String(player.id || player.name || "").trim().toLowerCase();
    if (!key) return null;

    if (!table.has(key)) {
      table.set(key, {
        key,
        player: {
          type: "player",
          id: player.id || null,
          name: player.name || "—",
          groupId: player.groupId || null,
        },
        played: 0, wins: 0, losses: 0, points: 0,
        legsWon: 0, legsLost: 0, legDiff: 0,
        setsWon: 0, setsLost: 0, setDiff: 0,
      });
    }

    return table.get(key);
  };

  for (const match of groupMatches) {
    ensurePlayer(match?.player1);
    ensurePlayer(match?.player2);

    if (match?.status !== "finished") continue;
    if (match?.player1?.type !== "player" || match?.player2?.type !== "player") continue;

    const e1 = ensurePlayer(match.player1);
    const e2 = ensurePlayer(match.player2);
    if (!e1 || !e2) continue;

    e1.played += 1;
    e2.played += 1;

    const s1 = extractScoreSummary(match.scorePlayer1);
    const s2 = extractScoreSummary(match.scorePlayer2);

    e1.legsWon  += s1.legs; e1.legsLost += s2.legs;
    e2.legsWon  += s2.legs; e2.legsLost += s1.legs;
    e1.setsWon  += s1.sets; e1.setsLost += s2.sets;
    e2.setsWon  += s2.sets; e2.setsLost += s1.sets;

    const winnerKey = String(match?.winner?.id || match?.winner?.name || "").trim().toLowerCase();
    if (winnerKey && winnerKey === e1.key)      { e1.wins += 1; e1.points += 2; e2.losses += 1; }
    else if (winnerKey && winnerKey === e2.key) { e2.wins += 1; e2.points += 2; e1.losses += 1; }
  }

  const standings = [...table.values()].map((e) => ({
    ...e,
    legDiff: e.legsWon - e.legsLost,
    setDiff: e.setsWon - e.setsLost,
  }));

  standings.sort((a, b) => {
    const byPoints  = Number(b.points || 0) - Number(a.points || 0);    if (byPoints  !== 0) return byPoints;
    const byWins    = Number(b.wins   || 0) - Number(a.wins   || 0);    if (byWins    !== 0) return byWins;
    const byLegDiff = Number(b.legDiff|| 0) - Number(a.legDiff|| 0);    if (byLegDiff !== 0) return byLegDiff;
    const byLegs    = Number(b.legsWon|| 0) - Number(a.legsWon|| 0);    if (byLegs    !== 0) return byLegs;
    const bySetDiff = Number(b.setDiff|| 0) - Number(a.setDiff|| 0);    if (bySetDiff !== 0) return bySetDiff;
    return String(a.player?.name || "").localeCompare(String(b.player?.name || ""), "de", { sensitivity: "base" });
  });

  return standings.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    isQualified: index < qualifiedPerGroup,
  }));
}
