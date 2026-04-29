
import { Box, Pressable, Row } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

// Curated swatches spanning warm/cool/neutral/dark/bright. Users pick from
// this grid first; the hex input in ColorField covers anything off-grid.
export const PRESET_SWATCHES: string[] = [
  // neutrals / dark surfaces
  '#000000', '#05080c', '#0d1015', '#10151d', '#1a1f2b', '#2a3644',
  '#3a4555', '#5d6a7c', '#8ca0b8', '#c9d2df', '#e4e6eb', '#ffffff',
  // blues
  '#071a33', '#10213d', '#1a2633', '#2d62ff', '#5ec8ff', '#6ed0ff',
  '#79c0ff', '#82a8c8', '#8bb8c8', '#99c8f0', '#b8d4e8', '#e3f1f7',
  // greens
  '#0a1f10', '#102214', '#1a2820', '#4eb378', '#7ee787', '#7ef0a0',
  '#8aae8a', '#a8d4bc', '#c2ecd8',
  // yellows / oranges
  '#2a1200', '#331608', '#e6b450', '#f0c050', '#f2db43', '#ffa657',
  '#ffae5c', '#ffb870', '#ffe066',
  // reds / pinks
  '#2a0a0a', '#341316', '#b34e4e', '#ed7dbe', '#ff6d63', '#ff7b72',
  '#ff8078', '#f099c8', '#f3b5d2',
  // purples
  '#1a002a', '#241233', '#362f42', '#a898c8', '#c09df8', '#d2a8ff',
  '#e1b4ff', '#e4e1fc',
];

export function ColorSwatchGrid(props: { value: string; onPick: (hex: string) => void }) {
  return (
    <Row style={{ flexWrap: 'wrap', gap: 4 }}>
      {PRESET_SWATCHES.map((hex) => {
        const active = hex.toLowerCase() === String(props.value || '').toLowerCase();
        return (
          <Pressable key={hex} onPress={() => props.onPick(hex)}>
            <Box style={{
              width: 20,
              height: 20,
              borderRadius: TOKENS.radiusXs,
              backgroundColor: hex,
              borderWidth: active ? 2 : 1,
              borderColor: active ? COLORS.textBright : COLORS.border,
            }} />
          </Pressable>
        );
      })}
    </Row>
  );
}
