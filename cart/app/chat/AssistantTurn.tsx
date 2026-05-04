// One turn render. The transcript stacks these top-to-bottom.
//
// Concept-art delta between side and full:
//   - 'side' hides the `▸ LIFT` affordance and the surface command
//     preview (limited horizontal real estate)
//   - 'full' shows both
// `showLift` flows down from <AssistantChat>; the surface card itself
// reads `showCommand` from the same prop.

import { classifiers as S } from '@reactjit/core';
import type { AssistantTurn as AssistantTurnT } from './types';
import { AssistantSurface } from './AssistantSurface';

export function AssistantTurn({
  turn,
  showLift,
}: {
  turn: AssistantTurnT;
  showLift: boolean;
}) {
  if (turn.author === 'user') {
    return (
      <S.AppChatTurn>
        <S.AppChatTurnMetaRow>
          <S.AppChatTurnAuthor>
            <S.AppChatTurnAuthorText>YOU</S.AppChatTurnAuthorText>
          </S.AppChatTurnAuthor>
          <S.AppChatTurnTime>{turn.timestamp}</S.AppChatTurnTime>
        </S.AppChatTurnMetaRow>
        <S.AppChatYouTurn>
          <S.AppChatYouTurnCaret>{'>'}</S.AppChatYouTurnCaret>
          <S.AppChatYouTurnText>{turn.body}</S.AppChatYouTurnText>
        </S.AppChatYouTurn>
      </S.AppChatTurn>
    );
  }

  // assistant turn
  const hasSurface = !!turn.surface;
  // Intent surfaces replace the body — the raw `[<Title>...</Title>]`
  // text the model emitted is just markup we already parsed and rendered
  // as a card. Showing it again as prose alongside the card is noise.
  const isIntent = turn.surface?.kind === 'intent';
  return (
    <S.AppChatTurn>
      <S.AppChatTurnMetaRow>
        <S.AppChatTurnAuthor>
          <S.AppChatTurnAuthorText>ASST</S.AppChatTurnAuthorText>
        </S.AppChatTurnAuthor>
        <S.AppChatTurnTime>{turn.timestamp}</S.AppChatTurnTime>
        {hasSurface ? (
          <S.AppChatTurnTag>
            <S.AppChatTurnTagText>SURFACE</S.AppChatTurnTagText>
          </S.AppChatTurnTag>
        ) : null}
        {showLift && turn.lift ? (
          <S.AppChatTurnLift>{'> LIFT'}</S.AppChatTurnLift>
        ) : null}
      </S.AppChatTurnMetaRow>
      {turn.body && !isIntent ? (
        <S.AppChatTurnBody>{turn.body}</S.AppChatTurnBody>
      ) : null}
      {turn.surface ? (
        <AssistantSurface surface={turn.surface} showCommand={showLift} />
      ) : null}
    </S.AppChatTurn>
  );
}
