import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import { LobbyPreview } from '../game/lobby-preview.js';
import { GameHud } from './game-hud.js';
import { TouchControls } from './touch-controls.js';
import { ResultsScreen } from './results-screen.js';

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
  const clock = useRef({ server: 0, received: 0 });
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
      void music.play().then(() => setIsMusicPlaying(true)).catch(() => setIsMusicPlaying(false));
    } else {
      music.pause();
      setIsMusicPlaying(false);
    }
  }

  // Mount/unmount the 3D game scene when entering/leaving play phases.
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
    if (gameSceneRef.current) return; // already mounted
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
      clock.current = { server: value.serverTime, received: performance.now() };
      setNow(value.serverTime);
    };
    next.onStateChange(update);
    next.onMessage<SessionError>('session/error', (message) => setError(message.message));
    next.onMessage('match/phase-changed', () => {
      setError('');
    });
    next.onMessage<MatchResult>('match/result', (result) => {
      setMatchResult(result);
    });
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
    const timer = window.setInterval(
      () => setNow(clock.current.server + performance.now() - clock.current.received),
      100,
    );
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
  const serverNow = clock.current.server + performance.now() - clock.current.received;
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
        {/* Full-screen 3D canvas */}
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

        {/* HUD overlay */}
        {lobby.phase !== 'match-result' && (
          <GameHud view={lobby} localPlayerId={guest.playerId} serverNow={serverNow} />
        )}

        {/* Touch controls */}
        {currentPlayer && lobby.phase !== 'match-result' && (
          <TouchControls
            input={gameSceneRef.current?.getInput()}
            team={currentPlayer.team === 'unassigned' ? 'water' : currentPlayer.team}
            playerStatus={currentPlayer.status}
            isRescueLocked={isRescueLocked}
          />
        )}

        {/* In-game Leave room button */}
        <button
          className="text-button game-leave-button"
          onClick={() => void run(leave)}
          disabled={isBusy}
          aria-label="Leave room"
        >
          Leave room
        </button>

        {/* Results overlay */}
        {matchResult && lobby.phase === 'match-result' && (
          <ResultsScreen
            view={lobby}
            localPlayerId={guest.playerId}
            result={matchResult}
            onLeave={() => void run(leave)}
          />
        )}

        {/* Connection status */}
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

  return (
    <main className="shell">
      <audio
        ref={musicRef}
        src="/music/bg1.mp3"
        loop
        preload="metadata"
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
      />
      <header className="topbar">
        <a className="brand" href="/" aria-label="Ice Ice Water home">
          <span aria-hidden="true">❄</span> Ice Ice Water!
        </a>
        <div className="topbar-actions">
          <button className="music-toggle" type="button" onClick={toggleMusic} aria-pressed={isMusicPlaying}>
            <span aria-hidden="true">{isMusicPlaying ? '♫' : '♪'}</span>
            {isMusicPlaying ? 'Sound on' : 'Play soundtrack'}
          </button>
          <span className="edition">Private playtest</span>
        </div>
      </header>
      <div className="layout">
        <section className="intro" aria-labelledby="game-title">
          <p className="eyebrow"><span aria-hidden="true">✦</span> A cozy freeze-tag adventure</p>
          <h1 id="game-title">A little chill.<br />A lot of friends.</h1>
          <p className="lede">
            Gather your crew for a game of freeze tag. Keep moving, stick together, and don't get
            left on ice.
          </p>
          <LobbyPreview />
          <div className="rule-strip">
            <p>
              <span aria-hidden="true">◉</span>
              <strong>6–150 friends</strong>One private room
            </p>
            <p>
              <span aria-hidden="true">❄</span>
              <strong>Ice catches</strong>Water rescues
            </p>
            <p>
              <span aria-hidden="true">◷</span>
              <strong>Five rounds</strong>30s play + 30s freeze
            </p>
          </div>
        </section>
        <section className="lobby-panel" aria-label="Private room lobby" aria-busy={isBusy}>
          {!guest ? (
            <>
              <span className="panel-icon" aria-hidden="true">
                ✳
              </span>
              <h2>First, what's your name?</h2>
              <p>Your friends will see this in the room.</p>
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
                <small id="name-hint">
                  2–20 characters. Letters, numbers, and simple punctuation.
                </small>
                <button className="primary" disabled={isBusy} type="submit">
                  {isBusy ? 'Connecting…' : 'Let’s go'}
                </button>
              </form>
              <p className="quiet">No account needed. Just a name and your friends.</p>
            </>
          ) : !room ? (
            <>
              <span className="panel-icon" aria-hidden="true">
                ✳
              </span>
              <h2>Hey, {guest.displayName}.</h2>
              <p>Start a room or hop into your friend's.</p>
              <button
                className="primary"
                disabled={isBusy || isExpired}
                onClick={() => void run(async () => attach(await reserveRoom(guest)))}
              >
                {isBusy ? 'Connecting…' : 'Create private room'}
              </button>
              <div className="divider">Have an invite?</div>
              <form onSubmit={join}>
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
              {isExpired && (
                <p role="status">Your guest session expired. Choose your name again to continue.</p>
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
            <p role="status">Joining your room…</p>
          ) : (
            <>
              <div className="room-heading">
                <h2>Your gathering place</h2>
                <span className="connection">{connection}</span>
              </div>
              <p>Share this code. Bring the whole crew.</p>
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
              <div className="roster-title">
                <h3>In the room</h3>
                <span role="status" aria-label="Connected players">
                  {count} / {lobby.maxPlayers} connected
                </span>
              </div>
              <ul className="roster">
                {lobby.players.map((player) => (
                  <li key={player.playerId}>
                    <span className={`avatar ${player.team}`} aria-hidden="true">
                      {player.team === 'ice' ? '❄' : '◉'}
                    </span>
                    <span className="player-name">
                      {player.displayName}
                      {player.playerId === guest.playerId && <small> (you)</small>}
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
                      ? `${lobby.minPlayers - count} more to start. Send out the invite!`
                      : isHost
                        ? 'Everyone here? You can start the countdown.'
                        : 'Your host can start the countdown.'
                    : lobby.phase === 'countdown'
                      ? 'Ice catches. Water helps teammates thaw.'
                      : `You're ${currentPlayer?.team === 'ice' ? 'Ice — catch the Water team.' : 'Water — help your teammates.'}`}
                </p>
              </div>
              {isHost && lobby.phase === 'lobby' && (
                <button
                  className="primary"
                  disabled={count < lobby.minPlayers || connection !== 'Connected'}
                  onClick={() => room.send('room/start', {})}
                >
                  Start countdown
                </button>
              )}
              <button className="text-button" onClick={() => void run(leave)} disabled={isBusy}>
                Leave room
              </button>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      <footer>Stay close. Thaw a friend. Make it through the freeze.</footer>
    </main>
  );
}
