
import { Box, Col, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';
import { splitChord, type KeybindingSpec } from './useKeybindStore';

function BindingChip(props: { chord: string }) {
  const parts = splitChord(props.chord);
  if (!parts.length) {
    return <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>unbound</Text>;
  }
  return (
    <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {parts.map((part) => (
        <Box key={part} style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={8} color={COLORS.textDim} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{part}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function CommandRow(props: {
  command: KeybindingSpec;
  chord: string;
  selected?: boolean;
  conflict?: boolean;
  onPress: () => void;
}) {
  return (
    <HoverPressable
      onPress={props.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 10,
        borderRadius: TOKENS.radiusMd,
        borderWidth: 1,
        borderColor: props.selected ? COLORS.blue : props.conflict ? COLORS.red : COLORS.border,
        backgroundColor: props.selected ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Col style={{ flexGrow: 1, flexBasis: 0, gap: 2 }}>
        <Text fontSize={11} color={props.selected ? COLORS.blue : COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.command.label}</Text>
        <Text fontSize={9} color={COLORS.textDim}>{props.command.description}</Text>
        <Text fontSize={8} color={COLORS.textMuted} style={{ fontFamily: 'monospace' }}>{props.command.id}</Text>
      </Col>
      <BindingChip chord={props.chord} />
    </HoverPressable>
  );
}
