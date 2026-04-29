import { Col, Pressable, Text, Canvas } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexCanvasNodeProps = {
  label?: string;
  value?: string;
  x?: number;
  y?: number;
  size?: number;
  selected?: boolean;
  container?: boolean;
  onPress?: () => void;
};

export function DexCanvasNode({
  label = 'routing',
  value = '{3}',
  x = 120,
  y = 80,
  size = 64,
  selected = false,
  container = true,
  onPress,
}: DexCanvasNodeProps) {
  return (
    <Canvas.Node gx={x} gy={y} gw={size} gh={size}>
      <Pressable
        onPress={onPress}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: selected ? DEX_COLORS.accent : container ? DEX_COLORS.ruleBright : DEX_COLORS.rule,
          backgroundColor: container ? '#14100ddd' : DEX_COLORS.bg1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Col style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: selected ? DEX_COLORS.accent : DEX_COLORS.ink, fontSize: 10 }}>{label}</Text>
          <Text style={{ color: DEX_COLORS.inkDimmer, fontSize: 9 }}>{value}</Text>
        </Col>
      </Pressable>
    </Canvas.Node>
  );
}
