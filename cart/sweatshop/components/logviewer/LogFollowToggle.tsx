
import { Box, Pressable, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

export interface LogFollowToggleProps {
  follow: boolean;
  onToggle: () => void;
  live: boolean;
}

export function LogFollowToggle(props: LogFollowToggleProps) {
  return (
    <Pressable
      onPress={props.onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: 6,
        backgroundColor: props.follow ? COLORS.blueDeep : COLORS.grayChip,
        borderWidth: 1,
        borderColor: props.follow ? COLORS.blue : COLORS.border,
      }}
    >
      {props.follow && props.live ? (
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green }} />
      ) : null}
      <Text fontSize={9} color={props.follow ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>
        {props.follow ? 'TAIL' : 'PAUSE'}
      </Text>
    </Pressable>
  );
}
