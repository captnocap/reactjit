// =============================================================================
// useHaptic — rumble through __gamepad_rumble if the host exposes it
// =============================================================================
// Probe-then-call pattern: returns { available, rumble, stop }. `rumble` is
// a no-op when the host fn is missing so callers can wire the button without
// conditional branches. `available` lets UIs grey-out the haptic control
// when there's nothing to drive.
// =============================================================================

import type { HapticSpec } from './types';

const host: any = globalThis;

export function useHaptic(joystickId: number | null): {
  available: boolean;
  rumble: (spec: HapticSpec) => void;
  stop: () => void;
} {
  const [available] = useState<boolean>(() => typeof host.__gamepad_rumble === 'function');

  const rumble = useCallback((spec: HapticSpec) => {
    if (!available || joystickId === null || joystickId < 0) return;
    try {
      const low  = Math.max(0, Math.min(1, spec.low));
      const high = Math.max(0, Math.min(1, spec.high));
      const ms   = Math.max(0, Math.round(spec.durationMs));
      host.__gamepad_rumble(joystickId, low, high, ms);
    } catch {
      // host fn threw — swallow silently; the bridge guarantee is weak.
    }
  }, [available, joystickId]);

  const stop = useCallback(() => {
    if (!available || joystickId === null || joystickId < 0) return;
    try { host.__gamepad_rumble(joystickId, 0, 0, 0); } catch {}
  }, [available, joystickId]);

  return { available, rumble, stop };
}
