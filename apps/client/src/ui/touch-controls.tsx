import { useEffect, useRef, useState } from 'react';
import { touchAxes } from '../input/game-input.js';
import type { GameInput } from '../input/game-input.js';

interface TouchControlsProps {
  input?: GameInput;
  team: 'ice' | 'water' | 'unassigned';
  playerStatus: 'active' | 'frozen' | 'eliminated' | 'spectator';
  isRescueLocked: boolean;
}

interface JoystickState {
  centreX: number;
  centreY: number;
  radius: number;
  currentX: number;
  currentY: number;
  identifier: number;
}

export function TouchControls({ input, team, playerStatus, isRescueLocked }: TouchControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [thumbPos, setThumbPos] = useState({ x: 0, y: 0 });
  const joystick = useRef<JoystickState | null>(null);

  useEffect(() => {
    const el = joystickRef.current;
    if (!el) return;

    const start = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i]!;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const radius = rect.width / 2;
        joystick.current = {
          centreX: cx,
          centreY: cy,
          radius,
          currentX: touch.clientX,
          currentY: touch.clientY,
          identifier: touch.identifier,
        };
      }
    };
    const move = (e: TouchEvent) => {
      e.preventDefault();
      const j = joystick.current;
      if (!j) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i]!;
        if (touch.identifier !== j.identifier) continue;
        const dx = touch.clientX - j.centreX;
        const dy = touch.clientY - j.centreY;
        const axes = touchAxes(dx, dy, j.radius);
        if (input) input.touch = axes;
        const clampedDist = Math.min(Math.hypot(dx, dy), j.radius);
        const angle = Math.atan2(dy, dx);
        setThumbPos({ x: Math.cos(angle) * clampedDist, y: Math.sin(angle) * clampedDist });
      }
    };
    const end = (e: TouchEvent) => {
      e.preventDefault();
      const j = joystick.current;
      if (!j) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i]!.identifier === j.identifier) {
          joystick.current = null;
          if (input) input.touch = { x: 0, z: 0 };
          setThumbPos({ x: 0, y: 0 });
        }
      }
    };

    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [input]);

  if (playerStatus === 'spectator' || playerStatus === 'eliminated') {
    return (
      <div className="touch-controls touch-controls--spectator">
        <span>👁 Spectating</span>
      </div>
    );
  }

  return (
    <div className="touch-controls" aria-hidden="true">
      {/* Left side: joystick */}
      <div className="touch-joystick-zone">
        <div className="touch-joystick" ref={joystickRef}>
          <div
            className="touch-joystick-thumb"
            style={{ transform: `translate(${thumbPos.x}px, ${thumbPos.y}px)` }}
          />
        </div>
      </div>

      {/* Right side: action buttons */}
      <div className="touch-action-zone">
        {playerStatus === 'active' && (
          <button
            className="touch-btn touch-btn--jump"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              input?.pressJump();
            }}
            aria-label="Jump"
          >
            ↑ Jump
          </button>
        )}

        {/* Frost launcher button — Ice only */}
        {team === 'ice' && playerStatus === 'active' && (
          <button
            className="touch-btn touch-btn--tag"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              input?.pressFrostThrow();
            }}
            aria-label="Fire frost launcher"
          >
            ❄ Fire
          </button>
        )}

        {/* Rescue button — Water active only, hidden during deep-freeze */}
        {team === 'water' && playerStatus === 'active' && !isRescueLocked && (
          <button
            className="touch-btn touch-btn--rescue"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              if (input) input.isTouchRescuing = true;
            }}
            onPointerUp={() => {
              if (input) input.isTouchRescuing = false;
            }}
            onPointerCancel={() => {
              if (input) input.isTouchRescuing = false;
            }}
            aria-label="Rescue teammate"
          >
            ◉ Rescue
          </button>
        )}

        {/* Rescue locked indicator */}
        {team === 'water' && isRescueLocked && (
          <div className="touch-btn touch-btn--locked" aria-label="Rescue is locked">
            🔒 Rescue Locked
          </div>
        )}

        {/* Help ping — frozen Water only */}
        {team === 'water' && playerStatus === 'frozen' && (
          <button
            className="touch-btn touch-btn--ping"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              input?.pressPing();
            }}
            aria-label="Send help ping"
          >
            📍 Ping
          </button>
        )}
      </div>
    </div>
  );
}
