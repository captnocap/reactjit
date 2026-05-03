import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Row } from '@reactjit/runtime/primitives';

export function IntentRow({ children }: { children?: any }) {
  const Inline = S.InlineX4Center || Row;
  return (
    <Inline style={{ flexWrap: 'wrap' }}>
      {children}
    </Inline>
  );
}
