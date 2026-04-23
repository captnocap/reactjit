// =============================================================================
// material/StandardMaterial — PBR-ish material descriptor
// =============================================================================
// Holds the knobs a Mesh needs for its look. Values are plain data; the
// mockup renderer in Scene3D.tsx tints + shades by roughness/metalness, and
// any future wgpu pipeline can consume the same shape directly.
// =============================================================================

import type { StandardMaterial } from '../types';

export interface StandardMaterialArgs {
  color?: string;      // hex — base albedo
  roughness?: number;  // 0 = mirror, 1 = matte
  metalness?: number;  // 0 = dielectric, 1 = metal
  emissive?: string;   // hex — self-lit tint; '#000000' = none
  opacity?: number;    // 0..1
}

const DEFAULTS: StandardMaterial = {
  kind: 'standard',
  color: '#8aa2ff',
  roughness: 0.5,
  metalness: 0.0,
  emissive: '#000000',
  opacity: 1,
};

export function makeStandardMaterial(args: StandardMaterialArgs = {}): StandardMaterial {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    kind: 'standard',
    color:     args.color     ?? DEFAULTS.color,
    roughness: clamp(args.roughness ?? DEFAULTS.roughness, 0, 1),
    metalness: clamp(args.metalness ?? DEFAULTS.metalness, 0, 1),
    emissive:  args.emissive  ?? DEFAULTS.emissive,
    opacity:   clamp(args.opacity ?? DEFAULTS.opacity, 0, 1),
  };
}

/** Collapse a Mesh's `material` prop (string shorthand | partial object |
 *  nothing) into a full StandardMaterial. Lets authors write either
 *  `material="#ff0055"` or `material={{ color: '#ff0055', metalness: 0.8 }}`. */
export function resolveMaterial(input: StandardMaterialArgs | string | undefined): StandardMaterial {
  if (typeof input === 'string') return makeStandardMaterial({ color: input });
  return makeStandardMaterial(input || {});
}
