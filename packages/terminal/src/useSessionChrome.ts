import { useState, useEffect, useRef } from 'react';
import { useLoveRPC } from '@reactjit/core';
import type { SessionChromeState } from './types';

/**
 * useSessionChrome — poll claude:classified for status bar, prompt text, and cursor.
 *
 * Single poller, one RPC, one interval, zero duplication.
 * All display chrome (status left/right, placeholder, prompt text, cursor position)
 * comes from the classified token stream.
 *
 * @example
 * const { statusLeft, statusRight, placeholder, promptText, cursorPosition } = useSessionChrome('default');
 * <Input value={promptText} cursorPosition={cursorPosition} placeholder={placeholder}
 *   keystrokeTarget="ClaudeCanvas" submitTarget="ClaudeCanvas" />
 */
export function useSessionChrome(sessionId = 'default'): SessionChromeState {
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
