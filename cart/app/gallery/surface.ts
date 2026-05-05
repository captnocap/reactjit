// Gallery chrome surface + dark panel palette.
//
// Legacy shell code still imports COLORS / PAGE_SURFACE directly instead of
// rendering through components.cls.ts. Keep this as a compatibility bridge:
// gallery-theme.ts mutates these objects from the active theme tokens so the
// shell follows runtime theme switches until those call sites are classified.

const DEFAULT_PAGE_SURFACE = {
  id: 'page',
  label: 'Page Surface',
  width: 960,
  minHeight: 640,
  padding: 32,
  backgroundColor: 'theme:paper',
  borderColor: 'theme:paperRuleBright',
  textColor: 'theme:paperInk',
  mutedTextColor: 'theme:paperInkDim',
  radius: 8,
};

const DEFAULT_COLORS = {
  appBg: 'theme:bg',
  railBg: 'theme:bg1',
  panelBg: 'theme:bg2',
  panelRaised: 'theme:rule',
  border: 'theme:rule',
  borderStrong: 'theme:ruleBright',
  text: 'theme:ink',
  muted: 'theme:inkDim',
  faint: 'theme:inkDimmer',
  accent: 'theme:accent',
  accentInk: 'theme:bg',
  success: 'theme:ok',
  warning: 'theme:warn',
  compose: 'theme:lilac',
  previewBg: 'theme:paper',
};

export const PAGE_SURFACE = { ...DEFAULT_PAGE_SURFACE };
export type GallerySurface = typeof PAGE_SURFACE;

export const COLORS = { ...DEFAULT_COLORS };

type TokenLookup = Record<string, unknown> | null | undefined;

function stringToken(tokens: TokenLookup, path: string, fallback: string): string {
  const value = tokens?.[path];
  return typeof value === 'string' ? value : fallback;
}

function numberToken(tokens: TokenLookup, path: string, fallback: number): number {
  const value = tokens?.[path];
  return typeof value === 'number' ? value : fallback;
}

export function applyGallerySurfaceTheme(tokens: TokenLookup): void {
  const bg = stringToken(tokens, 'surfaces.bg', DEFAULT_COLORS.appBg);
  const bg1 = stringToken(tokens, 'surfaces.bg1', DEFAULT_COLORS.railBg);
  const bg2 = stringToken(tokens, 'surfaces.bg2', DEFAULT_COLORS.panelBg);
  const rule = stringToken(tokens, 'rules.rule', DEFAULT_COLORS.border);
  const ruleBright = stringToken(tokens, 'rules.ruleBright', DEFAULT_COLORS.borderStrong);
  const ink = stringToken(tokens, 'ink.ink', DEFAULT_COLORS.text);
  const inkDim = stringToken(tokens, 'ink.inkDim', DEFAULT_COLORS.muted);
  const inkDimmer = stringToken(tokens, 'ink.inkDimmer', DEFAULT_COLORS.faint);
  const paper = stringToken(tokens, 'paper.paper', DEFAULT_PAGE_SURFACE.backgroundColor);
  const paperInk = stringToken(tokens, 'paper.paperInk', DEFAULT_PAGE_SURFACE.textColor);
  const paperInkDim = stringToken(tokens, 'paper.paperInkDim', DEFAULT_PAGE_SURFACE.mutedTextColor);
  const paperRuleBright = stringToken(tokens, 'paper.paperRuleBright', DEFAULT_PAGE_SURFACE.borderColor);

  Object.assign(PAGE_SURFACE, {
    backgroundColor: paper,
    borderColor: paperRuleBright,
    textColor: paperInk,
    mutedTextColor: paperInkDim,
    radius: numberToken(tokens, 'radius.lg', DEFAULT_PAGE_SURFACE.radius),
  });

  Object.assign(COLORS, {
    appBg: bg,
    railBg: bg1,
    panelBg: bg2,
    panelRaised: rule,
    border: rule,
    borderStrong: ruleBright,
    text: ink,
    muted: inkDim,
    faint: inkDimmer,
    accent: stringToken(tokens, 'accent.accent', DEFAULT_COLORS.accent),
    accentInk: bg,
    success: stringToken(tokens, 'state.ok', DEFAULT_COLORS.success),
    warning: stringToken(tokens, 'state.warn', DEFAULT_COLORS.warning),
    compose: stringToken(tokens, 'auxiliary.lilac', DEFAULT_COLORS.compose),
    previewBg: paper,
  });
}
