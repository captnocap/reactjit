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
  pageBackground: 'theme:bg',
  pageBorder: 'theme:rule',
  glowPrimary: 'theme:paperInk',
  glowSecondary: 'theme:bg1',
  headerRule: 'theme:rule',
  titleText: 'theme:ink',
  subtitleText: 'theme:accent',
  bodyText: 'theme:inkDimmer',
  chipBackground: 'theme:bg2',
  chipBorder: 'theme:paperRule',
  chipText: 'theme:warn',
  glyphOn: 'theme:warn',
  glyphOff: 'theme:paperRule',
  glyphBorder: 'theme:paperRuleBright',
  labelBackground: 'theme:bg2',
  labelBackgroundNative: 'theme:paperRule',
  labelBorder: 'theme:paperRuleBright',
  labelBorderNative: 'theme:accent',
  labelText: 'theme:warn',
  labelTextNative: 'theme:paper',
  deviceText: 'theme:inkDimmer',
  panelBackground: 'theme:bg',
  panelBorder: 'theme:rule',
  panelBorderNative: 'theme:accent',
  footerText: 'theme:inkDimmer',
  scanlineColor: 'theme:ink',
  scanlineOpacity: 0.08,
  scanlineShade: 0.92,
  heatStops: [
    [0.0, 'theme:bg'],
    [0.3, 'theme:bg2'],
    [0.6, 'theme:ruleBright'],
    [0.82, 'theme:accent'],
    [1.0, 'theme:ink'],
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
          color: 'theme:inkDimmer',
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
        borderBottomColor: 'theme:rule',
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
      accent="theme:accent"
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
      accent="theme:accent"
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
        <Text style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', color: 'theme:ink' }}>
          Projection Surface
        </Text>
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: 9,
            color: 'theme:inkDimmer',
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
