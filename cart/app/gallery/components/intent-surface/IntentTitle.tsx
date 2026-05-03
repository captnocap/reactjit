import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Text } from '@reactjit/runtime/primitives';

export function IntentTitle({ children }: { children?: any }) {
  const Title = S.Title || Text;
  return <Title>{children}</Title>;
}
