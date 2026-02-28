/**
 * TerminalStory — PTY terminal sessions (vterm-backed)
 *
 * Demonstrates all three Terminal archetypes:
 *   user     — interactive bash/zsh, current user
 *   root     — sudo -i bash (shows password prompt if NOPASSWD not set)
 *   template — ephemeral bash -c per command, sandboxed environment
 *
 * Two display modes:
 *   Raw    — accumulated onData output (ANSI-stripped), backward compat
 *   VTerm  — structured dirty rows from vterm damage callbacks
 */
import React, { useState, useCallback } from 'react';
import {
  Box, Text, Pressable, ScrollView, TextInput,
  Terminal, usePTY,
  type DirtyRow,
} from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';

// ── Strip ANSI for plain-text rendering ──────────────────────────────────────
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
}

// ── Shared TerminalPane component ─────────────────────────────────────────────

function TerminalPane({
  type,
  session,
  label,
  mode,
}: {
  type: 'user' | 'root' | 'template';
  session: string;
  label: string;
  mode: 'raw' | 'vterm';
}) {
  const c = useThemeColors();
  const [input, setInput] = useState('');

  // Accumulate vterm rows into a stable screen buffer
  const [screenRows, setScreenRows] = useState<Map<number, string>>(new Map());

  const {
    output, dirtyRows, cursor, connected,
    sendLine, interrupt, runCommand, clearOutput, terminalProps,
  } = usePTY({
    type, shell: 'bash', session, rows: 28, cols: 90,
    env: type === 'template' ? { TEMPLATE_SESSION: session } : undefined,
  });

  // Merge dirty rows into the screen buffer when they arrive
  const prevDirtyRef = React.useRef<DirtyRow[]>([]);
  if (dirtyRows !== prevDirtyRef.current && dirtyRows.length > 0) {
    prevDirtyRef.current = dirtyRows;
    setScreenRows(prev => {
      const next = new Map(prev);
      for (const r of dirtyRows) {
        if (r.text.length > 0) {
          next.set(r.row, r.text);
        } else {
          next.delete(r.row);
        }
      }
      return next;
    });
  }

  const handleSubmit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    type === 'template' ? runCommand(cmd) : sendLine(cmd);
  }, [input, type, sendLine, runCommand]);

  const handleClear = useCallback(() => {
    clearOutput();
    setScreenRows(new Map());
  }, [clearOutput]);

  // Build vterm screen text from row map
  const vtermText = React.useMemo(() => {
    if (screenRows.size === 0) return '';
    const sorted = Array.from(screenRows.entries()).sort((a, b) => a[0] - b[0]);
    return sorted.map(([, text]) => text).join('\n');
  }, [screenRows]);

  return (
    <Box style={{ flexGrow: 1, backgroundColor: c.bgElevated, borderRadius: 8, padding: 10 }}>

      {/* Non-visual capability node */}
      <Terminal {...terminalProps} />

      {/* Header */}
      <Box style={{ flexDirection: 'row', marginBottom: 8, gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? '#3fb950' : c.muted }} />
        <Text fontSize={13} style={{ color: c.primary }}>{label}</Text>
        <Text fontSize={11} style={{ color: c.muted }}>
          {type === 'template' ? '(ephemeral per cmd)' : `(${type})`}
        </Text>
        {mode === 'vterm' && (
          <Text fontSize={10} style={{ color: c.muted }}>
            {`cursor ${cursor.row}:${cursor.col}`}
          </Text>
        )}
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={handleClear}>
          <Text fontSize={11} style={{ color: c.muted }}>clear</Text>
        </Pressable>
      </Box>

      {/* Output */}
      <ScrollView style={{ flexGrow: 1, backgroundColor: c.bg, borderRadius: 4, padding: 8 }}>
        <Text fontSize={12} style={{ color: c.text }}>
          {mode === 'vterm'
            ? (vtermText || (connected ? '' : 'connecting...'))
            : (stripAnsi(output) || (connected ? '' : 'connecting...'))
          }
        </Text>
      </ScrollView>

      {/* Input */}
      <Box style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
        <Box style={{
          flexGrow: 1, backgroundColor: c.surface, borderRadius: 4,
          paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
        }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmit={handleSubmit}
            placeholder={connected ? 'command...' : 'waiting...'}
            style={{ color: c.text, fontSize: 13 }}
          />
        </Box>
        <Pressable
          onPress={() => interrupt()}
          style={{ backgroundColor: c.surface, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}
        >
          <Text fontSize={11} style={{ color: '#f85149' }}>^C</Text>
        </Pressable>
      </Box>

    </Box>
  );
}

// ── Story ─────────────────────────────────────────────────────────────────────

export function TerminalStory() {
  const c = useThemeColors();
  const [tab, setTab] = useState<'split' | 'user' | 'root' | 'template'>('split');
  const [displayMode, setDisplayMode] = useState<'raw' | 'vterm'>('vterm');

  const tabs = [
    { id: 'split',    label: 'User + Template' },
    { id: 'user',     label: 'User' },
    { id: 'root',     label: 'Root' },
    { id: 'template', label: 'Template' },
  ] as const;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* Tab bar */}
      <Box style={{ flexDirection: 'row', gap: 4, padding: 10, paddingBottom: 0 }}>
        <Text fontSize={14} style={{ color: c.primary, paddingRight: 12, paddingTop: 4 }}>Terminal</Text>
        {tabs.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              backgroundColor: tab === t.id ? c.bgElevated : 'transparent',
              borderRadius: 4,
            }}
          >
            <Text fontSize={12} style={{ color: tab === t.id ? c.text : c.muted }}>{t.label}</Text>
          </Pressable>
        ))}
        <Box style={{ flexGrow: 1 }} />
        {/* Display mode toggle */}
        <Pressable
          onPress={() => setDisplayMode(m => m === 'raw' ? 'vterm' : 'raw')}
          style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
            backgroundColor: c.bgElevated, borderRadius: 4,
          }}
        >
          <Text fontSize={11} style={{ color: displayMode === 'vterm' ? '#3fb950' : c.muted }}>
            {displayMode === 'vterm' ? 'vterm' : 'raw'}
          </Text>
        </Pressable>
      </Box>

      {/* Content */}
      <Box style={{ flexGrow: 1, padding: 10 }}>
        {tab === 'split' && (
          <Box style={{ flexDirection: 'row', flexGrow: 1, gap: 10 }}>
            <TerminalPane type="user"     session="story-user"  label="User Shell"  mode={displayMode} />
            <TerminalPane type="template" session="story-tmpl"  label="Template"    mode={displayMode} />
          </Box>
        )}
        {tab === 'user'     && <TerminalPane type="user"     session="story-user-solo"  label="User Shell"    mode={displayMode} />}
        {tab === 'root'     && <TerminalPane type="root"     session="story-root-solo"  label="Root Shell"    mode={displayMode} />}
        {tab === 'template' && <TerminalPane type="template" session="story-tmpl-solo"  label="Template Shell" mode={displayMode} />}
      </Box>
    </Box>
  );
}
