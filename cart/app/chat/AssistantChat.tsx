// Persistent assistant chat — root.
//
// Two visible shapes (concept art panels in cart/app/app.md →
// "Persistent assistant chat (full ↔ side fluid surface)"):
//
//   - 'side' (state B) — pinned inside AppSideMenuInput, above the
//     docked InputStrip. Shows `DOCKED` pill + subline; hides the
//     ▸ LIFT affordance and surface command previews.
//
//   - 'full' (state C) — fills the activity content area, above the
//     bottom InputStrip. Hides the `DOCKED` pill + subline; shows
//     the LIFT affordances and command previews.
//
// The composer footer in the concept art (the routing/attachments
// envelope + the prompt input) is the existing <InputStrip> — the
// chat does NOT render a second composer. The shell mounts the chat
// above the InputStrip in whichever slot the GOLDEN morph has placed
// the input today.
//
// Identity: the chat may re-mount when its slot changes, but the
// thread state lives in `./store`, so the transcript content survives
// the swap. v1 fixtures only; real generation arrives through a
// `useAssistantChat()` hook in the follow-up commit.

import { classifiers as S } from '@reactjit/core';
import type { ChatShape } from './types';
import { useChatTurns } from './store';
import { AssistantTurn } from './AssistantTurn';

export function AssistantChat({
  shape,
  onToggleShape,
}: {
  shape: ChatShape;
  onToggleShape?: () => void;
}) {
  const turns = useChatTurns();
  if (shape === 'hidden') return null;

  const isSide = shape === 'side';
  const showLift = shape === 'full';
  const turnCount = turns.length;

  return (
    <S.AppChatPanel>
      <S.AppChatPanelHeader>
        <S.AppChatPanelHeaderLeft>
          <S.AppChatPanelHeaderDot />
          <S.AppChatPanelHeaderTitle>01 ASSISTANT</S.AppChatPanelHeaderTitle>
          {isSide ? (
            <S.AppChatPanelHeaderState>
              <S.AppChatPanelHeaderStateText>DOCKED</S.AppChatPanelHeaderStateText>
            </S.AppChatPanelHeaderState>
          ) : null}
        </S.AppChatPanelHeaderLeft>
        <S.AppChatPanelHeaderToggle onPress={onToggleShape}>
          <S.AppChatPanelHeaderToggleText>{isSide ? '↗' : '↘'}</S.AppChatPanelHeaderToggleText>
        </S.AppChatPanelHeaderToggle>
      </S.AppChatPanelHeader>

      {isSide ? (
        <S.AppChatPanelSubline>
          <S.AppChatPanelSublineText>
            {`PERSISTENT · ${turnCount} TURNS · DRAG ANY SURFACE TO CART`}
          </S.AppChatPanelSublineText>
        </S.AppChatPanelSubline>
      ) : null}

      <S.AppChatTranscript>
        {turns.map((t) => (
          <AssistantTurn key={t.id} turn={t} showLift={showLift} />
        ))}
      </S.AppChatTranscript>
    </S.AppChatPanel>
  );
}
