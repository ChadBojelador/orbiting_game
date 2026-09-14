import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  WEAPONS,
  sanitizeDisplayName,
  normalizeInviteCode,
  type GameMode,
  type GuestSession,
  type LobbyView,
  type MapId,
  type WeaponId,
} from '@ice-water/shared';
import type { LobbyRoom } from '../network/lobby-client.js';
import type { FpsSettings } from '../game/fps-settings.js';
import type { LobbySection } from '../game/lobby-preview.js';
import { LoadoutScreen } from './loadout-screen.js';
import { SettingsPanel } from './settings-panel.js';

const LobbyPreview = lazy(() =>
  import('../game/lobby-preview.js').then((module) => ({ default: module.LobbyPreview })),
);

interface LobbyScreenProps {
  guest: GuestSession | null;
  room: LobbyRoom | null;
  view: LobbyView | null;
  error: string;
  isBusy: boolean;
  now: number;
  settings: FpsSettings;
  onSettings: (settings: FpsSettings) => void;
  onIdentify: (name: string) => void;
  onCreate: (mode: GameMode, mapId: MapId, primary: WeaponId) => void;
  onJoin: (code: string, primary: WeaponId) => void;
  onLeave: () => void;
  onForgetGuest: () => void;
  onAudioUnlock: () => void;
  onUiCue: (cue: 'hover' | 'select' | 'deploy') => void;
}

const MODE_DETAILS: Record<GameMode, { name: string; summary: string; limit: string }> = {
  ffa: {
    name: 'Free-for-all',
    summary: 'Every operator for themselves.',
    limit: '30 eliminations · 5:00',
  },
  tdm: {
    name: 'Team deathmatch',
    summary: 'Ice and Water squads collide.',
    limit: '50 team eliminations · 5:00',
  },
  duel: { name: 'Duel', summary: 'A focused one-on-one fight.', limit: '10 eliminations · 3:00' },
};

