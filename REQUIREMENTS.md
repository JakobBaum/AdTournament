# Dart Cup — Requirements

## 1. Functional Requirements

### 1.1 Tournament Management

| ID | Requirement |
|----|-------------|
| F-01 | Users can create a tournament with a name and one of three formats: **KO** (single elimination), **League** (full round-robin), **Group-KO** (group stage followed by KO). |
| F-02 | A shareable join **code** is generated for each tournament so other devices can open it. |
| F-03 | Players can be added to a tournament before it starts. In Group-KO mode players are assigned to groups. |
| F-04 | The app generates the full match schedule automatically upon tournament creation (brackets, round-robin pairings, bye slots). |
| F-05 | Byes are distributed optimally in KO brackets so they are spread across the bracket rather than clustered. |
| F-06 | In Group-KO mode the group phase runs as a full round-robin; the top N players from each group advance to the KO bracket automatically when the group is complete. |
| F-07 | Match results can be entered manually (with a score editor) or recorded automatically from a live AutoDarts board. |
| F-08 | A match result can be corrected after the fact; the correction cascades to all dependent matches. |
| F-09 | A match can be reset to pending; all matches that depend on its result are also reset. |
| F-10 | The tournament can display a placement bracket so that every player gets a final ranking, not just the winner. |

### 1.2 Live Match Integration

| ID | Requirement |
|----|-------------|
| F-11 | A match can be started on a selected AutoDarts board by creating a lobby via the AutoDarts API, adding the two players, and opening the match URL. |
| F-12 | Once a match lobby is open, the extension polls the AutoDarts API every ~4 seconds for the current score and final stats. |
| F-13 | Score updates (legs/sets won) are written to Firestore in real time so all connected devices see live progress. |
| F-14 | When the AutoDarts match finishes, the result is automatically applied to the tournament, the match is marked finished, and the winner advances. |
| F-15 | Only one device (browser tab) may watch a given match at a time. If a second tab tries to watch the same match, it backs off. If the active watcher goes silent for > 15 seconds, any tab may reclaim the watch. |
| F-16 | Board availability is tracked in Firestore (`free` / `reserved` / `playing`). A board is released when the match ends or is aborted. |

### 1.3 Player Statistics

| ID | Requirement |
|----|-------------|
| F-17 | For X01 games: average, best checkout, checkout percentage, and counts of scores ≥ 60, ≥ 100, ≥ 140, ≥ 170/180 are tracked per player. |
| F-18 | For Cricket games: mark counts per number (5–9), white horse count, and MPR (marks per round) are tracked. |
| F-19 | Player standings (points, wins, losses, legs/sets won and lost) are recalculated from match results and stored in Firestore. |
| F-20 | A leaderboard view shows player rankings within the current tournament. |

### 1.4 Settings

| ID | Requirement |
|----|-------------|
| F-21 | Default match settings (game variant, base score, in/out mode, legs/sets, bull mode, max rounds) can be configured per tournament. |
| F-22 | Match settings can be overridden per round. |
| F-23 | Settings changes after tournament creation are applied to all **pending** matches; already-started or finished matches are not affected. |

---

## 2. Technical Requirements

### 2.1 Authentication

| ID | Requirement |
|----|-------------|
| T-01 | The extension captures the AutoDarts OAuth `access_token` by intercepting `fetch` and `XMLHttpRequest` calls to the Keycloak token endpoint. This is the only available auth mechanism — there is no public API key. |
| T-02 | The captured token is persisted to both `localStorage` (`AdTournamentExtensionBearerToken`) and `chrome.storage.local` (`adTourneyBearerToken`). |
| T-03 | Before every API call the token is validated locally by checking the JWT `exp` claim with a 60-second safety buffer. |
| T-04 | If the token is expired or missing the extension waits up to 10 seconds for the AutoDarts SPA to silently refresh it before scheduling a page reload. |
| T-05 | A page reload is only triggered as a last resort after the 10-second wait period has elapsed without a valid token appearing. |
| T-06 | Token expiry in one browser tab must not trigger a reload in other tabs. |

### 2.2 Multi-Session Safety

| ID | Requirement |
|----|-------------|
| T-07 | Each browser tab has a unique client ID stored in `sessionStorage` (isolated per tab, survives same-tab refresh). |
| T-08 | The match watcher claim uses the client ID to ensure only one tab polls the AutoDarts API for a given match at a time. |
| T-09 | The watcher claim is held via a Firestore transaction. The heartbeat is refreshed every ~4 seconds; a claim is considered stale after 15 seconds without a heartbeat. |
| T-10 | If the claiming tab reloads or navigates away, the stale claim expires and any other tab can re-claim after 15 seconds. |

### 2.3 Data Consistency

| ID | Requirement |
|----|-------------|
| T-11 | Match result propagation (advancing winner to next match, resetting dependent matches) runs inside Firestore transactions with up to 4 retries on contention errors. |
| T-12 | Board reservation (attaching a board to a match) is atomic: a board may only be reserved by one match at a time. |
| T-13 | Player stats are recalculated from the full set of finished match records each time a match finishes; they are not incrementally updated to avoid drift. |

### 2.4 Build & Deployment

| ID | Requirement |
|----|-------------|
| T-14 | `npm run build` must produce all five bundles in `dist/` without errors. |
| T-15 | `npm test` must pass all unit and integration tests (including Firestore integration tests against the real project). |
| T-16 | The extension targets Chrome Manifest V3 and requires `storage`, `activeTab`, and `scripting` permissions. |

---

## 3. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| N-01 | Real-time Firestore subscriptions (`onSnapshot`) ensure all connected devices see updates within seconds without polling. |
| N-02 | The extension UI must not interfere with the AutoDarts web app's own navigation or styling beyond adding its own overlay panel. |
| N-03 | All Firestore writes that could race (result propagation, board reservation) must use transactions, not plain `updateDoc` calls. |
| N-04 | The extension must handle the case where a board is disconnected or a match is aborted gracefully — releasing the board and leaving the match in a recoverable state. |

---

## 4. Known Limitations

- **No official API:** AutoDarts does not provide a first-party extension API. Token interception may break if AutoDarts changes its authentication flow.
- **Chrome only:** Firefox and Safari are not supported.
- **Single Firebase project:** All tournaments from all users share one Firestore database. There is no multi-tenancy or per-user data isolation enforced by security rules (currently open read/write).
- **Board dependency:** Live match watching requires physical AutoDarts dart boards registered to the same AutoDarts account as the logged-in user.
- **No offline support:** All tournament data is fetched from and written to Firestore in real time. Offline use is not supported.
