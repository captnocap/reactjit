/**
 * TerminalStory — PTY terminal sessions
 *
 * Demonstrates all three Terminal archetypes:
 *   user     — interactive bash/zsh, current user
 *   root     — sudo -i bash (shows password prompt if NOPASSWD not set)
 *   template — ephemeral bash -c per command, sandboxed environment
 *
 * Also shows the usePTY hook pattern vs raw <Terminal> one-liner.
 */
import React, { useState, useCallback } from 'react';
import {
  Box, Text, Pressable, ScrollView, TextInput,
  Terminal, usePTY,
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
}: {
  type: 'user' | 'root' | 'template';
  session: string;
  label: string;
}) {
  const c = useThemeColors();
  const [input, setInput] = useState('');

  const {
    output, connected, sendLine, interrupt, sendEOF, runCommand, clearOutput, terminalProps,
  } = usePTY({
    type, shell: 'bash', session, rows: 28, cols: 90,
    env: type === 'template' ? { TEMPLATE_SESSION: session } : undefined,
  });

  const handleSubmit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    type === 'template' ? runCommand(cmd) : sendLine(cmd);
  }, [input, type, sendLine, runCommand]);

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
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={clearOutput}>
          <Text fontSize={11} style={{ color: c.muted }}>clear</Text>
        </Pressable>
      </Box>

      {/* Output */}
      <ScrollView style={{ flexGrow: 1, backgroundColor: c.bg, borderRadius: 4, padding: 8 }}>
        <Text fontSize={12} style={{ color: c.text }}>
          {stripAnsi(output) || (connected ? '' : 'connecting...')}
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
      </Box>

      {/* Content */}
      <Box style={{ flexGrow: 1, padding: 10 }}>
        {tab === 'split' && (
          <Box style={{ flexDirection: 'row', flexGrow: 1, gap: 10 }}>
            <TerminalPane type="user"     session="story-user"  label="User Shell" />
            <TerminalPane type="template" session="story-tmpl"  label="Template" />
          </Box>
        )}
        {tab === 'user'     && <TerminalPane type="user"     session="story-user-solo"  label="User Shell" />}
        {tab === 'root'     && <TerminalPane type="root"     session="story-root-solo"  label="Root Shell" />}
        {tab === 'template' && <TerminalPane type="template" session="story-tmpl-solo"  label="Template Shell" />}
      </Box>
    </Box>
  );
}
