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

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Effect, Pressable, StaticSurface, Text } from '@reactjit/runtime/primitives';

const TICK_MS = 16;
const COUNTS = [500, 1000, 2000, 4000];
const CHUNK_SIZE = 400; // bars per flex-row; keeps each layout call under MAX_CHILDREN

const COLOR_BG = '#050b16';
const COLOR_INK = '#e8eef8';
const COLOR_DIM = '#92a8c4';
const COLOR_GREEN = '#34d399';
const COLOR_BAR = '#3da9ff';
const COLOR_BAR_HOT = '#ff7a3d';

type Driver = 'react' | 'latch' | 'host' | 'sslatch' | 'shader';

// Host fn shim. Set by the V8 binding registered in
// framework/v8_bindings_core.zig (registerCore). When unavailable the
// shim is a no-op so the cart still loads.
function setLatch(key: string, value: number): void {
  const fn = (globalThis as any).__latchSet;
  if (typeof fn === 'function') fn(key, value);
}

const CHART_H = 240;
const ROW_H = 60;
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
  const carrier = (Math.sin(frame * 0.05 + phase) * 0.4 + 0.5) * ROW_H;
  return Math.max(4, Math.min(ROW_H - 2, carrier));
}

function chunkedIndices(count: number, chunkSize: number): number[][] {
  const out: number[][] = [];
  for (let start = 0; start < count; start += chunkSize) {
    const row: number[] = [];
    for (let i = start; i < Math.min(count, start + chunkSize); i++) row.push(i);
    out.push(row);
  }
  return out;
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
    // HOST mode: zero per-frame JS work. The animations are
    // registered in a separate effect below and ticked entirely
    // inside framework/animations.zig from the painter loop.
    if (!anim || driver === 'host') return;
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

  // HOST mode: register N animations once, the painter loop ticks
  // them in compiled Zig. JS does ZERO work per frame for the
  // animation; this effect runs only on toggle/count change.
  //
  // Visual fidelity to REACT/LATCH path:
  //   The JS path uses `(sin(frame * 0.05 + i * 0.13) * 0.4 + 0.5) * ROW_H`.
  //   That's a sine wave with per-bar phase offset of `i * 0.13` radians.
  //   We map to host-driven by:
  //     - curve='sine' (added to easing.zig — full 0→1→0 cycle over t=[0,1])
  //     - loop='cycle' (sawtooth: t goes 0→1, jumps to 0)
  //     - PERIOD_MS = 2π / 0.05 (radian) × 16ms (per setInterval tick)
  //       ≈ 2010ms per full cycle, matching the JS frame-driven version
  //     - per-bar startOffsetMs = phase01 * PERIOD_MS, where
  //       phase01 = (i * 0.13 / 2π) mod 1
  //   The from/to range mirrors the JS clamp: min height 4, max ROW_H-2.
  useEffect(() => {
    if (!anim || driver !== 'host') return;
    const host = (globalThis as any);
    if (typeof host.__anim_register !== 'function') return;
    const ids: number[] = [];
    const PERIOD_MS = (2 * Math.PI / 0.05) * TICK_MS;
    const TWO_PI = 2 * Math.PI;
    for (let i = 0; i < count; i++) {
      const phase = i * 0.13;
      const phase01 = ((phase % TWO_PI) + TWO_PI) % TWO_PI / TWO_PI;
      const startOffsetMs = phase01 * PERIOD_MS;
      const id = host.__anim_register(
        `bar:${i}:h`,
        'sine',
        'cycle',
        4,
        ROW_H - 2,
        PERIOD_MS,
        startOffsetMs,
      );
      if (typeof id === 'number' && id > 0) ids.push(id);
    }
    return () => {
      if (typeof host.__anim_unregister === 'function') {
        for (const id of ids) host.__anim_unregister(id);
      }
    };
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

  const chunks = chunkedIndices(count, CHUNK_SIZE);
  const rowBarCount = Math.min(count, CHUNK_SIZE);
  const barW = Math.max(2, Math.floor((1100 - rowBarCount * BAR_GAP) / rowBarCount));

  // SHADER mode: WGSL fragment shader that draws all `count` bars in
  // one Effect. Per-fragment math runs natively on the GPU. The
  // angular-velocity constant 3.125 = 0.05 rad/JS-frame × (1000/16ms)
  // frames-per-sec, so the shader's animation cadence matches the
  // JS-driven REACT/LATCH path's `sin(frame * 0.05 + phase)` math.
  // Multi-row layout is computed inside the shader from uv.y.
  const shaderWgsl = useMemo(() => {
    const numRows = chunks.length;
    const chunkSize = CHUNK_SIZE;
    return `
@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let count = ${count}.0;
  let num_rows = ${numRows}.0;
  let chunk_size = ${chunkSize}.0;
  let row_f = floor(in.uv.y * num_rows);
  let row_y = (in.uv.y * num_rows) - row_f;
  let col = floor(in.uv.x * chunk_size);
  let bar_idx = row_f * chunk_size + col;
  if (bar_idx >= count) { return vec4f(0.0, 0.0, 0.0, 0.0); }
  let phase = bar_idx * 0.13;
  let h_ratio = sin(U.time * 3.125 + phase) * 0.4 + 0.5;
  let bar_top = 1.0 - h_ratio;
  if (row_y < bar_top) { return vec4f(0.0, 0.0, 0.0, 0.0); }
  let parity = i32(bar_idx) - (i32(bar_idx) / 2) * 2;
  if (parity == 1) { return vec4f(1.0, 0.48, 0.24, 1.0); }
  return vec4f(0.24, 0.66, 1.0, 1.0);
}
`;
  }, [count, chunks.length]);

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
        <Toggle label="HOST" on={driver === 'host'} onPress={() => setDriver('host')} accent="#3da9ff" />
        <Toggle label="SS+LATCH" on={driver === 'sslatch'} onPress={() => setDriver('sslatch')} accent="#a855f7" />
        <Toggle label="SHADER" on={driver === 'shader'} onPress={() => setDriver('shader')} accent="#facc15" />
        <Box style={{ width: 12 }} />
        {COUNTS.map((c) => (
          <Toggle key={c} label={String(c)} on={c === count} onPress={() => setCount(c)} accent="#3da9ff" />
        ))}
      </Box>

      {driver === 'shader' ? (
        // SHADER mode: ONE Effect node renders all N bars via a WGSL
        // fragment shader. Per-fragment work runs natively on the GPU
        // (sin computed in parallel for every pixel). CPU/JS does
        // nothing per frame except letting the painter set u.time.
        // Total node count: 2 (this Box + the Effect). At 4000 bars
        // this is 4000× fewer nodes than the other modes.
        <Box style={{
          width: '100%',
          backgroundColor: '#0a0a0d',
          paddingTop: 4, paddingBottom: 4, paddingLeft: 4, paddingRight: 4,
          borderWidth: 1, borderColor: '#1d2c45',
          borderRadius: 6,
          height: chunks.length * ROW_H + (chunks.length - 1) * 2 + 8,
        }}>
          <Effect shader={shaderWgsl} style={{ flexGrow: 1 }} />
        </Box>
      ) : (
        // Bar grid — chunked into row-of-CHUNK_SIZE Boxes so the per-flex
        // MAX_CHILDREN cap doesn't truncate at higher counts. Total nodes
        // are unaffected; each row layout-call sees ≤CHUNK_SIZE children.
        <Box style={{
          flexDirection: 'column',
          gap: 2,
          backgroundColor: '#0a0a0d',
          paddingTop: 4, paddingBottom: 4, paddingLeft: 4, paddingRight: 4,
          borderWidth: 1, borderColor: '#1d2c45',
          borderRadius: 6,
        }}>
          {chunks.map((row, rowIdx) => (
            <Box key={rowIdx} style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: BAR_GAP,
              height: ROW_H,
            }}>
              {row.map((i) => {
                const useLatchHeight = (driver === 'latch' || driver === 'host' || driver === 'sslatch') && anim;
                return (
                  <Box
                    key={i}
                    style={useLatchHeight
                      ? {
                          width: barW,
                          // Stable string token — React never re-renders
                          // for value changes. Host substitutes
                          // latches.get into node.style.height each
                          // pre-frame sync. LATCH + SS+LATCH modes write
                          // latches from JS RAF; HOST mode writes them
                          // from the painter loop in Zig
                          // (animations.tickAll).
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
                );
              })}
            </Box>
          ))}
        </Box>
      )}
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
