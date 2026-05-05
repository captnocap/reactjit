import { useRef } from 'react';
import { Box, Effect } from '@reactjit/runtime/primitives';
import { parseGalleryColor } from '../../theme-color';
import { AST_SAMPLE_FILES } from './sampleContract';

export type AstContractNodeArrays = {
  kind: number[];
  start: number[];
  end: number[];
  children: Array<number[] | 0>;
};

export type AstContractFile = {
  path: string;
  root: number;
  count: number;
  nodes: AstContractNodeArrays;
  tagColor?: string;
  selected?: boolean;
};

export type AstFingerprintFile = {
  path: string;
  root: number;
  count: number;
  kind: number[];
  start: number[];
  end: number[];
  firstChild: number[];
  nextSibling: number[];
  maxEnd: number;
  tagColor?: string;
  selected?: boolean;
};

export type AstFingerprintInputFile = AstContractFile | AstFingerprintFile;
export type FingerprintContractNodeArrays = AstContractNodeArrays;
export type FingerprintContractFile = AstContractFile;
export type FingerprintPreparedFile = AstFingerprintFile;
export type FingerprintInputFile = AstFingerprintInputFile;

export type AstQuiltProps = {
  files?: readonly AstFingerprintInputFile[];
  gridSide?: number;
};

export type AstFingerprintRenderMode = 'treemap' | 'binary-squares';

export type AstTileProps = {
  file?: AstFingerprintInputFile;
  files?: readonly AstFingerprintInputFile[];
  tileIndex?: number;
};

const DEFAULT_GRID_SIDE = 12;
const DEFAULT_TILE_INDEX = 0;
const FRAME_SIZE = 648;
const EFFECT_SIZE = 620;
const TILE_FRAME_SIZE = 360;
const TILE_EFFECT_SIZE = 332;
const TILE_GAP = 4;
const DEFAULT_SAMPLE_SET: readonly AstContractFile[] = AST_SAMPLE_FILES;
const BINARY_LINE_KIND_NAMES = [
  'line.blank',
  'line.comment',
  'line.import',
  'line.export',
  'line.type',
  'line.callable',
  'line.control',
  'line.flow',
  'line.list',
  'line.heading',
  'line.assignment',
  'line.body',
] as const;

type PixelWriter = (x: number, y: number, r: number, g: number, b: number, a: number) => void;
type Rgb = { r: number; g: number; b: number };
type BinaryLineCandidate = {
  index: number;
  start: number;
  end: number;
  length: number;
  kindId: number;
  depth: number;
};
type BinarySquareRecord = BinaryLineCandidate & {
  size: number;
  x: number;
  y: number;
  rowWidth: number;
  rowHeight: number;
  seed: number;
};
type BinarySquareLayout = {
  records: BinarySquareRecord[];
  virtualHeight: number;
};

const BINARY_LINE_KIND_IDS = new Set<number>(BINARY_LINE_KIND_NAMES.map(hashLabel));
const BINARY_LAYOUT_CACHE = new Map<string, BinarySquareLayout>();

function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

function isPreparedFile(file: AstFingerprintInputFile): file is AstFingerprintFile {
  return Array.isArray((file as AstFingerprintFile).firstChild) && Array.isArray((file as AstFingerprintFile).nextSibling);
}

function parseHexColor(color?: string): Rgb | null {
  const rgb = parseGalleryColor(color);
  return rgb ? { r: rgb[0], g: rgb[1], b: rgb[2] } : null;
}

function hashLabel(label: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < label.length; index++) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash === 0 ? 1 : hash;
}

function mix32(value: number): number {
  let out = value >>> 0;
  out ^= out >>> 16;
  out = Math.imul(out, 0x7feb352d) >>> 0;
  out ^= out >>> 15;
  out = Math.imul(out, 0x846ca68b) >>> 0;
  out ^= out >>> 16;
  return out >>> 0;
}

