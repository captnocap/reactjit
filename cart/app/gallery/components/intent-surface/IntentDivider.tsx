import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Box } from '@reactjit/runtime/primitives';

export function IntentDivider() {
  const Divider = S.Divider || Box;
  return <Divider />;
}
