/**
 * Theme palettes for Vesper.
 *
 * applyTheme(name) mutates C in place so all components pick up new
 * values on the next React render without any context providers.
 */
import { C } from './theme';

export type ThemeName = 'dark' | 'light' | 'solarized';

type Palette = typeof C;

export const THEMES: Record<ThemeName, Palette> = {
  // ── Void — abyssal navy (default) ─────────────────────────────────
  dark: {
    bg:           '#080c1e',
    bgDeep:       '#04060f',
    surface:      '#0e1530',
    surfaceHover: '#172045',
    border:       '#1e2e5a',
    borderActive: '#4d7fff',
    text:         '#d6e8ff',
    textDim:      '#6e88c0',
    textMuted:    '#3d5080',
    accent:       '#7db8ff',
    accentDim:    '#3366ee',
    approve:      '#5ef58e',
    allowAll:     '#7db8ff',
    deny:         '#ff6b88',
    warning:      '#ffb86c',
    panelA:       '#060c1e',
    panelB:       '#07180d',
    panelC:       '#1c0a08',
    panelD:       '#16120a',
    panelE:       '#06131e',
    panelF:       '#130a22',
    panelG:       '#1c0a14',
  },

  // ── Paper — off-white ink on cream ────────────────────────────────
  light: {
    bg:           '#f4f4f0',
    bgDeep:       '#e8e8e4',
    surface:      '#ffffff',
    surfaceHover: '#ebebeb',
    border:       '#d0d0cc',
    borderActive: '#0055cc',
    text:         '#1a1a28',
    textDim:      '#4a4a66',
    textMuted:    '#8888a0',
    accent:       '#0055cc',
    accentDim:    '#0033aa',
    approve:      '#008822',
    allowAll:     '#0055cc',
    deny:         '#cc2244',
    warning:      '#bb6600',
    panelA:       '#eeeeea',
    panelB:       '#eef4ee',
    panelC:       '#f4eeee',
    panelD:       '#f2f0ea',
    panelE:       '#eef2f4',
    panelF:       '#f0eef4',
    panelG:       '#f4eef2',
  },

  // ── Solarized — Ethan Schoonover's classic dark ───────────────────
  solarized: {
    bg:           '#002b36',
    bgDeep:       '#001e26',
    surface:      '#073642',
    surfaceHover: '#0d4555',
    border:       '#1a4a5a',
    borderActive: '#268bd2',
    text:         '#fdf6e3',
    textDim:      '#93a1a1',
    textMuted:    '#586e75',
    accent:       '#268bd2',
    accentDim:    '#1a6aaa',
    approve:      '#859900',
    allowAll:     '#268bd2',
    deny:         '#dc322f',
    warning:      '#b58900',
    panelA:       '#012730',
    panelB:       '#002c1a',
    panelC:       '#2c0a00',
    panelD:       '#1c1800',
    panelE:       '#001c2c',
    panelF:       '#180a2c',
    panelG:       '#2c001c',
  },
};

/** Mutate C in place so all components see new colors on next render. */
export function applyTheme(name: ThemeName) {
  const palette = THEMES[name];
  if (!palette) return;
  Object.assign(C, palette);
}

export const THEME_META: Array<{
  id:      ThemeName;
  label:   string;
  desc:    string;
  preview: string;   // representative bg color for the swatch
  fg:      string;   // swatch text color
}> = [
  { id: 'dark',      label: 'Void',      desc: 'Abyssal navy · default',         preview: '#080c1e', fg: '#7db8ff' },
  { id: 'light',     label: 'Paper',     desc: 'Off-white ink on cream',          preview: '#f4f4f0', fg: '#0055cc' },
  { id: 'solarized', label: 'Solarized', desc: "Ethan Schoonover's classic",      preview: '#002b36', fg: '#268bd2' },
];
