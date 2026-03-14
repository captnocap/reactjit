import React, { useRef, useState } from 'react';
import { Box, Text, Badge, Slider, Switch, Tabs, BarChart, Pressable, ScrollView, useLoveRPC, useSystemInfo, useWindowDimensions, formatUptime, formatMemory, useLuaInterval, classifiers as S} from '../../../packages/core/src';
import type { Tab } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Scene, Camera, Mesh, AmbientLight, DirectionalLight } from '../../../packages/3d/src';

type ViewMode = '2d' | '3d';
type LoadProfile = 'turbo' | 'balanced' | 'lite';

type BookLevel = {
  price: number;
  size: number;
};

type SymbolBook = {
  symbol: string;
  last: number;
  volume: number;
  bids: BookLevel[];
  asks: BookLevel[];
  history: number[];
};

type PerfStats = {
  fps?: number;
  layoutMs?: number;
  paintMs?: number;
  nodeCount?: number;
};

type EngineRefState = {
  symbols: SymbolBook[];
  carryEvents: number;
  processedTotal: number;
  processedWindow: number;
  windowStartMs: number;
  throughput: number;
  droppedFrames: number;
  frameProcSamples: number[];
  maxFrameMs: number;
};

type Snapshot = {
  throughput: number;
  processedTotal: number;
  droppedFrames: number;
  p50: number;
  p95: number;
  maxFrameMs: number;
};

const VIEW_TABS: Tab[] = [
  { id: '2d', label: '2D Feed' },
  { id: '3d', label: '3D Feed' },
];

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function seeded(i: number, salt: number) {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function percentile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[index];
}

function nextRand(state: { v: number }) {
  let x = state.v | 0;
  if (x === 0) x = 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.v = x | 0;
  return (state.v >>> 0) / 4294967296;
}

function formatCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function makeSymbolBook(index: number, depth: number): SymbolBook {
  const base = 80 + seeded(index, 1) * 120;
  const symbol = `SY${String(index + 1).padStart(3, '0')}`;
  const bids: BookLevel[] = [];
  const asks: BookLevel[] = [];
  for (let i = 0; i < depth; i += 1) {
    const bidDist = 0.04 + i * 0.02 + seeded(index * 10 + i, 2) * 0.02;
    const askDist = 0.04 + i * 0.02 + seeded(index * 10 + i, 3) * 0.02;
    bids.push({
      price: +(base - bidDist).toFixed(2),
      size: Math.floor(20 + seeded(index * 10 + i, 4) * 240),
    });
    asks.push({
      price: +(base + askDist).toFixed(2),
      size: Math.floor(20 + seeded(index * 10 + i, 5) * 240),
    });
  }
  const history: number[] = [];
  let p = base;
  for (let i = 0; i < 64; i += 1) {
    p = Math.max(1, p + (seeded(index * 64 + i, 6) - 0.5) * 0.6);
    history.push(+p.toFixed(2));
  }
  return {
    symbol,
    last: +base.toFixed(2),
    volume: 24000 + Math.floor(seeded(index, 7) * 12000),
    bids,
    asks,
    history,
  };
}

function makeEngine(symbolCount: number, depth: number): EngineRefState {
  const symbols: SymbolBook[] = [];
  for (let i = 0; i < symbolCount; i += 1) {
    symbols.push(makeSymbolBook(i, depth));
  }
  return {
    symbols,
    carryEvents: 0,
    processedTotal: 0,
    processedWindow: 0,
    windowStartMs: nowMs(),
    throughput: 0,
    droppedFrames: 0,
    frameProcSamples: [],
    maxFrameMs: 0,
  };
}

