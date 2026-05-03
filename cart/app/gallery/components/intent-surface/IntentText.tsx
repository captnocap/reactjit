import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Text } from '@reactjit/runtime/primitives';

export function IntentText({ children }: { children?: any }) {
  const Body = S.Body || Text;
  return <Body>{children}</Body>;
}
