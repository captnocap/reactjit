import { Box, Col } from '@reactjit/runtime/primitives';
import { Mono } from './controlsSpecimenParts';
import { CTRL } from './controlsSpecimenTheme';

export type GlyphStackBadgeProps = {
  glyphs: string[];
  accent?: boolean;
};

export function GlyphStackBadge({
  glyphs,
  accent = false,
}: GlyphStackBadgeProps) {
  const color = accent ? CTRL.accent : CTRL.ink;
  return (
    <Col style={{ alignItems: 'center', gap: 4, padding: 8, borderWidth: 1, borderColor: accent ? CTRL.accent : CTRL.ruleBright, backgroundColor: CTRL.bg2 }}>
      {glyphs.map((glyph, index) =>
        glyph === 'sep' ? (
          <Box key={`${glyph}-${index}`} style={{ width: 12, height: 1, backgroundColor: CTRL.ruleBright }} />
        ) : (
          <Mono key={`${glyph}-${index}`} color={color} fontSize={10} fontWeight="bold">
            {glyph}
          </Mono>
        )
      )}
    </Col>
  );
}
