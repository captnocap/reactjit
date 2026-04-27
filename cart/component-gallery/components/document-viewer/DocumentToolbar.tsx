import { classifiers as S } from '@reactjit/core';
import type { DocumentSize } from './documentViewerShared';

export type DocumentToolbarProps = {
  title: string;
  activeSection?: string | null;
  size: DocumentSize;
  outlineVisible: boolean;
  canToggleOutline: boolean;
  onToggleOutline?: () => void;
  zoomPct: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
};

function ToolbarButton({
  glyph,
  active,
  onPress,
}: {
  glyph: string;
  active?: boolean;
  onPress?: () => void;
}) {
  if (active) {
    return (
      <S.DocToolbarBtnActive onPress={onPress}>
        <S.DocToolbarGlyph>{glyph}</S.DocToolbarGlyph>
      </S.DocToolbarBtnActive>
    );
  }
  return (
    <S.DocToolbarBtn onPress={onPress}>
      <S.DocToolbarGlyph>{glyph}</S.DocToolbarGlyph>
    </S.DocToolbarBtn>
  );
}

export function DocumentToolbar({
  title,
  activeSection,
  size,
  outlineVisible,
  canToggleOutline,
  onToggleOutline,
  zoomPct,
  onZoomIn,
  onZoomOut,
}: DocumentToolbarProps) {
  const compact = size === 'compact';

  return (
    <S.DocToolbar>
      {canToggleOutline ? (
        <ToolbarButton glyph="≡" active={outlineVisible} onPress={onToggleOutline} />
      ) : null}

      <S.DocToolbarTitleSlot>
        <S.DocToolbarTitle>{title}</S.DocToolbarTitle>
        {!compact && activeSection ? (
          <S.DocToolbarSection>{activeSection.toUpperCase()}</S.DocToolbarSection>
        ) : null}
      </S.DocToolbarTitleSlot>

      {!compact ? (
        <S.InlineX3>
          <ToolbarButton glyph="−" onPress={onZoomOut} />
          <S.DocToolbarZoom>{`${Math.round(zoomPct)}%`}</S.DocToolbarZoom>
          <ToolbarButton glyph="+" onPress={onZoomIn} />
        </S.InlineX3>
      ) : null}
    </S.DocToolbar>
  );
}
