import React, { createContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useBridgeOptional } from '@ilovereact/core';
import { themes, defaultThemeId } from './themes';
import type { ThemeContextValue } from './types';

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  theme: initialTheme,
  children,
}: {
  theme?: string;
  children: React.ReactNode;
}) {
  const bridge = useBridgeOptional();
  const [themeId, setThemeIdState] = useState(initialTheme ?? defaultThemeId);

  const setTheme = useCallback(
    (id: string) => {
      if (!themes[id]) return;
      setThemeIdState(id);
      if (bridge) {
        bridge.send('theme:set', { name: id });
        bridge.flush();
      }
    },
    [bridge],
  );

  // Send initial theme to Lua on mount
  useEffect(() => {
    if (bridge) {
      bridge.send('theme:set', { name: themeId });
      bridge.flush();
    }
  }, [bridge]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolved = themes[themeId] ?? themes[defaultThemeId];

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, setTheme, colors: resolved.colors }),
    [themeId, setTheme, resolved],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}
