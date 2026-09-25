import type { LobbyView } from '@ice-water/shared';
import { isTwoMinuteWarningVisible } from '../game/match-night.js';
export type KillEntry = never;

/** Snowstorm begins at 4:00 remaining (240 000 ms). */
const SNOWSTORM_START_MS = 240_000;
/** "SNOWSTORM INCOMING!" is visible for this many ms. */
const SNOWSTORM_WARNING_DURATION_MS = 3_000;
/** "The snowstorm has begun!" appears this many ms after the first warning. */
const SNOWSTORM_BEGUN_DELAY_MS = 3_500;
/** "The snowstorm has begun!" stays visible for this many ms. */
const SNOWSTORM_BEGUN_DURATION_MS = 3_000;

function isSnowstormWarningVisible(remainingMs: number): boolean {
  return (
    remainingMs <= SNOWSTORM_START_MS &&
    remainingMs > SNOWSTORM_START_MS - SNOWSTORM_WARNING_DURATION_MS
  );
}

function isSnowstormBegunVisible(remainingMs: number): boolean {
  const elapsed = SNOWSTORM_START_MS - remainingMs;
  return elapsed >= SNOWSTORM_BEGUN_DELAY_MS && elapsed < SNOWSTORM_BEGUN_DELAY_MS + SNOWSTORM_BEGUN_DURATION_MS;
}

export function GameHud({
  view,
  localPlayerId,
  serverNow,
  crosshair,
}: {
  view: LobbyView;
  localPlayerId: string;
  serverNow: number;
  crosshair: string;
}) {
  const p = view.players.find((p) => p.playerId === localPlayerId);
  if (!p) return null;
  const remainingMs = view.phaseDeadline - serverNow;
  const time = Math.max(0, Math.ceil(remainingMs / 1000));
  const isTwoMinuteWarning = view.phase === 'playing' && isTwoMinuteWarningVisible(remainingMs);
  const isPlaying = view.phase === 'playing';
  const showSnowstormWarning = isPlaying && isSnowstormWarningVisible(remainingMs);
  const showSnowstormBegun = isPlaying && isSnowstormBegunVisible(remainingMs);
  return (
    <div className="game-hud">
      <div className="match-clock">
        <span>Ice Ice Water</span>
        <strong>
          {Math.floor(time / 60)}:{String(time % 60).padStart(2, '0')}
        </strong>
        <span>{`Ice ${view.iceScore} : ${view.waterScore} Water`}</span>
      </div>
      {isTwoMinuteWarning && (
        <div className="two-minute-warning" role="alert" aria-live="assertive">
          Only 2 minutes left
        </div>
      )}
      {showSnowstormWarning && (
        <div className="snowstorm-warning" role="alert" aria-live="assertive">
          ❄ SNOWSTORM INCOMING! ❄
        </div>
      )}
      {showSnowstormBegun && (
        <div className="snowstorm-begun" role="status" aria-live="polite">
          The snowstorm has begun!
        </div>
      )}
      {p.status === 'frozen' && (
        <div className="frozen-status" role="status">
          <strong>FROZEN</strong>
          <span>Wait for a Water teammate to rescue you.</span>
          <meter min={0} max={1} value={p.rescueProgress} aria-label="Rescue progress" />
        </div>
      )}
      {p.status === 'alive' && (
        <div
          className="crosshair"
          style={{
            color: crosshair,
            fontSize: 27 + Math.min(10, Math.hypot(p.velocityX, p.velocityZ)),
          }}
          aria-label="Crosshair"
        >
          +
        </div>
      )}
      <div className="desktop-controls">
        WASD move · Mouse aim · Space jump/swim · Shift slide · C crouch/dive · Ctrl sprint
        <br />
        Click tag / rescue at close range · Q lunge · Tab scores · Esc pause
      </div>
    </div>
  );
}
