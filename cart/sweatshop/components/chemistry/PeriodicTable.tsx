import { Box, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { ELEMENTS, type Element } from '../../lib/chemistry/elements';
import { ElementTile } from './ElementTile';
import { type ElementCategoryFilter } from './ElementFilter';

function slotFor(element: Element): { row: number; col: number } {
  if (element.number >= 57 && element.number <= 71) return { row: 7, col: 2 + (element.number - 57) };
  if (element.number >= 89 && element.number <= 103) return { row: 8, col: 2 + (element.number - 89) };
  return { row: element.period - 1, col: element.group - 1 };
}

export function PeriodicTable(props: {
  selected?: number | null;
  filterCategory?: ElementCategoryFilter;
  tileSize?: number;
  onSelect?: (element: Element) => void;
}) {
  const tile = props.tileSize ?? 52;
  const cellW = tile + 6;
  const cellH = Math.round(tile * 1.15) + 6;
  const width = cellW * 18 + 12;
  const height = cellH * 9 + 12;

  return (
    <Box style={{ position: 'relative', width: '100%', minHeight: height, backgroundColor: COLORS.panelBg, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
      <Box style={{ position: 'absolute', left: 0, top: 0, width, height }}>
        {ELEMENTS.map((element) => {
          const slot = slotFor(element);
          const dimmed = props.filterCategory && props.filterCategory !== 'all' && element.category !== props.filterCategory;
          return (
            <Box key={element.number} style={{ position: 'absolute', left: 6 + slot.col * cellW, top: 6 + slot.row * cellH }}>
              <ElementTile
                element={element}
                size={tile}
                selected={props.selected === element.number}
                dimmed={dimmed}
                onPress={props.onSelect}
              />
            </Box>
          );
        })}
      </Box>
      <Box style={{ position: 'absolute', right: 10, bottom: 8, backgroundColor: COLORS.panelAlt, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: COLORS.border, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
        <Text fontSize={9} color={COLORS.textDim}>18-column grid · all 118 elements</Text>
      </Box>
    </Box>
  );
}
