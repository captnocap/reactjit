import { VerticalSpine } from './controlsSpecimenParts';
import { type ControlTone } from './controlsSpecimenTheme';

export type VerticalBadgeProps = {
  label: string;
  tone?: ControlTone;
  solid?: boolean;
};

export function VerticalBadge({
  label,
  tone = 'accent',
  solid = false,
}: VerticalBadgeProps) {
  return <VerticalSpine label={label} tone={tone} solid={solid} minWidth={30} padding={10} />;
}
