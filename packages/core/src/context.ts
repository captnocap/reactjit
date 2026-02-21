import { createContext, useContext, type ReactNode } from 'react';
import type { IBridge } from './bridge';
import React from 'react';

// ── Bridge context (hooks consume this) ─────────────────

const BridgeContext = createContext<IBridge | null>(null);

export function BridgeProvider({
  bridge,
  children,
}: {
  bridge: IBridge;
  children: ReactNode;
}) {
  return React.createElement(BridgeContext.Provider, { value: bridge }, children);
}

export function useBridge(): IBridge {
  const bridge = useContext(BridgeContext);
  if (!bridge)
    throw new Error('useBridge must be used within a <BridgeProvider>');
  return bridge;
}

export function useBridgeOptional(): IBridge | null {
  return useContext(BridgeContext);
}

// ── Renderer mode context (primitives switch on this) ───

export type RendererMode = 'web' | 'native';

const RendererContext = createContext<RendererMode>('web');

export function RendererProvider({
  mode,
  children,
}: {
  mode: RendererMode;
  children: ReactNode;
}) {
  return React.createElement(RendererContext.Provider, { value: mode }, children);
}

export function useRendererMode(): RendererMode {
  return useContext(RendererContext);
}

// ── Theme color tokens context (populated by @reactjit/theme) ───
//
// This context holds a flat Record<string, string> of semantic color tokens
// (e.g. { primary: "#cba6f7", bg: "#1e1e2e", ... }). It lives in core so
// that primitives can resolve token names without importing the theme package,
// which would create a circular dependency.

const ThemeColorsContext = createContext<Record<string, string> | null>(null);

export { ThemeColorsContext };

/** Returns the current theme color tokens, or null if no ThemeProvider is active. */
export function useThemeColorsOptional(): Record<string, string> | null {
  return useContext(ThemeColorsContext);
}
