
import { Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function CursorPosSegment(props: any) {
  return (
    <StatusSegment tooltip={`Ln ${props.cursorLine}, Col ${props.cursorColumn}`}>
      <Text fontSize={10} color={COLORS.textDim}>Ln {props.cursorLine}</Text>
      <Text fontSize={10} color={COLORS.textDim}>Col {props.cursorColumn}</Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'cursor-pos',
  label: 'Cursor Position',
  defaultPosition: 'left',
  defaultVisible: true,
  priority: 40,
  component: CursorPosSegment,
});
