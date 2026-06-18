const SCORE_OPTIONS = [121, 170, 301, 501, 701, 901];
const MODE_OPTIONS = ["Straight", "Double", "Master"];
const MAX_ROUNDS_OPTIONS = [15, 20, 50, 80];
const BULL_MODE_OPTIONS = ["25/50", "50/50"];
const BULL_OFF_OPTIONS = ["Off", "Normal", "Official"];
const MATCH_MODE_OPTIONS = ["Legs", "Sets"];
const GROUP_SIZE_OPTIONS = [3, 4, 5, 6, 8, 10, 12, 24, 32];
const QUALIFIER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 16, 32];
const LEGS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SETS_OPTIONS = [2, 3, 4, 5, 6, 7];
const LEGS_OF_SET_OPTIONS = [2, 3];
const TOURNAMENT_TYPE_OPTIONS = ["X01", "Cricket"];
const CRICKET_SCORING_OPTIONS = ["Standard", "Cut Throat", "No Score"];
const CRICKET_GAME_MODE_OPTIONS = ["Cricket", "Tactics"];

const DEFAULT_TOURNAMENT_TYPE = "X01";
const DEFAULT_CRICKET_SETTINGS = {
  scoringMode: "Standard",
  maxRounds: 50,
  bullOffMode: "Off",
  matchMode: "Legs",
  legs: 2,
  sets: 3,
  legsOfSet: 3,
};
/*
const DEFAULT_PLAYERS = [
  "Anna",
  "Bernd",
  "Christian",
  "Doris",
  "Erika",
  "Frank",
  "Gabi",
  "Hans",
  "Ingrid",
  "Jürgen",
  "Karin",
  "Lars",
  "Monika",
  "Norbert",
  "Olga",
  "Peter",
  "Petra",
  "Ralf",
  "Sabine",
  "Thomas",
  "Ursula",
  "Volker",
  "Waltraud",
  "Xaver",
  "Yvonne",
  "Zoe",
  "Alexander",
  "Beate",
  "Claus",
  "Diana",
  "Erich",
  "Frieda",
  "Gerhard",
  "Hilde",
  "Igor",
  "Jutta",
  "Karl",
  "Lisa",
  "Manfred",
  "Nina",
  "Otto",
  "Paula",
  "Quirin",
  "Renate",
  "Stefan",
  "Tanja",
  "Uwe",
  "Verena",
  "Wolfgang",
  "Yasin",
];
*/
const DEFAULT_PLAYERS = [
  "Anna",
  "Bernd",
  "Christian",
  "Doris",
  "Erika",
  "Frank",
  "Gabi",
  "Hans",
  "Ingrid",
];
const LAST_TOURNAMENT_STORAGE_KEY = "adTournamentLastTournamentId";
const RECENT_TOURNAMENTS_STORAGE_KEY = "recentTournaments";
const MAX_RECENT_TOURNAMENTS = 10;
const DEFAULT_MATCH_SETTINGS = {
  tournamentType: DEFAULT_TOURNAMENT_TYPE,
  baseScore: 501,
  inMode: "Straight",
  outMode: "Double",
  maxRounds: 50,
  bullMode: "25/50",
  bullOffMode: "Normal",
  matchMode: "Legs",
  legs: 3,
  sets: 3,
  legsOfSet: 3,
  scoringMode: "Standard",
  cricketGameMode: "Cricket",
};
const DEFAULT_TOURNAMENT_FORMAT = {
  groupSize: 4,
  qualifiers: 2,
  playAllPlaces: false,
  groupReturnLegs: false,
  leagueReturnLegs: false,
};

const cx = (...classes) => classes.filter(Boolean).join(" ");

const isRealPlayer = (player) => player && typeof player === "object" && player.type === "player";
const isBye = (player) => player && typeof player === "object" && player.type === "bye";