function mutateSymbol(sym: SymbolBook, depth: number, rngState: { v: number }, intensity: number = 1) {
  const scale = Math.sqrt(Math.max(1, intensity));
  const drift = (nextRand(rngState) - 0.5) * 0.42 * scale;
  sym.last = Math.max(1, +(sym.last + drift).toFixed(2));
  sym.volume += (4 + nextRand(rngState) * 110) * intensity;

  const target = nextRand(rngState) > 0.5 ? sym.bids : sym.asks;
  const i = Math.floor(nextRand(rngState) * depth);
  const level = target[i];
  const distance = 0.03 + i * 0.018 + nextRand(rngState) * 0.03;
  if (target === sym.bids) {
    level.price = +(sym.last - distance).toFixed(2);
  } else {
    level.price = +(sym.last + distance).toFixed(2);
  }
  level.size = Math.max(1, Math.floor(level.size + (nextRand(rngState) - 0.47) * 80 * scale));

  const pushChance = Math.min(0.92, 0.3 * scale);
  if (nextRand(rngState) < pushChance) {
    sym.history.push(sym.last);
    if (sym.history.length > 64) sym.history.shift();
  }
}

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 4 }}>
      <S.RowSpaceBetween>
        <S.SecondaryBody>{label}</S.SecondaryBody>
        <S.StoryMuted>
          {value.toFixed(step < 1 ? 1 : 0)}
        </S.StoryMuted>
      </S.RowSpaceBetween>
      <Slider
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        style={{ width: '100%', height: 20 }}
        trackColor="#2d3348"
        activeTrackColor="#7dc4ff"
        thumbColor="#dceeff"
        thumbSize={14}
      />
    </Box>
  );
}

