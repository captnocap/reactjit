
import { Box, Col, Pressable, ScrollView, Text } from '../../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../theme';

export function RecentProjectsTile(props: { recentFiles?: any[]; onOpenPath?: (path: string) => void }) {
  const files = props.recentFiles || [];
  return (
    <Col style={{ width: '100%', height: '100%', padding: TOKENS.spaceSm, gap: TOKENS.spaceXs }}>
      <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>RECENT</Text>
      <ScrollView style={{ flexGrow: 1 }}>
        <Col style={{ gap: TOKENS.spaceXs }}>
          {files.length === 0 ? (
            <Text fontSize={10} color={COLORS.textDim}>No recent files</Text>
          ) : (
            files.slice(0, 8).map((f: any) => (
              <Pressable
                key={f.path}
                onPress={() => props.onOpenPath?.(f.path)}
                style={{
                  padding: TOKENS.spaceXs,
                  borderRadius: TOKENS.radiusSm,
                  backgroundColor: COLORS.panelAlt,
                }}
              >
                <Text fontSize={10} color={COLORS.textBright}>{f.label || f.name}</Text>
                <Text fontSize={9} color={COLORS.textDim}>{f.path}</Text>
              </Pressable>
            ))
          )}
        </Col>
      </ScrollView>
    </Col>
  );
}