export function prepareAstFingerprintFile(input: AstFingerprintInputFile): AstFingerprintFile {
  if (isPreparedFile(input)) return input;

  const firstChild = new Array<number>(input.count).fill(0);
  const nextSibling = new Array<number>(input.count).fill(0);
  const children = input.nodes.children;

  for (let index = 0; index < input.count; index++) {
    const childList = children[index];
    if (!Array.isArray(childList) || childList.length === 0) continue;
    firstChild[index] = childList[0];
    for (let childIndex = 0; childIndex < childList.length - 1; childIndex++) {
      const current = childList[childIndex] - 1;
      if (current >= 0 && current < nextSibling.length) nextSibling[current] = childList[childIndex + 1];
    }
  }

  let maxEnd = 0;
  for (let index = 0; index < input.nodes.end.length; index++) {
    const end = input.nodes.end[index] || 0;
    if (end > maxEnd) maxEnd = end;
  }

  return {
    path: input.path,
    root: input.root,
    count: input.count,
    kind: input.nodes.kind,
    start: input.nodes.start,
    end: input.nodes.end,
    firstChild,
    nextSibling,
    maxEnd,
    tagColor: input.tagColor,
    selected: input.selected,
  };
}

export function prepareAstFingerprintFiles(inputs: readonly AstFingerprintInputFile[]): AstFingerprintFile[] {
  const prepared: AstFingerprintFile[] = [];
  for (let index = 0; index < inputs.length; index++) {
    const file = inputs[index];
    if (!file || file.count <= 0) continue;
    prepared.push(prepareAstFingerprintFile(file));
  }
  return prepared;
}

function usePreparedFiles(inputs?: readonly AstFingerprintInputFile[]): AstFingerprintFile[] {
  const source = inputs ?? DEFAULT_SAMPLE_SET;
  const ref = useRef<{ source: readonly AstFingerprintInputFile[]; prepared: AstFingerprintFile[] } | null>(null);
  if (!ref.current || ref.current.source !== source) {
    ref.current = { source, prepared: prepareAstFingerprintFiles(source) };
  }
  return ref.current.prepared;
}

function usePreparedFile(input?: AstFingerprintInputFile): AstFingerprintFile | null {
  const source = input ?? null;
  const ref = useRef<{ source: AstFingerprintInputFile | null; prepared: AstFingerprintFile | null } | null>(null);
  if (!ref.current || ref.current.source !== source) {
    ref.current = { source, prepared: source ? prepareAstFingerprintFile(source) : null };
  }
  return ref.current.prepared;
}

function fillRect(
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a: number,
) {
  const x0 = clamp(x | 0, 0, maxWidth);
  const y0 = clamp(y | 0, 0, maxHeight);
  const x1 = clamp((x + w) | 0, 0, maxWidth);
  const y1 = clamp((y + h) | 0, 0, maxHeight);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) write(px, py, r, g, b, a);
  }
}

function fillBounds(
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
  a: number,
) {
  const ix0 = clamp(Math.floor(Math.min(x0, x1)), 0, maxWidth);
  const iy0 = clamp(Math.floor(Math.min(y0, y1)), 0, maxHeight);
  const ix1 = clamp(Math.ceil(Math.max(x0, x1)), 0, maxWidth);
  const iy1 = clamp(Math.ceil(Math.max(y0, y1)), 0, maxHeight);
  for (let py = iy0; py < iy1; py++) {
    for (let px = ix0; px < ix1; px++) write(px, py, r, g, b, a);
  }
}

function strokeRect(
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a: number,
) {
  const x0 = clamp(x | 0, 0, maxWidth - 1);
  const y0 = clamp(y | 0, 0, maxHeight - 1);
  const x1 = clamp((x + w - 1) | 0, 0, maxWidth - 1);
  const y1 = clamp((y + h - 1) | 0, 0, maxHeight - 1);
  if (x1 <= x0 || y1 <= y0) return;
  for (let px = x0; px <= x1; px++) {
    write(px, y0, r, g, b, a);
    write(px, y1, r, g, b, a);
  }
  for (let py = y0 + 1; py < y1; py++) {
    write(x0, py, r, g, b, a);
    write(x1, py, r, g, b, a);
  }
}

function colorFor(effect: any, kindId: number, depth: number, time: number, inScan: boolean): Rgb {
  let hue = ((kindId * 137) % 360) + time * 22 + depth * 7;
  if (inScan) hue += 55;

  const wave = Math.sin(time * 2.2 - depth * 0.55);
  let value = 0.62 + 0.18 * wave;
  let saturation = 0.55;
  if (inScan) {
    value = Math.min(1, value + 0.25);
    saturation = 0.78;
  }

  const rgb = effect.hsv((((hue % 360) + 360) % 360) / 360, saturation, value);
  return {
    r: (rgb[0] * 255) | 0,
    g: (rgb[1] * 255) | 0,
    b: (rgb[2] * 255) | 0,
  };
}

