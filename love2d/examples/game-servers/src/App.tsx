/**
 * Game Server Dashboard — Minecraft + Counter-Strike hosting demo.
 *
 * Two tabs: one for a CS:S/CS2 server, one for Minecraft.
 * Each tab shows: server controls, status, player list, log viewer,
 * and an embedded terminal for RCON commands.
 */
import React, { useState, useCallback } from 'react';
import {
  Box, Text, Pressable, ScrollView, TextInput,
  Terminal, usePTY, useLocalStore,
} from '@reactjit/core';
import { GameServer, useGameServer, type GameServerConfig } from '@reactjit/networking';



// ── Palette ──────────────────────────────────────────────────────────────────

const C = {
  bg:        '#0d1117',
  surface:   '#161b22',
  surfaceHi: '#1c2128',
  border:    '#30363d',
  text:      '#e6edf3',
  dim:       '#6e7681',
  accent:    '#58a6ff',
  green:     '#3fb950',
  yellow:    '#d29922',
  red:       '#f85149',
  orange:    '#f0883e',
  purple:    '#a78bfa',
  cyan:      '#39d5c6',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${Math.floor(secs % 60)}s`;
}

function stateColor(state: string): string {
  if (state === 'running') return C.green;
  if (state === 'starting') return C.yellow;
  if (state === 'installing') return C.purple;
  if (state === 'stopping') return C.orange;
  if (state === 'error') return C.red;
  return C.dim;
}

function stateLabel(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

// ── StatusDot ────────────────────────────────────────────────────────────────

function StatusDot({ color }: { color: string }) {
  return (
    <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
  );
}

// ── ActionButton ─────────────────────────────────────────────────────────────

function ActionButton({ label, color, onPress, disabled }: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ hovered, pressed }: { hovered: boolean; pressed: boolean }) => ({
        paddingLeft: 14, paddingRight: 14,
        paddingTop: 6, paddingBottom: 6,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: disabled ? C.border : color,
        backgroundColor: disabled ? 'transparent'
          : pressed ? color
          : hovered ? `${color}22`
          : 'transparent',
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: disabled ? C.dim : color }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── ServerControls ───────────────────────────────────────────────────────────

function ServerControls({ server, engineLabel, config }: {
  server: ReturnType<typeof useGameServer>;
  engineLabel: string;
  config: GameServerConfig;
}) {
  const isRunning = server.state === 'running';
  const isInstalling = server.state === 'installing';
  const isStopped = server.state === 'stopped' || server.state === 'error';
  const port = config.port || 27015;

  return (
    <Box style={{
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      padding: 16,
      gap: 12,
    }}>
      {/* Header row */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' }}>
        <StatusDot color={stateColor(server.state)} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{engineLabel}</Text>
        <Text style={{ fontSize: 11, color: stateColor(server.state) }}>
          {stateLabel(server.state)}
        </Text>
        <Box style={{ flexGrow: 1 }} />
        {server.status && (
          <Text style={{ fontSize: 11, color: C.dim }}>
            {`${server.status.players}/${server.status.maxPlayers} players`}
          </Text>
        )}
      </Box>

      {/* Connection info */}
      <Box style={{
        width: '100%', backgroundColor: C.bg, borderRadius: 4,
        padding: 10, gap: 6,
      }}>
        <Box style={{ flexDirection: 'row', gap: 20, width: '100%', flexWrap: 'wrap' }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: C.dim }}>ADDRESS</Text>
            <Text style={{ fontSize: 12, color: C.accent }}>{`localhost:${port}`}</Text>
          </Box>
          {config.name && (
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 10, color: C.dim }}>HOSTNAME</Text>
              <Text style={{ fontSize: 12, color: C.text }}>{config.name}</Text>
            </Box>
          )}
          {config.game && (
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 10, color: C.dim }}>GAME</Text>
              <Text style={{ fontSize: 12, color: C.text }}>{config.game}</Text>
            </Box>
          )}
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 10, color: C.dim }}>MAX PLAYERS</Text>
            <Text style={{ fontSize: 12, color: C.text }}>{`${config.maxPlayers || 0}`}</Text>
          </Box>
          {config.rconPassword && (
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 10, color: C.dim }}>RCON PORT</Text>
              <Text style={{ fontSize: 12, color: C.text }}>{`${config.rconPort || port}`}</Text>
            </Box>
          )}
        </Box>

        {/* Running status details */}
        {server.status && isRunning && (
          <Box style={{ flexDirection: 'row', gap: 20, width: '100%', flexWrap: 'wrap', paddingTop: 4 }}>
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 10, color: C.dim }}>MAP</Text>
              <Text style={{ fontSize: 12, color: C.green }}>{server.status.map || '—'}</Text>
            </Box>
            {server.status.version && (
              <Box style={{ gap: 2 }}>
                <Text style={{ fontSize: 10, color: C.dim }}>VERSION</Text>
                <Text style={{ fontSize: 12, color: C.text }}>{server.status.version}</Text>
              </Box>
            )}
            {server.status.ping != null && (
              <Box style={{ gap: 2 }}>
                <Text style={{ fontSize: 10, color: C.dim }}>PING</Text>
                <Text style={{ fontSize: 12, color: C.text }}>{`${server.status.ping}ms`}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Action buttons */}
      <Box style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
        <ActionButton label="Install" color={C.purple} onPress={server.install} disabled={!isStopped || isInstalling} />
        <ActionButton label="Start" color={C.green} onPress={server.start} disabled={!isStopped || isInstalling} />
        <ActionButton label="Stop" color={C.red} onPress={server.stop} disabled={!isRunning} />
      </Box>
    </Box>
  );
}

// ── PlayerList ───────────────────────────────────────────────────────────────

function PlayerList({ server }: { server: ReturnType<typeof useGameServer> }) {
  return (
    <Box style={{
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
      gap: 8,
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: C.dim }}>
        {`PLAYERS (${server.players.length})`}
      </Text>

      {server.players.length === 0 ? (
        <Text style={{ fontSize: 11, color: C.dim }}>No players connected.</Text>
      ) : (
        server.players.map(p => (
          <Box key={p.id} style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            width: '100%',
            paddingTop: 4, paddingBottom: 4,
            borderBottomWidth: 1, borderColor: C.border,
          }}>
            <StatusDot color={C.green} />
            <Text style={{ fontSize: 12, color: C.text, flexGrow: 1 }}>{p.name}</Text>
            <Text style={{ fontSize: 10, color: C.dim }}>{`${p.score} pts`}</Text>
            <Text style={{ fontSize: 10, color: C.dim }}>{formatDuration(p.duration)}</Text>
            {p.ping != null && (
              <Text style={{ fontSize: 10, color: C.dim }}>{`${p.ping}ms`}</Text>
            )}
            <Pressable
              onPress={() => server.kick(p.name)}
              style={({ hovered }: { hovered: boolean }) => ({
                paddingLeft: 6, paddingRight: 6,
                paddingTop: 2, paddingBottom: 2,
                borderRadius: 3,
                backgroundColor: hovered ? '#2d1f1f' : 'transparent',
              })}
            >
              <Text style={{ fontSize: 10, color: C.red }}>kick</Text>
            </Pressable>
          </Box>
        ))
      )}
    </Box>
  );
}

// ── LogViewer ────────────────────────────────────────────────────────────────

function LogViewer({ server }: { server: ReturnType<typeof useGameServer> }) {
  const levelColor = (lvl: string) =>
    lvl === 'error' ? C.red : lvl === 'warn' ? C.yellow : C.dim;

  return (
    <Box style={{
      width: '100%',
      flexGrow: 1,
      backgroundColor: C.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
      gap: 6,
      flexDirection: 'column',
    }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: C.dim, flexGrow: 1 }}>
          {`LOGS (${server.logs.length})`}
        </Text>
      </Box>

      <ScrollView style={{ flexGrow: 1, backgroundColor: C.bg, borderRadius: 4, padding: 8 }}>
        {server.logs.length === 0 ? (
          <Text style={{ fontSize: 11, color: C.dim }}>No log entries.</Text>
        ) : (
          server.logs.map((log, i) => (
            <Box key={i} style={{ flexDirection: 'row', gap: 6, paddingTop: 1, paddingBottom: 1 }}>
              <Text style={{ fontSize: 10, color: C.dim, width: 52 }}>
                {`${String(new Date(log.timestamp).getHours()).padStart(2,'0')}:${String(new Date(log.timestamp).getMinutes()).padStart(2,'0')}:${String(new Date(log.timestamp).getSeconds()).padStart(2,'0')}`}
              </Text>
              <Text style={{ fontSize: 10, color: levelColor(log.level), width: 36 }}>
                {`[${log.level}]`}
              </Text>
              <Text style={{ fontSize: 10, color: C.text, flexGrow: 1 }}>{log.message}</Text>
            </Box>
          ))
        )}
      </ScrollView>
    </Box>
  );
}

// ── RconTerminal — embedded PTY wired to RCON ────────────────────────────────

function RconTerminal({ server, sessionName }: {
  server: ReturnType<typeof useGameServer>;
  sessionName: string;
}) {
  const [input, setInput] = useState('');

  const {
    output, connected, terminalProps, clearOutput,
  } = usePTY({
    type: 'template',
    shell: 'bash',
    session: sessionName,
    rows: 12,
    cols: 80,
  });

  // Strip ANSI for display
  const clean = (s: string) =>
    s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
     .replace(/\x1b\][^\x07]*\x07/g, '')
     .replace(/\r\n/g, '\n')
     .replace(/\r/g, '\n');

  const handleSubmit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    server.rcon(cmd);
  }, [input, server]);

  const isRunning = server.state === 'running';

  return (
    <Box style={{
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
      gap: 8,
    }}>
      {/* Hidden terminal capability for PTY lifecycle */}
      <Terminal {...terminalProps} />

      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: C.dim }}>RCON CONSOLE</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={clearOutput} style={{ paddingLeft: 6, paddingRight: 6 }}>
          <Text style={{ fontSize: 10, color: C.dim }}>clear</Text>
        </Pressable>
      </Box>

      {/* Output area */}
      <ScrollView style={{ height: 140, backgroundColor: C.bg, borderRadius: 4, padding: 8 }}>
        <Text style={{ fontSize: 11, color: C.text }}>
          {clean(output) || (isRunning ? 'Ready. Type RCON commands below.' : 'Server not running.')}
        </Text>
      </ScrollView>

      {/* Input row */}
      <Box style={{ flexDirection: 'row', width: '100%', gap: 6 }}>
        <Box style={{
          flexGrow: 1, backgroundColor: C.bg,
          borderRadius: 4, borderWidth: 1, borderColor: C.border,
          paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
        }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmit={handleSubmit}
            placeholder={isRunning ? 'rcon command...' : 'server offline'}
            style={{ color: C.text, fontSize: 12 }}
          />
        </Box>
        <ActionButton
          label="Send"
          color={C.accent}
          onPress={handleSubmit}
          disabled={!isRunning || !input.trim()}
        />
      </Box>
    </Box>
  );
}

// ── MapSelector ──────────────────────────────────────────────────────────────

function MapSelector({ maps, current, onSelect }: {
  maps: string[];
  current: string | null;
  onSelect: (map: string) => void;
}) {
  return (
    <Box style={{
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
      gap: 6,
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: C.dim }}>MAP ROTATION</Text>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%' }}>
        {maps.map(m => (
          <Pressable
            key={m}
            onPress={() => onSelect(m)}
            style={({ hovered }: { hovered: boolean }) => ({
              paddingLeft: 10, paddingRight: 10,
              paddingTop: 5, paddingBottom: 5,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: m === current ? C.accent : C.border,
              backgroundColor: m === current ? `${C.accent}22`
                : hovered ? C.surfaceHi
                : 'transparent',
            })}
          >
            <Text style={{
              fontSize: 11,
              color: m === current ? C.accent : C.text,
              fontWeight: m === current ? '700' : '400',
            }}>
              {m}
            </Text>
          </Pressable>
        ))}
      </Box>
    </Box>
  );
}

// ── ServerPanel — one complete server management view ─────────────────────────

function ServerPanel({ engineLabel, gameServerElement, server, config }: {
  engineLabel: string;
  gameServerElement: React.ReactNode;
  server: ReturnType<typeof useGameServer>;
  config: GameServerConfig;
}) {
  return (
    <Box style={{ width: '100%', flexGrow: 1, flexDirection: 'column', gap: 12 }}>
      {/* The declarative <GameServer> node (non-visual — manages the process) */}
      {gameServerElement}

      <ServerControls server={server} engineLabel={engineLabel} config={config} />

      {server.maps.length > 0 && (
        <MapSelector
          maps={server.maps}
          current={server.status?.map ?? null}
          onSelect={server.changeMap}
        />
      )}

      <PlayerList server={server} />
      <LogViewer server={server} />
      <RconTerminal server={server} sessionName={`rcon-${engineLabel.toLowerCase().replace(/\s/g, '-')}`} />
    </Box>
  );
}

// ── CS Maps / MC Worlds ──────────────────────────────────────────────────────


// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'cs' | 'minecraft';

function TabButton({ id, label, icon, active, onPress }: {
  id: Tab;
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered: boolean }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 10, paddingBottom: 10,
        borderRadius: 6,
        backgroundColor: active ? C.surface : hovered ? C.surfaceHi : 'transparent',
        borderWidth: active ? 1 : 0,
        borderColor: C.border,
      })}
    >
      <Text style={{ fontSize: 14, color: active ? C.accent : C.dim }}>{icon}</Text>
      <Text style={{
        fontSize: 13,
        fontWeight: active ? '700' : '400',
        color: active ? C.text : C.dim,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<Tab>('cs');

  // Persisted configs via SQLite
  const [csConfig] = useLocalStore<GameServerConfig>('cs-server', {
    port: 27015,
    game: 'cstrike',
    map: 'de_dust2',
    maxPlayers: 24,
    rconPassword: 'rcon_secret',
    tickrate: 128,
    name: 'ReactJIT CS Server',
  });

  const [mcConfig] = useLocalStore<GameServerConfig>('mc-server', {
    port: 25565,
    maxPlayers: 20,
    difficulty: 'normal',
    gameType: 'survival',
    rconPassword: 'mc_admin',
    rconPort: 25575,
    memory: '4G',
    name: 'ReactJIT Minecraft',
    pvp: true,
    viewDistance: 12,
    onlineMode: true,
  });

  const server = useGameServer();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, flexDirection: 'column' }}>

      {/* Header */}
      <Box style={{
        width: '100%', height: 56,
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderColor: C.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 20, paddingRight: 20,
        gap: 16,
      }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.accent }}>Game Servers</Text>
        <Box style={{ width: 1, height: 24, backgroundColor: C.border }} />

        <TabButton id="cs" label="Counter-Strike" icon="CS" active={tab === 'cs'} onPress={() => setTab('cs')} />
        <TabButton id="minecraft" label="Minecraft" icon="MC" active={tab === 'minecraft'} onPress={() => setTab('minecraft')} />

        <Box style={{ flexGrow: 1 }} />

        {/* Global status */}
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <StatusDot color={stateColor(server.state)} />
          <Text style={{ fontSize: 11, color: C.dim }}>
            {`${stateLabel(server.state)} | ${server.players.length} online`}
          </Text>
        </Box>
      </Box>

      {/* Main content */}
      <Box style={{ flexGrow: 1, padding: 16, flexDirection: 'column' }}>
        {tab === 'cs' && (
          <ServerPanel
            engineLabel="Counter-Strike (Source)"
            gameServerElement={
              <GameServer
                type="source"
                config={csConfig}
                onReady={() => {}}
                onPlayerJoin={(e) => server.say(`Welcome ${e.player}!`)}
              />
            }
            server={server}
            config={csConfig}
          />
        )}

        {tab === 'minecraft' && (
          <ServerPanel
            engineLabel="Minecraft (Java)"
            gameServerElement={
              <GameServer
                type="minecraft"
                config={mcConfig}
                onReady={() => {}}
              />
            }
            server={server}
            config={mcConfig}
          />
        )}
      </Box>

    </Box>
  );
}
