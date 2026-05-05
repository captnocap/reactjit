import { Col, Text } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexSpatialNodeProps = {
  label?: string;
  value?: string;
  x?: number;
  y?: number;
  size?: number;
  container?: boolean;
  selected?: boolean;
};

export function DexSpatialNode({
  label = 'workers',
  value = '{5}',
  x = 120,
  y = 80,
  size = 72,
  container = true,
  selected = false,
}: DexSpatialNodeProps) {
  return (
    <Col
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: selected ? DEX_COLORS.accent : container ? DEX_COLORS.ruleBright : DEX_COLORS.rule,
        backgroundColor: container ? 'theme:bg1' : DEX_COLORS.bg1,
      }}
    >
      <Text style={{ color: selected ? DEX_COLORS.accent : DEX_COLORS.ink, fontSize: 10 }}>{label}</Text>
      <Text style={{ color: DEX_COLORS.inkDimmer, fontSize: 9 }}>{value}</Text>
    </Col>
  );
}