function drawFingerprintNode(
  effect: any,
  write: PixelWriter,
  file: AstFingerprintFile,
  node: number,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  time: number,
  scanPos: number,
  maxWidth: number,
  maxHeight: number,
) {
  if (w < 1 || h < 1 || node === 0) return;

  const index = node - 1;
  const nodeStart = file.start[index] || 0;
  const nodeEnd = file.end[index] || 0;
  const inScan = scanPos >= nodeStart && scanPos < nodeEnd;
  const rgb = colorFor(effect, file.kind[index] || 0, depth, time, inScan);

  fillRect(write, maxWidth, maxHeight, x, y, w, h, rgb.r, rgb.g, rgb.b, 255);

  if (w >= 3 && h >= 3) {
    const outline = inScan ? 240 : 18;
    strokeRect(write, maxWidth, maxHeight, x, y, w, h, outline, outline, outline, 255);
  }

  const firstChild = file.firstChild[index] || 0;
  if (firstChild === 0) return;

  let total = 0;
  let child = firstChild;
  while (child !== 0) {
    const childIndex = child - 1;
    const span = Math.max(1, (file.end[childIndex] || 0) - (file.start[childIndex] || 0));
    total += span;
    child = file.nextSibling[childIndex] || 0;
  }
  if (total === 0) return;

  const horizontal = depth % 2 === 0;
  const pad = w > 24 && h > 24 ? 1 : 0;
  const innerX = x + pad;
  const innerY = y + pad;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  if (horizontal) {
    let cursorX = innerX;
    child = firstChild;
    while (child !== 0) {
      const childIndex = child - 1;
      const span = Math.max(1, (file.end[childIndex] || 0) - (file.start[childIndex] || 0));
      const childWidth = innerW * (span / total);
      drawFingerprintNode(
        effect,
        write,
        file,
        child,
        cursorX,
        innerY,
        childWidth,
        innerH,
        depth + 1,
        time,
        scanPos,
        maxWidth,
        maxHeight,
      );
      cursorX += childWidth;
      child = file.nextSibling[childIndex] || 0;
    }
    return;
  }

  let cursorY = innerY;
  child = firstChild;
  while (child !== 0) {
    const childIndex = child - 1;
    const span = Math.max(1, (file.end[childIndex] || 0) - (file.start[childIndex] || 0));
    const childHeight = innerH * (span / total);
    drawFingerprintNode(
      effect,
      write,
      file,
      child,
      innerX,
      cursorY,
      innerW,
      childHeight,
      depth + 1,
      time,
      scanPos,
      maxWidth,
      maxHeight,
    );
    cursorY += childHeight;
    child = file.nextSibling[childIndex] || 0;
  }
}

function drawTileDecoration(
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  tileX: number,
  tileY: number,
  tileSize: number,
  file: AstFingerprintFile,
) {
  const accent = parseHexColor(file.tagColor);
  if (accent) {
    strokeRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, accent.r, accent.g, accent.b, 255);
    fillRect(write, maxWidth, maxHeight, tileX + 3, tileY + 3, 7, 7, accent.r, accent.g, accent.b, 255);
  }
  if (file.selected) {
    strokeRect(write, maxWidth, maxHeight, tileX + 1, tileY + 1, tileSize - 2, tileSize - 2, 245, 250, 255, 255);
  }
}

function drawFingerprintTile(
  effect: any,
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  file: AstFingerprintFile,
  tileIndex: number,
  tileX: number,
  tileY: number,
  tileSize: number,
  now: number,
) {
  const time = now + tileIndex * 0.31;
  const triangle = Math.abs(((time * 0.35) % 2 + 2) % 2 - 1);
  const scanPos = (1 - triangle) * file.maxEnd;

  fillRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, 5, 10, 16, 255);
  strokeRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, 16, 28, 40, 255);
  drawFingerprintNode(effect, write, file, file.root, tileX, tileY, tileSize, tileSize, 0, time, scanPos, maxWidth, maxHeight);
  drawTileDecoration(write, maxWidth, maxHeight, tileX, tileY, tileSize, file);
}

