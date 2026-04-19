/**
 * theme — minimal ThemeProvider + hooks for classifier token resolution.
 *
 * Trimmed port of love2d/packages/theme/src/. Full love2d stack has multi-theme
 * switching, Lua-bridge overrides, and contrast enforcement; none of that is
 * needed on the root qjs stack yet. Here: one provider, one colors map,
 * one hook.
 *
 *   <ThemeProvider colors={{ bg: '#0f172a', text: '#e2e8f0', primary: '#3b82f6' }}>
 *     <App />
 *   </ThemeProvider>
 *
 *   const c = useThemeColors();
 *   c.primary // '#3b82f6'
 */

const React: any = require('react');

export type ThemeColors = Record<string, string>;

const DEFAULT_COLORS: ThemeColors = {
  bg: '#0f172a',
  bgAlt: '#111827',
  bgElevated: '#1e293b',
  surface: '#1e293b',
  surfaceHover: '#334155',
  border: '#334155',
  borderFocus: '#475569',
  text: '#e2e8f0',
  textSecondary: '#94a3b8',
  textDim: '#64748b',
  primary: '#3b82f6',
  primaryHover: '#60a5fa',
  primaryPressed: '#2563eb',
  accent: '#8b5cf6',
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  info: '#06b6d4',
};

const ThemeContext = React.createContext<ThemeColors | null>(null);

export interface ThemeProviderProps {
  colors?: Partial<ThemeColors>;
  children?: any;
}

export function ThemeProvider({ colors, children }: ThemeProviderProps) {
  const merged = React.useMemo(
    () => ({ ...DEFAULT_COLORS, ...(colors ?? {}) }),
    [colors],
  );
  return React.createElement(ThemeContext.Provider, { value: merged }, children);
}

/** Inside a ThemeProvider → the resolved colors. Outside → throws. */
export function useThemeColors(): ThemeColors {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeColors: no <ThemeProvider> in tree');
  return ctx;
}

/** Inside a ThemeProvider → the resolved colors. Outside → null (no throw). */
export function useThemeColorsOptional(): ThemeColors | null {
  return React.useContext(ThemeContext);
}
