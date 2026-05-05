export type GenericCardTone = 'soft' | 'cool' | 'warm';

export type GenericCardRow = {
  label: string;
  value: string;
  tone?: GenericCardTone;
};

export type GenericCardMetric = {
  label: string;
  value: string;
  fill: number;
  color: string;
};

export type GenericCardProps = {
  eyebrow?: string;
  score?: string;
  title?: string;
  subtitle?: string;
  rows?: GenericCardRow[];
  metrics?: GenericCardMetric[];
  sketchLines?: string[];
};

export const GENERIC_CARD = {
  width: 336,
  trackWidth: 112,
  surface: 'theme:bg1',
  panel: 'theme:bg',
  borderColor: 'theme:blue',
  frameColor: 'theme:lilac',
  topBarColor: 'theme:accent',
  panelBorder: 'theme:blue',
  dataPanelBorder: 'theme:blue',
  metricTrack: 'theme:inkGhost',
  metricTrackBorder: 'theme:blue',
  bodyText: 'theme:ink',
  mutedText: 'theme:inkDim',
  eyebrowText: 'theme:inkDim',
  scoreText: 'theme:tool',
  rowIndexText: 'theme:inkDimmer',
  rowLabelText: 'theme:ink',
  sketchHot: 'theme:accent',
  sketchCool: 'theme:tool',
  sketchOk: 'theme:ok',
} as const;

export const DEFAULT_GENERIC_CARD_ROWS: GenericCardRow[] = [
  { label: 'Item one', value: 'Ready', tone: 'cool' },
  { label: 'Item two', value: 'Queued', tone: 'warm' },
  { label: 'Item three', value: 'Open', tone: 'soft' },
  { label: 'Item four', value: 'Next', tone: 'cool' },
];

export const DEFAULT_GENERIC_CARD_METRICS: GenericCardMetric[] = [
  { label: 'Primary', value: '72%', fill: 0.72, color: 'theme:tool' },
  { label: 'Secondary', value: '48%', fill: 0.48, color: 'theme:lilac' },
  { label: 'Accent', value: '31%', fill: 0.31, color: 'theme:accent' },
];

export const DEFAULT_GENERIC_CARD_SKETCH_LINES = [
  '        ..             ..       ',
  '      ..  ..         ..  ..     ',
  '    ..      ..     ..      ..   ',
  ' ..           .. ..          .. ',
  '............  ...  ............',
  '      --        --        --    ',
];

export const DEFAULT_GENERIC_CARD_EYEBROW = '1 card   menu   preset *';
export const DEFAULT_GENERIC_CARD_SCORE = '79%';
export const DEFAULT_GENERIC_CARD_TITLE = 'Standard Card';
export const DEFAULT_GENERIC_CARD_SUBTITLE = 'Supporting text for the card.';

export function clampGenericCardFill(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function genericCardToneColor(tone: GenericCardTone = 'soft'): string {
  switch (tone) {
    case 'cool':
      return 'theme:tool';
    case 'warm':
      return 'theme:atch';
    default:
      return 'theme:inkDim';
  }
}

export function genericCardSketchLineColor(index: number, count: number): string {
  if (index === count - 1) return GENERIC_CARD.sketchHot;
  if (index > 3) return GENERIC_CARD.sketchOk;
  return GENERIC_CARD.sketchCool;
}
