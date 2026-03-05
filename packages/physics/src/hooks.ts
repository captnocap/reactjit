import { useEffect, useRef } from 'react';
import { useLoveRPC } from '@reactjit/core';

/**
 * Apply a continuous force to a physics body each frame.
 * Force is reset each timestep — call every frame for sustained thrust.
 */
export function useForce(bodyId: string | number | undefined, force: [number, number]) {
  const rpc = useRef<ReturnType<typeof useLoveRPC>>(null);
  rpc.current = useLoveRPC('physics:applyForce');

  useEffect(() => {
    if (!bodyId || (force[0] === 0 && force[1] === 0)) return;
    const id = setInterval(() => {
      rpc.current?.({ bodyId, fx: force[0], fy: force[1] });
    }, 16);
    return () => clearInterval(id);
  }, [bodyId, force[0], force[1]]);
}

/**
 * Apply a one-shot impulse to a physics body.
 * Unlike force, this is applied once and changes velocity instantly.
 */
export function useImpulse(bodyId: string | number | undefined, impulse: [number, number]) {
  const rpc = useRef<ReturnType<typeof useLoveRPC>>(null);
  rpc.current = useLoveRPC('physics:applyImpulse');
  const applied = useRef(false);

  useEffect(() => {
    if (!bodyId || (impulse[0] === 0 && impulse[1] === 0)) {
      applied.current = false;
      return;
    }
    if (!applied.current) {
      applied.current = true;
      rpc.current?.({ bodyId, ix: impulse[0], iy: impulse[1] });
    }
  }, [bodyId, impulse[0], impulse[1]]);
}

/**
 * Apply continuous torque to a physics body.
 */
export function useTorque(bodyId: string | number | undefined, torque: number) {
  const rpc = useRef<ReturnType<typeof useLoveRPC>>(null);
  rpc.current = useLoveRPC('physics:applyTorque');

  useEffect(() => {
    if (!bodyId || torque === 0) return;
    const id = setInterval(() => {
      rpc.current?.({ bodyId, torque });
    }, 16);
    return () => clearInterval(id);
  }, [bodyId, torque]);
}
