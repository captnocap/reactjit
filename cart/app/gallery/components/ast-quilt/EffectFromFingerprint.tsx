import { useRef } from 'react';
import { Box, Effect } from '@reactjit/runtime/primitives';
import {
  prepareAstFingerprintFile,
  type AstFingerprintFile,
  type AstFingerprintInputFile,
} from './AstQuilt';
import { AST_SAMPLE_FILES } from './sampleContract';

const FRAME_SIZE = 360;
const EFFECT_SIZE = 332;
const QUILT_FRAME_SIZE = 648;
const QUILT_EFFECT_SIZE = 620;
const PIXEL_STEP = 2;
const PALETTE_SIZE = 256;
const ENGINE_COUNT = 8;

export const ENGINE_NAMES = [
  'plasma',
  'voronoi',
  'mandala',
  'waves',
  'lattice',
  'streams',
  'spiral',
  'reaction',
] as const;

export type EngineName = (typeof ENGINE_NAMES)[number];

export type FingerprintGenes = {
  seed: number;
  engineId: number;
  engineName: EngineName;
  hueBase: number;
  hueSpan: number;
  saturation: number;
  brightness: number;
  density: number;
  scaleA: number;
  scaleB: number;
  speed: number;
  symmetry: number;
  warp: number;
  twist: number;
  detail: number;
  threshA: number;
  threshB: number;
  bgHue: number;
  bgValue: number;
  voices: number[];
};

type PixelWriter = (x: number, y: number, r: number, g: number, b: number, a: number) => void;
type Painter = (
  effect: any,
  write: PixelWriter,
  palette: Uint8Array,
  genes: FingerprintGenes,
  x0: number,
  y0: number,
  W: number,
  H: number,
) => void;

function mix32(value: number): number {
  let out = value >>> 0;
  out ^= out >>> 16;
  out = Math.imul(out, 0x7feb352d) >>> 0;
  out ^= out >>> 15;
  out = Math.imul(out, 0x846ca68b) >>> 0;
  out ^= out >>> 16;
  return out >>> 0;
}

function r01(seed: number, slot: number): number {
  return mix32(seed ^ Math.imul(slot + 1, 0x9e3779b1)) / 4294967295;
}

function rangeFrom(seed: number, slot: number, lo: number, hi: number): number {
  return lo + (hi - lo) * r01(seed, slot);
}

function hashStr(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash === 0 ? 1 : hash;
}

