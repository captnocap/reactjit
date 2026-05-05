// =============================================================================
// ColorBlindSim — pick a color-blindness simulation mode, live across the app
// =============================================================================
// Not a preview box. Clicking a mode runs setColorBlindMode() which mutates
// COLORS in place and fires the theme listener set; every component reading
// COLORS.x in its render re-tints on the next pass.
// =============================================================================

import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { setColorBlindMode, useA11yState } from './hooks/useA11yState';
import type { ColorBlindMode } from './hooks/useColorMatrix';

const MODES: Array<{ id: ColorBlindMode; label: string; note: string }> = [
  { id: 'off',           label: 'Off',            note: 'no simulation' },
  { id: 'protanopia',    label: 'Protanopia',     note: 'red-blind (~1% of men)' },
  { id: 'deuteranopia',  label: 'Deuteranopia',   note: 'green-blind (~1% of men)' },
  { id: 'tritanopia',    label: 'Tritanopia',     note: 'blue-blind (very rare)' },
  { id: 'achromatopsia', label: 'Achromatopsia',  note: 'total colour blindness' },
  { id: 'monochrome',    label: 'Monochrome',     note: 'full desaturate' },
];

export function ColorBlindSim() {
  const s = useA11yState();
  return (
    <Col style={{
      padding: 10, gap: 8,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Color-blindness simulation</Text>
        <Text fontSize={9} color={COLORS.textDim}>applies to the whole app, not a preview</Text>
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {MODES.map((m) => {
          const active = s.colorBlindMode === m.id;
          return (
            <Pressable key={m.id} onPress={() => setColorBlindMode(m.id)} style={{
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              borderRadius: TOKENS.radiusPill, borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
            }}>
              <Col style={{ gap: 1, alignItems: 'center' }}>
                <Text fontSize={10} color={active ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>{m.label}</Text>
                <Text fontSize={8} color={COLORS.textDim}>{m.note}</Text>
              </Col>
            </Pressable>
          );
        })}
      </Row>
    </Col>
  );
}
