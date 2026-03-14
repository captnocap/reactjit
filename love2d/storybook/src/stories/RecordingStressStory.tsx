/**
 * Recording Stress Test — measure frame drop impact of video recording.
 *
 * Manual controls: adjust load (animated box count) and recording FPS.
 * Auto-test: scripted sequence that captures baseline vs recording metrics.
 *
 * PERF: useLuaInterval(500) for metrics polling. Animated boxes use
 * a single ref-based tick — no React re-renders for animation.
 */

import React, { useState, useRef } from 'react';
import { Box, Text, Pressable, ScrollView, useLoveRPC, useRecorder, useLuaInterval, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  red: '#f38ba8',
  blue: '#89b4fa',
  purple: '#cba6f7',
  surface: 'rgba(255,255,255,0.05)',
};

// ── Helpers ──────────────────────────────────────────────

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function percentile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
}

// ── Types ────────────────────────────────────────────────

type PerfStats = {
  fps?: number;
  layoutMs?: number;
  paintMs?: number;
  nodeCount?: number;
};

type BenchResult = {
  label: string;
  fps: number;
  layoutMs: number;
  paintMs: number;
  droppedFrames: number;
  capturedFrames: number;
  p95: number;
};

// ── Styles (hoisted) ─────────────────────────────────────

const S = {
  btn: {
    paddingLeft: 14, paddingRight: 14,
    paddingTop: 8, paddingBottom: 8,
    borderRadius: 6,
  } as const,
  btnSmall: {
    paddingLeft: 10, paddingRight: 10,
    paddingTop: 5, paddingBottom: 5,
    borderRadius: 4,
  } as const,
  row: {
    flexDirection: 'row' as const,
    gap: 8,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  } as const,
  statLabel: { fontSize: 10 } as const,
  statValue: { fontSize: 16, fontWeight: '700' as const } as const,
};

// ── Animated Load Boxes ──────────────────────────────────

const BOX_SIZE = 20;

function LoadBoxes({ count, width, height }: { count: number; width: number; height: number }) {
  const c = useThemeColors();
  const positions = useRef<Array<{ x: number; y: number; vx: number; vy: number; hue: number }>>([]);
  const [tick, setTick] = useState(0);

  // Initialize/resize positions array (synchronous ref mutation — safe in render)
  const prevInit = useRef({ count: 0, width: 0, height: 0 });
  if (prevInit.current.count !== count || prevInit.current.width !== width || prevInit.current.height !== height) {
    prevInit.current = { count, width, height };
    const arr = positions.current;
    while (arr.length < count) {
      arr.push({
        x: Math.random() * Math.max(1, width - BOX_SIZE),
        y: Math.random() * Math.max(1, height - BOX_SIZE),
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        hue: Math.random() * 360,
      });
    }
    arr.length = count;
  }

  // Animate at ~60fps via interval
  useLuaInterval(16, () => {
    const arr = positions.current;
    const maxX = Math.max(1, width - BOX_SIZE);
    const maxY = Math.max(1, height - BOX_SIZE);
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      b.x += b.vx;
      b.y += b.vy;
      if (b.x <= 0 || b.x >= maxX) b.vx = -b.vx;
      if (b.y <= 0 || b.y >= maxY) b.vy = -b.vy;
      b.x = Math.max(0, Math.min(maxX, b.x));
      b.y = Math.max(0, Math.min(maxY, b.y));
    }
    setTick(t => t + 1);
  });

  const boxes = (() => {
    const arr = positions.current;
    const result: React.ReactElement[] = [];
    for (let i = 0; i < Math.min(arr.length, count); i++) {
      const b = arr[i];
      const hue = Math.floor(b.hue);
      result.push(
        <Box
          key={i}
          style={{
            position: 'absolute',
            left: Math.round(b.x),
            top: Math.round(b.y),
            width: BOX_SIZE,
            height: BOX_SIZE,
            backgroundColor: `hsl(${hue}, 70%, 60%)`,
            borderRadius: 3,
          }}
        />
      );
    }
    return result;
  })();

  return (
    <S.Bordered style={{ width: '100%', height: 200, backgroundColor: c.bg, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      {boxes}
      <Box style={{ position: 'absolute', right: 4, bottom: 4 }}>
        <S.StoryCap>{`${count} boxes`}</S.StoryCap>
      </Box>
    </S.Bordered>
  );
}

// ── Stat Display ─────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 2, minWidth: 60 }}>
      <Text style={{ ...S.statLabel, color: c.muted }}>{label}</Text>
      <Text style={{ ...S.statValue, color }}>{value}</Text>
    </Box>
  );
}

// ── Results Table ────────────────────────────────────────

