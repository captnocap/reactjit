
import { Box, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';
import { XPBar } from '../../sparkline';

export function XpLevelSegment(props: any) {
  const indexStats = props.indexStats || { totalFiles: 0, totalTokens: 0 };
  return (
    <StatusSegment
      onPress={props.onOpenSettings ? () => props.onOpenSettings('index') : undefined}
      tooltip={`Indexed: ${indexStats.totalFiles} files`}
    >
      <XPBar
        fill={Math.min(1, indexStats.totalFiles / 500)}
        color={COLORS.blue}
        glow={indexStats.totalFiles > 0}
        width={50}
        height={6}
        label={`LV${Math.floor(indexStats.totalFiles / 50)}`}
      />
    </StatusSegment>
  );
}

registerSegment({
  id: 'xp-level',
  label: 'Indexing XP Bar',
  defaultPosition: 'left',
  defaultVisible: true,
  priority: 30,
  component: XpLevelSegment,
});
