const React: any = require('react');

import { Text } from '../../../../runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function GitAheadBehindSegment(props: any) {
  if (props.compactBand) return null;
  return (
    <StatusSegment onPress={props.onOpenGitPanel} tooltip="Ahead / behind upstream">
      <Text fontSize={10} color={props.branchAhead > 0 ? COLORS.green : COLORS.textDim}>↑{props.branchAhead}</Text>
      <Text fontSize={10} color={props.branchBehind > 0 ? COLORS.red : COLORS.textDim}>↓{props.branchBehind}</Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'git-ahead-behind',
  label: 'Git Ahead / Behind',
  defaultPosition: 'left',
  defaultVisible: true,
  priority: 15,
  component: GitAheadBehindSegment,
});
