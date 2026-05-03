import { InlinePill } from './controlsSpecimenParts';
import { type ControlTone } from './controlsSpecimenTheme';

export type TierBadgeProps = {
  label: string;
  tone?: ControlTone;
};

export function TierBadge({ label, tone = 'ink' }: TierBadgeProps) {
  return <InlinePill label={label} tone={tone} solid={tone === 'ink'} />;
}