function squareSizeForLength(length: number, averageLength: number): number {
  const ratio = length / Math.max(1, averageLength);
  if (ratio < 0.28) return 1;
  if (ratio < 0.45) return 2;
  if (ratio < 0.65) return 3;
  if (ratio < 0.85) return 4;
  if (ratio < 1.1) return 5;
  if (ratio < 1.4) return 6;
  if (ratio < 1.8) return 7;
  if (ratio < 2.4) return 8;
  return 9;
}

function maxBinaryRecordsForTile(tileSize: number): number {
  return clamp(Math.floor((tileSize * tileSize) / 96), 28, 260);
}

function pushBinaryCandidates(
  file: AstFingerprintFile,
  node: number,
  depth: number,
  lineCandidates: BinaryLineCandidate[],
  leafCandidates: BinaryLineCandidate[],
) {
  if (node === 0) return;
  const index = node - 1;
  if (index < 0 || index >= file.count) return;

  const start = Math.max(0, file.start[index] || 0);
  const end = Math.max(start + 1, file.end[index] || start + 1);
  const kindId = file.kind[index] || 0;
  const firstChild = file.firstChild[index] || 0;
  const candidate: BinaryLineCandidate = {
    index,
    start,
    end,
    length: Math.max(1, end - start),
    kindId,
    depth,
  };

  if (BINARY_LINE_KIND_IDS.has(kindId)) lineCandidates.push(candidate);
  if (node !== file.root && firstChild === 0) leafCandidates.push(candidate);

  let child = firstChild;
  while (child !== 0) {
    const childIndex = child - 1;
    pushBinaryCandidates(file, child, depth + 1, lineCandidates, leafCandidates);
    child = file.nextSibling[childIndex] || 0;
  }
}

function collectBinaryLineCandidates(file: AstFingerprintFile): BinaryLineCandidate[] {
  const lineCandidates: BinaryLineCandidate[] = [];
  const leafCandidates: BinaryLineCandidate[] = [];
  pushBinaryCandidates(file, file.root, 0, lineCandidates, leafCandidates);
  if (lineCandidates.length >= 4) return lineCandidates;
  if (leafCandidates.length > 0) return leafCandidates;
  return [
    {
      index: Math.max(0, file.root - 1),
      start: 0,
      end: Math.max(1, file.maxEnd),
      length: Math.max(1, file.maxEnd),
      kindId: file.kind[Math.max(0, file.root - 1)] || 0,
      depth: 0,
    },
  ];
}

function sampleBinaryCandidates(candidates: BinaryLineCandidate[], maxRecords: number): BinaryLineCandidate[] {
  if (candidates.length <= maxRecords) return candidates;
  const sampled: BinaryLineCandidate[] = [];
  const step = candidates.length / maxRecords;
  for (let index = 0; index < maxRecords; index++) {
    sampled.push(candidates[Math.floor(index * step)]);
  }
  return sampled;
}

function binaryLayoutCacheKey(file: AstFingerprintFile, tileSize: number): string {
  return `${file.path}:${file.count}:${file.root}:${file.maxEnd}:${tileSize | 0}`;
}

function buildBinarySquareLayout(file: AstFingerprintFile, tileSize: number): BinarySquareLayout {
  const key = binaryLayoutCacheKey(file, tileSize);
  const cached = BINARY_LAYOUT_CACHE.get(key);
  if (cached) return cached;

  const candidates = collectBinaryLineCandidates(file);
  let totalLength = 0;
  for (let index = 0; index < candidates.length; index++) totalLength += candidates[index].length;
  const averageLength = totalLength / Math.max(1, candidates.length);
  const sampled = sampleBinaryCandidates(candidates, maxBinaryRecordsForTile(tileSize));
  const records: BinarySquareRecord[] = [];
  let totalArea = 0;

  for (let index = 0; index < sampled.length; index++) {
    const candidate = sampled[index];
    const size = squareSizeForLength(candidate.length, averageLength);
    totalArea += size * size;
    records.push({
      ...candidate,
      size,
      x: 0,
      y: 0,
      rowWidth: 1,
      rowHeight: 1,
      seed: mix32(candidate.kindId ^ Math.imul(candidate.start + 1, 0x45d9f3b) ^ Math.imul(candidate.end + 1, 0x119de1f3)),
    });
  }

  const targetWidth = Math.max(10, Math.ceil(Math.sqrt(Math.max(1, totalArea)) * 1.05));
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let rowStart = 0;

  function finalizeRow(endIndex: number) {
    if (endIndex <= rowStart) return;
    const rowWidth = Math.max(1, cursorX);
    const safeRowHeight = Math.max(1, rowHeight);
    for (let index = rowStart; index < endIndex; index++) {
      records[index].rowWidth = rowWidth;
      records[index].rowHeight = safeRowHeight;
      records[index].y = cursorY;
    }
    cursorY += safeRowHeight;
    cursorX = 0;
    rowHeight = 0;
    rowStart = endIndex;
  }

  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (cursorX > 0 && cursorX + record.size > targetWidth) finalizeRow(index);

    record.x = cursorX;
    cursorX += record.size;
    rowHeight = Math.max(rowHeight, record.size);
  }
  finalizeRow(records.length);

  const layout = {
    records,
    virtualHeight: Math.max(1, cursorY),
  };

  BINARY_LAYOUT_CACHE.set(key, layout);
  return layout;
}

