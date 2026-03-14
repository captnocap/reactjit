/**
 * TerminalView — Interactive PTY terminal with session management.
 *
 * Full terminal with Vesper styling. Multiple named sessions.
 * Session tabs at top, terminal fills remaining space.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, Terminal, usePTY } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { V } from '../theme';

// ── Session Tab ──────────────────────────────────────────

interface TermSession {
  id: string;
  name: string;
}

function SessionTab({ session, active, onSelect, onClose }: {
  session: TermSession;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 12,
        paddingRight: 8,
        paddingTop: 5,
        paddingBottom: 5,
        borderRadius: 4,
        backgroundColor: active
          ? V.accentSubtle
          : state.hovered
            ? 'rgba(255, 255, 255, 0.04)'
            : 'transparent',
        borderBottomWidth: active ? 2 : 0,
        borderBottomColor: V.accent,
      })}
    >
      <Text style={{
        fontSize: 12,
        fontWeight: active ? '700' : '400',
        color: active ? V.accent : V.textSecondary,
      }}>
        {session.name}
      </Text>
      <Pressable
        onPress={(e) => { onClose(); }}
        style={(state) => ({
          paddingLeft: 4, paddingRight: 4,
          paddingTop: 1, paddingBottom: 1,
          borderRadius: 2,
          backgroundColor: state.hovered ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
        })}
      >
        <Text style={{ fontSize: 10, color: V.textDim }}>{'\u00D7'}</Text>
      </Pressable>
    </Pressable>
  );
}

// ── Terminal Session ─────────────────────────────────────

function TerminalSession({ session }: { session: TermSession }) {
  const pty = usePTY({
    type: 'user',
    shell: 'bash',
    session: session.id,
  });

  return (
    <Box style={{ flexGrow: 1, width: '100%' }}>
      <Terminal
        {...pty.terminalProps}
        style={{
          flexGrow: 1,
          width: '100%',
        }}
      />
    </Box>
  );
}

// ── TerminalView ─────────────────────────────────────────

export function TerminalView() {
  const c = useThemeColors();
  const [sessions, setSessions] = useState<TermSession[]>([
    { id: 'term-1', name: 'Terminal 1' },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('term-1');

  const addSession = () => {
    const num = sessions.length + 1;
    const id = `term-${Date.now().toString(36)}`;
    setSessions(prev => [...prev, { id, name: `Terminal ${num}` }]);
    setActiveSessionId(id);
  };

  const closeSession = (id: string) => {
    if (sessions.length <= 1) return; // keep at least one
    // rjit-ignore-next-line
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      // rjit-ignore-next-line
      const remaining = sessions.filter(s => s.id !== id);
      if (remaining.length > 0) setActiveSessionId(remaining[0].id);
    }
  };

  // rjit-ignore-next-line
  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <Box style={{
      flexGrow: 1,
      width: '100%',
      flexDirection: 'column',
      backgroundColor: V.bgInset,
    }}>
      {/* Session tabs */}
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 4,
        backgroundColor: V.bgAlt,
        borderBottomWidth: 1,
        borderBottomColor: V.border,
      }}>
        {sessions.map(s => (
          <SessionTab
            key={s.id}
            session={s}
            active={s.id === activeSessionId}
            onSelect={() => setActiveSessionId(s.id)}
            onClose={() => closeSession(s.id)}
          />
        ))}
        <Pressable
          onPress={addSession}
          style={(state) => ({
            paddingLeft: 8, paddingRight: 8,
            paddingTop: 4, paddingBottom: 4,
            borderRadius: 4,
            backgroundColor: state.hovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
          })}
        >
          <Text style={{ fontSize: 14, color: V.textDim }}>+</Text>
        </Pressable>
      </Box>

      {/* Active terminal */}
      {activeSession && (
        <TerminalSession key={activeSession.id} session={activeSession} />
      )}
    </Box>
  );
}
