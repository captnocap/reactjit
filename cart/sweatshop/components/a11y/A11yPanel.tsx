// =============================================================================
// A11yPanel — root accessibility surface, composes five live sub-controls
// =============================================================================
// Every sub-control mutates the shared COLORS/TOKENS in place. The panel
// itself reads COLORS/TOKENS the same way every other themed surface does,
// so the user sees the effect on this panel AND every other open surface
// simultaneously — no preview box, no delay.
//
// A `reset all` button at the top clears everything back to the theme's
// defaults. If the user switches theme while the panel is open, we
// automatically re-layer the a11y transform on top of the new theme.
// =============================================================================

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS, useTheme } from '../../theme';
import {
  reapplyOnThemeChange,
  setColorBlindMode,
  setContrastBoost,
  setFocusRingBold,
  setMotionReduce,
  setTextScale,
  useA11yState,
} from './hooks/useA11yState';
import { ColorBlindSim } from './ColorBlindSim';
import { ContrastBoost } from './ContrastBoost';
import { TextScale } from './TextScale';
import { MotionReduce } from './MotionReduce';
import { FocusRing } from './FocusRing';

export function A11yPanel() {
  const s = useA11yState();
  const theme = useTheme();

  // When the user switches theme while the panel is open, re-layer a11y
  // transforms on top of the new theme. The base applyTheme() already ran;
  // reapplyOnThemeChange() rebuilds from that new base.
  useEffect(() => { reapplyOnThemeChange(); }, [theme.name]);

  const resetAll = () => {
    setColorBlindMode('off');
    setContrastBoost(0);
    setTextScale(1);
    setMotionReduce(false);
    setFocusRingBold(false);
  };

  // Short summary line for the header — keeps the active config discoverable
  // without opening every sub-control.
  const summary = [
    s.colorBlindMode !== 'off' ? s.colorBlindMode : null,
    s.contrastBoost > 0 ? 'contrast +' + (s.contrastBoost * 100).toFixed(0) + '%' : null,
    s.textScale !== 1 ? 'text ' + s.textScale + '×' : null,
    s.motionReduce ? 'no-motion' : null,
    s.focusRingBold ? 'bold-focus' : null,
  ].filter(Boolean).join(' · ') || 'defaults';

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: 10, gap: 10 }}>
        <Row style={{
          alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: 10, borderRadius: TOKENS.radiusMd,
          borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.panelRaised,
        }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Accessibility</Text>
          <Text fontSize={10} color={COLORS.textDim}>{summary}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={resetAll} style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
            borderRadius: TOKENS.radiusSm, borderWidth: 1,
            borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
          }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>reset all</Text>
          </Pressable>
        </Row>

        {/* Honest banner: effects are app-wide and live. */}
        <Box style={{
          padding: 8, borderRadius: TOKENS.radiusSm,
          borderWidth: 1, borderColor: COLORS.green, backgroundColor: COLORS.greenDeep,
        }}>
          <Text fontSize={10} color={COLORS.green} style={{ fontWeight: 'bold' }}>
            Live app-wide · not a preview
          </Text>
          <Text fontSize={10} color={COLORS.text}>
            Every change here mutates the shared theme tokens in place — every
            themed surface in sweatshop re-renders immediately. Settings persist
            through restart via sweatshop.a11y.* in the key-value store.
          </Text>
        </Box>

        <ColorBlindSim />
        <ContrastBoost />
        <TextScale />
        <MotionReduce />
        <FocusRing />
      </Col>
    </ScrollView>
  );
}
