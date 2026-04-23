import { useRef } from 'react';
import { Box, Effect } from '../../../../runtime/primitives';

export type AstQuiltProps = {
  seed?: number;
};

export type AstTileProps = {
  seed?: number;
  tileIndex?: number;
};

const GRID_SIDE = 12;
const TILE_COUNT = GRID_SIDE * GRID_SIDE;
const FRAME_SIZE = 648;
const EFFECT_SIZE = 620;
const TILE_FRAME_SIZE = 360;
const TILE_EFFECT_SIZE = 332;
const TILE_GAP = 4;
const MODEL_SEED = 0x51f10a57;
const DEFAULT_TILE_INDEX = 0;

type QuiltLeaf = {
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  kind: number;
  start: number;
  end: number;
};

type QuiltTile = {
  phase: number;
  speed: number;
  maxEnd: number;
  leaves: QuiltLeaf[];
};

type QuiltModel = {
  tiles: QuiltTile[];
};

type PixelWriter = (x: number, y: number, r: number, g: number, b: number, a: number) => void;

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

function pushLeaf(
  leaves: QuiltLeaf[],
  rng: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  kindBase: number,
  start: number,
  span: number,
) {
  leaves.push({
    x,
    y,
    w,
    h,
    depth,
    kind: kindBase + depth * 3 + ((rng() * 7) | 0),
    start,
    end: start + Math.max(1, span),
  });
}

function subdivideTile(
  leaves: QuiltLeaf[],
  rng: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  start: number,
  span: number,
  kindBase: number,
) {
  const minEdge = 0.075;
  const minSpan = 18;
  const minChildSpan = 8;
  const canSplit = depth < 4 && w > minEdge && h > minEdge && span > minSpan * 2;
  const shouldSplit = canSplit && (depth < 2 || rng() > 0.28);
  if (!shouldSplit) {
    pushLeaf(leaves, rng, x, y, w, h, depth, kindBase, start, span);
    return;
  }

  const childCount = 2 + ((rng() * 3) | 0) + (depth === 0 ? 1 : 0);
  const axis = w > h * 1.12 ? 'x' : h > w * 1.12 ? 'y' : rng() > 0.5 ? 'x' : 'y';
  const inset = depth === 0 ? 0.02 : depth < 2 ? 0.013 : 0.008;
  const gap = depth === 0 ? 0.012 : depth < 2 ? 0.008 : 0.004;
  const innerX = x + inset;
  const innerY = y + inset;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;
  const available = (axis === 'x' ? innerW : innerH) - gap * (childCount - 1);
  const minSpace = depth > 2 ? 0.025 : 0.04;
  if (innerW <= minEdge || innerH <= minEdge || available <= minSpace * childCount || span <= minChildSpan * childCount) {
    pushLeaf(leaves, rng, x, y, w, h, depth, kindBase, start, span);
    return;
  }

  const weights: number[] = [];
  let totalWeight = 0;
  for (let index = 0; index < childCount; index++) {
    const weight = 0.48 + rng() * 1.32;
    weights.push(weight);
    totalWeight += weight;
  }

  let cursor = axis === 'x' ? innerX : innerY;
  let spanCursor = start;
  let remainingSpace = available;
  let remainingSpan = span;
  let remainingWeight = totalWeight;

  for (let index = 0; index < childCount; index++) {
    const remainingCount = childCount - index;
    const weight = weights[index];
    const nextSpace =
      remainingCount === 1
        ? remainingSpace
        : clamp(
            remainingSpace * (weight / remainingWeight),
            minSpace,
            remainingSpace - minSpace * (remainingCount - 1)
          );

    const nextSpan =
      remainingCount === 1
        ? remainingSpan
        : Math.max(
            minChildSpan,
            Math.round(
              clamp(
                remainingSpan * (weight / remainingWeight),
                minChildSpan,
                remainingSpan - minChildSpan * (remainingCount - 1)
              )
            )
          );

    const childX = axis === 'x' ? cursor : innerX;
    const childY = axis === 'y' ? cursor : innerY;
    const childW = axis === 'x' ? nextSpace : innerW;
    const childH = axis === 'y' ? nextSpace : innerH;

    subdivideTile(
      leaves,
      rng,
      childX,
      childY,
      childW,
      childH,
      depth + 1,
      spanCursor,
      nextSpan,
      kindBase + index * 5 + depth * 11
    );

    cursor += nextSpace + gap;
    spanCursor += nextSpan;
    remainingSpace -= nextSpace;
    remainingSpan -= nextSpan;
    remainingWeight -= weight;
  }
}

