import { Col, Row, Text, Pressable, Box } from '../../../runtime/primitives';
import { InspectorNode } from '../types';
import { COLORS } from '../constants';
import { typeColor, typeLabel, safeString, looksLikeColor } from '../utils';
import SectionHeader from '../components/SectionHeader';

function PropRow({
  label,
  value,
  onEdit,
  onDelete,
}: {
  label: string;
  value: any;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const str = String(value);
  const isColor = looksLikeColor(value);

  const copy = () => {
    const text = safeString(value, 10000);
    if ((globalThis as any).__copyToClipboard) {
      (globalThis as any).__copyToClipboard(text);
    } else {
      console.log('[copy]', text);
    }
  };

  return (
    <Row
      style={{
        backgroundColor: COLORS.bg,
        borderRadius: 6,
        padding: 8,
        gap: 8,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'transparent',
      }}
      hoverStyle={{
        borderColor: COLORS.borderLight,
      }}
    >
      <Row style={{ gap: 8, alignItems: 'center', flexGrow: 1, overflow: 'hidden' }}>
        <Text fontSize={10} color={COLORS.blue} style={{ minWidth: 100, fontWeight: 'bold' }}>
          {label}
        </Text>
        {isColor ? (
          <Row style={{ gap: 6, alignItems: 'center' }}>
            <Box
              style={{
                width: 16,
                height: 16,
                backgroundColor: str,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            />
            <Text fontSize={10} color={COLORS.orange}>
              {safeString(value, 120)}
            </Text>
          </Row>
        ) : (
          <Text fontSize={10} color={typeColor(value)} style={{ flexGrow: 1 }} numberOfLines={1}>
            {safeString(value, 120)}
          </Text>
        )}
        <Text fontSize={8} color={COLORS.textDim} style={{ backgroundColor: COLORS.bgElevated, borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
          {typeLabel(value)}
        </Text>
      </Row>
      <Row style={{ gap: 4 }}>
        <Pressable
          onPress={copy}
          style={{
            backgroundColor: COLORS.bgElevated,
            borderRadius: 4,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          <Text fontSize={8} color={COLORS.textDim}>copy</Text>
        </Pressable>
        <Pressable
          onPress={onEdit}
          style={{
            backgroundColor: COLORS.bgElevated,
            borderRadius: 4,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          <Text fontSize={8} color={COLORS.accentLight}>edit</Text>
        </Pressable>
        {onDelete ? (
          <Pressable
            onPress={onDelete}
            style={{
              backgroundColor: '#5a1d1d',
              borderRadius: 4,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            <Text fontSize={8} color={COLORS.red}>del</Text>
          </Pressable>
        ) : null}
      </Row>
    </Row>
  );
}

export default function PropEditor({
  node,
  onEdit,
  onDelete,
  onAdd,
}: {
  node: InspectorNode;
  onEdit: (key: string) => void;
  onDelete: (key: string) => void;
  onAdd: () => void;
}) {
  const entries = Object.keys(node.props || {})
    .filter((k) => k !== 'style' && k !== 'children')
    .map((k) => ({ key: k, value: node.props[k] }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <Col style={{ gap: 6 }}>
      <SectionHeader
        title={`Properties (${entries.length})`}
        right={
          <Pressable
            onPress={onAdd}
            style={{
              backgroundColor: COLORS.bgElevated,
              borderRadius: 4,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 2,
              paddingBottom: 2,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text fontSize={9} color={COLORS.accentLight}>+ Add</Text>
          </Pressable>
        }
      />
      <Col style={{ gap: 4 }}>
        {entries.map(({ key, value }) => (
          <PropRow
            key={key}
            label={key}
            value={value}
            onEdit={() => onEdit(key)}
            onDelete={
              key !== 'id' && key !== 'children' && key !== 'type'
                ? () => onDelete(key)
                : undefined
            }
          />
        ))}
        {entries.length === 0 && (
          <Text fontSize={10} color={COLORS.textDim} style={{ padding: 8 }}>
            No properties
          </Text>
        )}
      </Col>
    </Col>
  );
}
