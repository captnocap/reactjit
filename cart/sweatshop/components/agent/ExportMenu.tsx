const React: any = require('react');
import { Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable, Pill } from '../shared';
import { exportConversation, copyToClipboard, saveConversationToFile } from '../../chat-export';
import { Tooltip } from '../tooltip';

export function ExportMenu(props: { messages: any[]; workDir?: string; onClose: () => void }) {
  return (
    <Col style={{ gap: 4, padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Export Conversation</Text>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Tooltip label="Copy conversation as markdown" side="bottom">
          <HoverPressable onPress={() => { copyToClipboard(exportConversation(props.messages, { format: 'markdown' })); props.onClose(); }}>
            <Pill label="Copy Markdown" color={COLORS.blue} tiny={true} />
          </HoverPressable>
        </Tooltip>
        <Tooltip label="Copy conversation as plain text" side="bottom">
          <HoverPressable onPress={() => { copyToClipboard(exportConversation(props.messages, { format: 'text' })); props.onClose(); }}>
            <Pill label="Copy Text" color={COLORS.blue} tiny={true} />
          </HoverPressable>
        </Tooltip>
        <Tooltip label="Save conversation as markdown" side="bottom">
          <HoverPressable onPress={() => { saveConversationToFile(props.messages, props.workDir || '.', { format: 'markdown' }); props.onClose(); }}>
            <Pill label="Save .md" color={COLORS.green} tiny={true} />
          </HoverPressable>
        </Tooltip>
        <Tooltip label="Save conversation as JSON" side="bottom">
          <HoverPressable onPress={() => { saveConversationToFile(props.messages, props.workDir || '.', { format: 'json' }); props.onClose(); }}>
            <Pill label="Save .json" color={COLORS.green} tiny={true} />
          </HoverPressable>
        </Tooltip>
      </Row>
    </Col>
  );
}
