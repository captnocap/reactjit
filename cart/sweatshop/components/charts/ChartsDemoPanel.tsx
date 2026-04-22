const React: any = require('react');
const { useMemo, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { AreaChart, BarChart, PieChart, LineChart } from './index';

const BAR_DATA = [
  { label: 'Jan', value: 42 },
  { label: 'Feb', value: 78 },
  { label: 'Mar', value: 55 },
  { label: 'Apr', value: 90 },
  { label: 'May', value: 35 },
  { label: 'Jun', value: 67 },
];

const LINE_DATA = [
  { label: 'Jan', value: 20 },
  { label: 'Feb', value: 45 },
  { label: 'Mar', value: 35 },
  { label: 'Apr', value: 70 },
  { label: 'May', value: 55 },
  { label: 'Jun', value: 80 },
  { label: 'Jul', value: 60 },
  { label: 'Aug', value: 90 },
];

const AREA_DATA = [
  { label: 'Jan', value: 12 },
  { label: 'Feb', value: 19 },
  { label: 'Mar', value: 15 },
  { label: 'Apr', value: 25 },
  { label: 'May', value: 22 },
  { label: 'Jun', value: 30 },
  { label: 'Jul', value: 28 },
];

const PIE_DATA = [
  { label: 'Infra', value: 30, color: '#3b82f6' },
  { label: 'Auth', value: 20, color: '#22c55e' },
  { label: 'UI', value: 25, color: '#f59e0b' },
  { label: 'Data', value: 15, color: '#ef4444' },
  { label: 'Other', value: 10, color: '#8b5cf6' },
];

function Chip(props: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={props.onPress} style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: props.active ? COLORS.blue : COLORS.border, backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt }}><Text fontSize={10} color={props.active ? COLORS.blue : COLORS.text}>{props.label}</Text></Pressable>;
}

export function ChartsDemoPanel() {
  const [legendPosition, setLegendPosition] = useState<'top' | 'right' | 'bottom' | 'none'>('bottom');
  const [showTooltip, setShowTooltip] = useState(true);
  const [showAxisLabels, setShowAxisLabels] = useState(true);
  const [formatMode, setFormatMode] = useState<'raw' | 'compact' | 'currency' | 'percent'>('raw');
  const valueFormat = useMemo(() => {
    if (formatMode === 'currency') return (value: number) => '$' + value.toFixed(2);
    if (formatMode === 'percent') return (value: number) => value.toFixed(1) + '%';
    if (formatMode === 'compact') return (value: number) => (Math.abs(value) >= 1000 ? (value / 1000).toFixed(1) + 'K' : String(Math.round(value)));
    return (value: number) => String(Math.round(value * 10) / 10);
  }, [formatMode]);

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Box style={{ padding: 12, gap: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Col style={{ gap: 2 }}>
            <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Charts Demo</Text>
            <Text fontSize={10} color={COLORS.textDim}>Bar, line, area, and pie charts using Canvas/Graph primitives.</Text>
          </Col>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {(['top', 'right', 'bottom', 'none'] as const).map((pos) => <Chip key={pos} active={legendPosition === pos} label={'legend ' + pos} onPress={() => setLegendPosition(pos)} />)}
            <Chip active={showTooltip} label={showTooltip ? 'tooltip on' : 'tooltip off'} onPress={() => setShowTooltip(!showTooltip)} />
            <Chip active={showAxisLabels} label={showAxisLabels ? 'axes on' : 'axes off'} onPress={() => setShowAxisLabels(!showAxisLabels)} />
            {(['raw', 'compact', 'currency', 'percent'] as const).map((mode) => <Chip key={mode} active={formatMode === mode} label={mode} onPress={() => setFormatMode(mode)} />)}
          </Row>
        </Row>
      </Box>

      <ScrollView showScrollbar={true} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: 12 }}>
        <Col style={{ gap: 14 }}>
          {[
            { title: 'Bar Chart', node: <BarChart data={BAR_DATA} legendPosition={legendPosition} showTooltip={showTooltip} showAxisLabels={showAxisLabels} valueFormat={valueFormat} width={560} height={240} /> },
            { title: 'Line Chart', node: <LineChart data={LINE_DATA} legendPosition={legendPosition} showTooltip={showTooltip} showAxisLabels={showAxisLabels} valueFormat={valueFormat} width={560} height={240} /> },
            { title: 'Area Chart', node: <AreaChart data={AREA_DATA} legendPosition={legendPosition} showTooltip={showTooltip} showAxisLabels={showAxisLabels} valueFormat={valueFormat} width={560} height={240} /> },
            { title: 'Pie Chart', node: <PieChart data={PIE_DATA} legendPosition={legendPosition} showTooltip={showTooltip} showAxisLabels={showAxisLabels} valueFormat={valueFormat} width={560} height={240} innerRadius={48} /> },
          ].map((chart) => (
            <Box key={chart.title} style={{ gap: 8, padding: 12, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{chart.title}</Text>
              {chart.node}
            </Box>
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}

export default ChartsDemoPanel;
