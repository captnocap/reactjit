import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLoveRPC } from '@reactjit/core';
import type { Vec2, Vec3, Vec4, Mat4 as Mat4Type, BBox2, NoiseConfig, NoiseFieldConfig, BezierConfig } from './types';
import { Vec2 as V2 } from './vec2';
import { Vec3 as V3 } from './vec3';
import { Mat4 as M4 } from './mat4';
import { Quat as Q } from './quat';
import { BBox2 as BB2 } from './geometry';
import { lerp, smoothstep } from './interpolation';

// ── Pure TS hooks (no bridge) ────────────────────────────

type Vec2Setter = (x: number, y: number) => void;
type Vec3Setter = (x: number, y: number, z: number) => void;
type Vec4Setter = (x: number, y: number, z: number, w: number) => void;

export function useVec2(x = 0, y = 0): [Vec2, Vec2Setter] {
  const [v, setV] = useState<Vec2>([x, y]);
  const set = useCallback((nx: number, ny: number) => setV([nx, ny]), []);
  return [v, set];
}

export function useVec3(x = 0, y = 0, z = 0): [Vec3, Vec3Setter] {
  const [v, setV] = useState<Vec3>([x, y, z]);
  const set = useCallback((nx: number, ny: number, nz: number) => setV([nx, ny, nz]), []);
  return [v, set];
}

export function useVec4(x = 0, y = 0, z = 0, w = 0): [Vec4, Vec4Setter] {
  const [v, setV] = useState<Vec4>([x, y, z, w]);
  const set = useCallback((nx: number, ny: number, nz: number, nw: number) => setV([nx, ny, nz, nw]), []);
  return [v, set];
}

export function useMat4(): [Mat4Type, {
  setIdentity: () => void;
  translate: (v: Vec3) => void;
  rotateX: (radians: number) => void;
  rotateY: (radians: number) => void;
  rotateZ: (radians: number) => void;
  scale: (v: Vec3) => void;
  set: (m: Mat4Type) => void;
}] {
  const [m, setM] = useState<Mat4Type>(M4.identity);
  const ops = useMemo(() => ({
    setIdentity: () => setM(M4.identity()),
    translate: (v: Vec3) => setM(prev => M4.translate(prev, v)),
    rotateX: (r: number) => setM(prev => M4.rotateX(prev, r)),
    rotateY: (r: number) => setM(prev => M4.rotateY(prev, r)),
    rotateZ: (r: number) => setM(prev => M4.rotateZ(prev, r)),
    scale: (v: Vec3) => setM(prev => M4.scale(prev, v)),
    set: (m: Mat4Type) => setM(m),
  }), []);
  return [m, ops];
}

export function useTransform(config: {
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}): Mat4Type {
  const { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = config;
  return useMemo(() => {
    let m = M4.fromEuler(rotation[0], rotation[1], rotation[2]);
    m = M4.scale(m, scale);
    m = M4.translate(m, position);
    return m;
  }, [position[0], position[1], position[2], rotation[0], rotation[1], rotation[2], scale[0], scale[1], scale[2]]);
}

export function useLerp(from: number, to: number, t: number): number {
  return useMemo(() => lerp(from, to, t), [from, to, t]);
}

export function useSmoothstep(edge0: number, edge1: number, x: number): number {
  return useMemo(() => smoothstep(edge0, edge1, x), [edge0, edge1, x]);
}

export function useDistance(a: Vec2 | Vec3, b: Vec2 | Vec3): number {
  return useMemo(() => {
    if (a.length === 2 && b.length === 2) return V2.distance(a as Vec2, b as Vec2);
    return V3.distance(a as Vec3, b as Vec3);
  }, [a[0], a[1], (a as any)[2], b[0], b[1], (b as any)[2]]);
}

export function useBBox(points: Vec2[]): BBox2 {
  return useMemo(() => BB2.fromPoints(points), [points]);
}

export function useIntersection(a: BBox2, b: BBox2): boolean {
  return useMemo(() => BB2.intersects(a, b), [
    a.min[0], a.min[1], a.max[0], a.max[1],
    b.min[0], b.min[1], b.max[0], b.max[1],
  ]);
}

// ── Bridge hooks (Lua-backed heavy compute) ──────────────

export function useNoise(config: NoiseConfig): number | null {
  const rpc = useLoveRPC<number>(config.z != null ? 'math:noise3d' : 'math:noise2d');
  const [value, setValue] = useState<number | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;
    rpc(configRef.current).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, config.x, config.y, config.z, config.seed, config.octaves, config.lacunarity, config.persistence]);

  return value;
}

export function useNoiseField(config: NoiseFieldConfig): number[] | null {
  const rpc = useLoveRPC<number[]>('math:noisefield');
  const [field, setField] = useState<number[] | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;
    rpc(configRef.current).then(v => { if (!cancelled) setField(v); });
    return () => { cancelled = true; };
  }, [rpc, config.width, config.height, config.offsetX, config.offsetY, config.scale, config.seed, config.octaves]);

  return field;
}

export function useFFT(samples: number[]): number[] | null {
  const rpc = useLoveRPC<number[]>('math:fft');
  const [spectrum, setSpectrum] = useState<number[] | null>(null);
  const samplesRef = useRef(samples);
  samplesRef.current = samples;

  useEffect(() => {
    if (!samples || samples.length === 0) return;
    let cancelled = false;
    rpc({ samples: samplesRef.current }).then(v => { if (!cancelled) setSpectrum(v); });
    return () => { cancelled = true; };
  }, [rpc, samples]);

  return spectrum;
}

export function useBezier(config: BezierConfig): Vec2[] | null {
  const rpc = useLoveRPC<Vec2[]>('math:bezier');
  const [points, setPoints] = useState<Vec2[] | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    let cancelled = false;
    rpc(configRef.current).then(v => { if (!cancelled) setPoints(v); });
    return () => { cancelled = true; };
  }, [rpc, config.points, config.segments]);

  return points;
}

// ── Math Pool (batch operations) ─────────────────────────

interface PoolEntry {
  op: string;
  args: Record<string, any>;
}

interface MathPool {
  enqueue: (op: string, args: Record<string, any>) => number;
  result: (id: number) => any;
  results: Record<number, any>;
  flush: () => void;
}

export function useMathPool(): MathPool {
  const rpc = useLoveRPC<Record<string, any>[]>('math:batch');
  const queueRef = useRef<PoolEntry[]>([]);
  const idCounterRef = useRef(0);
  const [results, setResults] = useState<Record<number, any>>({});

  const enqueue = useCallback((op: string, args: Record<string, any>) => {
    const id = idCounterRef.current++;
    queueRef.current.push({ op, args });
    return id;
  }, []);

  const flush = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) return;
    const ops = [...queue];
    const startId = idCounterRef.current - queue.length;
    queueRef.current = [];

    rpc({ ops }).then(res => {
      if (!res) return;
      const next: Record<number, any> = {};
      for (let i = 0; i < res.length; i++) {
        next[startId + i] = res[i];
      }
      setResults(next);
    });
  }, [rpc]);

  useEffect(() => {
    if (queueRef.current.length > 0) flush();
  });

  const result = useCallback((id: number) => results[id], [results]);

  return { enqueue, result, results, flush };
}
