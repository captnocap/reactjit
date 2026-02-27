import React, { useState } from 'react';
import {
  Box,
  Text,
  Pressable,
  Tabs,
  Slider,
  ScrollView,
  BarChart,
  ProgressBar,
  Sparkline,
  Divider,
  Badge,
  Scanlines,
  CRT,
  VHS,
  Dither,
  Ascii,
  Spirograph,
  Constellation,
  Voronoi,
  Mycelium,
  Rings,
  FlowParticles,
  TextEffect,
  useLuaInterval,
} from '../../../packages/core/src';
import type { Tab } from '../../../packages/core/src';
import type { ThemeColors } from '../../../packages/theme/src';
import { useThemeColors } from '../../../packages/theme/src';

type EffectMode = 'normal' | 'infinite' | 'reactive';

const effectLibrary = [
  { id: 'none', name: 'None', Component: null },
  { id: 'spirograph', name: 'Spirograph', Component: Spirograph },
  { id: 'constellation', name: 'Constellation', Component: Constellation },
  { id: 'voronoi', name: 'Voronoi', Component: Voronoi },
  { id: 'mycelium', name: 'Mycelium', Component: Mycelium },
  { id: 'rings', name: 'Rings', Component: Rings },
  { id: 'flow', name: 'FlowParticles', Component: FlowParticles },
] as const;
type EffectId = (typeof effectLibrary)[number]['id'];

const maskLibrary = [
  { id: 'none', name: 'None', Component: null },
  { id: 'scanlines', name: 'Scanlines', Component: Scanlines },
  { id: 'crt', name: 'CRT', Component: CRT },
  { id: 'vhs', name: 'VHS', Component: VHS },
  { id: 'dither', name: 'Dither', Component: Dither },
  { id: 'ascii', name: 'Ascii', Component: Ascii },
] as const;
type MaskId = (typeof maskLibrary)[number]['id'];

const effectLookup = Object.fromEntries(effectLibrary.map(item => [item.id, item])) as Record<EffectId, (typeof effectLibrary)[number]>;
const maskLookup = Object.fromEntries(maskLibrary.map(item => [item.id, item])) as Record<MaskId, (typeof maskLibrary)[number]>;

const surfaceIds = ['header', 'revenue', 'users', 'errors', 'latency', 'chart', 'targets', 'services'] as const;
type SurfaceId = (typeof surfaceIds)[number];

interface SurfaceMapping {
  effectId: EffectId;
  maskId: MaskId;
  speed: number;
  intensity: number;
  overlay: number;
  mode?: EffectMode;
}

type SurfaceMap = Record<SurfaceId, SurfaceMapping>;

const profileDefs = [
  { id: 'balanced', label: 'Balanced', description: 'Organized map with subtle masks and readable cards.' },
  { id: 'retro', label: 'Retro Stack', description: 'Heavy CRT and VHS treatment across the full dashboard.' },
  { id: 'studio', label: 'Studio', description: 'Mostly clean cards with targeted effect accents.' },
  { id: 'random', label: 'Randomized', description: 'One-click randomized mapping for fast combination sweeps.' },
] as const;
type ProfileId = (typeof profileDefs)[number]['id'];

