
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';
import { AreaChart } from './AreaChart';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import { PieChart } from './PieChart';
import { type ChartLegendPosition } from './ChartLegend';
import { useChartsData } from './useChartsData';

function Chip(props: { active?: boolean; label: string; onPress: () => void }) {
  const active = props.active === true;
  return <Pressable onPress={props.onPress} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: active ? COLORS.blue : COLORS.border, backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt }}><Text fontSize={10} color={active ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>{props.label}</Text></Pressable>;
}

function Section(props: { title: string; subtitle: string; children: any }) {
  return <Box style={{ padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, backgroundColor: COLORS.panelRaised }}><Col style={{ gap: 2 }}><Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text><Text fontSize={10} color={COLORS.textDim}>{props.subtitle}</Text></Col>{props.children}</Box>;
}

export function ChartsPanel(props: { workDir?: string; onClose?: () => void }) {
  const [legendPosition, setLegendPosition] = useState<ChartLegendPosition>('bottom');
  const [showTooltip, setShowTooltip] = useState(1);
  const [showAxisLabels, setShowAxisLabels] = useState(1);
  const [formatMode, setFormatMode] = useState<'compact' | 'exact'>('compact');
  const { snapshot, refresh } = useChartsData(props.workDir);
  const valueFormat = useMemo(() => (value: number) => {
    if (formatMode === 'exact') return String(Math.round(value));
    const abs = Math.abs(value);
    if (abs >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    if (abs >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return String(Math.round(value));
  }, [formatMode]);

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0, minWidth: 180 }}>
          <Row style={{ gap: 6, alignItems: 'center' }}>
            <Icon name="graph" size={14} color={COLORS.blue} />
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Charts</Text>
          </Row>
          <Text fontSize={10} color={COLORS.textDim}>{snapshot.summary.branch} · +{snapshot.summary.ahead}/-{snapshot.summary.behind} · {snapshot.summary.dirty} dirty · {snapshot.summary.staged} staged · {snapshot.summary.trackedFiles} tracked</Text>
          <Text fontSize={9} color={COLORS.textDim}>build {snapshot.summary.buildTime} · palette {snapshot.summary.paletteHits} · {snapshot.summary.workDir}</Text>
        </Col>
        <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label="refresh" onPress={refresh} />
          <Chip label={`legend ${legendPosition}`} onPress={() => setLegendPosition((legendPosition === 'bottom' ? 'right' : legendPosition === 'right' ? 'top' : legendPosition === 'top' ? 'none' : 'bottom'))} />
          <Chip label={showTooltip ? 'tooltip on' : 'tooltip off'} active={showTooltip === 1} onPress={() => setShowTooltip(showTooltip ? 0 : 1)} />
          <Chip label={showAxisLabels ? 'axis on' : 'axis off'} active={showAxisLabels === 1} onPress={() => setShowAxisLabels(showAxisLabels ? 0 : 1)} />
          <Chip label={formatMode} active={formatMode === 'compact'} onPress={() => setFormatMode(formatMode === 'compact' ? 'exact' : 'compact')} />
          {props.onClose ? <Chip label="close" onPress={props.onClose} /> : null}
        </Row>
      </Row>

      <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <Col style={{ gap: 12, padding: 12 }}>
          <Section title="Commits per day" subtitle="daily commit volume from live git history">
            <BarChart data={snapshot.commitsByDay} width={560} height={240} legendPosition={legendPosition} showTooltip={!!showTooltip} showAxisLabels={!!showAxisLabels} valueFormat={valueFormat} />
          </Section>
          <Section title="Line churn trend" subtitle="daily additions and deletions from git log">
            <LineChart data={snapshot.churnByDay} width={560} height={240} legendPosition={legendPosition} showTooltip={!!showTooltip} showAxisLabels={!!showAxisLabels} valueFormat={valueFormat} />
          </Section>
          <Section title="File-size history" subtitle="recent size changes for the most-touched files">
            <AreaChart data={snapshot.fileSizeHistory} width={560} height={240} legendPosition={legendPosition} showTooltip={!!showTooltip} showAxisLabels={!!showAxisLabels} valueFormat={valueFormat} />
          </Section>
          <Section title="Workspace file mix" subtitle="tracked file extensions from the live workspace">
            <PieChart data={snapshot.extensionMix} width={560} height={240} legendPosition={legendPosition} showTooltip={!!showTooltip} showAxisLabels={!!showAxisLabels} valueFormat={valueFormat} innerRadius={42} />
          </Section>
        </Col>
      </ScrollView>
    </Col>
  );
}

export default ChartsPanel;
