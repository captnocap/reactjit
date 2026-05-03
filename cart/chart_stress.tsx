// chart_stress — Bloomberg-style live trading grid for cache-vs-animation
// validation. Modeled on love2d/storybook/src/stories/TradingPerfLabStory.tsx
// but stripped to the parts that exercise paint cost.
//
// Premise: a colored-rect chart was too cheap to expose the difference. A
// real stress has many text glyphs (prices, sizes, deltas, symbols) plus
// bars whose heights flip per tick plus border-color changes (up/down).
// Per panel: symbol header + last + best bid/ask + 5 book levels + 32
// history bars. At N=60 panels that's ~600 text labels + ~2000 bars +
// per-frame mutations on 20 panels.
//
// Toggles:
//   ANIM   — 60Hz mutator firing setValues; emits UPDATE ops to ~hundreds
//            of nodes per tick. The genuine "Bloomberg ticking" load.
//   STATIC — wraps each panel in <StaticSurface staticKey={panel:i}>.
//            Auto-invalidates per the dirty-frame patch when ANIM mutates
//            that panel's data. Panels NOT being mutated this tick stay
//            cached.
//
// Diagnostics overlay: renders/sec, ticks/sec, panel count. So you can
// SEE that the animation is firing (renders climb when ANIM is on).
//
// Expected:
//   • ANIM off, STATIC off → uncached baseline. Stable paint cost.
//   • ANIM off, STATIC on  → first frame captures all panels; thereafter
//                            blits. Should be much cheaper.
//   • ANIM on,  STATIC off → uncached + per-tick re-render. Bigger paint.
//   • ANIM on,  STATIC on  → only the mutated panels recapture per tick;
//                            the rest stay cached. Net cost depends on
//                            mutation frequency vs. cache reuse.

import { useEffect, useRef, useState } from 'react';
import { Box, Pressable, StaticSurface, Text } from '@reactjit/runtime/primitives';

const TICK_MS = 16;
const HISTORY_LEN = 32;
const BOOK_LEVELS = 5;
const PANEL_COUNTS = [20, 60, 120];
const MUTATIONS_PER_TICK = 25;

const COLOR_BG       = '#050b16';
const COLOR_PANEL    = '#0b1322';
const COLOR_BORDER   = '#1d2c45';
const COLOR_BORDER_UP = '#1c4a35';
const COLOR_BORDER_DN = '#4a1d1f';
const COLOR_INK      = '#e8eef8';
const COLOR_DIM      = '#92a8c4';
const COLOR_DIMMER   = '#587394';
const COLOR_GREEN    = '#34d399';
const COLOR_RED      = '#f87171';

type Symbol = {
  symbol: string;
  last: number;
  prev: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  bookBids: { price: number; size: number }[];
  bookAsks: { price: number; size: number }[];
  history: number[];
};

function seedRng(seed: number) {
  let s = seed | 0;
  return function rand() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296);
  };
}

function makeSymbol(i: number): Symbol {
  const r = seedRng(i * 9301 + 49297);
  const base = 50 + r() * 250;
  const bookBids = [];
  const bookAsks = [];
  for (let k = 0; k < BOOK_LEVELS; k++) {
    bookBids.push({ price: +(base - 0.05 - k * 0.04).toFixed(2), size: Math.floor(20 + r() * 200) });
    bookAsks.push({ price: +(base + 0.05 + k * 0.04).toFixed(2), size: Math.floor(20 + r() * 200) });
  }
  const history = [];
  let p = base;
  for (let k = 0; k < HISTORY_LEN; k++) {
    p += (r() - 0.5) * 0.5;
    history.push(+p.toFixed(2));
  }
  return {
    symbol: `SY${String(i + 1).padStart(3, '0')}`,
    last: +base.toFixed(2),
    prev: +base.toFixed(2),
    bid: +(base - 0.05).toFixed(2),
    ask: +(base + 0.05).toFixed(2),
    bidSize: Math.floor(50 + r() * 200),
    askSize: Math.floor(50 + r() * 200),
    bookBids,
    bookAsks,
    history,
  };
}

