import { Box, Col, Effect, Row, Text } from '@reactjit/runtime/primitives';
import {
import { classifiers as S } from '@reactjit/core';
  MATRIX_SIZE,
  type MatrixSimulation,
  type PanelSize,
  deviceLabel,
  projectionLabel,
  renderProjection,
} from './matrixScalingModel';

export function MatrixProjectionTile(props: {
  size: PanelSize;
  simulation: MatrixSimulation;
  showLabel?: boolean;
}) {
  const isNative = props.size === MATRIX_SIZE;

  return (
    <S.StackX4Center>
      {props.showLabel ? (
        <Row
          style={{
            width: props.size + 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <Box
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 6,
              backgroundColor: isNative ? '#113f32' : '#0a2130',
              borderWidth: 1,
              borderColor: isNative ? '#6aa390' : '#173d53',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: isNative ? '#b2ffde' : '#68d9ff', fontFamily: 'monospace' }}>
              {`${props.size}×${props.size}`}
            </Text>
          </Box>

          <Text style={{ fontSize: 10, color: '#537282', fontFamily: 'monospace', textTransform: 'uppercase' }}>
            {deviceLabel(props.size)}
          </Text>
        </Row>
      ) : null}

      <Box
        style={{
          width: props.size + 12,
          height: props.size + 12,
          padding: 5,
          borderRadius: 12,
          backgroundColor: '#02060c',
          borderWidth: 1,
          borderColor: isNative ? '#6aa390' : '#29495b',
        }}
      >
        <Effect
          onRender={(effect: any) => renderProjection(props.simulation, effect, props.size)}
          style={{ width: props.size, height: props.size }}
        />
      </Box>

      {props.showLabel ? (
        <Text style={{ fontSize: 9, color: '#6f8798', fontFamily: 'monospace', textTransform: 'uppercase' }}>
          {projectionLabel(props.size)}
        </Text>
      ) : null}
    </S.StackX4Center>
  );
}
