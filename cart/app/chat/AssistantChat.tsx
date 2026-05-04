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

function ChatHistoryList({ excludeId }: { excludeId?: string | null }) {
  const sessions = useChatSessions();
  const visible = excludeId ? sessions.filter(s => s.id !== excludeId) : sessions;
  if (visible.length === 0) {
    return (
      <Box style={{ padding: 16 }}>
        <Text style={{ color: 'theme:ink-mute', fontSize: 12 }}>
          {sessions.length === 0
            ? 'No past chats. Type a message to start.'
            : 'No other chats yet.'}
        </Text>
      </Box>
    );
  }
  return (
    <Box style={{ flexDirection: 'column', padding: 8 }}>
      {visible.map((s) => (
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
            {s.turn_count} turn{s.turn_count === 1 ? '' : 'S'}
          </Text>
        </Pressable>
      ))}
    </Box>
  );
}

/** AssistantChat renders the chat surface in one of three roles:
 *  - shape='hidden'   → null (cold home)
 *  - shape='side'     → rail slot. When `chatIsActivity` is true the
 *                       live chat is already painted in the activity
 *                       area, so the rail pivots to a history list of
 *                       OTHER chats (the current session is filtered
 *                       out so we don't show the same conversation
 *                       twice). Otherwise it shows the live transcript
 *                       (or history list when no current session).
 *  - shape='activity' → /chat's content area. Always live transcript;
 *                       empty state when there's no current session.
 */
export function AssistantChat({
  shape,
  chatIsActivity = false,
}: {
  shape: ChatShape;
  chatIsActivity?: boolean;
}) {
  const turns = useChatTurns();
  const status = useChatStatus();
  const currentId = useCurrentSessionId();
  if (shape === 'hidden') return null;

  const isSide = shape === 'side';
  const showLift = shape === 'activity';
  const turnCount = turns.length;
  const hasActiveSession = currentId !== null && turnCount > 0;
  // The rail always shows OTHER chats when the live chat owns the
  // activity area — otherwise the user sees the same conversation
  // duplicated in two panels at once.
  const railShowsHistory = isSide && (chatIsActivity || !hasActiveSession);

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
                {railShowsHistory ? 'HISTORY' : 'ACTIVE'}
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
        {railShowsHistory ? (
          <ChatHistoryList excludeId={chatIsActivity ? currentId : null} />
        ) : (
          turns.map((t) => (
            <AssistantTurn key={t.id} turn={t} showLift={showLift} />
          ))
        )}
      </S.AppChatTranscript>
    </S.AppChatPanel>
  );
}
