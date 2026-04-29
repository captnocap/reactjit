import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Box, Text } from '@reactjit/runtime/primitives';

/**
 * Inline keyboard chip — for showing shortcuts like Cmd+S, Ctrl+K, Esc.
 * Smaller and lighter than Badge; designed to live inline with text.
 */
export function IntentKbd({ children }: { children?: any }) {
  const Keycap = S.CodeBlockBadge || Box;
  const Label = S.CodeBlockBadgeText || Text;

  return (
    <Keycap style={{ alignSelf: 'flex-start' }}>
      <Label>{children}</Label>
    </Keycap>
  );
}
