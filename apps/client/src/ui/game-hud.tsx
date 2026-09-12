import { useEffect, useState } from 'react';
import type { LobbyView, MatchPhase } from '@ice-water/shared';

interface GameHudProps {
  view: LobbyView;
  localPlayerId: string;
  serverNow: number;
}

function phaseName(phase: MatchPhase): string {
  switch (phase) {
    case 'regular':
      return 'Regular Play';
    case 'warning':
      return '⚠ Deep Freeze Warning';
    case 'deep-freeze':
      return '❄ Deep Freeze';
    case 'round-result':
      return 'Round Over';
    case 'match-result':
      return 'Match Over';
    default:
      return '';
  }
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export function GameHud({ view, localPlayerId, serverNow }: GameHudProps) {
  const localPlayer = view.players.find((p) => p.playerId === localPlayerId);
  const [showFrozenAlert, setShowFrozenAlert] = useState(false);
  const remaining = view.phaseDeadline > 0 ? view.phaseDeadline - serverNow : 0;
  const isDeepFreeze = view.phase === 'deep-freeze' || view.phase === 'warning';
  const isFrozen = localPlayer?.status === 'frozen';
  const isEliminated = localPlayer?.status === 'eliminated';
  const team = localPlayer?.team ?? 'water';

  useEffect(() => {
    if (localPlayer?.status !== 'frozen') {
      setShowFrozenAlert(false);
      return;
    }
    setShowFrozenAlert(true);
    const timeout = window.setTimeout(() => setShowFrozenAlert(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [localPlayer?.status]);

  const aliveWater = view.players.filter((p) => p.team === 'water' && p.status === 'active').length;
  const frozenWater = view.players.filter(
    (p) => p.team === 'water' && p.status === 'frozen',
  ).length;
  const eliminatedWater = view.players.filter(
    (p) => p.team === 'water' && p.status === 'eliminated',
  ).length;
  const aliveIce = view.players.filter((p) => p.team === 'ice' && p.status === 'active').length;

  return (
    <div className={`game-hud ${isDeepFreeze ? 'deep-freeze-active' : ''}`} aria-live="polite">
      {showFrozenAlert && (
        <div className="hud-frozen-alert" role="alert">
          YOU ARE FROZEN
        </div>
      )}

      {/* Top bar: phase and timer */}
      <div className="hud-top">
        <div className={`hud-phase hud-phase--${view.phase}`}>{phaseName(view.phase)}</div>
        <div className="hud-timer" aria-label="Time remaining">
          {view.phaseDeadline > 0 ? formatTime(remaining) : '—'}
        </div>
        <div className="hud-round" aria-label="Current round">
          Round {view.round} / {view.maxRounds}
        </div>
      </div>

      {/* Score strip */}
      <div className="hud-score-strip">
        <span className="hud-team hud-team--ice" title="Ice players active">
          ❄ {aliveIce}
        </span>
        <span className="hud-vs">vs</span>
        <span
          className="hud-team hud-team--water"
          title="Water players active / frozen / eliminated"
        >
          ◉ {aliveWater}
          {frozenWater > 0 && <span className="hud-frozen-count"> · {frozenWater} frozen</span>}
          {eliminatedWater > 0 && <span className="hud-elim-count"> · {eliminatedWater} out</span>}
        </span>
      </div>

      {/* Objective */}
      <div className="hud-objective">
        <strong className="hud-teams-status">Teams are set!</strong>{' '}
        <span className="hud-team-role">
          You’re {team === 'ice' ? 'Ice — catch the Water team.' : 'Water — help your teammates.'}
        </span>
        {isEliminated && <span className="hud-status-note"> · 👁 Spectating</span>}
        {isFrozen && <span className="hud-status-note"> · 🧊 You're frozen!</span>}
      </div>

      <aside className="pc-control-guide" aria-label="PC controls">
        <strong>Controls</strong>
        <span className="control-pair">
          <span className="key-cluster" aria-hidden="true">
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd>
          </span>
          Move
        </span>
        <span className="control-pair">
          <kbd>Drag</kbd>
          Look
        </span>
        <span className="control-pair">
          <kbd>Space</kbd>
          Jump
        </span>
        {team === 'ice' && !isFrozen && !isEliminated && (
          <span className="control-pair control-pair--frost">
            <kbd>RMB</kbd>
            Throw frost <small>F also works</small>
          </span>
        )}
        {team === 'water' && !isFrozen && !isEliminated && !isDeepFreeze && (
          <span className="control-pair">
            <kbd>E</kbd>
            Hold to rescue
          </span>
        )}
        {isFrozen && (
          <span className="control-pair">
            <kbd>H</kbd>
            Ask for help
          </span>
        )}
      </aside>

      {team === 'ice' && !isFrozen && !isEliminated && (
        <div className="frost-reticle" aria-hidden="true">
          <span />
        </div>
      )}

      {/* Rescue-locked banner during deep-freeze */}
      {isDeepFreeze && (
        <div className="hud-rescue-locked" role="alert">
          <span aria-hidden="true">🔒</span> RESCUE LOCKED
        </div>
      )}

      {/* Help ping indicator */}
      {localPlayer && localPlayer.helpPingUntil > serverNow && (
        <div className="hud-help-ping" role="status">
          📍 Help ping sent!
        </div>
      )}
    </div>
  );
}
