import { Box, Row } from '@reactjit/runtime/primitives';
import { Mono } from './controlsSpecimenParts';
import { CTRL, type ControlTone, toneColor } from './controlsSpecimenTheme';

export type CautionBadgeProps = {
  label: string;
  tone?: ControlTone;
};

export function CautionBadge({
  label,
  tone = 'warn',
}: CautionBadgeProps) {
  const color = toneColor(tone);
  return (
    <Row style={{ borderWidth: 1, borderColor: color, backgroundColor: CTRL.bg1 }}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Box key={index} style={{ width: 8, height: 24, backgroundColor: index % 2 === 0 ? color : CTRL.bg1 }} />
      ))}
      <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5 }}>
        <Mono color={color} fontSize={10} fontWeight="bold">{label}</Mono>
      </Box>
    </Row>
  );
}
