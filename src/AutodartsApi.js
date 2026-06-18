import toast from "./toast";

const TOKEN_STORAGE_KEY = "AdTournamentExtensionBearerToken";
const TOKEN_SAVED_AT_KEY = "AdTournamentExtensionBearerTokenSavedAT";

const API_BASE = "https://api.autodarts.io";
const ENDPOINTS = {
  boards: `${API_BASE}/bs/v0/boards`,
  lobbies: `${API_BASE}/gs/v0/lobbies`,
  lobbyPlayers: (lobbyId) => `${API_BASE}/gs/v0/lobbies/${lobbyId}/players`,
  lobbyStart: (lobbyId) => `${API_BASE}/gs/v0/lobbies/${lobbyId}/start`,
  gameFinish: (gameId) => `${API_BASE}/gs/v0/matches/${gameId}/finish`,
  matchStats: (matchId) => `${API_BASE}/as/v0/matches/${matchId}/stats`,
};

function readPageLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function chromeStorageGet(keys) {
  return new Promise((resolve) => {
    try {
      if (!chrome?.storage?.local) {
        resolve({});
        return;
      }

      chrome.storage.local.get(keys, (result) => {
        resolve(result || {});
      });
    } catch {
      resolve({});
    }
  });
}

export class AutodartsApi {
  decodeJwt(token) {
    try {
      if (!token || typeof token !== "string") return null;

      const parts = token.split(".");
      if (parts.length < 2) return null;

      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padding = "=".repeat((4 - (base64.length % 4)) % 4);
      const decoded = atob(base64 + padding);

      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  isTokenValid(token) {
    const payload = this.decodeJwt(token);

    if (!payload) {
      return {
        valid: false,
        reason: "TOKEN_INVALID",
      };
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const safetyBufferSeconds = 60;

    if (!payload.exp || Number(payload.exp) <= nowInSeconds + safetyBufferSeconds) {
      return {
        valid: false,
        reason: "TOKEN_EXPIRED",
      };
    }

    return {
      valid: true,
      payload,
    };
  }

  createReloadRequiredError(
    message = "Dein Autodarts-Login ist abgelaufen. Bitte lade die Seite neu."
  ) {
    const error = new Error(message);
    error.code = "TOKEN_REFRESH_REQUIRED";
    return error;
  }

  showReloadAlert(message = "Dein Login ist nicht mehr gültig\nBitte lade die Seite neu") {
    if (window.__adTourneyReloadAlertShown) return;

    window.__adTourneyReloadAlertShown = true;
    toast.error(message, { id: "ad-reload-alert" });
  }


  scheduleReload(message = "Dein Login ist abgelaufen. Die Seite wird neu geladen.") {
    try {
      if (window.__adTourneyReloadScheduled) return;
      window.__adTourneyReloadScheduled = true;
      this.showReloadAlert(message);
      window.sessionStorage.setItem('adTournamentTokenReloadPending', '1');
      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch {
      // ignore
    }
  }

  async getBearerToken() {
    const storageValues = await chromeStorageGet([
      TOKEN_STORAGE_KEY,
      TOKEN_SAVED_AT_KEY,
    ]);

    const chromeToken = storageValues[TOKEN_STORAGE_KEY];
    if (chromeToken) return chromeToken;

    return readPageLocalStorage(TOKEN_STORAGE_KEY);
  }

  // Polls for a valid token every 500 ms for up to timeoutMs.
  // The AutoDarts SPA silently refreshes tokens; injected.js persists the
  // new token to storage shortly after expiry. This gives the SPA time to
  // refresh before we give up and trigger a disruptive page reload.
  async waitForValidToken(timeoutMs = 10000) {
    const interval = 500;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));
      const t = await this.getBearerToken();
      if (t && this.isTokenValid(t).valid) return t;
    }
    return null;
  }

  async ensureValidToken() {
    const token = await this.getBearerToken();

    if (token && this.isTokenValid(token).valid) {
      return token;
    }

    // Token is missing or expired — give the SPA time to silently refresh it
    const refreshed = await this.waitForValidToken(10000);
    if (refreshed) return refreshed;

    this.scheduleReload("Dein Login ist abgelaufen. Die Seite wird neu geladen.");
    throw this.createReloadRequiredError(
      "Dein Bearer Token ist abgelaufen oder fehlt. Bitte lade die Seite neu."
    );
  }

  async getAuthHeaders(extraHeaders = {}) {
    const token = await this.ensureValidToken();

    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...extraHeaders,
    };
  }

