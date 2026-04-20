import { Col, Row, Text, Box, ScrollView, Graph } from '../../../runtime/primitives';
import { PerfSample } from '../types';
import { COLORS, TIMING } from '../constants';
import SectionHeader from '../components/SectionHeader';

function sparkPoints(
  data: PerfSample[],
  key: keyof PerfSample,
  height: number,
  max: number
): string {
  if (data.length < 2) return '';
  const step = 4;
  const pts: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const x = i * step;
    const val = (data[i][key] as number) || 0;
    const y = height - (val / Math.max(1, max)) * height;
    pts.push(`${x},${y}`);
  }
  return `M ${pts.join(' L ')}`;
}

function avg(data: PerfSample[], key: keyof PerfSample): number {
  if (!data.length) return 0;
  const sum = data.reduce((a, p) => a + ((p[key] as number) || 0), 0);
  return Math.round(sum / data.length);
}

export default function PerformancePanel({
  history,
}: {
  history: PerfSample[];
}) {
  const recent = history.slice(-TIMING.perfSamples);
  const maxFrame = Math.max(1, ...recent.map((p) => p.frameTotalUs || 1));
  const maxNodes = Math.max(1, ...recent.map((p) => p.nodes || 1));
  const latest = recent[recent.length - 1];

  const metricCards = [
    { label: 'FPS', value: latest?.fps ?? 0, color: COLORS.green, warn: 30 },
    { label: 'Layout', value: `${latest?.layoutUs ?? 0}µs`, color: COLORS.blue, warn: 1000 },
    { label: 'Paint', value: `${latest?.paintUs ?? 0}µs`, color: COLORS.orange, warn: 1000 },
    { label: 'Frame', value: `${latest?.frameTotalUs ?? 0}µs`, color: COLORS.purple, warn: 16666 },
    { label: 'Nodes', value: latest?.nodes ?? 0, color: COLORS.yellow },
    { label: 'Visible', value: latest?.visible ?? 0, color: COLORS.cyan },
  ];

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Col style={{ gap: 12, padding: 10 }}>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {metricCards.map((m) => (
            <Box
              key={m.label}
              style={{
                backgroundColor: COLORS.bgPanel,
                borderRadius: 8,
                padding: 12,
                gap: 4,
                minWidth: 100,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                {m.label}
              </Text>
              <Text fontSize={18} color={m.color} style={{ fontWeight: 'bold' }}>
                {String(m.value)}
              </Text>
            </Box>
          ))}
        </Row>

        <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
          <SectionHeader title="Frame Time" right={<Text fontSize={9} color={COLORS.textDim}>avg {avg(recent, 'frameTotalUs')}µs</Text>} />
          <Box style={{ height: 80, backgroundColor: COLORS.bg, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border }}>
            <Graph style={{ width: '100%', height: '100%' }} viewX={0} viewY={0} viewZoom={1}>
              <Graph.Path d={sparkPoints(recent, 'frameTotalUs', 70, maxFrame)} stroke={COLORS.purple} strokeWidth={1.5} />
            </Graph>
          </Box>
        </Box>

        <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
          <SectionHeader title="FPS" right={<Text fontSize={9} color={COLORS.textDim}>avg {avg(recent, 'fps')}</Text>} />
          <Box style={{ height: 80, backgroundColor: COLORS.bg, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border }}>
            <Graph style={{ width: '100%', height: '100%' }} viewX={0} viewY={0} viewZoom={1}>
              <Graph.Path d={sparkPoints(recent, 'fps', 70, 120)} stroke={COLORS.green} strokeWidth={1.5} />
            </Graph>
          </Box>
        </Box>

        <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
          <SectionHeader title="Node Count" right={<Text fontSize={9} color={COLORS.textDim}>avg {avg(recent, 'nodes')}</Text>} />
          <Box style={{ height: 80, backgroundColor: COLORS.bg, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border }}>
            <Graph style={{ width: '100%', height: '100%' }} viewX={0} viewY={0} viewZoom={1}>
              <Graph.Path d={sparkPoints(recent, 'nodes', 70, maxNodes)} stroke={COLORS.yellow} strokeWidth={1.5} />
            </Graph>
          </Box>
        </Box>

        <Box style={{ backgroundColor: COLORS.bgPanel, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: COLORS.border }}>
          <SectionHeader title="Frame Breakdown" />
          <Col style={{ gap: 3 }}>
            {recent.slice(-30).map((p, i) => {
              const layoutPct = Math.min(100, (p.layoutUs / Math.max(1, p.frameTotalUs)) * 100);
              const paintPct = Math.min(100, (p.paintUs / Math.max(1, p.frameTotalUs)) * 100);
              return (
                <Row key={i} style={{ height: 16, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                  <Box style={{ width: `${layoutPct}%`, backgroundColor: COLORS.blue }} />
                  <Box style={{ width: `${paintPct}%`, backgroundColor: COLORS.orange }} />
                  <Box style={{ flexGrow: 1, backgroundColor: COLORS.bgHover }} />
                </Row>
              );
            })}
          </Col>
          <Row style={{ gap: 12, marginTop: 6 }}>
            {[
              { c: COLORS.blue, l: 'Layout' },
              { c: COLORS.orange, l: 'Paint' },
              { c: COLORS.bgHover, l: 'Other' },
            ].map((x) => (
              <Row key={x.l} style={{ gap: 4, alignItems: 'center' }}>
                <Box style={{ width: 10, height: 10, backgroundColor: x.c, borderRadius: 2 }} />
                <Text fontSize={9} color={COLORS.textDim}>{x.l}</Text>
              </Row>
            ))}
          </Row>
        </Box>
      </Col>
    </ScrollView>
  );
}