const organizedMappings: Record<Exclude<ProfileId, 'random'>, SurfaceMap> = {
  balanced: {
    header: { effectId: 'constellation', maskId: 'scanlines', speed: 0.45, intensity: 0.2, overlay: 0.76 },
    revenue: { effectId: 'rings', maskId: 'none', speed: 0.62, intensity: 0.2, overlay: 0.8 },
    users: { effectId: 'flow', maskId: 'dither', speed: 0.55, intensity: 0.3, overlay: 0.72 },
    errors: { effectId: 'voronoi', maskId: 'crt', speed: 0.5, intensity: 0.26, overlay: 0.74 },
    latency: { effectId: 'mycelium', maskId: 'scanlines', speed: 0.58, intensity: 0.24, overlay: 0.74 },
    chart: { effectId: 'spirograph', maskId: 'none', speed: 0.75, intensity: 0.3, overlay: 0.82, mode: 'infinite' },
    targets: { effectId: 'constellation', maskId: 'ascii', speed: 0.5, intensity: 0.22, overlay: 0.7 },
    services: { effectId: 'voronoi', maskId: 'scanlines', speed: 0.48, intensity: 0.24, overlay: 0.74 },
  },
  retro: {
    header: { effectId: 'spirograph', maskId: 'crt', speed: 0.7, intensity: 0.45, overlay: 0.68 },
    revenue: { effectId: 'rings', maskId: 'vhs', speed: 0.7, intensity: 0.48, overlay: 0.66 },
    users: { effectId: 'constellation', maskId: 'scanlines', speed: 0.58, intensity: 0.5, overlay: 0.64 },
    errors: { effectId: 'voronoi', maskId: 'vhs', speed: 0.65, intensity: 0.52, overlay: 0.62 },
    latency: { effectId: 'mycelium', maskId: 'crt', speed: 0.6, intensity: 0.5, overlay: 0.66 },
    chart: { effectId: 'flow', maskId: 'crt', speed: 0.82, intensity: 0.44, overlay: 0.64, mode: 'infinite' },
    targets: { effectId: 'spirograph', maskId: 'ascii', speed: 0.72, intensity: 0.42, overlay: 0.62 },
    services: { effectId: 'voronoi', maskId: 'dither', speed: 0.58, intensity: 0.42, overlay: 0.64 },
  },
  studio: {
    header: { effectId: 'none', maskId: 'scanlines', speed: 0.36, intensity: 0.16, overlay: 0.92 },
    revenue: { effectId: 'rings', maskId: 'none', speed: 0.42, intensity: 0.2, overlay: 0.9 },
    users: { effectId: 'none', maskId: 'none', speed: 0.42, intensity: 0.2, overlay: 0.93 },
    errors: { effectId: 'mycelium', maskId: 'dither', speed: 0.44, intensity: 0.22, overlay: 0.86 },
    latency: { effectId: 'constellation', maskId: 'none', speed: 0.46, intensity: 0.2, overlay: 0.88 },
    chart: { effectId: 'spirograph', maskId: 'scanlines', speed: 0.6, intensity: 0.2, overlay: 0.86 },
    targets: { effectId: 'flow', maskId: 'none', speed: 0.52, intensity: 0.2, overlay: 0.88 },
    services: { effectId: 'voronoi', maskId: 'none', speed: 0.44, intensity: 0.2, overlay: 0.9 },
  },
};

const randomEffectChoices: EffectId[] = ['spirograph', 'constellation', 'voronoi', 'mycelium', 'rings', 'flow', 'none'];
const randomMaskChoices: MaskId[] = ['scanlines', 'crt', 'vhs', 'dither', 'ascii', 'none'];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.round(rand(min, max));
}

