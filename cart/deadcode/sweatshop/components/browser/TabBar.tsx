import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';
import type { BrowserTabState } from '../../lib/browser/tabs';

export function TabBar(props: {
  tabs: BrowserTabState[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  return (
    <Row style={{ gap: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg, flexWrap: 'wrap' }}>
      {props.tabs.map((tab) => {
        const active = tab.id === props.activeTabId;
        return (
          <Row
            key={tab.id}
            style={{
              alignItems: 'center',
              gap: 6,
              paddingLeft: 10,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: TOKENS.radiusSm,
              borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.blueDeep : COLORS.panelRaised,
            }}
          >
            <Pressable onPress={() => props.onSelect(tab.id)}>
              <Row style={{ alignItems: 'center', gap: 6 }}>
                <Icon name="file" size={13} color={active ? COLORS.blue : COLORS.textDim} />
                <Text fontSize={9} color={active ? COLORS.blue : COLORS.textBright} style={{ fontWeight: 'bold' }}>
                  {tab.title || 'New tab'}
                </Text>
                {tab.loading ? <Text fontSize={8} color={COLORS.yellow}>loading</Text> : null}
              </Row>
            </Pressable>
            <Pressable onPress={() => props.onClose(tab.id)}>
              <Box style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: TOKENS.radiusPill, backgroundColor: active ? COLORS.panelBg : COLORS.panelAlt }}>
                <Icon name="x" size={12} color={COLORS.textDim} />
              </Box>
            </Pressable>
          </Row>
        );
      })}
    </Row>
  );
}