function ResultsTable({ results }: { results: BenchResult[] }) {
  const c = useThemeColors();
  if (results.length === 0) return null;

  const headerStyle = { color: c.muted, fontSize: 10, fontWeight: '600' as const, width: 90 };
  const cellStyle = { color: c.text, fontSize: 11, width: 90 };

  return (
    <Box style={{ ...S.card, gap: 4 }}>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 4 }}>Auto-Test Results</Text>
      <S.RowG4>
        <Text style={{ ...headerStyle, width: 140 }}>Phase</Text>
        <Text style={headerStyle}>FPS</Text>
        <Text style={headerStyle}>Layout</Text>
        <Text style={headerStyle}>Paint</Text>
        <Text style={headerStyle}>p95</Text>
        <Text style={headerStyle}>Dropped</Text>
      </S.RowG4>
      {results.map((r, i) => {
        const fpsColor = r.fps >= 55 ? C.green : r.fps >= 30 ? C.yellow : C.red;
        return (
          <S.RowG4 key={i}>
            <Text style={{ ...cellStyle, width: 140 }}>{r.label}</Text>
            <Text style={{ ...cellStyle, color: fpsColor }}>{`${Math.round(r.fps)}`}</Text>
            <Text style={cellStyle}>{`${r.layoutMs.toFixed(1)}ms`}</Text>
            <Text style={cellStyle}>{`${r.paintMs.toFixed(1)}ms`}</Text>
            <Text style={cellStyle}>{`${r.p95.toFixed(1)}ms`}</Text>
            <Text style={cellStyle}>{`${r.droppedFrames}`}</Text>
          </S.RowG4>
        );
      })}
    </Box>
  );
}

// ── Main Story ───────────────────────────────────────────

const LOAD_PRESETS = [0, 10, 50, 100, 500];
const FPS_PRESETS = [15, 24, 30];

