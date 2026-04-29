import { Box, Row, Text, Pressable } from '@reactjit/runtime/primitives';
import { COLORS } from '../constants';

export default function TabButton({
  label,
  active,
  onPress,
  badge,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 8,
        paddingBottom: 8,
        borderBottomWidth: active ? 2 : 0,
        borderColor: active ? COLORS.accentLight : 'transparent',
        backgroundColor: active ? COLORS.bgPanel : 'transparent',
      }}
    >
      <Row style={{ gap: 6, alignItems: 'center' }}>
        <Text
          fontSize={11}
          color={active ? COLORS.textBright : COLORS.textDim}
          style={{ fontWeight: active ? 'bold' : 'normal' }}
        >
          {label}
        </Text>
        {badge ? (
          <Box
            style={{
              backgroundColor: active ? COLORS.bgHover : COLORS.bgElevated,
              borderRadius: 8,
              paddingLeft: 5,
              paddingRight: 5,
              paddingTop: 1,
              paddingBottom: 1,
              minWidth: 16,
              alignItems: 'center',
            }}
          >
            <Text fontSize={9} color={active ? COLORS.textMuted : COLORS.textDim}>
              {String(badge)}
            </Text>
          </Box>
        ) : null}
      </Row>
    </Pressable>
  );
}