export function extractFingerprintGenes(file: AstFingerprintFile): FingerprintGenes {
  let kindXor = 0;
  let kindSum = 0 >>> 0;
  let depthSum = 0;
  let leafCount = 0;
  let branchSum = 0;
  let branchCount = 0;
  let maxDepth = 0;
  let totalLength = 0;
  let visited = 0;

  const stack: number[] = [file.root, 0];
  while (stack.length > 0) {
    const depth = stack.pop()!;
    const node = stack.pop()!;
    if (node === 0) continue;
    const i = node - 1;
    if (i < 0 || i >= file.count) continue;

    visited++;
    if (depth > maxDepth) maxDepth = depth;
    depthSum += depth;
    kindXor ^= file.kind[i] || 0;
    kindSum = (kindSum + (file.kind[i] || 0)) >>> 0;
    totalLength += Math.max(0, (file.end[i] || 0) - (file.start[i] || 0));

    const fc = file.firstChild[i] || 0;
    if (fc === 0) {
      leafCount++;
    } else {
      let b = 0;
      let c = fc;
      while (c !== 0) {
        b++;
        stack.push(c, depth + 1);
        const ci = c - 1;
        c = ci >= 0 && ci < file.count ? (file.nextSibling[ci] || 0) : 0;
      }
      branchSum += b;
      branchCount++;
    }
  }

  const pathHash = hashStr(file.path);
  const shapeMix = (kindXor ^ kindSum ^ Math.imul(file.count, 0x9e3779b1) ^ Math.imul(maxDepth + 1, 0x85ebca6b) ^ Math.imul(leafCount + 1, 0xc2b2ae35) ^ ((totalLength | 0) >>> 0)) >>> 0;
  const seed = mix32((pathHash ^ shapeMix) >>> 0);

  const voiceCount = 16;
  const voices: number[] = [];
  for (let v = 0; v < voiceCount; v++) {
    const idx =
      ((Math.imul(v + 1, 0x9e3779b1) ^ seed) >>> 0) % Math.max(1, file.count);
    const k = file.kind[idx] || 0;
    const s = file.start[idx] || 0;
    const e = file.end[idx] || 0;
    voices.push(
      mix32(k ^ Math.imul(s + 1, 0x85ebca6b) ^ Math.imul(e + 1, 0xc2b2ae35)),
    );
  }

  const safeVisited = Math.max(1, visited);
  const avgBranch = branchCount > 0 ? branchSum / branchCount : 1;
  const avgDepth = depthSum / safeVisited;
  const avgLength = totalLength / safeVisited;
  const densityBoost = Math.min(20, Math.floor(file.count / 32));
  const depthBoost = Math.min(0.6, avgDepth * 0.05);
  const lengthScale = Math.min(1.2, avgLength / 64);

  const engineId = mix32(seed) % ENGINE_COUNT;

  return {
    seed,
    engineId,
    engineName: ENGINE_NAMES[engineId],
    hueBase: r01(seed, 1),
    hueSpan: rangeFrom(seed, 2, 0.08, 0.95),
    saturation: rangeFrom(seed, 3, 0.5, 0.95),
    brightness: rangeFrom(seed, 4, 0.6, 1),
    density: 4 + Math.floor(rangeFrom(seed, 5, 4, 22)) + densityBoost,
    scaleA: rangeFrom(seed, 6, 0.005, 0.05) * (0.6 + lengthScale * 0.6),
    scaleB: rangeFrom(seed, 7, 0.004, 0.06) * (0.6 + lengthScale * 0.6),
    speed: rangeFrom(seed, 8, 0.25, 2.4) * (1 + (avgBranch - 1) * 0.08),
    symmetry: 1 + Math.floor(r01(seed, 9) * 7),
    warp: rangeFrom(seed, 10, 0, 1.6) + depthBoost,
    twist: rangeFrom(seed, 11, -3.5, 3.5),
    detail: Math.min(5, 1 + Math.floor(r01(seed, 12) * 4) + Math.min(2, Math.floor(maxDepth / 4))),
    threshA: r01(seed, 13),
    threshB: r01(seed, 14),
    bgHue: r01(seed, 15),
    bgValue: rangeFrom(seed, 16, 0, 0.18),
    voices,
  };
}

function buildPalette(effect: any, genes: FingerprintGenes): Uint8Array {
  const out = new Uint8Array(PALETTE_SIZE * 3);
  const sat = genes.saturation;
  const baseV = genes.brightness;
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const t = i / (PALETTE_SIZE - 1);
    const hue = ((genes.hueBase + t * genes.hueSpan) % 1 + 1) % 1;
    const v = baseV * (0.25 + 0.75 * t);
    const rgb = effect.hsv(hue, sat, v);
    out[i * 3] = (rgb[0] * 255) | 0;
    out[i * 3 + 1] = (rgb[1] * 255) | 0;
    out[i * 3 + 2] = (rgb[2] * 255) | 0;
  }
  return out;
}

function paintBlock(
  write: PixelWriter,
  px: number,
  py: number,
  pxEnd: number,
  pyEnd: number,
  palette: Uint8Array,
  idx: number,
) {
  const r = palette[idx * 3];
  const g = palette[idx * 3 + 1];
  const b = palette[idx * 3 + 2];
  for (let y = py; y < pyEnd; y++) {
    for (let x = px; x < pxEnd; x++) write(x, y, r, g, b, 255);
  }
}

function paletteIndex(value: number): number {
  let v = value;
  if (v < 0) v = 0;
  else if (v > 1) v = 1;
  const idx = (v * (PALETTE_SIZE - 1)) | 0;
  return idx < 0 ? 0 : idx >= PALETTE_SIZE ? PALETTE_SIZE - 1 : idx;
}

