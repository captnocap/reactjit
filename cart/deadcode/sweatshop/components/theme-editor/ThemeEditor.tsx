
import { Box, Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS, useTheme, applyTheme } from '../../theme';
import { THEMES, type ThemePalette, type ThemeTokens } from '../../themes';
import { useThemeDraft } from './useThemeDraft';
import { ColorField } from './ColorField';
import { TypographyField } from './TypographyField';
import { ThemePreview } from './ThemePreview';
import { ThemePresets } from './ThemePresets';

type TabId = 'colors' | 'typography' | 'spacing' | 'shadows';

const COLOR_KEYS: Array<keyof ThemePalette> = [
  'appBg', 'panelBg', 'panelRaised', 'panelAlt', 'panelHover',
  'border', 'borderSoft', 'text', 'textBright', 'textDim', 'textMuted',
  'blue', 'green', 'yellow', 'orange', 'red', 'purple',
];

function Tab(props: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress}>
      <Box style={{
        paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
        borderRadius: TOKENS.radiusSm,
        borderWidth: 1, borderColor: props.active ? COLORS.blue : COLORS.border,
        backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt,
      }}>
        <Text fontSize={10} color={props.active ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>{props.label}</Text>
      </Box>
    </Pressable>
  );
}

function NumberRow(props: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const bump = (d: number) => { const n = Math.max(props.min, Math.min(props.max, Math.round(props.value + d))); if (n !== props.value) props.onChange(n); };
  return (
    <Row style={{ alignItems: 'center', gap: 8 }}>
      <Text fontSize={10} color={COLORS.textDim} style={{ width: 120 }}>{props.label}</Text>
      <Pressable onPress={() => bump(-1)}><Box style={{ width: 20, height: 20, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, alignItems: 'center', justifyContent: 'center' }}><Text fontSize={10} color={COLORS.text}>−</Text></Box></Pressable>
      <Text fontSize={10} color={COLORS.textBright} style={{ width: 32, textAlign: 'center', fontFamily: TOKENS.fontMono }}>{String(props.value)}</Text>
      <Pressable onPress={() => bump(1)}><Box style={{ width: 20, height: 20, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, alignItems: 'center', justifyContent: 'center' }}><Text fontSize={10} color={COLORS.text}>+</Text></Box></Pressable>
    </Row>
  );
}

export function ThemeEditor() {
  useTheme();
  const [tab, setTab] = useState<TabId>('colors');
  const d = useThemeDraft();
  const palette: ThemePalette = { ...THEMES[d.draft.base || 'soft'].palette, ...(d.draft.palette || {}) };
  const tokens: ThemeTokens = { ...THEMES[d.draft.base || 'soft'].tokens, ...(d.draft.tokens || {}) };

  return (
    <Col style={{ gap: 10 }}>
      <Row style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text fontSize={10} color={COLORS.textDim}>Base:</Text>
        {['soft', 'sharp', 'studio', 'high-contrast'].map((base) => (
          <Pressable key={base} onPress={() => d.setBase(base)}>
            <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: (d.draft.base || 'soft') === base ? COLORS.blue : COLORS.border, backgroundColor: (d.draft.base || 'soft') === base ? COLORS.blueDeep : COLORS.panelAlt }}>
              <Text fontSize={9} color={(d.draft.base || 'soft') === base ? COLORS.blue : COLORS.text}>{base}</Text>
            </Box>
          </Pressable>
        ))}
        <Box style={{ flexGrow: 1, flexBasis: 0 }} />
        <Pressable onPress={d.revert}><Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}><Text fontSize={9} color={COLORS.textDim}>revert</Text></Box></Pressable>
        <Pressable onPress={() => { d.save(); applyTheme('custom'); }}><Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.green, backgroundColor: COLORS.greenDeep }}><Text fontSize={9} color={COLORS.green} style={{ fontWeight: 'bold' }}>save + apply</Text></Box></Pressable>
      </Row>

      <Row style={{ gap: 6 }}>
        {(['colors','typography','spacing','shadows'] as TabId[]).map((t) => (
          <Tab key={t} label={t[0].toUpperCase() + t.slice(1)} active={tab === t} onPress={() => setTab(t)} />
        ))}
      </Row>

      <Row style={{ gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Col style={{ flexGrow: 1, flexBasis: 280, minWidth: 280, gap: 8 }}>
          {tab === 'colors' ? (
            <ScrollView showScrollbar={true} style={{ maxHeight: 420, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
              <Col style={{ padding: 8, gap: 6 }}>
                {COLOR_KEYS.map((k) => (
                  <ColorField
                    key={String(k)}
                    label={String(k)}
                    value={palette[k]}
                    onChange={(hex) => d.setColor(k, hex)}
                    onReset={d.draft.palette && d.draft.palette[k] ? () => d.resetKey('palette', String(k)) : undefined}
                  />
                ))}
              </Col>
            </ScrollView>
          ) : null}

          {tab === 'typography' ? (
            <TypographyField
              fontUI={tokens.fontUI} fontMono={tokens.fontMono}
              fontXs={tokens.fontXs} fontSm={tokens.fontSm} fontMd={tokens.fontMd} fontLg={tokens.fontLg} fontXl={tokens.fontXl}
              onChange={(patch: any) => { for (const k of Object.keys(patch)) d.setToken(k as keyof ThemeTokens, patch[k]); }}
            />
          ) : null}

          {tab === 'spacing' ? (
            <Col style={{ gap: 6 }}>
              <NumberRow label="radius none"  value={tokens.radiusNone}  min={0} max={32} onChange={(n) => d.setToken('radiusNone',  n)} />
              <NumberRow label="radius xs"    value={tokens.radiusXs}    min={0} max={32} onChange={(n) => d.setToken('radiusXs',    n)} />
              <NumberRow label="radius sm"    value={tokens.radiusSm}    min={0} max={32} onChange={(n) => d.setToken('radiusSm',    n)} />
              <NumberRow label="radius md"    value={tokens.radiusMd}    min={0} max={32} onChange={(n) => d.setToken('radiusMd',    n)} />
              <NumberRow label="radius lg"    value={tokens.radiusLg}    min={0} max={32} onChange={(n) => d.setToken('radiusLg',    n)} />
              <NumberRow label="pad tight"    value={tokens.padTight}    min={0} max={32} onChange={(n) => d.setToken('padTight',    n)} />
              <NumberRow label="pad normal"   value={tokens.padNormal}   min={0} max={48} onChange={(n) => d.setToken('padNormal',   n)} />
              <NumberRow label="pad loose"    value={tokens.padLoose}    min={0} max={64} onChange={(n) => d.setToken('padLoose',    n)} />
              <NumberRow label="row height"   value={tokens.rowHeight}   min={14} max={48} onChange={(n) => d.setToken('rowHeight',  n)} />
            </Col>
          ) : null}

          {tab === 'shadows' ? (
            <Col style={{ gap: 6 }}>
              <NumberRow label="border width"  value={tokens.borderW}     min={0} max={4} onChange={(n) => d.setToken('borderW',     n)} />
              <NumberRow label="shadow depth"  value={tokens.shadowDepth} min={0} max={4} onChange={(n) => d.setToken('shadowDepth', n)} />
            </Col>
          ) : null}
        </Col>

        <Col style={{ width: 260, gap: 10 }}>
          <ThemePreview />
          <ThemePresets currentDraft={d.draft} />
        </Col>
      </Row>
    </Col>
  );
}
