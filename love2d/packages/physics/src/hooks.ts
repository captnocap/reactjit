import { useRef, useCallback } from 'react';
// rjit-ignore: useEffect needed for dep-driven impulse one-shot
import { useEffect } from 'react';
import { useLoveRPC, useLuaInterval } from '@reactjit/core';

/**
 * Apply a continuous force to a physics body each frame.
 * Force is reset each timestep — call every frame for sustained thrust.
 */
export function useForce(bodyId: string | number | undefined, force: [number, number]) {
  const rpc = useRef<ReturnType<typeof useLoveRPC>>(null);
  rpc.current = useLoveRPC('physics:applyForce');

  const bodyIdRef = useRef(bodyId);
  bodyIdRef.current = bodyId;
  const forceRef = useRef(force);
  forceRef.current = force;

  const tick = useCallback(() => {
    const id = bodyIdRef.current;
    const f = forceRef.current;
    if (!id || (f[0] === 0 && f[1] === 0)) return;
    rpc.current?.({ bodyId: id, fx: f[0], fy: f[1] });
  }, []);

  useLuaInterval(16, tick);
}

/**
 * Apply a one-shot impulse to a physics body.
 * Unlike force, this is applied once and changes velocity instantly.
 */
export function useImpulse(bodyId: string | number | undefined, impulse: [number, number]) {
  const rpc = useRef<ReturnType<typeof useLoveRPC>>(null);
  rpc.current = useLoveRPC('physics:applyImpulse');
  const applied = useRef(false);

  // Dep-driven: apply impulse once when bodyId/impulse change, then skip until next change.
  // rjit-ignore-next-line
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

  const bodyIdRef = useRef(bodyId);
  bodyIdRef.current = bodyId;
  const torqueRef = useRef(torque);
  torqueRef.current = torque;

  const tick = useCallback(() => {
    const id = bodyIdRef.current;
    const t = torqueRef.current;
    if (!id || t === 0) return;
    rpc.current?.({ bodyId: id, torque: t });
  }, []);

  useLuaInterval(16, tick);
}
