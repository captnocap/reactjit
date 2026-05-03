// chart_stress — animation driver A/B (REACT vs LATCH).
//
// Flat bar grid, N vertical bars in a flexWrap row. Heights animate via
// either:
//
//   REACT mode — setState every tick. Each bar's height prop flows through
//                React reconciliation → JSON-coalesced UPDATE batch → FFI
//                bridge → applyCommand → markSubtreeDirty → layout/paint.
//                This is the path Bloomberg-style live data takes today.
//
//   LATCH mode — __latchSet every tick. Each bar's `style.height` is bound
//                to "latch:bar:N:h" — the host's pre-frame `syncLatches-
//                ToNodes` writes the current latch values into the
//                node.style.height fields, then layout runs. No React,
//                no JSON, no per-op apply. One FFI call per latch write.
//
// Toggles:
//   COUNT — 60 / 200 / 600 / 1000 bars
//   ANIM  — drive animation on/off
//   DRIVER — REACT or LATCH (only meaningful when ANIM is on)
//
// Diagnostics overlay:
//   renders/sec — React renders observed (climbs in REACT mode)
//   ticks/sec   — animation tick frequency
//   FPS / paint — read these from the engine's telemetry overlay
//
// Expected outcome (pending bench):
//   • REACT @ 1000 bars: bottlenecked by reconciliation + bridge
//   • LATCH @ 1000 bars: bottlenecked by FFI calls + layout only
//   • If LATCH significantly outperforms REACT, the latch primitive
//     deserves its own PR and a useHostInterval companion.

import { useEffect, useRef, useState } from 'react';
import { Box, Pressable, Text } from '@reactjit/runtime/primitives';

const TICK_MS = 16;
const COUNTS = [60, 200, 600, 1000];

const COLOR_BG = '#050b16';
const COLOR_INK = '#e8eef8';
const COLOR_DIM = '#92a8c4';
const COLOR_GREEN = '#34d399';
const COLOR_BAR = '#3da9ff';
const COLOR_BAR_HOT = '#ff7a3d';

type Driver = 'react' | 'latch';

// Host fn shim. Set by the V8 binding registered in
// framework/v8_bindings_core.zig (registerCore). When unavailable the
// shim is a no-op so the cart still loads.
function setLatch(key: string, value: number): void {
  const fn = (globalThis as any).__latchSet;
  if (typeof fn === 'function') fn(key, value);
}

const CHART_H = 240;
const BAR_GAP = 1;

function initialHeights(n: number): number[] {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.sin(i * 0.71) * 0.4;
    const b = Math.sin(i * 0.13 + 1.7) * 0.3;
    const c = Math.cos(i * 0.27) * 0.2;
    out[i] = (0.5 + a + b + c) * CHART_H;
  }
  return out;
}

function nextHeight(prev: number, i: number, frame: number): number {
  // Sine carrier + per-bar phase + small random walk for chaos.
  const phase = i * 0.13;
  const carrier = (Math.sin(frame * 0.05 + phase) * 0.4 + 0.5) * CHART_H;
  return Math.max(4, Math.min(CHART_H - 4, carrier));
}