export default function RecordingStressStory() {
  const c = useThemeColors();
  const { recording, frames, duration, start, stop } = useRecorder();

  // Controls
  const [loadCount, setLoadCount] = useState(50);
  const [recFps, setRecFps] = useState(30);

  // Live perf metrics
  const getPerf = useLoveRPC<PerfStats>('dev:perf');
  const [perf, setPerf] = useState<PerfStats>({});
  const frameSamples = useRef<number[]>([]);
  const droppedRef = useRef(0);

  // Auto-test state
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoPhase, setAutoPhase] = useState('');
  const [results, setResults] = useState<BenchResult[]>([]);
  const autoRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Poll perf every 500ms
  useLuaInterval(500, async () => {
    const next = await getPerf();
    if (next) {
      setPerf(next);
      if (next.fps) {
        const frameMs = 1000 / next.fps;
        frameSamples.current.push(frameMs);
        if (frameSamples.current.length > 240) frameSamples.current.shift();
        if (frameMs > 16.67) droppedRef.current += 1;
      }
    }
  });

  // Manual controls
  const cycleLoad = () => {
    setLoadCount(cur => {
      const idx = LOAD_PRESETS.indexOf(cur);
      return LOAD_PRESETS[(idx + 1) % LOAD_PRESETS.length];
    });
  };

  const cycleFps = () => {
    setRecFps(cur => {
      const idx = FPS_PRESETS.indexOf(cur);
      return FPS_PRESETS[(idx + 1) % FPS_PRESETS.length];
    });
  };

  const toggleRecord = () => {
    if (recording) { stop(); } else { start({ fps: recFps, format: 'mp4' }); }
  };

  // Auto-test sequence
  const runAutoTest = async () => {
    const ref = { cancelled: false };
    autoRef.current = ref;
    setAutoRunning(true);
    setResults([]);

    const sleep = (ms: number) => new Promise<void>(resolve => {
      const id = setTimeout(resolve, ms);
      // Check cancel periodically
      const check = setInterval(() => {
        if (ref.cancelled) { clearTimeout(id); clearInterval(check); resolve(); }
      }, 200);
    });

    const collectPhase = async (label: string, durationMs: number, rec: boolean, fps: number, load: number): Promise<BenchResult | null> => {
      if (ref.cancelled) return null;
      setAutoPhase(label);
      setLoadCount(load);
      frameSamples.current = [];
      droppedRef.current = 0;
      let capturedFrames = 0;

      if (rec) start({ fps, format: 'mp4' });
      await sleep(durationMs);
      if (rec) {
        const result = await stop();
        capturedFrames = frames;
      }
      if (ref.cancelled) return null;

      return {
        label,
        fps: perf.fps ?? 0,
        layoutMs: perf.layoutMs ?? 0,
        paintMs: perf.paintMs ?? 0,
        droppedFrames: droppedRef.current,
        capturedFrames,
        p95: percentile(frameSamples.current, 0.95),
      };
    };

    const all: BenchResult[] = [];

    // Phase 1: Baseline (no recording, no load)
    const r1 = await collectPhase('Baseline (idle)', 5000, false, 0, 0);
    if (r1) all.push(r1);

    // Phase 2: Recording at 15fps, no load
    const r2 = await collectPhase('Record 15fps (idle)', 5000, true, 15, 0);
    if (r2) all.push(r2);

    // Phase 3: Recording at 30fps, no load
    const r3 = await collectPhase('Record 30fps (idle)', 5000, true, 30, 0);
    if (r3) all.push(r3);

    // Phase 4: Recording at 30fps + 100 boxes
    const r4 = await collectPhase('Record 30fps + 100 boxes', 5000, true, 30, 100);
    if (r4) all.push(r4);

    // Phase 5: Recording at 30fps + 500 boxes
    const r5 = await collectPhase('Record 30fps + 500 boxes', 5000, true, 30, 500);
    if (r5) all.push(r5);

    setResults(all);
    setAutoRunning(false);
    setAutoPhase('');
    setLoadCount(50);
  };

  const cancelAutoTest = () => {
    autoRef.current.cancelled = true;
    setAutoRunning(false);
    setAutoPhase('');
    if (recording) stop();
  };

  // FPS color
  const fpsVal = perf.fps ?? 0;
  const fpsColor = fpsVal >= 55 ? C.green : fpsVal >= 30 ? C.yellow : C.red;

  return (
    <ScrollView style={{ width: '100%', height: '100%' }}>
      <S.CenterW100 style={{ padding: 16, gap: 14 }}>
        <Box style={{ width: '100%', maxWidth: 800, gap: 14 }}>

          {/* Header */}
          <Box style={{ gap: 4 }}>
            <Text style={{ color: C.accent, fontSize: 10, fontWeight: '700' }}>STRESS TEST</Text>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>Recording Performance</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {`Measure frame drop impact of video recording under varying load. Raw RGBA pipe to ffmpeg — no PNG encoding overhead.`}
            </Text>
          </Box>

          {/* Live Metrics */}
          <Box style={S.card}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>Live Metrics</Text>
            <Box style={S.row}>
              <Stat label="FPS" value={`${Math.round(fpsVal)}`} color={fpsColor} />
              <Stat label="Layout" value={`${(perf.layoutMs ?? 0).toFixed(1)}ms`} color={C.blue} />
              <Stat label="Paint" value={`${(perf.paintMs ?? 0).toFixed(1)}ms`} color={C.purple} />
              <Stat label="Nodes" value={`${perf.nodeCount ?? 0}`} color={c.text} />
              <Stat label="p95" value={`${percentile(frameSamples.current, 0.95).toFixed(1)}ms`} color={C.yellow} />
              <Stat label="Dropped" value={`${droppedRef.current}`} color={droppedRef.current > 0 ? C.red : C.green} />
            </Box>
            {recording && (
              <Box style={S.row}>
                <Stat label="Rec Frames" value={`${frames}`} color={C.accent} />
                <Stat label="Duration" value={`${duration.toFixed(1)}s`} color={C.accent} />
              </Box>
            )}
          </Box>

          {/* Load Area */}
          <LoadBoxes count={loadCount} width={760} height={200} />

          {/* Manual Controls */}
          <Box style={S.card}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>Manual Controls</Text>
            <Box style={S.row}>
              <Pressable onPress={cycleLoad} style={{ ...S.btnSmall, backgroundColor: c.surface }}>
                <Text style={{ color: c.text, fontSize: 11 }}>{`Load: ${loadCount}`}</Text>
              </Pressable>
              <Pressable onPress={cycleFps} style={{ ...S.btnSmall, backgroundColor: c.surface }}>
                <Text style={{ color: c.text, fontSize: 11 }}>{`FPS: ${recFps}`}</Text>
              </Pressable>
              <Pressable onPress={toggleRecord} style={{
                ...S.btn,
                backgroundColor: recording ? C.red : C.accent,
              }}>
                <Text style={{ color: '#1e1e2e', fontSize: 12, fontWeight: '700' }}>
                  {recording ? 'Stop Recording' : 'Start Recording'}
                </Text>
              </Pressable>
            </Box>
          </Box>

          {/* Auto-Test */}
          <Box style={S.card}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>Auto-Test</Text>
            <S.DimBody11>
              {`Runs 5 phases (5s each): idle baseline, 15fps rec, 30fps rec, 30fps+100 boxes, 30fps+500 boxes. Captures metrics per phase.`}
            </S.DimBody11>
            <Box style={S.row}>
              {!autoRunning ? (
                <Pressable onPress={runAutoTest} style={{ ...S.btn, backgroundColor: C.green }}>
                  <Text style={{ color: '#1e1e2e', fontSize: 12, fontWeight: '700' }}>Run Auto-Test</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable onPress={cancelAutoTest} style={{ ...S.btn, backgroundColor: C.red }}>
                    <Text style={{ color: '#1e1e2e', fontSize: 12, fontWeight: '700' }}>Cancel</Text>
                  </Pressable>
                  <Text style={{ color: C.yellow, fontSize: 12 }}>{autoPhase}</Text>
                </>
              )}
            </Box>
          </Box>

          {/* Results */}
          <ResultsTable results={results} />

        </Box>
      </S.CenterW100>
    </ScrollView>
  );
}
