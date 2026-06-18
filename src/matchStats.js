function normalizeNumeric(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pickFirstArray(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate;
    }
  }
  return [];
}

function mapPlayerMeta(stats) {
  const players = pickFirstArray(stats?.players, stats?.match?.players, stats?.data?.players);
  return new Map(
    players.map((player) => [
      String(player?.id || ""),
      {
        id: player?.id || null,
        name: player?.name || null,
      },
    ]),
  );
}

function normalizeEntry(entry, playerMeta = null) {
  const rawStats = entry?.stats || entry || {};
  const playerId = entry?.playerId || entry?.id || playerMeta?.id || null;
  const name = entry?.name || playerMeta?.name || null;

  return {
    id: playerId,
    playerId,
    name,
    stats: {
      average: normalizeNumeric(rawStats?.average),
      checkoutsHit: normalizeNumeric(rawStats?.checkoutsHit),
      checkouts: normalizeNumeric(rawStats?.checkouts ?? rawStats?.checkoutsAttempted),
      plus60: normalizeNumeric(rawStats?.plus60),
      plus100: normalizeNumeric(rawStats?.plus100),
      plus140: normalizeNumeric(rawStats?.plus140),
      plus170: normalizeNumeric(rawStats?.plus170),
      total180: normalizeNumeric(rawStats?.total180),
      checkoutPoints: normalizeNumeric(rawStats?.checkoutPoints),
      mpr: normalizeNumeric(rawStats?.mpr),
      first9MPR: normalizeNumeric(rawStats?.first9MPR ?? rawStats?.first9Mpr),
      mark5: normalizeNumeric(rawStats?.mark5),
      mark6: normalizeNumeric(rawStats?.mark6),
      mark7: normalizeNumeric(rawStats?.mark7),
      mark8: normalizeNumeric(rawStats?.mark8),
      mark9: normalizeNumeric(rawStats?.mark9),
      whiteHorse: normalizeNumeric(rawStats?.whiteHorse),
      dartsThrown: normalizeNumeric(
        rawStats?.dartsThrown ?? rawStats?.thrownDarts ?? rawStats?.totalDarts,
      ),
      legsWon: normalizeNumeric(rawStats?.legsWon),
      setsWon: normalizeNumeric(rawStats?.setsWon),
      score: normalizeNumeric(rawStats?.score),
      first9Score: normalizeNumeric(rawStats?.first9Score),
      checkoutPercent: normalizeNumeric(rawStats?.checkoutPercent),
      checkoutPointsAverage: normalizeNumeric(rawStats?.checkoutPointsAverage),
    },
  };
}

export function extractFinalPlayerStatsFromAutodartsStats(stats) {
  if (!stats) return null;

  const playerById = mapPlayerMeta(stats);

  const matchStatsEntries = pickFirstArray(
    stats?.matchStats,
    stats?.stats?.matchStats,
    stats?.data?.matchStats,
  );

  if (matchStatsEntries.length) {
    return matchStatsEntries.map((entry) => {
      const playerMeta = playerById.get(String(entry?.playerId || entry?.id || "")) || null;
      return normalizeEntry(entry, playerMeta);
    });
  }

  const playerEntries = pickFirstArray(
    stats?.players,
    stats?.stats?.players,
    stats?.data?.players,
  );

  if (playerEntries.length) {
    return playerEntries.map((entry) => {
      const playerMeta = playerById.get(String(entry?.playerId || entry?.id || "")) || null;
      return normalizeEntry(entry, playerMeta);
    });
  }

  return null;
}
