
import { Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function MemoryTelemetrySegment(props: any) {
  if (props.compactBand || props.mediumBand) return null;
  return (
    <StatusSegment
      onPress={props.onOpenSettings ? () => props.onOpenSettings('memory') : undefined}
      tooltip={`Input token estimate: ${props.inputTokenEstimate || 0}`}
    >
      <Text fontSize={10} color={COLORS.textDim}>
        {props.inputTokenEstimate > 0 ? `in ${props.inputTokenEstimate}` : '—'}
      </Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'memory-telemetry',
  label: 'Memory Telemetry',
  defaultPosition: 'left',
  defaultVisible: true,
  priority: 38,
  component: MemoryTelemetrySegment,
});
