(function () {
  window.adTourney = window.adTourney || {};

  const TOKEN_ENDPOINT =
    "https://login.autodarts.io/realms/autodarts/protocol/openid-connect/token";

  const LS_KEY = "AdTournamentExtensionBearerTokenSavedAT";
  const LS_USER_ID_KEY = "AdTournamentExtensionCurrentUser";
  const LS_TIME_KEY = "AdTournamentExtensionBearerTokenSavedAT";
  const MAX_AGE_MS = 2 * 60 * 60 * 1000;

  function postToken(token, userId) {
    window.postMessage(
      {
        type: "AD_TOKEN_UPDATE",
        token,
        userId,
        savedAt: Date.now(),
      },
      window.location.origin
    );
  }

  function parseJwtPayload(token) {
    try {
      const parts = token.split(".");
      if (parts.length < 2) return null;

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const json = atob(padded);
      return JSON.parse(json);
    } catch (error) {
      console.error("[Autodarts Tournament] JWT konnte nicht gelesen werden", error);
      return null;
    }
  }

  function extractUserIdFromToken(token) {
    const payload = parseJwtPayload(token);
    if (!payload || typeof payload !== "object") return null;

    return payload.userId || payload.user_id || payload.uid || payload.sub || null;
  }

  function saveToken(token) {
    if (!token || typeof token !== "string") return;

    try {
      if (window.adTourney.myTokenStorage === token) {
        return;
      }

      const userId = extractUserIdFromToken(token);

      window.adTourney.myTokenStorage = token;
      window.adTourney.myUserIdStorage = userId;

      localStorage.setItem(LS_KEY, token);
      localStorage.setItem(LS_TIME_KEY, String(Date.now()));

      if (userId) {
        localStorage.setItem(LS_USER_ID_KEY, userId);
      }

      postToken(token, userId);

      console.log("[Autodarts Tournament] Neuer Token erkannt");
    } catch (error) {
      console.error("[Autodarts Tournament] Token konnte nicht gespeichert werden", error);
    }
  }

  try {
    const savedAt = Number(localStorage.getItem(LS_TIME_KEY) || 0);
    if (savedAt && Date.now() - savedAt > MAX_AGE_MS) {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_USER_ID_KEY);
      localStorage.removeItem(LS_TIME_KEY);
    }
  } catch (_) {}

  try {
    const existingToken = localStorage.getItem(LS_KEY);
    if (existingToken) {
      window.adTourney.myTokenStorage = existingToken;
      window.adTourney.myUserIdStorage = extractUserIdFromToken(existingToken);
    }
  } catch (_) {}

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = args[0] instanceof Request ? args[0].url : String(args[0] || "");

      if (url.includes(TOKEN_ENDPOINT)) {
        response
          .clone()
          .json()
          .then((body) => {
            if (body?.access_token) {
              saveToken(body.access_token);
            }
          })
          .catch(() => {});
      }
    } catch (_) {}

    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      this.__adTourneyUrl = String(url || "");
    } catch (_) {}

    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (
        typeof name === "string" &&
        typeof value === "string" &&
        name.toLowerCase() === "authorization" &&
        value.startsWith("Bearer ")
      ) {
        saveToken(value.slice(7));
      }
    } catch (_) {}

    return originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        const url = String(this.__adTourneyUrl || "");
        if (!url.includes(TOKEN_ENDPOINT)) return;

        const body = JSON.parse(this.responseText || "{}");
        if (body?.access_token) {
          saveToken(body.access_token);
        }
      } catch (_) {}
    });

    return originalSend.apply(this, args);
  };
})();