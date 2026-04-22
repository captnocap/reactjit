
import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { ColorSwatchGrid } from './ColorSwatchGrid';

function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

// label + live swatch + hex input + preset grid + reset. No HTML <input
// type="color"> — only Pressable swatches and a TextInput for the hex.
export function ColorField(props: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onReset?: () => void;
}) {
  const [local, setLocal] = useState(props.value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLocal(props.value);
  }, [props.value]);

  const commitHex = (raw: string) => {
    const trimmed = raw.trim();
    const candidate = trimmed.startsWith('#') ? trimmed : '#' + trimmed;
    if (isHex(candidate)) props.onChange(candidate.toLowerCase());
  };

  return (
    <Col style={{ gap: 4 }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => setOpen(!open)}>
          <Box style={{
            width: 20, height: 20,
            borderRadius: TOKENS.radiusXs,
            backgroundColor: isHex(local) ? local : '#000',
            borderWidth: 1,
            borderColor: COLORS.border,
          }} />
        </Pressable>
        <Col style={{ flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={10} color={COLORS.textDim}>{props.label}</Text>
        </Col>
        <TextInput
          value={local}
          onChangeText={(v: string) => { setLocal(v); commitHex(v); }}
          style={{
            width: 88, height: 22,
            paddingLeft: 6, paddingRight: 6,
            borderWidth: 1, borderColor: COLORS.border,
            borderRadius: TOKENS.radiusXs,
            backgroundColor: COLORS.panelBg,
            fontFamily: TOKENS.fontMono,
            fontSize: 10,
          }}
        />
        {props.onReset ? (
          <Pressable onPress={props.onReset}>
            <Box style={{
              paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
              borderRadius: TOKENS.radiusXs,
              borderWidth: 1, borderColor: COLORS.border,
              backgroundColor: COLORS.panelAlt,
            }}>
              <Text fontSize={9} color={COLORS.textDim}>reset</Text>
            </Box>
          </Pressable>
        ) : null}
      </Row>
      {open ? (
        <Box style={{
          padding: 6,
          borderWidth: 1, borderColor: COLORS.border,
          borderRadius: TOKENS.radiusSm,
          backgroundColor: COLORS.panelBg,
        }}>
          <ColorSwatchGrid value={local} onPick={(hex) => { setLocal(hex); props.onChange(hex); }} />
        </Box>
      ) : null}
    </Col>
  );
}