function extractMatchSettings(settings = {}) {
  const tournamentType = settings?.tournamentType || settings?.variant || DEFAULT_MATCH_SETTINGS.tournamentType;

  return {
    tournamentType,
    baseScore: Number(settings?.baseScore) || DEFAULT_MATCH_SETTINGS.baseScore,
    inMode: settings?.inMode || DEFAULT_MATCH_SETTINGS.inMode,
    outMode: settings?.outMode || DEFAULT_MATCH_SETTINGS.outMode,
    maxRounds: Number(settings?.maxRounds) || DEFAULT_MATCH_SETTINGS.maxRounds,
    bullMode: settings?.bullMode || DEFAULT_MATCH_SETTINGS.bullMode,
    bullOffMode: settings?.bullOffMode || DEFAULT_MATCH_SETTINGS.bullOffMode,
    matchMode: settings?.matchMode || DEFAULT_MATCH_SETTINGS.matchMode,
    legs: Number(settings?.legs) || DEFAULT_MATCH_SETTINGS.legs,
    sets: Number(settings?.sets) || DEFAULT_MATCH_SETTINGS.sets,
    legsOfSet: Number(settings?.legsOfSet) || DEFAULT_MATCH_SETTINGS.legsOfSet,
    scoringMode: settings?.scoringMode || DEFAULT_MATCH_SETTINGS.scoringMode,
    cricketGameMode:
      settings?.cricketGameMode ||
      DEFAULT_MATCH_SETTINGS.cricketGameMode,
  };
}

function extractTournamentFormatSettings(settings = {}) {
  return {
    groupSize: Number(settings?.groupSize) || DEFAULT_TOURNAMENT_FORMAT.groupSize,
    qualifiers: Number(settings?.qualifiers) || DEFAULT_TOURNAMENT_FORMAT.qualifiers,
    playAllPlaces:
      typeof settings?.playAllPlaces === "boolean"
        ? settings.playAllPlaces
        : DEFAULT_TOURNAMENT_FORMAT.playAllPlaces,
    groupReturnLegs:
      typeof settings?.groupReturnLegs === "boolean"
        ? settings.groupReturnLegs
        : DEFAULT_TOURNAMENT_FORMAT.groupReturnLegs,
    leagueReturnLegs:
      typeof settings?.leagueReturnLegs === "boolean"
        ? settings.leagueReturnLegs
        : DEFAULT_TOURNAMENT_FORMAT.leagueReturnLegs,
  };
}

function normalizeRoundSettings(roundSettings = {}) {
  return Object.fromEntries(
    Object.entries(roundSettings || {}).map(([roundKey, value]) => [
      String(roundKey),
      extractMatchSettings(value),
    ]),
  );
}

function normalizeTournamentSettings(settings = {}) {
  const root = settings || {};
  return {
    global: extractMatchSettings(root?.defaultMatchSettings || root),
    format: extractTournamentFormatSettings(root?.tournamentFormat || root),
    roundSettings: normalizeRoundSettings(root?.roundSettings || {}),
  };
}

function buildTournamentSettingsPayload(
  globalSettings = {},
  formatSettings = {},
  roundSettings = {},
) {
  const normalizedGlobal = extractMatchSettings(globalSettings);
  const normalizedFormat = extractTournamentFormatSettings(formatSettings);
  const normalizedRoundSettings = normalizeRoundSettings(roundSettings);

  const payload = {
    ...normalizedGlobal,
    ...normalizedFormat,
    variant: normalizedGlobal.tournamentType,
    defaultMatchSettings: normalizedGlobal,
    tournamentFormat: normalizedFormat,
    ...(normalizedGlobal.tournamentType === "Cricket"
      ? {
          cricketGameMode: normalizedGlobal.cricketGameMode,
        }
      : {}),
  };

  if (Object.keys(normalizedRoundSettings).length > 0) {
    payload.roundSettings = normalizedRoundSettings;
  }

  return payload;
}

function areMatchSettingsEqual(a = {}, b = {}) {
  const left = extractMatchSettings(a);
  const right = extractMatchSettings(b);

  return (
    left.tournamentType === right.tournamentType &&
    left.baseScore === right.baseScore &&
    left.inMode === right.inMode &&
    left.outMode === right.outMode &&
    left.maxRounds === right.maxRounds &&
    left.bullMode === right.bullMode &&
    left.bullOffMode === right.bullOffMode &&
    left.matchMode === right.matchMode &&
    left.legs === right.legs &&
    left.sets === right.sets &&
    left.legsOfSet === right.legsOfSet &&
    left.scoringMode === right.scoringMode &&
    left.cricketGameMode === right.cricketGameMode
  );
}

