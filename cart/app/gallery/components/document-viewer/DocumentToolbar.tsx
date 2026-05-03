import { classifiers as S } from '@reactjit/core';
import { Minus, PanelLeft, Plus } from '@reactjit/runtime/icons/icons';
import { Icon, type IconData } from '../../../sweatshop/components/icons';
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
  icon,
  active,
  onPress,
}: {
  icon: IconData;
  active?: boolean;
  onPress?: () => void;
}) {
  if (active) {
    return (
      <S.DocToolbarBtnActive onPress={onPress}>
        <Icon icon={icon} size={14} color="#0e0b09" strokeWidth={2.2} />
      </S.DocToolbarBtnActive>
    );
  }
  return (
    <S.DocToolbarBtn onPress={onPress}>
      <Icon icon={icon} size={14} color="#f2e8dc" strokeWidth={2.2} />
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
        <ToolbarButton icon={PanelLeft} active={outlineVisible} onPress={onToggleOutline} />
      ) : null}

      <S.DocToolbarTitleSlot>
        <S.DocToolbarTitle>{title}</S.DocToolbarTitle>
        {!compact && activeSection ? (
          <S.DocToolbarSection>{activeSection.toUpperCase()}</S.DocToolbarSection>
        ) : null}
      </S.DocToolbarTitleSlot>

      {!compact ? (
        <S.InlineX3>
          <ToolbarButton icon={Minus} onPress={onZoomOut} />
          <S.DocToolbarZoom>{`${Math.round(zoomPct)}%`}</S.DocToolbarZoom>
          <ToolbarButton icon={Plus} onPress={onZoomIn} />
        </S.InlineX3>
      ) : null}
    </S.DocToolbar>
  );
}
