import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useAiBox } from './hooks/useAiBox';
import { ProviderChip } from './ProviderChip';
import { SessionList } from './SessionList';
import { ConversationView } from './ConversationView';
import { ChatInput } from './ChatInput';

export function AiBoxPanel() {
  const ai = useAiBox();

  return (
    <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 12, padding: TOKENS.padNormal, backgroundColor: COLORS.appBg }}>
      <SessionList
        sessions={ai.sessions}
        activeId={ai.activeSessionId}
        onSelect={ai.setActiveSession}
        onNew={ai.createNewSession}
        onRename={ai.renameSession}
        onDelete={ai.deleteSession}
        onExport={ai.exportSession}
      />
      <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 10 }}>
        <Row style={{ alignItems: 'flex-start', gap: 10 }}>
          <Col style={{ gap: 4, flexGrow: 1, flexBasis: 0 }}>
            <Text fontSize={TOKENS.fontLg} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>AI Box</Text>
            <Text fontSize={TOKENS.fontXs} color={COLORS.textDim}>
              {ai.activeSession?.title || 'New chat'} · fast single-thread chat with saved sessions and live provider switching.
            </Text>
          </Col>
          <ProviderChip
            provider={ai.provider}
            model={ai.model}
            onProviderChange={ai.setProvider}
            onModelChange={ai.setModel}
          />
        </Row>
        <ConversationView messages={ai.messages} streamingText={ai.streamingText} isStreaming={ai.isStreaming} />
        {ai.error ? (
          <Box style={{ padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.red} style={{ fontFamily: TOKENS.fontMono }}>{ai.error.message}</Text>
          </Box>
        ) : null}
        <ChatInput onSend={ai.send} placeholder="Ask something directly. Cmd+Enter sends." disabled={ai.isLoading} />
      </Col>
    </Row>
  );
}
