
import { Text } from '../../../../runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function IndentSegment(props: any) {
  if (props.compactBand) return null;
  const size = props.indentSize || 2;
  const style = props.indentStyle || 'spc';
  return (
    <StatusSegment tooltip="Indentation">
      <Text fontSize={10} color={COLORS.textDim}>{style === 'tab' ? 'Tab' : `${size} SPC`}</Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'indent',
  label: 'Indent',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 130,
  component: IndentSegment,
});
