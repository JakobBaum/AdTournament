import React, { useMemo, useState } from "react";
import { getTournamentTypeLabel, getModeLabel } from "../../TournamentAppShared";
import { ConsistencyPanel, FinalStandingsTable, FocusDashboard, PlayerStatsTable, TournamentTree } from "../components/TournamentPanels.jsx";
import { BoardsDialog, OverviewDialog } from "../dialogs/TournamentDialogs.jsx";

function TournamentScreenComponent(props) {
  const {
    tournamentName,
    tournamentCode,
    tournamentType,
    mode,
    setShowSettingsDialog,
    handleLeaveTournament,
    matches,
    boards,
    playerDocs,
    handleReleaseBoard,
    groups,
    matchMode,
    qualifiers,
    handleStartMatch,
    handleGiveUpMatch,
    handleOpenEditResult,
    handleRestartMatch,
    handleAbortLiveMatch,
    tournamentId,
    roundSettingsMap,
    openRoundSettingsDialog,
  } = props;

  const [showOverviewDialog, setShowOverviewDialog] = useState(false);
  const [showBoardsDialog, setShowBoardsDialog] = useState(false);

  const summaryStats = useMemo(() => {
    const totalMatches = matches.length;
    const liveMatches = matches.filter((match) => ["started", "live", "running"].includes(match.status)).length;
    const finishedMatches = matches.filter((match) => match.status === "finished").length;
    const openMatches = matches.filter((match) => match.status === "pending").length;
    const freeBoards = boards.filter((board) => !board.currentMatchId && board.status === "free").length;

    return [
      { label: "Spieler", value: playerDocs.length },
      { label: "Offen", value: openMatches },
      { label: "Live", value: liveMatches },
      { label: "Fertig", value: finishedMatches },
      { label: "Freie Boards", value: freeBoards },
      { label: "Spiele", value: totalMatches },
    ];
  }, [matches, boards, playerDocs.length]);

  return (
    <div className="tournament-bracket-only">
      <div className="bracket-page-shell">
        <div className="bracket-hero">
          <div className="bracket-header">
            <div>
              <h2>
                {tournamentName}
                {tournamentCode && <span className="code-badge">Code: {tournamentCode}</span>}
              </h2>
              <div className="bracket-subtitle">
                {`${getTournamentTypeLabel(tournamentType)} · ${getModeLabel(mode)}`}
              </div>
            </div>

            <div className="bracket-header-actions">
              <button className="btn btn--secondary btn--compact" onClick={() => setShowOverviewDialog(true)}>
                Übersicht
              </button>
              <button className="btn btn--secondary btn--compact" onClick={() => setShowBoardsDialog(true)}>
                Boards
              </button>
              <button className="btn btn--secondary btn--compact" onClick={() => setShowSettingsDialog(true)}>
                Einstellungen
              </button>
              <button className="btn btn--secondary btn--compact" onClick={handleLeaveTournament}>
                Verlassen
              </button>
            </div>
          </div>

          <div className="hero-summary-strip">
            {summaryStats.map((item) => (
              <div className="hero-summary-chip" key={item.label}>
                <span className="hero-summary-value">{item.value}</span>
                <span className="hero-summary-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <FocusDashboard
          matches={matches}
          boards={boards}
          mode={mode}
          matchMode={matchMode}
          onStartMatch={handleStartMatch}
          onGiveUpMatch={handleGiveUpMatch}
          onEditResult={handleOpenEditResult}
          onRestartMatch={handleRestartMatch}
          onAbortLiveMatch={handleAbortLiveMatch}
        />

        <TournamentTree
          matches={matches}
          groups={groups}
          mode={mode}
          matchMode={matchMode}
          qualifiedPerGroup={qualifiers}
          onStartMatch={handleStartMatch}
          onGiveUpMatch={handleGiveUpMatch}
          onEditResult={handleOpenEditResult}
          onRestartMatch={handleRestartMatch}
          onAbortLiveMatch={handleAbortLiveMatch}
          tournamentId={tournamentId}
          roundSettings={roundSettingsMap}
          onOpenRoundSettings={openRoundSettingsDialog}
          tournamentType={tournamentType}
        />

        <PlayerStatsTable
          players={playerDocs}
          tournamentType={tournamentType}
          matchMode={matchMode}
        />

        <ConsistencyPanel
          matches={matches}
          players={playerDocs}
        />

        <FinalStandingsTable
          matches={matches}
          players={playerDocs}
          tournamentName={tournamentName}
          tournamentType={tournamentType}
          matchMode={matchMode}
        />
      </div>

      <OverviewDialog
        isOpen={showOverviewDialog}
        matches={matches}
        boards={boards}
        playersCount={playerDocs.length}
        mode={mode}
        onClose={() => setShowOverviewDialog(false)}
      />

      <BoardsDialog
        isOpen={showBoardsDialog}
        boards={boards}
        matches={matches}
        onReleaseBoard={handleReleaseBoard}
        onClose={() => setShowBoardsDialog(false)}
      />
    </div>
  );
}

export const TournamentScreen = React.memo(TournamentScreenComponent);