function paintPlasma(
  effect: any,
  write: PixelWriter,
  palette: Uint8Array,
  genes: FingerprintGenes,
  x0: number,
  y0: number,
  W: number,
  H: number,
) {
  const t = effect.time * genes.speed;
  const sa = genes.scaleA;
  const sb = genes.scaleB;
  const detail = genes.detail;
  const xEnd = x0 + W;
  const yEnd = y0 + H;
  for (let py = y0; py < yEnd; py += PIXEL_STEP) {
    const ly = py - y0;
    const pyNext = Math.min(yEnd, py + PIXEL_STEP);
    for (let px = x0; px < xEnd; px += PIXEL_STEP) {
      const lx = px - x0;
      const f = effect.fbm(lx * sa + t * 0.3, ly * sa - t * 0.2, detail);
      const g = effect.fbm(lx * sb + 100 - t * 0.15, ly * sb + 200 + t * 0.25, detail);
      const v = (f + g) * 0.25 + 0.5;
      paintBlock(write, px, py, Math.min(xEnd, px + PIXEL_STEP), pyNext, palette, paletteIndex(v));
    }
  }
}

function paintVoronoi(
  effect: any,
  write: PixelWriter,
  palette: Uint8Array,
  genes: FingerprintGenes,
  x0: number,
  y0: number,
  W: number,
  H: number,
) {
  const t = effect.time * genes.speed * 0.4;
  const seedCount = Math.max(4, Math.min(20, genes.density));
  const sx = new Float32Array(seedCount);
  const sy = new Float32Array(seedCount);
  const st = new Float32Array(seedCount);
  for (let i = 0; i < seedCount; i++) {
    const v = genes.voices[i % genes.voices.length];
    const ox = ((v >>> 0) & 0xff) / 255;
    const oy = ((v >>> 8) & 0xff) / 255;
    const drift = ((v >>> 16) & 0xff) / 255;
    sx[i] = ox * W + Math.cos(t + i * 0.71) * drift * 24;
    sy[i] = oy * H + Math.sin(t * 0.83 + i * 1.31) * drift * 24;
    st[i] = (i + 0.5) / seedCount;
  }
  const xEnd = x0 + W;
  const yEnd = y0 + H;
  for (let py = y0; py < yEnd; py += PIXEL_STEP) {
    const ly = py - y0;
    const pyNext = Math.min(yEnd, py + PIXEL_STEP);
    for (let px = x0; px < xEnd; px += PIXEL_STEP) {
      const lx = px - x0;
      let bestD = 1e9;
      let secondD = 1e9;
      let bestI = 0;
      for (let i = 0; i < seedCount; i++) {
        const dx = lx - sx[i];
        const dy = ly - sy[i];
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          secondD = bestD;
          bestD = d;
          bestI = i;
        } else if (d < secondD) {
          secondD = d;
        }
      }
      const edge = Math.min(1, (Math.sqrt(secondD) - Math.sqrt(bestD)) / 12);
      const v = st[bestI] * 0.7 + edge * 0.3;
      paintBlock(write, px, py, Math.min(xEnd, px + PIXEL_STEP), pyNext, palette, paletteIndex(v));
    }
  }
}

function paintMandala(
  effect: any,
  write: PixelWriter,
  palette: Uint8Array,
  genes: FingerprintGenes,
  x0: number,
  y0: number,
  W: number,
  H: number,
) {
  const cx = W * 0.5;
  const cy = H * 0.5;
  const t = effect.time * genes.speed;
  const sym = genes.symmetry;
  const twist = genes.twist;
  const xEnd = x0 + W;
  const yEnd = y0 + H;
  const maxDim = Math.max(W, H);
  for (let py = y0; py < yEnd; py += PIXEL_STEP) {
    const dy = (py - y0) - cy;
    const pyNext = Math.min(yEnd, py + PIXEL_STEP);
    for (let px = x0; px < xEnd; px += PIXEL_STEP) {
      const dx = (px - x0) - cx;
      const r = Math.sqrt(dx * dx + dy * dy) / maxDim;
      const theta = Math.atan2(dy, dx);
      const phase = theta * sym + r * twist + t * 0.6;
      const ringWave = Math.sin(r * 22 - t * 1.3) * 0.5 + 0.5;
      const angularWave = Math.sin(phase) * 0.5 + 0.5;
      const v = ringWave * 0.55 + angularWave * 0.45;
      paintBlock(write, px, py, Math.min(xEnd, px + PIXEL_STEP), pyNext, palette, paletteIndex(v));
    }
  }
}

