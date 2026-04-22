// =============================================================================
// FocusRing — global bold-focus-ring toggle for keyboard navigation
// =============================================================================
// Flips state.focusRingBold. Components that draw their own focus ring can
// read prefersBoldFocusRing() and bump their border width + colour.
// =============================================================================

import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { getA11yState, setFocusRingBold, useA11yState } from './hooks/useA11yState';

/** Non-hook read for focus-ring-drawing components. */
export function prefersBoldFocusRing(): boolean { return getA11yState().focusRingBold; }

/** Style helper: { borderWidth, borderColor } for the currently-focused
 *  element, tuned up when bold-focus is on. */
export function focusRingStyle(focused: boolean): { borderWidth: number; borderColor: string } {
  if (!focused) return { borderWidth: 1, borderColor: COLORS.border };
  return prefersBoldFocusRing()
    ? { borderWidth: 3, borderColor: COLORS.yellow }
    : { borderWidth: 2, borderColor: COLORS.blue };
}

export function FocusRing() {
  const s = useA11yState();
  const on = s.focusRingBold;
  return (
    <Col style={{
      padding: 10, gap: 8,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Bold focus ring</Text>
        <Text fontSize={9} color={COLORS.textDim}>focusable widgets render a thick yellow outline on focus</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={() => setFocusRingBold(!on)} style={{
          paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5,
          borderRadius: TOKENS.radiusPill, borderWidth: 1,
          borderColor: on ? COLORS.yellow : COLORS.border,
          backgroundColor: on ? COLORS.yellowDeep : COLORS.panelAlt,
        }}>
          <Text fontSize={10} color={on ? COLORS.yellow : COLORS.textDim} style={{ fontWeight: 'bold' }}>
            {on ? 'ON — 3px yellow' : 'OFF — 2px accent'}
          </Text>
        </Pressable>
      </Row>
      {/* Live preview row — two sample focus states using the real helper. */}
      <Row style={{ gap: 8 }}>
        <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, ...focusRingStyle(false), backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={10} color={COLORS.textDim}>unfocused</Text>
        </Box>
        <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, ...focusRingStyle(true), backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={10} color={COLORS.textBright}>focused</Text>
        </Box>
      </Row>
    </Col>
  );
}
