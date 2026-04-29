import { useEffect, useRef } from 'react';
import { Col, Row, Text } from '@reactjit/runtime/primitives';
import { MatrixProjectionSurface } from '../matrix-scaling-dashboard/MatrixScalingDashboard';
import { BrailleProjectionSurface } from './BrailleProjectionSurface';
import {
  CHANNELS,
  DEFAULT_BRAILLE_PROJECTION_THEME,
  GAIN_PRESETS,
  SPEED_PRESETS,
  createInstrumentSimulation,
  resetInstrumentChannel,
  type ChannelId,
  type InstrumentSimulation,
  type ProjectionSize,
} from './matrixDisplayModel';
import type { PanelSize } from '../matrix-scaling-dashboard/matrixScalingModel';

const CASCADE_SIZES = [16, 32, 64, 128, 512] as const;
const BRAILLE_CHANNEL_IDS: ChannelId[] = ['plasma', 'ripple', 'sweep', 'life', 'orbit', 'grid'];
const MATRIX_THEME = {
  pageBackground: '#080503',
  pageBorder: '#3a2a1e',
  glowPrimary: '#2a160a',
  glowSecondary: '#1a0d07',
  headerRule: '#3a2a1e',
  titleText: '#f2e8dc',
  subtitleText: '#d26a2a',
  bodyText: '#7a6e5d',
  chipBackground: '#1a120d',
  chipBorder: '#4c2d19',
  chipText: '#d9a15d',
  glyphOn: '#f2b26b',
  glyphOff: '#4c2d19',
  glyphBorder: '#6a3e22',
  labelBackground: '#1f130c',
  labelBackgroundNative: '#3a2414',
  labelBorder: '#6a3e22',
  labelBorderNative: '#d26a2a',
  labelText: '#d9a15d',
  labelTextNative: '#ffd8a3',
  deviceText: '#7a6e5d',
  panelBackground: '#080503',
  panelBorder: '#3a2a1e',
  panelBorderNative: '#d26a2a',
  footerText: '#7a6e5d',
  scanlineColor: '#f2e8dc',
  scanlineOpacity: 0.08,
  scanlineShade: 0.92,
  heatStops: [
    [0.0, [8, 4, 2]],
    [0.3, [48, 20, 8]],
    [0.6, [138, 74, 32]],
    [0.82, [210, 106, 42]],
    [1.0, [255, 210, 140]],
  ] as const,
} as const;

function getChannelMeta(channelId: ChannelId) {
  return CHANNELS.find((channel) => channel.id === channelId) || CHANNELS[0];
}

function useProjectionSimulation(channelId: ChannelId): InstrumentSimulation {
  const simulationRef = useRef<InstrumentSimulation | null>(null);
  if (!simulationRef.current) simulationRef.current = createInstrumentSimulation();

  useEffect(() => {
    resetInstrumentChannel(simulationRef.current!, channelId);
  }, [channelId]);

  return simulationRef.current;
}

function RowLabel({
  title,
  detail,
  accent,
}: {
  title: string;
  detail: string;
  accent: string;
}) {
  return (
    <Col
      style={{
        gap: 5,
      }}
    >
      <Text
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          fontWeight: 'bold',
          color: accent,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: 'monospace',
          fontSize: 8,
          color: '#7a6e5d',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {detail}
      </Text>
    </Col>
  );
}

function ProjectionRow({
  title,
  detail,
  accent,
  small,
  hero,
}: {
  title: string;
  detail: string;
  accent: string;
  small: any;
  hero: any;
}) {
  return (
    <Col
      style={{
        width: '100%',
        gap: 12,
        paddingBottom: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#3a2a1e',
      }}
    >
      <RowLabel title={title} detail={detail} accent={accent} />
      <Row
        style={{
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <Row
          style={{
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          {small}
        </Row>
        <Col
          style={{
            alignItems: 'flex-start',
            gap: 6,
          }}
        >
          {hero}
        </Col>
      </Row>
    </Col>
  );
}

function BrailleCascadeRow({ channelId }: { channelId: ChannelId }) {
  const simulation = useProjectionSimulation(channelId);
  const channel = getChannelMeta(channelId);

  return (
    <ProjectionRow
      title={channel.label}
      detail={channel.sub}
      accent="#d26a2a"
      small={CASCADE_SIZES.filter((size) => size !== 512).map((size) => (
        <BrailleProjectionSurface
          key={`braille:${channelId}:${size}`}
          size={size as ProjectionSize}
          simulation={simulation}
          channelId={channelId}
          paletteId="amber"
          speed={SPEED_PRESETS[2]}
          gain={GAIN_PRESETS[2]}
          showLabel
          theme={DEFAULT_BRAILLE_PROJECTION_THEME}
        />
      ))}
      hero={
        <BrailleProjectionSurface
          key={`braille:${channelId}:512`}
          size={512 as ProjectionSize}
          simulation={simulation}
          channelId={channelId}
          paletteId="amber"
          speed={SPEED_PRESETS[2]}
          gain={GAIN_PRESETS[2]}
          showLabel
          theme={DEFAULT_BRAILLE_PROJECTION_THEME}
        />
      }
    />
  );
}

function MatrixCascadeRow() {
  return (
    <ProjectionRow
      title="matrix"
      detail="heat map"
      accent="#d26a2a"
      small={CASCADE_SIZES.filter((size) => size !== 512).map((size) => (
        <MatrixProjectionSurface key={`matrix:${size}`} size={size as PanelSize} theme={MATRIX_THEME} />
      ))}
      hero={<MatrixProjectionSurface key="matrix:512" size={512 as PanelSize} theme={MATRIX_THEME} />}
    />
  );
}

export function ProjectionSurfaceWall() {
  return (
    <Col style={{ width: '100%', gap: 18 }}>
      <Col style={{ gap: 6 }}>
        <Text style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', color: '#f2e8dc' }}>
          Projection Surface
        </Text>
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: 9,
            color: '#7a6e5d',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          16x16 / 32x32 / 64x64 / 128x128 / 512x512
        </Text>
      </Col>

      {BRAILLE_CHANNEL_IDS.map((channelId) => (
        <BrailleCascadeRow key={channelId} channelId={channelId} />
      ))}
      <MatrixCascadeRow />
    </Col>
  );
}
