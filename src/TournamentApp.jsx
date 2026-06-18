import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TournamentDB } from "./TournamentDB";
import { Logik } from "./Logik";
import { AutodartsApi } from "./AutodartsApi";
import toast, { Toaster } from "./toast";
import { HomeScreen } from "./tournament/screens/HomeScreen";
import { TournamentScreen } from "./tournament/screens/TournamentScreen";
import {
  TournamentSettingsDialog,
  RoundSettingsDialog,
  BoardSelectionDialog,
  EditResultDialog,
} from "./tournament/dialogs/TournamentDialogs.jsx";
import {
  SCORE_OPTIONS,
  MODE_OPTIONS,
  MAX_ROUNDS_OPTIONS,
  BULL_MODE_OPTIONS,
  BULL_OFF_OPTIONS,
  MATCH_MODE_OPTIONS,
  GROUP_SIZE_OPTIONS,
  QUALIFIER_OPTIONS,
  LEGS_OPTIONS,
  SETS_OPTIONS,
  LEGS_OF_SET_OPTIONS,
  TOURNAMENT_TYPE_OPTIONS,
  CRICKET_SCORING_OPTIONS,
  CRICKET_GAME_MODE_OPTIONS,
  DEFAULT_TOURNAMENT_TYPE,
  DEFAULT_CRICKET_SETTINGS,
  DEFAULT_PLAYERS,
  LAST_TOURNAMENT_STORAGE_KEY,
  RECENT_TOURNAMENTS_STORAGE_KEY,
  MAX_RECENT_TOURNAMENTS,
  DEFAULT_MATCH_SETTINGS,
  DEFAULT_TOURNAMENT_FORMAT,
  getTournamentTypeLabel,
} from "./TournamentAppShared";
import {
  activeMatchWatchers,
  cancelledMatchWatchers,
  extractFinalPlayerStatsFromAutodartsStats,
  handleAutodartsApiError,
  watchMatchUntilFinished,
} from "./matchLifecycle";
import { getClientId } from "./clientSession";
import {
  getDisplayName,
  getManualEditScoreLabel,
  getManualEditTargetWins,
  isLiveMatch,
  sortMatchesByMatchNumber,
  validateManualMatchResult,
} from "./tournament/helpers/matchHelpers.js";
import {
  readRecentTournamentIds,
  writeRecentTournamentIds,
  rememberRecentTournament,
  removeRecentTournament,
} from "./tournament/helpers/recentTournaments.js";
import { replaceCollectionIfChanged } from "./utils/stateEquality";
import {
  buildTournamentSettingsPayload,
  extractMatchSettings,
  getEffectiveMatchSettings,
  normalizeTournamentSettings,
  pruneRoundSettings,
  resolveFreshMatchSettings,
} from "./tournamentSettings";

const db = new TournamentDB();
const logic = new Logik();
const autodartsApi = new AutodartsApi();

