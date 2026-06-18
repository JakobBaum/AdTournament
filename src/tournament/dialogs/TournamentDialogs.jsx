import React from "react";
import {
  BULL_MODE_OPTIONS,
  BULL_OFF_OPTIONS,
  CRICKET_GAME_MODE_OPTIONS,
  CRICKET_SCORING_OPTIONS,
  MATCH_MODE_OPTIONS,
  MAX_ROUNDS_OPTIONS,
  MODE_OPTIONS,
  SCORE_OPTIONS,
  LEGS_OPTIONS,
  SETS_OPTIONS,
  LEGS_OF_SET_OPTIONS,
  QUALIFIER_OPTIONS,
  GROUP_SIZE_OPTIONS,
} from "../../TournamentAppShared.js";
import { getDisplayName } from "../helpers/matchHelpers.js";
import { BoardOverview, OverviewStats } from "../components/TournamentPanels.jsx";

function MatchSettingsFields({ settings, onChange, tournamentType, modeKey = "matchMode" }) {
  const isCricket = tournamentType === "Cricket";

  const update = (key, value) => onChange((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="grid">
      {isCricket ? (
        <>
          <div className="field">
            <label>Cricket Modus</label>
            <select value={settings.cricketGameMode} onChange={(e) => update("cricketGameMode", e.target.value)}>
              {CRICKET_GAME_MODE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Scoring</label>
            <select value={settings.scoringMode} onChange={(e) => update("scoringMode", e.target.value)}>
              {CRICKET_SCORING_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Maximale Runden</label>
            <select value={settings.maxRounds} onChange={(e) => update("maxRounds", Number(e.target.value))}>
              {MAX_ROUNDS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Bull-Off</label>
            <select value={settings.bullOffMode} onChange={(e) => update("bullOffMode", e.target.value)}>
              {BULL_OFF_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label>Startscore</label>
            <select value={settings.baseScore} onChange={(e) => update("baseScore", Number(e.target.value))}>
              {SCORE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label>In</label>
            <select value={settings.inMode} onChange={(e) => update("inMode", e.target.value)}>
              {MODE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Out</label>
            <select value={settings.outMode} onChange={(e) => update("outMode", e.target.value)}>
              {MODE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Maximale Runden</label>
            <select value={settings.maxRounds} onChange={(e) => update("maxRounds", Number(e.target.value))}>
              {MAX_ROUNDS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Bull-Modus</label>
            <select value={settings.bullMode} onChange={(e) => update("bullMode", e.target.value)}>
              {BULL_MODE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Bull-Off</label>
            <select value={settings.bullOffMode} onChange={(e) => update("bullOffMode", e.target.value)}>
              {BULL_OFF_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </>
      )}

      <div className="field">
        <label>Match-Modus</label>
        <select value={settings[modeKey]} onChange={(e) => update(modeKey, e.target.value)}>
          {MATCH_MODE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      {settings[modeKey] === "Legs" ? (
        <div className="field">
          <label>First to Legs</label>
          <select value={settings.legs} onChange={(e) => update("legs", Number(e.target.value))}>
            {LEGS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      ) : (
        <>
          <div className="field">
            <label>First to Sets</label>
            <select value={settings.sets} onChange={(e) => update("sets", Number(e.target.value))}>
              {SETS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Legs pro Set</label>
            <select value={settings.legsOfSet} onChange={(e) => update("legsOfSet", Number(e.target.value))}>
              {LEGS_OF_SET_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  );
}


export function OverviewDialog({ isOpen, matches, boards, playersCount, mode, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="board-dialog-overlay">
      <div className="board-dialog board-dialog--wide board-dialog--compact-surface">
        <div className="dialog-heading-row">
          <div>
            <h3>Übersicht</h3>
            <div className="board-dialog-subtitle">Turnier- und Boardstatus in kompakter Form.</div>
          </div>
          <button className="btn btn--secondary" onClick={onClose}>Schließen</button>
        </div>

        <OverviewStats matches={matches} boards={boards} playersCount={playersCount} mode={mode} compact />
      </div>
    </div>
  );
}

export function BoardsDialog({ isOpen, boards, matches, onReleaseBoard, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="board-dialog-overlay">
      <div className="board-dialog board-dialog--wide board-dialog--compact-surface">
        <div className="dialog-heading-row">
          <div>
            <h3>Boards</h3>
            <div className="board-dialog-subtitle">Live-Zuordnung und manuelle Freigabe der Boards.</div>
          </div>
          <button className="btn btn--secondary" onClick={onClose}>Schließen</button>
        </div>

        <BoardOverview boards={boards} matches={matches} onReleaseBoard={onReleaseBoard} compact />
      </div>
    </div>
  );
}

export function TournamentSettingsDialog({
  isOpen,
  mode,
  tournamentType,
  settings,
  setSettings,
  formatSettings,
  setFormatSettings,
  onClose,
  onSave,
}) {
  if (!isOpen) return null;

  return (
    <div className="board-dialog-overlay">
      <div className="board-dialog board-dialog--wide">
        <h3>Turniereinstellungen bearbeiten</h3>
        <div className="board-dialog-subtitle">Gespeicherte Einstellungen ändern und für neue Spiele übernehmen.</div>
        {mode === "GROUP_KO" && (
          <div className="phase-settings-note phase-settings-note--dialog">
            Diese globalen Spieleinstellungen gelten auch für die Gruppenphase. Rundeneinstellungen überschreiben sie nur in der KO-Finalrunde.
          </div>
        )}

        <div className="config-sections settings-editor-grid">
          <div className="config-card">
            <div className="config-card-title">Spiel-Einstellungen</div>
            <MatchSettingsFields settings={settings} onChange={setSettings} tournamentType={tournamentType} />
          </div>
        </div>

        <div className="board-dialog-actions">
          <button className="btn btn--secondary" onClick={onClose}>Schließen</button>
          <button className="btn btn--primary" onClick={onSave}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

export function RoundSettingsDialog({
  isOpen,
  selectedRoundNumber,
  roundSettingsDraft,
  setRoundSettingsDraft,
  onClose,
  onReset,
  onSave,
}) {
  if (!isOpen) return null;

  return (
    <div className="board-dialog-overlay">
      <div className="board-dialog board-dialog--wide">
        <h3>Rundeneinstellungen bearbeiten</h3>
        <div className="board-dialog-subtitle">
          Runde {selectedRoundNumber}: Diese Werte überschreiben die globalen Einstellungen nur für diese Runde.
        </div>

        <div className="config-sections settings-editor-grid">
          <div className="config-card">
            <div className="config-card-title">Spiel-Einstellungen für Runde {selectedRoundNumber}</div>
            <MatchSettingsFields settings={roundSettingsDraft} onChange={setRoundSettingsDraft} tournamentType={roundSettingsDraft.tournamentType} />
          </div>
        </div>

        <div className="board-dialog-actions">
          <button className="btn btn--secondary" onClick={onClose}>Schließen</button>
          <button className="btn btn--danger" onClick={onReset}>Rundeneinstellungen löschen</button>
          <button className="btn btn--primary" onClick={onSave}>Rundeneinstellungen speichern</button>
        </div>
      </div>
    </div>
  );
}

export function BoardSelectionDialog({
  isOpen,
  selectedMatch,
  freeBoards,
  selectedBoardId,
  setSelectedBoardId,
  selectedBoardName,
  onClose,
  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <div className="board-dialog-overlay">
      <div className="board-dialog">
        <h3>Board auswählen</h3>
        <div className="board-dialog-subtitle">Wähle ein freies Board für Spiel {selectedMatch?.matchNumber}.</div>

        <div className="field">
          <label>Freies Board</label>
          <select value={selectedBoardId} onChange={(e) => setSelectedBoardId(e.target.value)}>
            {freeBoards.map((board) => <option key={board.id} value={board.id}>{board.name || board.boardId || board.id}</option>)}
          </select>
        </div>

        <div className="board-dialog-subtitle dialog-subtitle-spaced">Ausgewählt: <strong>{selectedBoardName || "—"}</strong></div>

        <div className="board-dialog-actions">
          <button className="btn btn--secondary" onClick={onClose}>Abbrechen</button>
          <button className="btn btn--primary" onClick={onConfirm}>Spiel starten</button>
        </div>
      </div>
    </div>
  );
}

export function EditResultDialog({
  isOpen,
  editingMatch,
  editingWinnerSlot,
  setEditingWinnerSlot,
  editingTargetWins,
  editingScoreLabel,
  editingScore1,
  setEditingScore1,
  editingScore2,
  setEditingScore2,
  onClose,
  onSave,
}) {
  if (!isOpen || !editingMatch) return null;

  return (
    <div className="board-dialog-overlay">
      <div className="board-dialog">
        <h3>Ergebnis bearbeiten</h3>
        <div className="board-dialog-subtitle">
          Spiel {editingMatch.matchNumber}: {getDisplayName(editingMatch.player1)} gegen {getDisplayName(editingMatch.player2)}
        </div>

        <div className="field">
          <label>Sieger</label>
          <select value={editingWinnerSlot} onChange={(e) => setEditingWinnerSlot(e.target.value)}>
            <option value="player1">{getDisplayName(editingMatch.player1)}</option>
            <option value="player2">{getDisplayName(editingMatch.player2)}</option>
          </select>
        </div>

        <div className="board-dialog-subtitle dialog-subtitle-spaced">
          Erlaubt sind nur gültige Endstände. Sieger: genau {editingTargetWins} {editingScoreLabel}. Verlierer: maximal {Math.max(0, editingTargetWins - 1)}.
        </div>

        <div className="dialog-score-grid dialog-score-grid-spaced">
          <div className="field">
            <label>{editingScoreLabel} {getDisplayName(editingMatch.player1)}</label>
            <input type="number" min="0" step="1" value={editingScore1} onChange={(e) => setEditingScore1(e.target.value)} inputMode="numeric" />
          </div>
          <div className="field">
            <label>{editingScoreLabel} {getDisplayName(editingMatch.player2)}</label>
            <input type="number" min="0" step="1" value={editingScore2} onChange={(e) => setEditingScore2(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        <div className="board-dialog-actions">
          <button className="btn btn--secondary" onClick={onClose}>Schließen</button>
          <button className="btn btn--primary" onClick={onSave}>Speichern</button>
        </div>
      </div>
    </div>
  );
}