function makeAll(n: number): Symbol[] {
  const out: Symbol[] = [];
  for (let i = 0; i < n; i++) out.push(makeSymbol(i));
  return out;
}

const tickRng = seedRng(0xdeadbeef);
function mutateOne(s: Symbol): Symbol {
  const drift = (tickRng() - 0.5) * 0.6;
  const next = Math.max(1, +(s.last + drift).toFixed(2));
  const nextHist = s.history.slice(1);
  nextHist.push(next);
  const nextBookBids = s.bookBids.slice();
  const nextBookAsks = s.bookAsks.slice();
  const flipBid = tickRng() < 0.5;
  const li = Math.floor(tickRng() * BOOK_LEVELS);
  if (flipBid) {
    nextBookBids[li] = {
      ...nextBookBids[li],
      size: Math.max(1, Math.floor(nextBookBids[li].size + (tickRng() - 0.5) * 60)),
    };
  } else {
    nextBookAsks[li] = {
      ...nextBookAsks[li],
      size: Math.max(1, Math.floor(nextBookAsks[li].size + (tickRng() - 0.5) * 60)),
    };
  }
  return {
    ...s,
    prev: s.last,
    last: next,
    bid: +(next - 0.05).toFixed(2),
    ask: +(next + 0.05).toFixed(2),
    bidSize: Math.max(1, Math.floor(s.bidSize + (tickRng() - 0.5) * 30)),
    askSize: Math.max(1, Math.floor(s.askSize + (tickRng() - 0.5) * 30)),
    bookBids: nextBookBids,
    bookAsks: nextBookAsks,
    history: nextHist,
  };
}

function HistoryBars({ history }: { history: number[] }) {
  let min = Infinity, max = -Infinity;
  for (const v of history) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(0.0001, max - min);
  return (
    <Box style={{
      flexDirection: 'row', alignItems: 'flex-end',
      gap: 1, height: 24, width: '100%',
    }}>
      {history.map((v, i) => {
        const up = i > 0 ? history[i] >= history[i - 1] : true;
        const h = Math.max(1, ((v - min) / range) * 22 + 2);
        return (
          <Box key={i} style={{
            flexGrow: 1, height: h,
            backgroundColor: up ? COLOR_GREEN : COLOR_RED,
            borderRadius: 1,
          }} />
        );
      })}
    </Box>
  );
}

