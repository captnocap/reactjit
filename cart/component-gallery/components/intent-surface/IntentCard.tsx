import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Col } from '@reactjit/runtime/primitives';

export function IntentCard({ children }: { children?: any }) {
  const Card = S.Card || Col;
  return <Card>{children}</Card>;
}
