import {
  MAX_RECENT_TOURNAMENTS,
  RECENT_TOURNAMENTS_STORAGE_KEY,
} from "../../TournamentAppShared.js";

export function readRecentTournamentIds() {
  try {
    const raw = localStorage.getItem(RECENT_TOURNAMENTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((value) => String(value || "").trim()).filter(Boolean);
  } catch (error) {
    console.warn("Recent tournaments could not be read from localStorage.", error);
    return [];
  }
}

export function writeRecentTournamentIds(ids = []) {
  try {
    const normalized = [
      ...new Set((Array.isArray(ids) ? ids : []).map((value) => String(value || "").trim()).filter(Boolean)),
    ].slice(0, MAX_RECENT_TOURNAMENTS);

    localStorage.setItem(RECENT_TOURNAMENTS_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    console.warn("Recent tournaments could not be written to localStorage.", error);
    return [];
  }
}

export function rememberRecentTournament(tournamentId) {
  const normalizedId = String(tournamentId || "").trim();
  if (!normalizedId) return [];

  const currentIds = readRecentTournamentIds().filter((id) => id !== normalizedId);
  return writeRecentTournamentIds([normalizedId, ...currentIds]);
}

export function removeRecentTournament(tournamentId) {
  const normalizedId = String(tournamentId || "").trim();
  if (!normalizedId) return readRecentTournamentIds();

  const nextIds = readRecentTournamentIds().filter((id) => id !== normalizedId);
  return writeRecentTournamentIds(nextIds);
}
