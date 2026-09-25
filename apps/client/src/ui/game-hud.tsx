import type { LobbyView } from '@ice-water/shared';
export type KillEntry = never;
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
  const time = Math.max(0, Math.ceil((view.phaseDeadline - serverNow) / 1000));
  return (
    <div className="game-hud">
      <div className="match-clock">
        <span>
          Ice Ice Water
        </span>
        <strong>
          {Math.floor(time / 60)}:{String(time % 60).padStart(2, '0')}
        </strong>
        <span>
          {`Ice ${view.iceScore} : ${view.waterScore} Water`}
        </span>
      </div>
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
