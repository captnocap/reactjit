
import { Text } from '../../../../runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function ProblemsSegment(props: any) {
  const errs = props.errors || 0;
  const warns = props.warnings || 0;
  if (!errs && !warns) return null;
  return (
    <StatusSegment tooltip="Problems">
      {errs > 0 ? <Text fontSize={10} color={COLORS.red}>{errs}●</Text> : null}
      {warns > 0 ? <Text fontSize={10} color={COLORS.yellow}>{warns}▲</Text> : null}
    </StatusSegment>
  );
}

registerSegment({
  id: 'problems',
  label: 'Problems',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 140,
  component: ProblemsSegment,
});