function drawBinarySquareRecord(
  effect: any,
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  record: BinarySquareRecord,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  loopPhase: number,
) {
  const size = record.size;
  const hue = (record.kindId * 47 + record.depth * 19 + record.index * 3) % 360;
  const rgb = effect.hsv((((hue % 360) + 360) % 360) / 360, 0.58, 0.74);
  const onR = (rgb[0] * 255) | 0;
  const onG = (rgb[1] * 255) | 0;
  const onB = (rgb[2] * 255) | 0;
  const offR = Math.max(8, (onR * 0.13) | 0);
  const offG = Math.max(11, (onG * 0.13) | 0);
  const offB = Math.max(15, (onB * 0.13) | 0);

  fillBounds(write, maxWidth, maxHeight, x0, y0, x1, y1, 3, 7, 12, 255);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const bitSeed = mix32(record.seed ^ Math.imul(col + 1, 0x27d4eb2d) ^ Math.imul(row + 1, 0x165667b1));
      const on = size === 1 || ((bitSeed >>> ((col + row) & 7)) & 1) === 1;
      const px0 = x0 + ((x1 - x0) * col) / size;
      const px1 = x0 + ((x1 - x0) * (col + 1)) / size;
      const py0 = y0 + ((y1 - y0) * row) / size;
      const py1 = y0 + ((y1 - y0) * (row + 1)) / size;
      if (on) {
        fillBounds(write, maxWidth, maxHeight, px0, py0, px1, py1, onR, onG, onB, 255);
      } else {
        fillBounds(write, maxWidth, maxHeight, px0, py0, px1, py1, offR, offG, offB, 255);
      }
    }
  }

  if (Math.min(x1 - x0, y1 - y0) >= 12 && size >= 4) {
    strokeRect(write, maxWidth, maxHeight, x0, y0, x1 - x0, y1 - y0, 34, 34, 34, 255);
  }

  drawBinarySquareLoop(write, maxWidth, maxHeight, x0, y0, x1, y1, loopPhase, onR, onG, onB);
}

function drawBinarySquareLoop(
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  phase: number,
  r: number,
  g: number,
  b: number,
) {
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 3 || h < 3) return;

  const thickness = clamp(Math.min(w, h) * 0.08, 1, 4);
  const marker = clamp(Math.min(w, h) * 0.34, 3, Math.max(4, Math.max(w, h) * 0.5));
  const perimeter = Math.max(1, (w + h) * 2);
  const pos = (((phase % 1) + 1) % 1) * perimeter;
  const rr = Math.min(255, r + 52);
  const gg = Math.min(255, g + 52);
  const bb = Math.min(255, b + 52);

  if (pos < w) {
    const x = x0 + pos;
    fillBounds(write, maxWidth, maxHeight, x - marker * 0.5, y0, x + marker * 0.5, y0 + thickness, rr, gg, bb, 255);
    return;
  }

  if (pos < w + h) {
    const y = y0 + pos - w;
    fillBounds(write, maxWidth, maxHeight, x1 - thickness, y - marker * 0.5, x1, y + marker * 0.5, rr, gg, bb, 255);
    return;
  }

  if (pos < w * 2 + h) {
    const x = x1 - (pos - w - h);
    fillBounds(write, maxWidth, maxHeight, x - marker * 0.5, y1 - thickness, x + marker * 0.5, y1, rr, gg, bb, 255);
    return;
  }

  const y = y1 - (pos - w * 2 - h);
  fillBounds(write, maxWidth, maxHeight, x0, y - marker * 0.5, x0 + thickness, y + marker * 0.5, rr, gg, bb, 255);
}

