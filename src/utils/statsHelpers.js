/**
 * Pure helper functions for normalising and inspecting player stats objects.
 * No Firebase or class dependencies — safe to use anywhere.
 */

export function normalizePlayerStats(stats = {}) {
  return {
    average:            Number(stats?.average || 0),
    checkoutsHit:       Number(stats?.checkoutsHit ?? 0),
    checkoutsAttempted: Number(stats?.checkouts ?? 0),
    plus60:             Number(stats?.plus60 || 0),
    plus100:            Number(stats?.plus100 || 0),
    plus140:            Number(stats?.plus140 || 0),
    plus170:            Number(stats?.plus170 || 0),
    total180:           Number(stats?.total180 || 0),
    checkoutPoints:     Number(stats?.checkoutPoints || 0),
    mpr:                Number(stats?.mpr || 0),
    first9MPR:          Number(stats?.first9MPR || stats?.first9Mpr || 0),
    mark5:              Number(stats?.mark5 || 0),
    mark6:              Number(stats?.mark6 || 0),
    mark7:              Number(stats?.mark7 || 0),
    mark8:              Number(stats?.mark8 || 0),
    mark9:              Number(stats?.mark9 || 0),
    whiteHorse:         Number(stats?.whiteHorse || 0),
    dartsThrown:        Number(stats?.dartsThrown || stats?.thrownDarts || stats?.totalDarts || 0),
  };
}

export function hasPlayerThrownDarts(stats = {}) {
  return [stats?.dartsThrown, stats?.thrownDarts, stats?.totalDarts, stats?.darts, stats?.throws]
    .some((v) => Number(v || 0) > 0);
}

export function isCricketStats(stats = {}) {
  return [
    stats?.mpr, stats?.first9MPR, stats?.first9Mpr,
    stats?.mark5, stats?.mark6, stats?.mark7, stats?.mark8, stats?.mark9, stats?.whiteHorse,
  ].some((v) => Number(v || 0) > 0);
}

export function extractScoreSummary(score) {
  if (score == null) return { legs: 0, sets: 0 };

  if (typeof score === "object") {
    return { legs: Number(score?.legs || 0), sets: Number(score?.sets || 0) };
  }

  const n = Number(score);
  return { legs: Number.isFinite(n) ? n : 0, sets: 0 };
}
