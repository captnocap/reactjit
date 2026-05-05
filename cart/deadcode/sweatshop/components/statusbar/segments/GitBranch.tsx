
import { Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../../theme';
import { Icon } from '../../icons';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

function copyToClipboard(text: string): void {
  const host: any = globalThis;
  if (typeof host.__clipboard_set === 'function') {
    try { host.__clipboard_set(text); } catch {}
  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try { navigator.clipboard.writeText(text); } catch {}
  }
}

export function GitBranchSegment(props: any) {
  return (
    <StatusSegment
      onPress={() => copyToClipboard(props.gitBranch)}
      tooltip="Click to copy branch"
    >
      <Icon name="git-branch" size={12} color={COLORS.green} />
      <Text fontSize={10} color={COLORS.textBright}>{props.gitBranch}</Text>
      {!props.compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.gitRemote}</Text> : null}
    </StatusSegment>
  );
}

registerSegment({
  id: 'git-branch',
  label: 'Git Branch',
  defaultPosition: 'left',
  defaultVisible: true,
  priority: 10,
  component: GitBranchSegment,
});
