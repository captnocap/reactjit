// =============================================================================
// NoisePanel — real noise studio surface
// =============================================================================
// Drives the NoiseField with a full control set. Every knob persists via
// __store_* under sweatshop.noise.* so reopening the panel restores the last
// field the user was looking at. No demo data, no mock noise — all numbers
// come from the seeded algorithms in lib/noise/.
// =============================================================================

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { NoiseField, type NoiseAlgo } from './NoiseField';
import type { DistMetric } from '../../lib/noise/worley';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};
const K = 'sweatshop.noise.';

function sget(path: string, fallback: any): any {
  try {
    const raw = storeGet(K + path);
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof fallback === 'boolean') return raw === 'true' || raw === '1';
    if (typeof fallback === 'number') { const n = Number(raw); return isNaN(n) ? fallback : n; }
    return String(raw);
  } catch { return fallback; }
}
function sset(path: string, value: any) {
  try { storeSet(K + path, String(value)); } catch {}
}

const ALGOS: Array<{ id: NoiseAlgo; label: string }> = [
  { id: 'perlin',             label: 'Perlin' },
  { id: 'simplex',            label: 'Simplex' },
  { id: 'worley-f1',          label: 'Worley F1' },
  { id: 'worley-edges',       label: 'Worley edges' },
  { id: 'fbm-perlin',         label: 'fBm (Perlin)' },
  { id: 'fbm-simplex',        label: 'fBm (Simplex)' },
  { id: 'ridge-perlin',       label: 'Ridge' },
  { id: 'turbulence-simplex', label: 'Turbulence' },
];

const METRICS: DistMetric[] = ['euclid', 'manhattan', 'chebyshev'];

const PALETTES: Array<{ cold: string; hot: string; name: string }> = [
  { cold: '#05070f', hot: '#e6f0ff', name: 'grayscale' },
  { cold: '#03122a', hot: '#5aa2ff', name: 'ocean' },
  { cold: '#2a1a10', hot: '#ffc48a', name: 'ember' },
  { cold: '#0a2212', hot: '#7ee787', name: 'forest' },
  { cold: '#18102a', hot: '#d2a8ff', name: 'nebula' },
];

