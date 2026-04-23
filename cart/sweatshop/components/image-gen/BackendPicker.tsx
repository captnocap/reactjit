const React: any = require('react');

import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export type ImageGenBackend = 'gradio' | 'a1111' | 'nano-local';

const BACKENDS: { id: ImageGenBackend; label: string }[] = [
  { id: 'gradio', label: 'Gradio' },
  { id: 'a1111', label: 'A1111' },
  { id: 'nano-local', label: 'nano (local)' },
];

export function BackendPicker(props: { value: ImageGenBackend; onChange: (backend: ImageGenBackend) => void }) {
  return (
    <Row style={{ gap: TOKENS.spaceSm, flexWrap: 'wrap' }}>
      {BACKENDS.map((b) => {
        const active = props.value === b.id;
        return (
          <Pressable key={b.id} onPress={() => props.onChange(b.id)}>
            <Box style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: TOKENS.radiusPill,
              borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
            }}>
              <Text fontSize={10} color={active ? COLORS.blue : COLORS.textDim}>{b.label}</Text>
            </Box>
          </Pressable>
        );
      })}
    </Row>
  );
}
