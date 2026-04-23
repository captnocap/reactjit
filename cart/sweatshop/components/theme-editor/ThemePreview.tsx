
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS, useTheme } from '../../theme';

// Live sample UI rendered with the currently active theme. Because every
// style reads from live COLORS / TOKENS and the parent subscribes via
// useTheme(), this pane re-renders the moment the draft pushes through.
export function ThemePreview() {
  useTheme();
  return (
    <Col style={{
      gap: TOKENS.spaceSm,
      padding: TOKENS.padLoose,
      borderRadius: TOKENS.radiusMd,
      borderWidth: TOKENS.borderW,
      borderColor: COLORS.border,
      backgroundColor: COLORS.appBg,
      minWidth: 240,
    }}>
      <Text fontSize={TOKENS.fontLg} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontUI, fontWeight: 'bold' }}>
        Preview
      </Text>
      <Text fontSize={TOKENS.fontSm} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontUI }}>
        Live sample — edits apply immediately.
      </Text>

      <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap' }}>
        <Box style={{ paddingLeft: TOKENS.padNormal, paddingRight: TOKENS.padNormal, paddingTop: TOKENS.padTight, paddingBottom: TOKENS.padTight, borderRadius: TOKENS.radiusPill, borderWidth: TOKENS.borderW, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={TOKENS.fontXs} color={COLORS.text}>pill</Text>
        </Box>
        <Box style={{ paddingLeft: TOKENS.padNormal, paddingRight: TOKENS.padNormal, paddingTop: TOKENS.padTight, paddingBottom: TOKENS.padTight, borderRadius: TOKENS.radiusMd, borderWidth: TOKENS.borderW, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
          <Text fontSize={TOKENS.fontXs} color={COLORS.blue}>primary</Text>
        </Box>
        <Box style={{ paddingLeft: TOKENS.padNormal, paddingRight: TOKENS.padNormal, paddingTop: TOKENS.padTight, paddingBottom: TOKENS.padTight, borderRadius: TOKENS.radiusMd, borderWidth: TOKENS.borderW, borderColor: COLORS.green, backgroundColor: COLORS.greenDeep }}>
          <Text fontSize={TOKENS.fontXs} color={COLORS.green}>ok</Text>
        </Box>
        <Box style={{ paddingLeft: TOKENS.padNormal, paddingRight: TOKENS.padNormal, paddingTop: TOKENS.padTight, paddingBottom: TOKENS.padTight, borderRadius: TOKENS.radiusMd, borderWidth: TOKENS.borderW, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
          <Text fontSize={TOKENS.fontXs} color={COLORS.red}>error</Text>
        </Box>
      </Row>

      <Box style={{ padding: TOKENS.padNormal, borderRadius: TOKENS.radiusMd, borderWidth: TOKENS.borderW, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: TOKENS.spaceXs }}>
        <Text fontSize={TOKENS.fontMd} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontUI, fontWeight: 'bold' }}>Panel</Text>
        <Text fontSize={TOKENS.fontSm} color={COLORS.text} style={{ fontFamily: TOKENS.fontUI }}>
          Headline body text on a raised surface.
        </Text>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>
          const x = theme.tokens.radiusMd; // mono
        </Text>
      </Box>

      <Pressable>
        <Box style={{
          paddingLeft: TOKENS.padLoose, paddingRight: TOKENS.padLoose,
          paddingTop: TOKENS.padNormal, paddingBottom: TOKENS.padNormal,
          borderRadius: TOKENS.radiusMd, borderWidth: TOKENS.borderW,
          borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep,
          alignItems: 'center',
        }}>
          <Text fontSize={TOKENS.fontSm} color={COLORS.blue} style={{ fontFamily: TOKENS.fontUI, fontWeight: 'bold' }}>Primary action</Text>
        </Box>
      </Pressable>

      <ScrollView showScrollbar={true} style={{ maxHeight: 80, borderWidth: TOKENS.borderW, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
        <Col style={{ padding: TOKENS.padTight, gap: 2 }}>
          {['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].map((row) => (
            <Text key={row} fontSize={TOKENS.fontXs} color={COLORS.textMuted} style={{ fontFamily: TOKENS.fontMono }}>{row}</Text>
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}