function paintWaves(
  effect: any,
  write: PixelWriter,
  palette: Uint8Array,
  genes: FingerprintGenes,
  x0: number,
  y0: number,
  W: number,
  H: number,
) {
  const t = effect.time * genes.speed;
  const sources = Math.max(2, Math.min(12, Math.floor(genes.density / 2)));
  const sx = new Float32Array(sources);
  const sy = new Float32Array(sources);
  const sf = new Float32Array(sources);
  const sp = new Float32Array(sources);
  for (let i = 0; i < sources; i++) {
    const v = genes.voices[i % genes.voices.length];
    sx[i] = ((v >>> 0) & 0xff) / 255 * W;
    sy[i] = ((v >>> 8) & 0xff) / 255 * H;
    sf[i] = 0.04 + ((v >>> 16) & 0xff) / 255 * 0.16;
    sp[i] = ((v >>> 24) & 0xff) / 255 * Math.PI * 2;
  }
  const xEnd = x0 + W;
  const yEnd = y0 + H;
  const invSources = 1 / sources;
  for (let py = y0; py < yEnd; py += PIXEL_STEP) {
    const ly = py - y0;
    const pyNext = Math.min(yEnd, py + PIXEL_STEP);
    for (let px = x0; px < xEnd; px += PIXEL_STEP) {
      const lx = px - x0;
      let acc = 0;
      for (let i = 0; i < sources; i++) {
        const dx = lx - sx[i];
        const dy = ly - sy[i];
        const d = Math.sqrt(dx * dx + dy * dy);
        acc += Math.sin(d * sf[i] + t + sp[i]);
      }
      const v = acc * invSources * 0.5 + 0.5;
      paintBlock(write, px, py, Math.min(xEnd, px + PIXEL_STEP), pyNext, palette, paletteIndex(v));
    }
  }
}

function paintLattice(
  effect: any,
  write: PixelWriter,
  palette: Uint8Array,
  genes: FingerprintGenes,
  x0: number,
  y0: number,
  W: number,
  H: number,
) {
  const cellSize = Math.max(4, Math.floor(Math.min(W, H) / Math.max(4, genes.density)));
  const t = effect.time * genes.speed;
  const xEnd = x0 + W;
  const yEnd = y0 + H;
  for (let cy = 0; cy < H; cy += cellSize) {
    for (let cx = 0; cx < W; cx += cellSize) {
      const fx = cx / cellSize;
      const fy = cy / cellSize;
      const a = effect.noise2(fx * 0.5 + t * 0.3, fy * 0.5 - t * 0.2);
      const b = effect.noise2(fx * 0.9 - t * 0.4, fy * 0.9 + t * 0.6 + 100);
      const v = (a * 0.6 + b * 0.4 + 1) * 0.5;
      const voice = genes.voices[((cx ^ cy ^ Math.floor(t * 0.5)) >>> 0) % genes.voices.length];
      const hueShift = ((voice & 0xff) / 255) * 0.3;
      const t01 = (v + hueShift) % 1;
      const px0 = x0 + cx;
      const py0 = y0 + cy;
      paintBlock(
        write,
        px0,
        py0,
        Math.min(xEnd, px0 + cellSize - 1),
        Math.min(yEnd, py0 + cellSize - 1),
        palette,
        paletteIndex(t01),
      );
    }
  }
}

function paintStreams(
  effect: any,
  write: PixelWriter,
  palette: Uint8Array,
  genes: FingerprintGenes,
  x0: number,
  y0: number,
  W: number,
  H: number,
) {
  const t = effect.time * genes.speed;
  const horizontal = genes.symmetry % 2 === 0;
  const sa = genes.scaleA * 1.5;
  const detail = genes.detail;
  const xEnd = x0 + W;
  const yEnd = y0 + H;
  for (let py = y0; py < yEnd; py += PIXEL_STEP) {
    const ly = py - y0;
    const pyNext = Math.min(yEnd, py + PIXEL_STEP);
    for (let px = x0; px < xEnd; px += PIXEL_STEP) {
      const lx = px - x0;
      const u = horizontal ? lx : ly;
      const v = horizontal ? ly : lx;
      const warp = effect.fbm(u * sa, v * sa * 0.4 + t * 0.5, detail) * genes.warp * 60;
      const stream = ((v + warp) / 12) | 0;
      const voice = genes.voices[(stream >>> 0) % genes.voices.length];
      const huePos = ((voice & 0xff) / 255);
      const intensity = 0.4 + 0.6 * (Math.sin(stream * 0.7 + t * 1.3) * 0.5 + 0.5);
      const t01 = ((huePos * 0.6 + intensity * 0.4) % 1 + 1) % 1;
      paintBlock(write, px, py, Math.min(xEnd, px + PIXEL_STEP), pyNext, palette, paletteIndex(t01));
    }
  }
}