export default function ChartStress() {
  const [count, setCount] = useState(200);
  const [anim, setAnim] = useState(false);
  const [driver, setDriver] = useState<Driver>('react');

  // REACT mode: heights live in React state. LATCH mode: state is
  // initialized once for first paint, then never updated again.
  const [heights, setHeights] = useState<number[]>(() => initialHeights(200));
  useEffect(() => { setHeights(initialHeights(count)); }, [count]);

  const renderCount = useRef(0);
  renderCount.current += 1;

  const tickCount = useRef(0);
  const frameRef = useRef(0);
  const [diag, setDiag] = useState({ rendersPerSec: 0, ticksPerSec: 0 });

  useEffect(() => {
    if (!anim) return;
    const id = setInterval(() => {
      tickCount.current += 1;
      frameRef.current += 1;
      const f = frameRef.current;

      if (driver === 'react') {
        // React-driven: replace the heights array. Reconciler emits an
        // UPDATE op for every bar whose height changed.
        setHeights((prev) => {
          const next = new Array(prev.length);
          for (let i = 0; i < prev.length; i++) {
            next[i] = nextHeight(prev[i], i, f);
          }
          return next;
        });
      } else {
        // Latch-driven: write each bar's height directly to the host
        // store. No setState. No reconciliation. The bound nodes
        // (style.height = "latch:bar:N:h") pick up the new value at
        // the next pre-frame sync in v8_app.zig:syncLatchesToNodes.
        for (let i = 0; i < count; i++) {
          setLatch(`bar:${i}:h`, nextHeight(0, i, f));
        }
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [anim, driver, count]);

  // Diagnostics — sample renders/sec and ticks/sec every 500ms.
  useEffect(() => {
    let lastRenders = renderCount.current;
    let lastTicks = tickCount.current;
    const id = setInterval(() => {
      const r = renderCount.current;
      const t = tickCount.current;
      setDiag({
        rendersPerSec: (r - lastRenders) * 2,
        ticksPerSec: (t - lastTicks) * 2,
      });
      lastRenders = r;
      lastTicks = t;
    }, 500);
    return () => clearInterval(id);
  }, []);

  const barW = Math.max(2, Math.floor((1100 - count * BAR_GAP) / count));

  return (
    <Box style={{
      flexGrow: 1, width: '100%', height: '100%',
      backgroundColor: COLOR_BG,
      paddingTop: 16, paddingLeft: 16, paddingRight: 16,
      flexDirection: 'column', gap: 10,
    }}>
      {/* Header */}
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: COLOR_INK, fontWeight: 'bold' }}>
          Chart-stress · React vs Latch
        </Text>
        <Box style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={{ fontSize: 11, color: COLOR_DIM }}>{`bars ${count}`}</Text>
          <Text style={{ fontSize: 11, color: COLOR_DIM }}>{`renders/s ${diag.rendersPerSec}`}</Text>
          <Text style={{ fontSize: 11, color: anim ? COLOR_GREEN : COLOR_DIM }}>{`ticks/s ${diag.ticksPerSec}`}</Text>
          <Text style={{ fontSize: 11, color: anim ? (driver === 'latch' ? COLOR_GREEN : COLOR_BAR_HOT) : COLOR_DIM }}>
            {anim ? `DRIVER ${driver.toUpperCase()}` : 'IDLE'}
          </Text>
        </Box>
      </Box>

      {/* Toggles */}
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Toggle label={anim ? 'ANIM ON' : 'ANIM OFF'} on={anim} onPress={() => setAnim((v) => !v)} accent="#ff7a3d" />
        <Toggle label="REACT" on={driver === 'react'} onPress={() => setDriver('react')} accent="#ff7a3d" />
        <Toggle label="LATCH" on={driver === 'latch'} onPress={() => setDriver('latch')} accent="#34d399" />
        <Box style={{ width: 12 }} />
        {COUNTS.map((c) => (
          <Toggle key={c} label={String(c)} on={c === count} onPress={() => setCount(c)} accent="#3da9ff" />
        ))}
      </Box>

      {/* Bar grid */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: BAR_GAP,
        height: CHART_H,
        backgroundColor: '#0a0a0d',
        paddingTop: 4, paddingBottom: 4, paddingLeft: 4, paddingRight: 4,
        borderWidth: 1, borderColor: '#1d2c45',
        borderRadius: 6,
      }}>
        {Array.from({ length: count }, (_, i) => (
          <Box
            key={i}
            style={driver === 'latch' && anim
              ? {
                  width: barW,
                  // Stable string token. React never re-renders for value
                  // changes; the host substitutes `latches.get("bar:i:h")`
                  // into node.style.height before layout each frame.
                  height: `latch:bar:${i}:h`,
                  backgroundColor: i % 2 === 0 ? COLOR_BAR : COLOR_BAR_HOT,
                  borderRadius: 1,
                }
              : {
                  width: barW,
                  height: heights[i] ?? 4,
                  backgroundColor: i % 2 === 0 ? COLOR_BAR : COLOR_BAR_HOT,
                  borderRadius: 1,
                }
            }
          />
        ))}
      </Box>
    </Box>
  );
}

function Toggle({ label, on, onPress, accent }: { label: string; on: boolean; onPress: () => void; accent: string }) {
  return (
    <Pressable onPress={onPress}>
      <Box style={{
        paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: on ? accent : '#2a2a2e',
        backgroundColor: on ? '#1a1a1d' : '#121215',
      }}>
        <Text style={{ fontSize: 12, color: on ? accent : '#bdbdc4' }}>
          {label}
        </Text>
      </Box>
    </Pressable>
  );
}