export default function TournamentApp() {
  const [tournamentName, setTournamentName] = useState("Mein Turnier");
  const [mode, setMode] = useState("KO");
  const [tournamentType, setTournamentType] = useState(DEFAULT_TOURNAMENT_TYPE);
  const [baseScore, setBaseScore] = useState(501);
  const [inMode, setInMode] = useState("Straight");
  const [outMode, setOutMode] = useState("Double");
  const [maxRounds, setMaxRounds] = useState(50);
  const [bullMode, setBullMode] = useState("25/50");
  const [bullOffMode, setBullOffMode] = useState("Normal");
  const [scoringMode, setScoringMode] = useState("Standard");
  const [cricketGameMode, setCricketGameMode] = useState(DEFAULT_CRICKET_SETTINGS.cricketGameMode);
  const [matchMode, setMatchMode] = useState("Legs");
  const [legs, setLegs] = useState(3);
  const [sets, setSets] = useState(3);
  const [legsOfSet, setLegsOfSet] = useState(3);
  const [groupSize, setGroupSize] = useState(4);
  const [qualifiers, setQualifiers] = useState(2);
  const [playAllPlaces, setPlayAllPlaces] = useState(false);
  const [groupReturnLegs, setGroupReturnLegs] = useState(false);
  const [leagueReturnLegs, setLeagueReturnLegs] = useState(false);
  const [allPlayersOneGroup, setAllPlayersOneGroup] = useState(false);
  const [groupPhaseByes, setGroupPhaseByes] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState(DEFAULT_PLAYERS);
  const [tournamentEnvironment, setTournamentEnvironment] = useState("online");

  const [screen, setScreen] = useState("home");
  const [joinCode, setJoinCode] = useState("");
  const [tournamentId, setTournamentId] = useState(null);
  const [tournamentCode, setTournamentCode] = useState("");
  const [matches, setMatches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [playerDocs, setPlayerDocs] = useState([]);
  const [boards, setBoards] = useState([]);
  const [allBoards, setAllBoards] = useState([]);
  const [freeBoards, setFreeBoards] = useState([]);

  const [loadingBoards, setLoadingBoards] = useState(false);
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [joiningTournament, setJoiningTournament] = useState(false);
  const [recentTournaments, setRecentTournaments] = useState([]);
  const [loadingRecentTournaments, setLoadingRecentTournaments] = useState(true);
  const [isRestoringTournament, setIsRestoringTournament] = useState(true);

  const [showBoardDialog, setShowBoardDialog] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [roundSettingsMap, setRoundSettingsMap] = useState({});
  const [showRoundSettingsDialog, setShowRoundSettingsDialog] = useState(false);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(null);
  const [roundSettingsDraft, setRoundSettingsDraft] = useState(DEFAULT_MATCH_SETTINGS);
  const [showEditResultDialog, setShowEditResultDialog] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [editingWinnerSlot, setEditingWinnerSlot] = useState("player1");
  const [editingScore1, setEditingScore1] = useState("");
  const [editingScore2, setEditingScore2] = useState("");

  const currentSettings = useMemo(
    () => ({
      tournamentType,
      baseScore,
      inMode,
      outMode,
      maxRounds,
      bullMode,
      bullOffMode,
      scoringMode,
      cricketGameMode,
      matchMode,
      legs,
      sets,
      legsOfSet,
    }),
    [
      tournamentType,
      baseScore,
      inMode,
      outMode,
      maxRounds,
      bullMode,
      bullOffMode,
      scoringMode,
      cricketGameMode,
      matchMode,
      legs,
      sets,
      legsOfSet,
    ],
  );

  const tournamentFormatSettings = useMemo(
    () => ({
      groupSize,
      qualifiers,
      playAllPlaces,
      groupReturnLegs,
      leagueReturnLegs,
      allPlayersOneGroup,
      groupPhaseByes,
    }),
    [groupSize, qualifiers, playAllPlaces, groupReturnLegs, leagueReturnLegs, allPlayersOneGroup, groupPhaseByes],
  );

  const tournamentSettingsPayload = useMemo(
    () =>
      buildTournamentSettingsPayload(
        currentSettings,
        tournamentFormatSettings,
        pruneRoundSettings(roundSettingsMap, currentSettings),
      ),
    [currentSettings, tournamentFormatSettings, roundSettingsMap],
  );

  const editingScoreLabel = useMemo(
    () => getManualEditScoreLabel(editingMatch, currentSettings, roundSettingsMap),
    [editingMatch, currentSettings, roundSettingsMap],
  );

  const editingTargetWins = useMemo(
    () => getManualEditTargetWins(editingMatch, currentSettings, roundSettingsMap),
    [editingMatch, currentSettings, roundSettingsMap],
  );

  const applyTournamentState = useCallback((tournament, nextScreen = "tournament") => {
    if (!tournament) return;

    rememberRecentTournament(tournament.id);
    setRecentTournaments((prev) => {
      const withoutCurrent = (Array.isArray(prev) ? prev : []).filter(
        (entry) => entry?.id !== tournament.id,
      );
      return [{ ...tournament, id: tournament.id }, ...withoutCurrent].slice(0, MAX_RECENT_TOURNAMENTS);
    });

    setTournamentId(tournament.id);
    setTournamentCode(tournament.code || "");
    setTournamentName(tournament.name || "Turnier");
    setMode(tournament.type === "GROUP_KO" ? "GROUP_KO" : tournament.type === "LEAGUE" ? "LEAGUE" : "KO");

    const normalizedSettings = normalizeTournamentSettings(tournament?.settings || {});
    const globalSettings = normalizedSettings.global;
    const formatSettings = normalizedSettings.format;

    setTournamentType(globalSettings.tournamentType || DEFAULT_TOURNAMENT_TYPE);
    setBaseScore(globalSettings.baseScore);
    setInMode(globalSettings.inMode);
    setOutMode(globalSettings.outMode);
    setMaxRounds(globalSettings.maxRounds);
    setBullMode(globalSettings.bullMode);
    setBullOffMode(globalSettings.bullOffMode);
    setScoringMode(globalSettings.scoringMode || DEFAULT_MATCH_SETTINGS.scoringMode);
    setCricketGameMode(globalSettings.cricketGameMode || DEFAULT_CRICKET_SETTINGS.cricketGameMode);
    setMatchMode(globalSettings.matchMode);
    setLegs(globalSettings.legs);
    setSets(globalSettings.sets);
    setLegsOfSet(globalSettings.legsOfSet);
    setGroupSize(formatSettings.groupSize);
    setQualifiers(formatSettings.qualifiers);
    setPlayAllPlaces(formatSettings.playAllPlaces);
    setGroupReturnLegs(formatSettings.groupReturnLegs);
    setLeagueReturnLegs(formatSettings.leagueReturnLegs);
    setAllPlayersOneGroup(formatSettings.allPlayersOneGroup ?? false);
    setGroupPhaseByes(formatSettings.groupPhaseByes ?? false);
    setRoundSettingsMap(normalizedSettings.roundSettings);

    setScreen(nextScreen);
  }, []);

  const handleLeaveTournament = useCallback(() => {
    const shouldLeave = window.confirm("Turnier wirklich verlassen?");
    if (!shouldLeave) return;

    try {
      localStorage.removeItem(LAST_TOURNAMENT_STORAGE_KEY);
    } catch (e) {
      console.warn("LocalStorage cleanup failed", e);
    }

    setTournamentId(null);
    setTournamentCode("");
    setMatches([]);
    setGroups([]);
    setPlayerDocs([]);
    setBoards([]);
    setFreeBoards([]);
    setPlayers(DEFAULT_PLAYERS);
    setScreen("home");
  }, []);

  const handleSaveTournamentSettings = useCallback(async () => {
    if (!tournamentId) return;
    const loadingToastId = toast.loading("Speichere Turniereinstellungen...");

    try {

      await db.updateTournamentSetup(tournamentId, {
        name: tournamentName,
        type: mode,
        settings: tournamentSettingsPayload,
      });

      toast.success("Turniereinstellungen gespeichert", { id: loadingToastId });
    } catch (error) {
      console.error(error);
      toast.error("Turniereinstellungen konnten nicht gespeichert werden", { id: loadingToastId });
    }
  }, [mode, tournamentId, tournamentName, tournamentSettingsPayload]);

  const openRoundSettingsDialog = useCallback(
    (roundNumber) => {
      const roundKey = String(roundNumber);
      setSelectedRoundNumber(Number(roundNumber));
      setRoundSettingsDraft(extractMatchSettings(roundSettingsMap?.[roundKey] || currentSettings));
      setShowRoundSettingsDialog(true);
    },
    [currentSettings, roundSettingsMap],
  );

  const handleSaveRoundSettings = useCallback(async () => {
    if (!tournamentId || selectedRoundNumber == null) return;
    const loadingToastId = toast.loading(`Speichere Rundeneinstellungen für Runde ${selectedRoundNumber}...`);

    try {

      const nextRoundSettings = pruneRoundSettings(
        {
          ...roundSettingsMap,
          [String(selectedRoundNumber)]: extractMatchSettings(roundSettingsDraft),
        },
        currentSettings,
      );

      await db.updateTournamentSetup(tournamentId, {
        name: tournamentName,
        type: mode,
        settings: buildTournamentSettingsPayload(
          currentSettings,
          tournamentFormatSettings,
          nextRoundSettings,
        ),
      });

      setRoundSettingsMap(nextRoundSettings);
      setShowRoundSettingsDialog(false);
      setSelectedRoundNumber(null);
      toast.success(`Rundeneinstellungen für Runde ${selectedRoundNumber} gespeichert`, { id: loadingToastId });
    } catch (error) {
      console.error(error);
      toast.error("Rundeneinstellungen konnten nicht gespeichert werden", { id: loadingToastId });
    }
  }, [
    tournamentId,
    selectedRoundNumber,
    roundSettingsMap,
    roundSettingsDraft,
    tournamentName,
    mode,
    currentSettings,
    tournamentFormatSettings,
  ]);

  const handleResetRoundSettings = useCallback(async () => {
    if (!tournamentId || selectedRoundNumber == null) return;
    const loadingToastId = toast.loading(`Lösche Rundeneinstellungen für Runde ${selectedRoundNumber}...`);

    try {

      const nextRoundSettings = { ...roundSettingsMap };
      delete nextRoundSettings[String(selectedRoundNumber)];

      await db.updateTournamentSetup(tournamentId, {
        name: tournamentName,
        type: mode,
        settings: buildTournamentSettingsPayload(
          currentSettings,
          tournamentFormatSettings,
          nextRoundSettings,
        ),
      });

      setRoundSettingsMap(nextRoundSettings);
      setRoundSettingsDraft(extractMatchSettings(currentSettings));
      setShowRoundSettingsDialog(false);
      setSelectedRoundNumber(null);
      toast.success(
        `Rundeneinstellungen für Runde ${selectedRoundNumber} gelöscht\nEs gelten wieder die globalen Werte`,
        { id: loadingToastId },
      );
    } catch (error) {
      console.error(error);
      toast.error("Rundeneinstellungen konnten nicht gelöscht werden", { id: loadingToastId });
    }
  }, [
    tournamentId,
    selectedRoundNumber,
    roundSettingsMap,
    tournamentName,
    mode,
    currentSettings,
    tournamentFormatSettings,
  ]);

  const loadBoards = useCallback(async () => {
    const loadingToastId = toast.loading("Lade Boards...");

    try {
      setLoadingBoards(true);
      const loadedBoards = await autodartsApi.getBoards();
      setAllBoards(Array.isArray(loadedBoards) ? loadedBoards : []);
      toast.success("Boards geladen", { id: loadingToastId });
    } catch (error) {
      console.error(error);
      toast.error("Boards konnten nicht geladen werden\nBitte in Autodarts eingeloggt sein", { id: loadingToastId });
    } finally {
      setLoadingBoards(false);
    }
  }, []);

  useEffect(() => {
    const restoreLastTournament = async () => {
      try {
        const savedTournamentId = localStorage.getItem(LAST_TOURNAMENT_STORAGE_KEY);

        if (!savedTournamentId) return;

        const tournament = await db.getTournamentById(savedTournamentId);

        if (!tournament) {
          localStorage.removeItem(LAST_TOURNAMENT_STORAGE_KEY);
          removeRecentTournament(savedTournamentId);
          return;
        }

        applyTournamentState(tournament, "tournament");
      } catch (error) {
        console.error("Letztes Turnier konnte nicht wiederhergestellt werden.", error);
      } finally {
        setIsRestoringTournament(false);
      }
    };

    restoreLastTournament();
  }, [applyTournamentState]);

  useEffect(() => {
    const loadRecentTournaments = async () => {
      try {
        setLoadingRecentTournaments(true);
        const storedIds = readRecentTournamentIds();

        if (!storedIds.length) {
          setRecentTournaments([]);
          return;
        }

        const resolved = await Promise.all(
          storedIds.map(async (id) => ({
            id,
            tournament: await db.getTournamentById(id),
          })),
        );

        const existingTournaments = resolved
          .filter((entry) => !!entry.tournament)
          .map((entry) => entry.tournament);

        const existingIds = existingTournaments.map((entry) => String(entry.id || "").trim()).filter(Boolean);
        writeRecentTournamentIds(existingIds);
        setRecentTournaments(existingTournaments);
      } catch (error) {
        console.error("Letzte Turniere konnten nicht geladen werden.", error);
        setRecentTournaments([]);
      } finally {
        setLoadingRecentTournaments(false);
      }
    };

    loadRecentTournaments();
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (!tournamentId) return;

    const unsubMatches = db.subscribeToMatches(tournamentId, (items) => {
      const sortedItems = sortMatchesByMatchNumber(items);
      setMatches((prev) => replaceCollectionIfChanged(prev, sortedItems, [
        "id",
        "status",
        "updatedAt",
        "startedAt",
        "finishedAt",
        "boardId",
        "lobbyId",
        "winner",
        "loser",
        "player1",
        "player2",
        "scorePlayer1",
        "scorePlayer2",
        "finalPlayerStats",
        "displayRoundName",
        "round",
      ]));
    });

    const unsubBoards = db.subscribeToBoards(tournamentId, (items) => {
      setBoards((prev) => replaceCollectionIfChanged(prev, items, ["id", "status", "currentMatchId", "boardId"]));
    });

    const unsubFreeBoards = db.subscribeToFreeBoards(tournamentId, (items) => {
      setFreeBoards((prev) => replaceCollectionIfChanged(prev, items, ["id", "status", "currentMatchId", "boardId"]));
    });

    const unsubPlayers = db.subscribeToPlayers(tournamentId, (items) => {
      setPlayerDocs((prev) => replaceCollectionIfChanged(prev, items, [
        "id",
        "points",
        "wins",
        "losses",
        "matchesPlayed",
        "legsWon",
        "legsLost",
        "setsWon",
        "setsLost",
        "average",
        "checkoutPercent",
        "plus60",
        "plus100",
        "plus140",
        "plus170Or180",
        "bestCheckout",
        "mpr",
        "first9MPR",
        "mark5",
        "mark6",
        "mark7",
        "mark8",
        "mark9",
        "whiteHorse",
        "updatedAt",
      ]));
    });

    db.getGroupsByTournamentId(tournamentId).then(setGroups).catch(console.error);

    return () => {
      unsubMatches?.();
      unsubBoards?.();
      unsubFreeBoards?.();
      unsubPlayers?.();
    };
  }, [tournamentId]);


  useEffect(() => {
    if (!allBoards.length) return;

    setBoards((prev) => {
      if (prev.length > 0) return prev;

      return allBoards.map((board) => ({
        id: board.id,
        boardId: board.id,
        name: board.name,
      }));
    });
  }, [allBoards]);

  useEffect(() => {
    if (!tournamentId || !matches.length) return;

    matches
      .filter((match) => isLiveMatch(match) && match.lobbyId)
      .forEach((match) => {
        const linkedBoard = boards.find((board) => board.currentMatchId === match.id) || null;

        watchMatchUntilFinished({
          tournamentId,
          match,
          boardDocId: linkedBoard?.id || null,
          lobbyId: match.lobbyId,
          db,
          autodartsApi,
        });
      });
  }, [tournamentId, matches, boards, allBoards.length]);

  const getBoardDocForMatch = useCallback(
    (match) => {
      if (!match) return null;
      return (
        boards.find(
          (board) =>
            board.currentMatchId === match.id ||
            (match.boardId && String(board.boardId) === String(match.boardId)),
        ) || null
      );
    },
    [boards],
  );

  const addPlayer = () => {
    const trimmed = playerName.trim();
    if (!trimmed) return;

    // ❌ Prüfen ob Name mit Zahl beginnt
    if (/^\d/.test(trimmed)) {
      toast.error("Der Spielername darf nicht mit einer Zahl beginnen");
      return;
    }

    // ❌ Prüfen auf Duplikate
    if (players.some((p) => String(p).trim().toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Dieser Spieler ist bereits vorhanden");
      return;
    }

    setPlayers((prev) => [...prev, trimmed]);
    setPlayerName("");
  };

  const removePlayer = (name) => {
    setPlayers((prev) => prev.filter((p) => p !== name));
  };

  const createTournament = async () => {
    let loadingToastId = null;

    try {
      // ── Pre-flight validation ──────────────────────────────────────────
      if (players.length < 2) {
        toast.error("Bitte mindestens 2 Spieler hinzufügen.");
        return;
      }

      if (mode === "GROUP_KO") {
        const effectiveGroupSize = allPlayersOneGroup ? players.length : groupSize;
        const numGroups   = Math.ceil(players.length / effectiveGroupSize);
        const cappedQ     = Math.min(qualifiers, effectiveGroupSize);
        const totalQ      = numGroups * cappedQ;

        if (totalQ < 2) {
          toast.error(
            `Zu wenige Qualifikanten (${totalQ}) für eine KO-Runde. Erhöhe Qualifikanten pro Gruppe oder verringere die Gruppengröße.`
          );
          return;
        }

        // When groupPhaseByes is on, the last group must have enough real
        // players to fill all qualifier spots — otherwise byes would advance.
        if (groupPhaseByes && !allPlayersOneGroup) {
          const remainder = players.length % effectiveGroupSize;
          if (remainder !== 0 && remainder < qualifiers) {
            toast.error(
              `Freilos-Option nicht möglich: Die letzte Gruppe hätte nur ${remainder} echte Spieler, aber ${qualifiers} Qualifikanten pro Gruppe benötigt.`
            );
            return;
          }
        }
      }

      setCreatingTournament(true);
      loadingToastId = toast.loading("Erstelle Turnier...");

      const type = mode;

      const selectedBoards = allBoards.filter((board) =>
        boards.some((selected) => selected.id === board.id || selected.boardId === board.id),
      );

      if (selectedBoards.length <= 0) {
        toast.error("Bitte mindestens 1 Board hinzufügen.", { id: loadingToastId || undefined });
        return;
      }

      const result = await logic.createFullTournament(
        tournamentName.trim() || "Mein Turnier",
        type,
        players,
        selectedBoards,
        groupSize,
        qualifiers,
        tournamentSettingsPayload,
      );

      await db.updateTournamentSetup(result.id, {
        name: tournamentName.trim() || "Mein Turnier",
        type,
        settings: tournamentSettingsPayload,
      });

      toast.success("Turnier erstellt", { id: loadingToastId });
      openTournament({
        id: result.id,
        code: result.code,
        name: tournamentName.trim() || "Mein Turnier",
        type,
        settings: tournamentSettingsPayload,
      });
    } catch (error) {
      console.error(error);
      toast.error("Turnier konnte nicht erstellt werden", { id: loadingToastId || undefined });
    } finally {
      setCreatingTournament(false);
    }
  };

  const openTournament = useCallback((tournament) => {
    if (!tournament?.id) return;

    localStorage.setItem(LAST_TOURNAMENT_STORAGE_KEY, tournament.id);
    applyTournamentState(tournament, "tournament");
  }, [applyTournamentState]);

  const joinTournament = async (codeOverride = "") => {
    let loadingToastId = null;

    try {
      const codeToJoin = String(codeOverride || joinCode || "").trim();
      if (!codeToJoin) return;
      setJoiningTournament(true);
      loadingToastId = toast.loading("Lade Turnier...");

      const tournament = await db.getTournamentByCode(codeToJoin);
      if (!tournament) {
        toast.error("Kein Turnier mit diesem Code gefunden", { id: loadingToastId || undefined });
        return;
      }

      toast.success("Turnier geladen", { id: loadingToastId });
      openTournament(tournament);
      setJoinCode("");
    } catch (error) {
      console.error(error);
      toast.error("Turnier konnte nicht geladen werden", { id: loadingToastId || undefined });
    } finally {
      setJoiningTournament(false);
    }
  };

  const handleStartMatch = useCallback(
    async (match) => {
      try {
        if (!tournamentId || !match?.id) return;
        if (!freeBoards.length) {
          toast.error("Kein freies Board verfügbar");
          return;
        }

        setSelectedMatch(match);
        setSelectedBoardId(freeBoards[0]?.id || "");
        setShowBoardDialog(true);
      } catch (error) {
        console.error(error);
        toast.error("Spiel konnte nicht vorbereitet werden");
      }
    },
    [freeBoards, tournamentId],
  );

  const confirmStartMatch = useCallback(async () => {
    let matchWindow = null;
    let reservedBoardDoc = null;
    let loadingToastId = null;

    try {
      if (!selectedMatch || !tournamentId || !selectedBoardId) return;

      loadingToastId = toast.loading("Starte Spiel...");

      reservedBoardDoc = freeBoards.find((board) => board.id === selectedBoardId) || null;
      if (!reservedBoardDoc) {
        if (loadingToastId) toast.dismiss(loadingToastId);
        toast.error("Bitte ein freies Board auswählen");
        return;
      }

      const reservation = await db.reserveMatchStart(tournamentId, selectedMatch.id, reservedBoardDoc.id, {
        boardId: reservedBoardDoc.boardId,
        clientId: getClientId(),
      });

      const { effectiveSettings } = await resolveFreshMatchSettings({
        db,
        tournamentId,
        match: selectedMatch,
        fallbackGlobalSettings: currentSettings,
        fallbackRoundSettings: roundSettingsMap,
      });

      const lobby = await autodartsApi.createLobby({
        tournamentType: effectiveSettings.tournamentType,
        baseScore: effectiveSettings.baseScore,
        inMode: effectiveSettings.inMode,
        outMode: effectiveSettings.outMode,
        bullMode: effectiveSettings.bullMode,
        bullOffMode: effectiveSettings.bullOffMode,
        scoringMode: effectiveSettings.scoringMode,
        cricketGameMode: effectiveSettings.cricketGameMode,
        maxRounds: effectiveSettings.maxRounds,
        legs:
          effectiveSettings.matchMode === "Legs"
            ? effectiveSettings.legs
            : effectiveSettings.legsOfSet,
        sets: effectiveSettings.matchMode === "Sets" ? effectiveSettings.sets : null,
      });

      const player1Name = selectedMatch.player1?.name;
      const player2Name = selectedMatch.player2?.name;

      await autodartsApi.addPlayerToLobby(lobby.id, {
        name: player1Name,
        boardId: reservedBoardDoc.boardId,
      });

      await autodartsApi.addPlayerToLobby(lobby.id, {
        name: player2Name,
        boardId: reservedBoardDoc.boardId,
      });

      await autodartsApi.startLobby(lobby.id);

      await db.attachLobbyToStartedMatch(tournamentId, selectedMatch.id, {
        boardId: reservedBoardDoc.boardId,
        lobbyId: lobby.id,
      });

      const matchUrl = `https://play.autodarts.io/matches/${lobby.id}`;
      window.open(matchUrl, "_blank", "noopener,noreferrer");

      watchMatchUntilFinished({
        tournamentId,
        match: {
          ...(reservation?.match || selectedMatch),
          boardId: reservedBoardDoc.boardId,
          lobbyId: lobby.id,
        },
        boardDocId: reservedBoardDoc.id,
        lobbyId: lobby.id,
        db,
        autodartsApi,
      });


      setShowBoardDialog(false);
      setSelectedBoardId("");
      setSelectedMatch(null);
      toast.success("Spiel gestartet", { id: loadingToastId });
    } catch (error) {
      if (reservedBoardDoc?.id && tournamentId) {
        try {
          await db.rollbackMatchStart(tournamentId, selectedMatch?.id, reservedBoardDoc.id);
        } catch (releaseError) {
          console.warn("Board konnte nach Startfehler nicht zurückgesetzt werden", releaseError);
        }
      }

      if (matchWindow) {
        try {
          matchWindow.close();
        } catch (_) {}
      }

      if (loadingToastId) toast.dismiss(loadingToastId);
      handleAutodartsApiError(error, "Spiel konnte nicht gestartet werden");
    }
  }, [selectedMatch, tournamentId, selectedBoardId, freeBoards, currentSettings, roundSettingsMap]);

  const handleGiveUpMatch = useCallback(
    async (match, forfeitingSlot) => {
      try {
        if (!tournamentId || !match?.id) return;

        const winner = forfeitingSlot === "player1" ? match.player2 : match.player1;
        const loser = forfeitingSlot === "player1" ? match.player1 : match.player2;

        if (!winner || winner.type !== "player") return;

        const shouldGiveUp = window.confirm(
          `${getDisplayName(loser)} wirklich aufgeben lassen? ${getDisplayName(winner)} gewinnt das Spiel.`,
        );
        if (!shouldGiveUp) return;

        await db.setMatchFinished(tournamentId, match.id, winner, loser, {
          resultSource: "manual-forfeit",
        });

      } catch (error) {
        console.error(error);
        toast.error("Spiel konnte nicht per Aufgabe beendet werden");
      }
    },
    [tournamentId],
  );

  const handleAbortLiveMatch = useCallback(
    async (match) => {
      try {
        if (!tournamentId || !match?.id) return;

        const reallyAbort = window.confirm(`Live-Spiel ${match.matchNumber} wirklich abbrechen?`);
        if (!reallyAbort) return;

        const boardDoc = getBoardDocForMatch(match);
        const boardId = boardDoc?.id || null;

        let stats = null;
        if (match?.lobbyId) {
          try {
            stats = await autodartsApi.getMatchStats(match.lobbyId);
          } catch (error) {
            if (match?.lobbyId) {
              try {
                stats = await autodartsApi.getMatchStats(match.lobbyId);
              } catch (error) {
                if (error?.code === "TOKEN_REFRESH_REQUIRED") {
                  throw error;
                }

                console.warn("Stats beim Abbrechen konnten nicht geladen werden", error);
              }
            }
          }
        } else {
          console.log("keine lobby id");
        }

        console.log(stats);

        const watcherKey = `${tournamentId}:${match.id}`;
        cancelledMatchWatchers.add(watcherKey);
        activeMatchWatchers.delete(watcherKey);

        if (boardId) {
          await db.releaseBoard(tournamentId, boardId);
        }

        await db.setMatchAborted(tournamentId, match.id, {
          boardId: null,
          lobbyId: null,
          scorePlayer1: stats?.scores?.[0] ?? null,
          scorePlayer2: stats?.scores?.[1] ?? null,
          finalPlayerStats: stats ? extractFinalPlayerStatsFromAutodartsStats(stats) : null,
        });

      } catch (error) {
        handleAutodartsApiError(error, "Live-Spiel konnte nicht abgebrochen werden.");
      }
    },
    [getBoardDocForMatch, tournamentId],
  );

  const handleRestartMatch = useCallback(
    async (match) => {
      try {
        if (!tournamentId || !match?.id) return;

        const shouldRestart = window.confirm(
          `Spiel ${match.matchNumber} wirklich neu starten? Der Spielverlauf und alle Folgeeinträge werden zurückgesetzt.`,
        );
        if (!shouldRestart) return;

        const boardDoc = getBoardDocForMatch(match);

        if (boardDoc?.id) {
          await db.releaseBoard(tournamentId, boardDoc.id);
        }

        await db.resetMatchToPending(tournamentId, match.id);


        const watcherKey = `${tournamentId}:${match.id}`;
        cancelledMatchWatchers.add(watcherKey);
        activeMatchWatchers.delete(watcherKey);

        setSelectedMatch({
          ...match,
          status: "pending",
          boardId: null,
          lobbyId: null,
          finalPlayerStats: null,
          startedAt: null,
          finishedAt: null,
          winner: null,
          loser: null,
          scorePlayer1: null,
          scorePlayer2: null,
        });
        setSelectedBoardId(freeBoards[0]?.id || "");
        setShowBoardDialog(true);
      } catch (error) {
        console.error(error);
        toast.error("Spiel konnte nicht neu gestartet werden");
      }
    },
    [freeBoards, getBoardDocForMatch, tournamentId],
  );

  const handleOpenEditResult = useCallback((match) => {
    if (!match) return;

    setEditingMatch(match);
    setEditingWinnerSlot(match?.winner?.name === match?.player2?.name ? "player2" : "player1");
    setEditingScore1(
      match?.scorePlayer1 !== null && match?.scorePlayer1 !== undefined
        ? String(match.scorePlayer1?.legs ?? match.scorePlayer1)
        : "",
    );
    setEditingScore2(
      match?.scorePlayer2 !== null && match?.scorePlayer2 !== undefined
        ? String(match.scorePlayer2?.legs ?? match.scorePlayer2)
        : "",
    );
    setShowEditResultDialog(true);
  }, []);

  const handleSaveEditedResult = useCallback(async () => {
    let loadingToastId = null;

    try {
      if (!tournamentId || !editingMatch) return;

      if (editingScore1 === "" || editingScore2 === "") {
        toast.error("Bitte beide Ergebnisse eingeben");
        return;
      }

      const validation = validateManualMatchResult(
        editingMatch,
        editingWinnerSlot,
        editingScore1,
        editingScore2,
        currentSettings,
        roundSettingsMap,
      );

      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }

      loadingToastId = toast.loading("Speichere Ergebnis...");

      const winner = editingWinnerSlot === "player1" ? editingMatch.player1 : editingMatch.player2;
      const loser = editingWinnerSlot === "player1" ? editingMatch.player2 : editingMatch.player1;

      await db.correctMatchResult(tournamentId, editingMatch.id, {
        winner,
        loser,
        scorePlayer1: validation.score1,
        scorePlayer2: validation.score2,
      });

      setShowEditResultDialog(false);
      setEditingMatch(null);
      setEditingWinnerSlot("player1");
      setEditingScore1("");
      setEditingScore2("");
      toast.success("Ergebnis gespeichert", { id: loadingToastId });
    } catch (error) {
      console.error(error);
      toast.error("Ergebnis konnte nicht gespeichert werden", { id: loadingToastId || undefined });
    }
  }, [
    tournamentId,
    editingMatch,
    editingWinnerSlot,
    editingScore1,
    editingScore2,
    currentSettings,
    roundSettingsMap,
  ]);

  const handleReleaseBoard = useCallback(
    async (board, currentMatch) => {
      try {
        if (!tournamentId || !board?.id) return;

        const reallyRelease = window.confirm(
          `Board ${board.name || board.boardId || board.id} wirklich freigeben?`,
        );
        if (!reallyRelease) return;

        await db.releaseBoard(tournamentId, board.id);

        if (currentMatch?.id && isLiveMatch(currentMatch)) {
          await db.setMatchAborted(tournamentId, currentMatch.id, {
            boardId: null,
            lobbyId: null,
          });
        }
      } catch (error) {
        console.error(error);
        toast.error("Board konnte nicht freigegeben werden");
      }
    },
    [tournamentId],
  );

  const selectedBoardName = useMemo(() => {
    const board = freeBoards.find((item) => item.id === selectedBoardId);
    return board?.name || board?.boardId || "";
  }, [freeBoards, selectedBoardId]);

  if (isRestoringTournament) {
    return (
      <div className="tournament-layout">
        <div className="tournament-container">
          <div className="output">Letztes Turnier wird geladen...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {screen === "tournament" ? (
        <TournamentScreen
          tournamentName={tournamentName}
          tournamentCode={tournamentCode}
          tournamentType={tournamentType}
          mode={mode}
          setShowSettingsDialog={setShowSettingsDialog}
          handleLeaveTournament={handleLeaveTournament}
          matches={matches}
          boards={boards}
          playerDocs={playerDocs}
          handleReleaseBoard={handleReleaseBoard}
          groups={groups}
          matchMode={matchMode}
          qualifiers={qualifiers}
          groupReturnLegs={groupReturnLegs}
          leagueReturnLegs={leagueReturnLegs}
          handleStartMatch={handleStartMatch}
          handleGiveUpMatch={handleGiveUpMatch}
          handleOpenEditResult={handleOpenEditResult}
          handleRestartMatch={handleRestartMatch}
          handleAbortLiveMatch={handleAbortLiveMatch}
          tournamentId={tournamentId}
          roundSettingsMap={roundSettingsMap}
          openRoundSettingsDialog={openRoundSettingsDialog}
        />
      ) : (
        <HomeScreen
          screen={screen}
          players={players}
          playerName={playerName}
          setPlayerName={setPlayerName}
          addPlayer={addPlayer}
          removePlayer={removePlayer}
          setScreen={setScreen}
          tournamentName={tournamentName}
          setTournamentName={setTournamentName}
          mode={mode}
          setMode={setMode}
          playAllPlaces={playAllPlaces}
          setPlayAllPlaces={setPlayAllPlaces}
          tournamentType={tournamentType}
          setTournamentType={setTournamentType}
          setBullOffMode={setBullOffMode}
          setMaxRounds={setMaxRounds}
          setLegs={setLegs}
          setScoringMode={setScoringMode}
          setCricketGameMode={setCricketGameMode}
          baseScore={baseScore}
          setBaseScore={setBaseScore}
          inMode={inMode}
          setInMode={setInMode}
          outMode={outMode}
          setOutMode={setOutMode}
          maxRounds={maxRounds}
          bullMode={bullMode}
          setBullMode={setBullMode}
          bullOffMode={bullOffMode}
          scoringMode={scoringMode}
          cricketGameMode={cricketGameMode}
          matchMode={matchMode}
          setMatchMode={setMatchMode}
          legs={legs}
          sets={sets}
          setSets={setSets}
          legsOfSet={legsOfSet}
          setLegsOfSet={setLegsOfSet}
          groupSize={groupSize}
          setGroupSize={setGroupSize}
          qualifiers={qualifiers}
          setQualifiers={setQualifiers}
          groupReturnLegs={groupReturnLegs}
          setGroupReturnLegs={setGroupReturnLegs}
          leagueReturnLegs={leagueReturnLegs}
          setLeagueReturnLegs={setLeagueReturnLegs}
          allPlayersOneGroup={allPlayersOneGroup}
          setAllPlayersOneGroup={setAllPlayersOneGroup}
          groupPhaseByes={groupPhaseByes}
          setGroupPhaseByes={setGroupPhaseByes}
          allBoards={allBoards}
          boards={boards}
          setBoards={setBoards}
          loadingBoards={loadingBoards}
          creatingTournament={creatingTournament}
          createTournament={createTournament}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          joinTournament={joinTournament}
          joiningTournament={joiningTournament}
          recentTournaments={recentTournaments}
          loadingRecentTournaments={loadingRecentTournaments}
          openTournament={openTournament}
        />
      )}

      <TournamentSettingsDialog
        isOpen={showSettingsDialog}
        mode={mode}
        tournamentType={tournamentType}
        settings={currentSettings}
        setSettings={(updater) => {
          const next = typeof updater === "function" ? updater(currentSettings) : updater;
          setTournamentType(next.tournamentType);
          setBaseScore(next.baseScore);
          setInMode(next.inMode);
          setOutMode(next.outMode);
          setMaxRounds(next.maxRounds);
          setBullMode(next.bullMode);
          setBullOffMode(next.bullOffMode);
          setScoringMode(next.scoringMode);
          setCricketGameMode(next.cricketGameMode);
          setMatchMode(next.matchMode);
          setLegs(next.legs);
          setSets(next.sets);
          setLegsOfSet(next.legsOfSet);
        }}
        formatSettings={tournamentFormatSettings}
        setFormatSettings={(updater) => {
          const next = typeof updater === "function" ? updater(tournamentFormatSettings) : updater;
          setGroupSize(next.groupSize);
          setQualifiers(next.qualifiers);
          setPlayAllPlaces(next.playAllPlaces);
          setGroupReturnLegs(next.groupReturnLegs);
          setLeagueReturnLegs(next.leagueReturnLegs);
        }}
        onClose={() => setShowSettingsDialog(false)}
        onSave={handleSaveTournamentSettings}
      />

      <RoundSettingsDialog
        isOpen={showRoundSettingsDialog}
        selectedRoundNumber={selectedRoundNumber}
        roundSettingsDraft={roundSettingsDraft}
        setRoundSettingsDraft={setRoundSettingsDraft}
        onClose={() => {
          setShowRoundSettingsDialog(false);
          setSelectedRoundNumber(null);
        }}
        onReset={handleResetRoundSettings}
        onSave={handleSaveRoundSettings}
      />

      <BoardSelectionDialog
        isOpen={showBoardDialog}
        selectedMatch={selectedMatch}
        freeBoards={freeBoards}
        selectedBoardId={selectedBoardId}
        setSelectedBoardId={setSelectedBoardId}
        selectedBoardName={selectedBoardName}
        onClose={() => {
          setShowBoardDialog(false);
          setSelectedBoardId("");
          setSelectedMatch(null);
        }}
        onConfirm={confirmStartMatch}
      />

      <EditResultDialog
        isOpen={showEditResultDialog}
        editingMatch={editingMatch}
        editingWinnerSlot={editingWinnerSlot}
        setEditingWinnerSlot={setEditingWinnerSlot}
        editingTargetWins={editingTargetWins}
        editingScoreLabel={editingScoreLabel}
        editingScore1={editingScore1}
        setEditingScore1={setEditingScore1}
        editingScore2={editingScore2}
        setEditingScore2={setEditingScore2}
        onClose={() => {
          setShowEditResultDialog(false);
          setEditingMatch(null);
          setEditingWinnerSlot("player1");
          setEditingScore1("");
          setEditingScore2("");
        }}
        onSave={handleSaveEditedResult}
      />

      <Toaster
        position="top-center"
        containerStyle={{ zIndex: 2147483647 }}
        toastOptions={{
          style: {
            background: "#1f2937",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "12px",
          },
        }}
      />
    </>
  );
}
