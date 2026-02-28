import React, { useRef, useState, useEffect } from 'react';
import { Box, Text, Native, Input, useLoveRPC } from '@reactjit/core';
import { BlankSlateCanvas } from './components/BlankSlateCanvas';
import { PermissionModal } from './components/PermissionModal';
import { QuestionModal } from './components/QuestionModal';
import { useClaude } from './hooks/useClaude';
import { C } from './theme';

/**
 * Single poller for all session chrome: status bar, prompt text, cursor, placeholder.
 * Reads from claude:classified — one RPC, one interval, zero duplication.
 */
function useSessionChrome(sessionId = 'default') {
  const rpc = useLoveRPC('claude:classified');
  const rpcRef = useRef(rpc);
  rpcRef.current = rpc;

  const [statusLeft, setStatusLeft] = useState('');
  const [statusRight, setStatusRight] = useState('');
  const [placeholder, setPlaceholder] = useState('Message Claude...');
  const [promptText, setPromptText] = useState('');
  const [cursorPosition, setCursorPosition] = useState(-1);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!alive) return;
      try {
        const res = await rpcRef.current({ session: sessionId }) as any;
        if (!res) return;

        // Status bar
        const rows = Array.isArray(res.rows) ? res.rows : [];
        const leftParts: string[] = [];
        const rightParts: string[] = [];
        for (const r of rows) {
          if (r.kind !== 'status_bar' || !r.text.trim()) continue;
          const segments = r.text.trim().split(/\s{3,}/).map((s: string) => s.trim()).filter(Boolean);
          if (segments.length >= 2) {
            leftParts.push(segments[0]);
            rightParts.push(segments.slice(1).join('  ·  '));
          } else if (segments.length === 1) {
            if (/\d+\s*tokens|^\$\d/.test(segments[0])) {
              rightParts.push(segments[0]);
            } else {
              leftParts.push(segments[0]);
            }
          }
        }
        setStatusLeft(leftParts.join('  ·  '));
        setStatusRight(rightParts.join('  ·  '));

        // Placeholder
        if (res.placeholder && typeof res.placeholder === 'string') {
          setPlaceholder(res.placeholder);
        }

        // Prompt text (extracted server-side from input_zone rows)
        if (typeof res.promptText === 'string') {
          setPromptText(res.promptText);
        }

        // Cursor position (offset into prompt text, -1 if not on input row)
        if (typeof res.promptCursorCol === 'number') {
          setCursorPosition(res.cursorVisible ? res.promptCursorCol : -1);
        }
      } catch {}
    };
    const interval = setInterval(poll, 100);
    poll();
    return () => { alive = false; clearInterval(interval); };
  }, [sessionId]);

  return { statusLeft, statusRight, placeholder, promptText, cursorPosition };
}

export function App() {
  const claude = useClaude();
  const { statusLeft, statusRight, placeholder, promptText, cursorPosition } = useSessionChrome('default');
  const debugRpc = useLoveRPC('app:debugToggle');
  const debugRef = useRef(debugRpc);
  debugRef.current = debugRpc;
  const [showDebug, setShowDebug] = useState(true);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!alive) return;
      try {
        const res = await debugRef.current({}) as any;
        if (res && typeof res.show === 'boolean') setShowDebug(res.show);
      } catch {}
    };
    const interval = setInterval(poll, 200);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, flexDirection: 'column' }}>
      {/* Kernel */}
      <Native
        type="ClaudeCode"
        workingDir="/home/siah/creative/reactjit/workspace"
        model="sonnet"
        sessionId="default"
        onStatusChange={claude.onStatusChange}
        onPermissionRequest={claude.onPerm}
        onPermissionResolved={claude.onPermResolved}
        onQuestionPrompt={claude.onQuestion}
      />

      {/* Split view — both canvases side by side (F5 toggles left panel) */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        {showDebug && (
          <Native
            type="ClaudeCanvas"
            sessionId="default"
            debugVisible={true}
            style={{ flexGrow: 1, flexBasis: 0 }}
          />
        )}
        {showDebug && <Box style={{ width: 2, backgroundColor: C.border }} />}

        {/* BlankSlate (semantic view) */}
        <Box style={{ flexGrow: 1, flexBasis: 0, flexDirection: 'column' }}>
          <BlankSlateCanvas sessionId="default" />
        </Box>
      </Box>

      {/* Proxy input bar — mirrors PTY, zero local state */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        flexShrink: 0,
        padding: 8,
        gap: 8,
        borderTopWidth: 1,
        borderColor: C.border,
        backgroundColor: C.bg,
      }}>
        <Text style={{ fontSize: 16, color: C.accent, paddingTop: 4 }}>
          {'\u276F'}
        </Text>
        <Input
          autoFocus
          value={promptText}
          keystrokeTarget="ClaudeCanvas"
          submitTarget="ClaudeCanvas"
          escapeTarget="ClaudeCanvas"
          cursorPosition={cursorPosition >= 0 ? cursorPosition : undefined}
          placeholder={placeholder}
          style={{
            flexGrow: 1,
            minHeight: 29,
            maxHeight: 120,
            fontSize: 14,
            color: C.text,
            backgroundColor: C.surface,
            borderRadius: 6,
            borderWidth: 0,
            borderColor: C.border,
          }}
        />
      </Box>

      {/* Status bar */}
      {(statusLeft.length > 0 || statusRight.length > 0) && (
        <Box style={{
          width: '100%',
          flexShrink: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 16,
          overflow: 'hidden',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 2,
          paddingBottom: 2,
          backgroundColor: C.bg,
        }}>
          <Text style={{ fontSize: 11, color: C.muted, opacity: 0.6, flexShrink: 1 }} numberOfLines={1}>
            {statusLeft}
          </Text>
          <Text style={{ fontSize: 11, color: C.muted, opacity: 0.6, flexShrink: 0 }} numberOfLines={1}>
            {statusRight}
          </Text>
        </Box>
      )}
      <Box style={{ flexShrink: 0, height: 4, backgroundColor: C.bg }} />

      {/* Modals */}
      <PermissionModal perm={claude.perm} onRespond={claude.respond} />
      <QuestionModal question={claude.question} onRespond={claude.respondQuestion} />
    </Box>
  );
}
