// useForce(bodyId, [fx, fy]) — apply a continuous force to `bodyId`
// every frame while mounted. Re-runs on vector change. Use for thrust,
// wind, buoyancy; for one-shots use usePhysics().applyImpulse instead.

import { useEffect } from 'react';
import { usePhysicsCtx } from './PhysicsContext';

export function useForce(bodyId: string, force: [number, number]) {
  const { world, subscribe } = usePhysicsCtx();
  const fx = force[0]; const fy = force[1];
  useEffect(() => {
    if (fx === 0 && fy === 0) return;
    return subscribe(() => { world.applyForce(bodyId, { x: fx, y: fy }); });
  }, [world, subscribe, bodyId, fx, fy]);
}

export function useTorque(bodyId: string, torque: number) {
  const { world, subscribe } = usePhysicsCtx();
  useEffect(() => {
    if (torque === 0) return;
    return subscribe(() => { world.applyTorque(bodyId, torque); });
  }, [world, subscribe, bodyId, torque]);
}

export function useImpulse(bodyId: string, deps: any[] = []) {
  // Returns a fire-once function. Caller decides when to apply.
  const { world } = usePhysicsCtx();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback((jx: number, jy: number) => {
    world.applyImpulse(bodyId, { x: jx, y: jy });
  }, [world, bodyId, ...deps]);
}
