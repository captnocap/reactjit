import { classifiers as S } from '@reactjit/core';

export function CommandComposerActionRail({
  modeGlyph,
  sendLabel,
}: {
  modeGlyph: string;
  sendLabel: string;
}) {
  return (
    <S.CommandComposerShortcutGroup>
      <S.CommandComposerIconButton>
        <S.CommandComposerIconText>{modeGlyph}</S.CommandComposerIconText>
      </S.CommandComposerIconButton>
      <S.CommandComposerSend>
        <S.CommandComposerActionText>{sendLabel}</S.CommandComposerActionText>
      </S.CommandComposerSend>
    </S.CommandComposerShortcutGroup>
  );
}
