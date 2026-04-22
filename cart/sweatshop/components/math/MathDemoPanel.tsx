const React: any = require('react');
const { useMemo, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextArea, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS, useTheme } from '../../theme';
import { LaTeX } from './LaTeX';
import { LaTeXBlock } from './LaTeXBlock';
import { LaTeXInline } from './LaTeXInline';

const PRESETS = [
  { label: 'Euler', source: 'e^{i\\pi} + 1 = 0' },
  { label: 'Quadratic', source: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { label: 'Integral', source: '\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}' },
  { label: 'Matrix', source: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: 'Chemistry', source: '\\ce{H2SO4 + 2NaOH -> Na2SO4 + 2H2O}' },
  { label: 'Equilibrium', source: '\\ce{N2 + 3H2 <=> 2NH3}' },
];

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: value ? COLORS.blue : COLORS.border, backgroundColor: value ? COLORS.blueDeep : COLORS.panelAlt }}>
      <Text fontSize={10} color={value ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>{label}</Text>
    </Pressable>
  );
}

function ChipButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
      <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChange, width = 120 }: { label: string; value: string; onChange: (value: string) => void; width?: number }) {
  return (
    <Col style={{ gap: 4 }}>
      <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={{ width, height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm, paddingLeft: 10, paddingRight: 10, backgroundColor: COLORS.panelBg, color: COLORS.textBright }}
      />
    </Col>
  );
}

export function MathDemoPanel(props: { title?: string; widthBand?: string; onClose?: () => void }) {
  useTheme();
  const [source, setSource] = useState(PRESETS[0].source);
  const [inline, setInline] = useState(false);
  const [numbered, setNumbered] = useState(true);
  const [fontSize, setFontSize] = useState('22');
  const [color, setColor] = useState(COLORS.textBright);
  const [equationNumber, setEquationNumber] = useState('1');

  const parsedFontSize = Math.max(10, Math.min(42, Number(fontSize) || 22));
  const gallery = useMemo(() => PRESETS.map((item) => ({
    ...item,
    block: item.label !== 'Euler',
  })), []);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Col style={{ gap: 2 }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title || 'Math Demo'}</Text>
          <Text fontSize={10} color={COLORS.textDim}>LaTeX parser + renderer built from primitives</Text>
        </Col>
        <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Toggle label={inline ? 'Inline' : 'Block'} value={inline} onToggle={() => setInline((v) => !v)} />
          <Toggle label={numbered ? 'Numbered' : 'Unnumbered'} value={numbered} onToggle={() => setNumbered((v) => !v)} />
          <Field label="Font" value={fontSize} onChange={setFontSize} width={72} />
          <Field label="Color" value={color} onChange={setColor} width={108} />
          <Field label="#" value={equationNumber} onChange={setEquationNumber} width={56} />
          {props.onClose ? (
            <Pressable onPress={props.onClose} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Close</Text>
            </Pressable>
          ) : null}
        </Row>
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ flexGrow: 0.42, flexBasis: 0, minHeight: 0, minWidth: 0, borderRightWidth: 1, borderColor: COLORS.borderSoft }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Source</Text>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 10 }}>
            <TextArea
              value={source}
              onChange={setSource}
              fontSize={11}
              color={COLORS.textBright}
              style={{ width: '100%', height: '100%', minHeight: 240, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}
            />
          </Box>
          <Box style={{ padding: 10, borderTopWidth: 1, borderColor: COLORS.borderSoft, gap: 8 }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Presets</Text>
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              {PRESETS.map((preset) => (
                <ChipButton key={preset.label} label={preset.label} onPress={() => setSource(preset.source)} />
              ))}
            </Row>
          </Box>
        </Col>

        <Col style={{ flexGrow: 0.58, flexBasis: 0, minHeight: 0 }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Preview</Text>
          </Box>
          <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 14 }}>
            <Col style={{ gap: 14 }}>
              <Box style={{ padding: 16, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
                <LaTeX
                  source={source}
                  inline={inline}
                  numbered={numbered}
                  equationNumber={equationNumber}
                  fontSize={parsedFontSize}
                  color={color}
                />
              </Box>

              <Box style={{ padding: 16, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 8 }}>
                <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Inline fragments</Text>
                <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Text fontSize={11} color={COLORS.text}>Energy:</Text>
                  <LaTeXInline source="E = mc^2" fontSize={16} color={COLORS.textBright} />
                  <Text fontSize={11} color={COLORS.text}>and</Text>
                  <LaTeXInline source="\\frac{a}{b}" fontSize={16} color={COLORS.blue} />
                </Row>
              </Box>

              <Box style={{ padding: 16, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 10 }}>
                <Text fontSize={10} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>Gallery</Text>
                {gallery.map((item) => (
                  <Box key={item.label} style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg, gap: 8 }}>
                    <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>{item.label}</Text>
                    {item.block ? (
                      <LaTeXBlock source={item.source} fontSize={14} color={COLORS.textBright} numbered={item.label === 'Integral'} equationNumber={2} />
                    ) : (
                      <LaTeXInline source={item.source} fontSize={14} color={COLORS.textBright} />
                    )}
                  </Box>
                ))}
              </Box>
            </Col>
          </ScrollView>
        </Col>
      </Row>
    </Col>
  );
}

export default MathDemoPanel;
