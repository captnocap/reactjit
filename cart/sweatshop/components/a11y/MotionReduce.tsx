// =============================================================================
// MotionReduce — global "reduce animations" flag
// =============================================================================
// Flips state.motionReduce. Animation-driving components can read
// getA11yState().motionReduce to short-circuit their tween loops.
// `prefersReducedMotion()` is a convenience the anim/animation files can
// import so they don't need to know the store directly.
// =============================================================================

import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { getA11yState, setMotionReduce, useA11yState } from './hooks/useA11yState';

/** Non-hook read for animation modules that need to short-circuit tweens. */
export function prefersReducedMotion(): boolean {
  return getA11yState().motionReduce;
}

export function MotionReduce() {
  const s = useA11yState();
  const on = s.motionReduce;
  return (
    <Col style={{
      padding: 10, gap: 8,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Reduce motion</Text>
        <Text fontSize={9} color={COLORS.textDim}>animation modules that read prefersReducedMotion() will stop tweening</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={() => setMotionReduce(!on)} style={{
          paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5,
          borderRadius: TOKENS.radiusPill, borderWidth: 1,
          borderColor: on ? COLORS.green : COLORS.border,
          backgroundColor: on ? COLORS.greenDeep : COLORS.panelAlt,
        }}>
          <Text fontSize={10} color={on ? COLORS.green : COLORS.textDim} style={{ fontWeight: 'bold' }}>
            {on ? 'ON — transitions off' : 'OFF — transitions allowed'}
          </Text>
        </Pressable>
      </Row>
    </Col>
  );
}
