
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../theme';
import { Glyph } from '../../shared';
import { useRegisteredPanels } from '../../../panel-registry';

export function QuickLaunchTile(props: { onTogglePanel?: (id: string) => void }) {
  const panels = useRegisteredPanels();
  return (
    <Col style={{ width: '100%', height: '100%', padding: TOKENS.spaceSm, gap: TOKENS.spaceXs }}>
      <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>LAUNCH</Text>
      <ScrollView style={{ flexGrow: 1 }}>
        <Col style={{ gap: TOKENS.spaceXs }}>
          {panels.filter((p) => p.userVisible !== false).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => props.onTogglePanel?.(p.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: TOKENS.spaceXs,
                padding: TOKENS.spaceXs,
                borderRadius: TOKENS.radiusSm,
                backgroundColor: COLORS.panelAlt,
              }}
            >
              <Glyph icon={p.icon} tone={COLORS.blue} backgroundColor={COLORS.grayChip} tiny={true} />
              <Text fontSize={10} color={COLORS.text}>{p.title}</Text>
            </Pressable>
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}
