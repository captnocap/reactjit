import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Col } from '@reactjit/runtime/primitives';

export function IntentCol({ children }: { children?: any }) {
  const Stack = S.StackX4 || Col;
  return <Stack>{children}</Stack>;
}
