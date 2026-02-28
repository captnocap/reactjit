/**
 * StatsStrip — thin stats row between status bar and bento grid.
 *
 * Polls claude:turns every 5s for turn/line data.
 * Token counts come from the parent via props (useTokenUsage already polls).
 *
 * Shows: turns | tok/turn avg | longest turn | session mode
 */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useLoveRPC, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

interface TurnChild {
  lineCount?: number;
  kind?: string;
}

interface TurnData {
  id: number | string;
  children?: TurnChild[];
}

interface TurnsResult {
  turns?: TurnData[];
  turnCount?: number;
}

interface Stats {
  turnCount:   number;
  longestLines: number;
}

const EMPTY_STATS: Stats = { turnCount: 0, longestLines: 0 };

function Divider() {
  return (
    <Text style={{ fontSize: 9, color: C.border, paddingLeft: 6, paddingRight: 6 }}>{'│'}</Text>
  );
}

interface StatProps { label: string; value: string | number }
function Stat({ label, value }: StatProps) {
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 9, color: C.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 9, color: C.textDim, fontWeight: 'bold' }}>{String(value)}</Text>
    </Box>
  );
}

interface Props {
  tokens: number;
}

export function StatsStrip({ tokens }: Props) {
  const rpcTurns = useLoveRPC('claude:turns');
  const rpcRef   = useRef(rpcTurns);
  rpcRef.current = rpcTurns;

  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      try {
        const res = await rpcRef.current({ session: 'default' }) as TurnsResult;
        if (!res?.turns) return;

        const turns = res.turns;
        let longestLines = 0;

        for (const turn of turns) {
          const lines = (turn.children ?? []).reduce(
            (sum, c) => sum + (c.lineCount ?? 0), 0,
          );
          if (lines > longestLines) longestLines = lines;
        }

        setStats({
          turnCount:    res.turnCount ?? turns.length,
          longestLines,
        });
      } catch {
        // RPC not ready — silent
      }
    };

    poll();
    return () => { alive = false; };
  }, []);

  useLuaInterval(5000, async () => {
    let alive = true;
    try {
      const res = await rpcRef.current({ session: 'default' }) as TurnsResult;
      if (!res?.turns) return;

      const turns = res.turns;
      let longestLines = 0;

      for (const turn of turns) {
        const lines = (turn.children ?? []).reduce(
          (sum, c) => sum + (c.lineCount ?? 0), 0,
        );
        if (lines > longestLines) longestLines = lines;
      }

      setStats({
        turnCount:    res.turnCount ?? turns.length,
        longestLines,
      });
    } catch {
      // RPC not ready — silent
    }
  });

  const avgTok = stats.turnCount > 0
    ? Math.round(tokens / stats.turnCount)
    : 0;

  return (
    <Box style={{
      flexDirection:   'row',
      alignItems:      'center',
      paddingLeft:     12,
      paddingRight:    12,
      height:          18,
      backgroundColor: C.bgDeep,
      borderBottomWidth: 1,
      borderColor:     C.border,
      flexShrink:      0,
    }}>
      <Stat label="turns"   value={stats.turnCount} />
      {avgTok > 0 && (
        <>
          <Divider />
          <Stat label="tok/turn" value={avgTok.toLocaleString()} />
        </>
      )}
      {stats.longestLines > 0 && (
        <>
          <Divider />
          <Stat label="longest" value={`${stats.longestLines}L`} />
        </>
      )}
      {tokens > 0 && (
        <>
          <Divider />
          <Stat label="total" value={`${tokens.toLocaleString()} tok`} />
        </>
      )}
    </Box>
  );
}
