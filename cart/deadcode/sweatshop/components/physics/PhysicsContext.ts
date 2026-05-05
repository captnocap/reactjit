// React context + internal bus for the physics components. Separate
// from PhysicsWorld.tsx so hook files can import the context type
// without pulling in the provider component.

import type { PhysicsWorldCore } from '../../lib/physics/core';

export interface PhysicsContextValue {
  world: PhysicsWorldCore;
  // Version counter bumped each frame; components subscribe via useSyncExternalStore
  // to read body positions during render without stale-closure bugs.
  subscribe: (fn: () => void) => () => void;
  getVersion: () => number;
  debug: boolean;
}

export const PhysicsCtx: any = React.createContext(null);

export function usePhysicsCtx(): PhysicsContextValue {
  const v = React.useContext(PhysicsCtx);
  if (!v) throw new Error('usePhysics* must be used inside <PhysicsWorld>');
  return v as PhysicsContextValue;
}
