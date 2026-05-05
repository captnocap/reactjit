// <PhysicsWorld> — root of a physics subtree. Owns a PhysicsWorldCore,
// drives the fixed-timestep loop, exposes world + subscription via
// React context. Children use <RigidBody>, <Collider>, <Joint> and the
// hooks from this folder to register into the world.
//
// Note: this is a thin shell around lib/physics/core. The heavy lifting
// (integrator, collision, joints) lives there and has zero React deps.

import { useEffect, useMemo, useRef, useState } from 'react';
import { PhysicsWorldCore, type Vec2 } from '../../lib/physics/core';
import { PhysicsCtx } from './PhysicsContext';

export interface PhysicsWorldProps {
  gravity?: [number, number];
  timeStep?: number;       // seconds per fixed sub-step (default 1/60)
  integrator?: 'euler' | 'verlet'; // only 'euler' implemented; reserved for TODO
  debug?: boolean;
  children?: any;
}

export function PhysicsWorld(props: PhysicsWorldProps) {
  const gravityVec: Vec2 = useMemo(
    () => ({ x: (props.gravity || [0, 980])[0], y: (props.gravity || [0, 980])[1] }),
    [props.gravity && props.gravity[0], props.gravity && props.gravity[1]],
  );
  const world = useMemo(() => new PhysicsWorldCore({
    gravity: gravityVec,
    timeStep: props.timeStep || 1 / 60,
  }), []); // world is stable for the component's lifetime
  // Keep live settings in sync without rebuilding the world.
  useEffect(() => { world.gravity.x = gravityVec.x; world.gravity.y = gravityVec.y; }, [world, gravityVec.x, gravityVec.y]);
  useEffect(() => { if (props.timeStep) world.timeStep = props.timeStep; }, [world, props.timeStep]);

  // Subscription bus — rather than setState each frame (would rerender
  // every body), we bump a version counter and let readers opt in via
  // useSyncExternalStore / useFrameVersion below.
  const subsRef = useRef<Set<() => void>>(new Set());
  const versionRef = useRef<number>(0);

  const ctxValue = useMemo(() => ({
    world,
    debug: !!props.debug,
    subscribe(fn: () => void) {
      subsRef.current.add(fn);
      return () => { subsRef.current.delete(fn); };
    },
    getVersion() { return versionRef.current; },
  }), [world, props.debug]);

  // Fixed-timestep loop driven by a wall-clock tick. Uses rAF when
  // available (browser / DOM harness), falls back to setInterval for
  // Node-side tooling (autotest, headless).
  useEffect(() => {
    let cancelled = false;
    const hasRaf = typeof (globalThis as any).requestAnimationFrame === 'function';
    let last = now();
    function frame() {
      if (cancelled) return;
      const t = now();
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      world.step(dt);
      versionRef.current++;
      for (const fn of subsRef.current) fn();
      if (hasRaf) (globalThis as any).requestAnimationFrame(frame);
    }
    if (hasRaf) {
      (globalThis as any).requestAnimationFrame(frame);
    } else {
      const id = setInterval(frame, 1000 * world.timeStep);
      return () => { cancelled = true; clearInterval(id); };
    }
    return () => { cancelled = true; };
  }, [world]);

  return React.createElement(PhysicsCtx.Provider, { value: ctxValue }, props.children);
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}
