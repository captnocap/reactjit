// ────────────────────────────────────────────────────────────────────
// THEME CASCADE MODEL
//   COLORS / TOKENS are live objects mutated in place by applyTheme().
//   Components that import them by reference see new values, but React
//   only re-renders components that subscribe via useTheme(). The root
//   shell (CursorIdeApp in index.tsx) calls useTheme() so applyTheme()
//   causes a tree-wide re-render — children that import COLORS/TOKENS
//   directly then read the updated palette on their next render.
//
// HARDCODED-COLOR AUDIT (as of 2026-04-22 — worker-4f14/theme-global-wrap)
//   Files below contain literal hex colors (#RRGGBB / #RGB) that bypass
//   the theme system. They will NOT update on theme switch even after
//   the root-subscribe fix. Worker 9 owns the migration to TOKENS/COLORS.
//   DO NOT migrate here — this list is a handoff, not a todo for me.
//     • cart/sweatshop/components/toolbar.tsx
//     • cart/sweatshop/components/hotpanel.tsx
//     • cart/sweatshop/components/settings.tsx
//     • cart/sweatshop/components/tooltip.tsx
//     • cart/sweatshop/components/icons.tsx
//     • cart/sweatshop/components/plancanvas.tsx
//     • cart/sweatshop/components/editor.tsx
//     • cart/sweatshop/components/sparkline.tsx
//     • cart/sweatshop/components/agent/*.tsx (all files in agent/)
//     • cart/sweatshop/components/cockpit/WorkerCanvas.tsx
//     • cart/sweatshop/components/cockpit/WorkerTile.tsx
//     • cart/sweatshop/components/cockpit/WorkerCharts.tsx
//     • cart/sweatshop/components/cockpit/WorkerStrip.tsx
//     • cart/sweatshop/mermaid/renderer.tsx
//     • cart/sweatshop/index.tsx (a few literals in workspaceStats / landingProjects)
//   Also note: this file itself inlines a handful of literals in
//   fileTone/statusTone (e.g. '#2d62ff', '#56d364', '#4a5568', '#6e6e6e')
//   that should ideally come from COLORS too.
// ────────────────────────────────────────────────────────────────────

import { THEMES, THEME_ORDER, buildCustomTheme, type CustomThemeOverrides, type Theme, type ThemePalette, type ThemeTokens } from './themes';

export type WidthBand = 'minimum' | 'widget' | 'narrow' | 'medium' | 'desktop';

// Live palette + token objects. Properties are mutated in place when
// applyTheme() switches themes, so any component reading COLORS.x or
// TOKENS.x during render gets the current theme's values.
export const COLORS: ThemePalette = { ...THEMES.soft.palette };
export const TOKENS: ThemeTokens = { ...THEMES.soft.tokens };

type Listener = () => void;
const listeners = new Set<Listener>();
let activeThemeName = 'soft';

