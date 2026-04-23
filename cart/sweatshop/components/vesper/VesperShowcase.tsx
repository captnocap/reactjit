import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { useTheme } from '../../theme';
import { applyVesperTheme, isVesperThemeActive } from '../../lib/vesper';
import { VESPER_PALETTE, VESPER_TOKENS, type VesperTone } from '../../lib/vesper';
import { VesperBadge } from './VesperBadge';
import { VesperButton } from './VesperButton';
import { VesperCard } from './VesperCard';
import { VesperChip } from './VesperChip';
import { VesperDrawer } from './VesperDrawer';
import { VesperSurface } from './VesperSurface';

type State = {
  title: string;
  subtitle: string;
  buttonLabel: string;
  badgeLabel: string;
  chipLabel: string;
  tone: VesperTone;
  selected: boolean;
  drawerOpen: boolean;
  drawerSide: 'right' | 'left' | 'bottom';
  elevated: boolean;
  inset: boolean;
};

function option(label: string, active: boolean, onPress: () => void) {
  return <Pressable onPress={onPress} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: VESPER_TOKENS.radiusPill, borderWidth: 1, borderColor: active ? VESPER_PALETTE.purple : VESPER_PALETTE.borderSoft, backgroundColor: active ? VESPER_PALETTE.purpleDeep : VESPER_PALETTE.panelAlt }}><Text fontSize={VESPER_TOKENS.typeXs} color={active ? VESPER_PALETTE.purple : VESPER_PALETTE.textDim} style={{ fontWeight: 'bold' }}>{label}</Text></Pressable>;
}

function Section(props: { title: string; description: string; children: any }) {
  return <VesperCard title={props.title} subtitle={props.description} tone="accent">{props.children}</VesperCard>;
}

