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
  surface: '#14100d',
  panel: '#0e0b09',
  borderColor: '#5a8bd6',
  frameColor: '#8a7fd4',
  topBarColor: '#d26a2a',
  panelBorder: '#5a8bd6',
  dataPanelBorder: '#5a8bd6',
  metricTrack: '#4a4238',
  metricTrackBorder: '#5a8bd6',
  bodyText: '#f2e8dc',
  mutedText: '#b8a890',
  eyebrowText: '#b8a890',
  scoreText: '#6ac3d6',
  rowIndexText: '#7a6e5d',
  rowLabelText: '#f2e8dc',
  sketchHot: '#d26a2a',
  sketchCool: '#6ac3d6',
  sketchOk: '#6aa390',
} as const;

export const DEFAULT_GENERIC_CARD_ROWS: GenericCardRow[] = [
  { label: 'Item one', value: 'Ready', tone: 'cool' },
  { label: 'Item two', value: 'Queued', tone: 'warm' },
  { label: 'Item three', value: 'Open', tone: 'soft' },
  { label: 'Item four', value: 'Next', tone: 'cool' },
];

export const DEFAULT_GENERIC_CARD_METRICS: GenericCardMetric[] = [
  { label: 'Primary', value: '72%', fill: 0.72, color: '#6ac3d6' },
  { label: 'Secondary', value: '48%', fill: 0.48, color: '#8a7fd4' },
  { label: 'Accent', value: '31%', fill: 0.31, color: '#d26a2a' },
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
      return '#6ac3d6';
    case 'warm':
      return '#d48aa7';
    default:
      return '#b8a890';
  }
}

export function genericCardSketchLineColor(index: number, count: number): string {
  if (index === count - 1) return GENERIC_CARD.sketchHot;
  if (index > 3) return GENERIC_CARD.sketchOk;
  return GENERIC_CARD.sketchCool;
}
