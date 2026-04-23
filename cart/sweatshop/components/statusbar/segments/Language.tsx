
import { Text } from '../../../../runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function LanguageSegment(props: any) {
  return (
    <StatusSegment
      onPress={props.onOpenSettings ? () => props.onOpenSettings('providers') : undefined}
      tooltip="Language mode"
    >
      <Text fontSize={10} color={COLORS.textDim}>{props.languageMode}</Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'language',
  label: 'Language',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 150,
  component: LanguageSegment,
});
