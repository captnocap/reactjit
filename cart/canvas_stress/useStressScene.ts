const React: any = require('react');
const { useMemo } = React;

export type StressPreset = 'grid' | 'spiral' | 'force-layout' | 'random-scatter' | 'concentric-rings';
export type StressShape = 'circles' | 'rects' | 'triangles' | 'mixed';
export type StressNodeShape = 'circle' | 'rect' | 'triangle';

export type StressNode = {
  id: number;
  baseX: number;
  baseY: number;
  size: number;
  hue: number;
  saturation: number;
  lightness: number;
  shape: StressNodeShape;
  phase: number;
  speed: number;
  drift: number;
  spin: number;
  ampX: number;
  ampY: number;
};

export type StressScene = {
  count: number;
  preset: StressPreset;
  shapeMode: StressShape;
  nodes: StressNode[];
  span: number;
};

type StressSceneConfig = {
  count: number;
  preset: StressPreset;
  shapeMode: StressShape;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickShape(mode: StressShape, index: number, rnd: () => number): StressNodeShape {
  if (mode === 'circles') return 'circle';
  if (mode === 'rects') return 'rect';
  if (mode === 'triangles') return 'triangle';
  const roll = (index + Math.floor(rnd() * 13)) % 3;
  return roll === 0 ? 'circle' : roll === 1 ? 'rect' : 'triangle';
}

function buildGrid(count: number, rnd: () => number) {
  const nodes: StressNode[] = [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const stepX = 42;
  const stepY = 42;
  const offsetX = -(cols - 1) * stepX * 0.5;
  const offsetY = -(rows - 1) * stepY * 0.5;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    nodes.push({
      id: i,
      baseX: offsetX + col * stepX + (rnd() - 0.5) * 4,
      baseY: offsetY + row * stepY + (rnd() - 0.5) * 4,
      size: 10 + (i % 5) * 2,
      hue: (i * 0.007) % 1,
      saturation: 0.55 + rnd() * 0.35,
      lightness: 0.46 + rnd() * 0.18,
      shape: 'rect',
      phase: rnd() * Math.PI * 2,
      speed: 0.3 + rnd() * 1.3,
      drift: 4 + rnd() * 18,
      spin: rnd() * 2,
      ampX: 0,
      ampY: 0,
    });
  }
  return nodes;
}

function buildSpiral(count: number, rnd: () => number) {
  const nodes: StressNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const radius = 12 + t * 1200;
    const angle = i * 0.24;
    nodes.push({
      id: i,
      baseX: Math.cos(angle) * radius + (rnd() - 0.5) * 3,
      baseY: Math.sin(angle) * radius + (rnd() - 0.5) * 3,
      size: 6 + (i % 9),
      hue: (0.55 + t * 0.35) % 1,
      saturation: 0.62 + rnd() * 0.25,
      lightness: 0.44 + rnd() * 0.2,
      shape: 'circle',
      phase: rnd() * Math.PI * 2,
      speed: 0.8 + rnd() * 1.8,
      drift: 6 + rnd() * 14,
      spin: 1 + rnd() * 3,
      ampX: 10 + t * 30,
      ampY: 10 + t * 30,
    });
  }
  return nodes;
}

function buildForceLayout(count: number, rnd: () => number) {
  const nodes: StressNode[] = [];
  for (let i = 0; i < count; i++) {
    const ring = 0.4 + rnd() * 0.9;
    const angle = rnd() * Math.PI * 2;
    const radius = 100 + Math.pow(rnd(), 0.5) * 1200;
    nodes.push({
      id: i,
      baseX: Math.cos(angle) * radius * ring,
      baseY: Math.sin(angle) * radius * ring,
      size: 7 + Math.floor(rnd() * 15),
      hue: (rnd() * 0.85) % 1,
      saturation: 0.55 + rnd() * 0.35,
      lightness: 0.42 + rnd() * 0.24,
      shape: i % 2 === 0 ? 'circle' : 'rect',
      phase: rnd() * Math.PI * 2,
      speed: 0.2 + rnd() * 0.8,
      drift: 18 + rnd() * 54,
      spin: rnd() * 2.5,
      ampX: 24 + rnd() * 80,
      ampY: 24 + rnd() * 80,
    });
  }
  return nodes;
}

