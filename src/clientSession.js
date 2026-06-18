const CLIENT_ID_STORAGE_KEY = "adTournamentClientId";

// Cached in memory so repeated calls within the same tab are free
let _clientId = null;

function createRandomId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Each browser tab gets a distinct ID stored in sessionStorage.
// sessionStorage is isolated per tab so two tabs on the same origin
// will never share a clientId, which prevents the watcher-claim system
// from treating them as the same client.
export function getClientId() {
  if (_clientId) return _clientId;

  try {
    let id = sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!id) {
      id = createRandomId();
      sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
    }
    _clientId = id;
    return id;
  } catch {
    _clientId = createRandomId();
    return _clientId;
  }
}

export function nowIsoString() {
  return new Date().toISOString();
}
