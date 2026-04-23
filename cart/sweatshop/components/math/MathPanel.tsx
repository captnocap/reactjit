
import { Box, Col, Pressable, Row, Text, TextArea, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS, useTheme } from '../../theme';
import { LaTeX } from './LaTeX';

const DEFAULT_SOURCE = String.raw`e^{i\pi} + 1 = 0`;

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: value ? COLORS.blue : COLORS.border, backgroundColor: value ? COLORS.blueDeep : COLORS.panelAlt }}>
      <Text fontSize={10} color={value ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChange, width = 120, id }: { label: string; value: string; onChange: (value: string) => void; width?: number; id?: string }) {
  return (
    <Col style={{ gap: 4 }}>
      <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>{label}</Text>
      <TextInput
        data-id={id}
        value={value}
        onChangeText={onChange}
        style={{ width, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 10, paddingRight: 10, backgroundColor: COLORS.panelBg, color: COLORS.textBright }}
      />
    </Col>
  );
}

export function MathPanel(props: { title?: string; widthBand?: string; onClose?: () => void }) {
  useTheme();
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [inline, setInline] = useState(false);
  const [numbered, setNumbered] = useState(true);
  const [fontSize, setFontSize] = useState('22');
  const [color, setColor] = useState(COLORS.textBright);
  const [equationNumber, setEquationNumber] = useState('1');

  const parsedFontSize = Math.max(10, Math.min(42, Number(fontSize) || 22));
  const previewColor = color.trim() || COLORS.textBright;

  return (
    <Col data-id="math-panel-root" style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Col style={{ gap: 2 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title || 'Math'}</Text>
          <Text fontSize={10} color={COLORS.textDim}>Live LaTeX editor and renderer</Text>
        </Col>
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Pressable data-id="math-toggle-inline" onPress={() => setInline((v) => !v)} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: inline ? COLORS.blue : COLORS.border, backgroundColor: inline ? COLORS.blueDeep : COLORS.panelAlt }}>
            <Text fontSize={10} color={inline ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>{inline ? 'Inline' : 'Block'}</Text>
          </Pressable>
          <Pressable data-id="math-toggle-numbered" onPress={() => setNumbered((v) => !v)} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: numbered ? COLORS.blue : COLORS.border, backgroundColor: numbered ? COLORS.blueDeep : COLORS.panelAlt }}>
            <Text fontSize={10} color={numbered ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>{numbered ? 'Numbered' : 'Plain'}</Text>
          </Pressable>
          <Field id="math-font-size" label="Font" value={fontSize} onChange={setFontSize} width={72} />
          <Field id="math-color" label="Color" value={color} onChange={setColor} width={108} />
          <Field id="math-equation-number" label="#" value={equationNumber} onChange={setEquationNumber} width={56} />
          {props.onClose ? (
            <Pressable onPress={props.onClose} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
            </Pressable>
          ) : null}
        </Row>
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ flexGrow: 0.45, flexBasis: 0, minHeight: 0, minWidth: 0, borderRightWidth: 1, borderColor: COLORS.borderSoft }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Source</Text>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 10 }}>
            <TextArea
              data-id="math-source"
              value={source}
              onChange={setSource}
              fontSize={11}
              color={COLORS.textBright}
              style={{ width: '100%', height: '100%', minHeight: 240, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}
            />
          </Box>
        </Col>

        <Col style={{ flexGrow: 0.55, flexBasis: 0, minHeight: 0 }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Preview</Text>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 14 }}>
            <Box data-id="math-preview" style={{ padding: 16, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
              <LaTeX
                source={source}
                inline={inline}
                numbered={numbered}
                equationNumber={equationNumber}
                fontSize={parsedFontSize}
                color={previewColor}
              />
            </Box>
            <Box data-id="math-settings" style={{ marginTop: 12, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Live settings</Text>
              <Text fontSize={10} color={COLORS.textMuted} style={{ marginTop: 4 }}>
                {inline ? 'Inline mode keeps the expression within surrounding text.' : 'Block mode centers the expression in its own row.'}
              </Text>
            </Box>
          </Box>
        </Col>
      </Row>
    </Col>
  );
}

export default MathPanel;
