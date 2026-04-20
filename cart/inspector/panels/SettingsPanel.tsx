import { Col, Row, Text, Pressable, Box } from '../../../runtime/primitives';
import { COLORS } from '../constants';
import Badge from '../components/Badge';
import Toggle from '../components/Toggle';
import SectionHeader from '../components/SectionHeader';
import { useInspectorSettings, InspectorSettings } from '../InspectorContext';

const INTERVALS = [100, 250, 500, 1000];
const LEVELS: { id: 'all' | 'log' | 'warn' | 'error'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'log', label: 'Log' },
  { id: 'warn', label: 'Warn' },
  { id: 'error', label: 'Error' },
];

export default function SettingsPanel() {
  const { settings, setSetting } = useInspectorSettings();

  return (
    <Col style={{ flexGrow: 1, padding: 12, gap: 12 }}>
      <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
        Inspector Settings
      </Text>

      <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border }}>
        <SectionHeader title="Appearance" />
        <Toggle
          label="Show tree diff highlights"
          value={settings.showTreeDiff}
          onChange={(v) => setSetting('showTreeDiff', v)}
        />
        <Toggle
          label="Show guide gutters"
          value={settings.showGuideGutters}
          onChange={(v) => setSetting('showGuideGutters', v)}
        />
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={10} color={COLORS.text}>Theme</Text>
          <Badge text="Dark" />
          <Text fontSize={9} color={COLORS.textDim}>(Light mode not yet available)</Text>
        </Row>
      </Box>

      <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border }}>
        <SectionHeader title="Capture" />
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={10} color={COLORS.text}>Console capture</Text>
          <Badge text="Active" color={COLORS.green} />
        </Row>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={10} color={COLORS.text}>Network capture</Text>
          <Badge text="Active" color={COLORS.green} />
        </Row>
        <Row style={{ gap: 6, alignItems: 'center', marginTop: 4 }}>
          <Text fontSize={10} color={COLORS.text}>Log level</Text>
          {LEVELS.map((lvl) => (
            <Pressable key={lvl.id} onPress={() => setSetting('logLevel', lvl.id)}>
              <Badge
                text={lvl.label}
                color={settings.logLevel === lvl.id ? COLORS.accent : COLORS.border}
              />
            </Pressable>
          ))}
        </Row>
      </Box>

      <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border }}>
        <SectionHeader title="Performance" />
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={10} color={COLORS.text}>Poll interval</Text>
          {INTERVALS.map((ms) => (
            <Pressable key={ms} onPress={() => setSetting('pollIntervalMs', ms)}>
              <Badge
                text={`${ms}ms`}
                color={settings.pollIntervalMs === ms ? COLORS.accent : COLORS.border}
              />
            </Pressable>
          ))}
        </Row>
      </Box>

      <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border }}>
        <SectionHeader title="Actions" />
        <Pressable
          onPress={() => {
            const defaults: InspectorSettings = {
              showTreeDiff: true,
              showGuideGutters: true,
              pollIntervalMs: 250,
              logLevel: 'all',
            };
            setSetting('showTreeDiff', defaults.showTreeDiff);
            setSetting('showGuideGutters', defaults.showGuideGutters);
            setSetting('pollIntervalMs', defaults.pollIntervalMs);
            setSetting('logLevel', defaults.logLevel);
          }}
          style={{
            backgroundColor: COLORS.bgHover,
            borderRadius: 4,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 4,
            paddingBottom: 4,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text fontSize={9} color={COLORS.textDim}>Reset to Defaults</Text>
        </Pressable>
      </Box>

      <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border }}>
        <SectionHeader title="About" />
        <Text fontSize={10} color={COLORS.textDim}>ReactJIT Inspector v2.1</Text>
        <Text fontSize={9} color={COLORS.textDim}>Multi-panel devtools for the ReactJIT reconciler.</Text>
        <Text fontSize={9} color={COLORS.textDim}>Built with React primitives, no DOM.</Text>
      </Box>
    </Col>
  );
}
