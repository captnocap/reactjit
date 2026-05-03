import { Box } from '@reactjit/runtime/primitives';
import { VerticalSpine } from './controlsSpecimenParts';
import { type ControlTone } from './controlsSpecimenTheme';

export type VerticalCautionBadgeProps = {
  label: string;
  tone?: ControlTone;
};

export function VerticalCautionBadge({
  label,
  tone = 'warn',
}: VerticalCautionBadgeProps) {
  return (
    <Box style={{ padding: 4, borderWidth: 1 }}>
      <VerticalSpine label={label} tone={tone} solid={true} minWidth={32} padding={12} />
    </Box>
  );
}
