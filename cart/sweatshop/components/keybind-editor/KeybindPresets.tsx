
import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { KEYBINDING_PRESETS, type KeybindPresetName } from './useKeybindStore';

export function KeybindPresets(props: {
  activePreset: KeybindPresetName;
  onApplyPreset: (preset: Exclude<KeybindPresetName, 'custom'>) => void;
  onResetAll: () => void;
}) {
  const entries = (['default', 'vim', 'vscode', 'emacs'] as const).map((preset) => ({
    preset,
    title: KEYBINDING_PRESETS[preset].name,
    description: KEYBINDING_PRESETS[preset].description,
  }));

  return (
    <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
      <Col style={{ gap: 2 }}>
        <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.7, fontWeight: 'bold' }}>PRESETS</Text>
        <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Load a scheme</Text>
        <Text fontSize={10} color={COLORS.textDim}>Preset changes are saved automatically.</Text>
      </Col>
      <Col style={{ gap: 8 }}>
        {entries.map((entry) => (
          <Pressable
            key={entry.preset}
            onPress={() => props.onApplyPreset(entry.preset)}
            style={{
              padding: 10,
              borderRadius: TOKENS.radiusSm,
              borderWidth: 1,
              borderColor: props.activePreset === entry.preset ? COLORS.blue : COLORS.border,
              backgroundColor: props.activePreset === entry.preset ? COLORS.blueDeep : COLORS.panelAlt,
              gap: 2,
            }}
          >
            <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text fontSize={11} color={props.activePreset === entry.preset ? COLORS.blue : COLORS.textBright} style={{ fontWeight: 'bold' }}>{entry.title}</Text>
              {props.activePreset === entry.preset ? <Text fontSize={9} color={COLORS.blue} style={{ fontFamily: 'monospace' }}>active</Text> : null}
            </Row>
            <Text fontSize={9} color={COLORS.textDim}>{entry.description}</Text>
          </Pressable>
        ))}
      </Col>
      <Pressable
        onPress={props.onResetAll}
        style={{
          padding: 10,
          borderRadius: TOKENS.radiusSm,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.panelAlt,
        }}
      >
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Reset to default</Text>
      </Pressable>
    </Box>
  );
}