function PanelInner({ s }: { s: Symbol }) {
  const up = s.last >= s.prev;
  const delta = s.last - s.prev;
  const deltaPct = s.prev ? (delta / s.prev) * 100 : 0;
  return (
    <Box style={{
      flexDirection: 'column', gap: 4,
      paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
      backgroundColor: COLOR_PANEL,
      borderWidth: 1,
      borderColor: up ? COLOR_BORDER_UP : COLOR_BORDER_DN,
      borderRadius: 6,
      width: 200,
    }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: COLOR_INK, fontWeight: 'bold' }}>{s.symbol}</Text>
        <Text style={{ fontSize: 11, color: up ? COLOR_GREEN : COLOR_RED }}>
          {s.last.toFixed(2)}
        </Text>
      </Box>
      <Text style={{ fontSize: 9, color: up ? COLOR_GREEN : COLOR_RED }}>
        {`${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%)`}
      </Text>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 9, color: COLOR_GREEN }}>{`B ${s.bid.toFixed(2)} × ${s.bidSize}`}</Text>
        <Text style={{ fontSize: 9, color: COLOR_RED }}>{`A ${s.ask.toFixed(2)} × ${s.askSize}`}</Text>
      </Box>
      {s.bookBids.map((lvl, i) => (
        <Box key={`bid-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 9, color: COLOR_DIMMER }}>{lvl.price.toFixed(2)}</Text>
          <Text style={{ fontSize: 9, color: COLOR_DIM }}>{lvl.size}</Text>
        </Box>
      ))}
      <HistoryBars history={s.history} />
    </Box>
  );
}

export default function ChartStress() {
  const [count, setCount] = useState(60);
  const [anim, setAnim] = useState(false);
  const [staticOn, setStaticOn] = useState(false);

  const [symbols, setSymbols] = useState<Symbol[]>(() => makeAll(60));
  useEffect(() => { setSymbols(makeAll(count)); }, [count]);

  const renderCount = useRef(0);
  renderCount.current += 1;

  const tickCount = useRef(0);
  const [diagSnapshot, setDiagSnapshot] = useState({ rendersPerSec: 0, ticksPerSec: 0 });

  // 60Hz mutator. Mutates MUTATIONS_PER_TICK random symbols per tick by
  // returning a NEW symbols array with replaced entries. React sees those
  // panels' props change → reconciler emits UPDATE ops for nodes inside →
  // host calls markSubtreeDirty → if STATIC is on, the panel's
  // <StaticSurface> recaptures.
  useEffect(() => {
    if (!anim) return;
    const id = setInterval(() => {
      tickCount.current += 1;
      setSymbols((prev) => {
        const next = prev.slice();
        for (let m = 0; m < MUTATIONS_PER_TICK; m++) {
          const idx = Math.floor(tickRng() * next.length);
          next[idx] = mutateOne(next[idx]);
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [anim]);

  // Diagnostics — sample renders/sec and ticks/sec every 500ms. Watching
  // these climb confirms the test is actually under load.
  useEffect(() => {
    let lastRenders = renderCount.current;
    let lastTicks = tickCount.current;
    const id = setInterval(() => {
      const r = renderCount.current;
      const t = tickCount.current;
      setDiagSnapshot({
        rendersPerSec: (r - lastRenders) * 2,
        ticksPerSec: (t - lastTicks) * 2,
      });
      lastRenders = r;
      lastTicks = t;
    }, 500);
    return () => clearInterval(id);
  }, []);

  return (
    <Box style={{
      flexGrow: 1, width: '100%', height: '100%',
      backgroundColor: COLOR_BG,
      paddingTop: 16, paddingLeft: 16, paddingRight: 16,
      flexDirection: 'column', gap: 10,
    }}>
      {/* Header: title + diagnostics */}
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: COLOR_INK, fontWeight: 'bold' }}>
          Chart-stress · trading grid
        </Text>
        <Box style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={{ fontSize: 11, color: COLOR_DIM }}>
            {`panels ${count}`}
          </Text>
          <Text style={{ fontSize: 11, color: COLOR_DIM }}>
            {`renders/s ${diagSnapshot.rendersPerSec}`}
          </Text>
          <Text style={{ fontSize: 11, color: anim ? COLOR_GREEN : COLOR_DIM }}>
            {`ticks/s ${diagSnapshot.ticksPerSec}`}
          </Text>
          <Text style={{ fontSize: 11, color: staticOn ? COLOR_GREEN : COLOR_DIMMER }}>
            {staticOn ? 'STATIC' : '—'}
          </Text>
        </Box>
      </Box>

      {/* Toggles */}
      <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Toggle label={anim ? 'ANIM ON' : 'ANIM OFF'} on={anim} onPress={() => setAnim((v) => !v)} accent="#ff7a3d" />
        <Toggle label={staticOn ? 'STATIC ON' : 'STATIC OFF'} on={staticOn} onPress={() => setStaticOn((v) => !v)} accent="#34d399" />
        <Box style={{ width: 12 }} />
        {PANEL_COUNTS.map((c) => (
          <Toggle key={c} label={String(c)} on={c === count} onPress={() => setCount(c)} accent="#3da9ff" />
        ))}
      </Box>

      {/* Grid of panels */}
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {symbols.map((s, i) => (
          staticOn ? (
            <StaticSurface
              key={s.symbol}
              staticKey={`panel:${i}`}
              style={{ width: 200 }}
            >
              <PanelInner s={s} />
            </StaticSurface>
          ) : (
            <PanelInner key={s.symbol} s={s} />
          )
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
