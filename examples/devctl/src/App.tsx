import React, { useState, useCallback } from 'react';
import { Box, Text, ScrollView, Modal, Input } from '@reactjit/core';
import { useProcessManager, useServerLogs, formatUptime } from './hooks';
import type { ServerInfo } from './hooks';

// ── Palette ─────────────────────────────────────────────────────────────────────

const C = {
  bg:        '#080c1e',
  bgPanel:   '#0d1229',
  bgCard:    '#111738',
  bgHover:   '#161d45',
  bgActive:  '#1a2350',
  border:    '#1e2a5a',
  text:      '#d6e8ff',
  muted:     '#6b7db8',
  accent:    '#7db8ff',
  green:     '#5ef58e',
  red:       '#ff6b88',
  yellow:    '#ffb86c',
  orange:    '#ff9f43',
};

// ── Status helpers ──────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  if (status === 'running') return C.green;
  if (status === 'crashed') return C.red;
  if (status === 'starting') return C.yellow;
  return C.muted;
}

function statusDot(status: string): string {
  return status === 'running' ? '\u25CF' : '\u25CB';
}

// ── ServerCard ──────────────────────────────────────────────────────────────────

function ServerCard({ server, selected, onSelect, onStart, onStop, onRestart, onRemove }: {
  server: ServerInfo;
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onRemove: () => void;
}) {
  const isRunning = server.status === 'running';
  const [clickLog, setClickLog] = useState('');

  return (
    <Box
      onClick={onSelect}
      style={{
        backgroundColor: selected ? C.bgActive : C.bgCard,
        borderRadius: 6,
        padding: 10,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: selected ? C.accent : C.border,
      }}
      hoverStyle={{ backgroundColor: C.bgHover }}
    >
      {/* Name + status */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ color: statusColor(server.status), fontSize: 12, marginRight: 6 }}>
          {statusDot(server.status)}
        </Text>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: 'bold', flexGrow: 1 }}>
          {server.name}
        </Text>
      </Box>

      {/* Port + uptime */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {server.port ? (
          <Text style={{ color: C.accent, fontSize: 11 }}>
            {`:${server.port}`}
          </Text>
        ) : (
          <Text style={{ color: C.muted, fontSize: 11 }}>
            {'no port'}
          </Text>
        )}
        {server.uptime != null && (
          <Text style={{ color: C.muted, fontSize: 11, marginLeft: 8 }}>
            {formatUptime(server.uptime)}
          </Text>
        )}
      </Box>

      {/* Test buttons */}
      <Box style={{ flexDirection: 'row', gap: 4 }}>
        <Box
          onClick={() => { setClickLog('T1'); }}
          style={{ backgroundColor: C.red, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}
        >
          <Text style={{ color: '#fff', fontSize: 12 }}>{'T1'}</Text>
        </Box>
        <Box
          onClick={() => { setClickLog('T2'); onStart(); }}
          style={{ backgroundColor: C.green, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}
        >
          <Text style={{ color: '#fff', fontSize: 12 }}>{'T2'}</Text>
        </Box>
        <Box
          onClick={(e: any) => { e.stopPropagation?.(); setClickLog('T3'); }}
          style={{ backgroundColor: C.yellow, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}
        >
          <Text style={{ color: '#000', fontSize: 12 }}>{'T3'}</Text>
        </Box>
        <Box
          onClick={(e: any) => { e.stopPropagation?.(); setClickLog('T4'); onStart(); }}
          style={{ backgroundColor: C.accent, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}
        >
          <Text style={{ color: '#000', fontSize: 12 }}>{'T4'}</Text>
        </Box>
      </Box>
      {clickLog ? (
        <Text style={{ color: C.green, fontSize: 10, marginTop: 4 }}>{`last: ${clickLog}`}</Text>
      ) : null}
    </Box>
  );
}

function ActionBtn({ label, color, onPress }: {
  label: string; color: string; onPress: () => void;
}) {
  return (
    <Box
      onClick={onPress}
      style={{
        backgroundColor: 'transparent',
        borderRadius: 4,
        paddingLeft: 8, paddingRight: 8,
        paddingTop: 3, paddingBottom: 3,
        borderWidth: 1,
        borderColor: C.border,
      }}
      hoverStyle={{ backgroundColor: color + '33', borderColor: color }}
    >
      <Text style={{ color, fontSize: 12 }}>{label}</Text>
    </Box>
  );
}

// ── LogViewer ───────────────────────────────────────────────────────────────────

function LogViewer({ name }: { name: string | null }) {
  const logs = useServerLogs(name);

  if (!name) {
    return (
      <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: C.muted, fontSize: 14 }}>
          {'Select a server to view logs'}
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{ flexGrow: 1 }}>
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12, paddingRight: 12,
        paddingTop: 8, paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: C.border,
      }}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: 'bold' }}>
          {`${name} \u2014 ${String(logs.length)} lines`}
        </Text>
      </Box>
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 8 }}>
          {logs.length === 0 ? (
            <Text style={{ color: C.muted, fontSize: 12 }}>{'No output yet'}</Text>
          ) : logs.map((entry, i) => (
            <Box key={String(i)} style={{ flexDirection: 'row', marginBottom: 1 }}>
              <Text style={{ color: C.muted, fontSize: 11, width: 70 }}>{entry.time || ''}</Text>
              <Text style={{ color: entry.text?.startsWith('>>>') ? C.accent : C.text, fontSize: 11, flexGrow: 1 }}>
                {entry.text || ''}
              </Text>
            </Box>
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
}

// ── AddServerModal ──────────────────────────────────────────────────────────────

function AddServerModal({ visible, onClose, onAdd }: {
  visible: boolean;
  onClose: () => void;
  onAdd: (opts: { name: string; cwd: string; scripts: Record<string, string>; port?: number }) => void;
}) {
  const [name, setName] = useState('');
  const [cwd, setCwd] = useState('');
  const [devCmd, setDevCmd] = useState('');
  const [port, setPort] = useState('');

  const handleSubmit = useCallback(() => {
    if (!name.trim() || !cwd.trim()) return;
    const scripts: Record<string, string> = {};
    if (devCmd.trim()) scripts.dev = devCmd.trim();
    onAdd({
      name: name.trim(),
      cwd: cwd.trim(),
      scripts,
      port: port.trim() ? parseInt(port.trim(), 10) : undefined,
    });
    setName('');
    setCwd('');
    setDevCmd('');
    setPort('');
    onClose();
  }, [name, cwd, devCmd, port, onAdd, onClose]);

  return (
    <Modal visible={visible} onClose={onClose}>
      <Box style={{
        backgroundColor: C.bgPanel,
        borderRadius: 10,
        padding: 20,
        width: 400,
        borderWidth: 1,
        borderColor: C.border,
      }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>
          {'Add Server'}
        </Text>

        <FieldLabel label="Name" />
        <Input
          value={name}
          onChangeText={setName}
          placeholder="my-app"
          style={{ marginBottom: 12, backgroundColor: C.bgCard, color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 13 }}
        />

        <FieldLabel label="Working Directory" />
        <Input
          value={cwd}
          onChangeText={setCwd}
          placeholder="/home/user/project"
          style={{ marginBottom: 12, backgroundColor: C.bgCard, color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 13 }}
        />

        <FieldLabel label="Dev Command (npm script name)" />
        <Input
          value={devCmd}
          onChangeText={setDevCmd}
          placeholder="dev"
          style={{ marginBottom: 12, backgroundColor: C.bgCard, color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 13 }}
        />

        <FieldLabel label="Port (optional)" />
        <Input
          value={port}
          onChangeText={setPort}
          placeholder="5173"
          style={{ marginBottom: 16, backgroundColor: C.bgCard, color: C.text, borderColor: C.border, borderWidth: 1, borderRadius: 4, padding: 8, fontSize: 13 }}
        />

        <Box style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Box
            onClick={onClose}
            style={{
              backgroundColor: C.bgCard,
              borderRadius: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
              borderWidth: 1, borderColor: C.border,
            }}
            hoverStyle={{ backgroundColor: C.bgHover }}
          >
            <Text style={{ color: C.muted, fontSize: 13 }}>{'Cancel'}</Text>
          </Box>
          <Box
            onClick={handleSubmit}
            style={{
              backgroundColor: C.bgCard,
              borderRadius: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
              borderWidth: 1, borderColor: C.accent,
            }}
            hoverStyle={{ backgroundColor: C.accent + '33' }}
          >
            <Text style={{ color: C.accent, fontSize: 13 }}>{'Add'}</Text>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{label}</Text>
  );
}

// ── PortList ────────────────────────────────────────────────────────────────────

function PortList({ servers }: { servers: ServerInfo[] }) {
  const portsInUse = servers.filter(s => s.port != null).sort((a, b) => (a.port ?? 0) - (b.port ?? 0));

  if (portsInUse.length === 0) return null;

  return (
    <Box style={{ borderTopWidth: 1, borderColor: C.border, paddingTop: 10, marginTop: 8 }}>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: 'bold', marginBottom: 6 }}>
        {'PORTS'}
      </Text>
      {portsInUse.map(s => (
        <Box key={s.name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 11, width: 50 }}>
            {`:${s.port}`}
          </Text>
          <Text style={{ color: C.text, fontSize: 11, flexGrow: 1 }}>
            {s.name}
          </Text>
          <Text style={{ color: statusColor(s.status), fontSize: 9 }}>
            {statusDot(s.status)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────────

export function App() {
  const { servers, startServer, stopServer, restartServer, addServer, removeServer } = useProcessManager();
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const handleAdd = useCallback((opts: { name: string; cwd: string; scripts: Record<string, string>; port?: number }) => {
    addServer(opts);
  }, [addServer]);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 10, paddingBottom: 10,
        borderBottomWidth: 1,
        borderColor: C.border,
      }}>
        <Text style={{ color: C.accent, fontSize: 18, fontWeight: 'bold', flexGrow: 1 }}>
          {'devctl'}
        </Text>
        <Box
          onClick={() => { console.log('[TEST] button clicked'); }}
          style={{
            backgroundColor: C.red,
            borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5,
            marginRight: 8,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13 }}>{'TEST'}</Text>
        </Box>
        <Box
          onClick={() => setAddModalOpen(true)}
          style={{
            backgroundColor: 'transparent',
            borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5,
            borderWidth: 1, borderColor: C.accent,
          }}
          hoverStyle={{ backgroundColor: C.accent + '22' }}
        >
          <Text style={{ color: C.accent, fontSize: 13 }}>{'+ Add Server'}</Text>
        </Box>
      </Box>

      {/* Body */}
      <Box style={{ flexDirection: 'row', flexGrow: 1 }}>
        {/* Sidebar */}
        <Box style={{
          width: 220,
          borderRightWidth: 1,
          borderColor: C.border,
          padding: 10,
        }}>
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
                />
              ))}
            </ScrollView>
          )}

          <PortList servers={servers} />
        </Box>

        {/* Main content — log viewer */}
        <Box style={{ flexGrow: 1, backgroundColor: C.bgPanel }}>
          <LogViewer name={selectedServer} />
        </Box>
      </Box>

      {/* Add server modal */}
      <AddServerModal
        visible={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAdd}
      />
    </Box>
  );
}
