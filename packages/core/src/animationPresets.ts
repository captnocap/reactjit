/**
 * Animation presets — re-exports from animation.ts.
 *
 * The old per-frame JS hooks (usePulse, useEntrance, useBounce, useRepeat) are
 * replaced by Lua-driven style helpers (pulseStyle, entranceStyle, repeatStyle)
 * and spring transitions. This file re-exports for barrel-import compat.
 */

export {
  useShake,
  useCountUp,
  useTypewriter,
  entranceStyle,
  pulseStyle,
  repeatStyle,
} from './animation';