function createQuiltModel(seed: number): QuiltModel {
  const tiles: QuiltTile[] = [];

  for (let index = 0; index < TILE_COUNT; index++) {
    const rng = createRng((seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0);
    const leaves: QuiltLeaf[] = [];
    const maxEnd = 360 + ((rng() * 540) | 0);

    subdivideTile(leaves, rng, 0, 0, 1, 1, 0, 0, maxEnd, 1 + ((rng() * 9) | 0));

    tiles.push({
      phase: index * 0.31 + rng() * 0.7,
      speed: 0.26 + rng() * 0.16,
      maxEnd,
      leaves,
    });
  }

  return { tiles };
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
    for (let px = x0; px < x1; px++) {
      write(px, py, r, g, b, a);
    }
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

function drawTile(
  effect: any,
  write: PixelWriter,
  maxWidth: number,
  maxHeight: number,
  tile: QuiltTile,
  tileIndex: number,
  tileX: number,
  tileY: number,
  tileSize: number,
  now: number,
) {
  const tilePhase = now * tile.speed + tile.phase;
  const triangle = Math.abs(((tilePhase % 2) + 2) % 2 - 1);
  const scanPos = (1 - triangle) * tile.maxEnd;

  fillRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, 5, 10, 16, 255);
  strokeRect(write, maxWidth, maxHeight, tileX, tileY, tileSize, tileSize, 16, 28, 40, 255);

  for (let leafIndex = 0; leafIndex < tile.leaves.length; leafIndex++) {
    const leaf = tile.leaves[leafIndex];
    const inScan = scanPos >= leaf.start && scanPos < leaf.end;
    const px = tileX + 1 + Math.floor(leaf.x * (tileSize - 2));
    const py = tileY + 1 + Math.floor(leaf.y * (tileSize - 2));
    const pw = Math.max(1, Math.floor(leaf.w * (tileSize - 2)));
    const ph = Math.max(1, Math.floor(leaf.h * (tileSize - 2)));
    const wave = Math.sin(tilePhase * 4.2 - leaf.depth * 0.6 + leafIndex * 0.03);
    const hue = (((leaf.kind * 137) % 360) + tilePhase * 28 + leaf.depth * 9 + tileIndex * 1.4) / 360;
    const saturation = inScan ? 0.84 : 0.58 + leaf.depth * 0.03;
    const value = clamp(0.56 + wave * 0.12 + leaf.depth * 0.03 + (inScan ? 0.25 : 0), 0.3, 1);
    const rgb = effect.hsv(hue, clamp(saturation, 0.4, 0.92), value);
    const r = (rgb[0] * 255) | 0;
    const g = (rgb[1] * 255) | 0;
    const b = (rgb[2] * 255) | 0;

    fillRect(write, maxWidth, maxHeight, px, py, pw, ph, r, g, b, 255);

    if (pw > 2 && ph > 2) {
      const edge = inScan ? 235 : 16 + leaf.depth * 8;
      strokeRect(write, maxWidth, maxHeight, px, py, pw, ph, edge, edge, edge, 255);
    }

    if (inScan && pw > 4 && ph > 4) {
      fillRect(write, maxWidth, maxHeight, px + 1, py + 1, pw - 2, 1, 245, 250, 255, 255);
    }
  }
}

function drawAstQuilt(effect: any, model: QuiltModel) {
  effect.clearColor(2 / 255, 5 / 255, 10 / 255, 1);

  const write: PixelWriter = effect.setPixelRaw;
  const width = effect.width | 0;
  const height = effect.height | 0;
  const tileSize = Math.floor((Math.min(width, height) - TILE_GAP * (GRID_SIDE - 1)) / GRID_SIDE);
  const totalGrid = tileSize * GRID_SIDE + TILE_GAP * (GRID_SIDE - 1);
  const offsetX = Math.floor((width - totalGrid) * 0.5);
  const offsetY = Math.floor((height - totalGrid) * 0.5);
  const now = effect.time;

  for (let index = 0; index < model.tiles.length; index++) {
    const tile = model.tiles[index];
    const col = index % GRID_SIDE;
    const row = (index / GRID_SIDE) | 0;
    const tileX = offsetX + col * (tileSize + TILE_GAP);
    const tileY = offsetY + row * (tileSize + TILE_GAP);
    drawTile(effect, write, width, height, tile, index, tileX, tileY, tileSize, now);
  }
}

function drawAstTile(effect: any, model: QuiltModel, tileIndex: number) {
  effect.clearColor(2 / 255, 5 / 255, 10 / 255, 1);

  const write: PixelWriter = effect.setPixelRaw;
  const width = effect.width | 0;
  const height = effect.height | 0;
  const size = Math.min(width, height);
  const tileX = Math.floor((width - size) * 0.5);
  const tileY = Math.floor((height - size) * 0.5);
  const safeIndex = ((tileIndex % model.tiles.length) + model.tiles.length) % model.tiles.length;
  drawTile(effect, write, width, height, model.tiles[safeIndex], safeIndex, tileX, tileY, size, effect.time);
}

function useQuiltModel(seed: number): QuiltModel {
  const modelRef = useRef<{ seed: number; model: QuiltModel } | null>(null);
  if (!modelRef.current || modelRef.current.seed !== seed) {
    modelRef.current = { seed, model: createQuiltModel(seed) };
  }
  return modelRef.current.model;
}

function AstFrame({
  frameSize,
  effectSize,
  children,
}: {
  frameSize: number;
  effectSize: number;
  children: any;
}) {
  return (
    <Box
      style={{
        width: frameSize,
        height: frameSize,
        padding: 14,
        borderRadius: 30,
        backgroundColor: '#040b11',
        borderWidth: 1,
        borderColor: '#173347',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          position: 'absolute',
          left: -72,
          top: -58,
          width: 210,
          height: 210,
          borderRadius: 210,
          backgroundColor: '#0d3d49',
          opacity: 0.22,
        }}
      />
      <Box
        style={{
          position: 'absolute',
          right: -110,
          bottom: -104,
          width: 280,
          height: 280,
          borderRadius: 280,
          backgroundColor: '#26153a',
          opacity: 0.22,
        }}
      />
      <Box
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          top: 14,
          bottom: 14,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: '#102738',
        }}
      />
      <Box style={{ width: effectSize, height: effectSize }}>{children}</Box>
    </Box>
  );
}

export function AstQuilt({ seed = MODEL_SEED }: AstQuiltProps) {
  const model = useQuiltModel(seed);

  return (
    <AstFrame frameSize={FRAME_SIZE} effectSize={EFFECT_SIZE}>
      <Effect onRender={(effect: any) => drawAstQuilt(effect, model)} style={{ width: EFFECT_SIZE, height: EFFECT_SIZE }} />
    </AstFrame>
  );
}

export function AstTile({ seed = MODEL_SEED, tileIndex = DEFAULT_TILE_INDEX }: AstTileProps) {
  const model = useQuiltModel(seed);

  return (
    <AstFrame frameSize={TILE_FRAME_SIZE} effectSize={TILE_EFFECT_SIZE}>
      <Effect
        onRender={(effect: any) => drawAstTile(effect, model, tileIndex)}
        style={{ width: TILE_EFFECT_SIZE, height: TILE_EFFECT_SIZE }}
      />
    </AstFrame>
  );
}
