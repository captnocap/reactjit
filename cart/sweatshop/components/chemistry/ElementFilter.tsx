import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export type ElementCategoryFilter =
  | 'all'
  | 'alkali-metal'
  | 'alkaline-earth'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide';

export const CATEGORY_OPTIONS: Array<{ key: ElementCategoryFilter; label: string; tone: string }> = [
  { key: 'all', label: 'all', tone: COLORS.textDim },
  { key: 'alkali-metal', label: 'alkali metals', tone: COLORS.red },
  { key: 'alkaline-earth', label: 'alkaline earths', tone: COLORS.orange },
  { key: 'transition-metal', label: 'transition metals', tone: COLORS.blue },
  { key: 'post-transition-metal', label: 'post-transition', tone: COLORS.purple },
  { key: 'metalloid', label: 'metalloids', tone: COLORS.green },
  { key: 'nonmetal', label: 'nonmetals', tone: COLORS.textBright },
  { key: 'halogen', label: 'halogens', tone: COLORS.yellow },
  { key: 'noble-gas', label: 'noble gases', tone: COLORS.cyan || COLORS.blue },
  { key: 'lanthanide', label: 'lanthanides', tone: COLORS.green },
  { key: 'actinide', label: 'actinides', tone: COLORS.red },
];

export function categoryTone(category: string): string {
  const match = CATEGORY_OPTIONS.find((option) => option.key === category);
  return match ? match.tone : COLORS.textDim;
}

export function ElementFilter(props: {
  value: ElementCategoryFilter;
  onChange: (next: ElementCategoryFilter) => void;
}) {
  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      {CATEGORY_OPTIONS.map((option) => {
        const active = option.key === props.value;
        return (
          <Pressable
            key={option.key}
            onPress={() => props.onChange(option.key)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 5,
              paddingBottom: 5,
              borderRadius: TOKENS.radiusPill,
              borderWidth: 1,
              borderColor: active ? option.tone : COLORS.border,
              backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
            }}
          >
            <Text fontSize={9} color={active ? option.tone : COLORS.textDim} style={{ fontWeight: 'bold' }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}
