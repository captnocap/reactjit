import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, Tabs, Switch, Badge, BarChart, useLuaInterval } from '../../../packages/core/src';
import type { Tab } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Scene, Camera, Mesh, AmbientLight, DirectionalLight } from '../../../packages/3d/src';

type ViewMode = '2d' | '3d';
type Timeframe = '5m' | '1h' | '1d';

type Candle = {
  id: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const VIEW_TABS: Tab[] = [
  { id: '2d', label: '2D Bars' },
  { id: '3d', label: '3D Bars' },
];

const TIMEFRAME_TABS: Tab[] = [
  { id: '5m', label: '5m' },
  { id: '1h', label: '1h' },
  { id: '1d', label: '1d' },
];

const TIMEFRAME_CONFIG: Record<Timeframe, { count: number; volatility: number }> = {
  '5m': { count: 52, volatility: 1.9 },
  '1h': { count: 42, volatility: 1.2 },
  '1d': { count: 32, volatility: 2.6 },
};

function seeded(i: number, salt: number) {
  const n = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function makeCandles(tf: Timeframe): Candle[] {
  const config = TIMEFRAME_CONFIG[tf];
  const out: Candle[] = [];
  let price = 100;

  for (let i = 0; i < config.count; i += 1) {
    const open = price;
    const drift = (seeded(i, 1) - 0.5) * config.volatility * 1.6;
    const close = Math.max(10, +(open + drift).toFixed(2));
    const high = +(Math.max(open, close) + seeded(i, 2) * config.volatility).toFixed(2);
    const low = +(Math.min(open, close) - seeded(i, 3) * config.volatility).toFixed(2);
    const volume = 180 + Math.floor(seeded(i, 4) * 920);

    out.push({
      id: i + 1,
      label: `${i + 1}`,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }

  return out;
}

function TradingBars2D({
  candles,
  minPrice,
  maxPrice,
}: {
  candles: Candle[];
  minPrice: number;
  maxPrice: number;
}) {
  const range = Math.max(0.0001, maxPrice - minPrice);
  const maxVolume = Math.max(1, ...candles.map((c) => c.volume));

  const priceBars = candles.map((c, i) => ({
    label: i % 8 === 0 ? c.label : '',
    value: ((c.close - minPrice) / range) * 100 + 4,
    color: c.close >= c.open ? '#22c55e' : '#ef4444',
  }));

  const volumeBars = candles.map((c, i) => ({
    label: i % 8 === 0 ? c.label : '',
    value: (c.volume / maxVolume) * 100 + 2,
    color: c.close >= c.open ? '#60a5fa' : '#475569',
  }));

  return (
    <Box style={{ width: '100%', height: '100%', gap: 10 }}>
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#9fb3cc', fontSize: 11, fontWeight: 'bold' }}>
          Price Bars
        </Text>
        <BarChart data={priceBars} height={220} showLabels={false} gap={2} interactive />
      </Box>

      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#9fb3cc', fontSize: 11, fontWeight: 'bold' }}>
          Volume
        </Text>
        <BarChart data={volumeBars} height={80} showLabels={false} gap={2} />
      </Box>

      <Text style={{ color: '#6f85a0', fontSize: 10 }}>
        {`Range ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`}
      </Text>
    </Box>
  );
}

function TradingBars3D({
  candles,
  minPrice,
  maxPrice,
  spin,
}: {
  candles: Candle[];
  minPrice: number;
  maxPrice: number;
  spin: number;
}) {
  const range = Math.max(0.0001, maxPrice - minPrice);
  const spacing = 0.34;
  const totalWidth = candles.length * spacing;
  const scaleZ = 3.5;

  return (
    <Scene style={{ width: '100%', height: '100%' }} backgroundColor="#040912" stars>
      <Camera position={[0, -9.5, 4.9]} lookAt={[0, 0, 1.25]} fov={0.9} />
      <AmbientLight color="#1c2a44" intensity={0.38} />
      <DirectionalLight direction={[-0.65, 0.8, -0.3]} color="#ffe8d2" intensity={1.15} />

      <Mesh
        geometry="plane"
        color="#0e1e33"
        edgeColor="#2b4b76"
        edgeWidth={0.01}
        position={[0, 0, -0.2]}
        scale={[totalWidth * 0.52, 2.8, 1]}
        rotation={[0, 0, spin * 0.05]}
      />

      {candles.map((c, i) => {
        const isUp = c.close >= c.open;
        const x = (i - (candles.length - 1) / 2) * spacing;

        const high = ((c.high - minPrice) / range) * scaleZ;
        const low = ((c.low - minPrice) / range) * scaleZ;
        const open = ((c.open - minPrice) / range) * scaleZ;
        const close = ((c.close - minPrice) / range) * scaleZ;

        const wickHeight = Math.max(0.05, high - low);
        const wickCenter = low + wickHeight / 2;
        const bodyHeight = Math.max(0.08, Math.abs(close - open));
        const bodyCenter = Math.min(open, close) + bodyHeight / 2;

        return (
          <React.Fragment key={`candle-${c.id}`}>
            <Mesh
              geometry="box"
              color={isUp ? '#86efac' : '#fca5a5'}
              position={[x, 0, wickCenter]}
              scale={[0.032, 0.05, wickHeight]}
              specular={10}
            />
            <Mesh
              geometry="box"
              color={isUp ? '#22c55e' : '#ef4444'}
              edgeColor="#0f172a"
              edgeWidth={0.02}
              position={[x, 0, bodyCenter]}
              scale={[0.2, 0.18, bodyHeight]}
              specular={28}
            />
          </React.Fragment>
        );
      })}
    </Scene>
  );
}

export function TradingViewBarsStory() {
  const c = useThemeColors();
  const [viewMode, setViewMode] = useState<ViewMode>('2d');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [live, setLive] = useState(true);
  const [spin, setSpin] = useState(0);
  const [candles, setCandles] = useState<Candle[]>(() => makeCandles('1h'));

  useEffect(() => {
    setCandles(makeCandles(timeframe));
  }, [timeframe]);

  useLuaInterval(live ? 750 : null, () => {
    const cfg = TIMEFRAME_CONFIG[timeframe];
    setSpin((s) => s + 0.02);

    setCandles((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      const last = { ...next[next.length - 1] };

      const intraDrift = (Math.random() - 0.5) * cfg.volatility * 0.7;
      last.close = Math.max(10, +(last.close + intraDrift).toFixed(2));
      last.high = Math.max(last.high, +(last.close + Math.random() * cfg.volatility * 0.4).toFixed(2));
      last.low = Math.min(last.low, +(last.close - Math.random() * cfg.volatility * 0.4).toFixed(2));
      last.volume = Math.max(90, Math.floor(last.volume + (Math.random() - 0.45) * 160));
      next[next.length - 1] = last;

      if (Math.random() > 0.58) {
        const open = last.close;
        const drift = (Math.random() - 0.5) * cfg.volatility * 1.6;
        const close = Math.max(10, +(open + drift).toFixed(2));
        const high = +(Math.max(open, close) + Math.random() * cfg.volatility * 0.9).toFixed(2);
        const low = +(Math.min(open, close) - Math.random() * cfg.volatility * 0.9).toFixed(2);
        const volume = Math.floor(220 + Math.random() * 920);
        const nextId = (next[next.length - 1]?.id || 0) + 1;

        next.push({
          id: nextId,
          label: `${nextId}`,
          open,
          high,
          low,
          close,
          volume,
        });
        if (next.length > cfg.count) next.shift();
      }

      return next;
    });
  });

  const { minPrice, maxPrice, last, prev } = useMemo(() => {
    const min = Math.min(...candles.map((c) => c.low));
    const max = Math.max(...candles.map((c) => c.high));
    const padding = (max - min) * 0.1;
    const current = candles[candles.length - 1];
    const previous = candles[candles.length - 2] || current;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      last: current,
      prev: previous,
    };
  }, [candles]);

  const delta = last.close - prev.close;
  const deltaPct = prev.close ? (delta / prev.close) * 100 : 0;
  const isUp = delta >= 0;

  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, color: c.text, fontWeight: 'bold' }}>
        TradingView Hybrid
      </Text>
      <Text style={{ fontSize: 12, color: c.textDim }}>
        Toggle between 2D and g3d 3D trading bars using the same live candle stream
      </Text>

      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Box style={{ width: 190 }}>
          <Tabs tabs={VIEW_TABS} activeId={viewMode} onSelect={(id) => setViewMode(id as ViewMode)} variant="pill" />
        </Box>
        <Box style={{ width: 210 }}>
          <Tabs tabs={TIMEFRAME_TABS} activeId={timeframe} onSelect={(id) => setTimeframe(id as Timeframe)} variant="pill" />
        </Box>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>Live</Text>
          <Switch value={live} onValueChange={setLive} />
        </Box>
        <Badge label={`$${last.close.toFixed(2)}`} variant={isUp ? 'success' : 'error'} />
        <Badge
          label={`${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%)`}
          variant={isUp ? 'success' : 'error'}
        />
      </Box>

      <Box
        style={{
          flexGrow: 1,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 10,
          backgroundColor: '#0a1020',
          padding: 12,
          gap: 8,
          minHeight: 360,
        }}
      >
        <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Badge label={`Open ${last.open.toFixed(2)}`} variant="default" />
          <Badge label={`High ${last.high.toFixed(2)}`} variant="info" />
          <Badge label={`Low ${last.low.toFixed(2)}`} variant="warning" />
          <Badge label={`Volume ${last.volume}`} variant="default" />
        </Box>

        <Box style={{ flexGrow: 1, minHeight: 300 }}>
          {viewMode === '2d' ? (
            <TradingBars2D candles={candles} minPrice={minPrice} maxPrice={maxPrice} />
          ) : (
            <TradingBars3D candles={candles} minPrice={minPrice} maxPrice={maxPrice} spin={spin} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
