const React: any = require('react');
import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable } from '../shared';
import { Glyph } from '../shared';
import { copyToClipboard } from './clipboard';

export function CodeBlock(props: { language: string; content: string }) {
  return (
    <Box
      style={{
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: '#080b10',
        overflow: 'hidden',
      }}
    >
      <Row
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 6,
          paddingBottom: 6,
          backgroundColor: COLORS.grayDeep,
          borderBottomWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <Text fontSize={9} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          {props.language || 'text'}
        </Text>
        <HoverPressable onPress={() => copyToClipboard(props.content)} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
          <Row style={{ gap: 4, alignItems: 'center' }}>
            <Glyph icon="copy" tone={COLORS.textDim} backgroundColor="transparent" tiny={true} />
            <Text fontSize={9} color={COLORS.textMuted}>Copy</Text>
          </Row>
        </HoverPressable>
      </Row>
      <Box style={{ padding: 10 }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>
          {props.content}
        </Text>
      </Box>
    </Box>
  );
}
