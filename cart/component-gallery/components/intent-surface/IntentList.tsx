import '../../components.cls';
import { classifiers as S } from '@reactjit/core';
import { Col, Text } from '@reactjit/runtime/primitives';

export function IntentList({ items }: { items: string[] }) {
  const Stack = S.StackX2 || Col;
  const Item = S.Body || Text;
  return (
    <Stack>
      {items.map((it, i) => (
        <Item key={i}>{`• ${it}`}</Item>
      ))}
    </Stack>
  );
}
