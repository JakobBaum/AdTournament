import {
  DEFAULT_MATCH_SETTINGS,
  DEFAULT_TOURNAMENT_FORMAT,
} from "./TournamentAppShared.js";

export function extractMatchSettings(settings = {}) {
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

export function extractTournamentFormatSettings(settings = {}) {
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

export function normalizeRoundSettings(roundSettings = {}) {
  return Object.fromEntries(
    Object.entries(roundSettings || {}).map(([roundKey, value]) => [
      String(roundKey),
      extractMatchSettings(value),
    ]),
  );
}

export function normalizeTournamentSettings(settings = {}) {
  const root = settings || {};
  return {
    global: extractMatchSettings(root?.defaultMatchSettings || root),
    format: extractTournamentFormatSettings(root?.tournamentFormat || root),
    roundSettings: normalizeRoundSettings(root?.roundSettings || {}),
  };
}

export function buildTournamentSettingsPayload(
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

export function areMatchSettingsEqual(a = {}, b = {}) {
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

export function pruneRoundSettings(roundSettings = {}, globalSettings = {}) {
  const normalizedGlobal = extractMatchSettings(globalSettings);

  return Object.fromEntries(
    Object.entries(normalizeRoundSettings(roundSettings)).filter(([, value]) => {
      return !areMatchSettingsEqual(value, normalizedGlobal);
    }),
  );
}

export function getEffectiveMatchSettings(match, globalSettings, roundSettings = {}) {
  const roundOverride = roundSettings?.[String(match?.round)] || null;
  return extractMatchSettings({
    ...extractMatchSettings(globalSettings),
    ...(roundOverride || {}),
  });
}

export async function resolveFreshMatchSettings({
  db,
  tournamentId,
  match,
  fallbackGlobalSettings = {},
  fallbackRoundSettings = {},
}) {
  let normalized = {
    global: extractMatchSettings(fallbackGlobalSettings),
    roundSettings: normalizeRoundSettings(fallbackRoundSettings),
  };

  if (db && tournamentId) {
    try {
      const latestTournament = await db.getTournamentById(tournamentId);
      if (latestTournament?.settings) {
        const latestNormalized = normalizeTournamentSettings(latestTournament.settings);
        normalized = {
          global: latestNormalized.global,
          roundSettings: latestNormalized.roundSettings,
        };
      }
    } catch (error) {
      console.warn("Aktuelle Turniereinstellungen konnten nicht frisch geladen werden", error);
    }
  }

  return {
    settingsSnapshot: normalized,
    effectiveSettings: getEffectiveMatchSettings(match, normalized.global, normalized.roundSettings),
  };
}