function paintSpiral(
  effect: any,
  write: PixelWriter,
  palette: Uint8Array,
  genes: FingerprintGenes,
  x0: number,
  y0: number,
  W: number,
  H: number,
) {
  const cx = W * 0.5;
  const cy = H * 0.5;
  const t = effect.time * genes.speed;
  const arms = genes.symmetry;
  const twist = genes.twist;
  const xEnd = x0 + W;
  const yEnd = y0 + H;
  const maxDim = Math.max(W, H);
  for (let py = y0; py < yEnd; py += PIXEL_STEP) {
    const dy = (py - y0) - cy;
    const pyNext = Math.min(yEnd, py + PIXEL_STEP);
    for (let px = x0; px < xEnd; px += PIXEL_STEP) {
      const dx = (px - x0) - cx;
      const r = Math.sqrt(dx * dx + dy * dy) / maxDim;
      const theta = Math.atan2(dy, dx);
      const spiral = theta * arms + Math.log(Math.max(0.005, r)) * twist - t * 1.4;
      const wave = Math.sin(spiral * 2) * 0.5 + 0.5;
      const fade = Math.max(0.05, 1 - r * 1.4);
      const v = wave * fade;
      paintBlock(write, px, py, Math.min(xEnd, px + PIXEL_STEP), pyNext, palette, paletteIndex(v));
    }
  }
}

function paintReaction(
  effect: any,
  write: PixelWriter,
  palette: Uint8Array,
  genes: FingerprintGenes,
  x0: number,
  y0: number,
  W: number,
  H: number,
) {
  const t = effect.time * genes.speed;
  const sa = genes.scaleA;
  const sb = genes.scaleB * 2.5;
  const tA = genes.threshA * 0.6 - 0.1;
  const tB = genes.threshB * 0.6 - 0.1;
  const xEnd = x0 + W;
  const yEnd = y0 + H;
  for (let py = y0; py < yEnd; py += PIXEL_STEP) {
    const ly = py - y0;
    const pyNext = Math.min(yEnd, py + PIXEL_STEP);
    for (let px = x0; px < xEnd; px += PIXEL_STEP) {
      const lx = px - x0;
      const a = effect.noise3(lx * sa, ly * sa, t * 0.2);
      const b = effect.noise3(lx * sb + 100, ly * sb - 100, t * 0.35 + 50);
      let v;
      if (a > tA && b > tB) v = 0.92;
      else if (a > tA) v = 0.6;
      else if (b > tB) v = 0.4;
      else v = 0.12;
      paintBlock(write, px, py, Math.min(xEnd, px + PIXEL_STEP), pyNext, palette, paletteIndex(v));
    }
  }
}

const ENGINE_PAINTERS: readonly Painter[] = [
  paintPlasma,
  paintVoronoi,
  paintMandala,
  paintWaves,
  paintLattice,
  paintStreams,
  paintSpiral,
  paintReaction,
];

function paintBackground(effect: any, genes: FingerprintGenes) {
  const rgb = effect.hsv(genes.bgHue, 0.4, genes.bgValue);
  effect.clearColor(rgb[0], rgb[1], rgb[2], 1);
}

function drawSingleEffect(effect: any, genes: FingerprintGenes) {
  const W = effect.width | 0;
  const H = effect.height | 0;
  paintBackground(effect, genes);
  const palette = buildPalette(effect, genes);
  ENGINE_PAINTERS[genes.engineId](effect, effect.setPixelRaw, palette, genes, 0, 0, W, H);
}

