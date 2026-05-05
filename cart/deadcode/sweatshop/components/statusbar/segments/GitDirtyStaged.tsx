
import { Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../../theme';
import { Icon } from '../../icons';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function GitDirtyStagedSegment(props: any) {
  return (
    <StatusSegment onPress={props.onOpenGitPanel} tooltip="Modified / staged files">
      {props.changedCount > 0 ? <Icon name="warn" size={12} color={COLORS.yellow} /> : null}
      {props.changedCount > 0 ? <Text fontSize={10} color={COLORS.yellow}>{props.changedCount}</Text> : null}
      {!props.mediumBand && props.stagedCount > 0 ? <Icon name="error" size={12} color={COLORS.green} /> : null}
      {!props.mediumBand && props.stagedCount > 0 ? <Text fontSize={10} color={COLORS.green}>{props.stagedCount}</Text> : null}
    </StatusSegment>
  );
}

registerSegment({
  id: 'git-dirty-staged',
  label: 'Git Dirty / Staged',
  defaultPosition: 'left',
  defaultVisible: true,
  priority: 18,
  component: GitDirtyStagedSegment,
});
