const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export type ChartLegendPosition = 'top' | 'right' | 'bottom' | 'none';

export type ChartLegendItem = {
  label: string;
  color: string;
  value?: string;
};

export function ChartLegend(props: {
  items: ChartLegendItem[];
  position: ChartLegendPosition;
  onPick?: (index: number) => void;
}) {
  if (props.position === 'none' || props.items.length === 0) return null;
  const vertical = props.position === 'right';
  const align = props.position === 'right' ? 'stretch' : 'center';
  return (
    <Box style={{ width: props.position === 'right' ? 150 : '100%', gap: 6 }}>
      <Row style={{ gap: 6, flexWrap: 'wrap', justifyContent: props.position === 'top' ? 'flex-start' : 'center', alignItems: align as any }}>
        {props.items.map((item, index) => (
          <Pressable
            key={item.label + index}
            onPress={props.onPick ? () => props.onPick?.(index) : undefined}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 5,
              paddingBottom: 5,
              borderRadius: TOKENS.radiusPill,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.panelAlt,
              marginBottom: vertical ? 4 : 0,
            }}
          >
            <Box style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: item.color }} />
            <Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.label}</Text>
            {item.value ? <Text fontSize={9} color={COLORS.textDim}>{item.value}</Text> : null}
          </Pressable>
        ))}
      </Row>
    </Box>
  );
}