function drawBinarySquaresTile(
  effect: any,
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  file: AstFingerprintFile,
  tileIndex: number,
  tileX: number,
  tileY: number,
  tileSize: number,
  now: number,
) {
  const time = now + tileIndex * 0.17;
  const layout = buildBinarySquareLayout(file, tileSize);
  const pad = tileSize >= 96 ? 1 : 0;
  const innerSize = Math.max(1, tileSize - pad * 2);
  const offsetX = tileX + pad;
  const offsetY = tileY + pad;

  fillRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, 3, 8, 13, 255);
  strokeRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, 19, 33, 46, 255);

  for (let index = 0; index < layout.records.length; index++) {
    const record = layout.records[index];
    const rowWidth = Math.max(1, record.rowWidth);
    const recordX0 = offsetX + (record.x / rowWidth) * innerSize;
    const recordX1 = offsetX + ((record.x + record.size) / rowWidth) * innerSize;
    const recordY0 = offsetY + (record.y / layout.virtualHeight) * innerSize;
    const recordY1 = offsetY + ((record.y + record.rowHeight) / layout.virtualHeight) * innerSize;
    const phaseSeed = (record.seed & 0xffff) / 0x10000;
    const loopPhase = time * (0.16 + record.size * 0.018) + phaseSeed;
    drawBinarySquareRecord(
      effect,
      write,
      maxWidth,
      maxHeight,
      record,
      recordX0,
      recordY0,
      recordX1,
      recordY1,
      loopPhase,
    );
  }

  drawTileDecoration(write, maxWidth, maxHeight, tileX, tileY, tileSize, file);
}

function drawAstQuilt(effect: any, files: readonly AstFingerprintFile[], gridSide: number) {
  effect.clearColor(2 / 255, 5 / 255, 10 / 255, 1);
  if (files.length === 0) return;

  const write: PixelWriter = effect.setPixelRaw;
  const width = effect.width | 0;
  const height = effect.height | 0;
  const tileSize = Math.floor((Math.min(width, height) - TILE_GAP * (gridSide - 1)) / gridSide);
  const totalGrid = tileSize * gridSide + TILE_GAP * (gridSide - 1);
  const offsetX = Math.floor((width - totalGrid) * 0.5);
  const offsetY = Math.floor((height - totalGrid) * 0.5);

  for (let index = 0; index < gridSide * gridSide; index++) {
    const col = index % gridSide;
    const row = (index / gridSide) | 0;
    const tileX = offsetX + col * (tileSize + TILE_GAP);
    const tileY = offsetY + row * (tileSize + TILE_GAP);
    const file = files[index % files.length];
    drawFingerprintTile(effect, write, width, height, file, index, tileX, tileY, tileSize, effect.time);
  }
}

function drawAstBinarySquares(effect: any, files: readonly AstFingerprintFile[], gridSide: number) {
  effect.clearColor(2 / 255, 5 / 255, 10 / 255, 1);
  if (files.length === 0) return;

  const write: PixelWriter = effect.setPixelRaw;
  const width = effect.width | 0;
  const height = effect.height | 0;
  const tileSize = Math.floor((Math.min(width, height) - TILE_GAP * (gridSide - 1)) / gridSide);
  const totalGrid = tileSize * gridSide + TILE_GAP * (gridSide - 1);
  const offsetX = Math.floor((width - totalGrid) * 0.5);
  const offsetY = Math.floor((height - totalGrid) * 0.5);

  for (let index = 0; index < gridSide * gridSide; index++) {
    const col = index % gridSide;
    const row = (index / gridSide) | 0;
    const tileX = offsetX + col * (tileSize + TILE_GAP);
    const tileY = offsetY + row * (tileSize + TILE_GAP);
    const file = files[index % files.length];
    drawBinarySquaresTile(effect, write, width, height, file, index, tileX, tileY, tileSize, effect.time);
  }
}

function drawAstTile(effect: any, file: AstFingerprintFile, tileIndex: number) {
  effect.clearColor(2 / 255, 5 / 255, 10 / 255, 1);

  const write: PixelWriter = effect.setPixelRaw;
  const width = effect.width | 0;
  const height = effect.height | 0;
  const size = Math.min(width, height);
  const tileX = Math.floor((width - size) * 0.5);
  const tileY = Math.floor((height - size) * 0.5);
  drawFingerprintTile(effect, write, width, height, file, tileIndex, tileX, tileY, size, effect.time);
}

