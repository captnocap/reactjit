import { StatusBadge } from '../controls-specimen/StatusBadge';
import type { ControlTone } from '../controls-specimen/controlsSpecimenTheme';

type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

const TONES: Record<Tone, ControlTone> = {
  neutral: 'neutral',
  success: 'ok',
  warning: 'warn',
  error: 'flag',
  info: 'blue',
};

export function IntentBadge({ tone = 'neutral', children }: { tone?: Tone; children?: any }) {
  return <StatusBadge label={textContent(children)} tone={TONES[tone] ?? TONES.neutral} variant="pill" />;
}

function textContent(value: any): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(textContent).join('');
  return String(value);
}
