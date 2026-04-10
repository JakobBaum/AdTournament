import React from "react";
import { createRoot } from "react-dom/client";
import TournamentApp from "./TournamentApp";

let root = null;

// 🔥 CSS sauber laden
function injectCSS() {
  if (document.getElementById("adtournament-style")) return;

  const link = document.createElement("link");
  link.id = "adtournament-style";
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("tournament.css");

  document.head.appendChild(link);
}

// 🔥 React App mounten
function mountTournamentApp() {
  const container = document.getElementById("adtournament-root");
  if (!container) {
    console.warn("❌ adtournament-root nicht gefunden");
    return;
  }

  // CSS laden
  injectCSS();

  // React root nur einmal erstellen
  if (!root) {
    root = createRoot(container);
  }

  // rendern
  root.render(<TournamentApp />);
}

// 🔥 Event Listener (wird von content.js ausgelöst)
window.addEventListener("adtournament:open", mountTournamentApp);