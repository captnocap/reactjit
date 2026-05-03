import { Box, Pressable, Row } from '@reactjit/runtime/primitives';
import {
  Blend,
  Circle,
  Copy,
  Folder,
  Layers,
  MoreHorizontal,
  Plus,
  Trash2,
} from '@reactjit/runtime/icons/icons';
import { classifiers as S } from '@reactjit/core';
import { Icon } from '../../../sweatshop/components/icons';
import { KeyValueBadge } from '../controls-specimen/KeyValueBadge';
import { StatusBadge } from '../controls-specimen/StatusBadge';
import { StripBadge } from '../controls-specimen/StripBadge';
import { CTRL } from '../controls-specimen/controlsSpecimenTheme';

export type LayerToolbarProps = {
  documentName: string;
  activeChannel: string;
  layerCount: number;
  visibleCount: number;
};

type ToolButtonProps = {
  icon: number[][];
  active?: boolean;
  onPress?: () => void;
};

export function LayerToolButton({ icon, active = false, onPress }: ToolButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 28,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: active ? CTRL.accent : CTRL.rule,
        backgroundColor: active ? CTRL.softAccent : CTRL.bg2,
      }}
    >
      <Icon icon={icon} size={13} color={active ? CTRL.accent : CTRL.inkDim} strokeWidth={2.1} />
    </Pressable>
  );
}

export function LayerToolbar({
  documentName,
  activeChannel,
  layerCount,
  visibleCount,
}: LayerToolbarProps) {
  return (
    <S.GitLaneTopbar>
      <Row style={{ alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Icon icon={Layers} size={15} color={CTRL.accent} strokeWidth={2.2} />
        <S.GitTextHot>LAYERS</S.GitTextHot>
        <StatusBadge label={`${layerCount} TOTAL`} tone="accent" variant="led" />
        <StatusBadge label={`${visibleCount} ON`} tone="ok" variant="dot" />
      </Row>
      <Box style={{ flexGrow: 1 }} />
      <StripBadge
        segments={[
          { label: activeChannel, tone: 'blue' },
          { label: 'ALPHA', tone: 'ok' },
        ]}
      />
      <KeyValueBadge label="DOC" value={documentName} tone="neutral" />
      <Row style={{ alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <LayerToolButton icon={Plus} active />
        <LayerToolButton icon={Folder} />
        <LayerToolButton icon={Circle} />
        <LayerToolButton icon={Blend} active />
        <LayerToolButton icon={Copy} />
        <LayerToolButton icon={Trash2} />
        <LayerToolButton icon={MoreHorizontal} />
      </Row>
    </S.GitLaneTopbar>
  );
}
