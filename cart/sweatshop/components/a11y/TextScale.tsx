// =============================================================================
// TextScale — global font-size multiplier for the whole app
// =============================================================================
// Mutates TOKENS.fontXs/Sm/Md/Lg/Xl in place (via setTextScale). Every
// <Text fontSize={TOKENS.fontMd}> in the app reads the new value on its next
// render pass. Not a preview — real app-wide zoom.
// =============================================================================

import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { setTextScale, useA11yState } from './hooks/useA11yState';

const STEPS = [0.75, 0.875, 1.0, 1.125, 1.25, 1.5, 1.75, 2.0];

export function TextScale() {
  const s = useA11yState();
  return (
    <Col style={{
      padding: 10, gap: 8,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Text scale</Text>
        <Text fontSize={9} color={COLORS.textDim}>multiplies every TOKENS.font* — whole-app zoom</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={10} color={COLORS.blue} style={{ fontFamily: 'monospace' }}>
          ×{s.textScale.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}
        </Text>
      </Row>

      <Row style={{ gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {STEPS.map((v) => {
          const active = Math.abs(s.textScale - v) < 0.001;
          return (
            <Pressable key={v} onPress={() => setTextScale(v)} style={{
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              borderRadius: TOKENS.radiusPill, borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
            }}>
              <Text fontSize={10} color={active ? COLORS.blue : COLORS.text} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                {v === 1 ? '1×' : v + '×'}
              </Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setTextScale(Math.max(0.75, s.textScale - 0.05))}
          style={tinyBtn()}>
          <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>−</Text>
        </Pressable>
        <Pressable onPress={() => setTextScale(Math.min(2.0, s.textScale + 0.05))}
          style={tinyBtn()}>
          <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>+</Text>
        </Pressable>
      </Row>

      {/* Live preview of the current TOKENS — reads the same live values as
          every other Text in the app, so this row confirms the effect. */}
      <Row style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>xs</Text>
        <Text fontSize={TOKENS.fontSm} color={COLORS.textDim}>sm</Text>
        <Text fontSize={TOKENS.fontMd} color={COLORS.text}>md</Text>
        <Text fontSize={TOKENS.fontLg} color={COLORS.textBright}>lg</Text>
        <Text fontSize={TOKENS.fontXl} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>xl</Text>
      </Row>
    </Col>
  );
}

function tinyBtn() {
  return {
    width: 22, height: 22,
    borderRadius: TOKENS.radiusSm, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
    justifyContent: 'center' as any, alignItems: 'center' as any,
  };
}
