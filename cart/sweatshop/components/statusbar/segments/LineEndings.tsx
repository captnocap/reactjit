
import { Text } from '../../../../runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function LineEndingsSegment(props: any) {
  if (props.compactBand) return null;
  return (
    <StatusSegment
      onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}
      tooltip="Line ending"
    >
      <Text fontSize={10} color={COLORS.textDim}>{props.lineEnding || 'LF'}</Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'line-endings',
  label: 'Line Endings',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 120,
  component: LineEndingsSegment,
});
