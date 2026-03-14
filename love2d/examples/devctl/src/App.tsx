import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, ScrollView, Modal, Input, useTray, useLuaInterval } from '@reactjit/core';
import {
  useProcessManager, useServerLogs, useDaemonManager,
  useAuditLog, useReservedPorts, formatUptime,
} from './hooks';
import type { ServerInfo } from './hooks';

// ── Palette ──────────────────────────────────────────────────────────────────────

const C = {
  bg:       '#080c1e',
  bgPanel:  '#0d1229',
  bgCard:   '#111738',
  bgHover:  '#161d45',
  bgActive: '#1a2350',
  border:   '#1e2a5a',
  text:     '#d6e8ff',
  muted:    '#6b7db8',
  accent:   '#7db8ff',
  green:    '#5ef58e',
  red:      '#ff6b88',
  yellow:   '#ffb86c',
  orange:   '#ff9f43',
};

// ── Status helpers ────────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  if (status === 'running')  return C.green;
  if (status === 'starting') return C.yellow;
  if (status === 'stopping') return C.yellow;
  if (status === 'crashed')  return C.red;
  if (status === 'failed')   return C.red;
  return C.muted;
}

function statusDot(status: string): string {
  if (status === 'running')  return '\u25CF';
  if (status === 'starting') return '\u25D4';
  if (status === 'stopping') return '\u25D4';
  if (status === 'failed')   return '\u25A0';
  return '\u25CB';
}

// ── Btn ──────────────────────────────────────────────────────────────────────────

function Btn({ label, color, onPress, small }: {
  label: string; color: string; onPress: () => void; small?: boolean;
}) {
  const pad = small ? 5 : 8;
  return (
    <Box
      onClick={onPress}
      style={{
        backgroundColor: 'transparent',
        borderRadius: 4,
        paddingLeft: pad, paddingRight: pad,
        paddingTop: 3, paddingBottom: 3,
        borderWidth: 1, borderColor: C.border,
      }}
      hoverStyle={{ backgroundColor: color + '28', borderColor: color }}
    >
      <Text style={{ color, fontSize: small ? 11 : 12 }}>{label}</Text>
    </Box>
  );
}

// ── ServerCard ───────────────────────────────────────────────────────────────────