function BookPanel({
  title,
  levels,
  color,
  descending,
}: {
  title: string;
  levels: BookLevel[];
  color: string;
  descending: boolean;
}) {
  const sorted = levels.slice().sort((a, b) => descending ? b.price - a.price : a.price - b.price).slice(0, 10);
  const maxSize = Math.max(1, ...sorted.map((l) => l.size));
  return (
    <Box style={{ flexGrow: 1, gap: 4 }}>
      <Text style={{ color, fontSize: 11, fontWeight: 'normal' }}>{title}</Text>
      {sorted.map((level, i) => (
        <Box key={`${title}-${i}`} style={{ position: 'relative', height: 18, justifyContent: 'center' }}>
          <Box
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${(level.size / maxSize) * 100}%`,
              backgroundColor: color,
              opacity: 0.22,
              borderRadius: 3,
            }}
          />
          <S.RowSpaceBetween style={{ paddingLeft: 6, paddingRight: 6 }}>
            <Text style={{ color: '#c7d8ec', fontSize: 10 }}>{level.price.toFixed(2)}</Text>
            <Text style={{ color: '#96adc8', fontSize: 10 }}>{Math.round(level.size)}</Text>
          </S.RowSpaceBetween>
        </Box>
      ))}
    </Box>
  );
}

function Feed2D({ history }: { history: number[] }) {
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = Math.max(0.0001, max - min);
  const data = history.map((v, i) => ({
    label: i % 8 === 0 ? String(i) : '',
    value: ((v - min) / range) * 100 + 4,
    color: i > 0 && history[i] >= history[i - 1] ? '#22c55e' : '#ef4444',
  }));
  return <BarChart data={data} height={280} gap={2} showLabels={false} interactive={false} />;
}

function Feed3D({ history, spin }: { history: number[]; spin: number }) {
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = Math.max(0.0001, max - min);
  const spacing = 0.18;
  const width = history.length * spacing;
  return (
    <Scene style={{ width: '100%', height: '100%' }} backgroundColor="#040912" stars>
      <Camera position={[0, -6.7, 3.1]} lookAt={[0, 0, 1]} fov={0.9} />
      <AmbientLight color="#1b2438" intensity={0.38} />
      <DirectionalLight direction={[-0.7, 0.8, -0.25]} color="#ffe7d0" intensity={1.2} />

      <Mesh
        geometry="plane"
        color="#102038"
        edgeColor="#2d4c78"
        edgeWidth={0.01}
        position={[0, 0, -0.2]}
        scale={[width * 0.55, 1.8, 1]}
        rotation={[0, 0, spin * 0.04]}
      />

      {history.map((v, i) => {
        const prev = i > 0 ? history[i - 1] : v;
        const x = (i - (history.length - 1) / 2) * spacing;
        const h = ((v - min) / range) * 2.2 + 0.06;
        const up = v >= prev;
        return (
          <Mesh
            key={`hist-3d-${i}`}
            geometry="box"
            color={up ? '#34d399' : '#f87171'}
            edgeColor="#0f172a"
            edgeWidth={0.018}
            position={[x, 0, h / 2]}
            scale={[0.11, 0.1, h]}
            rotation={[0, 0, i * 0.01]}
            specular={24}
          />
        );
      })}
    </Scene>
  );
}

export function TradingPerfLabStory() {
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [loadProfile, setLoadProfile] = useState<LoadProfile>('balanced');
  const [live, setLive] = useState(true);
  const [symbolCount, setSymbolCount] = useState(120);
  const [depth, setDepth] = useState(30);
  const [targetEvents, setTargetEvents] = useState(60000);
  const [simScale, setSimScale] = useState(2);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [spin, setSpin] = useState(0);
  const [uiTick, setUiTick] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    throughput: 0,
    processedTotal: 0,
    droppedFrames: 0,
    p50: 0,
    p95: 0,
    maxFrameMs: 0,
  });
  const [runtimePerf, setRuntimePerf] = useState<PerfStats>({});
  const getPerf = useLoveRPC<PerfStats>('dev:perf');
  const sysInfo = useSystemInfo(4000);
  const { width: viewportWidth } = useWindowDimensions();
  const engineRef = useRef<EngineRefState>(makeEngine(symbolCount, depth));
  const rngRef = useRef<{ v: number }>({ v: (Date.now() ^ 0x9e3779b9) | 0 });
  const effectiveTargetEvents = Math.round(targetEvents * simScale);
  const maxBatchPerTick = Math.max(3500, Math.ceil(effectiveTargetEvents / 50));
  const maxMutationsPerTick = loadProfile === 'turbo' ? 520 : loadProfile === 'balanced' ? 360 : 220;
  const uiIntervalLive2D = loadProfile === 'turbo' ? 60 : loadProfile === 'balanced' ? 72 : 90;
  const uiIntervalLive3D = loadProfile === 'turbo' ? 30 : loadProfile === 'balanced' ? 36 : 45;
  const watchlistLimit = loadProfile === 'turbo' ? 48 : loadProfile === 'balanced' ? 32 : 20;
  const tapeLimit = loadProfile === 'turbo' ? 14 : loadProfile === 'balanced' ? 10 : 8;
  const historyLimit = loadProfile === 'turbo' ? 64 : loadProfile === 'balanced' ? 52 : 40;

  const prevEngineParams = useRef({ symbolCount: 0, depth: 0 });
  if (prevEngineParams.current.symbolCount !== symbolCount || prevEngineParams.current.depth !== depth) {
    prevEngineParams.current = { symbolCount, depth };
    engineRef.current = makeEngine(symbolCount, depth);
    setSelectedIndex((prev) => Math.min(prev, symbolCount - 1));
  }

  const prevTickRef = useRef(nowMs());
  useLuaInterval(live ? 16 : null, () => {
    const engine = engineRef.current;
    const frameStart = nowMs();
    const dtMs = Math.max(1, frameStart - prevTickRef.current);
    prevTickRef.current = frameStart;

    engine.carryEvents += (effectiveTargetEvents * dtMs) / 1000;
    const rawBatch = Math.floor(engine.carryEvents);
    const batch = Math.min(rawBatch, maxBatchPerTick);
    engine.carryEvents -= batch;
    if (rawBatch > batch) {
      engine.carryEvents = Math.min(engine.carryEvents, maxBatchPerTick * 2);
    }

    const mutateOps = Math.min(batch, maxMutationsPerTick);
    if (mutateOps > 0) {
      const intensity = batch / mutateOps;
      for (let i = 0; i < mutateOps; i += 1) {
        const idx = Math.floor(nextRand(rngRef.current) * engine.symbols.length);
        mutateSymbol(engine.symbols[idx], depth, rngRef.current, intensity);
      }
    }

    const procMs = nowMs() - frameStart;
    engine.processedTotal += batch;
    engine.processedWindow += batch;
    engine.frameProcSamples.push(procMs);
    if (engine.frameProcSamples.length > 240) engine.frameProcSamples.shift();
    engine.maxFrameMs = Math.max(engine.maxFrameMs, procMs);
    if (procMs > 16.6) engine.droppedFrames += 1;

    const now = nowMs();
    const elapsed = now - engine.windowStartMs;
    if (elapsed >= 1000) {
      engine.throughput = Math.round((engine.processedWindow * 1000) / elapsed);
      engine.processedWindow = 0;
      engine.windowStartMs = now;
      engine.maxFrameMs = 0;
    }
  });

  const uiIntervalMs = viewMode === '3d' ? (live ? uiIntervalLive3D : 90) : (live ? uiIntervalLive2D : 160);
  useLuaInterval(uiIntervalMs, () => {
    setUiTick((t) => (t + 1) % 1000000);
    if (viewMode === '3d') setSpin((s) => s + 0.02);
  });

  useLuaInterval(live ? 200 : 800, () => {
    const engine = engineRef.current;
    const next = {
      throughput: engine.throughput,
      processedTotal: engine.processedTotal,
      droppedFrames: engine.droppedFrames,
      p50: percentile(engine.frameProcSamples, 0.5),
      p95: percentile(engine.frameProcSamples, 0.95),
      maxFrameMs: engine.maxFrameMs,
    };
    setSnapshot((prev) => {
      if (
        prev.throughput === next.throughput &&
        prev.processedTotal === next.processedTotal &&
        prev.droppedFrames === next.droppedFrames &&
        prev.p50 === next.p50 &&
        prev.p95 === next.p95 &&
        prev.maxFrameMs === next.maxFrameMs
      ) {
        return prev;
      }
      return next;
    });
  });

  useLuaInterval(500, async () => {
    try {
      const next = await getPerf();
      if (next && typeof next === 'object') {
        setRuntimePerf((prev) => {
          if (
            prev.fps === next.fps &&
            prev.layoutMs === next.layoutMs &&
            prev.paintMs === next.paintMs &&
            prev.nodeCount === next.nodeCount
          ) {
            return prev;
          }
          return next;
        });
      }
    } catch (_err) {
      // Optional in non-native paths
    }
  });

  const selected = (() => {
    const symbols = engineRef.current.symbols;
    return symbols[Math.max(0, Math.min(selectedIndex, symbols.length - 1))] || null;
  })();
  const fps = typeof runtimePerf.fps === 'number' ? runtimePerf.fps : 0;
  const layoutMs = typeof runtimePerf.layoutMs === 'number' ? runtimePerf.layoutMs : 0;
  const paintMs = typeof runtimePerf.paintMs === 'number' ? runtimePerf.paintMs : 0;
  const nodeCount = typeof runtimePerf.nodeCount === 'number' ? runtimePerf.nodeCount : 0;
  const totalFrameWork = layoutMs + paintMs;
  const fpsVariant = fps >= 55 ? 'success' : fps >= 40 ? 'warning' : 'error';

  const prevFpsRef = useRef(0);
  if (fps > 0 && prevFpsRef.current !== fps) {
    prevFpsRef.current = fps;
    setLoadProfile((prev) => {
      if (prev === 'turbo') {
        return fps < 44 ? 'balanced' : 'turbo';
      }
      if (prev === 'balanced') {
        if (fps < 30) return 'lite';
        if (fps > 56) return 'turbo';
        return 'balanced';
      }
      return fps > 38 ? 'balanced' : 'lite';
    });
  }

  const selectedPrev = selected && selected.history.length > 1 ? selected.history[selected.history.length - 2] : selected?.last || 0;
  const selectedDelta = selected ? selected.last - selectedPrev : 0;
  const selectedDeltaPct = selectedPrev ? (selectedDelta / selectedPrev) * 100 : 0;
  const selectedUp = selectedDelta >= 0;
  const bestBid = selected ? Math.max(...selected.bids.map((b) => b.price)) : 0;
  const bestAsk = selected ? Math.min(...selected.asks.map((a) => a.price)) : 0;
  const spread = selected && bestAsk >= bestBid ? bestAsk - bestBid : 0;
  const sysCpu = sysInfo.cpu && sysInfo.cpu.length > 48 ? `${sysInfo.cpu.slice(0, 48)}...` : (sysInfo.cpu || '--');
  const sysHost = sysInfo.loading ? 'loading...' : `${sysInfo.user}@${sysInfo.hostname}`;
  const sysOs = sysInfo.loading ? '--' : `${sysInfo.os} (${sysInfo.arch})`;
  const sysMem = sysInfo.loading ? '--' : formatMemory(sysInfo.memory);
  const sysUp = sysInfo.loading ? '--' : formatUptime(sysInfo.uptime);

  const watchlistRows = (() => {
    const symbols = engineRef.current.symbols;
    const maxRows = Math.min(symbols.length, watchlistLimit);
    const rows: Array<{ index: number; symbol: string; last: number; deltaPct: number; volume: number }> = [];
    for (let i = 0; i < maxRows; i += 1) {
      const sym = symbols[i];
      const prev = sym.history.length > 1 ? sym.history[sym.history.length - 2] : sym.last;
      const d = prev ? ((sym.last - prev) / prev) * 100 : 0;
      rows.push({
        index: i,
        symbol: sym.symbol,
        last: sym.last,
        deltaPct: d,
        volume: sym.volume,
      });
    }
    return rows;
  })();

  const tapeRows = (() => {
    if (!selected) return [];
    const start = Math.max(1, selected.history.length - tapeLimit);
    const out: Array<{ id: number; side: 'BUY' | 'SELL'; price: number; size: number }> = [];
    for (let i = start; i < selected.history.length; i += 1) {
      const price = selected.history[i];
      const prev = selected.history[i - 1] || price;
      out.push({
        id: i,
        side: price >= prev ? 'BUY' : 'SELL',
        price,
        size: 20 + ((i * 37) % 180),
      });
    }
    return out.reverse();
  })();

  const visibleHistory = (() => {
    if (!selected) return [];
    if (selected.history.length <= historyLimit) return selected.history;
    return selected.history.slice(selected.history.length - historyLimit);
  })();

  const shellBg = '#050b16';
  const panelBg = '#0b1322';
  const panelBorder = '#1d2c45';
  const compact = viewportWidth > 0 && viewportWidth < 1280;
  const outerPad = 10;
  const frameGap = 8;
  const panelPad = 8;
  const leftPaneBasis = 215;
  const rightPaneBasis = 265;
  const chartMinHeight = compact ? 240 : 300;
  const chartBodyMinHeight = compact ? 210 : 280;
  const tapeHeight = compact ? 156 : 180;
  const controlsMinWidth = compact ? 180 : 240;

  // ── BISECT: uncomment sections one at a time to find the crash ──
  const SHOW_HEADER = true;
  const SHOW_BADGES = false;
  const SHOW_WATCHLIST = false;
  const SHOW_DETAIL_BADGES = false;
  const SHOW_CHART = false;
  const SHOW_CONTROLS = false;
  const SHOW_ORDERBOOK = false;
  const SHOW_TAPE = false;
  const SHOW_HEALTH = false;

  return (
    <Box style={{ width: '100%', height: '100%', padding: outerPad, gap: frameGap, backgroundColor: shellBg }}>
      {/* ── HEADER ── */}
      {SHOW_HEADER && (
        <Box
          style={{
            width: '100%',
            backgroundColor: panelBg,
            borderWidth: 1,
            borderColor: panelBorder,
            borderRadius: 10,
            padding: panelPad,
            gap: compact ? 6 : 8,
          }}
        >
          <S.RowCenterG8 style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
            <Box style={{ gap: 2 }}>
              <Text style={{ fontSize: 17, color: '#e8eef8', fontWeight: 'normal' }}>
                Trading Workstation
              </Text>
              <Text style={{ fontSize: 11, color: '#92a8c4' }}>
                Synthetic venue feed with depth, tape, and renderer telemetry
              </Text>
            </Box>
            <S.RowCenterG8>
              <Box style={{ width: 180 }}>
                <Tabs tabs={VIEW_TABS} activeId={viewMode} onSelect={(id) => setViewMode(id as ViewMode)} variant="pill" />
              </Box>
              <S.RowCenterG6 style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 6, borderWidth: 1, borderColor: '#244266', backgroundColor: '#0a172c' }}>
                <Text style={{ color: '#9eb4cf', fontSize: 10, fontWeight: 'normal' }}>LIVE</Text>
                <Switch value={live} onValueChange={setLive} />
              </S.RowCenterG6>
            </S.RowCenterG8>
          </S.RowCenterG8>

          {SHOW_BADGES && (
            <S.RowG6 style={{ flexWrap: 'wrap', width: '100%' }}>
              <Badge label={selected ? `${selected.symbol} ${selected.last.toFixed(2)}` : 'No symbol'} variant={selected ? (selectedUp ? 'success' : 'error') : 'default'} />
              <Badge label={selected ? `${selectedDelta >= 0 ? '+' : ''}${selectedDelta.toFixed(2)} (${selectedDeltaPct >= 0 ? '+' : ''}${selectedDeltaPct.toFixed(2)}%)` : 'Change --'} variant={selected ? (selectedUp ? 'success' : 'error') : 'default'} />
              <Badge label={selected ? `Spread ${spread.toFixed(2)}` : 'Spread --'} variant="default" />
              <Badge label={`Target ${effectiveTargetEvents.toLocaleString()}/s`} variant="info" />
              <Badge label={`Actual ${snapshot.throughput.toLocaleString()}/s`} variant={snapshot.throughput >= effectiveTargetEvents * 0.8 ? 'success' : 'warning'} />
              <Badge label={`p95 ${snapshot.p95.toFixed(2)}ms`} variant={snapshot.p95 < 8 ? 'success' : snapshot.p95 < 16 ? 'warning' : 'error'} />
              <Badge label={`FPS ${fps || '--'}`} variant={fpsVariant} />
              <Badge label={`Nodes ${nodeCount || '--'}`} variant="default" />
              <Badge label={`x${simScale.toFixed(2).replace(/\.00$/, '')}`} variant="default" />
              <Badge label={`Profile ${loadProfile.toUpperCase()}`} variant={loadProfile === 'turbo' ? 'success' : loadProfile === 'balanced' ? 'warning' : 'default'} />
            </S.RowG6>
          )}
        </Box>
      )}

      <Box style={{ flexDirection: 'row', gap: frameGap, flexGrow: 1, minHeight: 0, minWidth: 0, width: '100%', flexWrap: 'nowrap' }}>
        {/* ── WATCHLIST ── */}
        {SHOW_WATCHLIST && (
          <Box
            style={{
              flexBasis: leftPaneBasis,
              flexGrow: 0.95,
              minWidth: 0,
              backgroundColor: panelBg,
              borderWidth: 1,
              borderColor: panelBorder,
              borderRadius: 10,
              padding: panelPad,
              gap: 6,
            }}
          >
            <Text style={{ color: '#9eb4cf', fontSize: 10, fontWeight: 'normal' }}>WATCHLIST</Text>
            <S.RowSpaceBetween style={{ width: '100%', paddingLeft: 6, paddingRight: 6 }}>
              <Box style={{ width: 54 }}><Text style={{ fontSize: 9, color: '#587394' }}>SYM</Text></Box>
              {/* rjit-ignore-next-line */}
              <Box style={{ width: 68, alignItems: 'flex-end' }}><Text style={{ fontSize: 9, color: '#587394' }}>LAST</Text></Box>
              {/* rjit-ignore-next-line */}
              <Box style={{ width: 66, alignItems: 'flex-end' }}><Text style={{ fontSize: 9, color: '#587394' }}>%</Text></Box>
              {/* rjit-ignore-next-line */}
              <Box style={{ width: 56, alignItems: 'flex-end' }}><Text style={{ fontSize: 9, color: '#587394' }}>VOL</Text></Box>
            </S.RowSpaceBetween>
            <ScrollView style={{ flexGrow: 1, width: '100%' }}>
              <Box style={{ gap: 2, paddingRight: 2 }}>
                {watchlistRows.map((row) => {
                  const active = row.index === selectedIndex;
                  const up = row.deltaPct >= 0;
                  return (
                    <Pressable key={row.symbol} onPress={() => setSelectedIndex(row.index)}>
                      {({ pressed }) => (
                        <Box
                          style={{
                            width: '100%',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            paddingLeft: 6,
                            paddingRight: 6,
                            paddingTop: 4,
                            paddingBottom: 4,
                            borderRadius: 4,
                            borderWidth: active ? 1 : 0,
                            borderColor: '#2e6aa3',
                            backgroundColor: active ? '#12233c' : pressed ? '#0f1d33' : '#0a1628',
                          }}
                        >
                          <Box style={{ width: 54 }}><Text style={{ color: '#d8e4f3', fontSize: 10 }}>{row.symbol}</Text></Box>
                          {/* rjit-ignore-next-line */}
                          <Box style={{ width: 68, alignItems: 'flex-end' }}><Text style={{ color: '#c5d6ea', fontSize: 10 }}>{row.last.toFixed(2)}</Text></Box>
                          {/* rjit-ignore-next-line */}
                          <Box style={{ width: 66, alignItems: 'flex-end' }}><Text style={{ color: up ? '#34d399' : '#f87171', fontSize: 10 }}>{`${up ? '+' : ''}${row.deltaPct.toFixed(2)}%`}</Text></Box>
                          {/* rjit-ignore-next-line */}
                          <Box style={{ width: 56, alignItems: 'flex-end' }}><Text style={{ color: '#7f9bc0', fontSize: 10 }}>{formatCompact(row.volume)}</Text></Box>
                        </Box>
                      )}
                    </Pressable>
                  );
                })}
              </Box>
            </ScrollView>
            <Text style={{ color: '#5f7899', fontSize: 9 }}>
              {`${watchlistRows.length} rendered • ${symbolCount} simulated symbols • ${historyLimit} bars • x${simScale.toFixed(2).replace(/\.00$/, '')}`}
            </Text>
          </Box>
        )}

        <Box style={{ flexGrow: 1.5, minWidth: 0, gap: frameGap, minHeight: 0 }}>
          {/* ── DETAIL BADGES ── */}
          {SHOW_DETAIL_BADGES && (
            <Box
              style={{
                backgroundColor: panelBg,
                borderWidth: 1,
                borderColor: panelBorder,
                borderRadius: 10,
                padding: panelPad,
                gap: compact ? 6 : 8,
              }}
            >
              {selected && (
                <S.RowG6 style={{ flexWrap: 'wrap' }}>
                  <Badge label={selected.symbol} variant="default" />
                  <Badge label={`Last ${selected.last.toFixed(2)}`} variant="info" />
                  <Badge label={`Best Bid ${bestBid.toFixed(2)}`} variant="success" />
                  <Badge label={`Best Ask ${bestAsk.toFixed(2)}`} variant="error" />
                  <Badge label={`Vol ${Math.round(selected.volume).toLocaleString()}`} variant="default" />
                  <Badge label={`Frame max ${snapshot.maxFrameMs.toFixed(2)}ms`} variant="warning" />
                </S.RowG6>
              )}
            </Box>
          )}

          {/* ── CHART ── */}
          {SHOW_CHART && (
            <Box
              style={{
                flexGrow: 1,
                minHeight: chartMinHeight,
                borderWidth: 1,
                borderColor: panelBorder,
                borderRadius: 10,
                backgroundColor: '#071223',
                padding: panelPad,
                gap: compact ? 6 : 8,
              }}
            >
              <Text style={{ color: '#9eb4cf', fontSize: 10, fontWeight: 'normal' }}>PRICE FEED</Text>
              <Box style={{ flexGrow: 1, minHeight: chartBodyMinHeight }}>
                {selected && (viewMode === '2d' ? (
                  <Feed2D history={visibleHistory} />
                ) : (
                  <Feed3D history={visibleHistory} spin={spin} />
                ))}
              </Box>
            </Box>
          )}

          {/* ── CONTROLS ── */}
          {SHOW_CONTROLS && (
            <Box
              style={{
                backgroundColor: panelBg,
                borderWidth: 1,
                borderColor: panelBorder,
                borderRadius: 10,
                padding: panelPad,
                gap: compact ? 6 : 8,
              }}
            >
              <Text style={{ color: '#9eb4cf', fontSize: 10, fontWeight: 'normal' }}>EXECUTION / ENGINE CONTROLS</Text>
              <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: frameGap, width: '100%' }}>
                <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: controlsMinWidth, gap: compact ? 6 : 8 }}>
                  <LabeledSlider label="Symbols" value={symbolCount} min={20} max={320} step={10} onChange={setSymbolCount} />
                  <LabeledSlider label="Book Depth" value={depth} min={10} max={80} step={2} onChange={setDepth} />
                </Box>
                <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: controlsMinWidth, gap: compact ? 6 : 8 }}>
                  <LabeledSlider label="Target Events/sec" value={targetEvents} min={5000} max={400000} step={10000} onChange={setTargetEvents} />
                  <LabeledSlider label="Simulation Scale" value={simScale} min={1} max={2} step={0.25} onChange={setSimScale} />
                  <LabeledSlider label="Focus Symbol" value={selectedIndex} min={0} max={Math.max(0, symbolCount - 1)} step={1} onChange={setSelectedIndex} />
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        <Box style={{ flexBasis: rightPaneBasis, flexGrow: 1.05, minWidth: 0, gap: frameGap, minHeight: 0 }}>
          {/* ── ORDER BOOK ── */}
          {SHOW_ORDERBOOK && (
            <Box
              style={{
                flexGrow: 1,
                minHeight: 260,
                backgroundColor: panelBg,
                borderWidth: 1,
                borderColor: panelBorder,
                borderRadius: 10,
                padding: panelPad,
                gap: compact ? 6 : 8,
              }}
            >
              <S.RowCenter style={{ justifyContent: 'space-between', width: '100%' }}>
                <Text style={{ color: '#9eb4cf', fontSize: 10, fontWeight: 'normal' }}>ORDER BOOK</Text>
                <Text style={{ color: '#6f8daf', fontSize: 10 }}>{`Spread ${spread.toFixed(2)}`}</Text>
              </S.RowCenter>
              {selected && (
                <S.RowG8 style={{ flexGrow: 1 }}>
                  <BookPanel title="Bids" levels={selected.bids} color="#22c55e" descending />
                  <BookPanel title="Asks" levels={selected.asks} color="#ef4444" descending={false} />
                </S.RowG8>
              )}
            </Box>
          )}

          {/* ── TAPE ── */}
          {SHOW_TAPE && (
            <Box
              style={{
                backgroundColor: panelBg,
                borderWidth: 1,
                borderColor: panelBorder,
                borderRadius: 10,
                padding: panelPad,
                gap: 6,
                height: tapeHeight,
              }}
            >
              <Text style={{ color: '#9eb4cf', fontSize: 10, fontWeight: 'normal' }}>TIME & SALES</Text>
              <ScrollView style={{ width: '100%', flexGrow: 1 }}>
                <Box style={{ gap: 3 }}>
                  {tapeRows.map((row) => (
                    <S.RowSpaceBetween key={`tape-${row.id}`} style={{ width: '100%', backgroundColor: '#0a1628', borderRadius: 4, paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3 }}>
                      <Text style={{ fontSize: 10, color: row.side === 'BUY' ? '#34d399' : '#f87171' }}>{row.side}</Text>
                      <Text style={{ fontSize: 10, color: '#c7d8ec' }}>{row.price.toFixed(2)}</Text>
                      <Text style={{ fontSize: 10, color: '#7f9bc0' }}>{row.size}</Text>
                    </S.RowSpaceBetween>
                  ))}
                </Box>
              </ScrollView>
            </Box>
          )}

          {/* ── HEALTH ── */}
          {SHOW_HEALTH && (
            <Box
              style={{
                backgroundColor: panelBg,
                borderWidth: 1,
                borderColor: panelBorder,
                borderRadius: 10,
                padding: panelPad,
                gap: 4,
              }}
            >
              <Text style={{ color: '#9eb4cf', fontSize: 10, fontWeight: 'normal' }}>ENGINE HEALTH</Text>
              <Text style={{ color: '#c7d8ec', fontSize: 10 }}>
                {`fps ${fps || '--'} | layout ${layoutMs.toFixed(1)}ms | paint ${paintMs.toFixed(1)}ms`}
              </Text>
              <Text style={{ color: totalFrameWork <= 8 ? '#34d399' : totalFrameWork <= 16 ? '#facc15' : '#f87171', fontSize: 10 }}>
                {`frame work ${totalFrameWork.toFixed(1)}ms | p50 ${snapshot.p50.toFixed(2)}ms | p95 ${snapshot.p95.toFixed(2)}ms`}
              </Text>
              <Text style={{ color: '#7f9bc0', fontSize: 10 }}>
                {`processed ${snapshot.processedTotal.toLocaleString()} | dropped ${snapshot.droppedFrames} | nodes ${nodeCount || '--'}`}
              </Text>
              <Text style={{ color: '#9eb4cf', fontSize: 10, fontWeight: 'normal', marginTop: 2 }}>TARGET SYSTEM</Text>
              <Text style={{ color: '#c7d8ec', fontSize: 10 }}>{sysHost}</Text>
              <Text style={{ color: '#7f9bc0', fontSize: 10 }}>{sysOs}</Text>
              <Text style={{ color: '#7f9bc0', fontSize: 10 }}>{sysCpu}</Text>
              <Text style={{ color: '#7f9bc0', fontSize: 10 }}>{`${sysMem} | up ${sysUp}`}</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
