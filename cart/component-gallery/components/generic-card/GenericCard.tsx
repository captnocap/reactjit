import { Box, Col, Row, Text } from '../../../../runtime/primitives';

export type GenericCardRow = {
  label: string;
  value: string;
  tone?: 'soft' | 'cool' | 'warm';
};

export type GenericCardMetric = {
  label: string;
  value: string;
  fill: number;
  color: string;
};

export type GenericCardProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  rows?: GenericCardRow[];
  metrics?: GenericCardMetric[];
};

const CARD_WIDTH = 336;
const TRACK_WIDTH = 112;

const DEFAULT_ROWS: GenericCardRow[] = [
  { label: 'Item one', value: 'Ready', tone: 'cool' },
  { label: 'Item two', value: 'Queued', tone: 'warm' },
  { label: 'Item three', value: 'Open', tone: 'soft' },
  { label: 'Item four', value: 'Next', tone: 'cool' },
];

const DEFAULT_METRICS: GenericCardMetric[] = [
  { label: 'Primary', value: '72%', fill: 0.72, color: '#9be7e2' },
  { label: 'Secondary', value: '48%', fill: 0.48, color: '#c8a6ff' },
  { label: 'Accent', value: '31%', fill: 0.31, color: '#ffb170' },
];

const SKETCH_LINES = [
  '        ..             ..       ',
  '      ..  ..         ..  ..     ',
  '    ..      ..     ..      ..   ',
  ' ..           .. ..          .. ',
  '............  ...  ............',
  '      --        --        --    ',
];

const toneColors = {
  soft: '#bec7e0',
  cool: '#7eddf2',
  warm: '#ff8fb3',
};

function clampFill(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

// Animated inner accent border. Visually equivalent to the previous 8-box
// L-bracket CornerFrame but rendered via the framework's built-in
// dashed/flowing border stroke so the accents *march* around the card edge.
//
// - borderDash: [44, 108]  → ~44px dash length (roughly the size of the old L,
//                            once you bend it into 22+22 arms) with long gaps,
//                            so at rest 4 dashes sit near the 4 corners of a
//                            ~600px perimeter.
// - borderFlowSpeed: 18    → slow clockwise march in px/sec.
// - borderWidth: 0          → suppress the baked border; dashes are the only
//                            stroke on this layer.
// - borderDashWidth: 2      → explicit dash stroke width so the look matches
//                            the original 2px L-brackets.
//
// The outer card's solid gray border and orange title strip are untouched.
function CornerFrame() {
  return (
    <Box
      style={{
        position: 'absolute',
        left: 10,
        top: 16,
        right: 10,
        bottom: 10,
        borderRadius: 4,
        borderWidth: 0,
        borderColor: '#bfa3ff',
        borderDash: [44, 108],
        borderDashWidth: 2,
        borderFlowSpeed: 18,
      }}
    />
  );
}

function MetricBar({ metric }: { metric: GenericCardMetric }) {
  const fillWidth = Math.round(clampFill(metric.fill) * TRACK_WIDTH);

  return (
    <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Text style={{ width: 78, fontFamily: 'monospace', fontSize: 10, color: '#cbd4ec' }}>{metric.label}</Text>
      <Box
        style={{
          width: TRACK_WIDTH,
          height: 8,
          backgroundColor: '#34364f',
          borderWidth: 1,
          borderColor: '#4d5372',
        }}
      >
        <Box style={{ width: fillWidth, height: 6, backgroundColor: metric.color }} />
      </Box>
      <Text style={{ width: 38, fontFamily: 'monospace', fontSize: 10, color: '#f2f4ff' }}>{metric.value}</Text>
    </Row>
  );
}

function DataRow({ row, index }: { row: GenericCardRow; index: number }) {
  const tone = row.tone ?? 'soft';

  return (
    <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Row style={{ alignItems: 'center', gap: 7 }}>
        <Text style={{ width: 20, fontFamily: 'monospace', fontSize: 9, color: '#8f98b8' }}>
          {String(index + 1).padStart(2, '0')}
        </Text>
        <Text style={{ width: 122, fontFamily: 'monospace', fontSize: 10, color: '#dfe6ff' }}>{row.label}</Text>
      </Row>
      <Text style={{ width: 58, fontFamily: 'monospace', fontSize: 10, color: toneColors[tone] }}>{row.value}</Text>
    </Row>
  );
}

export function GenericCard({
  eyebrow = '1 card   menu   preset *',
  title = 'Standard Card',
  subtitle = 'Supporting text for the card.',
  rows = DEFAULT_ROWS,
  metrics = DEFAULT_METRICS,
}: GenericCardProps) {
  return (
    <Col
      style={{
        position: 'relative',
        width: CARD_WIDTH,
        backgroundColor: '#20233a',
        borderWidth: 1,
        borderColor: '#697193',
        borderRadius: 6,
      }}
    >
      <Box style={{ height: 6, backgroundColor: '#ffa066', borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
      <CornerFrame />
      <Col style={{ padding: 18, paddingTop: 16, gap: 13 }}>
        <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', color: '#bfc9ea' }}>{eyebrow}</Text>
          <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#9be7e2' }}>79%</Text>
        </Row>

        <Col style={{ gap: 3 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#f2f4ff' }}>{title}</Text>
          <Text style={{ fontSize: 11, color: '#aeb7d3' }}>{subtitle}</Text>
        </Col>

        <Col
          style={{
            padding: 13,
            gap: 2,
            backgroundColor: '#171b31',
            borderWidth: 1,
            borderColor: '#5b6285',
            borderRadius: 4,
          }}
        >
          {SKETCH_LINES.map((line, index) => (
            <Text
              key={index}
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: index === SKETCH_LINES.length - 1 ? '#ffbd80' : index > 3 ? '#9cf0bd' : '#78d9f4',
              }}
            >
              {line}
            </Text>
          ))}
        </Col>

        <Col style={{ gap: 7 }}>
          {metrics.map((metric) => (
            <MetricBar key={metric.label} metric={metric} />
          ))}
        </Col>

        <Col
          style={{
            padding: 10,
            gap: 7,
            backgroundColor: '#252840',
            borderWidth: 1,
            borderColor: '#4e5877',
            borderRadius: 4,
          }}
        >
          {rows.map((row, index) => (
            <DataRow key={`${row.label}-${index}`} row={row} index={index} />
          ))}
        </Col>
      </Col>
    </Col>
  );
}