function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function makeRandomSurfaceMap(): SurfaceMap {
  const next = {} as SurfaceMap;
  for (const id of surfaceIds) {
    next[id] = {
      effectId: pickOne(randomEffectChoices),
      maskId: pickOne(randomMaskChoices),
      speed: rand(0.4, 1.7),
      intensity: rand(0.18, 0.9),
      overlay: rand(0.58, 0.9),
      mode: Math.random() > 0.72 ? 'infinite' : 'normal',
    };
  }
  return next;
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function jitter(base: number, span: number, min: number, max: number): number {
  return clamp(base + (Math.random() - 0.45) * span, min, max);
}

function jitterSeries(base: number[], variance: number): number[] {
  return base.map(v => Math.max(1, Math.round(v + (Math.random() - 0.5) * variance)));
}

function generateRevenueBars() {
  return [
    { label: 'Mon', value: randInt(18, 38) },
    { label: 'Tue', value: randInt(24, 46) },
    { label: 'Wed', value: randInt(21, 41) },
    { label: 'Thu', value: randInt(30, 54) },
    { label: 'Fri', value: randInt(35, 58) },
    { label: 'Sat', value: randInt(25, 44) },
    { label: 'Sun', value: randInt(20, 40) },
  ];
}

interface TargetMetric {
  label: string;
  value: number;
  tone: 'success' | 'info' | 'warning' | 'accent';
}

function generateTargets(): TargetMetric[] {
  return [
    { label: 'Availability', value: rand(0.93, 0.99), tone: 'success' },
    { label: 'SLA Budget', value: rand(0.55, 0.88), tone: 'info' },
    { label: 'Backlog Burn', value: rand(0.35, 0.76), tone: 'warning' },
    { label: 'Deploy Rate', value: rand(0.48, 0.82), tone: 'accent' },
  ];
}

type ServiceState = 'healthy' | 'watch' | 'incident';

interface ServiceMetric {
  name: string;
  state: ServiceState;
  load: number;
  latency: number;
  errors: number;
}

function generateServices(): ServiceMetric[] {
  return [
    {
      name: 'Auth API',
      state: Math.random() > 0.85 ? 'watch' : 'healthy',
      load: rand(0.42, 0.88),
      latency: randInt(70, 210),
      errors: randInt(0, 9),
    },
    {
      name: 'Realtime Bus',
      state: Math.random() > 0.86 ? 'incident' : 'healthy',
      load: rand(0.5, 0.96),
      latency: randInt(90, 260),
      errors: randInt(0, 12),
    },
    {
      name: 'Payments',
      state: Math.random() > 0.88 ? 'watch' : 'healthy',
      load: rand(0.3, 0.78),
      latency: randInt(80, 220),
      errors: randInt(0, 10),
    },
    {
      name: 'Search',
      state: Math.random() > 0.9 ? 'incident' : 'healthy',
      load: rand(0.35, 0.82),
      latency: randInt(65, 190),
      errors: randInt(0, 8),
    },
  ];
}

function serviceBadgeVariant(state: ServiceState) {
  if (state === 'healthy') return 'success' as const;
  if (state === 'watch') return 'warning' as const;
  return 'error' as const;
}

function serviceColor(state: ServiceState, c: ThemeColors): string {
  if (state === 'healthy') return c.success;
  if (state === 'watch') return c.warning;
  return c.error;
}

function toneColor(tone: TargetMetric['tone'], c: ThemeColors): string {
  if (tone === 'success') return c.success;
  if (tone === 'info') return c.info;
  if (tone === 'warning') return c.warning;
  return c.accent;
}

function describeMapping(mapping: SurfaceMapping): string {
  const effectName = effectLookup[mapping.effectId].name;
  const maskName = maskLookup[mapping.maskId].name;
  if (effectName === 'None' && maskName === 'None') return 'clean';
  if (effectName === 'None') return maskName;
  if (maskName === 'None') return effectName;
  return `${effectName} + ${maskName}`;
}

interface MappedSurfaceProps {
  colors: ThemeColors;
  mapping: SurfaceMapping;
  speedScale: number;
  intensityScale: number;
  style?: Record<string, unknown>;
  contentStyle?: Record<string, unknown>;
  children: React.ReactNode;
}

function MappedSurface(props: MappedSurfaceProps) {
  const { colors, mapping, speedScale, intensityScale, style, contentStyle, children } = props;
  const effectDef = effectLookup[mapping.effectId];
  const maskDef = maskLookup[mapping.maskId];
  const EffectComponent = effectDef.Component;
  const MaskComponent = maskDef.Component;

  const speed = clamp(mapping.speed * speedScale, 0.1, 4);
  const intensity = clamp(mapping.intensity * intensityScale, 0, 1);

  const effectProps: Record<string, unknown> = { background: true, speed };
  if (mapping.mode === 'infinite') effectProps.infinite = true;
  if (mapping.mode === 'reactive') effectProps.reactive = true;

  const maskProps: Record<string, unknown> = { mask: true, speed, intensity };
  if (mapping.maskId === 'vhs') {
    maskProps.tracking = clamp(intensity * 0.85 + 0.08, 0.08, 1);
    maskProps.noise = clamp(intensity * 0.6, 0.05, 0.8);
  }
  if (mapping.maskId === 'ascii') {
    maskProps.cellSize = Math.max(4, Math.round(11 - intensity * 6));
    maskProps.opacity = clamp(0.35 + intensity * 0.55, 0.35, 0.95);
  }
  if (mapping.maskId === 'dither') {
    maskProps.levels = Math.max(2, Math.round(8 - intensity * 5));
    maskProps.scale = Math.max(1, Math.round(1 + intensity * 3));
  }

  return (
    <Box style={{
      position: 'relative',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
      ...style,
    }}>
      {EffectComponent && <EffectComponent {...effectProps} />}
      <Box style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        backgroundColor: colors.bg,
        opacity: clamp(mapping.overlay, 0, 0.96),
      }} />
      <Box style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...contentStyle,
      }}>
        {children}
      </Box>
      {MaskComponent && <MaskComponent {...maskProps} />}
    </Box>
  );
}

