const React: any = require('react');
const { useMemo, useState } = React;

import { Box, Col, Row, Text } from '../runtime/primitives';
import { StressCanvas } from './canvas_stress/StressCanvas';
import { StressControls, type CountChoice, type StressPreset, type StressShape } from './canvas_stress/StressControls';
import { useFpsTracker } from './canvas_stress/useFpsTracker';
import { useStressScene } from './canvas_stress/useStressScene';

const host: any = globalThis as any;

export default function App() {
  const [count, setCount] = useState<CountChoice>(1000);
  const [preset, setPreset] = useState<StressPreset>('random-scatter');
  const [shape, setShape] = useState<StressShape>('mixed');
  const [animated, setAnimated] = useState(true);
  const [effects, setEffects] = useState(false);
  const fps = useFpsTracker(animated);
  const scene = useStressScene({ count, preset, shapeMode: shape });

  const heapSize = typeof host.__heapSize === 'number' ? host.__heapSize : 0;
  const stressLabel = useMemo(() => `${scene.count.toLocaleString()} nodes · ${preset} · ${shape}`, [scene.count, preset, shape]);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: '#050816' }}>
      <StressControls
        count={count}
        preset={preset}
        shape={shape}
        animated={animated}
        effects={effects}
        onCountChange={setCount}
        onPresetChange={setPreset}
        onShapeChange={setShape}
        onAnimatedChange={setAnimated}
        onEffectsChange={setEffects}
        onFuckIt={() => {
          setCount(100000);
          setPreset('random-scatter');
          setShape('mixed');
          setAnimated(true);
          setEffects(true);
        }}
      />

      <Row style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10, justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#1f2937', backgroundColor: '#08101a' }}>
        <Text fontSize={11} color="#9fb0c3" style={{ fontWeight: 'bold' }}>{stressLabel}</Text>
        <Text fontSize={11} color="#9fb0c3">{animated ? 'animated' : 'static'} · {effects ? 'effects max' : 'effects low'}</Text>
      </Row>

      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <StressCanvas
          scene={scene}
          time={fps.time}
          animated={animated}
          effects={effects}
          fps={fps.current}
          average={fps.average}
          min={fps.min}
          max={fps.max}
          heapSize={heapSize}
          sampleCount={fps.sampleCount}
        />
      </Box>
    </Col>
  );
}