export function VesperShowcase() {
  const theme = useTheme();
  const colors = theme.name === 'vesper' ? theme.colors : VESPER_PALETTE;
  const tokens = theme.name === 'vesper' ? theme.tokens : VESPER_TOKENS;
  const [state, setState] = useState<State>({
    title: 'Vesper Card',
    subtitle: 'Phosphor-terminal surface',
    buttonLabel: 'Launch',
    badgeLabel: 'Healthy',
    chipLabel: 'Selected',
    tone: 'accent',
    selected: true,
    drawerOpen: true,
    drawerSide: 'right',
    elevated: true,
    inset: false,
  });
  const vesperActive = isVesperThemeActive();

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: colors.appBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.panelRaised }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={colors.textBright} style={{ fontWeight: 'bold' }}>Vesper</Text>
          <Text fontSize={9} color={colors.textDim}>tokens, theme bridge, cards, buttons, surfaces, badges, chips, drawer</Text>
        </Col>
        <Pressable onPress={() => applyVesperTheme()} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: tokens.radiusPill, borderWidth: 1, borderColor: vesperActive ? colors.purple : colors.borderSoft, backgroundColor: vesperActive ? colors.purpleDeep : colors.panelAlt }}>
          <Text fontSize={10} color={vesperActive ? colors.purple : colors.textDim} style={{ fontWeight: 'bold' }}>{vesperActive ? 'vesper theme on' : 'apply vesper theme'}</Text>
        </Pressable>
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 12, padding: 12 }}>
        <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          <Col style={{ gap: 12, paddingRight: 4 }}>
            <Section title="Surface" description="base canvas, inset shell, elevated glass">
              <Col style={{ gap: 8 }}>
                <VesperSurface elevated={state.elevated} inset={state.inset} tone={state.tone} style={{ minHeight: 110 }}>
                  <Text fontSize={tokens.typeSm} color={colors.textBright} style={{ fontWeight: 'bold' }}>{state.title}</Text>
                  <Text fontSize={tokens.typeSm} color={colors.textDim}>{state.subtitle}</Text>
                  <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                    <VesperBadge label={state.badgeLabel} tone={state.tone} dot={true} />
                    <VesperChip label={state.chipLabel} tone={state.tone} selected={state.selected} />
                  </Row>
                </VesperSurface>
                <VesperSurface inset={true}>
                  <Text fontSize={tokens.typeXs} color={colors.textDim}>Inset surface for nested UI, panels, and inspectors.</Text>
                </VesperSurface>
              </Col>
            </Section>

            <Section title="Card" description="card shell with heading, tone, and footer">
              <VesperCard title={state.title} subtitle={state.subtitle} tone={state.tone} selected={state.selected} footer={<Text fontSize={tokens.typeXs} color={colors.textDim}>footer slot</Text>}>
                <Text fontSize={tokens.typeSm} color={colors.text}>Real card content, stacked with rhythm and quiet borders.</Text>
              </VesperCard>
            </Section>

            <Section title="Buttons" description="solid, soft, and ghost button states">
              <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                <VesperButton label={state.buttonLabel} tone={state.tone} variant="solid" onPress={() => {}} />
                <VesperButton label="Soft action" tone={state.tone} variant="soft" onPress={() => {}} />
                <VesperButton label="Ghost action" tone={state.tone} variant="ghost" onPress={() => {}} />
                <VesperButton label="Disabled" tone={state.tone} variant="solid" disabled={true} />
              </Row>
            </Section>

            <Section title="Badge + Chip" description="status tags and selectable pills">
              <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                <VesperBadge label={state.badgeLabel} tone={state.tone} dot={true} />
                <VesperBadge label="Muted" tone="muted" subtle={true} />
                <VesperChip label={state.chipLabel} tone={state.tone} selected={state.selected} />
                <VesperChip label="Unselected" tone="muted" />
              </Row>
            </Section>

            <Section title="Drawer" description="overlay shell with side, title, and close affordance">
              <VesperSurface style={{ minHeight: 180, position: 'relative', overflow: 'hidden' }}>
                <Text fontSize={tokens.typeXs} color={colors.textDim}>The drawer is mounted in-place for previewing state.</Text>
                <VesperDrawer open={state.drawerOpen} side={state.drawerSide} title={state.title} subtitle={state.subtitle} tone={state.tone} onClose={() => setState((prev) => ({ ...prev, drawerOpen: false }))}>
                  <Text fontSize={tokens.typeSm} color={colors.textBright} style={{ fontWeight: 'bold' }}>Drawer contents</Text>
                  <Text fontSize={tokens.typeXs} color={colors.textDim}>This is the same component carts can mount for inspectors, pickers, or quick actions.</Text>
                </VesperDrawer>
              </VesperSurface>
            </Section>
          </Col>
        </ScrollView>

        <ScrollView showScrollbar={true} style={{ width: 340, flexShrink: 0, minHeight: 0 }}>
          <Col style={{ gap: 12, paddingLeft: 2, paddingBottom: 4 }}>
            <VesperCard title="Live props" subtitle="adjust variants on the right">
              <Col style={{ gap: 8 }}>
                <Field label="Card title">
                  <TextInput value={state.title} onChangeText={setTitle(setState)} placeholder="Title" fontSize={11} style={inputStyle(colors)} />
                </Field>
                <Field label="Subtitle">
                  <TextInput value={state.subtitle} onChangeText={setSubtitle(setState)} placeholder="Subtitle" fontSize={11} style={inputStyle(colors)} />
                </Field>
                <Field label="Button label">
                  <TextInput value={state.buttonLabel} onChangeText={setButtonLabel(setState)} placeholder="Launch" fontSize={11} style={inputStyle(colors)} />
                </Field>
                <Field label="Badge label">
                  <TextInput value={state.badgeLabel} onChangeText={setBadgeLabel(setState)} placeholder="Healthy" fontSize={11} style={inputStyle(colors)} />
                </Field>
                <Field label="Chip label">
                  <TextInput value={state.chipLabel} onChangeText={setChipLabel(setState)} placeholder="Selected" fontSize={11} style={inputStyle(colors)} />
                </Field>
                <Field label="Tone">
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    {(['accent', 'success', 'warning', 'danger', 'info', 'muted'] as VesperTone[]).map((tone) => option(tone, state.tone === tone, () => setState((prev) => ({ ...prev, tone })) ))}
                  </Row>
                </Field>
                <Field label="Surface mode">
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    {option('elevated', state.elevated, () => setState((prev) => ({ ...prev, elevated: !prev.elevated })))}
                    {option('inset', state.inset, () => setState((prev) => ({ ...prev, inset: !prev.inset })))}
                    {option('selected', state.selected, () => setState((prev) => ({ ...prev, selected: !prev.selected })))}
                  </Row>
                </Field>
                <Field label="Drawer side">
                  <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                    {(['right', 'left', 'bottom'] as const).map((side) => option(side, state.drawerSide === side, () => setState((prev) => ({ ...prev, drawerSide: side, drawerOpen: true }))))}
                    {option(state.drawerOpen ? 'close' : 'open', state.drawerOpen, () => setState((prev) => ({ ...prev, drawerOpen: !prev.drawerOpen })))}
                  </Row>
                </Field>
              </Col>
            </VesperCard>
          </Col>
        </ScrollView>
      </Row>
    </Col>
  );
}

function Field(props: { label: string; children: any }) {
  return <Col style={{ gap: 4 }}><Text fontSize={10} color={VESPER_PALETTE.textDim} style={{ fontWeight: 'bold' }}>{props.label}</Text>{props.children}</Col>;
}

function inputStyle(colors: typeof VESPER_PALETTE): any {
  return { width: '100%', backgroundColor: colors.grayDeep, borderRadius: VESPER_TOKENS.radiusSm, borderWidth: 1, borderColor: colors.borderSoft, paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6, color: colors.textBright };
}

function setTitle(set: any) { return (value: string) => set((prev: State) => ({ ...prev, title: value })); }
function setSubtitle(set: any) { return (value: string) => set((prev: State) => ({ ...prev, subtitle: value })); }
function setButtonLabel(set: any) { return (value: string) => set((prev: State) => ({ ...prev, buttonLabel: value })); }
function setBadgeLabel(set: any) { return (value: string) => set((prev: State) => ({ ...prev, badgeLabel: value })); }
function setChipLabel(set: any) { return (value: string) => set((prev: State) => ({ ...prev, chipLabel: value })); }