export function NoisePanel() {
  const [algo, setAlgo]       = useState<NoiseAlgo>(sget('algo', 'fbm-perlin') as NoiseAlgo);
  const [seed, setSeed]       = useState<number>(sget('seed', 1));
  const [scale, setScale]     = useState<number>(sget('scale', 0.08));
  const [cols, setCols]       = useState<number>(sget('cols', 48));
  const [rows, setRows]       = useState<number>(sget('rows', 32));
  const [octaves, setOctaves] = useState<number>(sget('octaves', 4));
  const [metric, setMetric]   = useState<DistMetric>(sget('metric', 'euclid') as DistMetric);
  const [paletteIdx, setPalIdx] = useState<number>(sget('paletteIdx', 1));
  const [showGrid, setShowGrid] = useState<boolean>(sget('showGrid', false));

  const save = (k: string, v: any) => sset(k, v);
  const palette = PALETTES[Math.max(0, Math.min(PALETTES.length - 1, paletteIdx))];

  return (
    <Col style={{ width: '100%', height: '100%', padding: 10, gap: 10, backgroundColor: COLORS.panelBg }}>
      <Row style={{
        alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1,
        borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
      }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Noise</Text>
        <Text fontSize={10} color={COLORS.textDim}>seed={seed} · {cols}×{rows} cells · {palette.name}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={() => { const n = (seed + 1) | 0; setSeed(n); save('seed', n); }}
          style={pillBtn(COLORS.blue)}>
          <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>reseed +</Text>
        </Pressable>
        <Pressable onPress={() => { const n = Math.floor(Math.random() * 1_000_000); setSeed(n); save('seed', n); }}
          style={pillBtn(COLORS.purple)}>
          <Text fontSize={10} color={COLORS.purple} style={{ fontWeight: 'bold' }}>random</Text>
        </Pressable>
        <Pressable onPress={() => { const n = !showGrid; setShowGrid(n); save('showGrid', n); }}
          style={pillBtn(showGrid ? COLORS.orange : COLORS.textDim)}>
          <Text fontSize={10} color={showGrid ? COLORS.orange : COLORS.textDim} style={{ fontWeight: 'bold' }}>grid {showGrid ? 'on' : 'off'}</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {ALGOS.map((a) => {
          const active = a.id === algo;
          return (
            <Pressable key={a.id} onPress={() => { setAlgo(a.id); save('algo', a.id); }}
              style={{
                paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
                borderRadius: TOKENS.radiusPill, borderWidth: 1,
                borderColor: active ? COLORS.blue : COLORS.border,
                backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
              }}>
              <Text fontSize={10} color={active ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>{a.label}</Text>
            </Pressable>
          );
        })}
      </Row>

      <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Label text="seed" />
        <TextInput value={String(seed)} onChangeText={(v: string) => { const n = parseInt(v, 10); if (!isNaN(n)) { setSeed(n); save('seed', n); } }}
          style={numberInputStyle()} />
        <Label text="scale" />
        <Stepper value={scale} step={0.01} min={0.005} max={1} precision={3}
          onChange={(v) => { setScale(v); save('scale', v); }} />
        <Label text="cols" />
        <Stepper value={cols} step={4} min={8} max={160} precision={0}
          onChange={(v) => { setCols(v); save('cols', v); }} />
        <Label text="rows" />
        <Stepper value={rows} step={4} min={8} max={120} precision={0}
          onChange={(v) => { setRows(v); save('rows', v); }} />
        <Label text="octaves" />
        <Stepper value={octaves} step={1} min={1} max={8} precision={0}
          onChange={(v) => { setOctaves(v); save('octaves', v); }} />
        <Label text="metric" />
        {METRICS.map((m) => {
          const active = m === metric;
          return (
            <Pressable key={m} onPress={() => { setMetric(m); save('metric', m); }}
              style={{
                paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
                borderRadius: TOKENS.radiusSm, borderWidth: 1,
                borderColor: active ? COLORS.green : COLORS.border,
                backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
              }}>
              <Text fontSize={9} color={active ? COLORS.green : COLORS.textDim} style={{ fontFamily: 'monospace' }}>{m}</Text>
            </Pressable>
          );
        })}
        <Label text="palette" />
        {PALETTES.map((p, i) => {
          const active = i === paletteIdx;
          return (
            <Pressable key={p.name} onPress={() => { setPalIdx(i); save('paletteIdx', i); }}
              style={{ flexDirection: 'row', borderRadius: TOKENS.radiusSm, borderWidth: active ? 2 : 1, borderColor: active ? COLORS.blue : COLORS.border, overflow: 'hidden' }}>
              <Box style={{ width: 14, height: 16, backgroundColor: p.cold }} />
              <Box style={{ width: 14, height: 16, backgroundColor: p.hot }} />
            </Pressable>
          );
        })}
      </Row>

      <NoiseField
        algo={algo} seed={seed} scale={scale} cols={cols} rows={rows}
        octaves={octaves} metric={metric}
        paletteHot={palette.hot} paletteCold={palette.cold}
        showGrid={showGrid} />
    </Col>
  );
}

function Label(props: { text: string }) {
  return <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{props.text}</Text>;
}

function pillBtn(tone: string) {
  return {
    paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
    borderRadius: TOKENS.radiusPill, borderWidth: 1,
    borderColor: tone, backgroundColor: COLORS.panelAlt,
  };
}

function numberInputStyle() {
  return {
    height: 22, width: 72,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm,
    paddingLeft: 6, backgroundColor: COLORS.panelBg, fontFamily: 'monospace',
  };
}

function Stepper(props: { value: number; step: number; min: number; max: number; precision: number; onChange: (v: number) => void }) {
  const clamp = (n: number) => Math.max(props.min, Math.min(props.max, n));
  const fmt = (n: number) => props.precision === 0 ? String(Math.round(n)) : n.toFixed(props.precision);
  return (
    <Row style={{ alignItems: 'center', gap: 3 }}>
      <Pressable onPress={() => props.onChange(clamp(props.value - props.step))}
        style={{ width: 20, height: 20, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
        <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>−</Text>
      </Pressable>
      <Box style={{ minWidth: 40, padding: 2, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, alignItems: 'center' }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>{fmt(props.value)}</Text>
      </Box>
      <Pressable onPress={() => props.onChange(clamp(props.value + props.step))}
        style={{ width: 20, height: 20, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
        <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>+</Text>
      </Pressable>
    </Row>
  );
}
