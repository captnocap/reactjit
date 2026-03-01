import React, { createContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useBridgeOptional, ThemeColorsContext } from '@reactjit/core';
import { themes, defaultThemeId } from './themes';
import type { ThemeContextValue, ThemeColors } from './types';

type ThemeColorKey = Exclude<keyof ThemeColors, 'palette'>;
type ThemeColorOverrides = Partial<Record<ThemeColorKey, string>>;

type ThemeSwitchPayload = {
  name?: string;
  overrides?: Record<string, unknown>;
};

// Guard against border tokens collapsing into background/surface tokens.
const MIN_BORDER_CONTRAST = 1.35;

const LUA_OVERRIDE_KEYS: ThemeColorKey[] = [
  'bg',
  'bgAlt',
  'bgElevated',
  'surface',
  'surfaceHover',
  'border',
  'borderFocus',
  'text',
  'textSecondary',
  'textDim',
  'primary',
  'primaryHover',
  'primaryPressed',
  'accent',
  'error',
  'warning',
  'success',
  'info',
];

function sanitizeLuaOverrides(raw: unknown): ThemeColorOverrides {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const out: ThemeColorOverrides = {};
  for (const key of LUA_OVERRIDE_KEYS) {
    const value = source[key];
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function mergeThemeColors(base: ThemeColors, overrides: ThemeColorOverrides | undefined): ThemeColors {
  if (!overrides || Object.keys(overrides).length === 0) return base;
  return {
    ...base,
    ...overrides,
    // Preserve full palette map; Lua overlay currently edits semantic keys only.
    palette: base.palette,
  };
}

type RGB = { r: number; g: number; b: number };

function parseHexColor(value: string): RGB | null {
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = Number.parseInt(hex, 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

function toHexColor(rgb: RGB): string {
  const toPart = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toPart(rgb.r)}${toPart(rgb.g)}${toPart(rgb.b)}`;
}

function mixHexColor(from: string, to: string, t: number): string | null {
  const a = parseHexColor(from);
  const b = parseHexColor(to);
  if (!a || !b) return null;
  return toHexColor({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function toLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number | null {
  const rgb = parseHexColor(color);
  if (!rgb) return null;
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la == null || lb == null) return null;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function minContrastAgainst(color: string, backgrounds: string[]): number | null {
  let min: number | null = null;
  for (const bg of backgrounds) {
    const ratio = contrastRatio(color, bg);
    if (ratio == null) return null;
    min = min == null ? ratio : Math.min(min, ratio);
  }
  return min;
}

function adjustBorderContrast(colors: ThemeColors): ThemeColors {
  const backgrounds = [colors.bg, colors.bgElevated, colors.surface];
  const currentMinContrast = minContrastAgainst(colors.border, backgrounds);
  if (currentMinContrast == null || currentMinContrast >= MIN_BORDER_CONTRAST) return colors;

  const targets = [colors.textSecondary, colors.text, '#000000', '#ffffff'];

  for (const target of targets) {
    const targetContrast = minContrastAgainst(target, backgrounds);
    if (targetContrast == null || targetContrast < MIN_BORDER_CONTRAST) continue;

    let low = 0;
    let high = 1;
    for (let i = 0; i < 20; i += 1) {
      const mid = (low + high) / 2;
      const mixed = mixHexColor(colors.border, target, mid);
      if (!mixed) break;
      const mixedContrast = minContrastAgainst(mixed, backgrounds);
      if (mixedContrast != null && mixedContrast >= MIN_BORDER_CONTRAST) high = mid;
      else low = mid;
    }

    const adjusted = mixHexColor(colors.border, target, high);
    if (!adjusted) continue;
    return { ...colors, border: adjusted };
  }

  return colors;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  theme: initialTheme,
  persist = true,
  children,
}: {
  theme?: string;
  persist?: boolean;
  children: React.ReactNode;
}) {
  const bridge = useBridgeOptional();
  const [themeId, setThemeIdState] = useState(initialTheme ?? defaultThemeId);
  const [overridesByTheme, setOverridesByTheme] = useState<Record<string, ThemeColorOverrides>>({});
  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Persist theme selection to local store
  const persistTheme = useCallback(
    (id: string) => {
      if (!persistRef.current || !bridge) return;
      bridge.rpc('localstore:set', { namespace: 'theme', key: 'selected', value: id }).catch(() => {});
    },
    [bridge],
  );

  const setTheme = useCallback(
    (id: string) => {
      if (!themes[id]) return;
      setThemeIdState(id);
      persistTheme(id);
      if (bridge) {
        bridge.send('theme:set', { name: id });
        bridge.flush();
      }
    },
    [bridge, persistTheme],
  );

  // Load persisted theme on mount, then send initial theme to Lua
  useEffect(() => {
    if (!bridge) return;

    const applyTheme = (id: string) => {
      setThemeIdState(id);
      bridge.send('theme:set', { name: id });
      bridge.flush();
    };

    if (persist) {
      bridge
        .rpc<string | null>('localstore:get', { namespace: 'theme', key: 'selected' })
        .then((stored) => {
          if (stored && themes[stored]) {
            applyTheme(stored);
          } else {
            applyTheme(themeId);
          }
        })
        .catch(() => {
          applyTheme(themeId);
        });
    } else {
      applyTheme(themeId);
    }
  }, [bridge]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for Lua-initiated theme switches (F9 theme menu).
  // Uses setThemeIdState directly to avoid sending theme:set back to Lua (circular).
  useEffect(() => {
    if (!bridge) return;
    const unsub = bridge.subscribe('theme:switch', (payload: ThemeSwitchPayload) => {
      const name = payload?.name;
      if (name && themes[name]) {
        setThemeIdState(name);
        persistTheme(name);
        if (payload && Object.prototype.hasOwnProperty.call(payload, 'overrides')) {
          const nextOverrides = sanitizeLuaOverrides(payload.overrides);
          setOverridesByTheme((prev) => {
            const next = { ...prev };
            if (Object.keys(nextOverrides).length > 0) next[name] = nextOverrides;
            else delete next[name];
            return next;
          });
        }
      }
    });
    return unsub;
  }, [bridge, persistTheme]);

  const resolved = themes[themeId] ?? themes[defaultThemeId];
  const resolvedColors = useMemo(
    () => adjustBorderContrast(mergeThemeColors(resolved.colors, overridesByTheme[themeId])),
    [resolved.colors, overridesByTheme, themeId],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      setTheme,
      colors: resolvedColors,
      typography: resolved.typography,
      spacing: resolved.spacing,
      radii: resolved.radii,
    }),
    [themeId, setTheme, resolvedColors, resolved.typography, resolved.spacing, resolved.radii],
  );

  // Build a flat Record<string, string> of all color tokens for primitive resolution.
  // Includes top-level semantic tokens (bg, primary, etc.) and palette entries.
  const colorTokens = useMemo<Record<string, string>>(() => {
    const tokens: Record<string, string> = {};
    const { palette, ...semantic } = resolvedColors;
    for (const [k, v] of Object.entries(semantic)) {
      tokens[k] = v as string;
    }
    if (palette) {
      for (const [k, v] of Object.entries(palette)) {
        tokens[k] = v;
      }
    }
    return tokens;
  }, [resolvedColors]);

  return React.createElement(
    ThemeContext.Provider,
    { value },
    React.createElement(ThemeColorsContext.Provider, { value: colorTokens }, children),
  );
}
