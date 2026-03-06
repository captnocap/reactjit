/**
 * IdleScreen — full-panel animated screensaver for Panel A.
 *
 * Appears after THRESHOLD_MS of idle. Cycles through three effects
 * over time so it never gets stale. Dismissed by any status change or
 * a click (but returns after another THRESHOLD_MS if still idle).
 *
 * Effects (rotate every 90s):
 *   0 — Automata   (Conway's Game of Life, cellular automata)
 *   1 — Pipes      (classic Windows screensaver)
 *   2 — Mycelium   (growing network, organic)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Pressable, Automata, Pipes, Mycelium, Scanlines, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

const THRESHOLD_MS  = 30_000;
const EFFECT_CYCLE  = 90_000; // rotate effect every 90s
const EFFECTS       = ['automata', 'pipes', 'mycelium'] as const;
type EffectKey      = typeof EFFECTS[number];

function EffectLayer({ effect }: { effect: EffectKey }) {
  const common = { style: { flexGrow: 1 as const }, speed: 0.7 };
  if (effect === 'automata') return <Automata {...common} />;
  if (effect === 'pipes')    return <Pipes    {...common} speed={0.5} />;
  return                            <Mycelium {...common} speed={0.4} decay={0.015} />;
}

function formatIdle(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

interface Props {
  status: string;
}

export function IdleScreen({ status }: Props) {
  const [visible,    setVisible]    = useState(false);
  const [effectIdx,  setEffectIdx]  = useState(0);
  const [idleMs,     setIdleMs]     = useState(0);

  const isIdle       = status === 'idle' || status === 'stopped';
  const idleStartRef = useRef<number | null>(null);

  // Arm / disarm the appear timer
  useEffect(() => {
    if (!isIdle) {
      setVisible(false);
      idleStartRef.current = null;
      setIdleMs(0);
      return;
    }

    idleStartRef.current = Date.now();
    const timer = setTimeout(() => setVisible(true), THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, [isIdle]);

  // Idle duration ticker (only while idle)
  // Staggered: uptime=1000, ralph=1100, idle=1200, fortune=1300
  useLuaInterval(isIdle ? 1200 : null, () => {
    if (idleStartRef.current) {
      setIdleMs(Date.now() - idleStartRef.current);
    }
  });

  // Cycle through effects while screensaver is running
  useLuaInterval(visible ? EFFECT_CYCLE : null, () => {
    setEffectIdx(i => (i + 1) % EFFECTS.length);
  });

  const rearmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (rearmRef.current) clearTimeout(rearmRef.current);
    if (idleStartRef.current !== null) {
      idleStartRef.current = Date.now();
      rearmRef.current = setTimeout(() => setVisible(true), THRESHOLD_MS);
    }
  }, []);

  if (!visible) return null;

  const effect = EFFECTS[effectIdx];
  const label  = effect === 'automata' ? 'GAME OF LIFE'
               : effect === 'pipes'    ? 'PIPES'
               :                        'MYCELIUM';

  return (
    <Box style={{
      position:        'absolute',
      top:             0,
      left:            0,
      right:           0,
      bottom:          0,
      flexDirection:   'column',
      backgroundColor: C.bgDeep,
    }}>
      <Pressable onPress={dismiss} style={{ flexGrow: 1, flexDirection: 'column' }}>

        {/* Animated effect fills the space */}
        <EffectLayer effect={effect} />

        {/* CRT scanlines overlay for that screensaver feel */}
        <Scanlines mask intensity={0.06} spacing={3} />

        {/* Bottom bar */}
        <Box style={{
          position:        'absolute',
          bottom:          0,
          left:            0,
          right:           0,
          flexDirection:   'row',
          alignItems:      'center',
          justifyContent:  'space-between',
          paddingLeft:     14,
          paddingRight:    14,
          paddingTop:      8,
          paddingBottom:   8,
          backgroundColor: '#00000066',
        }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 9, color: C.accent }}>{'◈'}</Text>
            <Text style={{ fontSize: 9, color: C.textDim, fontWeight: 'bold' }}>{'VESPER'}</Text>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{'·'}</Text>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{'IDLE'}</Text>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{formatIdle(idleMs)}</Text>
          </Box>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{label}</Text>
            <Text style={{ fontSize: 8, color: C.border }}>{'click to dismiss'}</Text>
          </Box>
        </Box>

      </Pressable>
    </Box>
  );
}
