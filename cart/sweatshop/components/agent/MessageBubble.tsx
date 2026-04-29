import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable, Pill } from '../shared';
import { Icon } from '../icons';
import { ChatMessageMarkdown } from '../chat/ChatMessageMarkdown';
import { RoleAvatar } from './RoleAvatar';
import { MessageTimestamp } from './MessageTimestamp';
import { MessageActions } from './MessageActions';
import { MessageReactions } from './MessageReactions';
import { StreamIndicator } from './StreamIndicator';
import { ToolCallBadge } from './ToolCallBadge';
import { copyToClipboard } from './clipboard';
import type { Message } from '../../types';

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

  function handleCopyMessage() {
    copyToClipboard(message.text || '');
    if (onCopy) onCopy();
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
          {isAssistant ? (
            <ChatMessageMarkdown text={message.text || ''} color={COLORS.text} />
          ) : (
            <Text fontSize={11} color={COLORS.text} style={{ whiteSpace: 'pre-wrap', minWidth: 0 }}>
              {message.text || ''}
            </Text>
          )}
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
