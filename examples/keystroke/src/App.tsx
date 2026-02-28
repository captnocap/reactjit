import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useLoveRPC, useLoveEvent } from '@reactjit/core';

const C = {
  bg:      '#0f172a',
  panel:   '#1e293b',
  border:  '#334155',
  text:    '#e2e8f0',
  muted:   '#64748b',
  accent:  '#3b82f6',
  cursor:  '#60a5fa',
};

export function App() {
  const [buffer, setBuffer] = useState('');
  const [resolved, setResolved] = useState<string[]>([]);

  // Initial state from Lua
  const getState = useLoveRPC<{ buffer: string; resolved: string[] }>('keystroke:state');
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    getState().then((s) => {
      if (s) {
        setBuffer(s.buffer);
        setResolved(s.resolved);
      }
    });
  }, []);

  // Live updates pushed from Lua on every keystroke
  useLoveEvent('keystroke', (data: { buffer: string; resolved: string[] }) => {
    setBuffer(data.buffer);
    setResolved(data.resolved);
  });

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, padding: 16, gap: 16 }}>
      {/* Header */}
      <Text style={{ fontSize: 14, color: C.muted, fontWeight: '700' }}>
        {`KEYSTROKE — Lua owns input, React is just a view`}
      </Text>

      {/* Two panels side by side */}
      <Box style={{ flexDirection: 'row', flexGrow: 1, gap: 16, width: '100%' }}>

        {/* Panel 1: live keystroke mirror */}
        <Box style={{
          flexGrow: 1,
          backgroundColor: C.panel,
          borderRadius: 8,
          padding: 16,
          gap: 8,
        }}>
          <Text style={{ fontSize: 11, color: C.muted, fontWeight: '700' }}>
            PANEL 1 — LIVE BUFFER
          </Text>
          <Box style={{
            flexGrow: 1,
            backgroundColor: C.bg,
            borderRadius: 4,
            padding: 12,
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 20, color: C.text }}>
              {buffer.length > 0 ? `${buffer}_` : '_'}
            </Text>
          </Box>
          <Text style={{ fontSize: 10, color: C.muted }}>
            {`${buffer.length} chars — keystrokes arrive here first`}
          </Text>
        </Box>

        {/* Panel 2: resolved output + input visual */}
        <Box style={{
          flexGrow: 1,
          backgroundColor: C.panel,
          borderRadius: 8,
          padding: 16,
          gap: 8,
        }}>
          <Text style={{ fontSize: 11, color: C.muted, fontWeight: '700' }}>
            PANEL 2 — RESOLVED
          </Text>
          <Box style={{
            flexGrow: 1,
            backgroundColor: C.bg,
            borderRadius: 4,
            padding: 12,
            gap: 4,
          }}>
            {resolved.length === 0 ? (
              <Text style={{ fontSize: 14, color: C.muted }}>
                press enter to resolve...
              </Text>
            ) : (
              resolved.map((line, i) => (
                <Text key={i} style={{ fontSize: 14, color: C.text }}>
                  {line}
                </Text>
              ))
            )}
          </Box>

          {/* The "input" — visually here, but Lua owns the actual behavior */}
          <Box style={{
            backgroundColor: C.bg,
            borderRadius: 4,
            padding: 10,
            borderWidth: 1,
            borderColor: buffer.length > 0 ? C.accent : C.border,
          }}>
            <Text style={{ fontSize: 14, color: buffer.length > 0 ? C.text : C.muted }}>
              {buffer.length > 0 ? buffer : 'type anywhere...'}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
