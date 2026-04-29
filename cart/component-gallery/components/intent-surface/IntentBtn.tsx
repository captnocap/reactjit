import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Pressable, Text } from '@reactjit/runtime/primitives';
import type { OnAction } from './types';

interface Props {
  /** What gets sent back as the next user message when clicked. */
  reply: string;
  /** Visual label. Defaults to the reply text. */
  label?: string;
  onAction: OnAction;
}

export function IntentBtn({ reply, label, onAction }: Props) {
  const Button = S.Button || Pressable;
  const Label = S.ButtonLabel || Text;

  return (
    <Button onPress={() => onAction(reply)} style={{ alignSelf: 'flex-start' }}>
      <Label>{label ?? reply}</Label>
    </Button>
  );
}
