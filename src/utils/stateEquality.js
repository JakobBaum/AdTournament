export function createFingerprint(item, fields = []) {
  if (!item || typeof item !== "object") return String(item ?? "");

  return fields
    .map((field) => `${field}:${JSON.stringify(item?.[field] ?? null)}`)
    .join("|");
}

export function areCollectionsEquivalent(prev = [], next = [], fields = ["id", "updatedAt"]) {
  if (prev === next) return true;
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;

  for (let index = 0; index < prev.length; index += 1) {
    if (createFingerprint(prev[index], fields) !== createFingerprint(next[index], fields)) {
      return false;
    }
  }

  return true;
}

export function replaceCollectionIfChanged(prev = [], next = [], fields = ["id", "updatedAt"]) {
  return areCollectionsEquivalent(prev, next, fields) ? prev : next;
}
