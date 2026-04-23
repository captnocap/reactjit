import { Box, Row, Text, TextInput, Pressable } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export function SettingsSearchInput(props: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <Row style={{
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: TOKENS.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.panelBg,
    }}>
      <Text fontSize={12} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>⌕</Text>
      <TextInput
        value={props.query}
        onChangeText={props.onQueryChange}
        placeholder="Search settings..."
        style={{ flexGrow: 1, height: 24, backgroundColor: 'transparent', color: COLORS.textBright }}
      />
      {props.query ? (
        <Pressable onPress={() => props.onQueryChange('')}>
          <Box style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>clear</Text>
          </Box>
        </Pressable>
      ) : null}
    </Row>
  );
}

