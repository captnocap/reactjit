// =============================================================================
// useA11yState — app-wide accessibility layer, mutates COLORS + TOKENS in place
// =============================================================================
// Same pattern theme.ts uses: a live singleton palette that every component
// reads directly, mutated in place so a setting change re-renders every
// themed surface at once. On module load, we:
//   1. Read persisted a11y settings from __store_*
//   2. Snapshot the current theme palette/tokens as the BASE
//   3. Rebuild COLORS/TOKENS from BASE + a11y transform
//   4. Ask theme's applyTheme to fire its own listeners (so useTheme
//      subscribers re-render)
//   5. Re-overlay our transform on top, since applyTheme would have reset it
//
// Module-scope so once you import anything from a11y/, the transform is live
// regardless of whether the A11yPanel is mounted.
// =============================================================================

import {
  COLORS, TOKENS, applyTheme, getActiveThemeName,
} from '../../../theme';
import type { ThemePalette, ThemeTokens } from '../../../themes';
import {
  COLOR_MATRICES, applyColorMatrix, boostContrast,
  type ColorBlindMode,
} from './useColorMatrix';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};
const K = 'sweatshop.a11y.';

function sget<T>(path: string, fallback: T): T {
  try {
    const raw = storeGet(K + path);
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof fallback === 'boolean') return (raw === 'true' || raw === '1') as any;
    if (typeof fallback === 'number') { const n = Number(raw); return (isNaN(n) ? fallback : n) as any; }
    return String(raw) as any;
  } catch { return fallback; }
}
function sset(path: string, value: any) {
  try { storeSet(K + path, String(value)); } catch {}
}

export interface A11yState {
  colorBlindMode: ColorBlindMode;
  contrastBoost: number;     // 0..1
  textScale: number;         // 0.75..2.0
  motionReduce: boolean;
  focusRingBold: boolean;
}

const state: A11yState = {
  colorBlindMode: sget('colorBlindMode', 'off') as ColorBlindMode,
  contrastBoost:  clamp(sget('contrastBoost', 0), 0, 1),
  textScale:      clamp(sget('textScale', 1),     0.75, 2.0),
  motionReduce:   sget('motionReduce', false),
  focusRingBold:  sget('focusRingBold', false),
};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((fn) => { try { fn(); } catch {} }); }

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── Transform: runs over a base palette/tokens, returns transformed copies ──

function transformPalette(base: ThemePalette, s: A11yState): ThemePalette {
  const matrix = COLOR_MATRICES[s.colorBlindMode];
  const needsMatrix = s.colorBlindMode !== 'off';
  const out: Record<string, string> = {};
  for (const k of Object.keys(base) as Array<keyof ThemePalette>) {
    let c = String(base[k]);
    if (needsMatrix) c = applyColorMatrix(c, matrix);
    if (s.contrastBoost > 0) c = boostContrast(c, s.contrastBoost);
    out[k as string] = c;
  }
  return out as unknown as ThemePalette;
}

function transformTokens(base: ThemeTokens, s: A11yState): ThemeTokens {
  // Clone first — then scale font sizes by textScale.
  const out: ThemeTokens = { ...base };
  const scale = s.textScale;
  out.fontXs = Math.max(8,  Math.round(base.fontXs * scale));
  out.fontSm = Math.max(9,  Math.round(base.fontSm * scale));
  out.fontMd = Math.max(10, Math.round(base.fontMd * scale));
  out.fontLg = Math.max(11, Math.round(base.fontLg * scale));
  out.fontXl = Math.max(12, Math.round(base.fontXl * scale));
  return out;
}

// ── Apply cycle ──────────────────────────────────────────────────────────────

function applyA11y() {
  // applyTheme repopulates COLORS/TOKENS from the unmodified THEMES source,
  // so we use it to grab the base. A fresh Object.assign on top re-applies
  // our overlay. applyTheme also fires theme listeners, which pushes
  // re-renders through useTheme subscribers — they read COLORS/TOKENS in
  // their render pass and see our overlay on that cycle.
  const name = getActiveThemeName();
  applyTheme(name);
  const basePalette = { ...COLORS } as ThemePalette;
  const baseTokens  = { ...TOKENS } as ThemeTokens;
  Object.assign(COLORS, transformPalette(basePalette, state));
  Object.assign(TOKENS, transformTokens(baseTokens,  state));
  emit();
}

// Run once on module load so persisted settings take effect at app boot,
// regardless of whether A11yPanel ever mounts.
applyA11y();

// ── Public setters ──────────────────────────────────────────────────────────

export function setColorBlindMode(mode: ColorBlindMode) {
  state.colorBlindMode = mode; sset('colorBlindMode', mode); applyA11y();
}
export function setContrastBoost(amount: number) {
  state.contrastBoost = clamp(amount, 0, 1); sset('contrastBoost', state.contrastBoost); applyA11y();
}
export function setTextScale(scale: number) {
  state.textScale = clamp(scale, 0.75, 2.0); sset('textScale', state.textScale); applyA11y();
}
export function setMotionReduce(v: boolean) {
  state.motionReduce = v; sset('motionReduce', v); applyA11y();
}
export function setFocusRingBold(v: boolean) {
  state.focusRingBold = v; sset('focusRingBold', v); applyA11y();
}
export function reapplyOnThemeChange() { applyA11y(); }

/** React hook — re-renders when a11y state changes. */
export function useA11yState(): A11yState {
  const [, setTick] = (require('react') as any).useState(0);
  (require('react') as any).useEffect(() => {
    const fn = () => setTick((t: number) => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return state;
}

/** Read-only accessor for non-hook consumers (motion-reduce checks, etc.). */
export function getA11yState(): A11yState { return state; }
