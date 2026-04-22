
import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { splitChord, type KeybindingSpec } from './useKeybindStore';

export function KeybindConflict(props: {
  selected?: KeybindingSpec | null;
  chord: string;
  conflicts: KeybindingSpec[];
  onJump: (id: string) => void;
}) {
  if (!props.selected || !props.conflicts.length || !props.chord) {
    return (
      <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
        <Text fontSize={10} color={COLORS.textDim}>No conflicts for the selected binding.</Text>
      </Box>
    );
  }

  return (
    <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep, gap: 8 }}>
      <Col style={{ gap: 2 }}>
        <Text fontSize={10} color={COLORS.red} style={{ letterSpacing: 0.7, fontWeight: 'bold' }}>CONFLICT WARNING</Text>
        <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.selected.label} shares {splitChord(props.chord).join('+')}</Text>
        <Text fontSize={10} color={COLORS.textDim}>Click a conflicting command to jump to it.</Text>
      </Col>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {props.conflicts.map((command) => (
          <Pressable
            key={command.id}
            onPress={() => props.onJump(command.id)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 5,
              paddingBottom: 5,
              borderRadius: TOKENS.radiusSm,
              borderWidth: 1,
              borderColor: COLORS.red,
              backgroundColor: COLORS.panelAlt,
            }}
          >
            <Text fontSize={9} color={COLORS.textBright} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{command.label}</Text>
          </Pressable>
        ))}
      </Row>
    </Box>
  );
}
