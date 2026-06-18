// UI option arrays and shared constants for the tournament app.
// All settings serialisation logic lives in tournamentSettings.js.
// All match display helpers live in tournament/helpers/matchHelpers.js.

export const SCORE_OPTIONS        = [121, 170, 301, 501, 701, 901];
export const MODE_OPTIONS         = ["Straight", "Double", "Master"];
export const MAX_ROUNDS_OPTIONS   = [15, 20, 50, 80];
export const BULL_MODE_OPTIONS    = ["25/50", "50/50"];
export const BULL_OFF_OPTIONS     = ["Off", "Normal", "Official"];
export const MATCH_MODE_OPTIONS   = ["Legs", "Sets"];
export const GROUP_SIZE_OPTIONS   = [3, 4, 5, 6, 8, 10, 12, 24, 32];
export const QUALIFIER_OPTIONS    = [1, 2, 3, 4, 5, 6, 7, 8, 16, 32];
export const LEGS_OPTIONS         = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const SETS_OPTIONS         = [2, 3, 4, 5, 6, 7];
export const LEGS_OF_SET_OPTIONS  = [2, 3];
export const TOURNAMENT_TYPE_OPTIONS   = ["X01", "Cricket"];
export const CRICKET_SCORING_OPTIONS   = ["Standard", "Cut Throat", "No Score"];
export const CRICKET_GAME_MODE_OPTIONS = ["Cricket", "Tactics"];

export const DEFAULT_TOURNAMENT_TYPE = "X01";

export const DEFAULT_CRICKET_SETTINGS = {
  scoringMode: "Standard",
  maxRounds: 50,
  bullOffMode: "Off",
  matchMode: "Legs",
  legs: 2,
  sets: 3,
  legsOfSet: 3,
};

export const DEFAULT_PLAYERS = [
  "Anna", "Bernd", "Christian", "Doris", "Erika", "Frank", "Gabi", "Hans", "Ingrid",
];

export const LAST_TOURNAMENT_STORAGE_KEY   = "adTournamentLastTournamentId";
export const RECENT_TOURNAMENTS_STORAGE_KEY = "recentTournaments";
export const MAX_RECENT_TOURNAMENTS        = 10;

export const DEFAULT_MATCH_SETTINGS = {
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

export const DEFAULT_TOURNAMENT_FORMAT = {
  groupSize: 4,
  qualifiers: 2,
  playAllPlaces: false,
  groupReturnLegs: false,
  leagueReturnLegs: false,
};

export function getTournamentTypeLabel(value) {
  return value === "Cricket" ? "Cricket" : "X01";
}

export function getModeLabel(mode) {
  if (mode === "GROUP_KO") return "Gruppenphase mit KO-Finalrunde";
  if (mode === "LEAGUE")   return "Liga";
  return "KO-Turnier";
}