function MasksDashboardDemo() {
  const c = useThemeColors();
  const [profileId, setProfileId] = useState<ProfileId>('balanced');
  const [randomMap, setRandomMap] = useState<SurfaceMap>(() => makeRandomSurfaceMap());
  const [speedScale, setSpeedScale] = useState(1.0);
  const [intensityScale, setIntensityScale] = useState(0.85);
  const [tick, setTick] = useState(0);

  const [kpis, setKpis] = useState({
    revenue: 62800,
    users: 1420,
    errors: 3,
    latency: 146,
    revDelta: 6.5,
    userDelta: 11.2,
    errDelta: -18.4,
    latDelta: -4.7,
  });

  const [sparks, setSparks] = useState({
    revenue: [28, 31, 30, 39, 42, 48, 52, 49, 57, 60, 58, 63],
    users: [115, 132, 148, 156, 144, 169, 174, 188, 201, 220, 235, 244],
    errors: [12, 10, 9, 11, 8, 7, 6, 9, 5, 4, 5, 3],
    latency: [190, 182, 176, 168, 160, 172, 158, 149, 142, 138, 134, 128],
  });

  const [revenueBars, setRevenueBars] = useState(generateRevenueBars);
  const [targets, setTargets] = useState(generateTargets);
  const [services, setServices] = useState(generateServices);

  useLuaInterval(2800, () => {
    setTick(prev => prev + 1);
    setRevenueBars(generateRevenueBars());

    setKpis(prev => ({
      revenue: Math.round(jitter(prev.revenue, 4200, 28000, 98000)),
      users: Math.round(jitter(prev.users, 120, 800, 4200)),
      errors: Math.round(jitter(prev.errors, 4, 0, 42)),
      latency: Math.round(jitter(prev.latency, 28, 55, 300)),
      revDelta: +jitter(prev.revDelta, 3.8, -12, 20).toFixed(1),
      userDelta: +jitter(prev.userDelta, 2.7, -9, 22).toFixed(1),
      errDelta: +jitter(prev.errDelta, 8, -90, 90).toFixed(1),
      latDelta: +jitter(prev.latDelta, 5.2, -40, 35).toFixed(1),
    }));

    setSparks({
      revenue: jitterSeries([28, 31, 30, 39, 42, 48, 52, 49, 57, 60, 58, 63], 10),
      users: jitterSeries([115, 132, 148, 156, 144, 169, 174, 188, 201, 220, 235, 244], 24),
      errors: jitterSeries([12, 10, 9, 11, 8, 7, 6, 9, 5, 4, 5, 3], 5),
      latency: jitterSeries([190, 182, 176, 168, 160, 172, 158, 149, 142, 138, 134, 128], 22),
    });

    setTargets(prev => prev.map(metric => ({
      ...metric,
      value: jitter(metric.value, 0.07, 0.05, 0.99),
    })));

    setServices(generateServices());
  });

  const activeProfile = profileDefs.find(p => p.id === profileId) ?? profileDefs[0];
  const activeMap = profileId === 'random' ? randomMap : organizedMappings[profileId];

  const profileTabs: Tab[] = profileDefs.map(profile => ({ id: profile.id, label: profile.label }));

  const kpiCards = [
    { id: 'revenue', label: 'Revenue', value: `$${formatCompact(kpis.revenue)}`, delta: kpis.revDelta, spark: sparks.revenue, surface: 'revenue' as SurfaceId, color: c.success },
    { id: 'users', label: 'Active Users', value: formatCompact(kpis.users), delta: kpis.userDelta, spark: sparks.users, surface: 'users' as SurfaceId, color: c.info },
    { id: 'errors', label: 'Errors', value: String(kpis.errors), delta: kpis.errDelta, spark: sparks.errors, surface: 'errors' as SurfaceId, color: c.error },
    { id: 'latency', label: 'Latency', value: `${kpis.latency}ms`, delta: kpis.latDelta, spark: sparks.latency, surface: 'latency' as SurfaceId, color: c.warning },
  ];

  const updateLabel = tick === 0 ? 'just now' : `${tick * 3}s ago`;
  const summarySurfaces: { label: string; key: SurfaceId }[] = [
    { label: 'Header', key: 'header' },
    { label: 'Chart', key: 'chart' },
    { label: 'Services', key: 'services' },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', gap: 6, minHeight: 0 }}>
      <Box style={{
        width: '100%',
        gap: 6,
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'start', width: '100%', gap: 10 }}>
          <Box style={{ flexGrow: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: 'bold' }}>Mask Mapping Dashboard</Text>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              Click a top toggle to remap effects and masks across dashboard surfaces.
            </Text>
          </Box>
          <Pressable
            onPress={() => setRandomMap(makeRandomSurfaceMap())}
            style={{
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 5,
              paddingBottom: 5,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.bgAlt,
              opacity: profileId === 'random' ? 1 : 0.75,
            }}
          >
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Re-map</Text>
          </Pressable>
        </Box>

        <Tabs
          tabs={profileTabs}
          activeId={profileId}
          onSelect={(id) => {
            const next = id as ProfileId;
            setProfileId(next);
            if (next === 'random') setRandomMap(makeRandomSurfaceMap());
          }}
          variant="pill"
          style={{ padding: 3, gap: 3, flexWrap: 'wrap' }}
        />

        <Box style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
          <Box style={{ flexGrow: 1, gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Global Speed</Text>
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
              <Box style={{ flexGrow: 1 }}>
                <Slider value={speedScale} min={0.5} max={1.8} onValueChange={setSpeedScale} />
              </Box>
              <Text style={{ color: c.text, fontSize: 10, width: 34 }}>{speedScale.toFixed(2)}</Text>
            </Box>
          </Box>
          <Box style={{ flexGrow: 1, gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Global Intensity</Text>
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
              <Box style={{ flexGrow: 1 }}>
                <Slider value={intensityScale} min={0.3} max={1.3} onValueChange={setIntensityScale} />
              </Box>
              <Text style={{ color: c.text, fontSize: 10, width: 34 }}>{intensityScale.toFixed(2)}</Text>
            </Box>
          </Box>
        </Box>

        <Box style={{ flexDirection: 'row', width: '100%', gap: 6, flexWrap: 'wrap' }}>
          {summarySurfaces.map((item) => (
            <Box
              key={item.key}
              style={{
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 3,
                paddingBottom: 3,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.bgAlt,
              }}
            >
              <Text style={{ color: c.textDim, fontSize: 9 }}>
                {`${item.label}: ${describeMapping(activeMap[item.key])}`}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <ScrollView style={{ width: '100%', flexGrow: 1, minHeight: 0 }}>
        <Box style={{ gap: 8, paddingBottom: 6 }}>
          <MappedSurface
            colors={c}
            mapping={activeMap.header}
            speedScale={speedScale}
            intensityScale={intensityScale}
            style={{ width: '100%', height: 78 }}
            contentStyle={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 10,
              paddingBottom: 10,
              justifyContent: 'space-between',
            }}
          >
            <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>Operations Dashboard</Text>
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Badge label={activeProfile.label} variant="info" />
                <Text style={{ color: c.textDim, fontSize: 10 }}>{`Updated ${updateLabel}`}</Text>
              </Box>
            </Box>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>{activeProfile.description}</Text>
          </MappedSurface>

          <Box style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
            {kpiCards.map((card) => (
              <MappedSurface
                key={card.id}
                colors={c}
                mapping={activeMap[card.surface]}
                speedScale={speedScale}
                intensityScale={intensityScale}
                style={{ flexGrow: 1, flexBasis: 0, minHeight: 94 }}
                contentStyle={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 9,
                  paddingBottom: 9,
                  justifyContent: 'space-between',
                  gap: 4,
                }}
              >
                <Text style={{ color: c.textSecondary, fontSize: 10 }}>{card.label}</Text>
                <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box style={{ gap: 2 }}>
                    <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>{card.value}</Text>
                    <Text style={{ color: card.delta >= 0 ? c.success : c.error, fontSize: 10, fontWeight: 'bold' }}>
                      {`${card.delta >= 0 ? '+' : ''}${card.delta.toFixed(1)}%`}
                    </Text>
                  </Box>
                  <Sparkline data={card.spark} width={64} height={22} color={card.color} />
                </Box>
              </MappedSurface>
            ))}
          </Box>

          <Box style={{ flexDirection: 'row', width: '100%', gap: 8 }}>
            <MappedSurface
              colors={c}
              mapping={activeMap.chart}
              speedScale={speedScale}
              intensityScale={intensityScale}
              style={{ flexGrow: 1, minHeight: 210 }}
              contentStyle={{
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 12,
                paddingBottom: 12,
                gap: 8,
              }}
            >
              <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>Weekly Throughput</Text>
              <BarChart data={revenueBars} height={134} showValues color={c.primary} />
            </MappedSurface>

            <MappedSurface
              colors={c}
              mapping={activeMap.targets}
              speedScale={speedScale}
              intensityScale={intensityScale}
              style={{ width: 220, minHeight: 210 }}
              contentStyle={{
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 12,
                paddingBottom: 12,
                gap: 8,
              }}
            >
              <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>Target Tracking</Text>
              {targets.map((metric) => (
                <Box key={metric.label} style={{ gap: 3 }}>
                  <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                    <Text style={{ color: c.textSecondary, fontSize: 10 }}>{metric.label}</Text>
                    <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold' }}>
                      {`${Math.round(metric.value * 100)}%`}
                    </Text>
                  </Box>
                  <ProgressBar value={metric.value} color={toneColor(metric.tone, c)} height={6} animated />
                </Box>
              ))}
            </MappedSurface>
          </Box>

          <MappedSurface
            colors={c}
            mapping={activeMap.services}
            speedScale={speedScale}
            intensityScale={intensityScale}
            style={{ width: '100%', minHeight: 196 }}
            contentStyle={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 12,
              paddingBottom: 12,
              gap: 8,
            }}
          >
            <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>Service Health</Text>
              <Text style={{ color: c.textSecondary, fontSize: 10 }}>{`${services.length} services`}</Text>
            </Box>
            <Divider color={c.border} />
            {services.map((service) => (
              <Box key={service.name} style={{ gap: 3 }}>
                <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: c.text, fontSize: 11, fontWeight: 'bold' }}>{service.name}</Text>
                    <Badge label={service.state} variant={serviceBadgeVariant(service.state)} />
                  </Box>
                  <Text style={{ color: c.textSecondary, fontSize: 10 }}>{`${service.latency}ms`}</Text>
                </Box>
                <ProgressBar value={service.load} color={serviceColor(service.state, c)} height={5} animated />
                <Box style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                  <Text style={{ color: c.textDim, fontSize: 9 }}>{`Load ${Math.round(service.load * 100)}%`}</Text>
                  <Text style={{ color: c.textDim, fontSize: 9 }}>{`${service.errors} errors/min`}</Text>
                </Box>
              </Box>
            ))}
          </MappedSurface>
        </Box>
      </ScrollView>
    </Box>
  );
}

const legacyMasks = [
  { name: 'Scanlines', Component: Scanlines },
  { name: 'CRT', Component: CRT },
  { name: 'VHS', Component: VHS },
  { name: 'Dither', Component: Dither },
  { name: 'Ascii', Component: Ascii },
] as const;

const legacyBackgrounds = [
  { name: 'None', Component: null },
  { name: 'Spirograph', Component: Spirograph },
  { name: 'Constellation', Component: Constellation },
  { name: 'Voronoi', Component: Voronoi },
  { name: 'Mycelium', Component: Mycelium },
  { name: 'Rings', Component: Rings },
  { name: 'FlowParticles', Component: FlowParticles },
] as const;

function LegacyMasksLab() {
  const c = useThemeColors();
  const [maskIdx, setMaskIdx] = useState(0);
  const [bgIdx, setBgIdx] = useState(1);
  const [intensity, setIntensity] = useState(0.5);
  const [speed, setSpeed] = useState(1.0);

  const selectedMask = legacyMasks[maskIdx];
  const MaskComponent = selectedMask.Component;
  const selectedBg = legacyBackgrounds[bgIdx];
  const BgComponent = selectedBg.Component;

  const maskTabs: Tab[] = legacyMasks.map((m, i) => ({ id: String(i), label: m.name }));
  const bgTabs: Tab[] = legacyBackgrounds.map((b, i) => ({ id: String(i), label: b.name }));

  return (
    <Box style={{ width: '100%', height: '100%', padding: 6, gap: 6, minHeight: 0, overflow: 'hidden' }}>
      <Box style={{
        width: '100%',
        gap: 5,
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'start', width: '100%', gap: 10 }}>
          <Box style={{ flexGrow: 1, minWidth: 0, gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: 'bold' }}>Masks Legacy Lab</Text>
            <Text style={{ color: c.textSecondary, fontSize: 10 }}>
              Original playground retained while the dashboard mapping demo is being validated.
            </Text>
          </Box>
        </Box>

        <Box style={{ gap: 2 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Mask</Text>
          <Tabs
            tabs={maskTabs}
            activeId={String(maskIdx)}
            onSelect={(id) => setMaskIdx(Number(id))}
            variant="pill"
            style={{ padding: 3, gap: 3 }}
          />
        </Box>

        <Box style={{ gap: 2 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Background Effect</Text>
          <Tabs
            tabs={bgTabs}
            activeId={String(bgIdx)}
            onSelect={(id) => setBgIdx(Number(id))}
            variant="pill"
            style={{ flexWrap: 'wrap', padding: 3, gap: 3 }}
          />
        </Box>

        <Box style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
          <Box style={{ flexGrow: 1, gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Intensity</Text>
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
              <Box style={{ flexGrow: 1 }}>
                <Slider value={intensity} min={0} max={1} onValueChange={setIntensity} />
              </Box>
              <Text style={{ color: c.text, fontSize: 10, width: 30 }}>{intensity.toFixed(2)}</Text>
            </Box>
          </Box>
          <Box style={{ flexGrow: 1, gap: 2 }}>
            <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Speed</Text>
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
              <Box style={{ flexGrow: 1 }}>
                <Slider value={speed} min={0.1} max={3} onValueChange={setSpeed} />
              </Box>
              <Text style={{ color: c.text, fontSize: 10, width: 30 }}>{speed.toFixed(1)}</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 6, flexGrow: 1, minHeight: 0 }}>
        <Box style={{ flexGrow: 1, flexBasis: 0, gap: 4, minHeight: 0 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>
            {`${selectedMask.name} Mask`}
          </Text>
          <Box style={{
            flexGrow: 1,
            minHeight: 0,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
          }}>
            {BgComponent && <BgComponent background speed={speed * 0.7} />}
            <Box style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
            }}>
              <Box style={{
                padding: 16,
                borderRadius: 10,
                backgroundColor: c.bg,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                gap: 6,
              }}>
                <Text style={{ color: c.text, fontSize: 22, fontWeight: 'bold' }}>
                  {selectedMask.name}
                </Text>
                <Text style={{ color: c.textSecondary, fontSize: 11 }}>
                  Post-processing mask active
                </Text>
              </Box>
            </Box>
            <MaskComponent mask intensity={intensity} speed={speed} />
          </Box>
        </Box>

        <Box style={{ width: 240, gap: 4, minHeight: 0 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: 'bold' }}>
            Full Compositing Stack
          </Text>

          <Box style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
            flexGrow: 1,
            minHeight: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Spirograph background speed={0.6} />
            <Box style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              backgroundColor: c.bg,
              opacity: 0.25,
            }} />
            <Box style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
            }}>
              <TextEffect
                type="neon"
                text="REACTJIT"
                style={{ width: 200, height: 50 }}
              />
              <Box style={{
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 6,
                backgroundColor: c.bgAlt,
                borderWidth: 1,
                borderColor: c.border,
              }}>
                <Text style={{ color: c.text, fontSize: 9, fontWeight: 'bold' }}>
                  BG + Text FX + Mask
                </Text>
              </Box>
            </Box>
            <MaskComponent mask intensity={intensity * 0.7} speed={speed} />
          </Box>

          <Box style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
            height: 120,
            flexShrink: 0,
          }}>
            <Constellation background speed={0.8} />
            <Box style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
                Constellation + CRT
              </Text>
            </Box>
            <CRT mask intensity={intensity * 0.6} speed={speed} />
          </Box>

          <Box style={{
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
            height: 100,
            flexShrink: 0,
          }}>
            <Voronoi background speed={0.5} />
            <Box style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              backgroundColor: c.bg,
              opacity: 0.3,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <TextEffect
                type="typewriter"
                text="PLAY"
                style={{ width: 120, height: 36 }}
                speed={0.8}
              />
            </Box>
            <VHS mask tracking={intensity * 0.8} speed={speed} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

type MasksView = 'dashboard' | 'legacy';

export function MasksStory() {
  const c = useThemeColors();
  const [view, setView] = useState<MasksView>('dashboard');

  const viewTabs: Tab[] = [
    { id: 'dashboard', label: 'Dashboard Mapping' },
    { id: 'legacy', label: 'Legacy Lab' },
  ];

  return (
    <Box style={{ width: '100%', height: '100%', padding: 6, gap: 6, minHeight: 0, overflow: 'hidden' }}>
      <Box style={{
        width: '100%',
        gap: 4,
        padding: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.bgElevated,
        flexShrink: 0,
      }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: 'bold' }}>Masks</Text>
        <Text style={{ color: c.textSecondary, fontSize: 10 }}>
          Dashboard-style mapping demo is first-class. Legacy lab remains for side-by-side comparison.
        </Text>
        <Tabs
          tabs={viewTabs}
          activeId={view}
          onSelect={(id) => setView(id as MasksView)}
          variant="pill"
          style={{ padding: 3, gap: 3 }}
        />
      </Box>

      <Box style={{ flexGrow: 1, minHeight: 0 }}>
        {view === 'dashboard' ? <MasksDashboardDemo /> : <LegacyMasksLab />}
      </Box>
    </Box>
  );
}