function drawGridEffects(
  effect: any,
  files: readonly AstFingerprintFile[],
  genesList: readonly FingerprintGenes[],
  gridSide: number,
) {
  effect.clearColor(0.01, 0.02, 0.04, 1);
  if (files.length === 0) return;
  const W = effect.width | 0;
  const H = effect.height | 0;
  const tileSize = Math.floor(Math.min(W, H) / gridSide);
  if (tileSize <= 0) return;
  const totalGrid = tileSize * gridSide;
  const offsetX = Math.floor((W - totalGrid) * 0.5);
  const offsetY = Math.floor((H - totalGrid) * 0.5);
  const write: PixelWriter = effect.setPixelRaw;
  const cells = gridSide * gridSide;
  for (let index = 0; index < cells; index++) {
    const col = index % gridSide;
    const row = (index / gridSide) | 0;
    const tileX = offsetX + col * tileSize;
    const tileY = offsetY + row * tileSize;
    const file = files[index % files.length];
    const genes = genesList[index % genesList.length];
    if (!file || !genes) continue;
    const palette = buildPalette(effect, genes);
    ENGINE_PAINTERS[genes.engineId](effect, write, palette, genes, tileX, tileY, tileSize - 1, tileSize - 1);
  }
}

function useGenesForFile(file: AstFingerprintInputFile | null) {
  const ref = useRef<{
    source: AstFingerprintInputFile | null;
    file: AstFingerprintFile | null;
    genes: FingerprintGenes | null;
  } | null>(null);
  if (!ref.current || ref.current.source !== file) {
    if (file && file.count > 0) {
      const prepared = prepareAstFingerprintFile(file);
      ref.current = { source: file, file: prepared, genes: extractFingerprintGenes(prepared) };
    } else {
      ref.current = { source: file, file: null, genes: null };
    }
  }
  return ref.current;
}

function useGenesForFiles(files: readonly AstFingerprintInputFile[]) {
  const ref = useRef<{
    source: readonly AstFingerprintInputFile[] | null;
    files: AstFingerprintFile[];
    genes: FingerprintGenes[];
  } | null>(null);
  if (!ref.current || ref.current.source !== files) {
    const prepared: AstFingerprintFile[] = [];
    const genes: FingerprintGenes[] = [];
    for (let index = 0; index < files.length; index++) {
      const f = files[index];
      if (!f || f.count <= 0) continue;
      const p = prepareAstFingerprintFile(f);
      prepared.push(p);
      genes.push(extractFingerprintGenes(p));
    }
    ref.current = { source: files, files: prepared, genes };
  }
  return ref.current;
}

function EffectFrame({ frameSize, effectSize, children }: { frameSize: number; effectSize: number; children?: any }) {
  return (
    <Box style={{ width: frameSize, height: frameSize, alignItems: 'center', justifyContent: 'center' }}>
      <Box style={{ width: effectSize, height: effectSize }}>{children}</Box>
    </Box>
  );
}

export type AstFingerprintEffectProps = {
  file?: AstFingerprintInputFile;
};

export function AstFingerprintEffect({ file }: AstFingerprintEffectProps) {
  const source = file ?? AST_SAMPLE_FILES[3];
  const cached = useGenesForFile(source);
  return (
    <EffectFrame frameSize={FRAME_SIZE} effectSize={EFFECT_SIZE}>
      {cached.file && cached.genes ? (
        <Effect
          onRender={(effect: any) => drawSingleEffect(effect, cached.genes!)}
          style={{ width: EFFECT_SIZE, height: EFFECT_SIZE }}
        />
      ) : null}
    </EffectFrame>
  );
}

export type AstFingerprintEffectGridProps = {
  files?: readonly AstFingerprintInputFile[];
  gridSide?: number;
};

export function AstFingerprintEffectGrid({ files, gridSide = 4 }: AstFingerprintEffectGridProps) {
  const source = files ?? AST_SAMPLE_FILES;
  const cached = useGenesForFiles(source);
  const safeGrid = Math.max(1, Math.min(8, gridSide | 0));
  return (
    <EffectFrame frameSize={QUILT_FRAME_SIZE} effectSize={QUILT_EFFECT_SIZE}>
      {cached.files.length > 0 ? (
        <Effect
          onRender={(effect: any) => drawGridEffects(effect, cached.files, cached.genes, safeGrid)}
          style={{ width: QUILT_EFFECT_SIZE, height: QUILT_EFFECT_SIZE }}
        />
      ) : null}
    </EffectFrame>
  );
}

export const drawFingerprintEffect = drawSingleEffect;
export const drawFingerprintEffectGrid = drawGridEffects;
export { useGenesForFile as useFingerprintGenes };
