// =============================================================================
// TreeRow — one node in the tree view
// =============================================================================
// Renders tag name, key, child count, render-count badge, and a handler
// indicator. Selected rows highlight with the theme accent; hover rows get
// a subtle raised background. depth drives indentation; childCount lets the
// row show a disclosure affordance.
// =============================================================================

const React: any = require('react');

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../../cart/sweatshop/theme';
import type { GraphNode } from './useNodeGraph';

interface TreeRowProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (id: number) => void;
}

const INDENT_PX = 14;

export function TreeRow(props: TreeRowProps) {
  const { node, selected } = props;
  const indent = node.depth * INDENT_PX;
  const borderTone = selected ? COLORS.blue : COLORS.border;
  const bg = selected ? COLORS.panelHover : COLORS.panelBg;

  return (
    <Pressable onPress={() => props.onSelect(node.id)} style={{
      padding: 4,
      paddingLeft: 6 + indent,
      paddingRight: 8,
      borderRadius: TOKENS.radiusSm,
      borderWidth: 1,
      borderColor: borderTone,
      backgroundColor: bg,
    }}>
      <Row style={{ alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace', minWidth: 14 }}>
          {node.childCount > 0 ? '▸' : '·'}
        </Text>
        <Text fontSize={11} color={selected ? COLORS.blue : COLORS.textBright}
          style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
          {node.type}
        </Text>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          {node.propsSummary ? (
            <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
              {node.propsSummary}
            </Text>
          ) : null}
        </Col>
        {node.hasHandlers ? (
          <Text fontSize={9} color={COLORS.purple} style={{ fontWeight: 'bold' }}>ƒ</Text>
        ) : null}
        {node.childCount > 0 ? (
          <Box style={{
            paddingLeft: 4, paddingRight: 4,
            borderRadius: TOKENS.radiusSm,
            backgroundColor: COLORS.panelAlt,
          }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
              {node.childCount}
            </Text>
          </Box>
        ) : null}
        {node.renderCount > 1 ? (
          <Text fontSize={9} color={COLORS.orange} style={{ fontFamily: 'monospace' }}>
            ×{node.renderCount}
          </Text>
        ) : null}
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          #{node.id}
        </Text>
      </Row>
    </Pressable>
  );
}
