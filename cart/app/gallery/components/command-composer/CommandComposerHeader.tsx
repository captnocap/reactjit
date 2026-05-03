import { classifiers as S } from '@reactjit/core';
import { ChevronRight } from '@reactjit/runtime/icons/icons';
import { Icon } from '../../../sweatshop/components/icons';
import type { CommandComposer } from '../../data/command-composer';
import { CommandComposerChip } from './CommandComposerChip';

function ComposerDividerIcon() {
  return (
    <S.CommandComposerToolbarIconSlot>
      <Icon icon={ChevronRight} size={12} color="#7a6e5d" strokeWidth={2.2} />
    </S.CommandComposerToolbarIconSlot>
  );
}

export function CommandComposerHeader({ row }: { row: CommandComposer }) {
  return (
    <S.CommandComposerTopbar>
      <S.CommandComposerTopCluster>
        <S.CommandComposerMetaText>{row.routingLabel}</S.CommandComposerMetaText>
        <ComposerDividerIcon />
        <CommandComposerChip chip={row.route} />
        <CommandComposerChip chip={row.target} />
      </S.CommandComposerTopCluster>

      <S.CommandComposerTopCluster>
        <S.CommandComposerMetaText>{row.attachLabel}</S.CommandComposerMetaText>
        <ComposerDividerIcon />
        {row.attachments.map((attachment) => (
          <CommandComposerChip key={attachment.id} chip={attachment} />
        ))}
      </S.CommandComposerTopCluster>
    </S.CommandComposerTopbar>
  );
}
