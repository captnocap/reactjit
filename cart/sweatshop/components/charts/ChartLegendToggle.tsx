// =============================================================================
// ChartLegendToggle — click-to-hide/show a series, parent re-scales Y on hide
// =============================================================================
// Separate from ChartLegend so the existing (read-only) legend stays
// unchanged. ChartLegendToggle renders the same row shape but each entry is
// a Pressable; click flips visibility in a parent-owned map. Charts consume
// `hiddenSeries` to strip those series from the Y-extent + draw paths, so
// hiding a huge outlier series automatically rescales the remaining ones.
// =============================================================================

import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export interface LegendItem { id: string; name: string; color: string }

export interface ChartLegendToggleProps {
  items: LegendItem[];
  hidden: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function ChartLegendToggle(props: ChartLegendToggleProps) {
  return (
    <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {props.items.map((item) => {
        const off = !!props.hidden[item.id];
        return (
          <Pressable key={item.id} onPress={() => props.onToggle(item.id)} style={{
            paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
            borderRadius: TOKENS.radiusPill, borderWidth: 1,
            borderColor: off ? COLORS.border : item.color,
            backgroundColor: off ? COLORS.panelAlt : COLORS.panelRaised,
          }}>
            <Row style={{ gap: 6, alignItems: 'center' }}>
              <Box style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: off ? COLORS.border : item.color,
                opacity: off ? 0.5 : 1,
              }} />
              <Text fontSize={10}
                color={off ? COLORS.textDim : COLORS.text}
                style={{ fontWeight: 'bold', textDecoration: off ? 'line-through' : 'none' as any }}>
                {item.name}
              </Text>
            </Row>
          </Pressable>
        );
      })}
      {props.items.length === 0 ? (
        <Text fontSize={10} color={COLORS.textDim}>no series</Text>
      ) : null}
    </Row>
  );
}
