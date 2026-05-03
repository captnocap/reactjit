import { Row, Text } from '@reactjit/runtime/primitives';
import { DEX_COLORS } from '../dex-frame/DexFrame';

export type DexBreadcrumbsProps = {
  items?: Array<string | number>;
};

export function DexBreadcrumbs({ items = ['root', 'workers', 2, 'confidence'] }: DexBreadcrumbsProps) {
  return (
    <Row style={{ alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {items.map((item, index) => (
        <Row key={`${item}-${index}`} style={{ alignItems: 'center', gap: 5 }}>
          {index > 0 ? <Text style={{ color: DEX_COLORS.ghost, fontSize: 10 }}>›</Text> : null}
          <Text
            style={{
              color: index === items.length - 1 ? DEX_COLORS.accent : DEX_COLORS.inkDim,
              fontSize: 10,
            }}
          >
            {String(item)}
          </Text>
        </Row>
      ))}
    </Row>
  );
}
