import { KeyValueBadge } from '../controls-specimen/KeyValueBadge';
import type { ControlTone } from '../controls-specimen/controlsSpecimenTheme';

export type TooltipDataRowProps = {
  label?: string;
  value?: string;
  tone?: ControlTone;
};

export function TooltipDataRow({
  label = 'Latency',
  value = '42 ms',
  tone = 'accent',
}: TooltipDataRowProps) {
  return <KeyValueBadge label={label} value={value} tone={tone} />;
}
