import React, { useMemo } from "react";
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
  DEFAULT_CRICKET_SETTINGS,
  DEFAULT_MATCH_SETTINGS,
  getTournamentTypeLabel,
} from "../../TournamentAppShared";

// ─── Helpers ────────────────────────────────────────────────────────────────

function nextPowerOfTwo(n) {
  if (n <= 1) return n;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Computes the effective GROUP_KO structure from current settings.
 * Returns null when mode is not GROUP_KO.
 */
function computeGroupKoPreview(playerCount, groupSize, qualifiersPerGroup) {
  if (playerCount < 1 || groupSize < 1) return null;

  const numGroups          = Math.ceil(playerCount / groupSize);
  const cappedQ            = Math.min(qualifiersPerGroup, groupSize);
  const totalQ             = numGroups * cappedQ;
  const koBracketSize      = totalQ >= 2 ? nextPowerOfTwo(totalQ) : 0;
  const koByeCount         = koBracketSize - totalQ;
  const lastGroupSize      = playerCount - (numGroups - 1) * groupSize;
  const lastGroupSmaller   = numGroups > 1 && lastGroupSize < groupSize;
  const qualifiersCapped   = qualifiersPerGroup > groupSize;

  return {
    numGroups,
    cappedQ,
    totalQ,
    koBracketSize,
    koByeCount,
    lastGroupSize,
    lastGroupSmaller,
    qualifiersCapped,
    hasKoBracket:  totalQ >= 2,
    onlyOneGroup:  numGroups <= 1,
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateConfig(mode, players, groupSize, qualifiers) {
  const errors   = [];
  const warnings = [];

  if (players.length < 2) {
    errors.push("Mindestens 2 Spieler erforderlich.");
  }

  if (mode === "GROUP_KO") {
    const preview = computeGroupKoPreview(players.length, groupSize, qualifiers);
    if (preview) {
      if (!preview.hasKoBracket) {
        errors.push(
          `Mit ${preview.totalQ} Qualifikant${preview.totalQ === 1 ? "" : "en"} kann keine KO-Runde gespielt werden. Erhöhe Qualifikanten oder Gruppen.`
        );
      }
      if (preview.onlyOneGroup) {
        warnings.push("Alle Spieler landen in einer Gruppe – erhöhe die Spieleranzahl oder verringere die Gruppengröße für mehrere Gruppen.");
      }
      if (preview.qualifiersCapped) {
        warnings.push(
          `Qualifikanten wurden auf die Gruppengröße (${groupSize}) begrenzt – du kannst nicht mehr Spieler qualifizieren als in der Gruppe sind.`
        );
      }
    }
  }

  return { errors, warnings, isValid: errors.length === 0 };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ValidationMsg({ type, children }) {
  const icon = type === "error" ? "✕" : type === "warn" ? "⚠" : "ℹ";
  return (
    <div className={`validation-msg validation-msg--${type === "error" ? "error" : type === "warn" ? "warn" : "info"}`}>
      <em className="validation-msg__icon">{icon}</em>
      <span>{children}</span>
    </div>
  );
}

function GroupKoPreview({ players, groupSize, qualifiers }) {
  const preview = computeGroupKoPreview(players.length, groupSize, qualifiers);
  if (!preview) return null;

  const { numGroups, cappedQ, totalQ, koBracketSize, koByeCount, lastGroupSmaller, lastGroupSize } = preview;

  return (
    <div className="tournament-preview">
      <div className="tournament-preview__title">Turnierstruktur (Vorschau)</div>

      <div className="tournament-preview__row">
        <span>Spieler</span>
        <strong>{players.length}</strong>
      </div>

      <div className={`tournament-preview__row ${numGroups <= 1 ? "tournament-preview__row--warn" : ""}`}>
        <span>Gruppen</span>
        <strong>
          {numGroups}
          {lastGroupSmaller ? ` (letzte Gruppe: ${lastGroupSize} Spieler)` : ""}
        </strong>
      </div>

      <div className="tournament-preview__row">
        <span>Qualifikanten pro Gruppe</span>
        <strong>{cappedQ}</strong>
      </div>

      <div className={`tournament-preview__row ${!preview.hasKoBracket ? "tournament-preview__row--err" : ""}`}>
        <span>Qualifikanten gesamt</span>
        <strong>{totalQ}</strong>
      </div>

      {preview.hasKoBracket && (
        <>
          <div className="tournament-preview__row tournament-preview__row--ok">
            <span>KO-Bracket Größe</span>
            <strong>{koBracketSize} Spieler</strong>
          </div>
          {koByeCount > 0 && (
            <div className="tournament-preview__row">
              <span>Freilose in KO-Runde</span>
              <strong>{koByeCount}</strong>
            </div>
          )}
        </>
      )}

      {!preview.hasKoBracket && (
        <div className="tournament-preview__row tournament-preview__row--err">
          <span>KO-Runde</span>
          <strong>Nicht möglich – zu wenige Qualifikanten</strong>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function HomeScreenComponent(props) {
  const {
    screen,
    players,
    playerName,
    setPlayerName,
    addPlayer,
    removePlayer,
    setScreen,
    tournamentName,
    setTournamentName,
    mode,
    setMode,
    playAllPlaces,
    setPlayAllPlaces,
    tournamentType,
    setTournamentType,
    setBullOffMode,
    setMaxRounds,
    setLegs,
    setScoringMode,
    setCricketGameMode,
    baseScore,
    setBaseScore,
    inMode,
    setInMode,
    outMode,
    setOutMode,
    maxRounds,
    bullMode,
    setBullMode,
    bullOffMode,
    scoringMode,
    cricketGameMode,
    matchMode,
    setMatchMode,
    legs,
    sets,
    setSets,
    legsOfSet,
    setLegsOfSet,
    groupSize,
    setGroupSize,
    qualifiers,
    setQualifiers,
    groupReturnLegs,
    setGroupReturnLegs,
    leagueReturnLegs,
    setLeagueReturnLegs,
    allBoards,
    boards,
    setBoards,
    loadingBoards,
    creatingTournament,
    createTournament,
    joinCode,
    setJoinCode,
    joinTournament,
    joiningTournament,
    recentTournaments,
    loadingRecentTournaments,
    openTournament,
  } = props;

  // Filtered dropdown options — only show valid choices
  const playerCount = players.length;

  const validGroupSizeOptions = useMemo(
    () => GROUP_SIZE_OPTIONS.filter((s) => s <= playerCount),
    [playerCount]
  );

  const validQualifierOptions = useMemo(
    () => QUALIFIER_OPTIONS.filter((q) => q <= groupSize),
    [groupSize]
  );

  // Live validation
  const { errors, warnings, isValid } = useMemo(
    () => validateConfig(mode, players, groupSize, qualifiers),
    [mode, players, groupSize, qualifiers]
  );

  const handleGroupSizeChange = (newSize) => {
    setGroupSize(newSize);
    // Clamp qualifiers if they now exceed the new group size
    if (qualifiers > newSize) {
      setQualifiers(Math.min(qualifiers, newSize));
    }
  };

  if (screen === "create") {
    return (
      <div className="tournament-layout">
        <div className="players-panel">
          <div className="panel-header">
            <div>
              <h2>Spieler</h2>
              <div className="panel-subtitle">Spielerliste für das neue Turnier</div>
            </div>
            <div className="players-count-badge">{players.length}</div>
          </div>

          <div className="player-add-row">
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Spielername eingeben"
              onKeyDown={(e) => { if (e.key === "Enter") addPlayer(); }}
            />
            <button className="btn btn--primary" onClick={addPlayer}>
              Hinzufügen
            </button>
          </div>

          <div className="players-list">
            {players.map((player) => (
              <div className="player-item" key={player}>
                <span>{player}</span>
                <button className="btn btn--icon remove-btn" onClick={() => removePlayer(player)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="tournament-container">
          <div className="form-topbar">
            <button className="btn btn--secondary" onClick={() => setScreen("home")}>
              Zurück
            </button>
          </div>

          <div className="form-hero">
            <h2>{tournamentName}</h2>
            <div className="panel-subtitle">
              Erstelle ein KO-, Gruppen- oder Liga-Turnier für Autodarts.
            </div>
          </div>

          <div className="config-sections">
            {/* ── General ─────────────────────────────────────── */}
            <div className="config-card">
              <div className="config-card-title">Allgemein</div>
              <div className="grid3">
                <div className="field">
                  <label>Turniermodus</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="KO">KO</option>
                    <option value="GROUP_KO">Gruppen + KO</option>
                    <option value="LEAGUE">Liga</option>
                  </select>
                </div>

                {mode !== "LEAGUE" && (
                  <div className="field">
                    <label>Platzierungsspiele</label>
                    <select
                      value={playAllPlaces ? "all" : "top_only"}
                      onChange={(e) => setPlayAllPlaces(e.target.value === "all")}
                    >
                      <option value="top_only">Nur Siegerbaum</option>
                      <option value="all">Alle KO-Plätze ausspielen</option>
                    </select>
                  </div>
                )}

                <div className="field">
                  <label>Turniertyp</label>
                  <select
                    value={tournamentType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setTournamentType(nextType);
                      if (nextType === "Cricket") {
                        setBullOffMode(DEFAULT_CRICKET_SETTINGS.bullOffMode);
                        setMaxRounds(DEFAULT_CRICKET_SETTINGS.maxRounds);
                        setLegs(DEFAULT_CRICKET_SETTINGS.legs);
                        setScoringMode(DEFAULT_CRICKET_SETTINGS.scoringMode);
                        setCricketGameMode(DEFAULT_CRICKET_SETTINGS.cricketGameMode);
                      } else {
                        setBullOffMode(DEFAULT_MATCH_SETTINGS.bullOffMode);
                      }
                    }}
                  >
                    {TOURNAMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {getTournamentTypeLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Match Settings ───────────────────────────────── */}
            <div className="config-card">
              <div className="config-card-title">Spiel-Einstellungen</div>
              <div className="grid">
                {tournamentType === "Cricket" ? (
                  <>
                    <div className="field">
                      <label>Game Mode</label>
                      <select value={cricketGameMode} onChange={(e) => setCricketGameMode(e.target.value)}>
                        {CRICKET_GAME_MODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Scoring</label>
                      <select value={scoringMode} onChange={(e) => setScoringMode(e.target.value)}>
                        {CRICKET_SCORING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Maximale Runden</label>
                      <select value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))}>
                        {MAX_ROUNDS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Bull-Off</label>
                      <select value={bullOffMode} onChange={(e) => setBullOffMode(e.target.value)}>
                        {BULL_OFF_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field">
                      <label>Startscore</label>
                      <select value={baseScore} onChange={(e) => setBaseScore(Number(e.target.value))}>
                        {SCORE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>In</label>
                      <select value={inMode} onChange={(e) => setInMode(e.target.value)}>
                        {MODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Out</label>
                      <select value={outMode} onChange={(e) => setOutMode(e.target.value)}>
                        {MODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Maximale Runden</label>
                      <select value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))}>
                        {MAX_ROUNDS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Bull-Modus</label>
                      <select value={bullMode} onChange={(e) => setBullMode(e.target.value)}>
                        {BULL_MODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Bull-Off</label>
                      <select value={bullOffMode} onChange={(e) => setBullOffMode(e.target.value)}>
                        {BULL_OFF_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div className="field">
                  <label>Match-Modus</label>
                  <select value={matchMode} onChange={(e) => setMatchMode(e.target.value)}>
                    {MATCH_MODE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {matchMode === "Legs" ? (
                  <div className="field">
                    <label>First to Legs</label>
                    <select value={legs} onChange={(e) => setLegs(Number(e.target.value))}>
                      {LEGS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label>First to Sets</label>
                      <select value={sets} onChange={(e) => setSets(Number(e.target.value))}>
                        {SETS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Legs pro Set</label>
                      <select value={legsOfSet} onChange={(e) => setLegsOfSet(Number(e.target.value))}>
                        {LEGS_OF_SET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Group / League Settings ──────────────────────── */}
            {(mode === "GROUP_KO" || mode === "LEAGUE") && (
              <div className="config-card">
                <div className="config-card-title">
                  {mode === "LEAGUE" ? "Liga" : "Gruppenphase"}
                </div>
                <div className="config-card-hint">
                  {mode === "LEAGUE"
                    ? "Liga spielt jeder gegen jeden. Mit Rückrunde spielt jedes Duell zweimal."
                    : "In Gruppen + KO gelten die globalen Spieleinstellungen für die Gruppenphase. Eigene Rundeneinstellungen kannst du später für die KO-Runden setzen."}
                </div>
                <div className="grid">
                  {mode === "GROUP_KO" && (
                    <>
                      <div className="field">
                        <label>Spieler pro Gruppe</label>
                        <select
                          value={groupSize}
                          onChange={(e) => handleGroupSizeChange(Number(e.target.value))}
                        >
                          {GROUP_SIZE_OPTIONS.map((o) => (
                            <option key={o} value={o} disabled={o > playerCount}>
                              {o}{o > playerCount ? " (zu viele)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field">
                        <label>Qualifikanten pro Gruppe</label>
                        <select
                          value={qualifiers}
                          onChange={(e) => setQualifiers(Number(e.target.value))}
                        >
                          {QUALIFIER_OPTIONS.map((o) => (
                            <option key={o} value={o} disabled={o > groupSize}>
                              {o}{o > groupSize ? " (> Gruppengröße)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="field">
                    <label>Rückrunde</label>
                    <select
                      value={(mode === "LEAGUE" ? leagueReturnLegs : groupReturnLegs) ? "double" : "single"}
                      onChange={(e) => {
                        const enabled = e.target.value === "double";
                        if (mode === "LEAGUE") setLeagueReturnLegs(enabled);
                        else setGroupReturnLegs(enabled);
                      }}
                    >
                      <option value="single">Ohne Rückrunde</option>
                      <option value="double">Mit Rückrunde</option>
                    </select>
                  </div>
                </div>

                {/* Live structure preview for GROUP_KO */}
                {mode === "GROUP_KO" && (
                  <GroupKoPreview
                    players={players}
                    groupSize={groupSize}
                    qualifiers={qualifiers}
                  />
                )}

                {/* Inline validation messages */}
                {mode === "GROUP_KO" && warnings.map((w, i) => (
                  <ValidationMsg key={i} type="warn">{w}</ValidationMsg>
                ))}
              </div>
            )}

            {/* ── Boards ──────────────────────────────────────── */}
            <div className="config-card">
              <div className="config-card-title">Verfügbare Autodarts-Boards</div>
              {loadingBoards ? (
                <div className="panel-subtitle">Boards werden geladen…</div>
              ) : (
                <div className="players-list">
                  {allBoards.map((board) => {
                    const isSelected = boards.some(
                      (s) => s.id === board.id || s.boardId === board.id,
                    );
                    return (
                      <label key={board.id} className="player-item board-select-item">
                        <span>{board.name || board.id}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setBoards((prev) =>
                              e.target.checked
                                ? [...prev, { id: board.id, boardId: board.id, name: board.name }]
                                : prev.filter((item) => item.id !== board.id && item.boardId !== board.id)
                            );
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Actions ─────────────────────────────────────── */}
            <div className="actions-with-error">
              {/* Show blocking errors above the button */}
              {errors.map((e, i) => (
                <ValidationMsg key={i} type="error">{e}</ValidationMsg>
              ))}

              <div className="actions">
                <button className="btn btn--secondary" onClick={() => setScreen("home")}>
                  Zurück
                </button>
                <button
                  className="btn btn--primary"
                  onClick={createTournament}
                  disabled={creatingTournament || !isValid}
                  title={!isValid ? errors[0] : undefined}
                >
                  {creatingTournament ? "Erstelle..." : "Turnier erstellen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Home / join screen ────────────────────────────────────────────────────
  return (
    <div className="start-screen">
      <div className="start-card">
        <div className="start-card-head">
          <div>
            <h2>Dart Cup</h2>
            <div className="start-subtitle">
              Turniere erstellen oder bestehendem Turnier beitreten.
            </div>
          </div>
        </div>

        <div className="config-sections">
          <div className="config-card join-card">
            <div className="config-card-title">Turnier erstellen</div>
            <div className="join-row">
              <input
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                placeholder="Turniername eingeben"
              />
              <button className="btn btn--primary" onClick={() => setScreen("create")}>
                {creatingTournament ? "erstelle..." : "Erstellen"}
              </button>
            </div>
          </div>

          <div className="config-sections">
            <div className="config-card join-card">
              <div className="config-card-title">Turnier öffnen</div>
              <div className="join-row">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Turniercode eingeben"
                />
                <button
                  className="btn btn--primary"
                  onClick={() => joinTournament()}
                  disabled={joiningTournament}
                >
                  {joiningTournament ? "Lade..." : "Beitreten"}
                </button>
              </div>
            </div>

            <div className="config-card join-card">
              <div className="config-card-title">Zuletzt geöffnete Turniere</div>

              {loadingRecentTournaments ? (
                <div className="recent-tournaments-empty">Letzte Turniere werden geladen...</div>
              ) : recentTournaments.length ? (
                <div className="recent-tournaments-list">
                  {recentTournaments.map((t) => (
                    <div key={t.id} className="recent-tournament-item">
                      <div className="recent-tournament-main">
                        <div className="recent-tournament-name">{t.name || "Unbenanntes Turnier"}</div>
                        <div className="recent-tournament-meta">
                          {t.code ? `Code: ${t.code}` : `ID: ${t.id}`}
                        </div>
                      </div>
                      <button
                        className="btn btn--primary"
                        onClick={() => openTournament(t)}
                        disabled={joiningTournament}
                      >
                        Beitreten
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="recent-tournaments-empty">
                  Noch keine zuletzt geöffneten Turniere gespeichert.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const HomeScreen = React.memo(HomeScreenComponent);
