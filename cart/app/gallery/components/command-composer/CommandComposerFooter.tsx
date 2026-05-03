import { classifiers as S } from '@reactjit/core';
import type { CommandComposer } from '../../data/command-composer';
import { CommandComposerShortcutHint } from './CommandComposerShortcut';

export function CommandComposerFooter({ row }: { row: CommandComposer }) {
  return (
    <S.CommandComposerFooter>
      <S.CommandComposerFooterShortcuts>
        {row.leftShortcuts.map((shortcut) => (
          <CommandComposerShortcutHint key={shortcut.id} shortcut={shortcut} />
        ))}
      </S.CommandComposerFooterShortcuts>
      <S.Spacer />
      <CommandComposerShortcutHint shortcut={row.executeShortcut} />
    </S.CommandComposerFooter>
  );
}
