
import { Box, Pressable, Text } from '../../../../../runtime/primitives';
import { COLORS, TOKENS, useTheme } from '../../../theme';

export function ThemeShuffleTile() {
  const theme = useTheme();
  return (
    <Box style={{ width: '100%', height: '100%', padding: TOKENS.spaceSm, justifyContent: 'center', alignItems: 'center', gap: TOKENS.spaceXs }}>
      <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>THEME</Text>
      <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{theme.name}</Text>
      <Pressable
        onPress={() => {
          const names = ['soft', 'sharp', 'studio', 'high-contrast'];
          const next = names[Math.floor(Math.random() * names.length)];
          theme.setTheme(next);
        }}
        style={{
          paddingLeft: TOKENS.spaceSm,
          paddingRight: TOKENS.spaceSm,
          paddingTop: TOKENS.spaceXs,
          paddingBottom: TOKENS.spaceXs,
          borderRadius: TOKENS.radiusPill,
          backgroundColor: COLORS.blueDeep,
          borderWidth: 1,
          borderColor: COLORS.blue,
        }}
      >
        <Text fontSize={10} color={COLORS.blue}>Shuffle</Text>
      </Pressable>
    </Box>
  );
}