function ServerCard({ server, selected, onSelect, onStart, onStop, onRestart, onRemove, onPin, onRenameRequest }: {
  server: ServerInfo;
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onRemove: () => void;
  onPin: () => void;
  onRenameRequest: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isRunning = server.status === 'running' || server.status === 'starting';

  return (
    <Box
      onClick={() => { setMenuOpen(false); onSelect(); }}
      style={{
        backgroundColor: selected ? C.bgActive : C.bgCard,
        borderRadius: 6,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: selected ? C.accent : C.border,
      }}
      hoverStyle={{ backgroundColor: selected ? C.bgActive : C.bgHover }}
    >
      {/* Name row */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ color: statusColor(server.status), fontSize: 11, marginRight: 5 }}>
          {statusDot(server.status)}
        </Text>
        {/* Crash badge */}
        {server.status === 'failed' && (
          <Box style={{
            backgroundColor: C.red + '33', borderRadius: 3,
            paddingLeft: 4, paddingRight: 4, marginRight: 5,
          }}>
            <Text style={{ color: C.red, fontSize: 9 }}>{'FAILED'}</Text>
          </Box>
        )}
        {server.crashCount > 0 && server.status !== 'failed' && (
          <Box style={{
            backgroundColor: C.orange + '33', borderRadius: 3,
            paddingLeft: 4, paddingRight: 4, marginRight: 5,
          }}>
            <Text style={{ color: C.orange, fontSize: 9 }}>{`x${server.crashCount}`}</Text>
          </Box>
        )}
        <Text style={{ color: C.text, fontSize: 13, fontWeight: 'bold', flexGrow: 1 }}>
          {server.name}
        </Text>
        {/* Pin button */}
        <Box
          onClick={(e: any) => { e.stopPropagation?.(); onPin(); }}
          style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 }}
        >
          <Text style={{ color: server.pinned ? C.accent : C.muted, fontSize: 12 }}>
            {server.pinned ? '\u2605' : '\u2606'}
          </Text>
        </Box>
        {/* Menu button */}
        <Box
          onClick={(e: any) => { e.stopPropagation?.(); setMenuOpen(v => !v); }}
          style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 }}
        >
          <Text style={{ color: C.muted, fontSize: 14 }}>{'\u22EE'}</Text>
        </Box>
      </Box>

      {/* Port + uptime */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        {server.port ? (
          <Text style={{ color: C.accent, fontSize: 11 }}>{`:${server.port}`}</Text>
        ) : (
          <Text style={{ color: C.muted, fontSize: 11 }}>{'no port'}</Text>
        )}
        {server.uptime != null && (
          <Text style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>
            {formatUptime(server.uptime)}
          </Text>
        )}
        {server.status === 'unknown' && (
          <Text style={{ color: C.muted, fontSize: 10, marginLeft: 8 }}>{'(offline)'}</Text>
        )}
      </Box>

      {/* Action buttons */}
      <Box style={{ flexDirection: 'row', gap: 4 }}>
        {!isRunning && (
          <Btn label={'Start'} color={C.green} onPress={(e: any) => { e?.stopPropagation?.(); onStart(); }} small />
        )}
        {isRunning && (
          <Btn label={'Stop'} color={C.red} onPress={(e: any) => { e?.stopPropagation?.(); onStop(); }} small />
        )}
        <Btn label={'Restart'} color={C.yellow} onPress={(e: any) => { e?.stopPropagation?.(); onRestart(); }} small />
      </Box>

      {/* Context menu */}
      {menuOpen && (
        <Box
          style={{
            backgroundColor: C.bgPanel,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: C.border,
            marginTop: 8,
            padding: 4,
          }}
        >
          <Box
            onClick={(e: any) => { e.stopPropagation?.(); setMenuOpen(false); onRenameRequest(); }}
            style={{ padding: 6, borderRadius: 3 }}
            hoverStyle={{ backgroundColor: C.bgHover }}
          >
            <Text style={{ color: C.text, fontSize: 12 }}>{'Rename'}</Text>
          </Box>
          <Box
            onClick={(e: any) => { e.stopPropagation?.(); setMenuOpen(false); onPin(); }}
            style={{ padding: 6, borderRadius: 3 }}
            hoverStyle={{ backgroundColor: C.bgHover }}
          >
            <Text style={{ color: C.text, fontSize: 12 }}>
              {server.pinned ? 'Unpin' : 'Pin to top'}
            </Text>
          </Box>
          <Box
            onClick={(e: any) => {
              e.stopPropagation?.();
              setMenuOpen(false);
              onRemove();
            }}
            style={{ padding: 6, borderRadius: 3 }}
            hoverStyle={{ backgroundColor: C.red + '22' }}
          >
            <Text style={{ color: C.red, fontSize: 12 }}>{'Delete'}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── RenameModal ──────────────────────────────────────────────────────────────────

function RenameModal({ visible, current, onClose, onRename }: {
  visible: boolean;
  current: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}) {
  const [value, setValue] = useState(current);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== current) onRename(trimmed);
    onClose();
  }, [value, current, onRename, onClose]);

  return (
    <Modal visible={visible} onClose={onClose}>
      <Box style={{
        backgroundColor: C.bgPanel, borderRadius: 10, padding: 20, width: 340,
        borderWidth: 1, borderColor: C.border,
      }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
          {'Rename Server'}
        </Text>
        <Input
          value={value}
          onChangeText={setValue}
          placeholder="new name"
          style={{
            backgroundColor: C.bgCard, color: C.text, borderColor: C.accent,
            borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 13, marginBottom: 12,
          }}
        />
        <Box style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Box
            onClick={onClose}
            style={{ backgroundColor: C.bgCard, borderRadius: 6, paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7, borderWidth: 1, borderColor: C.border }}
            hoverStyle={{ backgroundColor: C.bgHover }}
          >
            <Text style={{ color: C.muted, fontSize: 12 }}>{'Cancel'}</Text>
          </Box>
          <Box
            onClick={submit}
            style={{ backgroundColor: C.bgCard, borderRadius: 6, paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7, borderWidth: 1, borderColor: C.accent }}
            hoverStyle={{ backgroundColor: C.accent + '22' }}
          >
            <Text style={{ color: C.accent, fontSize: 12 }}>{'Rename'}</Text>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

// ── LogViewer ────────────────────────────────────────────────────────────────────

function LogViewer({ name }: { name: string | null }) {
  const { logs, filter, setFilter } = useServerLogs(name);

  if (!name) {
    return (
      <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: C.muted, fontSize: 14 }}>{'Select a server to view logs'}</Text>
      </Box>
    );
  }

  return (
    <Box style={{ flexGrow: 1 }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center',
        paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
        borderBottomWidth: 1, borderColor: C.border, gap: 8,
      }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: 'bold', flexGrow: 1 }}>
          {`${name} \u2014 ${String(logs.length)} lines`}
        </Text>
        <Input
          value={filter}
          onChangeText={setFilter}
          placeholder={'filter...'}
          style={{
            backgroundColor: C.bgCard, color: C.text, borderColor: C.border,
            borderWidth: 1, borderRadius: 4, paddingLeft: 8, paddingRight: 8,
            paddingTop: 3, paddingBottom: 3, fontSize: 11, width: 120,
          }}
        />
      </Box>
      {/* Log lines */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 8 }}>
          {logs.length === 0 ? (
            <Text style={{ color: C.muted, fontSize: 12 }}>{'No output yet'}</Text>
          ) : logs.map((entry, i) => (
            <Box key={String(i)} style={{ flexDirection: 'row', marginBottom: 1 }}>
              <Text style={{ color: C.muted, fontSize: 11, width: 70 }}>{entry.time || ''}</Text>
              <Text style={{
                color: entry.text?.startsWith('>>>') ? C.accent : C.text,
                fontSize: 11, flexGrow: 1,
              }}>
                {entry.text || ''}
              </Text>
            </Box>
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
}

// ── AuditPanel ───────────────────────────────────────────────────────────────────

function AuditPanel() {
  const entries = useAuditLog();

  return (
    <Box style={{ flexGrow: 1 }}>
      <Box style={{
        paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
        borderBottomWidth: 1, borderColor: C.border,
      }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: 'bold' }}>
          {`Audit Log \u2014 ${entries.length} events`}
        </Text>
      </Box>
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 8 }}>
          {entries.length === 0 ? (
            <Text style={{ color: C.muted, fontSize: 12 }}>{'No events yet'}</Text>
          ) : [...entries].reverse().map((e, i) => (
            <Box key={String(i)} style={{ flexDirection: 'row', marginBottom: 3, alignItems: 'center' }}>
              <Text style={{ color: C.muted, fontSize: 10, width: 140 }}>{e.time}</Text>
              <Box style={{
                backgroundColor: e.actor === 'gui' ? C.accent + '22' : C.green + '22',
                borderRadius: 3, paddingLeft: 5, paddingRight: 5, marginRight: 8,
              }}>
                <Text style={{ color: e.actor === 'gui' ? C.accent : C.green, fontSize: 9 }}>
                  {e.actor}
                </Text>
              </Box>
              <Text style={{ color: C.text, fontSize: 11, flexGrow: 1 }}>{e.event}</Text>
              {e.server ? (
                <Text style={{ color: C.muted, fontSize: 10, marginLeft: 8 }}>{e.server}</Text>
              ) : null}
            </Box>
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
}

// ── SettingsPanel ────────────────────────────────────────────────────────────────

function SettingsPanel() {
  const { ports, setReservedPorts } = useReservedPorts();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const addPort = useCallback(() => {
    const n = parseInt(input.trim(), 10);
    if (isNaN(n) || n < 1 || n > 65535) {
      setError('Invalid port (1–65535)');
      return;
    }
    if (ports.includes(n)) {
      setError('Already reserved');
      return;
    }
    setError('');
    setInput('');
    setReservedPorts([...ports, n].sort((a, b) => a - b));
  }, [input, ports, setReservedPorts]);

  const removePort = useCallback((p: number) => {
    setReservedPorts(ports.filter(x => x !== p));
  }, [ports, setReservedPorts]);

  return (
    <Box style={{ flexGrow: 1, padding: 16 }}>
      <Text style={{ color: C.text, fontSize: 14, fontWeight: 'bold', marginBottom: 12 }}>
        {'Reserved Ports'}
      </Text>
      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>
        {'These ports can never be used by any managed server. Useful for system services or personal tooling that must always have priority.'}
      </Text>

      {/* Add */}
      <Box style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Input
          value={input}
          onChangeText={(v: string) => { setInput(v); setError(''); }}
          placeholder={'port number'}
          style={{
            backgroundColor: C.bgCard, color: C.text, borderColor: C.border,
            borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 12, width: 120,
          }}
        />
        <Box
          onClick={addPort}
          style={{
            backgroundColor: 'transparent', borderRadius: 4,
            paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
            borderWidth: 1, borderColor: C.accent,
          }}
          hoverStyle={{ backgroundColor: C.accent + '22' }}
        >
          <Text style={{ color: C.accent, fontSize: 12 }}>{'Reserve'}</Text>
        </Box>
      </Box>
      {error ? (
        <Text style={{ color: C.red, fontSize: 11, marginBottom: 8 }}>{error}</Text>
      ) : null}

      {/* List */}
      {ports.length === 0 ? (
        <Text style={{ color: C.muted, fontSize: 12 }}>{'No reserved ports yet'}</Text>
      ) : ports.map(p => (
        <Box key={String(p)} style={{
          flexDirection: 'row', alignItems: 'center',
          paddingTop: 6, paddingBottom: 6,
          borderBottomWidth: 1, borderColor: C.border,
        }}>
          <Text style={{ color: C.accent, fontSize: 13, fontWeight: 'bold', flexGrow: 1 }}>
            {`:${p}`}
          </Text>
          <Box
            onClick={() => removePort(p)}
            style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}
            hoverStyle={{ backgroundColor: C.red + '22', borderRadius: 3 }}
          >
            <Text style={{ color: C.muted, fontSize: 11 }}>{'remove'}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ── AddServerModal ───────────────────────────────────────────────────────────────

function FieldLabel({ label }: { label: string }) {
  return <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{label}</Text>;
}

function AddServerModal({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (opts: { name: string; cwd: string; scripts: Record<string, string>; port?: number }) => void;
}) {
  const [name, setName]       = useState('');
  const [cwd, setCwd]         = useState('');
  const [devCmd, setDevCmd]   = useState('');
  const [port, setPort]       = useState('');

  const handleSubmit = useCallback(() => {
    if (!name.trim() || !cwd.trim()) return;
    const scripts: Record<string, string> = {};
    if (devCmd.trim()) scripts.dev = devCmd.trim();
    onAdd({
      name: name.trim(), cwd: cwd.trim(), scripts,
      port: port.trim() ? parseInt(port.trim(), 10) : undefined,
    });
    setName(''); setCwd(''); setDevCmd(''); setPort('');
    onClose();
  }, [name, cwd, devCmd, port, onAdd, onClose]);

  return (
    <Modal visible={visible} onClose={onClose}>
      <Box style={{
        backgroundColor: C.bgPanel, borderRadius: 10, padding: 20, width: 400,
        borderWidth: 1, borderColor: C.border,
      }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>
          {'Add Server'}
        </Text>
        <FieldLabel label="Name" />
        <Input value={name} onChangeText={setName} placeholder="my-app"
          style={{ marginBottom: 12, backgroundColor: C.bgCard, color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 13 }} />
        <FieldLabel label="Working Directory" />
        <Input value={cwd} onChangeText={setCwd} placeholder="/home/user/project"
          style={{ marginBottom: 12, backgroundColor: C.bgCard, color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 13 }} />
        <FieldLabel label="Dev Command (npm script name or !raw command)" />
        <Input value={devCmd} onChangeText={setDevCmd} placeholder="dev"
          style={{ marginBottom: 12, backgroundColor: C.bgCard, color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 13 }} />
        <FieldLabel label="Port (optional)" />
        <Input value={port} onChangeText={setPort} placeholder="5173"
          style={{ marginBottom: 16, backgroundColor: C.bgCard, color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 13 }} />
        <Box style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Box onClick={onClose}
            style={{ backgroundColor: C.bgCard, borderRadius: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderWidth: 1, borderColor: C.border }}
            hoverStyle={{ backgroundColor: C.bgHover }}>
            <Text style={{ color: C.muted, fontSize: 13 }}>{'Cancel'}</Text>
          </Box>
          <Box onClick={handleSubmit}
            style={{ backgroundColor: C.bgCard, borderRadius: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderWidth: 1, borderColor: C.accent }}
            hoverStyle={{ backgroundColor: C.accent + '33' }}>
            <Text style={{ color: C.accent, fontSize: 13 }}>{'Add'}</Text>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

// ── PortList ─────────────────────────────────────────────────────────────────────

function PortList({ servers }: { servers: ServerInfo[] }) {
  const portsInUse = servers
    .filter(s => s.port != null)
    .sort((a, b) => (a.port ?? 0) - (b.port ?? 0));

  if (portsInUse.length === 0) return null;

  return (
    <Box style={{ borderTopWidth: 1, borderColor: C.border, paddingTop: 10, marginTop: 8 }}>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: 'bold', marginBottom: 6 }}>
        {'PORTS'}
      </Text>
      {portsInUse.map(s => (
        <Box key={s.name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 11, width: 50 }}>{`:${s.port}`}</Text>
          <Text style={{ color: C.text, fontSize: 11, flexGrow: 1 }}>{s.name}</Text>
          <Text style={{ color: statusColor(s.status), fontSize: 9 }}>{statusDot(s.status)}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── TabBar ───────────────────────────────────────────────────────────────────────

type Tab = 'servers' | 'audit' | 'settings';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'servers',  label: 'Servers' },
    { id: 'audit',    label: 'Audit Log' },
    { id: 'settings', label: 'Settings' },
  ];
  return (
    <Box style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.border }}>
      {tabs.map(t => (
        <Box
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
            borderBottomWidth: 2,
            borderColor: active === t.id ? C.accent : 'transparent',
          }}
          hoverStyle={{ backgroundColor: C.bgHover }}
        >
          <Text style={{
            color: active === t.id ? C.accent : C.muted,
            fontSize: 12, fontWeight: active === t.id ? 'bold' : 'normal',
          }}>
            {t.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────────

export function App() {
  const {
    servers, daemonOnline,
    startServer, stopServer, restartServer,
    addServer, removeServer, renameServer,
    pinServer, unpinServer,
  } = useProcessManager();
  const { daemonRunning, daemonBusy, toggleDaemon } = useDaemonManager();

  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen]     = useState(false);
  const [renameTarget, setRenameTarget]     = useState<string | null>(null);
  const [activeTab, setActiveTab]           = useState<Tab>('servers');

  const handleAdd = useCallback((opts: any) => { addServer(opts); }, [addServer]);
  const handlePin = useCallback((s: ServerInfo) => {
    if (s.pinned) unpinServer(s.name); else pinServer(s.name);
  }, [pinServer, unpinServer]);

  // ── System tray icon ──────────────────────────────────────────────────
  const trayMenu = React.useMemo(() => {
    const items: Array<{ label?: string; action?: string; separator?: boolean }> = [];

    // Server list with status
    for (const s of servers) {
      const dot = s.status === 'running' ? '\u25CF' : s.status === 'failed' ? '\u25A0' : '\u25CB';
      items.push({ label: `${dot} ${s.name}`, action: `select:${s.name}` });
    }

    if (servers.length > 0) items.push({ separator: true });

    // Bulk actions
    const anyRunning = servers.some(s => s.status === 'running');
    const anyStopped = servers.some(s => s.status !== 'running');
    if (anyStopped) items.push({ label: 'Start All', action: 'start-all' });
    if (anyRunning) items.push({ label: 'Stop All',  action: 'stop-all' });

    items.push({ separator: true });
    items.push({ label: 'Open Dashboard', action: 'focus' });
    items.push({ label: 'Quit', action: 'quit' });
    return items;
  }, [servers]);

  const { updateMenu } = useTray({
    id: 'devctl',
    title: 'dv',
    menu: trayMenu,
    onAction: useCallback((action: string) => {
      if (action === 'quit') {
        // Will be handled by the bridge
      } else if (action === 'focus') {
        // Bring window to front (already visible via Love2D)
      } else if (action === 'start-all') {
        servers.filter(s => s.status !== 'running').forEach(s => startServer(s.name));
      } else if (action === 'stop-all') {
        servers.filter(s => s.status === 'running').forEach(s => stopServer(s.name));
      } else if (action.startsWith('select:')) {
        const name = action.slice(7);
        setSelectedServer(name);
      }
    }, [servers, startServer, stopServer]),
  });

  // Keep tray menu in sync when server list changes
  useLuaInterval(500, () => {
    updateMenu(trayMenu);
  });

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center',
        paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10,
        borderBottomWidth: 1, borderColor: C.border,
      }}>
        <Text style={{ color: C.accent, fontSize: 18, fontWeight: 'bold', flexGrow: 1 }}>
          {'devctl'}
        </Text>
        {!daemonOnline && (
          <Box style={{
            backgroundColor: C.red + '22', borderRadius: 4,
            paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, marginRight: 8,
          }}>
            <Text style={{ color: C.red, fontSize: 11 }}>{'daemon offline'}</Text>
          </Box>
        )}
        <Box style={{
          borderWidth: 1, borderColor: daemonRunning ? C.green : C.red,
          borderRadius: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
          marginRight: 8, backgroundColor: C.bgCard,
        }}>
          <Text style={{ color: daemonRunning ? C.green : C.red, fontSize: 12, fontWeight: 'bold' }}>
            {daemonRunning ? 'SERVER ON' : 'SERVER OFF'}
          </Text>
        </Box>
        <Box
          onClick={toggleDaemon}
          style={{
            backgroundColor: 'transparent', borderRadius: 6,
            paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5,
            borderWidth: 1, borderColor: daemonRunning ? C.orange : C.green, marginRight: 8,
          }}
          hoverStyle={{ backgroundColor: (daemonRunning ? C.orange : C.green) + '22' }}
        >
          <Text style={{ color: daemonRunning ? C.orange : C.green, fontSize: 13 }}>
            {daemonBusy ? 'Working...' : (daemonRunning ? 'Turn Off' : 'Turn On')}
          </Text>
        </Box>
        <Box
          onClick={() => setAddModalOpen(true)}
          style={{
            backgroundColor: 'transparent', borderRadius: 6,
            paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5,
            borderWidth: 1, borderColor: C.accent,
          }}
          hoverStyle={{ backgroundColor: C.accent + '22' }}
        >
          <Text style={{ color: C.accent, fontSize: 13 }}>{'+ Add Server'}</Text>
        </Box>
      </Box>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Body */}
      {activeTab === 'servers' && (
        <Box style={{ flexDirection: 'row', flexGrow: 1 }}>
          {/* Sidebar */}
          <Box style={{ width: 230, borderRightWidth: 1, borderColor: C.border, padding: 10 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: 'bold', marginBottom: 8 }}>
              {'SERVERS'}
            </Text>
            {servers.length === 0 ? (
              <Box style={{ paddingTop: 20, paddingBottom: 20, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 12 }}>{'No servers yet'}</Text>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>
                  {'Use + Add Server or dv add'}
                </Text>
              </Box>
            ) : (
              <ScrollView style={{ flexGrow: 1 }}>
                {servers.map(s => (
                  <ServerCard
                    key={s.name}
                    server={s}
                    selected={selectedServer === s.name}
                    onSelect={() => setSelectedServer(s.name)}
                    onStart={() => startServer(s.name)}
                    onStop={() => stopServer(s.name)}
                    onRestart={() => restartServer(s.name)}
                    onRemove={() => {
                      removeServer(s.name);
                      if (selectedServer === s.name) setSelectedServer(null);
                    }}
                    onPin={() => handlePin(s)}
                    onRenameRequest={() => setRenameTarget(s.name)}
                  />
                ))}
              </ScrollView>
            )}
            <PortList servers={servers} />
          </Box>

          {/* Log viewer */}
          <Box style={{ flexGrow: 1, backgroundColor: C.bgPanel }}>
            <LogViewer name={selectedServer} />
          </Box>
        </Box>
      )}

      {activeTab === 'audit' && (
        <Box style={{ flexGrow: 1, backgroundColor: C.bgPanel }}>
          <AuditPanel />
        </Box>
      )}

      {activeTab === 'settings' && (
        <Box style={{ flexGrow: 1, backgroundColor: C.bgPanel }}>
          <SettingsPanel />
        </Box>
      )}

      {/* Modals */}
      <AddServerModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAdd}
      />
      <RenameModal
        visible={renameTarget != null}
        current={renameTarget ?? ''}
        onClose={() => setRenameTarget(null)}
        onRename={(newName) => {
          if (renameTarget) {
            renameServer(renameTarget, newName).then(() => {
              if (selectedServer === renameTarget) setSelectedServer(newName);
            });
          }
        }}
      />
    </Box>
  );
}
