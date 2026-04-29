import { Row } from '@reactjit/runtime/primitives';
import { Body, Mono } from './controlsSpecimenParts';
import { CTRL } from './controlsSpecimenTheme';

export type MetricBadgeProps = {
  label: string;
  value: string;
  unit?: string;
};

export function MetricBadge({
  label,
  value,
  unit,
}: MetricBadgeProps) {
  return (
    <Row style={{ gap: 10, alignItems: 'flex-end', padding: 10, borderWidth: 1, borderColor: CTRL.ruleBright, backgroundColor: CTRL.bg2 }}>
      <Mono color={CTRL.inkDimmer}>{label}</Mono>
      <Body fontSize={18} color={CTRL.accent}>{value}</Body>
      {unit ? <Mono color={CTRL.inkDim}>{unit}</Mono> : null}
    </Row>
  );
}
