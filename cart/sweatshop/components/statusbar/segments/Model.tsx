
import { Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function ModelSegment(props: any) {
  if (props.compactBand) return null;
  return (
    <StatusSegment
      onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}
      tooltip="Active model"
    >
      <Text fontSize={10} color={COLORS.blue}>{props.selectedModel}</Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'model',
  label: 'Model',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 160,
  component: ModelSegment,
});
