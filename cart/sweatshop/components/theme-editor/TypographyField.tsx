
import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

const FONT_CHOICES: Array<{ label: string; value: string }> = [
  { label: 'System', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Inter',  value: 'Inter, system-ui, -apple-system, sans-serif' },
  { label: 'Mono',   value: 'JetBrains Mono, Menlo, Consolas, monospace' },
  { label: 'Serif',  value: 'Georgia, Cambria, serif' },
];

function FontPick(props: { value: string; onChange: (v: string) => void }) {
  return (
    <Row style={{ gap: 4, flexWrap: 'wrap' }}>
      {FONT_CHOICES.map((f) => {
        const active = props.value === f.value;
        return (
          <Pressable key={f.label} onPress={() => props.onChange(f.value)}>
            <Box style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
              borderRadius: TOKENS.radiusXs,
              borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
            }}>
              <Text fontSize={10} color={active ? COLORS.blue : COLORS.text} style={{ fontFamily: f.value }}>{f.label}</Text>
            </Box>
          </Pressable>
        );
      })}
    </Row>
  );
}

function NumberField(props: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const bump = (delta: number) => {
    const next = Math.max(props.min, Math.min(props.max, Math.round(props.value + delta)));
    if (next !== props.value) props.onChange(next);
  };
  return (
    <Col style={{ gap: 3 }}>
      <Text fontSize={9} color={COLORS.textDim}>{props.label}</Text>
      <Row style={{ alignItems: 'center', gap: 4 }}>
        <Pressable onPress={() => bump(-1)}>
          <Box style={{ width: 22, height: 22, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Text fontSize={11} color={COLORS.text}>−</Text>
          </Box>
        </Pressable>
        <TextInput
          value={String(props.value)}
          onChangeText={(v: string) => { const n = Number(v); if (Number.isFinite(n)) props.onChange(Math.max(props.min, Math.min(props.max, Math.round(n)))); }}
          style={{
            width: 52, height: 22,
            paddingLeft: 6, paddingRight: 6,
            borderWidth: 1, borderColor: COLORS.border,
            borderRadius: TOKENS.radiusXs,
            backgroundColor: COLORS.panelBg,
            fontFamily: TOKENS.fontMono, fontSize: 10,
          }}
        />
        <Pressable onPress={() => bump(1)}>
          <Box style={{ width: 22, height: 22, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Text fontSize={11} color={COLORS.text}>+</Text>
          </Box>
        </Pressable>
      </Row>
    </Col>
  );
}

export function TypographyField(props: {
  fontUI: string; fontMono: string;
  fontXs: number; fontSm: number; fontMd: number; fontLg: number; fontXl: number;
  onChange: (patch: any) => void;
}) {
  return (
    <Col style={{ gap: 8 }}>
      <Col style={{ gap: 4 }}>
        <Text fontSize={10} color={COLORS.textDim}>UI font</Text>
        <FontPick value={props.fontUI} onChange={(v) => props.onChange({ fontUI: v })} />
      </Col>
      <Col style={{ gap: 4 }}>
        <Text fontSize={10} color={COLORS.textDim}>Mono font</Text>
        <FontPick value={props.fontMono} onChange={(v) => props.onChange({ fontMono: v })} />
      </Col>
      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        <NumberField label="xs" value={props.fontXs} min={8}  max={18} onChange={(n) => props.onChange({ fontXs: n, typeXs: n })} />
        <NumberField label="sm" value={props.fontSm} min={9}  max={20} onChange={(n) => props.onChange({ fontSm: n, typeSm: n })} />
        <NumberField label="md" value={props.fontMd} min={10} max={22} onChange={(n) => props.onChange({ fontMd: n, typeBase: n })} />
        <NumberField label="lg" value={props.fontLg} min={11} max={26} onChange={(n) => props.onChange({ fontLg: n, typeLg: n })} />
        <NumberField label="xl" value={props.fontXl} min={12} max={32} onChange={(n) => props.onChange({ fontXl: n, typeXl: n })} />
      </Row>
    </Col>
  );
}