function drawAstBinaryTile(effect: any, file: AstFingerprintFile, tileIndex: number) {
  effect.clearColor(2 / 255, 5 / 255, 10 / 255, 1);

  const write: PixelWriter = effect.setPixelRaw;
  const width = effect.width | 0;
  const height = effect.height | 0;
  const size = Math.min(width, height);
  const tileX = Math.floor((width - size) * 0.5);
  const tileY = Math.floor((height - size) * 0.5);
  drawBinarySquaresTile(effect, write, width, height, file, tileIndex, tileX, tileY, size, effect.time);
}

function AstFrame({
  frameSize,
  effectSize,
  children,
}: {
  frameSize: number;
  effectSize: number;
  children?: any;
}) {
  return (
    <Box
      style={{
        width: frameSize,
        height: frameSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box style={{ width: effectSize, height: effectSize }}>{children}</Box>
    </Box>
  );
}

export function AstQuilt({ files, gridSide = DEFAULT_GRID_SIDE }: AstQuiltProps) {
  const prepared = usePreparedFiles(files);
  return (
    <AstFrame frameSize={FRAME_SIZE} effectSize={EFFECT_SIZE}>
      {prepared.length > 0 ? (
        <Effect onRender={(effect: any) => drawAstQuilt(effect, prepared, gridSide)} style={{ width: EFFECT_SIZE, height: EFFECT_SIZE }} />
      ) : null}
    </AstFrame>
  );
}

export function AstBinarySquares({ files, gridSide = 9 }: AstQuiltProps) {
  const prepared = usePreparedFiles(files);
  return (
    <AstFrame frameSize={FRAME_SIZE} effectSize={EFFECT_SIZE}>
      {prepared.length > 0 ? (
        <Effect
          onRender={(effect: any) => drawAstBinarySquares(effect, prepared, gridSide)}
          style={{ width: EFFECT_SIZE, height: EFFECT_SIZE }}
        />
      ) : null}
    </AstFrame>
  );
}

export function AstTile({ file, files, tileIndex = DEFAULT_TILE_INDEX }: AstTileProps) {
  const preparedFiles = usePreparedFiles(files);
  const safeIndex = preparedFiles.length > 0 ? ((tileIndex % preparedFiles.length) + preparedFiles.length) % preparedFiles.length : 0;
  const preparedSingle = usePreparedFile(file);
  const preparedFile = preparedSingle || preparedFiles[safeIndex] || null;

  return (
    <AstFrame frameSize={TILE_FRAME_SIZE} effectSize={TILE_EFFECT_SIZE}>
      {preparedFile ? (
        <Effect
          onRender={(effect: any) => drawAstTile(effect, preparedFile, tileIndex)}
          style={{ width: TILE_EFFECT_SIZE, height: TILE_EFFECT_SIZE }}
        />
      ) : null}
    </AstFrame>
  );
}

export function AstBinaryTile({ file, files, tileIndex = DEFAULT_TILE_INDEX }: AstTileProps) {
  const preparedFiles = usePreparedFiles(files);
  const safeIndex = preparedFiles.length > 0 ? ((tileIndex % preparedFiles.length) + preparedFiles.length) % preparedFiles.length : 0;
  const preparedSingle = usePreparedFile(file);
  const preparedFile = preparedSingle || preparedFiles[safeIndex] || null;

  return (
    <AstFrame frameSize={TILE_FRAME_SIZE} effectSize={TILE_EFFECT_SIZE}>
      {preparedFile ? (
        <Effect
          onRender={(effect: any) => drawAstBinaryTile(effect, preparedFile, tileIndex)}
          style={{ width: TILE_EFFECT_SIZE, height: TILE_EFFECT_SIZE }}
        />
      ) : null}
    </AstFrame>
  );
}

export const prepareFingerprintFile = prepareAstFingerprintFile;
export const prepareFingerprintFiles = prepareAstFingerprintFiles;
export const FingerprintQuilt = AstQuilt;
export const FingerprintTile = AstTile;
export const BinaryFingerprintQuilt = AstBinarySquares;
export const BinaryFingerprintTile = AstBinaryTile;
