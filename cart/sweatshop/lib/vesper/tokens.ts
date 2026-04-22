export const VESPER_TOKENS = {
  name: 'vesper',
  label: 'Vesper',
  corner: 'soft' as const,
  density: 'comfortable' as const,
  radiusNone: 0,
  radiusXs: 1,
  radiusSm: 2,
  radiusMd: 4,
  radiusLg: 6,
  radiusPill: 9999,
  spaceXxs: 2,
  spaceXs: 4,
  spaceSm: 6,
  spaceMd: 10,
  spaceLg: 14,
  spaceXl: 20,
  spaceXxl: 28,
  padTight: 4,
  padNormal: 8,
  padLoose: 12,
  rowHeight: 24,
  chromeHeight: 32,
  borderW: 1,
  shadowDepth: 1,
  fontUI: 'JetBrains Mono, Menlo, Consolas, monospace',
  fontMono: 'JetBrains Mono, Menlo, Consolas, monospace',
  fontXs: 10,
  fontSm: 11,
  fontMd: 13,
  fontLg: 15,
  fontXl: 18,
  typeXs: 10,
  typeSm: 11,
  typeBase: 13,
  typeLg: 15,
  typeXl: 18,
  shadow0: 'none',
  shadow1: '0 1px 2px rgba(0,0,0,0.25)',
  shadow2: '0 2px 6px rgba(0,0,0,0.30)',
  shadow3: '0 6px 14px rgba(0,0,0,0.35)',
  shadow4: '0 14px 32px rgba(0,0,0,0.45)',
  zBase: 0,
  zDock: 50,
  zOverlay: 500,
  zModal: 1000,
  zToast: 2000,
  timingFast: 120,
  timingBase: 220,
  timingSlow: 420,
} as const;

export const VESPER_PALETTE = {
  appBg: '#0a0a0a',
  panelBg: '#0c0c10',
  panelRaised: '#0e0e12',
  panelAlt: '#111116',
  panelHover: '#12131a',
  border: '#222222',
  borderSoft: '#1a1a1a',
  text: 'rgba(255, 255, 255, 0.92)',
  textBright: '#ffffff',
  textDim: 'rgba(255, 255, 255, 0.40)',
  textMuted: 'rgba(255, 255, 255, 0.25)',
  blue: '#4A90D9',
  blueDeep: 'rgba(74, 144, 217, 0.12)',
  green: '#10B981',
  greenDeep: 'rgba(16, 185, 129, 0.12)',
  yellow: '#F59E0B',
  yellowDeep: 'rgba(245, 158, 11, 0.12)',
  orange: '#D97757',
  orangeDeep: 'rgba(217, 119, 87, 0.12)',
  red: '#EF4444',
  redDeep: 'rgba(239, 68, 68, 0.12)',
  purple: '#8B5CF6',
  purpleDeep: 'rgba(139, 92, 246, 0.12)',
  grayChip: '#16161c',
  grayDeep: '#0f0f14',
} as const;

export type VesperTone = 'accent' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'user' | 'assistant' | 'tool';

export function vesperToneColor(tone: VesperTone, palette: typeof VESPER_PALETTE = VESPER_PALETTE): string {
  switch (tone) {
    case 'primary':
    case 'accent':
      return palette.purple;
    case 'success':
    case 'user':
      return palette.green;
    case 'warning':
    case 'assistant':
      return palette.yellow;
    case 'danger':
      return palette.red;
    case 'info':
    case 'tool':
      return palette.blue;
    case 'muted':
    default:
      return palette.textDim;
  }
}
