import { Col, Row, Text, Pressable, Box } from '@reactjit/runtime/primitives';
import { InspectorNode } from '../types';
import { COLORS } from '../constants';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';

export default function TreeContext({
  node,
  index,
  onSelect,
}: {
  node: InspectorNode;
  index: Map<number, InspectorNode>;
  onSelect: (id: number) => void;
}) {
  const parent = index.get(node.parentId);
  const siblings = parent
    ? parent.children.filter((c) => c.id !== node.id)
    : [];

  return (
    <Col style={{ gap: 10 }}>
      {/* Parent */}
      <SectionHeader title="Parent" />
      {parent ? (
        <Pressable
          onPress={() => onSelect(parent.id)}
          style={{
            backgroundColor: COLORS.bg,
            borderRadius: 6,
            padding: 8,
            gap: 4,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Row style={{ gap: 6, alignItems: 'center' }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>
              {parent.debugName || parent.type}
            </Text>
            <Badge text={`#${parent.id}`} />
          </Row>
          <Text fontSize={9} color={COLORS.textDim}>
            {`${parent.children.length} children`}
          </Text>
        </Pressable>
      ) : (
        <Text fontSize={10} color={COLORS.textDim} style={{ padding: 8 }}>
          Root node (no parent)
        </Text>
      )}

      {/* Siblings */}
      {siblings.length > 0 && (
        <>
          <SectionHeader title={`Siblings (${siblings.length})`} />
          <Col style={{ gap: 4 }}>
            {siblings.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onSelect(s.id)}
                style={{
                  backgroundColor: COLORS.bg,
                  borderRadius: 6,
                  padding: 8,
                  gap: 4,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Row style={{ gap: 6, alignItems: 'center' }}>
                  <Text fontSize={10} color={COLORS.text}>
                    {s.debugName || s.type}
                  </Text>
                  <Badge text={`#${s.id}`} />
                </Row>
              </Pressable>
            ))}
          </Col>
        </>
      )}

      {/* Children */}
      <SectionHeader title={`Children (${node.children.length})`} />
      {node.children.length > 0 ? (
        <Col style={{ gap: 4 }}>
          {node.children.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => onSelect(c.id)}
              style={{
                backgroundColor: COLORS.bg,
                borderRadius: 6,
                padding: 8,
                gap: 4,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Row style={{ gap: 6, alignItems: 'center' }}>
                <Text fontSize={10} color={COLORS.text}>
                  {c.debugName || c.type}
                </Text>
                <Badge text={`#${c.id}`} />
                {c.children.length > 0 && (
                  <Text fontSize={9} color={COLORS.textDim}>
                    {`${c.children.length} children`}
                  </Text>
                )}
              </Row>
            </Pressable>
          ))}
        </Col>
      ) : (
        <Text fontSize={10} color={COLORS.textDim} style={{ padding: 8 }}>
          Leaf node (no children)
        </Text>
      )}
    </Col>
  );
}
