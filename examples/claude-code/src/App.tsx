import React, { useRef, useState, useEffect } from 'react';
import { Box, Text, Native, Input, useLoveRPC } from '@reactjit/core';
import { useClaude, useSessionChrome } from '@reactjit/terminal';
import { BlankSlateCanvas } from './components/BlankSlateCanvas';
import { PermissionModal } from './components/PermissionModal';
import { QuestionModal } from './components/QuestionModal';
import { C } from './theme';

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
