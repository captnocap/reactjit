/**
 * useTokenUsage — extracts token/cost data from status_bar classified rows.
 *
 * The Claude CLI status bar contains lines like:
 *   "↑ 12,345 tokens  $0.04"  or  "1,234 tokens (~$0.02)"
 * We poll claude:classified, scan for status_bar rows, and parse them.
 */
import { useState, useEffect, useRef } from 'react';
import { useLoveRPC, useLuaInterval } from '@reactjit/core';

export interface TokenUsage {
  tokens: number;
  costUsd: number;
  lastUpdated: number;
  rawLine: string;
}

const EMPTY: TokenUsage = { tokens: 0, costUsd: 0, lastUpdated: 0, rawLine: '' };

// Match patterns like "12,345 tokens" and "$0.04" or "~$0.04"
function parseStatusBar(text: string): Partial<TokenUsage> | null {
  const tokenMatch = text.match(/([\d,]+)\s*tokens?/i);
  const costMatch  = text.match(/~?\$(\d+\.\d+)/);

  if (!tokenMatch && !costMatch) return null;

  const tokens  = tokenMatch  ? parseInt(tokenMatch[1].replace(/,/g, ''), 10) : 0;
  const costUsd = costMatch   ? parseFloat(costMatch[1])                       : 0;
  return { tokens, costUsd, rawLine: text.trim() };
}

export function useTokenUsage() {
  const rpcClassified = useLoveRPC('claude:classified');
  const rpcRef = useRef(rpcClassified);
  rpcRef.current = rpcClassified;

  const [usage, setUsage] = useState<TokenUsage>(EMPTY);

  useEffect(() => {
    let alive = true;
    return () => { alive = false; };
  }, []);

  useLuaInterval(3000, async () => {
    try {
      const res = await rpcRef.current({ session: 'default' }) as any;
      if (!res?.rows) return;

      // Find the most recent status_bar row with parseable data
      const rows: Array<{ kind: string; text: string }> = res.rows;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (row.kind !== 'status_bar') continue;
        const parsed = parseStatusBar(row.text);
        if (parsed && (parsed.tokens || parsed.costUsd)) {
          setUsage(prev => ({
            tokens:      parsed.tokens  ?? prev.tokens,
            costUsd:     parsed.costUsd ?? prev.costUsd,
            lastUpdated: Date.now(),
            rawLine:     parsed.rawLine ?? prev.rawLine,
          }));
          break;
        }
      }
    } catch {
      // silent
    }
  });

  return usage;
}