function pruneRoundSettings(roundSettings = {}, globalSettings = {}) {
  const normalizedGlobal = extractMatchSettings(globalSettings);

  return Object.fromEntries(
    Object.entries(normalizeRoundSettings(roundSettings)).filter(([, value]) => {
      return !areMatchSettingsEqual(value, normalizedGlobal);
    }),
  );
}

function getEffectiveMatchSettings(match, globalSettings, roundSettings = {}) {
  const roundOverride = roundSettings?.[String(match?.round)] || null;
  return extractMatchSettings({
    ...extractMatchSettings(globalSettings),
    ...(roundOverride || {}),
  });
}

function getDisplayName(player) {
  if (!player) return "—";

  if (typeof player === "string") {
    if (player === "__BYE__") return "Freilos";
    if (!Number.isNaN(Number(player))) return `Sieger Spiel ${player}`;
    return player;
  }

  if (player.type === "bye") return "Freilos";
  if (player.type === "player") return player.name || "—";
  if (player.type === "match") {
    const sourceLabel = player.source === "loser" ? "Verlierer" : "Sieger";
    return `${sourceLabel} Spiel ${player.ref}`;
  }
  if (player.type === "qualifier") return player.ref;
  if (player.name) return player.name;

  return "—";
}

function getMatchTitle(match, labelPrefix = "") {
  if (!match) return "Spiel";

  const roundName = String(match.displayRoundName || "").trim();
  const matchNumber = String(match.matchNumber || "").trim();

  const matchNumberLabel = `${labelPrefix || "Spiel"} ${matchNumber}`;

  const isGroupMatch = /^[A-Z]-\d+$/i.test(matchNumber);
  const isGroupRound = /^Gruppe\s+[A-Z]$/i.test(roundName);

  // 👉 Gruppenspiele bleiben wie sie sind
  if (isGroupMatch && isGroupRound) {
    return matchNumberLabel;
  }

  // 👉 NEU: Erste KO Runde → nur "Spiel X"
  if (
    match.bracketType === "main" && // KO Baum
    Number(match.round) === 1       // erste Runde
  ) {
    return matchNumberLabel;
  }

  if (!roundName) {
    return matchNumberLabel;
  }

  const shouldSwapOrder =
    /^Plätze\s+\d+\s*-\s*\d+$/i.test(roundName) ||
    /^Platz\s+\d+$/i.test(roundName);

  if (shouldSwapOrder) {
    return `${matchNumberLabel} – ${roundName}`;
  }

  return `${roundName} – ${matchNumberLabel}`;
}

function formatStatValue(value, digits = 1) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(digits) : (0).toFixed(digits);
}

function isCricketSettings(settings = {}) {
  return extractMatchSettings(settings).tournamentType === "Cricket";
}

function getTournamentTypeLabel(value) {
  return value === "Cricket" ? "Cricket" : "X01";
}

function getModeLabel(mode) {
  if (mode === "GROUP_KO") return "Gruppenphase mit KO-Finalrunde";
  if (mode === "LEAGUE") return "Liga";
  return "KO-Turnier";
}




export {
  SCORE_OPTIONS, MODE_OPTIONS, MAX_ROUNDS_OPTIONS, BULL_MODE_OPTIONS, BULL_OFF_OPTIONS, MATCH_MODE_OPTIONS, GROUP_SIZE_OPTIONS, QUALIFIER_OPTIONS, LEGS_OPTIONS, SETS_OPTIONS, LEGS_OF_SET_OPTIONS, TOURNAMENT_TYPE_OPTIONS, CRICKET_SCORING_OPTIONS, CRICKET_GAME_MODE_OPTIONS, DEFAULT_TOURNAMENT_TYPE, DEFAULT_CRICKET_SETTINGS, DEFAULT_PLAYERS, LAST_TOURNAMENT_STORAGE_KEY, RECENT_TOURNAMENTS_STORAGE_KEY, MAX_RECENT_TOURNAMENTS, DEFAULT_MATCH_SETTINGS, DEFAULT_TOURNAMENT_FORMAT, getTournamentTypeLabel, getModeLabel
};