function buildRandomScatter(count: number, rnd: () => number) {
  const nodes: StressNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rnd() - 0.5) * 3200;
    const y = (rnd() - 0.5) * 2000;
    nodes.push({
      id: i,
      baseX: x,
      baseY: y,
      size: 6 + Math.floor(rnd() * 18),
      hue: rnd(),
      saturation: 0.5 + rnd() * 0.45,
      lightness: 0.42 + rnd() * 0.24,
      shape: rnd() < 0.33 ? 'circle' : rnd() < 0.66 ? 'rect' : 'triangle',
      phase: rnd() * Math.PI * 2,
      speed: 0.4 + rnd() * 2,
      drift: 12 + rnd() * 36,
      spin: rnd() * 4,
      ampX: 8 + rnd() * 60,
      ampY: 8 + rnd() * 60,
    });
  }
  return nodes;
}

function buildRings(count: number, rnd: () => number) {
  const nodes: StressNode[] = [];
  const rings = Math.max(3, Math.round(Math.sqrt(count / 500)));
  for (let i = 0; i < count; i++) {
    const ring = i % rings;
    const ringCount = Math.max(1, Math.floor(count / rings));
    const angle = (i / Math.max(1, ringCount)) * Math.PI * 2 + ring * 0.2;
    const radius = 80 + ring * 90;
    nodes.push({
      id: i,
      baseX: Math.cos(angle) * radius + (rnd() - 0.5) * 8,
      baseY: Math.sin(angle) * radius + (rnd() - 0.5) * 8,
      size: 7 + (ring % 4) * 3,
      hue: (ring / Math.max(1, rings)) % 1,
      saturation: 0.58 + rnd() * 0.25,
      lightness: 0.44 + rnd() * 0.18,
      shape: ring % 3 === 0 ? 'circle' : ring % 3 === 1 ? 'rect' : 'triangle',
      phase: rnd() * Math.PI * 2,
      speed: 0.3 + ring * 0.05,
      drift: 8 + ring * 2,
      spin: 0.5 + ring * 0.3,
      ampX: 6 + ring * 3,
      ampY: 6 + ring * 3,
    });
  }
  return nodes;
}

export function useStressScene(config: StressSceneConfig): StressScene {
  return useMemo(() => {
    const count = clamp(config.count, 1, 100000);
    const seed = (count * 131) ^ config.preset.length ^ config.shapeMode.length;
    const rnd = mulberry32(seed);
    const nodes =
      config.preset === 'grid' ? buildGrid(count, rnd)
      : config.preset === 'spiral' ? buildSpiral(count, rnd)
      : config.preset === 'force-layout' ? buildForceLayout(count, rnd)
      : config.preset === 'concentric-rings' ? buildRings(count, rnd)
      : buildRandomScatter(count, rnd);
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].shape = pickShape(config.shapeMode, i, rnd);
    }
    return {
      count,
      preset: config.preset,
      shapeMode: config.shapeMode,
      nodes,
      span: config.preset === 'grid' ? Math.max(500, Math.ceil(Math.sqrt(count)) * 44)
        : config.preset === 'spiral' ? 1400
        : config.preset === 'force-layout' ? 1600
        : config.preset === 'concentric-rings' ? 1400
        : 2200,
    };
  }, [config.count, config.preset, config.shapeMode]);
}

export function resolveNodePosition(node: StressNode, timeSec: number, animated: boolean) {
  if (!animated) {
    return {
      x: node.baseX,
      y: node.baseY,
      size: node.size,
      spin: 0,
    };
  }
  const wobble = Math.sin(timeSec * node.speed + node.phase);
  const swirl = Math.cos(timeSec * (node.speed * 0.73) + node.phase);
  return {
    x: node.baseX + wobble * node.ampX + swirl * node.drift * 0.12,
    y: node.baseY + swirl * node.ampY + wobble * node.drift * 0.12,
    size: Math.max(2, node.size + Math.sin(timeSec * (1.1 + node.speed) + node.phase) * 2),
    spin: timeSec * node.spin * 40,
  };
}
