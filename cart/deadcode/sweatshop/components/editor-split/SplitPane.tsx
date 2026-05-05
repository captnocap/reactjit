import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { baseName } from '../../theme';
import { SplitAddHandle } from './SplitAddHandle';
import type { SplitPaneNode } from './SplitLayoutEngine';

interface SplitPaneProps {
  pane: SplitPaneNode;
  focused: boolean;
  paneIndex: number;
  showIndex: boolean;
  onFocus: () => void;
  onClose: () => void;
  onSplit: (direction: 'horizontal' | 'vertical') => void;
  onFileChange: (path: string | null) => void;
  renderEditor: (filePath: string | null) => React.ReactNode;
}

export function SplitPane(props: SplitPaneProps) {
  const { pane, focused, paneIndex, showIndex, onFocus, onClose, onSplit, renderEditor } = props;

  return (
    <Col
      style={{
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        minHeight: 0,
        borderWidth: focused ? 1 : 0,
        borderColor: focused ? COLORS.blue : 'transparent',
        backgroundColor: COLORS.panelBg,
      }}
    >
      {/* Chrome */}
      <Row style={{ alignItems: 'center', padding: 6, borderBottomWidth: 1, borderColor: COLORS.borderSoft, gap: 6 }}>
        {showIndex && (
          <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4, backgroundColor: COLORS.panelRaised }}>
            <Text fontSize={9} color={COLORS.textDim}>{paneIndex + 1}</Text>
          </Box>
        )}
        <Text fontSize={10} color={COLORS.textBright} style={{ flexShrink: 1, flexBasis: 0 }}>
          {pane.filePath ? baseName(pane.filePath) : 'Empty'}
        </Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={() => onSplit('horizontal')}>
          <Box style={{ padding: 4, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelRaised }}>
            <Text fontSize={9} color={COLORS.textDim}>⇋</Text>
          </Box>
        </Pressable>
        <Pressable onPress={() => onSplit('vertical')}>
          <Box style={{ padding: 4, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelRaised }}>
            <Text fontSize={9} color={COLORS.textDim}>⇅</Text>
          </Box>
        </Pressable>
        <Pressable onPress={onClose}>
          <Box style={{ padding: 4, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelRaised }}>
            <Text fontSize={9} color={COLORS.textDim}>×</Text>
          </Box>
        </Pressable>
      </Row>

      {/* Editor */}
      <Pressable onPress={onFocus} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, minHeight: 0, position: 'relative' }}>
        {renderEditor(pane.filePath)}
        <SplitAddHandle direction="horizontal" edge="end" onSplit={() => onSplit('horizontal')} />
        <SplitAddHandle direction="vertical" edge="end" onSplit={() => onSplit('vertical')} />
      </Pressable>
    </Col>
  );
}
