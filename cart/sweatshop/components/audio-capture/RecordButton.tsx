import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';

export function RecordButton(props: {
  recording: boolean;
  available: boolean;
  onStart: () => void;
  onStop: () => void;
  onSave?: () => void;
}) {
  const { recording, available, onStart, onStop, onSave } = props;

  return (
    <Row style={{ gap: 8, alignItems: 'center' }}>
      <HoverPressable
        onPress={recording ? onStop : onStart}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 7,
          paddingBottom: 7,
          borderRadius: TOKENS.radiusSm,
          backgroundColor: recording ? COLORS.redDeep : COLORS.greenDeep,
          borderWidth: 1,
          borderColor: recording ? COLORS.red : COLORS.green,
          opacity: available ? 1 : 0.4,
        }}
      >
        <Box style={{ width: 10, height: 10, borderRadius: recording ? 2 : 5, backgroundColor: recording ? COLORS.red : COLORS.green }} />
        <Text fontSize={10} color={recording ? COLORS.red : COLORS.green} style={{ fontWeight: 'bold' }}>
          {recording ? 'Stop' : 'Capture'}
        </Text>
      </HoverPressable>

      {onSave && recording && (
        <HoverPressable
          onPress={onSave}
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: TOKENS.radiusSm,
            backgroundColor: COLORS.panelAlt,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text fontSize={10} color={COLORS.text}>Save</Text>
        </HoverPressable>
      )}
    </Row>
  );
}
