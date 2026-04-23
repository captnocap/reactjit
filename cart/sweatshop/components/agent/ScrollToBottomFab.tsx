import { Box } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable } from '../shared';
import { Icon } from '../icons';
import { Tooltip } from '../tooltip';

export function ScrollToBottomFab(props: { visible: boolean; onPress: () => void }) {
  if (!props.visible) return null;
  return (
    <Box style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 10 }}>
      <Tooltip label="Scroll to newest message" side="left">
        <HoverPressable onPress={props.onPress} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="arrow-down" size={14} color={COLORS.blue} />
        </HoverPressable>
      </Tooltip>
    </Box>
  );
}
