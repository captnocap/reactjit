const React: any = require('react');
const { useMemo } = React;

import { Box, Canvas } from '../../runtime/primitives';
import { FpsMeter } from './FpsMeter';
import { resolveNodePosition, type StressScene } from './useStressScene';

function HslColor(h: number, s: number, l: number): string {
  const hue = ((h % 1) + 1) % 1;
  return `hsl(${Math.round(hue * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

function NodeGlyph(props: { shape: 'circle' | 'rect' | 'triangle'; size: number; color: string; glow: boolean }) {
  const size = Math.max(2, props.size);
  if (props.shape === 'triangle') {
    const d = `M 0 ${size} L ${size / 2} 0 L ${size} ${size} Z`;
    return <Canvas.Path d={d} fill={props.color} stroke={props.glow ? '#ffffff' : props.color} strokeWidth={props.glow ? 1 : 0.6} />;
  }
  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: props.shape === 'circle' ? size : 2,
        backgroundColor: props.color,
        borderWidth: props.glow ? 1 : 0,
        borderColor: props.glow ? '#ffffff' : props.color,
      }}
    />
  );
}

export function StressCanvas(props: {
  scene: StressScene;
  time: number;
  animated: boolean;
  effects: boolean;
  fps: number;
  average: number;
  min: number;
  max: number;
  heapSize?: number;
  sampleCount: number;
}) {
  const nodes = useMemo(() => props.scene.nodes, [props.scene.nodes]);
  const renderNodes = nodes.map((node) => {
    const pos = resolveNodePosition(node, props.time, props.animated);
    const color = HslColor(node.hue, node.saturation, node.lightness);
    const shadow = props.effects ? 0.9 : 0.45;
    return (
      <Canvas.Node key={node.id} gx={pos.x} gy={pos.y} gw={Math.max(4, pos.size)} gh={Math.max(4, pos.size)}>
        <Box
          style={{
            width: Math.max(4, pos.size),
            height: Math.max(4, pos.size),
            alignItems: 'center',
            justifyContent: 'center',
            transform: props.effects ? { rotate: pos.spin } : undefined,
            opacity: shadow,
          }}
        >
          <NodeGlyph shape={node.shape} size={Math.max(4, pos.size)} color={color} glow={props.effects} />
        </Box>
      </Canvas.Node>
    );
  });

  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, position: 'relative', backgroundColor: '#050816' }}>
      <Canvas style={{ width: '100%', height: '100%', backgroundColor: '#050816' }} viewX={0} viewY={0} viewZoom={1}>
        <Canvas.Node gx={0} gy={0} gw={props.scene.span} gh={props.scene.span}>
          {renderNodes}
        </Canvas.Node>
      </Canvas>
      <FpsMeter
        current={props.fps}
        average={props.average}
        min={props.min}
        max={props.max}
        heapSize={props.heapSize}
        sampleCount={props.sampleCount}
      />
    </Box>
  );
}
