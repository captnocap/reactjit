// Embedded surface card inside an assistant turn.
//
// v1 hand-renders two kinds — `audit` and `fleet` — straight from the
// concept-art panels. The follow-up commit routes this through
// `runtime/intent/render` (`<RenderIntent>`) so model-emitted chat-loom
// trees become the same shape automatically. Until then: classifier-only,
// no inline hex, no inline color literals.

import { classifiers as S } from '@reactjit/core';
import { RenderIntent } from '@reactjit/runtime/intent/render';
import type { ChatAction, ChatSurface, FleetMember, FleetState } from './types';
import { askAssistant } from './store';

function ActionButton({ action }: { action: ChatAction }) {
  const Btn = action.primary ? S.AppChatSurfaceActionPrimary : S.AppChatSurfaceAction;
  return (
    <Btn>
      <S.AppChatSurfaceActionText>{action.label}</S.AppChatSurfaceActionText>
    </Btn>
  );
}

function ActionRow({ actions }: { actions: ChatAction[] }) {
  if (actions.length === 0) return null;
  return (
    <S.AppChatSurfaceActions>
      {actions.map((a) => <ActionButton key={a.id} action={a} />)}
    </S.AppChatSurfaceActions>
  );
}

// Status pill — discrete classifier per state. Adding a new state means
// adding a sibling classifier in components.cls.ts; never inline a color.
function StatusPill({ state }: { state: FleetState }) {
  if (state === 'tool') {
    return (
      <S.AppChatStatusPillTool>
        <S.AppChatStatusPillTextTool>TOOL</S.AppChatStatusPillTextTool>
      </S.AppChatStatusPillTool>
    );
  }
  if (state === 'stuck') {
    return (
      <S.AppChatStatusPillStuck>
        <S.AppChatStatusPillTextStuck>STUCK</S.AppChatStatusPillTextStuck>
      </S.AppChatStatusPillStuck>
    );
  }
  if (state === 'rat') {
    return (
      <S.AppChatStatusPillRat>
        <S.AppChatStatusPillTextRat>RAT</S.AppChatStatusPillTextRat>
      </S.AppChatStatusPillRat>
    );
  }
  return (
    <S.AppChatStatusPill>
      <S.AppChatStatusPillText>IDLE</S.AppChatStatusPillText>
    </S.AppChatStatusPill>
  );
}

function FleetCell({ m }: { m: FleetMember }) {
  return (
    <S.AppChatFleetCell>
      <S.AppChatFleetCellName>{m.id}</S.AppChatFleetCellName>
      <StatusPill state={m.state} />
    </S.AppChatFleetCell>
  );
}

// Whether to show the command preview line (`$ swarm audit ...`).
// Concept image #1 (side, 360w dock) hides it; image #2 (full) shows
// it. v1 trusts the prop.
export function AssistantSurface({
  surface,
  showCommand,
}: {
  surface: ChatSurface;
  showCommand: boolean;
}) {
  if (surface.kind === 'intent') {
    // Model-emitted chat-loom tree. Btn / Submit replies bounce back
    // through askAssistant, which appends a fresh user turn and kicks
    // a new ask — same path as if the user typed it.
    return (
      <RenderIntent
        nodes={surface.nodes}
        onAction={(reply) => { askAssistant(reply).catch(() => { /* provider records [error] on the asst turn */ }); }}
      />
    );
  }

  if (surface.kind === 'audit') {
    return (
      <S.AppChatSurfaceCard>
        <S.AppChatSurfaceHeader>
          <S.AppChatSurfaceTitle>{surface.title}</S.AppChatSurfaceTitle>
          {surface.tag ? (
            <S.AppChatSurfaceTag>
              <S.AppChatSurfaceTagText>{surface.tag}</S.AppChatSurfaceTagText>
            </S.AppChatSurfaceTag>
          ) : null}
        </S.AppChatSurfaceHeader>
        {surface.body ? (
          <S.AppChatSurfaceBody>{surface.body}</S.AppChatSurfaceBody>
        ) : null}
        {showCommand && surface.command ? (
          <S.AppChatSurfaceCommand>
            <S.AppChatSurfaceCommandText>{surface.command}</S.AppChatSurfaceCommandText>
          </S.AppChatSurfaceCommand>
        ) : null}
        <ActionRow actions={surface.actions} />
      </S.AppChatSurfaceCard>
    );
  }

  // 'fleet'
  return (
    <S.AppChatSurfaceCard>
      <S.AppChatSurfaceTitle>{surface.title}</S.AppChatSurfaceTitle>
      <S.AppChatFleetGrid>
        <S.AppChatFleetRow>
          {surface.members.map((m) => <FleetCell key={m.id} m={m} />)}
        </S.AppChatFleetRow>
      </S.AppChatFleetGrid>
      {surface.note ? (
        <S.AppChatFleetNote>{surface.note}</S.AppChatFleetNote>
      ) : null}
      <ActionRow actions={surface.actions} />
    </S.AppChatSurfaceCard>
  );
}
