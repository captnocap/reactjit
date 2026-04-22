const React: any = require('react');
import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable, Pill } from '../shared';
import { ContextMeter } from './ContextMeter';
import { getModelIconInfo } from '../../model-icons';
import { Tooltip } from '../tooltip';

function ModelIconBadge(props: { modelId: string; size?: number }) {
  const info = getModelIconInfo(props.modelId);
  const size = props.size || 14;
  return (
    <Box style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: info.color,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text fontSize={size * 0.4} color="#000" style={{ fontWeight: 'bold' }}>{info.initial}</Text>
    </Box>
  );
}

export function AgentHeader(props: {
  selectedModel: string;
  messages: any[];
  showSidebar: boolean;
  showSearch: boolean;
  showExportMenu: boolean;
  compactBand: boolean;
  onToggleSidebar: () => void;
  onToggleSearch: () => void;
  onToggleExportMenu: () => void;
  onNewConversation: () => void;
  onExportMarkdown: () => void;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: props.compactBand ? 10 : 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Agent Console</Text>
        <Row style={{ alignItems: 'center', gap: 4 }}>
          <ModelIconBadge modelId={props.selectedModel} />
          <Pill label={props.selectedModel} color={COLORS.blue} tiny={true} />
        </Row>
        <ContextMeter messages={props.messages} modelId={props.selectedModel} />
      </Row>
      <Row style={{ gap: 8 }}>
        {!props.compactBand ? (
          <Tooltip label="Show conversation history" side="bottom">
            <HoverPressable onPress={props.onToggleSidebar} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
              <Text fontSize={10} color={props.showSidebar ? COLORS.blue : COLORS.textDim}>History</Text>
            </HoverPressable>
          </Tooltip>
        ) : null}
        <Tooltip label="Search messages" side="bottom">
          <HoverPressable onPress={props.onToggleSearch} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Text fontSize={10} color={props.showSearch ? COLORS.blue : COLORS.textDim}>Search</Text>
          </HoverPressable>
        </Tooltip>
        <Tooltip label="Export conversation as markdown" side="bottom">
          <HoverPressable onPress={props.onExportMarkdown} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Text fontSize={10} color={COLORS.blue}>Export .md</Text>
          </HoverPressable>
        </Tooltip>
        <Tooltip label="Open export menu" side="bottom">
          <HoverPressable onPress={props.onToggleExportMenu} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Text fontSize={10} color={props.showExportMenu ? COLORS.blue : COLORS.textDim}>Export</Text>
          </HoverPressable>
        </Tooltip>
        <Tooltip label="Start a new conversation" side="bottom" shortcut="Ctrl+Shift+N">
          <HoverPressable onPress={props.onNewConversation} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Text fontSize={10} color={COLORS.blue}>New</Text>
          </HoverPressable>
        </Tooltip>
      </Row>
    </Row>
  );
}
