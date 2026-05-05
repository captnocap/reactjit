import { Row, Text, Pressable } from '@reactjit/runtime/primitives';
import { InspectorNode } from '../types';
import { COLORS } from '../constants';

export default function Breadcrumbs({
  node,
  index,
  onSelect,
}: {
  node: InspectorNode | null;
  index: Map<number, InspectorNode>;
  onSelect: (id: number) => void;
}) {
  if (!node) return null;
  const chain: InspectorNode[] = [];
  let cur: InspectorNode | undefined = node;
  while (cur) {
    chain.unshift(cur);
    cur = index.get(cur.parentId);
  }

  return (
    <Row style={{ gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {chain.map((n, i) => (
        <Row key={n.id} style={{ gap: 4, alignItems: 'center' }}>
          {i > 0 ? (
            <Text fontSize={9} color={COLORS.textDim}>{'›'}</Text>
          ) : null}
          <Pressable onPress={() => onSelect(n.id)}>
            <Text
              fontSize={9}
              color={n.id === node.id ? COLORS.accentLight : COLORS.textDim}
              style={{ fontWeight: n.id === node.id ? 'bold' : 'normal' }}
            >
              {n.debugName || n.type}
            </Text>
          </Pressable>
        </Row>
      ))}
    </Row>
  );
}
