import type { ImagingOperation } from './types';

export interface ImagingGoldenFixture {
  id: string;
  src?: string;
  width?: number;
  height?: number;
  operations: ImagingOperation[];
  expectedHash?: string;
}

export interface PixelDiffResult {
  totalPixels: number;
  changedPixels: number;
  maxDelta: number;
  avgDelta: number;
}

export interface ImagingGoldenRunResult {
  id: string;
  hash: string;
  expectedHash?: string;
  pass: boolean;
  baselineMissing: boolean;
}

export interface ImagingGoldenRunSummary {
  total: number;
  passed: number;
  failed: number;
  missingBaselines: number;
  results: ImagingGoldenRunResult[];
}

export type ImagingGoldenExecutor = (fixture: ImagingGoldenFixture) => Promise<Uint8Array> | Uint8Array;

/**
 * Stable 32-bit FNV-1a hash for RGBA buffers.
 */
export function hashRGBA(data: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i += 1) {
    hash ^= data[i];
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Per-channel absolute delta pixel diff.
 */
export function diffRGBA(actual: Uint8Array, expected: Uint8Array): PixelDiffResult {
  if (actual.length !== expected.length) {
    throw new Error(`RGBA buffer length mismatch: ${actual.length} != ${expected.length}`);
  }

  let changedPixels = 0;
  let totalDelta = 0;
  let maxDelta = 0;
  const totalPixels = Math.floor(actual.length / 4);

  for (let i = 0; i < actual.length; i += 4) {
    const dr = Math.abs(actual[i] - expected[i]);
    const dg = Math.abs(actual[i + 1] - expected[i + 1]);
    const db = Math.abs(actual[i + 2] - expected[i + 2]);
    const da = Math.abs(actual[i + 3] - expected[i + 3]);
    const delta = Math.max(dr, dg, db, da);
    if (delta > 0) changedPixels += 1;
    if (delta > maxDelta) maxDelta = delta;
    totalDelta += delta;
  }

  return {
    totalPixels,
    changedPixels,
    maxDelta,
    avgDelta: totalPixels > 0 ? totalDelta / totalPixels : 0,
  };
}

/**
 * Run golden fixtures against an executor that returns RGBA pixels.
 * Fixtures with no expectedHash are reported as baselineMissing and treated as pass.
 */
export async function runGoldenFixtures(
  fixtures: ImagingGoldenFixture[],
  execute: ImagingGoldenExecutor,
): Promise<ImagingGoldenRunSummary> {
  const results: ImagingGoldenRunResult[] = [];

  for (const fixture of fixtures) {
    const rgba = await execute(fixture);
    const hash = hashRGBA(rgba);
    const expectedHash = fixture.expectedHash;
    const baselineMissing = !expectedHash;
    const pass = baselineMissing || expectedHash === hash;
    results.push({
      id: fixture.id,
      hash,
      expectedHash,
      pass,
      baselineMissing,
    });
  }

  let passed = 0;
  let failed = 0;
  let missingBaselines = 0;
  for (const result of results) {
    if (result.baselineMissing) missingBaselines += 1;
    if (result.pass) passed += 1;
    else failed += 1;
  }

  return {
    total: results.length,
    passed,
    failed,
    missingBaselines,
    results,
  };
}

/**
 * Helper to capture fixture hashes for baseline writing.
 */
export async function captureGoldenHashes(
  fixtures: ImagingGoldenFixture[],
  execute: ImagingGoldenExecutor,
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const fixture of fixtures) {
    const rgba = await execute(fixture);
    hashes[fixture.id] = hashRGBA(rgba);
  }
  return hashes;
}

/**
 * Baseline fixtures for imaging correctness checks.
 * expectedHash values are intentionally left undefined until captured.
 */
export const DEFAULT_GOLDEN_FIXTURES: ImagingGoldenFixture[] = [
  {
    id: 'brightness_gaussian_blur',
    src: 'lib/placeholders/landscape.png',
    operations: [
      { op: 'brightness', amount: 0.15 },
      { op: 'gaussian_blur', radius: 3 },
    ],
  },
  {
    id: 'edges_neon',
    src: 'lib/placeholders/landscape.png',
    operations: [
      { op: 'edge_detect', method: 'sobel' },
      { op: 'invert' },
      { op: 'hue_saturation', hue: 180, saturation: 2, value: 1 },
    ],
  },
  {
    id: 'pattern_levels',
    width: 320,
    height: 180,
    operations: [
      { op: 'levels', inBlack: 0.12, inWhite: 0.84, gamma: 1.25, outBlack: 0, outWhite: 1 },
      { op: 'posterize', levels: 6 },
    ],
  },
];