  async parseResponse(response) {
    const text = await response.text().catch(() => "");

    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async request(url, options = {}) {
    const headers = await this.getAuthHeaders(options.headers || {});

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const body = await this.parseResponse(response);

    if (!response.ok) {
      const errorText =
        typeof body === "string" ? body : JSON.stringify(body || {});
      const normalizedErrorText = String(errorText || "").toLowerCase();

      if (response.status === 401) {
        // Wait for the SPA to silently refresh the token before reloading
        const refreshed = await this.waitForValidToken(8000);
        if (!refreshed) {
          this.scheduleReload("Dein Login ist nicht mehr gültig. Die Seite wird neu geladen.");
        }
        throw this.createReloadRequiredError(
          "Autodarts hat den Token abgelehnt. Bitte lade die Seite neu."
        );
      }

      const error = new Error(
        `Autodarts API Fehler (${response.status}): ${errorText}`.trim()
      );
      error.status = response.status;
      error.body = body;
      console.log(error);

      throw error;
    }

    return body;
  }

  async getBoards() {
    const data = await this.request(ENDPOINTS.boards, { method: "GET" });
    return Array.isArray(data) ? data : [];
  }

  async createLobby(config = {}) {
    const tournamentType = config.tournamentType === "Cricket" ? "Cricket" : "X01";
    const matchMode = config.sets ? "Sets" : "Legs";

    const body = {
      variant: tournamentType,
      settings:
        tournamentType === "Cricket"
          ? {
              gameMode: config.cricketGameMode ?? "Cricket",
              scoringMode: config.scoringMode ?? "Standard",
              maxRounds: config.maxRounds ?? 50,
            }
          : {
              baseScore: config.baseScore ?? 501,
              inMode: config.inMode ?? "Straight",
              outMode: config.outMode ?? "Double",
              bullMode: config.bullMode ?? "25/50",
              maxRounds: config.maxRounds ?? 50,
            },
      bullOffMode: config.bullOffMode ?? (tournamentType === "Cricket" ? "Off" : "Off"),
      isPrivate: true,
      legs: config.legs ?? 1,
    };

    if (matchMode === "Sets" && config.sets) {
      body.sets = config.sets;
    }

    return this.request(ENDPOINTS.lobbies, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  async addPlayerToLobby(lobbyId, { name, boardId } = {}) {
    if (!lobbyId) {
      throw new Error("lobbyId fehlt");
    }

    if (!name) {
      throw new Error("player name fehlt");
    }

    const body = {
      name,
    };

    if (boardId) {
      body.boardId = boardId;
    }

    return this.request(ENDPOINTS.lobbyPlayers(lobbyId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  async startLobby(lobbyId) {
    if (!lobbyId) {
      throw new Error("lobbyId fehlt");
    }

    await this.request(ENDPOINTS.lobbyStart(lobbyId), {
      method: "POST",
    });

    return true;
  }

  async finishMatch(gameId) {
    if (!gameId) {
      throw new Error("gameId fehlt");
    }

    await this.request(ENDPOINTS.gameFinish(gameId), {
      method: "POST",
    });

    return true;
  }

  async getMatchStats(matchId) {
    if (!matchId) {
      throw new Error("matchId fehlt");
    }

    try {
      return await this.request(ENDPOINTS.matchStats(matchId), {
        method: "GET",
      });
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();

      if (error?.code === "TOKEN_REFRESH_REQUIRED") {
        throw error;
      }

      if (message.includes("live stats not supported")) {
        const normalizedError = new Error("LIVE_STATS_NOT_SUPPORTED");
        normalizedError.code = "LIVE_STATS_NOT_SUPPORTED";
        throw normalizedError;
      }

      throw error;
    }
  }
}