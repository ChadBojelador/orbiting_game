import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  canRescueInPhase,
  isPlayPhase,
  normalizeInviteCode,
  sanitizeDisplayName,
  type GuestSession,
  type LobbyView,
  type MatchResult,
  type SessionError,
} from '@ice-water/shared';
import {
  clearReconnect,
  createGuest,
  forgetGuest,
  readGuest,
  reconnectRoom,
  reserveRoom,
  saveReconnect,
  snapshot,
  type LobbyRoom,
} from '../network/lobby-client.js';
import { GameHud } from './game-hud.js';
import { TouchControls } from './touch-controls.js';
import { ResultsScreen } from './results-screen.js';
import { ServerClock } from '../network/server-clock.js';

const LobbyPreview = lazy(() =>
  import('../game/lobby-preview.js').then((module) => ({ default: module.LobbyPreview })),
);

export function App() {
  const [guest, setGuest] = useState<GuestSession | null>(readGuest);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<LobbyRoom | null>(null);
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(true);
  const [connection, setConnection] = useState('Connected');
  const [copyLabel, setCopyLabel] = useState('Copy invite code');
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const clock = useRef(new ServerClock());
  const roomRef = useRef<LobbyRoom | null>(null);
  const gameCanvasRef = useRef<HTMLCanvasElement>(null);
  const gameSceneRef = useRef<import('../game/game-scene.js').GameScene | null>(null);
  const musicRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    music.volume = 0.32;
    if (!guest) {
      music.pause();
      setIsMusicPlaying(false);
    } else if (isMusicPlaying && music.paused) {
      void music.play().catch(() => setIsMusicPlaying(false));
    } else if (!isMusicPlaying) {
      music.pause();
    }
  }, [guest, isMusicPlaying, room]);

  function toggleMusic() {
    const music = musicRef.current;
    if (!music) return;
    if (music.paused) {
      void music
        .play()
        .then(() => setIsMusicPlaying(true))
        .catch(() => setIsMusicPlaying(false));
    } else {
      music.pause();
      setIsMusicPlaying(false);
    }
  }

  useEffect(() => {
    const canvas = gameCanvasRef.current;
    if (!canvas || !room || !guest || !lobby) return;
    if (!isPlayPhase(lobby.phase) && lobby.phase !== 'round-result') {
      if (gameSceneRef.current) {
        gameSceneRef.current.destroy();
        gameSceneRef.current = null;
      }
      return;
    }
    if (gameSceneRef.current) return;
    void import('../game/game-scene.js').then(({ GameScene }) => {
      if (!canvas || !room || !guest) return;
      gameSceneRef.current = new GameScene(canvas, room, guest.playerId);
    });
    return () => {
      gameSceneRef.current?.destroy();
      gameSceneRef.current = null;
    };
  }, [lobby?.phase, room, guest]);

  function attach(next: LobbyRoom) {
    roomRef.current = next;
    setRoom(next);
    setError('');
    setConnection('Connected');
    setMatchResult(null);
    const update = () => {
      if (!next.state?.players) return;
      const value = snapshot(next.state);
      setLobby(value);
      clock.current.update(value.serverTime);
      setNow(clock.current.now());
    };
    next.onStateChange(update);
    next.onMessage<SessionError>('session/error', (message) => setError(message.message));
    next.onMessage('match/phase-changed', () => setError(''));
    next.onMessage<MatchResult>('match/result', (result) => setMatchResult(result));
    next.onMessage('arena/boundary-changed', () => {});
    next.onMessage('frost/thrown', () => {});
    next.onMessage('player/frozen', () => {});
    next.onMessage('player/rescued', () => {});
    next.onMessage('player/help-ping', () => {});
    next.onMessage('player/permanently-frozen', () => {});
    next.onError((_code, message) => setError(message ?? 'Room connection failed'));
    next.onDrop(() => setConnection('Reconnecting…'));
    next.onReconnect(() => {
      setConnection('Connected');
      saveReconnect(next);
    });
    next.onLeave(() => {
      if (roomRef.current !== next) return;
      const wasActiveMatch =
        next.state?.phase !== undefined && !['lobby', 'countdown'].includes(next.state.phase);
      clearReconnect();
      roomRef.current = null;
      setRoom(null);
      setLobby(null);
      setMatchResult(null);
      setError(
        wasActiveMatch
          ? 'Your reconnection window expired. This match can no longer be rejoined.'
          : 'You left the room or the connection expired. You can join again.',
      );
    });
    update();
  }

  useEffect(() => {
    let isActive = true;
    void reconnectRoom()
      .then((next) => {
        if (next && isActive) attach(next);
      })
      .catch((reason: unknown) => {
        if (isActive) setError(reason instanceof Error ? reason.message : 'Unable to reconnect');
      })
      .finally(() => {
        if (isActive) setIsBusy(false);
      });
    const timer = window.setInterval(() => setNow(clock.current.now()), 100);
    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, []);

  async function run(action: () => Promise<void>) {
    setError('');
    setIsBusy(true);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.');
    } finally {
      setIsBusy(false);
    }
  }

  function submitGuest(event: FormEvent) {
    event.preventDefault();
    const sanitized = sanitizeDisplayName(name);
    if (!sanitized) {
      setError('Choose a name with 2–20 letters or numbers.');
      return;
    }
    void run(async () => {
      setGuest(await createGuest(sanitized));
    });
  }

  function join(event: FormEvent) {
    event.preventDefault();
    const invite = normalizeInviteCode(code);
    if (!invite) {
      setError('Enter the eight-character invite code from your host.');
      return;
    }
    if (guest) void run(async () => attach(await reserveRoom(guest, invite)));
  }

  async function leave() {
    if (!room) return;
    gameSceneRef.current?.destroy();
    gameSceneRef.current = null;
    roomRef.current = null;
    clearReconnect();
    await room.leave();
    setRoom(null);
    setLobby(null);
    setMatchResult(null);
    setError('');
  }

  const count = lobby?.players.filter((player) => player.isConnected).length ?? 0;
  const isHost = lobby?.hostPlayerId === guest?.playerId;
  const seconds = Math.max(0, Math.ceil(((lobby?.phaseDeadline ?? 0) - now) / 1000));
  const currentPlayer = lobby?.players.find((player) => player.playerId === guest?.playerId);
  const isExpired = guest !== null && guest.expiresAt <= Date.now();
  const isInGame =
    lobby &&
    (isPlayPhase(lobby.phase) || lobby.phase === 'round-result' || lobby.phase === 'match-result');
  const serverNow = clock.current.now();
  const isRescueLocked = !canRescueInPhase(
    lobby?.phase ?? 'lobby',
    lobby?.phaseDeadline ?? 0,
    serverNow,
  );

  if (isInGame && lobby && guest) {
    return (
      <div className="game-shell">
        <audio
          ref={musicRef}
          src="/music/bg1.mp3"
          loop
          preload="metadata"
          onPlay={() => setIsMusicPlaying(true)}
          onPause={() => setIsMusicPlaying(false)}
        />
        <canvas ref={gameCanvasRef} className="game-canvas" aria-label="3D game arena" />
        <button
          className="game-music-button"
          type="button"
          onClick={toggleMusic}
          aria-pressed={isMusicPlaying}
          aria-label={isMusicPlaying ? 'Mute soundtrack' : 'Play soundtrack'}
        >
          <span aria-hidden="true">{isMusicPlaying ? '♫' : '♪'}</span>
          {isMusicPlaying ? 'Sound on' : 'Sound off'}
        </button>
        {lobby.phase !== 'match-result' && (
          <GameHud view={lobby} localPlayerId={guest.playerId} serverNow={serverNow} />
        )}
        {currentPlayer && lobby.phase !== 'match-result' && (
          <TouchControls
            input={gameSceneRef.current?.getInput()}
            team={currentPlayer.team === 'unassigned' ? 'water' : currentPlayer.team}
            playerStatus={currentPlayer.status}
            isRescueLocked={isRescueLocked}
          />
        )}
        <button
          className="text-button game-leave-button"
          onClick={() => void run(leave)}
          disabled={isBusy}
          aria-label="Leave room"
        >
          Leave room
        </button>
        {matchResult && lobby.phase === 'match-result' && (
          <ResultsScreen
            view={lobby}
            localPlayerId={guest.playerId}
            result={matchResult}
            onLeave={() => void run(leave)}
          />
        )}
        {connection !== 'Connected' && (
          <div className="game-reconnecting" role="status">
            {connection}
          </div>
        )}
        {error && (
          <p className="game-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const lobbyMode = !guest ? 'identify' : !room ? 'choose-room' : !lobby ? 'joining' : 'waiting';

  return (
    <main className={`lobby-shell lobby-shell--${lobbyMode}`}>
      <audio
        ref={musicRef}
        src="/music/bg1.mp3"
        loop
        preload="metadata"
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
      />
      <Suspense
        fallback={<div className="lobby-world lobby-world-fallback">Preparing the clubhouse…</div>}
      >
        <LobbyPreview />
      </Suspense>
      <div className="lobby-atmosphere" aria-hidden="true" />

      <header className="lobby-topbar">
        <a className="lobby-brand" href="/" aria-label="Ice Ice Water home">
          <span className="lobby-brand-mark" aria-hidden="true">
            ❄
          </span>
          <span className="lobby-brand-name">
            Ice Ice <em>Water!</em>
          </span>
        </a>
        <div className="lobby-topbar-actions">
          {guest && (
            <span className="player-chip">
              <span aria-hidden="true">◉</span>
              {guest.displayName}
            </span>
          )}
          <button
            className="music-toggle"
            type="button"
            onClick={toggleMusic}
            aria-pressed={isMusicPlaying}
            aria-label={isMusicPlaying ? 'Mute soundtrack' : 'Play soundtrack'}
          >
            <span aria-hidden="true">{isMusicPlaying ? '♫' : '♪'}</span>
            <span className="music-toggle-label">{isMusicPlaying ? 'Sound on' : 'Sound off'}</span>
          </button>
          <span className="edition">Private playtest</span>
        </div>
      </header>

      <div className="hub-layout">
        <section className={`hub-board hub-board--left ${lobby ? 'hub-board--roster' : ''}`}>
          <div className="board-heading">
            <span>
              <i aria-hidden="true" /> {lobby ? 'In this room' : 'How to play'}
            </span>
            <small>{lobby ? `${count} online` : '5 rounds'}</small>
          </div>
          {lobby ? (
            <>
              <div className="roster-title">
                <h2>Ready crew</h2>
                <span role="status" aria-label="Connected players">
                  {count} / {lobby.maxPlayers} connected
                </span>
              </div>
              <div
                className="player-meter"
                aria-label={`${count} of ${lobby.minPlayers} players needed to start`}
              >
                <span style={{ width: `${Math.min(100, (count / lobby.minPlayers) * 100)}%` }} />
              </div>
              <ul className="roster">
                {lobby.players.map((player) => (
                  <li key={player.playerId}>
                    <span className={`avatar ${player.team}`} aria-hidden="true">
                      {player.team === 'ice' ? '❄' : '◉'}
                    </span>
                    <span className="player-name">
                      {player.displayName}
                      {player.playerId === guest?.playerId && <small> (you)</small>}
                    </span>
                    <span className="player-badge">
                      {player.playerId === lobby.hostPlayerId
                        ? 'Host'
                        : player.team !== 'unassigned'
                          ? player.team === 'ice'
                            ? 'Ice'
                            : 'Water'
                          : 'Ready'}
                      {!player.isConnected && ' · Away'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="rules-list">
              <div className="rule-row">
                <span className="rule-icon rule-icon--ice" aria-hidden="true">
                  ❄
                </span>
                <p>
                  <strong>Ice catches</strong>
                  Land a frost throw to freeze Water.
                </p>
              </div>
              <div className="rule-row">
                <span className="rule-icon rule-icon--water" aria-hidden="true">
                  ◉
                </span>
                <p>
                  <strong>Water rescues</strong>
                  Stay close and thaw frozen teammates.
                </p>
              </div>
              <div className="rule-row">
                <span className="rule-icon rule-icon--clock" aria-hidden="true">
                  30
                </span>
                <p>
                  <strong>Beat Deep Freeze</strong>
                  Rescue locks when the final 30 seconds begin.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="hub-center" aria-labelledby="game-title">
          <div className="hub-title">
            <p>Private browser freeze tag</p>
            <h1 id="game-title">Ice Ice Water!</h1>
            <span>Run together. Freeze apart.</span>
          </div>
          <section className="hub-action" aria-label="Private room lobby" aria-busy={isBusy}>
            {!guest ? (
              <>
                <p className="action-kicker">Choose your player name</p>
                <h2>Enter the clubhouse</h2>
                <form onSubmit={submitGuest}>
                  <label htmlFor="display-name">Display name</label>
                  <input
                    id="display-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={100}
                    autoComplete="nickname"
                    placeholder="e.g. Snow day Sam"
                    required
                    aria-describedby="name-hint"
                  />
                  <small id="name-hint">2–20 characters. No account needed.</small>
                  <button className="primary hub-play-button" disabled={isBusy} type="submit">
                    {isBusy ? 'Connecting…' : 'Let’s go'}
                    <small>Enter lobby</small>
                  </button>
                </form>
              </>
            ) : !room ? (
              <>
                <p className="action-kicker">Welcome, {guest.displayName}</p>
                <h2>Host the next match</h2>
                <p className="action-copy">Create an invite-only room for up to 150 friends.</p>
                <button
                  className="primary hub-play-button"
                  disabled={isBusy || isExpired}
                  onClick={() => void run(async () => attach(await reserveRoom(guest)))}
                >
                  {isBusy ? 'Connecting…' : 'Create private room'}
                  <small>Become the host</small>
                </button>
                {isExpired && (
                  <p role="status">Your guest session expired. Choose your name again.</p>
                )}
                <button
                  className="text-button"
                  disabled={isBusy}
                  onClick={() => {
                    forgetGuest();
                    setGuest(null);
                    setError('');
                  }}
                >
                  Change name
                </button>
              </>
            ) : !lobby ? (
              <div className="joining-state" role="status">
                <span aria-hidden="true">❄</span>
                <strong>Joining your room…</strong>
              </div>
            ) : (
              <>
                <p className="action-kicker">
                  {isHost ? 'You are the host' : 'Waiting for the host'}
                </p>
                <div className={`phase-box ${lobby.phase}`} aria-live="polite">
                  <strong>
                    {lobby.phase === 'lobby'
                      ? 'Waiting for friends'
                      : lobby.phase === 'countdown'
                        ? `Starting in ${seconds}`
                        : 'Teams are set!'}
                  </strong>
                  <p>
                    {lobby.phase === 'lobby'
                      ? count < lobby.minPlayers
                        ? `${lobby.minPlayers - count} more to start. Send the invite!`
                        : isHost
                          ? 'Everyone here? Start when your crew is ready.'
                          : 'Your host can start the countdown.'
                      : lobby.phase === 'countdown'
                        ? 'Ice catches. Water helps teammates thaw.'
                        : `You're ${currentPlayer?.team === 'ice' ? 'Ice — catch the Water team.' : 'Water — help your teammates.'}`}
                  </p>
                </div>
                {isHost && lobby.phase === 'lobby' && (
                  <button
                    className="primary hub-play-button"
                    disabled={count < lobby.minPlayers || connection !== 'Connected'}
                    onClick={() => room.send('room/start', {})}
                  >
                    Start countdown
                    <small>
                      {count < lobby.minPlayers
                        ? `Need ${lobby.minPlayers - count} more player${lobby.minPlayers - count === 1 ? '' : 's'}`
                        : 'Launch the match'}
                    </small>
                  </button>
                )}
                <button className="text-button" onClick={() => void run(leave)} disabled={isBusy}>
                  Leave room
                </button>
              </>
            )}
          </section>
        </section>

        <section className="hub-board hub-board--right">
          <div className="board-heading">
            <span>
              <i aria-hidden="true" /> Private rooms
            </span>
            <small>Invite only</small>
          </div>
          {!guest ? (
            <div className="room-promise">
              <strong>6–150 players</strong>
              <p>One room, one arena, one last-second rescue.</p>
              <dl>
                <div>
                  <dt>Match</dt>
                  <dd>5 rounds</dd>
                </div>
                <div>
                  <dt>Round</dt>
                  <dd>60 sec</dd>
                </div>
              </dl>
            </div>
          ) : !room ? (
            <>
              <h2>Join your crew</h2>
              <p className="board-copy">Enter the room code your host shared.</p>
              <form className="join-form" onSubmit={join}>
                <label htmlFor="invite-code">Invite code</label>
                <input
                  id="invite-code"
                  className="code-input"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="ABCDEFGH"
                  maxLength={8}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                />
                <button className="secondary" disabled={isBusy || isExpired} type="submit">
                  Join room
                </button>
              </form>
            </>
          ) : !lobby ? (
            <p role="status">Finding the room signal…</p>
          ) : (
            <>
              <div className="room-kicker">
                <span>Room code</span>
                <span className={`connection ${connection === 'Connected' ? 'is-connected' : ''}`}>
                  <span className="connection-dot" aria-hidden="true" />
                  {connection}
                </span>
              </div>
              <output className="invite-output" aria-label="Room invite code">
                {lobby.inviteCode}
              </output>
              <button
                className="copy-button"
                onClick={() => {
                  void navigator.clipboard.writeText(lobby.inviteCode).then(
                    () => setCopyLabel('Copied!'),
                    () => setCopyLabel('Select and copy the code above'),
                  );
                }}
              >
                {copyLabel}
              </button>
              <p className="board-copy">Share this code with friends. The room starts at six.</p>
            </>
          )}
        </section>
      </div>

      <div className="lobby-dock" aria-label="Match format">
        <div>
          <span aria-hidden="true">◎</span>
          <p>
            <strong>One arena</strong>
            Built for a crowd
          </p>
        </div>
        <div>
          <span aria-hidden="true">❄</span>
          <p>
            <strong>Ice vs Water</strong>
            Freeze or rescue
          </p>
        </div>
        <div>
          <span aria-hidden="true">◷</span>
          <p>
            <strong>30 + 30 seconds</strong>
            Then the freeze lands
          </p>
        </div>
      </div>

      {error && (
        <p className="lobby-error" role="alert">
          {error}
        </p>
      )}
      <footer className="lobby-footer">Stay close. Thaw a friend. Survive the freeze.</footer>
    </main>
  );
}
