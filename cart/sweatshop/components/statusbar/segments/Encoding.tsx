
import { Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function EncodingSegment(props: any) {
  if (props.compactBand) return null;
  return (
    <StatusSegment
      onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}
      tooltip="Encoding"
    >
      <Text fontSize={10} color={COLORS.textDim}>{props.encoding || 'UTF-8'}</Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'encoding',
  label: 'Encoding',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 110,
  component: EncodingSegment,
});
