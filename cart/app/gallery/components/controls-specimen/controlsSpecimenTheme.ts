import { getActiveGalleryThemeValue, subscribeGalleryTheme } from '../../gallery-theme';

type ControlThemeState = {
  pageWidth: number;
  pagePadding: number;
  bg: string;
  bg1: string;
  bg2: string;
  bg3: string;
  ink: string;
  inkDim: string;
  inkDimmer: string;
  inkGhost: string;
  rule: string;
  ruleBright: string;
  accent: string;
  accentHot: string;
  ok: string;
  warn: string;
  flag: string;
  lilac: string;
  blue: string;
  shadow: string;
  softAccent: string;
  softOk: string;
  softFlag: string;
  mono: string;
  sans: string;
  cardTallMinHeight: number;
  cardMinHeight: number;
  cardWide: number;
  cardMedium: number;
  cardNarrow: number;
};

const DEFAULT_CTRL: ControlThemeState = {
  pageWidth: 860,
  pagePadding: 24,
  bg: 'theme:bg',
  bg1: 'theme:bg1',
  bg2: 'theme:bg2',
  bg3: 'theme:bg2',
  ink: 'theme:ink',
  inkDim: 'theme:inkDim',
  inkDimmer: 'theme:inkDimmer',
  inkGhost: 'theme:inkGhost',
  rule: 'theme:rule',
  ruleBright: 'theme:ruleBright',
  accent: 'theme:accent',
  accentHot: 'theme:accentHot',
  ok: 'theme:ok',
  warn: 'theme:warn',
  flag: 'theme:flag',
  lilac: 'theme:lilac',
  blue: 'theme:blue',
  shadow: 'theme:accent',
  softAccent: 'theme:bg2',
  softOk: 'theme:bg2',
  softFlag: 'theme:bg2',
  mono: 'monospace',
  sans: 'sans-serif',
  cardTallMinHeight: 184,
  cardMinHeight: 144,
  cardWide: 412,
  cardMedium: 274,
  cardNarrow: 205,
};

export const CTRL: ControlThemeState = { ...DEFAULT_CTRL };

function firstString(paths: string[], fallback: string): string {
  for (const path of paths) {
    const value = getActiveGalleryThemeValue(path);
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return fallback;
}

function firstNumber(paths: string[], fallback: number): number {
  for (const path of paths) {
    const value = getActiveGalleryThemeValue(path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function syncControlTheme(): void {
  const accent = firstString(['accent.accent'], DEFAULT_CTRL.accent);
  const accentHot = firstString(['accent.accentHot', 'accent.accent'], DEFAULT_CTRL.accentHot);
  const ok = firstString(['state.ok', 'accent.success'], DEFAULT_CTRL.ok);
  const warn = firstString(['state.warn', 'accent.warning'], DEFAULT_CTRL.warn);
  const flag = firstString(['state.flag', 'accent.danger'], DEFAULT_CTRL.flag);
  const lilac = firstString(['auxiliary.lilac', 'categories.ctx'], DEFAULT_CTRL.lilac);
  const blue = firstString(['auxiliary.blue', 'categories.sys', 'accent.accent'], DEFAULT_CTRL.blue);
  const ink = firstString(['ink.ink', 'text.text'], DEFAULT_CTRL.ink);

  Object.assign(CTRL, {
    ...DEFAULT_CTRL,
    pagePadding: firstNumber(['spacing.x7', 'layout.spaceLg'], DEFAULT_CTRL.pagePadding),
    bg: firstString(['surfaces.bg'], DEFAULT_CTRL.bg),
    bg1: firstString(['surfaces.bg1', 'surfaces.surface', 'surfaces.panel'], DEFAULT_CTRL.bg1),
    bg2: firstString(['surfaces.bg2', 'surfaces.panel', 'surfaces.surface'], DEFAULT_CTRL.bg2),
    bg3: firstString(['surfaces.bg3', 'surfaces.panelAlt', 'surfaces.panelActive'], DEFAULT_CTRL.bg3),
    ink,
    inkDim: firstString(['ink.inkDim', 'text.textMuted'], DEFAULT_CTRL.inkDim),
    inkDimmer: firstString(['ink.inkDimmer', 'text.textSubtle', 'text.textMuted'], DEFAULT_CTRL.inkDimmer),
    inkGhost: firstString(['ink.inkGhost', 'rules.rule', 'text.textSubtle'], DEFAULT_CTRL.inkGhost),
    rule: firstString(['rules.rule', 'surfaces.border'], DEFAULT_CTRL.rule),
    ruleBright: firstString(['rules.ruleBright', 'accent.accentHot', 'accent.accent'], DEFAULT_CTRL.ruleBright),
    accent,
    accentHot,
    ok,
    warn,
    flag,
    lilac,
    blue,
    shadow: firstString(['decorative.shadow'], DEFAULT_CTRL.shadow),
    softAccent: firstString(['decorative.softAccent', 'surfaces.bg2', 'surfaces.panel'], DEFAULT_CTRL.softAccent),
    softOk: firstString(['decorative.softOk', 'surfaces.bg2', 'surfaces.panel'], DEFAULT_CTRL.softOk),
    softFlag: firstString(['decorative.softFlag', 'surfaces.bg2', 'surfaces.panel'], DEFAULT_CTRL.softFlag),
    mono: firstString(['typography.fontMono'], DEFAULT_CTRL.mono),
    sans: firstString(['typography.fontSans'], DEFAULT_CTRL.sans),
  });
}

syncControlTheme();
subscribeGalleryTheme(syncControlTheme);

export type ControlTone =
  | 'default'
  | 'accent'
  | 'ok'
  | 'warn'
  | 'flag'
  | 'blue'
  | 'lilac'
  | 'ink'
  | 'neutral';

export function toneColor(tone: ControlTone = 'default'): string {
  switch (tone) {
    case 'accent':
      return CTRL.accent;
    case 'ok':
      return CTRL.ok;
    case 'warn':
      return CTRL.warn;
    case 'flag':
      return CTRL.flag;
    case 'blue':
      return CTRL.blue;
    case 'lilac':
      return CTRL.lilac;
    case 'ink':
      return CTRL.ink;
    case 'neutral':
      return CTRL.inkDim;
    default:
      return CTRL.ruleBright;
  }
}

export function toneSoftBackground(tone: ControlTone = 'default'): string {
  switch (tone) {
    case 'accent':
      return CTRL.softAccent;
    case 'ok':
      return CTRL.softOk;
    case 'flag':
      return CTRL.softFlag;
    case 'warn':
      return CTRL.bg2;
    case 'blue':
      return CTRL.bg2;
    case 'lilac':
      return CTRL.bg2;
    case 'ink':
      return CTRL.bg2;
    default:
      return CTRL.bg2;
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
