import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable, Pill } from '../shared';
import { Icon } from '../icons';
import { RoleAvatar } from './RoleAvatar';
import { MessageTimestamp } from './MessageTimestamp';
import { MessageActions } from './MessageActions';
import { MessageReactions } from './MessageReactions';
import { CodeBlock } from './CodeBlock';
import { InlineRender } from './InlineRender';
import { StreamIndicator } from './StreamIndicator';
import { ToolCallBadge } from './ToolCallBadge';
import { copyToClipboard } from './clipboard';
import { parseMarkdownInternal } from './markdown';
import type { Message } from '../../types';
import type { MarkdownNode, InternalNode } from './markdown';

function renderMarkdownNodes(nodes: InternalNode[], onCopyCode: (code: string) => void) {
  const result: any[] = [];
  let inlineBuffer: MarkdownNode[] = [];
  function flushInline() {
    if (inlineBuffer.length === 0) return;
    result.push(
      <Row key={result.length} style={{ flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <InlineRender nodes={inlineBuffer} />
      </Row>
    );
    inlineBuffer = [];
  }
  for (const node of nodes) {
    if (node.type === 'paragraph') {
      flushInline();
      continue;
    }
    switch (node.type) {
      case 'text':
      case 'bold':
      case 'italic':
      case 'code':
      case 'link':
        inlineBuffer.push(node);
        break;
      case 'codeblock': {
        flushInline();
        result.push(
          <CodeBlock key={result.length} language={node.language} content={node.content} />
        );
        break;
      }
      case 'heading': {
        flushInline();
        const headingSize = node.level === 1 ? 18 : node.level === 2 ? 15 : node.level === 3 ? 13 : 11;
        result.push(
          <Text key={result.length} fontSize={headingSize} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {node.content}
          </Text>
        );
        break;
      }
      case 'list': {
        flushInline();
        result.push(
          <Col key={result.length} style={{ gap: 4, paddingLeft: 4 }}>
            {node.items.map((item, idx) => (
              <Row key={idx} style={{ gap: 8, alignItems: 'flex-start' }}>
                <Text fontSize={11} color={COLORS.textMuted}>{node.ordered ? `${idx + 1}.` : '•'}</Text>
                <Row style={{ flexWrap: 'wrap', gap: 2, alignItems: 'center', flexShrink: 1 }}>
                  <InlineRender nodes={require('./markdown').parseInline(item)} />
                </Row>
              </Row>
            ))}
          </Col>
        );
        break;
      }
      case 'quote': {
        flushInline();
        result.push(
          <Box key={result.length} style={{ paddingLeft: 10, borderLeftWidth: 3, borderColor: COLORS.blue, marginLeft: 4 }}>
            <Row style={{ flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <InlineRender nodes={require('./markdown').parseInline(node.content)} baseColor={COLORS.textMuted} />
            </Row>
          </Box>
        );
        break;
      }
      case 'rule': {
        flushInline();
        result.push(<Box key={result.length} style={{ height: 1, backgroundColor: COLORS.border }} />);
        break;
      }
    }
  }
  flushInline();
  return result;
}

export function MessageBubble(props: {
  message: Message;
  index: number;
  isLast: boolean;
  compact?: boolean;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}) {
  const { message, isLast, compact, isStreaming, onCopy, onRetry, onDelete, onEdit } = props;
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [hovered, setHovered] = useState(false);
  const mdNodes = useMemo(() => parseMarkdownInternal(message.text || ''), [message.text]);

  function handleCopyMessage() {
    copyToClipboard(message.text || '');
    if (onCopy) onCopy();
  }
  function handleCopyCode(code: string) {
    copyToClipboard(code);
  }

  return (
    <Col style={{ gap: 6 }} onHoverEnter={() => setHovered(true)} onHoverExit={() => setHovered(false)}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <RoleAvatar role={message.role} modelId={message.model} size={20} />
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          {isUser ? 'You' : isAssistant ? 'Agent' : 'System'}
        </Text>
        <MessageTimestamp time={message.time} visible={hovered} />
        {message.mode ? <Pill label={message.mode} color={COLORS.blue} tiny={true} /> : null}
        {isAssistant && message.model ? (
          <Row style={{ alignItems: 'center', gap: 4 }}>
            <RoleAvatar role="assistant" modelId={message.model} size={14} />
            <Pill label={message.model} color={COLORS.textMuted} tiny={true} />
          </Row>
        ) : null}
        {hovered ? (
          <HoverPressable onPress={handleCopyMessage} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: 'transparent' }}>
            <Row style={{ gap: 4, alignItems: 'center' }}>
              <Icon name="copy" size={12} color={COLORS.textDim} />
              <Text fontSize={9} color={COLORS.textDim}>Copy</Text>
            </Row>
          </HoverPressable>
        ) : null}
      </Row>

      <Box style={{
        padding: compact ? 8 : 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isUser ? '#1e3a5f' : '#1c2834',
        backgroundColor: isUser ? '#0f1724' : '#0d1117',
        gap: 8,
      }}>
        <Col style={{ gap: 6 }}>
          {renderMarkdownNodes(mdNodes, handleCopyCode)}
          {isStreaming ? <StreamIndicator /> : null}
        </Col>

        {message.attachments && message.attachments.length > 0 ? (
          <Row style={{ gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {message.attachments.map((attachment) => (
              <Pill key={attachment.id} label={attachment.name} color={COLORS.blue} tiny={true} />
            ))}
          </Row>
        ) : null}

        {message.toolSnapshot && message.toolSnapshot.length > 0 ? (
          <Col style={{ gap: 8, marginTop: 4 }}>
            {message.toolSnapshot.map((execItem) => (
              <ToolCallBadge key={execItem.id} exec={execItem} />
            ))}
          </Col>
        ) : null}
      </Box>

      {isLast && (
        <MessageActions
          isUser={isUser}
          isAssistant={isAssistant}
          onCopy={handleCopyMessage}
          onRetry={onRetry}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
      <MessageReactions />
    </Col>
  );
}
