// =============================================================================
// ContrastBoost — slider that pushes every theme colour away from mid-grey
// =============================================================================
// 0 = no change. 1 = every channel snapped to 0 or 1. The boost math lives in
// useColorMatrix.boostContrast; this file is the control surface. Writes
// through setContrastBoost which re-applies the a11y overlay on top of the
// active theme so the change is live app-wide.
// =============================================================================

import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { setContrastBoost, useA11yState } from './hooks/useA11yState';

const STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

export function ContrastBoost() {
  const s = useA11yState();
  return (
    <Col style={{
      padding: 10, gap: 8,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Contrast boost</Text>
        <Text fontSize={9} color={COLORS.textDim}>pushes palette channels away from mid-grey</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={10} color={COLORS.blue} style={{ fontFamily: 'monospace' }}>
          {(s.contrastBoost * 100).toFixed(0)}%
        </Text>
      </Row>
      <Row style={{ gap: 4, flexWrap: 'wrap' }}>
        {STEPS.map((v) => {
          const active = Math.abs(s.contrastBoost - v) < 0.001;
          return (
            <Pressable key={v} onPress={() => setContrastBoost(v)} style={{
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              borderRadius: TOKENS.radiusPill, borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
            }}>
              <Text fontSize={10} color={active ? COLORS.blue : COLORS.textDim} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                {v === 0 ? 'off' : (v * 100).toFixed(0) + '%'}
              </Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setContrastBoost(Math.max(0, s.contrastBoost - 0.05))}
          style={tinyBtn(COLORS.textDim)}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>−5%</Text>
        </Pressable>
        <Pressable onPress={() => setContrastBoost(Math.min(1, s.contrastBoost + 0.05))}
          style={tinyBtn(COLORS.textDim)}>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>+5%</Text>
        </Pressable>
      </Row>
    </Col>
  );
}

function tinyBtn(tone: string) {
  return {
    paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
    borderRadius: TOKENS.radiusSm, borderWidth: 1,
    borderColor: tone, backgroundColor: COLORS.panelAlt,
  };
}
