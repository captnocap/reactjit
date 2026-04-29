import { Box, Col, Effect, Row, Text } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import {
  DEFAULT_BRAILLE_PROJECTION_THEME,
  LOGICAL_SIZE,
  type BrailleProjectionTheme,
  type ChannelId,
  type InstrumentSimulation,
  type PaletteId,
  type ProjectionSize,
  formatPhysicalScale,
  renderSurface,
} from './matrixDisplayModel';

export function BrailleProjectionSurface(props: {
  size: ProjectionSize;
  simulation: InstrumentSimulation;
  channelId: ChannelId;
  paletteId: PaletteId;
  speed: number;
  gain: number;
  showLabel?: boolean;
  theme?: BrailleProjectionTheme;
}) {
  const theme = props.theme || DEFAULT_BRAILLE_PROJECTION_THEME;
  const compactLabel = props.size < 128;
  const slotWidth = compactLabel ? Math.max(props.size + 10, 58) : props.size + 10;
  const scaleLabel =
    props.size === LOGICAL_SIZE ? '1:1' : props.size > LOGICAL_SIZE ? `x${(props.size / LOGICAL_SIZE).toFixed(1)}` : `1:${LOGICAL_SIZE / props.size}`;

  return (
    <S.StackX4Center style={{ width: slotWidth }}>
      {props.showLabel ? (
        compactLabel ? (
          <Col style={{ width: slotWidth, alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 10, color: theme.labelText, fontWeight: 'bold', fontFamily: 'monospace' }}>
              {`${props.size}×${props.size}`}
            </Text>
            <Text
              style={{
                fontSize: 8,
                color: theme.metaText,
                textTransform: 'uppercase',
                letterSpacing: 1,
                fontFamily: 'monospace',
              }}
            >
              {scaleLabel}
            </Text>
          </Col>
        ) : (
          <Row
            style={{
              width: slotWidth,
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 10, color: theme.labelText, fontWeight: 'bold', fontFamily: 'monospace' }}>
              {`${props.size}×${props.size}`}
            </Text>
            <Text style={{ fontSize: 8, color: theme.metaText, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'monospace' }}>
              {formatPhysicalScale(props.size)}
            </Text>
          </Row>
        )
      ) : null}

      <Box
        style={{
          width: props.size + 10,
          height: props.size + 10,
          padding: 5,
          borderWidth: 1,
          borderColor: theme.surfaceBorder,
          backgroundColor: theme.surfaceBackground,
        }}
      >
        <Effect
          onRender={(effect: any) =>
            renderSurface(props.simulation, effect, props.size, props.channelId, props.paletteId, props.speed, props.gain)
          }
          style={{ width: props.size, height: props.size }}
        />
      </Box>
    </S.StackX4Center>
  );
}
