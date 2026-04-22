// =============================================================================
// useScene3D — scene-graph context + imperative registry hook
// =============================================================================
// Scene3D provides a registry that children (Camera, Mesh, lights) register
// with on mount and unregister on unmount. Transform / prop changes route
// through the same API so each frame sees the latest snapshot — no React-
// reconciler round-trip needed for every useInterval tick.
//
// This file exposes:
//   • Scene3DContext               — React context the provider feeds
//   • Scene3DRegistry              — imperative API consumed by children
//   • useScene3D()                 — hook that returns the registry
//   • createScene3DRegistry()      — factory for Scene3D.tsx root
//
// Lives cart-side only. When a wgpu-backed native Scene3D primitive lands,
// the registry shape stays; only Scene3D.tsx's renderer changes.
// =============================================================================

const React: any = require('react');
const { createContext, useContext } = React;

import type {
  AmbientLightNode,
  CameraNode,
  DirectionalLightNode,
  LightNode,
  MeshNode,
  PointLightNode,
} from './types';

// ── Registry shape ──────────────────────────────────────────────────────────

export interface Scene3DRegistry {
  nextId: () => number;

  camera: { get: () => CameraNode; set: (next: CameraNode) => void };

  meshes: {
    list:     () => MeshNode[];
    add:      (node: MeshNode) => void;
    update:   (id: number, patch: Partial<MeshNode>) => void;
    remove:   (id: number) => void;
  };

  lights: {
    list:     () => LightNode[];
    add:      (node: LightNode) => void;
    update:   (id: number, patch: Partial<AmbientLightNode & DirectionalLightNode & PointLightNode>) => void;
    remove:   (id: number) => void;
  };

  /** Subscribe to any registry change — Scene3D.tsx uses this to repaint. */
  subscribe: (fn: () => void) => () => void;
}

// ── Default camera + factory ────────────────────────────────────────────────

export const DEFAULT_CAMERA: CameraNode = {
  id: 0,
  kind: 'perspective',
  position: [3, 3, 3],
  target:   [0, 0, 0],
  fov: Math.PI / 3,
  near: 0.01,
  far: 1000,
  orthoSize: 5,
};

export function createScene3DRegistry(): Scene3DRegistry {
  let idCounter = 1;
  let camera: CameraNode = { ...DEFAULT_CAMERA };
  const meshes: MeshNode[] = [];
  const lights: LightNode[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => { try { fn(); } catch {} });

  return {
    nextId: () => idCounter++,

    camera: {
      get: () => camera,
      set: (next) => { camera = next; notify(); },
    },

    meshes: {
      list: () => meshes.slice(),
      add:      (node) => { meshes.push(node); notify(); },
      update:   (id, patch) => {
        const m = meshes.find((x) => x.id === id);
        if (!m) return;
        Object.assign(m, patch);
        notify();
      },
      remove:   (id) => {
        const idx = meshes.findIndex((x) => x.id === id);
        if (idx >= 0) { meshes.splice(idx, 1); notify(); }
      },
    },

    lights: {
      list: () => lights.slice(),
      add:      (node) => { lights.push(node); notify(); },
      update:   (id, patch) => {
        const l = lights.find((x) => x.id === id);
        if (!l) return;
        Object.assign(l, patch);
        notify();
      },
      remove:   (id) => {
        const idx = lights.findIndex((x) => x.id === id);
        if (idx >= 0) { lights.splice(idx, 1); notify(); }
      },
    },

    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}

// ── React context + hook ────────────────────────────────────────────────────

export const Scene3DContext = createContext(null);

/** Children of <Scene3D> call this to reach the shared registry. Outside
 *  a Scene3D, returns null — callers must early-return if so. */
export function useScene3D(): Scene3DRegistry | null {
  return useContext(Scene3DContext);
}
