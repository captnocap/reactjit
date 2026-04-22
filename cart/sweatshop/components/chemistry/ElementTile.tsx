import { Box, Pressable, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { categoryTone } from './ElementFilter';
import { useElement, type ChemistryElement } from '../../hooks/useElement';

export function ElementTile(props: {
  element: number | string | ChemistryElement;
  selected?: boolean;
  size?: number;
  dimmed?: boolean;
  onPress?: (element: ChemistryElement) => void;
}) {
  const key = typeof props.element === 'object' ? props.element.number : props.element;
  const element = useElement(key);
  if (!element) return null;
  const size = props.size ?? 52;
  const tone = categoryTone(element.category);
  return (
    <Pressable
      onPress={() => props.onPress?.(element)}
      style={{
        width: size,
        height: size * 1.15,
        opacity: props.dimmed ? 0.34 : 1,
      }}
    >
      <Box
        style={{
          width: '100%',
          height: '100%',
          paddingLeft: 5,
          paddingRight: 5,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: TOKENS.radiusMd,
          borderWidth: 1,
          borderColor: props.selected ? tone : COLORS.border,
          backgroundColor: COLORS.panelRaised,
          gap: 2,
          overflow: 'hidden',
        }}
      >
        <Text fontSize={8} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>{element.number}</Text>
        <Text fontSize={Math.max(14, Math.floor(size * 0.34))} color={tone} style={{ fontWeight: 'bold', lineHeight: 1 }}>
          {element.symbol}
        </Text>
        <Text fontSize={7} color={COLORS.textBright} style={{ fontWeight: 'bold' }} numberOfLines={1}>
          {element.name}
        </Text>
        <Text fontSize={7} color={COLORS.textDim} numberOfLines={1}>
          {Number.isFinite(element.mass) ? element.mass.toFixed(3) : ''}
        </Text>
      </Box>
    </Pressable>
  );
}
