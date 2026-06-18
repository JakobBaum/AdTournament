import toast from "./toast.js";
import { getClientId, nowIsoString } from "./clientSession.js";
import { extractFinalPlayerStatsFromAutodartsStats } from "./matchStats.js";
import {
  WATCHER_HEARTBEAT_INTERVAL_MS,
  MATCH_POLL_MAX_DURATION_MS,
} from "./constants.js";

export const activeMatchWatchers = new Set();
export const cancelledMatchWatchers = new Set();

export function handleAutodartsApiError(error, fallbackMessage) {
  console.error(error);

  if (error?.code === "TOKEN_REFRESH_REQUIRED") {
    toast.error("Dein Autodarts-Login ist abgelaufen oder ungültig\nBitte lade die Seite neu");
    return true;
  }

  if (fallbackMessage) {
    toast.error(fallbackMessage);
    return true;
  }

  return false;
}

function normalizeScoreFromStatEntry(score) {
  if (score == null) return null;
  if (typeof score === "object") {
    return {
      legs: Number(score?.legs ?? 0),
      sets: Number(score?.sets ?? 0),
    };
  }

  const numeric = Number(score);
  return Number.isFinite(numeric) ? numeric : null;
}

export function extractMatchResultFromStats(stats, match) {
  const scores = Array.isArray(stats?.scores) ? stats.scores : [];
  const scorePlayer1 = normalizeScoreFromStatEntry(scores[0]);
  const scorePlayer2 = normalizeScoreFromStatEntry(scores[1]);

  const compareScoreValue = (value) => {
    if (value == null) return 0;
    if (typeof value === "object") {
      return Number(value?.sets ?? 0) * 1000 + Number(value?.legs ?? 0);
    }
    return Number(value || 0);
  };

  const player1Wins = compareScoreValue(scorePlayer1) >= compareScoreValue(scorePlayer2);

  return {
    winner: player1Wins ? match?.player1 ?? null : match?.player2 ?? null,
    loser: player1Wins ? match?.player2 ?? null : match?.player1 ?? null,
    scorePlayer1,
    scorePlayer2,
  };
}

export async function watchMatchUntilFinished({
  tournamentId,
  match,
  boardDocId,
  lobbyId,
  intervalMs = WATCHER_HEARTBEAT_INTERVAL_MS,
  timeoutMs  = MATCH_POLL_MAX_DURATION_MS,
  db,
  autodartsApi,
}) {
  if (!tournamentId || !match?.id || !lobbyId || !db || !autodartsApi) return;

  const watcherKey = `${tournamentId}:${match.id}`;

  cancelledMatchWatchers.delete(watcherKey);
  if (activeMatchWatchers.has(watcherKey)) return;

  const clientId = getClientId();
  const claimed = await db.tryClaimMatchWatcher(tournamentId, match.id, clientId);
  if (!claimed) return;

  activeMatchWatchers.add(watcherKey);
  const startedAt = Date.now();

  const stopWatching = async ({ releaseClaim = true } = {}) => {
    activeMatchWatchers.delete(watcherKey);
    cancelledMatchWatchers.delete(watcherKey);

    if (releaseClaim) {
      try {
        await db.releaseMatchWatcher(tournamentId, match.id, clientId);
      } catch (error) {
        console.warn("Match watcher claim konnte nicht freigegeben werden", error);
      }
    }
  };

  const tick = async () => {
    if (cancelledMatchWatchers.has(watcherKey)) {
      await stopWatching();
      return;
    }

    if (Date.now() - startedAt > timeoutMs) {
      console.warn("Match watcher timeout:", lobbyId);
      await stopWatching({ releaseClaim: false });
      return;
    }

    try {
      await db.heartbeatMatchWatcher(tournamentId, match.id, clientId, nowIsoString());

      const latestMatch = await db.getMatchById(tournamentId, match.id);
      if (!latestMatch || latestMatch.status === "finished" || latestMatch.status === "aborted") {
        await stopWatching();
        return;
      }

      const stats = await autodartsApi.getMatchStats(lobbyId);

      if (!stats) {
        setTimeout(tick, intervalMs);
        return;
      }

      const scorePlayer1 = stats?.scores?.[0] ?? null;
      const scorePlayer2 = stats?.scores?.[1] ?? null;

      await db.saveMatchScore(tournamentId, match.id, {
        lobbyId,
        boardId: latestMatch.boardId || match.boardId || null,
        scorePlayer1,
        scorePlayer2,
      });

      if (stats?.finishedAt == null) {
        setTimeout(tick, intervalMs);
        return;
      }

      const result = extractMatchResultFromStats(stats, latestMatch);

      await db.setMatchFinished(tournamentId, match.id, result.winner, result.loser, {
        lobbyId,
        boardId: latestMatch.boardId || match.boardId || null,
        scorePlayer1,
        scorePlayer2,
        finalPlayerStats: extractFinalPlayerStatsFromAutodartsStats(stats),
        finishedAt: stats?.finishedAt || new Date().toISOString(),
        resultSource: "autodarts",
      });

      if (boardDocId) {
        await db.releaseBoard(tournamentId, boardDocId, match.id);
      }

      await stopWatching();
    } catch (error) {
      console.error("watchMatchUntilFinished error", error);

      if (error?.code === "TOKEN_REFRESH_REQUIRED") {
        toast.error("Dein Autodarts-Login ist abgelaufen oder ungültig\nBitte lade die Seite neu");
        await stopWatching({ releaseClaim: false });
        return;
      }

      if (error?.message === "MATCH_WATCHER_CLAIM_LOST") {
        await stopWatching({ releaseClaim: false });
        return;
      }

      setTimeout(tick, intervalMs);
    }
  };

  tick();
}

export { extractFinalPlayerStatsFromAutodartsStats };
