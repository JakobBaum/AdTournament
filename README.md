# Dart Cup

A Chrome extension that adds a full tournament manager to [play.autodarts.io](https://play.autodarts.io).

## Features

- **Three tournament formats** — KO (single elimination), League (round-robin), Group-KO (group stage + KO bracket)
- **Live match integration** — creates AutoDarts game lobbies, polls for live scores, and automatically applies results to the bracket
- **Automatic bracket propagation** — winners advance, byes are resolved, group qualifiers fill KO slots — all without manual intervention
- **Player statistics** — tracks average, checkout %, best checkout, 60+/100+/140+/180 scores (X01) and MPR / marks per number (Cricket)
- **Multi-device sync** — all tournament state lives in Firebase Firestore and updates in real time across every connected device
- **Watcher-claim system** — prevents two browser tabs from polling the same live match simultaneously

## Installation

1. Clone this repo and run `npm install`
2. Run `npm run build` — this produces the extension bundles in `dist/`
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the repo root
4. Navigate to [play.autodarts.io](https://play.autodarts.io) — the **Dart Cup** button appears in the top navigation

> **Rebuild required** after every code change. Reload the extension in Chrome after rebuilding.

## Development

```bash
# Install dependencies
npm install

# Build extension bundles → dist/
npm run build

# Run all tests (unit + Firestore integration)
npm test
```

## Authentication

AutoDarts does not provide a public extension API. The extension captures the AutoDarts OAuth token by intercepting `fetch` and `XMLHttpRequest` calls to the Keycloak login endpoint (`src/injected.js`). The token is stored in both `localStorage` and `chrome.storage.local` and refreshed automatically when the AutoDarts SPA silently renews it.

## Project Structure

| Path | Purpose |
|------|---------|
| `src/injected.js` | Page-context script — captures OAuth tokens |
| `src/content-entry.jsx` | Content script — injects the UI, persists tokens |
| `src/TournamentApp.jsx` | Main React component |
| `src/TournamentDB.js` | All Firestore operations |
| `src/Logik.js` | Tournament bracket generation |
| `src/AutodartsApi.js` | AutoDarts HTTP client |
| `src/matchLifecycle.js` | Live match polling loop |
| `src/clientSession.js` | Per-tab unique client ID |
| `tests/` | Node.js test suite |

## Firebase

All tournament data is stored in the `autodarts-tournament` Firebase project. No security rules are enforced — open read/write for all clients. See [CLAUDE.md](CLAUDE.md) for the full configuration.

## Known Limitations

- Chrome only (Manifest V3)
- Requires physical AutoDarts dart boards registered to the logged-in account
- No offline support — all state is fetched from / written to Firestore in real time
- Token capture may break if AutoDarts changes its authentication flow
