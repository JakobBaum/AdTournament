/**
 * Canonical player identity key used for aggregating stats across matches.
 * Prefers player.id; falls back to player.name. Returns empty string for nullish input.
 */
export function normalizePlayerKey(player) {
  if (!player) return "";
  return String(player.id || player.name || "").trim().toLowerCase();
}

/** Returns true when the player slot represents a real human player. */
export const isRealPlayer = (p) => p != null && typeof p === "object" && p.type === "player";

/** Returns true when the player slot is a bye. */
export const isBye = (p) => p != null && typeof p === "object" && p.type === "bye";
