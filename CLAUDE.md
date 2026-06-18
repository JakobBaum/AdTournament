# Dart Cup — CLAUDE.md

## Project Overview

**Dart Cup** is a Chrome extension that adds a tournament manager to [play.autodarts.io](https://play.autodarts.io). It lets organizers create and run KO, League, and Group-KO dart tournaments, watch live matches on AutoDarts boards in real time, and track detailed player statistics — all integrated directly into the AutoDarts web UI.

There is no official AutoDarts API with an authentication endpoint usable by third-party apps. The extension therefore intercepts OAuth tokens from the AutoDarts login flow using JavaScript-level fetch/XHR patching (`src/injected.js`) and uses those tokens to call AutoDarts API endpoints directly.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, Framer Motion 12 |
| Database | Firebase Firestore (`firebase@12`) |
| Build | esbuild 0.28 |
| Tests | Node.js built-in test runner (`node:test`) |
| Extension | Chrome Manifest V3 |
| Language | JavaScript/JSX (no TypeScript, except two `.tsx` enhancement files) |

---

## Repository Structure

```
manifest.json               Chrome extension manifest (MV3)
src/
  injected.js               Page-context script: intercepts fetch/XHR to capture OAuth tokens
  content-entry.jsx         Content script: injects the extension UI, persists tokens
  tournament-entry.jsx      React root: mounts the tournament app lazily
  TournamentApp.jsx         Main React component, state management
  TournamentDB.js           All Firestore reads/writes; watcher-claim system
  Logik.js                  Tournament bracket/round-robin generation algorithms
  AutodartsApi.js           HTTP client for AutoDarts API (boards, lobbies, match stats)
  matchLifecycle.js         Polling loop that watches a live match until it finishes
  matchStats.js             Extracts and normalises player stats from AutoDarts responses
  clientSession.js          Per-tab unique client ID (used for watcher claims in Firestore)
  TournamentAppShared.js    Shared constants: match settings, tournament type options
  tournamentSettings.js     Settings serialisation / deserialisation
  toast.js                  Toast notification helpers
  build.cjs                 esbuild build script → dist/
  tournament/               UI sub-components
    screens/HomeScreen.jsx          Tournament creation & joining
    screens/TournamentScreen.jsx    Active tournament view
    components/TournamentPanels.jsx Panel layouts
    dialogs/TournamentDialogs.jsx   Modal dialogs (settings, result editing, board selection)
  utils/stateEquality.js    Efficient React state comparison helpers
  enhancements/             Experimental TypeScript enhancements (leaderboard, stats page)
tests/
  group-schedule.test.mjs         Round-robin scheduling & KO bracket tests
  matchLifecycle-and-db.test.mjs  Firestore integration tests (uses real DB)
  regression.test.mjs             Regression suite
  stateEquality.test.mjs          State comparison unit tests
  tournamentSettings.test.mjs     Settings serialisation unit tests
dist/                       Built extension bundles (generated, do not edit)
```

---

## Build & Development

### Install dependencies
```
npm install
```

### Build extension bundles
```
npm run build
```
Outputs to `dist/`. Five bundles are created: `content.bundle.js`, `tournament-app.bundle.js`, `TournamentDB.bundle.js`, `Logik.bundle.js`, `AutodartsApi.bundle.js`.

### Load the extension in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the repo root (the folder containing `manifest.json`)
4. Reload after each `npm run build`

### Run tests
```
npm test
```
Uses the Node.js built-in test runner. Integration tests in `matchLifecycle-and-db.test.mjs` connect to the real Firestore project (no emulator needed — the DB has open read/write rules).

---

## Firebase Database

The extension uses a single Firestore project. Security rules are open (no auth required to read/write) — tests can connect directly.

```js
// src/TournamentDB.js
const firebaseConfig = {
  apiKey:            "AIzaSyB_e86-PXQcucrkEN1x5zCfJA7f3QhNqZs",
  authDomain:        "autodarts-tournament.firebaseapp.com",
  projectId:         "autodarts-tournament",
  storageBucket:     "autodarts-tournament.firebasestorage.app",
  messagingSenderId: "955847975035",
  appId:             "1:955847975035:web:43dcf244d2dd15207682de",
};
```

**Firestore console:** https://console.firebase.google.com/project/autodarts-tournament/firestore

### Collection layout
```
tournaments/{tournamentId}
├── players/{playerId}
├── matches/{matchId}
├── boards/{boardDocId}
└── groups/{groupId}
```

---

## Authentication Architecture

AutoDarts uses OpenID Connect (Keycloak). Since there is no public token endpoint for extensions, the token is captured at runtime:

1. `src/injected.js` runs as a page script (not sandboxed). It wraps `window.fetch` and `XMLHttpRequest.prototype.send/setRequestHeader` to intercept responses from the Keycloak token endpoint and extract the `access_token`.
2. It broadcasts the token via `window.postMessage({ type: "AD_TOKEN_UPDATE", token, ... })`.
3. `src/content-entry.jsx` (content script) listens for this message and saves the token to both `localStorage` (key: `AdTournamentExtensionBearerToken`) and `chrome.storage.local` (key: `adTourneyBearerToken`).
4. `src/AutodartsApi.js` reads from `chrome.storage.local` first, falls back to `localStorage`. Before each API call it checks JWT expiry (with a 60-second safety buffer). If the token is expired it waits up to 10 seconds for the AutoDarts SPA to silently refresh it (`waitForValidToken`) before scheduling a page reload.

---

## Multi-Session / Watcher-Claim System

To prevent two browser tabs from watching the same match simultaneously, each match document in Firestore has:
- `watcherClientId` — the ID of the tab currently watching
- `watcherHeartbeatAt` — timestamp updated every ~4 seconds by the active watcher

The client ID comes from `src/clientSession.js`. It is stored in `sessionStorage` (per-tab isolation) so that each open tab gets a unique ID. If two tabs both try to claim a match, only one wins; the other backs off until the claim goes stale (> 15 s without a heartbeat).

---

## Known Constraints

- **No official API:** Token capture via JavaScript injection is the only available auth method. Any change to how AutoDarts handles logins may break token capture.
- **Chrome only:** The extension uses Chrome APIs (`chrome.storage`, `chrome.scripting`). It will not run in Firefox or Safari without porting.
- **No TypeScript:** The main codebase is plain JS/JSX. The `src/enhancements/` directory contains experimental `.ts/.tsx` files but they are not part of the main build.
- **Real Firestore in tests:** Integration tests hit the live database. Use a dedicated test tournament ID and clean up after tests.
