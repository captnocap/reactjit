import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { MaskChip } from './MaskChip';

export function ParamControl(props: { name: string; value: any; def: any; onChange: (next: any) => void }) {
  if (props.def.kind === 'bool') {
    return <MaskChip label={props.name + ': ' + (props.value ? 'on' : 'off')} active={!!props.value} onPress={() => props.onChange(!props.value)} />;
  }
  if (props.def.kind === 'enum') {
    const opts = props.def.options || [];
    const idx = Math.max(0, opts.indexOf(props.value));
    const next = opts[(idx + 1) % Math.max(1, opts.length)];
    return <MaskChip label={props.name + ': ' + String(props.value)} active={true} onPress={() => props.onChange(next)} />;
  }
  const step = props.def.step || 1;
  const min = props.def.min ?? -Infinity;
  const max = props.def.max ?? Infinity;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      <MaskChip label={props.name} active={true} />
      <Pressable onPress={() => props.onChange(clamp(Number(props.value) - step))}>
        <Box style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={10} color={COLORS.textDim}>−</Text>
        </Box>
      </Pressable>
      <Box style={{ paddingLeft: 7, paddingRight: 7, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Text fontSize={10} color={COLORS.textBright}>{String(props.value)}</Text>
      </Box>
      <Pressable onPress={() => props.onChange(clamp(Number(props.value) + step))}>
        <Box style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
          <Text fontSize={10} color={COLORS.textDim}>+</Text>
        </Box>
      </Pressable>
    </Row>
  );
}
