
import { Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function FileInfoSegment(props: any) {
  if (props.mediumBand) return null;
  const name = props.fileName === '__landing__' ? props.workDir
    : props.fileName === '__settings__' ? 'Settings'
    : props.fileName;
  return (
    <StatusSegment tooltip="Current file">
      <Text fontSize={10} color={COLORS.textDim}>{name}</Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'file-info',
  label: 'File Info',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 100,
  component: FileInfoSegment,
});
