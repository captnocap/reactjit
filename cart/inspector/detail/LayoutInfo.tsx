import { Col, Row, Text, Box } from '../../../runtime/primitives';
import { InspectorNode } from '../types';
import { COLORS } from '../constants';
import SectionHeader from '../components/SectionHeader';
import Badge from '../components/Badge';

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <Row
      style={{
        backgroundColor: COLORS.bg,
        borderRadius: 6,
        padding: 8,
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>
        {label}
      </Text>
      <Text fontSize={10} color={COLORS.text}>
        {String(value)}
      </Text>
    </Row>
  );
}

function BoxModel({ node }: { node: InspectorNode }) {
  const s = node.style || {};
  const margin = s.margin || 0;
  const border = s.borderWidth || 0;
  const padding = s.padding || 0;

  return (
    <Col style={{ gap: 6, alignItems: 'center' }}>
      {/* Margin layer */}
      <Box
        style={{
          backgroundColor: COLORS.margin,
          borderRadius: 6,
          padding: 16,
          borderWidth: 1,
          borderColor: COLORS.marginBorder,
          alignItems: 'center',
        }}
      >
        <Text fontSize={8} color={COLORS.orange} style={{ marginBottom: 4 }}>margin</Text>
        {/* Border layer */}
        <Box
          style={{
            backgroundColor: `${COLORS.yellow}18`,
            borderRadius: 4,
            padding: 12,
            borderWidth: 1,
            borderColor: `${COLORS.yellow}88`,
            alignItems: 'center',
          }}
        >
          {/* Padding layer */}
          <Box
            style={{
              backgroundColor: COLORS.padding,
              borderRadius: 4,
              padding: 14,
              borderWidth: 1,
              borderColor: COLORS.paddingBorder,
              alignItems: 'center',
            }}
          >
            <Text fontSize={8} color={COLORS.green} style={{ marginBottom: 4 }}>padding</Text>
            {/* Content layer */}
            <Box
              style={{
                backgroundColor: COLORS.content,
                borderRadius: 4,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.contentBorder,
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 80,
              }}
            >
              <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>
                {s.width !== undefined ? `${s.width}` : 'auto'}
              </Text>
              <Text fontSize={8} color={COLORS.textDim}>
                ×
              </Text>
              <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>
                {s.height !== undefined ? `${s.height}` : 'auto'}
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
      <Row style={{ gap: 12 }}>
        <Text fontSize={9} color={COLORS.orange}>{`m: ${margin}`}</Text>
        <Text fontSize={9} color={COLORS.yellow}>{`b: ${border}`}</Text>
        <Text fontSize={9} color={COLORS.green}>{`p: ${padding}`}</Text>
      </Row>
    </Col>
  );
}

export default function LayoutInfo({
  node,
  index,
}: {
  node: InspectorNode;
  index: Map<number, InspectorNode>;
}) {
  const chain: InspectorNode[] = [];
  let cur: InspectorNode | undefined = node;
  while (cur) {
    chain.unshift(cur);
    cur = index.get(cur.parentId);
  }

  const descendants = (n: InspectorNode): number => {
    let c = 0;
    const stack = [n];
    while (stack.length) {
      const x = stack.pop()!;
      c += x.children.length;
      for (const ch of x.children) stack.push(ch);
    }
    return c;
  };

  return (
    <Col style={{ gap: 10 }}>
      <SectionHeader title="Computed Layout" />
      <Col style={{ gap: 4 }}>
        <InfoRow label="Descendants" value={descendants(node)} />
        <InfoRow label="Children" value={node.children.length} />
        <InfoRow label="Handlers" value={node.handlers?.length || 0} />
        <InfoRow label="Depth" value={chain.length - 1} />
        <InfoRow label="Type" value={node.type} />
        <InfoRow label="ID" value={node.id} />
      </Col>

      <SectionHeader title="Box Model" />
      <BoxModel node={node} />

      {node.style && (
        <>
          <SectionHeader title="Flex Layout" />
          <Col style={{ gap: 4 }}>
            {([
              'flexDirection',
              'flexWrap',
              'flexGrow',
              'flexShrink',
              'flexBasis',
              'justifyContent',
              'alignItems',
              'alignSelf',
              'alignContent',
              'gap',
              'rowGap',
              'columnGap',
            ] as const).map((k) => {
              const v = node.style![k];
              if (v === undefined) return null;
              return <InfoRow key={k} label={k} value={String(v)} />;
            })}
          </Col>
        </>
      )}

      <SectionHeader title="Ancestors" />
      <Row style={{ flexWrap: 'wrap', gap: 4 }}>
        {chain.map((n, i) => (
          <Row key={n.id} style={{ gap: 4, alignItems: 'center' }}>
            {i > 0 ? <Text fontSize={9} color={COLORS.textDim}>{'>'}</Text> : null}
            <Badge text={n.debugName || n.type} color={COLORS.cyan} />
          </Row>
        ))}
      </Row>

      <SectionHeader title="Handlers" />
      <Row style={{ flexWrap: 'wrap', gap: 4 }}>
        {(node.handlers || []).length === 0 ? (
          <Text fontSize={10} color={COLORS.textDim}>No event handlers</Text>
        ) : (
          (node.handlers || []).map((h) => <Badge key={h} text={h} color={COLORS.purple} />)
        )}
      </Row>

      {node.debugSource?.fileName ? (
        <>
          <SectionHeader title="Source" />
          <Text fontSize={10} color={COLORS.yellow}>
            {`${node.debugSource.fileName}:${node.debugSource.lineNumber ?? '?'}`}
          </Text>
        </>
      ) : null}
    </Col>
  );
}
