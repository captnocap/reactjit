import { Box, Row, Text, TextInput, Pressable } from '../../../runtime/primitives';
import { InspectorNode } from '../types';
import { COLORS } from '../constants';
import { parseTypedInput } from '../utils';
import { sendUpdate } from '../bridge';

export default function EditModal({
  edit,
  selected,
  draft,
  onDraftChange,
  onClose,
  onApply,
}: {
  edit: { nodeId: number; section: 'props' | 'style'; key: string } | null;
  selected: InspectorNode | null;
  draft: string;
  onDraftChange: (v: string) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  if (!edit || !selected || edit.nodeId !== selected.id) return null;

  const isNew = edit.key === '';

  const numericValue = (() => {
    const v = parseTypedInput(draft);
    return typeof v === 'number' ? v : null;
  })();

  const nudge = (delta: number) => {
    if (numericValue == null) return;
    onDraftChange(String(numericValue + delta));
  };

  const handleSubmit = () => {
    if (isNew) {
      const text = String(draft || '').trim();
      const parts = text.split('=');
      if (parts.length >= 2) {
        const k = parts[0].trim();
        const v = parseTypedInput(parts.slice(1).join('=').trim());
        if (k && selected) {
          if (edit.section === 'style') {
            sendUpdate(selected.id, { style: { ...(selected.style || {}), [k]: v } });
          } else {
            sendUpdate(selected.id, { [k]: v });
          }
        }
      }
    } else {
      const v = parseTypedInput(draft);
      if (edit.section === 'style') {
        sendUpdate(selected.id, { style: { ...(selected.style || {}), [edit.key]: v } });
      } else {
        sendUpdate(selected.id, { [edit.key]: v });
      }
    }
    onApply();
  };

  const handleDelete = () => {
    if (!edit.key) return;
    if (edit.section === 'style') {
      sendUpdate(selected.id, {}, { removeStyleKeys: [edit.key] });
    } else if (edit.key !== 'id' && edit.key !== 'children' && edit.key !== 'type') {
      sendUpdate(selected.id, {}, { removeKeys: [edit.key] });
    }
    onClose();
  };

  return (
    <Box
      style={{
        backgroundColor: COLORS.bgElevated,
        borderRadius: 8,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        marginTop: 8,
      }}
    >
      <Text fontSize={10} color={COLORS.accentLight} style={{ fontWeight: 'bold' }}>
        {isNew ? `New ${edit.section}` : `Editing ${edit.section}: ${edit.key}`}
      </Text>
      <Row style={{ gap: 6, alignItems: 'center' }}>
        <TextInput
          value={draft}
          placeholder={isNew ? 'key = value' : 'json / number / true / false / text'}
          style={{
            flexGrow: 1,
            height: 32,
            backgroundColor: COLORS.bg,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: COLORS.borderFocus,
            paddingLeft: 10,
            paddingRight: 10,
            fontSize: 11,
          }}
          onSubmit={handleSubmit}
          onChangeText={onDraftChange}
        />
        {numericValue != null && (
          <Row style={{ gap: 4 }}>
            <Pressable
              onPress={() => nudge(-1)}
              style={{
                backgroundColor: COLORS.bgHover,
                borderRadius: 4,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              <Text fontSize={10} color={COLORS.textDim}>−</Text>
            </Pressable>
            <Pressable
              onPress={() => nudge(1)}
              style={{
                backgroundColor: COLORS.bgHover,
                borderRadius: 4,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              <Text fontSize={10} color={COLORS.textDim}>+</Text>
            </Pressable>
          </Row>
        )}
      </Row>
      <Row style={{ gap: 6 }}>
        <Pressable
          onPress={handleSubmit}
          style={{
            backgroundColor: COLORS.accent,
            borderRadius: 6,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 5,
            paddingBottom: 5,
          }}
        >
          <Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Apply</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={{
            backgroundColor: COLORS.bgHover,
            borderRadius: 6,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 5,
            paddingBottom: 5,
          }}
        >
          <Text fontSize={9} color={COLORS.textDim}>Cancel</Text>
        </Pressable>
        {!isNew ? (
          <Pressable
            onPress={handleDelete}
            style={{
              backgroundColor: '#5a1d1d',
              borderRadius: 6,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 4,
              paddingBottom: 4,
            }}
          >
            <Text fontSize={9} color={COLORS.red}>Delete</Text>
          </Pressable>
        ) : null}
      </Row>
    </Box>
  );
}