function readPersisted(key: string): string | null {
  try {
    const host: any = globalThis as any;
    if (typeof host.__store_get === 'function') {
      const value = host.__store_get(key);
      if (typeof value === 'string') return value;
    }
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch (_e) {}
  return null;
}

function writePersisted(key: string, value: string): void {
  try {
    const host: any = globalThis as any;
    if (typeof host.__store_set === 'function') host.__store_set(key, value);
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch (_e) {}
}

function persist(name: string) {
  writePersisted('sweatshop-theme', name);
}

function restore(): string {
  const v = readPersisted('sweatshop-theme');
  if (v && THEMES[v]) return v;
  return 'soft';
}

export function getActiveThemeName(): string {
  return activeThemeName;
}

export function getThemeNames(): string[] {
  return THEME_ORDER.slice();
}

function persistCustom(overrides: CustomThemeOverrides): void {
  writePersisted('sweatshop-theme-custom', JSON.stringify(overrides));
}

function restoreCustom(): CustomThemeOverrides {
  try {
    const v = readPersisted('sweatshop-theme-custom');
    if (v) return JSON.parse(v);
  } catch (_e) {}
  return {};
}

let customOverrides: CustomThemeOverrides = restoreCustom();

export function getCustomOverrides(): CustomThemeOverrides {
  return customOverrides;
}

export function setCustomOverrides(next: CustomThemeOverrides): void {
  customOverrides = next || {};
  THEMES.custom = buildCustomTheme(customOverrides);
  persistCustom(customOverrides);
  if (activeThemeName === 'custom') applyTheme('custom');
}

// Bootstrap custom theme from persisted overrides.
THEMES.custom = buildCustomTheme(customOverrides);

export function applyTheme(name: string): void {
  const theme: Theme | undefined = THEMES[name];
  if (!theme) return;
  activeThemeName = name;
  Object.assign(COLORS, theme.palette);
  Object.assign(TOKENS, theme.tokens);
  persist(name);
  for (const fn of listeners) fn();
}

// Initialize from persisted choice on module load.
applyTheme(restore());

export function useTheme(): { name: string; tokens: ThemeTokens; colors: ThemePalette; setTheme: (n: string) => void } {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick((x) => x + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return { name: activeThemeName, tokens: TOKENS, colors: COLORS, setTheme: applyTheme };
}

export function widthBandForSize(w: number, h: number): WidthBand {
  if (w <= 360 || h <= 250) return 'minimum';
  if (w <= 560 || h <= 360) return 'widget';
  if (w <= 920) return 'narrow';
  if (w <= 1260) return 'medium';
  return 'desktop';
}

export function stripDotSlash(path: string): string {
  if (!path) return '';
  return path.startsWith('./') ? path.slice(2) : path;
}

export function baseName(path: string): string {
  if (!path) return '';
  if (path === '.') return 'workspace';
  const clean = path.endsWith('/') ? path.slice(0, -1) : path;
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

export function parentPath(path: string): string {
  if (!path || path === '.' || path === '__landing__') return '.';
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(0, idx) : '.';
}

export function samePath(a: string, b: string): boolean {
  return stripDotSlash(a) === stripDotSlash(b);
}

export function inferFileType(path: string): string {
  if (path === '__landing__') return 'home';
  if (path === '__settings__') return 'settings';
  if (path === '.' || path.length === 0) return 'workspace';
  const name = baseName(path);
  if (name.includes('.c.tsz')) return 'component';
  if (name.includes('.cls.tsz')) return 'cls';
  if (name.includes('.script.tsz')) return 'script';
  if (name.includes('.mod.tsz')) return 'mod';
  if (name.includes('.app.tsz')) return 'app';
  if (name.includes('.tsz')) return 'tsz';
  const dot = name.lastIndexOf('.');
  if (dot < 0) return 'dir';
  return name.slice(dot + 1);
}

export function languageForType(type: string): string {
  if (type === 'settings') return 'Settings';
  if (type === 'component' || type === 'cls' || type === 'script' || type === 'mod' || type === 'app' || type === 'tsz') return 'TSZ';
  if (type === 'ts' || type === 'tsx') return 'TypeScript';
  if (type === 'js' || type === 'jsx') return 'JavaScript';
  if (type === 'zig') return 'Zig';
  if (type === 'md') return 'Markdown';
  if (type === 'json') return 'JSON';
  if (type === 'css') return 'CSS';
  if (type === 'sh') return 'Shell';
  if (type === 'home') return 'Workspace';
  return 'Plain Text';
}

export function fileTone(type: string): string {
  if (type === 'settings') return COLORS.purple;
  if (type === 'component') return COLORS.blue;
  if (type === 'cls') return COLORS.purple;
  if (type === 'script') return COLORS.green;
  if (type === 'mod') return COLORS.orange;
  if (type === 'app') return COLORS.red;
  if (type === 'tsz') return '#56d364';
  if (type === 'ts' || type === 'tsx') return '#2d62ff';
  if (type === 'js' || type === 'jsx') return COLORS.yellow;
  if (type === 'zig') return COLORS.orange;
  if (type === 'md') return COLORS.green;
  if (type === 'json') return '#56d364';
  if (type === 'css') return COLORS.purple;
  if (type === 'sh') return COLORS.blue;
  if (type === 'home') return '#2d62ff';
  if (type === 'workspace') return COLORS.green;
  if (type === 'dir') return '#4a5568';
  return '#6e6e6e';
}

export function fileGlyph(type: string): string {
  if (type === 'settings') return 'settings';
  if (type === 'component') return 'braces';
  if (type === 'cls') return 'palette';
  if (type === 'script') return 'file-code';
  if (type === 'mod') return 'package';
  if (type === 'app') return 'panel-left';
  if (type === 'tsz') return 'braces';
  if (type === 'ts' || type === 'tsx') return 'file-code';
  if (type === 'js' || type === 'jsx') return 'file-code';
  if (type === 'zig') return 'file-code';
  if (type === 'md') return 'file-text';
  if (type === 'json') return 'file-json';
  if (type === 'css') return 'palette';
  if (type === 'sh') return 'terminal';
  if (type === 'home') return 'home';
  if (type === 'workspace') return 'package';
  if (type === 'dir') return 'folder';
  return 'file-text';
}

export function statusLabel(code: string): string {
  if (code === '??') return 'new';
  if (code.includes('M')) return 'modified';
  if (code.includes('A')) return 'added';
  if (code.includes('D')) return 'deleted';
  if (code.includes('R')) return 'renamed';
  return 'dirty';
}

export function statusTone(code: string): string {
  if (code === '??') return '#2d62ff';
  if (code.includes('D')) return COLORS.red;
  if (code.includes('A')) return COLORS.green;
  if (code.includes('M')) return COLORS.yellow;
  return '#6e6e6e';
}

export function takeList<T>(list: T[], limit: number): T[] {
  if (limit <= 0 || list.length <= limit) return list;
  return list.slice(0, limit);
}

export function limitList<T>(list: T[], limit: number): T[] {
  if (limit <= 0 || list.length <= limit) return list;
  return list.slice(list.length - limit);
}

export function visibleTabs<T extends { id: string }>(list: T[], activeId: string, limit: number): T[] {
  if (limit <= 0 || list.length <= limit) return list;
  let out = limitList(list, limit);
  if (!out.some((tab) => tab.id === activeId)) {
    const active = list.find((tab) => tab.id === activeId);
    if (active) out = [...out.slice(1), active];
  }
  if (!out.some((tab) => tab.id === 'home')) {
    const home = list.find((tab) => tab.id === 'home');
    if (home) out = [home, ...out].slice(0, limit);
  }
  return out;
}

export function visibleBreadcrumbs<T>(list: T[], band: WidthBand): T[] {
  if (band === 'minimum') return [];
  if (band === 'widget' && list.length > 2) return [list[0], list[list.length - 1]];
  if (band === 'narrow' && list.length > 3) return [list[0], list[list.length - 2], list[list.length - 1]];
  return list;
}
