
import { Box, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export function InlineCode(props: { children: any; fontSize?: number; color?: string }) {
  const fontSize = props.fontSize ?? 11;
  return (
    <Box style={{
      paddingLeft: 5,
      paddingRight: 5,
      paddingTop: 1,
      paddingBottom: 1,
      borderRadius: TOKENS.radiusSm,
      backgroundColor: COLORS.panelAlt,
      borderWidth: 1,
      borderColor: COLORS.borderSoft,
    }}>
      <Text fontSize={Math.max(9, fontSize - 1)} color={props.color || COLORS.textBright} style={{ fontFamily: 'monospace' }}>
        {props.children}
      </Text>
    </Box>
  );
}
