import React, { useEffect, useMemo, useState } from "react";
import {
  buildFinalPlacements,
  buildGroupTables,
  buildSmartMatchQueue,
  canEditResult,
  canGiveUp,
  canRestartMatch,
  canStartMatch,
  cx,
  formatStatValue,
  getDisplayName,
  getFinalStatsColumns,
  getFinalStatsRow,
  getMatchResultLabel,
  getMatchTitle,
  getPlayerScore,
  getStatusClass,
  getStatusLabel,
  groupMatchesByRound,
  isLiveMatch,
  isTournamentFinished,
  sortMatchesByMatchNumber,
  sortPlayersForFinalTable,
  validateTournamentDataConsistency,
} from "../helpers/matchHelpers.js";

export function CollapsibleSection({
  title,
  subtitle,
  badge = null,
  defaultOpen = true,
  actions = null,
  className = "",
  children,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className={`collapsible-section ${className} ${isOpen ? "is-open" : "is-closed"}`.trim()}>
      <button type="button" className="collapse-toggle" onClick={() => setIsOpen((prev) => !prev)}>
        <div className="collapse-toggle-left">
          <span className={`collapse-chevron ${isOpen ? "open" : ""}`}>▾</span>
          <div className="collapse-title-wrap">
            <strong>{title}</strong>
            {subtitle && <span className="section-subtitle">{subtitle}</span>}
          </div>
        </div>

        <div className="collapse-toggle-right">
          {badge !== null && <span className="group-block-count">{badge}</span>}
          {actions ? <span className="collapse-inline-actions">{actions}</span> : null}
        </div>
      </button>

      {isOpen && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

function RoundSection({ title, subtitle, badge, defaultOpen = false, actions = null, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className={`round-section ${isOpen ? "is-open" : "is-closed"}`}>
      <button type="button" className="round-section-toggle" onClick={() => setIsOpen((prev) => !prev)}>
        <div className="round-section-toggle-left">
          <span className={`round-section-chevron ${isOpen ? "open" : ""}`}>▾</span>
          <div className="round-section-title-wrap">
            <strong>{title}</strong>
            {subtitle ? <span className="round-section-subtitle">{subtitle}</span> : null}
          </div>
        </div>

        <div className="round-section-toggle-right">
          {badge ? <span className="round-section-badge">{badge}</span> : null}
          {actions ? <span className="collapse-inline-actions">{actions}</span> : null}
        </div>
      </button>

      {isOpen ? <div className="round-section-content">{children}</div> : null}
    </div>
  );
}

function GroupStandingsTable({ standings, qualifiedPerGroup, matchMode, qualificationLabel = "Qualifikanten" }) {
  if (!standings?.length) return null;

  return (
    <div className="group-standings-card">
      <div className="group-standings-head">
        <strong>Tabelle</strong>
        <span>{qualifiedPerGroup > 0 ? `${qualifiedPerGroup} ${qualificationLabel}` : "Gesamttabelle"}</span>
      </div>

      <div className="group-standings-table-wrap">
        <table className="group-standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Spieler</th>
              <th>Sp</th>
              <th>S</th>
              <th>N</th>
              <th>Pkte</th>
              {matchMode === "Legs" && <th>Legs</th>}
              {matchMode === "Sets" && <th>Sets</th>}
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry) => (
              <tr key={entry.key} className={entry.isQualified ? "qualified-row" : ""}>
                <td>{entry.rank}</td>
                <td>
                  <div className="group-player-cell">
                    <span>{entry.player?.name || "—"}</span>
                    {qualifiedPerGroup > 0 && entry.rank <= qualifiedPerGroup && <span className="qualified-badge">Q</span>}
                  </div>
                </td>
                <td>{entry.played}</td>
                <td>{entry.wins}</td>
                <td>{entry.losses}</td>
                <td>{entry.points}</td>
                {matchMode === "Sets" ? (
                  <>
                    <td>{entry.setsWon}:{entry.setsLost}</td>
                    <td>{entry.setDiff > 0 ? `+${entry.setDiff}` : entry.setDiff}</td>
                  </>
                ) : (
                  <>
                    <td>{entry.legsWon}:{entry.legsLost}</td>
                    <td>{entry.legDiff > 0 ? `+${entry.legDiff}` : entry.legDiff}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchPlayerRow({ match, slot, matchMode, onGiveUpMatch }) {
  const player = slot === "player1" ? match.player1 : match.player2;
  const score = getPlayerScore(match, slot, matchMode);
  const isDoubleBye = match?.player1?.type === "bye" && match?.player2?.type === "bye";
  const isWinner = !isDoubleBye && match?.winner && player && match.winner === player;

  return (
    <div className={cx("player-row", "compact-player-row", isWinner && "winner-row")}>
      <div className="player-row-main">
        <span className="player-name-text">{getDisplayName(player)}</span>
        {isWinner && <span className="winner-badge">Sieger</span>}
      </div>

      <div className="player-row-actions">
        {score !== null && <span className="player-score">{score}</span>}
        {canGiveUp(match) && (
          <button type="button" className="btn btn--danger btn--xs" onClick={() => onGiveUpMatch(match, slot)}>
            Aufgeben
          </button>
        )}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  matchMode,
  onStartMatch,
  onGiveUpMatch,
  onEditResult,
  onRestartMatch,
  onAbortLiveMatch,
  labelPrefix = "",
}) {
  return (
    <div className="match-card compact-card match-card-enhanced" key={`${labelPrefix}${match.matchNumber}`}>
      <div className="match-head">
        <div className="match-title-stack">
          <span className="match-number">{getMatchTitle(match, labelPrefix)}</span>
          {match.group && <span className="match-subline">{match.group}</span>}
        </div>

        <span className={`status-pill ${getStatusClass(match.status)}`}>{getStatusLabel(match)}</span>
      </div>

      {(match?.manuallyCorrectedAt || match?.resultSource === "manual") && (
        <div className="match-subline match-subline--manual">Ergebnis manuell überschrieben</div>
      )}

      <div className="match-body">
        <MatchPlayerRow match={match} slot="player1" matchMode={matchMode} onGiveUpMatch={onGiveUpMatch} />
        <MatchPlayerRow match={match} slot="player2" matchMode={matchMode} onGiveUpMatch={onGiveUpMatch} />
      </div>

      <div className="match-foot">
        <span>{getMatchResultLabel(match)}</span>
        <span>{getDisplayName(match.winner)}</span>
      </div>

      <div className="match-card-actions">
        {canStartMatch(match) && (
          <button className="btn btn--primary btn--compact btn--full" onClick={() => onStartMatch(match)}>
            Starten
          </button>
        )}

        {isLiveMatch(match) && match.lobbyId && (
          <>
            <button
              className="btn btn--secondary btn--compact open-match"
              onClick={() => window.open(`https://play.autodarts.io/matches/${match.lobbyId}`, "_blank", "noopener,noreferrer")}
            >
              Spiel öffnen
            </button>

            <button className="btn btn--secondary btn--compact" onClick={() => onAbortLiveMatch(match)}>
              Abbrechen
            </button>
          </>
        )}

        {canRestartMatch(match) && (
          <button className="btn btn--secondary btn--compact" onClick={() => onRestartMatch(match)}>
            Spiel neu starten
          </button>
        )}

        {canEditResult(match) && (
          <button className="btn btn--secondary btn--compact" onClick={() => onEditResult(match)}>
            {match.status === "aborted" ? "Ergebnis eingeben" : "Ergebnis korrigieren"}
          </button>
        )}
      </div>
    </div>
  );
}

export function BoardOverview({ boards, matches, onReleaseBoard, compact = false }) {
  if (!boards?.length) return null;

  const getMatchLabel = (match) => match ? `Spiel ${match.matchNumber}: ${getDisplayName(match.player1)} vs. ${getDisplayName(match.player2)}` : "Kein Spiel";

  const content = (
    <div className="group-match-grid board-grid compact-board-grid">
      {boards.map((board) => {
        const currentMatch = matches.find((match) => match.id === board.currentMatchId);
        const isBusy = board.status !== "free" || !!board.currentMatchId;

        return (
          <div key={board.id} className="match-card compact-card board-card">
            <div className="match-head">
              <div className="match-title-stack">
                <span className="board-name">{board.name || board.boardId || board.id}</span>
                <span className="match-subline">Board</span>
              </div>

              <span className={`status-pill ${isBusy ? "status-live" : "status-finished"}`}>{isBusy ? "Belegt" : "Frei"}</span>
            </div>

            <div className="board-meta-list">
              <div className="board-meta-row"><span>Board-ID</span><span>{board.boardId || board.id}</span></div>
              <div className="board-meta-row"><span>Aktuelles Spiel</span><span>{getMatchLabel(currentMatch)}</span></div>
            </div>

            {isBusy && (
              <button className="btn btn--secondary btn--compact" onClick={() => onReleaseBoard(board, currentMatch)}>
                Manuell freigeben
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  if (compact) return <div className="dialog-panel-content">{content}</div>;

  return (
    <div className="tree-section">
      <CollapsibleSection title="Boards" subtitle="Live-Zuordnung und manuelle Freigabe" badge={`${boards.length} Boards`} defaultOpen={false}>
        {content}
      </CollapsibleSection>
    </div>
  );
}

export function OverviewStats({ matches, boards, playersCount, mode, compact = false }) {
  const totalMatches = matches.length;
  const finishedMatches = matches.filter((m) => m.status === "finished").length;
  const liveMatches = matches.filter((m) => ["started", "live", "running"].includes(m.status)).length;
  const pendingMatches = matches.filter((m) => m.status === "pending").length;
  const totalBoards = boards.length;
  const freeBoardCount = boards.filter((b) => !b.currentMatchId && b.status === "free").length;
  const busyBoards = totalBoards - freeBoardCount;

  const cards = [
    { label: "Spieler", value: playersCount },
    { label: "Modus", value: mode === "KO" ? "KO" : "Gruppen + KO" },
    { label: "Spiele gesamt", value: totalMatches },
    { label: "Offen", value: pendingMatches },
    { label: "Live", value: liveMatches },
    { label: "Fertig", value: finishedMatches },
    { label: "Freie Boards", value: freeBoardCount },
    { label: "Belegte Boards", value: busyBoards },
  ];

  const content = (
    <div className={`overview-stats-grid ${compact ? "overview-stats-grid--compact" : ""}`.trim()}>
      {cards.map((card) => (
        <div className="overview-stat-card" key={card.label}>
          <div className="overview-stat-label">{card.label}</div>
          <div className="overview-stat-value">{card.value}</div>
        </div>
      ))}
    </div>
  );

  if (compact) return <div className="dialog-panel-content">{content}</div>;

  return (
    <CollapsibleSection title="Übersicht" subtitle="Turnier- und Boardstatus auf einen Blick" badge={`${totalMatches} Spiele`} className="overview-collapsible" defaultOpen={false}>
      {content}
    </CollapsibleSection>
  );
}


export function FocusDashboard({
  matches,
  boards,
  mode,
  matchMode,
  onStartMatch,
  onGiveUpMatch,
  onEditResult,
  onRestartMatch,
  onAbortLiveMatch,
}) {
  const liveMatches = useMemo(
    () => sortMatchesByMatchNumber(matches.filter((match) => isLiveMatch(match))),
    [matches],
  );
const nextMatchLimit = useMemo(() => {
  const pendingMatches = matches.filter((m) => m?.status === "pending");

  if (!pendingMatches.length) return 0;

  const freeBoards = Array.isArray(boards)
    ? boards.filter((board) => !board?.currentMatchId && board?.status === "free").length
    : 0;

  const boardLimit = freeBoards > 0 ? freeBoards : (boards?.length || 6);

  // Liga zählt NICHT als mehrere Gruppen in der Fokus-Queue,
  // sondern soll nach Boards limitiert werden.
  if (mode === "LEAGUE") {
    return boardLimit;
  }

  // Nur echte Gruppenphase nach Gruppen limitieren
  if (mode === "GROUP_KO") {
    const pendingGroupMatches = pendingMatches.filter((m) => m?.group);

    if (pendingGroupMatches.length) {
      const distinctGroups = new Set(
        pendingGroupMatches
          .map((m) => String(m.group || "").trim())
          .filter(Boolean),
      );

      return Math.max(1, distinctGroups.size);
    }
  }

  // KO / Fallback
  return boardLimit;
}, [matches, boards, mode]);

const nextMatches = useMemo(
  () => buildSmartMatchQueue(matches, nextMatchLimit),
  [matches, nextMatchLimit],
);

  const finishedMatches = useMemo(
    () => [...matches]
      .filter((match) => match?.status === "finished")
      .sort((a, b) => Number(b?.finishedAt || b?.updatedAt || b?.matchNumber || 0) - Number(a?.finishedAt || a?.updatedAt || a?.matchNumber || 0))
      .slice(0, 6),
    [matches],
  );

  if (!matches?.length) return null;

  return (
    <div className="tree-section">
      <CollapsibleSection
        title="Fokus-Ansicht"
        subtitle="Jetzt wichtige Spiele zuerst bearbeiten"
        badge={`${liveMatches.length} live`}
        defaultOpen={true}
        className="focus-collapsible"
      >
        <div className="focus-dashboard-grid">
          <div className="focus-panel focus-panel--live">
            <div className="focus-panel-head">
              <strong>Jetzt aktiv</strong>
              <span>{liveMatches.length}</span>
            </div>
            {liveMatches.length ? (
              <div className="focus-card-list">
                {liveMatches.map((match) => (
                  <MatchCard
                    key={`focus-live-${match.id || match.matchNumber}`}
                    match={match}
                    matchMode={matchMode}
                    onStartMatch={onStartMatch}
                    onGiveUpMatch={onGiveUpMatch}
                    onEditResult={onEditResult}
                    onRestartMatch={onRestartMatch}
                    onAbortLiveMatch={onAbortLiveMatch}
                  />
                ))}
              </div>
            ) : (
              <div className="focus-empty-state">Gerade läuft kein Spiel.</div>
            )}
          </div>

          <div className="focus-panel">
            <div className="focus-panel-head">
              <strong>Als Nächstes starten</strong>
              <span>{nextMatches.length}</span>
            </div>
            {nextMatches.length ? (
              <div className="focus-card-list">
                {nextMatches.map((match) => (
                  <MatchCard
                    key={`focus-next-${match.id || match.matchNumber}`}
                    match={match}
                    matchMode={matchMode}
                    onStartMatch={onStartMatch}
                    onGiveUpMatch={onGiveUpMatch}
                    onEditResult={onEditResult}
                    onRestartMatch={onRestartMatch}
                    onAbortLiveMatch={onAbortLiveMatch}
                  />
                ))}
              </div>
            ) : (
              <div className="focus-empty-state">Es gibt keine offenen Spiele mehr.</div>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

export function PlayerStatsTable({ players, tournamentType, matchMode }) {
  const sortedPlayers = useMemo(() => sortPlayersForFinalTable(players), [players]);

  if (!sortedPlayers.length) return null;

  const isCricket = tournamentType === "Cricket";

  return (
    <div className="tree-section">
      <CollapsibleSection
        title="Spieler-Statistik"
        subtitle="Aggregierte Werte aus allen beendeten Matches"
        badge={`${sortedPlayers.length} Spieler`}
        defaultOpen={false}
      >
        <div className="final-standings-wrap">
          <table className="final-standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Spieler</th>
                <th>Sp</th>
                <th>S</th>
                <th>N</th>
                {matchMode === "Sets" ? <th>Sets</th> : <th>Legs</th>}
                {isCricket ? (
                  <>
                    <th>MPR</th>
                    <th>First 9 MPR</th>
                    <th>5M</th>
                    <th>6M</th>
                    <th>7M</th>
                    <th>8M</th>
                    <th>9M</th>
                    <th>WH</th>
                  </>
                ) : (
                  <>
                    <th>Average</th>
                    <th>CO %</th>
                    <th>60+</th>
                    <th>100+</th>
                    <th>140+</th>
                    <th>170+/180</th>
                    <th>Best CO</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => (
                <tr key={`player-stats-${player.id || player.name || index}`}>
                  <td className="final-standings-rank">{index + 1}</td>
                  <td className="final-standings-player">{player.name}</td>
                  <td className="final-standings-stat">{Number(player.matchesPlayed || 0)}</td>
                  <td className="final-standings-stat">{Number(player.wins || 0)}</td>
                  <td className="final-standings-stat">{Number(player.losses || 0)}</td>
                  {matchMode === "Sets" ? (
                    <td className="final-standings-stat">{Number(player.setsWon || 0)} / {Number(player.setsLost || 0)}</td>
                  ) : (
                    <td className="final-standings-stat">{Number(player.legsWon || 0)} / {Number(player.legsLost || 0)}</td>
                  )}
                  {isCricket ? (
                    <>
                      <td className="final-standings-stat">{formatStatValue(player.mpr, 2)}</td>
                      <td className="final-standings-stat">{formatStatValue(player.first9MPR, 2)}</td>
                      <td className="final-standings-stat">{Number(player.mark5 || 0)}</td>
                      <td className="final-standings-stat">{Number(player.mark6 || 0)}</td>
                      <td className="final-standings-stat">{Number(player.mark7 || 0)}</td>
                      <td className="final-standings-stat">{Number(player.mark8 || 0)}</td>
                      <td className="final-standings-stat">{Number(player.mark9 || 0)}</td>
                      <td className="final-standings-stat">{Number(player.whiteHorse || 0)}</td>
                    </>
                  ) : (
                    <>
                      <td className="final-standings-stat">{formatStatValue(player.average, 1)}</td>
                      <td className="final-standings-stat">{formatStatValue(player.checkoutPercent, 1)}%</td>
                      <td className="final-standings-stat">{Number(player.plus60 || 0)}</td>
                      <td className="final-standings-stat">{Number(player.plus100 || 0)}</td>
                      <td className="final-standings-stat">{Number(player.plus140 || 0)}</td>
                      <td className="final-standings-stat">{Number(player.plus170Or180 || 0)}</td>
                      <td className="final-standings-stat">{Number(player.bestCheckout || 0)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </div>
  );
}

export function ConsistencyPanel({ matches, players }) {
  const report = useMemo(() => validateTournamentDataConsistency(matches, players), [matches, players]);

  if (report.valid && report.warnings.length === 0) return null;

  return (
    <div className="tree-section">
      <CollapsibleSection
        title="Datenprüfung"
        subtitle="Schnellcheck für Match- und DB-Konsistenz"
        badge={report.valid ? `${report.warnings.length} Hinweise` : `${report.errors.length} Fehler`}
        defaultOpen={false}
      >
        {report.errors.length > 0 ? (
          <div className="focus-empty-state">
            <strong>Fehler</strong>
            <ul>
              {report.errors.slice(0, 20).map((entry, index) => <li key={`consistency-error-${index}`}>{entry}</li>)}
            </ul>
          </div>
        ) : null}
        {report.warnings.length > 0 ? (
          <div className="focus-empty-state">
            <strong>Hinweise</strong>
            <ul>
              {report.warnings.slice(0, 20).map((entry, index) => <li key={`consistency-warning-${index}`}>{entry}</li>)}
            </ul>
          </div>
        ) : null}
      </CollapsibleSection>
    </div>
  );
}

export function FinalStandingsTable({ matches, players, tournamentName, tournamentType, matchMode }) {
  const tournamentFinished = useMemo(() => isTournamentFinished(matches), [matches]);
  const hasRealPlacements = useMemo(
    () => matches.some((match) => match?.status === "finished" && (typeof match?.winnerPlace === "number" || typeof match?.loserPlace === "number")),
    [matches],
  );

  const sortedPlayers = useMemo(() => {
    if (hasRealPlacements) return buildFinalPlacements(matches, players);
    return sortPlayersForFinalTable(players).map((player, index) => ({ ...player, finalPlace: index + 1 }));
  }, [hasRealPlacements, matches, players]);

  if (!tournamentFinished || !sortedPlayers.length) return null;

  return (
    <div className="tree-section">
      <CollapsibleSection
        title="Abschlusstabelle"
        subtitle={`Endstand von ${tournamentName || "dem Turnier"}`}
        badge={`${sortedPlayers.length} Spieler`}
        defaultOpen={true}
      >
        <div className="final-standings-wrap">
          <table className="final-standings-table">
            <thead>
              <tr>
                {getFinalStatsColumns(matchMode, tournamentType).map((column) => <th key={column.key}>{column.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => {
                const rank = player.finalPlace ?? index + 1;
                const highlightClass = rank <= 3 ? "is-highlighted" : "";
                return (
                  <tr key={player.id || player.name}>
                    <td className="final-standings-rank">{rank}</td>
                    <td className="final-standings-player">{player.name}</td>
                    <td className={cx("final-standings-stat", highlightClass)}>{Number(player.wins || 0)}</td>
                    <td className={cx("final-standings-stat", highlightClass)}>{Number(player.losses || 0)}</td>
                    {matchMode === "Sets" ? <td className={cx("final-standings-stat", highlightClass)}>{Number(player.setsWon || 0)} / {Number(player.setsLost || 0)}</td>:
                    <td className={cx("final-standings-stat", highlightClass)}>{Number(player.legsWon || 0)} / {Number(player.legsLost || 0)}</td>}
                    {tournamentType === "Cricket" ? (
                      <>
                        <td className={cx("final-standings-stat", highlightClass)}>{formatStatValue(player.mpr, 2)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{formatStatValue(player.first9MPR, 2)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.mark5 || 0)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.mark6 || 0)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.mark7 || 0)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.mark8 || 0)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.mark9 || 0)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.whiteHorse || 0)}</td>
                      </>
                    ) : (
                      <>
                        <td className={cx("final-standings-stat", highlightClass)}>{formatStatValue(player.average, 1)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{formatStatValue(player.checkoutPercent, 1)}%</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.plus60 || 0)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.plus100 || 0)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.plus140 || 0)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.plus170Or180 || 0)}</td>
                        <td className={cx("final-standings-stat", highlightClass)}>{Number(player.bestCheckout || 0)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function GroupRoundSection({ groupName, roundBlock, matchMode, onStartMatch, onGiveUpMatch, onEditResult, onRestartMatch, onAbortLiveMatch }) {
  const roundMatches = sortMatchesByMatchNumber(roundBlock.matches);
  const finishedMatches = roundMatches.filter((match) => match.status === "finished").length;

  return (
    <RoundSection
      title={`Spielrunde ${roundBlock.round}`}
      subtitle="Diese Spiele können parallel gestartet werden"
      badge={`${finishedMatches}/${roundMatches.length} fertig`}
      defaultOpen={roundBlock.round === 1}
    >
      <div className="round-match-grid round-match-grid--compact">
        {roundMatches.map((match) => (
          <MatchCard
            key={`${groupName}-${match.matchNumber}`}
            match={match}
            matchMode={matchMode}
            onStartMatch={onStartMatch}
            onGiveUpMatch={onGiveUpMatch}
            onEditResult={onEditResult}
            onRestartMatch={onRestartMatch}
            onAbortLiveMatch={onAbortLiveMatch}
          />
        ))}
      </div>
    </RoundSection>
  );
}

export function TournamentTree({
  matches,
  groups,
  mode,
  matchMode,
  qualifiedPerGroup,
  onStartMatch,
  onGiveUpMatch,
  onEditResult,
  onRestartMatch,
  onAbortLiveMatch,
  tournamentId,
  roundSettings,
  onOpenRoundSettings,
}) {
  const groupMatches = useMemo(() => sortMatchesByMatchNumber(matches.filter((match) => match.group)), [matches]);
  const effectiveQualifiedPerGroup = mode === "LEAGUE" ? 0 : qualifiedPerGroup;
  const groupTables = useMemo(() => buildGroupTables(matches, groups, effectiveQualifiedPerGroup), [matches, groups, effectiveQualifiedPerGroup]);
  const knockoutMatches = useMemo(() => matches.filter((match) => !match.group), [matches]);
  const groupedRounds = useMemo(() => groupMatchesByRound(knockoutMatches), [knockoutMatches]);
  const [initialGroupPhaseOpen, setInitialGroupPhaseOpen] = useState(true);
  const [initialGroupOpenMap, setInitialGroupOpenMap] = useState({});
  const [initialRoundOpenMap, setInitialRoundOpenMap] = useState({});

  useEffect(() => {
    const groupsPhaseComplete = groupTables.length > 0 && groupTables.every((group) => group.isComplete);
    const nextGroupOpenMap = {};
    for (const groupTable of groupTables) nextGroupOpenMap[groupTable.name] = !groupTable.isComplete;

    const firstOpenRoundIndex = groupedRounds.findIndex((roundBlock) => roundBlock.matches.some((match) => match.status !== "finished"));
    const nextRoundOpenMap = {};
    groupedRounds.forEach((roundBlock, index) => {
      nextRoundOpenMap[roundBlock.round] = firstOpenRoundIndex !== -1 && index === firstOpenRoundIndex;
    });

    setInitialGroupPhaseOpen(!groupsPhaseComplete);
    setInitialGroupOpenMap(nextGroupOpenMap);
    setInitialRoundOpenMap(nextRoundOpenMap);
  }, [tournamentId, groupTables, groupedRounds]);

  if (!matches?.length) return null;

  return (
    <div className="tree-wrapper">
      {(mode === "GROUP_KO" || mode === "LEAGUE") && groupMatches.length > 0 && (
        <div className="tree-section">
          <CollapsibleSection title={mode === "LEAGUE" ? "Liga" : "Gruppenphase"} subtitle={mode === "LEAGUE" ? "Alle Ligaspiele mit Tabelle" : "Alle Gruppenspiele mit aktueller Tabelle"} badge={`${groupMatches.length} Spiele`} defaultOpen={initialGroupPhaseOpen}>
            <div className="phase-settings-note">
              {mode === "LEAGUE"
                ? "Liga ist eine große Gruppenphase. Alle Spieler treten gegeneinander an."
                : "Für die Gruppenphase gelten die globalen Spieleinstellungen. Rundeneinstellungen gelten nur für die KO-Runden."}
            </div>
            <div className="group-sections">
              {groupTables.map((groupTable) => (
                <div className="group-block" key={groupTable.name}>
                  <CollapsibleSection title={groupTable.name} subtitle={`${groupTable.finishedMatches}/${groupTable.totalMatches} Spiele fertig`} badge={groupTable.isComplete ? "Komplett" : "Laufend"} defaultOpen={initialGroupOpenMap[groupTable.name] ?? true}>
                    <div className="group-block-layout group-block-layout--dense">
                      <GroupStandingsTable standings={groupTable.standings} qualifiedPerGroup={effectiveQualifiedPerGroup} qualificationLabel={mode === "LEAGUE" ? "Topplätze" : "Qualifikanten"} matchMode={matchMode} />
                      <div className="group-rounds-grid">
                        {groupMatchesByRound(groupTable.matches).map((roundBlock) => (
                          <GroupRoundSection
                            key={`${groupTable.name}-round-${roundBlock.round}`}
                            groupName={groupTable.name}
                            roundBlock={roundBlock}
                            matchMode={matchMode}
                            onStartMatch={onStartMatch}
                            onGiveUpMatch={onGiveUpMatch}
                            onEditResult={onEditResult}
                            onRestartMatch={onRestartMatch}
                            onAbortLiveMatch={onAbortLiveMatch}
                          />
                        ))}
                      </div>
                    </div>
                  </CollapsibleSection>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {mode !== "LEAGUE" && (
      <div className="tree-section">
        <CollapsibleSection title={mode === "KO" ? "KO-Phase" : "Finalrunde"} subtitle="Runde für Runde im Turnierbaum" badge={`${groupedRounds.length} Runden`} defaultOpen={true}>
          <div className="round-sections round-sections-grid">
            {groupedRounds.map((roundBlock) => {
              const roundMatches = sortMatchesByMatchNumber(roundBlock.matches);
              return (
                <RoundSection
                  key={`round-${roundBlock.round}`}
                  title={`Runde ${roundBlock.round}`}
                  subtitle={roundSettings?.[String(roundBlock.round)] ? "Eigene Spieleinstellungen aktiv" : "Spiele dieser Runde"}
                  badge={`${roundMatches.length} ${roundMatches.length === 1 ? "Spiel" : "Spiele"}`}
                  defaultOpen={initialRoundOpenMap[roundBlock.round] ?? false}
                  actions={
                    <span
                      role="button"
                      tabIndex={0}
                      className="btn btn--secondary btn--xs"
                      onClick={(event) => { event.stopPropagation(); onOpenRoundSettings?.(roundBlock.round); }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onOpenRoundSettings?.(roundBlock.round);
                        }
                      }}
                    >
                      Rundeneinstellungen
                    </span>
                  }
                >
                  <div className="round-match-grid">
                    {roundMatches.map((match) => (
                      <MatchCard key={`ko-${match.matchNumber}`} match={match} matchMode={matchMode} onStartMatch={onStartMatch} onGiveUpMatch={onGiveUpMatch} onEditResult={onEditResult} onRestartMatch={onRestartMatch} onAbortLiveMatch={onAbortLiveMatch} labelPrefix="Spiel" />
                    ))}
                  </div>
                </RoundSection>
              );
            })}
          </div>
        </CollapsibleSection>
      </div>
      )}
    </div>
  );
}
