import { Box, Row } from '@reactjit/runtime/primitives';
import { Body, Mono } from './controlsSpecimenParts';
import { CTRL, type ControlTone, toneColor } from './controlsSpecimenTheme';

export type KeyValueBadgeProps = {
  label: string;
  value: string;
  tone?: ControlTone;
};

export function KeyValueBadge({
  label,
  value,
  tone = 'accent',
}: KeyValueBadgeProps) {
  const color = toneColor(tone);
  return (
    <Row style={{ borderWidth: 1, borderColor: color, backgroundColor: CTRL.bg1 }}>
      <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, backgroundColor: color }}>
        <Mono color={CTRL.bg} fontSize={9} fontWeight="bold" lineHeight={10} noWrap>{label}</Mono>
      </Box>
      <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
        <Body fontSize={12} lineHeight={14} noWrap>{value}</Body>
      </Box>
    </Row>
  );
}
