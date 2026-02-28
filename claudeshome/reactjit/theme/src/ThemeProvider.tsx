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
    () => mergeThemeColors(resolved.colors, overridesByTheme[themeId]),
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
