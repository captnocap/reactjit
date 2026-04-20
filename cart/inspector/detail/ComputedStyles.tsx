import { Col, Row, Text, Box } from '../../../runtime/primitives';
import { InspectorNode } from '../types';
import { COLORS } from '../constants';
import { looksLikeColor } from '../utils';
import SectionHeader from '../components/SectionHeader';

function StyleValue({ value }: { value: any }) {
  const str = String(value);
  const isColor = looksLikeColor(value);
  return (
    <Row style={{ gap: 6, alignItems: 'center' }}>
      {isColor ? (
        <>
          <Box style={{ width: 16, height: 16, backgroundColor: str, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border }} />
          <Text fontSize={10} color={COLORS.orange}>{str}</Text>
        </>
      ) : (
        <Text fontSize={10} color={COLORS.text}>{str}</Text>
      )}
    </Row>
  );
}

export default function ComputedStyles({
  node,
  index,
}: {
  node: InspectorNode;
  index: Map<number, InspectorNode>;
}) {
  const inherited: Record<string, { value: any; source: string }> = {};
  let cur: InspectorNode | undefined = node;
  while (cur) {
    if (cur.style) {
      for (const [key, value] of Object.entries(cur.style)) {
        if (!(key in inherited)) {
          inherited[key] = { value, source: cur.debugName || cur.type };
        }
      }
    }
    cur = index.get(cur.parentId);
  }

  const ownKeys = node.style ? Object.keys(node.style) : [];
  const allKeys = Object.keys(inherited).sort();

  return (
    <Col style={{ gap: 6 }}>
      <SectionHeader
        title="Computed Styles"
        right={<Text fontSize={9} color={COLORS.textDim}>{`${allKeys.length} properties`}</Text>}
      />
      <Col style={{ gap: 4 }}>
        {allKeys.map((key) => {
          const isOwn = ownKeys.includes(key);
          const entry = inherited[key];
          return (
            <Row
              key={key}
              style={{
                backgroundColor: isOwn ? COLORS.bg : COLORS.bgPanel,
                borderRadius: 6,
                padding: 8,
                gap: 8,
                alignItems: 'center',
                justifyContent: 'space-between',
                borderLeftWidth: isOwn ? 3 : 0,
                borderColor: COLORS.accentLight,
              }}
            >
              <Row style={{ gap: 8, alignItems: 'center', flexGrow: 1 }}>
                <Text fontSize={10} color={COLORS.blue} style={{ minWidth: 120, fontWeight: 'bold' }}>{key}</Text>
                <StyleValue value={entry.value} />
              </Row>
              <Text fontSize={9} color={COLORS.textDim}>{entry.source}</Text>
            </Row>
          );
        })}
        {allKeys.length === 0 && (
          <Text fontSize={10} color={COLORS.textDim} style={{ padding: 8 }}>No computed styles available</Text>
        )}
      </Col>
    </Col>
  );
}
