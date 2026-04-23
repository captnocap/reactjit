const React: any = require('react');

import { Box, Col, Row, Text } from '../../runtime/primitives';

export function FpsMeter(props: {
  current: number;
  average: number;
  min: number;
  max: number;
  heapSize?: number;
  sampleCount: number;
}) {
  const heapText = typeof props.heapSize === 'number' && props.heapSize > 0
    ? `${(props.heapSize / 1024 / 1024).toFixed(1)} MB`
    : null;
  return (
    <Box
      style={{
        position: 'absolute',
        right: 12,
        top: 12,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#243243',
        backgroundColor: '#0a1018',
        minWidth: 180,
        gap: 8,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Text fontSize={10} color="#8b98a6" style={{ fontWeight: 'bold' }}>FPS</Text>
        <Text fontSize={11} color="#e6edf3" style={{ fontWeight: 'bold' }}>{props.current.toFixed(1)}</Text>
      </Row>
      <Col style={{ gap: 4 }}>
        <Text fontSize={10} color="#8b98a6">avg {props.average.toFixed(1)}</Text>
        <Text fontSize={10} color="#8b98a6">min {props.min.toFixed(1)}</Text>
        <Text fontSize={10} color="#8b98a6">max {props.max.toFixed(1)}</Text>
        <Text fontSize={10} color="#8b98a6">samples {props.sampleCount}</Text>
        {heapText ? <Text fontSize={10} color="#8b98a6">heap {heapText}</Text> : null}
      </Col>
    </Box>
  );
}
