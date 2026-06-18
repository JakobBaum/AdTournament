// Shared numeric constants used across the app.
// Named constants here prevent magic numbers from scattering through the codebase.

/** Firestore transaction retry backoff: `min(BASE_RETRY_BACKOFF_MS * attempt, MAX_RETRY_BACKOFF_MS)` */
export const BASE_RETRY_BACKOFF_MS = 250;
export const MAX_RETRY_BACKOFF_MS  = 1000;

/** Maximum Firestore transaction retry attempts before giving up. */
export const MAX_TRANSACTION_RETRIES = 4;

/** Match watcher heartbeat interval (ms). */
export const WATCHER_HEARTBEAT_INTERVAL_MS = 4000;

/** Match watcher claim considered stale after this many ms without a heartbeat. */
export const WATCHER_CLAIM_STALE_MS = 15000;

/** Maximum wall-clock time a match poller will run before giving up (4 hours). */
export const MATCH_POLL_MAX_DURATION_MS = 1000 * 60 * 60 * 4;

/** Poll interval for checking match stats from the AutoDarts API. */
export const MATCH_POLL_INTERVAL_MS = WATCHER_HEARTBEAT_INTERVAL_MS;

/** Token expiry safety buffer (seconds) — treat token as expired this many seconds early. */
export const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

/** Time to wait for a silent SPA token refresh before reloading (ms). */
export const TOKEN_REFRESH_WAIT_MS = 10000;

/** Interval for polling storage during token refresh wait (ms). */
export const TOKEN_REFRESH_POLL_INTERVAL_MS = 500;
