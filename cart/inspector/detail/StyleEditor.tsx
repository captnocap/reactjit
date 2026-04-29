import { Col, Row, Text, Pressable, Box } from '@reactjit/runtime/primitives';
import { InspectorNode } from '../types';
import { COLORS } from '../constants';
import { safeString, looksLikeColor } from '../utils';
import SectionHeader from '../components/SectionHeader';

function StyleRow({
  label,
  value,
  onEdit,
  onDelete,
}: {
  label: string;
  value: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const str = String(value);
  const isColor = looksLikeColor(value);

  const copy = () => {
    if ((globalThis as any).__copyToClipboard) {
      (globalThis as any).__copyToClipboard(str);
    } else {
      console.log('[copy]', str);
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
          <Text fontSize={10} color={COLORS.text} style={{ flexGrow: 1 }} numberOfLines={1}>
            {safeString(value, 120)}
          </Text>
        )}
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
      </Row>
    </Row>
  );
}

export default function StyleEditor({
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
  const entries = node.style
    ? Object.keys(node.style)
        .map((k) => ({ key: k, value: node.style![k] }))
        .sort((a, b) => a.key.localeCompare(b.key))
    : [];

  return (
    <Col style={{ gap: 6 }}>
      <SectionHeader
        title={`Style (${entries.length})`}
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
          <StyleRow
            key={key}
            label={key}
            value={value}
            onEdit={() => onEdit(key)}
            onDelete={() => onDelete(key)}
          />
        ))}
        {entries.length === 0 && (
          <Text fontSize={10} color={COLORS.textDim} style={{ padding: 8 }}>
            No inline styles
          </Text>
        )}
      </Col>
    </Col>
  );
}
