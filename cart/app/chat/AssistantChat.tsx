// Persistent assistant chat — root.
//
// Two visible shapes:
//   - 'side'     — pinned in the side rail, above the InputStrip (or
//                  alone, when the InputStrip morphed to full-bottom for
//                  an activity claim). 95% of the time the chat lives
//                  here.
//   - 'activity' — fills the activity content area. Only on the /chat
//                  route. The rail's chat slot still renders 'side' but
//                  with the history-list empty state, since live turns
//                  are visible in the activity area instead.
//
// Empty-chat state: if the current session has no turns the surface
// renders a clickable history list of past sessions. Sending the first
// message replaces that view with the live transcript.
//
// Identity: the chat may re-mount when its slot changes, but the
// thread state lives in `./store`, so the transcript content survives
// the swap.

import { classifiers as S } from '@reactjit/core';
import { Box, Pressable, Text } from '@reactjit/runtime/primitives';
import type { ChatShape } from './types';
import {
  loadSession,
  startNewSession,
  useChatSessions,
  useChatStatus,
  useChatTurns,
  useCurrentSessionId,
} from './store';
import { AssistantTurn } from './AssistantTurn';

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function ChatHistoryList() {
  const sessions = useChatSessions();
  if (sessions.length === 0) {
    return (
      <Box style={{ padding: 16 }}>
        <Text style={{ color: 'theme:ink-mute', fontSize: 12 }}>
          No past chats. Type a message to start.
        </Text>
      </Box>
    );
  }
  return (
    <Box style={{ flexDirection: 'column', padding: 8 }}>
      {sessions.map((s) => (
        <Pressable
          key={s.id}
          onPress={() => loadSession(s.id)}
          style={{
            paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12,
            flexDirection: 'column',
          }}
        >
          <Text style={{ color: 'theme:ink', fontSize: 13 }}>{truncate(s.title, 60)}</Text>
          <Text style={{ color: 'theme:ink-mute', fontSize: 11, marginTop: 2 }}>
            {s.turn_count} turn{s.turn_count === 1 ? '' : 's'}
          </Text>
        </Pressable>
      ))}
    </Box>
  );
}

export function AssistantChat({ shape }: { shape: ChatShape }) {
  const turns = useChatTurns();
  const status = useChatStatus();
  const currentId = useCurrentSessionId();
  if (shape === 'hidden') return null;

  const isSide = shape === 'side';
  const showLift = shape === 'activity';
  const turnCount = turns.length;
  const hasActiveSession = currentId !== null && turnCount > 0;

  // Header subline shows live phase/error so the user can see what the
  // session is doing — esp. when the asst turn is empty (init / loading
  // / failed). Falls back to the persistent-thread tagline when chat is
  // idle and clean.
  const phaseLabel = status.error
    ? `ERROR · ${truncate(status.error, 64)}`
    : status.phase === 'init' || status.phase === 'loading'
    ? `STARTING SESSION…`
    : status.phase === 'loaded' || status.phase === 'idle'
    ? (status.lastStatus
        ? status.lastStatus.toUpperCase()
        : `READY · ${turnCount} TURN${turnCount === 1 ? '' : 'S'}`)
    : status.phase === 'generating'
    ? `GENERATING…`
    : status.phase === 'failed'
    ? `FAILED · ${truncate(status.error || status.lastStatus || 'no detail', 64)}`
    : `PERSISTENT · ${turnCount} TURNS · DRAG ANY SURFACE TO CART`;

  return (
    <S.AppChatPanel>
      <S.AppChatPanelHeader>
        <S.AppChatPanelHeaderLeft>
          <S.AppChatPanelHeaderDot />
          <S.AppChatPanelHeaderTitle>01 ASSISTANT</S.AppChatPanelHeaderTitle>
          {isSide ? (
            <S.AppChatPanelHeaderState>
              <S.AppChatPanelHeaderStateText>
                {hasActiveSession ? 'ACTIVE' : 'HISTORY'}
              </S.AppChatPanelHeaderStateText>
            </S.AppChatPanelHeaderState>
          ) : null}
        </S.AppChatPanelHeaderLeft>
        {hasActiveSession ? (
          <S.AppChatPanelHeaderToggle onPress={() => startNewSession()}>
            <S.AppChatPanelHeaderToggleText>+</S.AppChatPanelHeaderToggleText>
          </S.AppChatPanelHeaderToggle>
        ) : null}
      </S.AppChatPanelHeader>

      {isSide ? (
        <S.AppChatPanelSubline>
          <S.AppChatPanelSublineText>
            {phaseLabel}
          </S.AppChatPanelSublineText>
        </S.AppChatPanelSubline>
      ) : null}

      <S.AppChatTranscript>
        {/* Side rail with no active session shows the history list so
            the user can resume. Activity view always shows the live
            transcript (empty when no turns — the InputStrip is right
            below it, ready to fire). */}
        {!hasActiveSession && isSide ? (
          <ChatHistoryList />
        ) : (
          turns.map((t) => (
            <AssistantTurn key={t.id} turn={t} showLift={showLift} />
          ))
        )}
      </S.AppChatTranscript>
    </S.AppChatPanel>
  );
}
