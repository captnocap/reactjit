/**
 * Terminal example — tests all three PTY archetypes:
 *
 *   User     — interactive bash, current user, persistent session
 *   Root     — sudo -i bash, escalated (shows password prompt if needed)
 *   Template — fresh bash -c per command, sandboxed, ephemeral
 */
import React, { useState, useCallback } from 'react';
import {
  Box, Text, Pressable, ScrollView, TextInput,
  Terminal, usePTY,
} from '@reactjit/core';

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  bg:      '#0d1117',
  bgPane:  '#161b22',
  bgInput: '#21262d',
  text:    '#e6edf3',
  dim:     '#6e7681',
  green:   '#3fb950',
  red:     '#f85149',
  blue:    '#58a6ff',
  border:  '#30363d',
};

// Strip ANSI escape sequences for plain-text rendering
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
}

// ── TerminalPane ──────────────────────────────────────────────────────────────

function TerminalPane({ type, session, label }: {
  type: 'user' | 'root' | 'template';
  session: string;
  label: string;
}) {
  const [input, setInput] = useState('');

  const {
    output, connected, sendLine, interrupt, sendEOF, runCommand, clearOutput, terminalProps,
  } = usePTY({
    type,
    shell: 'bash',
    session,
    rows: 28,
    cols: 90,
    env: type === 'template' ? { TEMPLATE_SESSION: session } : undefined,
  });

  const handleSubmit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    if (type === 'template') {
      runCommand(cmd);
    } else {
      sendLine(cmd);
    }
  }, [input, type, sendLine, runCommand]);

  return (
    <Box style={{ flexGrow: 1, backgroundColor: C.bgPane, borderRadius: 6, padding: 10 }}>

      {/* Non-visual Terminal capability node — manages PTY lifecycle */}
      <Terminal {...terminalProps} />

      {/* Header */}
      <Box style={{ flexDirection: 'row', width: '100%', height: 24, marginBottom: 8 }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? C.green : C.dim }} />
        <Text style={{ fontSize: 13, color: C.blue, marginLeft: 6 }}>{label}</Text>
        <Text style={{ fontSize: 11, color: C.dim, marginLeft: 6 }}>
          {type === 'template' ? '(ephemeral)' : `(${type})`}
        </Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={clearOutput} style={{ paddingLeft: 8, paddingRight: 8 }}>
          <Text style={{ fontSize: 11, color: C.dim }}>clear</Text>
        </Pressable>
      </Box>

      {/* Output */}
      <ScrollView style={{ flexGrow: 1, backgroundColor: C.bg, borderRadius: 4, padding: 8 }}>
        <Text style={{ fontSize: 12, color: C.text }}>
          {stripAnsi(output) || (connected ? '' : 'connecting...')}
        </Text>
      </ScrollView>

      {/* Input row */}
      <Box style={{ flexDirection: 'row', width: '100%', height: 32, marginTop: 8, gap: 6 }}>
        <Box style={{ flexGrow: 1, backgroundColor: C.bgInput, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmit={handleSubmit}
            placeholder={connected ? 'command...' : 'waiting...'}
            style={{ color: C.text, fontSize: 13 }}
          />
        </Box>
        <Pressable
          onPress={() => interrupt()}
          style={{ width: 32, backgroundColor: '#2d1f1f', borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}
        >
          <Text style={{ fontSize: 11, color: C.red }}>^C</Text>
        </Pressable>
        <Pressable
          onPress={() => sendEOF()}
          style={{ width: 32, backgroundColor: C.bgInput, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}
        >
          <Text style={{ fontSize: 11, color: C.dim }}>^D</Text>
        </Pressable>
      </Box>

      {/* Status */}
      <Text style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
        {connected ? `session: ${session}` : `disconnected — session: ${session}`}
      </Text>

    </Box>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'two-pane',  label: 'User + Template' },
  { id: 'user',      label: 'User Shell' },
  { id: 'root',      label: 'Root Shell' },
  { id: 'template',  label: 'Template' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<TabId>('two-pane');

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg }}>

      {/* Tab bar */}
      <Box style={{ flexDirection: 'row', width: '100%', height: 40, backgroundColor: C.bg, paddingLeft: 12, paddingTop: 8, gap: 4 }}>
        <Text style={{ fontSize: 15, color: C.blue, paddingRight: 16, paddingTop: 4 }}>PTY Terminal</Text>
        {TABS.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
              backgroundColor: tab === t.id ? C.bgPane : 'transparent',
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 12, color: tab === t.id ? C.text : C.dim }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </Box>

      {/* Content area */}
      <Box style={{ flexGrow: 1, padding: 12 }}>

        {tab === 'two-pane' && (
          <Box style={{ flexDirection: 'row', flexGrow: 1, gap: 12, width: '100%' }}>
            <TerminalPane type="user"     session="user-main"  label="User Shell" />
            <TerminalPane type="template" session="tmpl-main"  label="Template" />
          </Box>
        )}

        {tab === 'user' && (
          <Box style={{ flexGrow: 1, width: '100%' }}>
            <TerminalPane type="user"     session="user-solo"  label="User Shell — bash, persistent" />
          </Box>
        )}

        {tab === 'root' && (
          <Box style={{ flexGrow: 1, width: '100%' }}>
            <TerminalPane type="root"     session="root-solo"  label="Root Shell — sudo -i bash" />
          </Box>
        )}

        {tab === 'template' && (
          <Box style={{ flexGrow: 1, width: '100%' }}>
            <TerminalPane type="template" session="tmpl-solo"  label="Template Shell — ephemeral per command" />
          </Box>
        )}

      </Box>
    </Box>
  );
}