export function LobbyScreen(props: LobbyScreenProps) {
  const { guest, room, view, error, isBusy, now, settings } = props;
  const [section, setSection] = useState<LobbySection>(guest ? 'play' : 'main');
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [mode, setMode] = useState<GameMode>('ffa'),
    [mapId, setMapId] = useState<MapId>('frostline');
  const [primary, setPrimary] = useState<WeaponId>('assault-rifle'),
    [copy, setCopy] = useState('Copy invite code'),
    [isSocialOpen, setSocialOpen] = useState(false);
  const previousGuest = useRef(guest?.playerId),
    previousRoom = useRef(room);
  const local = view?.players.find((player) => player.playerId === guest?.playerId);
  const selectedWeapon = local?.primaryWeapon ?? primary;

  useEffect(() => {
    if (guest && !previousGuest.current) setSection('play');
    if (room && !previousRoom.current) setSection('party');
    if (!room && previousRoom.current) setSection('play');
    previousGuest.current = guest?.playerId;
    previousRoom.current = room;
  }, [guest, room]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && section !== 'main' && section !== 'play' && section !== 'party')
        setSection(room ? 'party' : 'play');
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [room, section]);

  const navigate = (next: LobbySection) => {
    setSection(room && next === 'play' ? 'party' : next);
    props.onUiCue(next === 'play' ? 'deploy' : 'select');
  };
  const identify = (event: FormEvent) => {
    event.preventDefault();
    const value = sanitizeDisplayName(name);
    if (!value) {
      props.onIdentify(name);
      return;
    }
    props.onIdentify(value);
  };
  const join = (event: FormEvent) => {
    event.preventDefault();
    const invite = normalizeInviteCode(code);
    props.onJoin(invite ?? code, primary);
  };
  const connected = view?.players.filter((player) => player.isConnected) ?? [];
  const hover = (event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as Element).closest('button,select,input')) props.onUiCue('hover');
  };

  return (
    <main
      className={`lobby-shell lobby-view-${section}${section === 'settings' ? ' is-panel-focus' : ''}`}
      onPointerDown={props.onAudioUnlock}
      onPointerOver={hover}
    >
      <section className="lobby-stage" aria-label="3D lobby stage">
        <Suspense
          fallback={
            <div className="preview-fallback">
              <span>Opening facility…</span>
            </div>
          }
        >
          <LobbyPreview
            section={section}
            weapon={selectedWeapon}
            reducedEffects={settings.reducedEffects}
            isRoomActive={!!room || isBusy}
          />
        </Suspense>
        <div className="stage-vignette" />
        <div className="facility-readout" aria-hidden="true">
          <span>FR-07</span>
          <i />
          <span>CRYO BAY</span>
        </div>
        <div className="lobby-wordmark" aria-label="Ice Ice Water">
          <span>ICE ICE</span>
          <strong>WATER</strong>
          <small>Frostline operations</small>
        </div>
        {section === 'customize' && (
          <p className="showcase-hint">Drag to rotate · Wheel to zoom · Esc to return</p>
        )}
      </section>

      <header className="lobby-topbar">
        <button
          className="brand-lockup"
          onClick={() => navigate(guest ? 'main' : 'main')}
          aria-label="Ice Ice Water home"
        >
          <i />
          <span>IIW</span>
          <small>Frostline // private network</small>
        </button>
        <div className="network-state">
          <span className="status-dot" />
          Invite-only servers
        </div>
        {guest && (
          <button className="profile-chip" onClick={() => navigate('profile')}>
            <span className="profile-avatar">{guest.displayName.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{guest.displayName}</strong>
              <small>Guest operative</small>
            </span>
            <i>›</i>
          </button>
        )}
      </header>

      {guest && (
        <nav className="main-navigation" aria-label="Main navigation">
          <NavButton label="Play" section="play" current={section} onClick={navigate} accent />
          <NavButton label="Loadout" section="loadout" current={section} onClick={navigate} />
          <NavButton label="Game modes" section="modes" current={section} onClick={navigate} />
          <NavButton label="Customize" section="customize" current={section} onClick={navigate} />
          <NavButton label="Settings" section="settings" current={section} onClick={navigate} />
        </nav>
      )}

      <section
        className="command-panel"
        aria-label="Private room lobby"
        aria-busy={isBusy}
        key={`${section}-${room ? 'room' : 'solo'}-${guest ? 'guest' : 'new'}`}
      >
        {!guest ? (
          <IdentityPanel name={name} setName={setName} identify={identify} isBusy={isBusy} />
        ) : room && view ? (
          <RoomAwarePanel
            section={section}
            guest={guest}
            room={room}
            view={view}
            localWeapon={selectedWeapon}
            settings={settings}
            now={now}
            isBusy={isBusy}
            copy={copy}
            setCopy={setCopy}
            onSettings={props.onSettings}
            onSection={navigate}
            onLeave={props.onLeave}
          />
        ) : (
          <SoloPanel
            section={section}
            guest={guest}
            mode={mode}
            setMode={setMode}
            mapId={mapId}
            setMapId={setMapId}
            primary={primary}
            setPrimary={setPrimary}
            code={code}
            setCode={setCode}
            settings={settings}
            isBusy={isBusy}
            onSettings={props.onSettings}
            onSection={navigate}
            onCreate={() => {
              props.onUiCue('deploy');
              props.onCreate(mode, mapId, primary);
            }}
            onJoin={join}
            onForget={props.onForgetGuest}
          />
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {guest && (
        <PartyDock
          guest={guest}
          view={view}
          connected={connected}
          onOpen={() => navigate('party')}
        />
      )}
      {guest && (
        <aside className={`social-drawer${isSocialOpen ? ' is-open' : ''}`}>
          <button
            className="social-toggle"
            aria-expanded={isSocialOpen}
            onClick={() => setSocialOpen((open) => !open)}
          >
            <span>Social</span>
            <i>{connected.length || '—'}</i>
          </button>
          {isSocialOpen && (
            <div className="social-content">
              <div className="panel-kicker">Comms channel</div>
              <h2>Social</h2>
              {connected.length > 1 ? (
                <>
                  <p>Operators in this room</p>
                  <ul>
                    {connected
                      .filter((player) => player.playerId !== guest.playerId)
                      .map((player) => (
                        <li key={player.playerId}>
                          <span className="status-dot" />
                          {player.displayName}
                          <small>{player.isBot ? 'Practice bot' : 'Connected'}</small>
                        </li>
                      ))}
                  </ul>
                </>
              ) : (
                <p>
                  Friend discovery is not connected in this private playtest. Share a room code to
                  assemble a party.
                </p>
              )}
            </div>
          )}
        </aside>
      )}
    </main>
  );
}

function NavButton({
  label,
  section,
  current,
  onClick,
  accent = false,
}: {
  label: string;
  section: LobbySection;
  current: LobbySection;
  onClick: (section: LobbySection) => void;
  accent?: boolean;
}) {
  const isActive = current === section || (section === 'play' && current === 'party');
  return (
    <button
      className={`${accent ? 'nav-primary ' : 'nav-item '}${isActive ? 'is-active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onClick(section)}
    >
      <span>{label}</span>
      <i />
    </button>
  );
}

function IdentityPanel({
  name,
  setName,
  identify,
  isBusy,
}: {
  name: string;
  setName: (name: string) => void;
  identify: (event: FormEvent) => void;
  isBusy: boolean;
}) {
  return (
    <>
      <div className="panel-kicker">Secure guest access</div>
      <h1>Enter Frostline</h1>
      <p className="panel-lede">
        Claim a callsign and step into the private arena network. No account required.
      </p>
      <form onSubmit={identify}>
        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          autoComplete="nickname"
          placeholder="Your player name"
          required
        />
        <small>2–20 letters or numbers.</small>
        <button className="primary" disabled={isBusy}>
          {isBusy ? 'Connecting…' : 'Let’s go'}
        </button>
      </form>
      <div className="panel-footnote">
        <span>WebGL 2</span>
        <span>Keyboard + touch</span>
        <span>Private rooms</span>
      </div>
    </>
  );
}

interface SoloPanelProps {
  section: LobbySection;
  guest: GuestSession;
  mode: GameMode;
  setMode: (mode: GameMode) => void;
  mapId: MapId;
  setMapId: (map: MapId) => void;
  primary: WeaponId;
  setPrimary: (weapon: WeaponId) => void;
  code: string;
  setCode: (code: string) => void;
  settings: FpsSettings;
  isBusy: boolean;
  onSettings: (settings: FpsSettings) => void;
  onSection: (section: LobbySection) => void;
  onCreate: () => void;
  onJoin: (event: FormEvent) => void;
  onForget: () => void;
}
function SoloPanel(props: SoloPanelProps) {
  const { section } = props;
  if (section === 'loadout')
    return <LoadoutPanel value={props.primary} onChange={props.setPrimary} />;
  if (section === 'modes') return <GameModePanel value={props.mode} onChange={props.setMode} />;
  if (section === 'customize') return <CustomizationPanel />;
  if (section === 'profile') return <ProfilePanel guest={props.guest} />;
  if (section === 'settings')
    return (
      <SettingsPanel
        value={props.settings}
        onChange={props.onSettings}
        onClose={() => props.onSection('play')}
      />
    );
  if (section === 'main')
    return (
      <>
        <div className="panel-kicker">Welcome back</div>
        <h1>{props.guest.displayName}</h1>
        <p className="panel-lede">
          Your field kit is staged. Choose a private deployment or join an operator by invite code.
        </p>
        <button className="primary deployment-button" onClick={() => props.onSection('play')}>
          <span>Play</span>
          <small>Create or join a private room</small>
        </button>
        <button className="text-button" onClick={props.onForget}>
          Change callsign
        </button>
      </>
    );
  return (
    <>
      <div className="panel-kicker">Frostline deployment</div>
      <h1>Find your fight</h1>
      <p className="panel-lede">
        Public matchmaking is not enabled. Create an invite-only room in your selected format.
      </p>
      <div className="field-row">
        <label htmlFor="game-mode">Game mode</label>
        <select
          id="game-mode"
          value={props.mode}
          onChange={(event) => props.setMode(event.target.value as GameMode)}
        >
          {Object.entries(MODE_DETAILS).map(([id, detail]) => (
            <option key={id} value={id}>
              {detail.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="map-choice">Map</label>
        <select
          id="map-choice"
          value={props.mapId}
          onChange={(event) => props.setMapId(event.target.value as MapId)}
        >
          <option value="frostline">Frostline</option>
          <option value="island">Island ? Fort</option>
        </select>
      </div>
      <LoadoutScreen value={props.primary} onChange={props.setPrimary} />
      <button
        className="primary deployment-button"
        onClick={props.onCreate}
        disabled={props.isBusy || props.guest.expiresAt <= Date.now()}
      >
        <span>{props.isBusy ? 'Opening room…' : 'Create private room'}</span>
        <small>
          {MODE_DETAILS[props.mode].name} · {WEAPONS[props.primary].name}
        </small>
      </button>
      <form className="join-form" onSubmit={props.onJoin}>
        <label htmlFor="invite-code">Invite code</label>
        <div>
          <input
            id="invite-code"
            value={props.code}
            onChange={(event) => props.setCode(event.target.value)}
            maxLength={8}
            placeholder="ABCDEFGH"
            autoCapitalize="characters"
            required
          />
          <button type="submit" disabled={props.isBusy}>
            Join room
          </button>
        </div>
      </form>
      <button className="text-button" onClick={props.onForget}>
        Change callsign
      </button>
    </>
  );
}

interface RoomAwareProps {
  section: LobbySection;
  guest: GuestSession;
  room: LobbyRoom;
  view: LobbyView;
  localWeapon: WeaponId;
  settings: FpsSettings;
  now: number;
  isBusy: boolean;
  copy: string;
  setCopy: (copy: string) => void;
  onSettings: (settings: FpsSettings) => void;
  onSection: (section: LobbySection) => void;
  onLeave: () => void;
}
function RoomAwarePanel(props: RoomAwareProps) {
  const { section, view, guest, room } = props,
    isHost = view.hostPlayerId === guest.playerId,
    count = view.players.filter((player) => player.isConnected).length;
  if (section === 'loadout')
    return (
      <LoadoutPanel
        value={props.localWeapon}
        onChange={(weapon) => room.send('player/loadout', { primaryWeapon: weapon })}
        disabled={view.phase !== 'lobby'}
      />
    );
  if (section === 'modes')
    return (
      <GameModePanel
        value={view.gameMode}
        onChange={(mode) => room.send('room/configure', { gameMode: mode })}
        disabled={!isHost || view.phase !== 'lobby'}
      />
    );
  if (section === 'customize') return <CustomizationPanel />;
  if (section === 'profile') return <ProfilePanel guest={guest} />;
  if (section === 'settings')
    return (
      <SettingsPanel
        value={props.settings}
        onChange={props.onSettings}
        onClose={() => props.onSection('party')}
      />
    );
  const seconds = Math.max(0, Math.ceil((view.phaseDeadline - props.now) / 1000));
  return (
    <>
      <div className="panel-kicker">Private room // live</div>
      <h1>{view.phase === 'countdown' ? `Deploying in ${seconds}` : 'Squad assembled'}</h1>
      <p role="status" aria-label="Connected players" className="room-count">
        <strong>{count}</strong>
        <span>/ {view.maxPlayers} connected</span>
      </p>
      <div className="invite-block">
        <span>Room invite code</span>
        <output className="invite-output" aria-label="Room invite code">
          {view.inviteCode}
        </output>
        <button
          onClick={() =>
            void navigator.clipboard.writeText(view.inviteCode).then(
              () => props.setCopy('Copied'),
              () => props.setCopy('Select the code above'),
            )
          }
        >
          {props.copy}
        </button>
      </div>
      <div className="field-row">
        <label htmlFor="room-mode">Game mode</label>
        <select
          id="room-mode"
          value={view.gameMode}
          disabled={!isHost || view.phase !== 'lobby'}
          onChange={(event) => room.send('room/configure', { gameMode: event.target.value })}
        >
          {Object.entries(MODE_DETAILS).map(([id, detail]) => (
            <option key={id} value={id}>
              {detail.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="room-map">Map</label>
        <select
          id="room-map"
          value={view.mapId}
          disabled={!isHost || view.phase !== 'lobby'}
          onChange={(event) => room.send('room/configure', { mapId: event.target.value as MapId })}
        >
          <option value="frostline">Frostline</option>
          <option value="island">Island ? Fort</option>
        </select>
      </div>
      <ul className="roster">
        {view.players.map((player) => (
          <li key={player.playerId}>
            <span>
              <i className={`roster-state${player.isConnected ? ' is-online' : ''}`} />
              {player.displayName}
            </span>
            <small>
              {player.playerId === view.hostPlayerId
                ? 'Party leader'
                : player.isBot
                  ? 'Practice bot'
                  : player.isConnected
                    ? 'Ready'
                    : 'Away'}
            </small>
          </li>
        ))}
      </ul>
      {isHost ? (
        <button
          className="primary deployment-button"
          disabled={view.phase !== 'lobby' || count < view.minPlayers}
          onClick={() => room.send('room/start', {})}
        >
          <span>Start countdown</span>
          <small>{count === 1 ? 'Solo practice ready' : 'Close room and deploy party'}</small>
        </button>
      ) : (
        <p className="waiting-state">Waiting for the party leader to deploy.</p>
      )}
      <small>
        {count === 1
          ? 'Start solo to learn the map, or share the invite code.'
          : 'New joins close when the countdown starts.'}
      </small>
      <button className="text-button" onClick={props.onLeave} disabled={props.isBusy}>
        Leave room
      </button>
    </>
  );
}

function GameModePanel({
  value,
  onChange,
  disabled = false,
}: {
  value: GameMode;
  onChange: (mode: GameMode) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="panel-kicker">Match format</div>
      <h1>Game modes</h1>
      <p className="panel-lede">Choose the rule set for your next private room.</p>
      <div className="mode-grid">
        {(Object.entries(MODE_DETAILS) as [GameMode, (typeof MODE_DETAILS)[GameMode]][]).map(
          ([id, detail]) => (
            <button
              key={id}
              className={value === id ? 'mode-card is-selected' : 'mode-card'}
              aria-pressed={value === id}
              disabled={disabled}
              onClick={() => onChange(id)}
            >
              <span className="mode-mark">{id === 'ffa' ? '◈' : id === 'tdm' ? '◫' : '◇'}</span>
              <span>
                <strong>{detail.name}</strong>
                <small>{detail.summary}</small>
                <em>{detail.limit}</em>
              </span>
            </button>
          ),
        )}
      </div>
      {disabled && (
        <p className="locked-note">Only the party leader can change the mode before countdown.</p>
      )}
    </>
  );
}

function LoadoutPanel({
  value,
  onChange,
  disabled = false,
}: {
  value: WeaponId;
  onChange: (weapon: WeaponId) => void;
  disabled?: boolean;
}) {
  const weapon = WEAPONS[value];
  return (
    <>
      <div className="panel-kicker">Armory link</div>
      <h1>Loadout</h1>
      <p className="panel-lede">Changes update the weapon on your lobby character immediately.</p>
      <LoadoutScreen value={value} onChange={onChange} disabled={disabled} />
      <dl className="weapon-stats">
        <div>
          <dt>Damage</dt>
          <dd>
            {weapon.damage}
            {weapon.pelletsPerShot > 1 ? ` × ${weapon.pelletsPerShot}` : ''}
          </dd>
        </div>
        <div>
          <dt>Magazine</dt>
          <dd>{weapon.magazineSize}</dd>
        </div>
        <div>
          <dt>Range</dt>
          <dd>{weapon.range} m</dd>
        </div>
        <div>
          <dt>Fire mode</dt>
          <dd>{weapon.fireMode}</dd>
        </div>
      </dl>
      <div className="kit-slots">
        <span>
          <i>1</i>
          {weapon.name}
        </span>
        <span>
          <i>2</i>Snowmelt
        </span>
        <span>
          <i>3</i>Ice Pick
        </span>
      </div>
    </>
  );
}

function CustomizationPanel() {
  return (
    <>
      <div className="panel-kicker">Operator bay</div>
      <h1>Customize</h1>
      <p className="panel-lede">
        Inspect the current field-issued operator model in the live scene.
      </p>
      <div className="system-notice">
        <strong>Field kit active</strong>
        <span>
          Cosmetic inventory, saved skins, accessories, emotes, and banners are not connected in
          this playtest.
        </span>
      </div>
      <div className="control-hint">
        <span>Drag</span>
        <strong>Rotate operator</strong>
      </div>
      <div className="control-hint">
        <span>Wheel</span>
        <strong>Adjust camera</strong>
      </div>
      <div className="control-hint">
        <span>Esc</span>
        <strong>Return to lobby</strong>
      </div>
    </>
  );
}

function ProfilePanel({ guest }: { guest: GuestSession }) {
  return (
    <>
      <div className="panel-kicker">Player dossier</div>
      <h1>{guest.displayName}</h1>
      <div className="profile-large">
        <span>{guest.displayName.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>Guest operative</strong>
          <small>Session identity</small>
        </div>
      </div>
      <dl className="profile-facts">
        <div>
          <dt>Access</dt>
          <dd>Private playtest</dd>
        </div>
        <div>
          <dt>Progression</dt>
          <dd>Not enabled</dd>
        </div>
        <div>
          <dt>Rank</dt>
          <dd>Unranked</dd>
        </div>
      </dl>
      <p className="system-note">
        Accounts, currency, and persistent progression are outside the current playable release.
        Your callsign remains active for this browser tab.
      </p>
    </>
  );
}

function PartyDock({
  guest,
  view,
  connected,
  onOpen,
}: {
  guest: GuestSession;
  view: LobbyView | null | undefined;
  connected: LobbyView['players'];
  onOpen: () => void;
}) {
  const members = view
    ? connected.slice(0, 4)
    : [
        {
          playerId: guest.playerId,
          displayName: guest.displayName,
          isConnected: true,
          isBot: false,
        },
      ];
  return (
    <section className="party-dock" aria-label="Your party">
      <button className="party-label" onClick={onOpen}>
        <small>Your party</small>
        <strong>{members.length} / 4</strong>
      </button>
      <div className="party-members">
        {members.map((member) => (
          <button key={member.playerId} onClick={onOpen}>
            <span>{member.displayName.slice(0, 1).toUpperCase()}</span>
            <small>{member.displayName}</small>
            <i className="status-dot" />
          </button>
        ))}
        {Array.from({ length: Math.max(0, 4 - members.length) }, (_, index) => (
          <span className="party-slot" key={index}>
            <i>+</i>
            <small>{view ? 'Open slot' : 'Invite code'}</small>
          </span>
        ))}
      </div>
    </section>
  );
}
