import { Box, Row, Text, Pressable } from '@reactjit/runtime/primitives';
import { InspectorNode } from '../types';
import { COLORS, TREE_INDENT } from '../constants';
import { getTypeShort, getTypeColor } from '../utils';

function classifyNode(node: InspectorNode): 'static' | 'reactive' | 'hotspot' {
  const rc = node.renderCount || 0;
  if (rc <= 1) return 'static';
  if (rc > 20) return 'hotspot';
  return 'reactive';
}

function getClassBadge(node: InspectorNode): { text: string; color: string; bg: string } | null {
  const kind = classifyNode(node);
  if (kind === 'static') return null;
  if (kind === 'reactive') return { text: 'R', color: COLORS.yellow, bg: '#dcdcaa22' };
  return { text: 'H', color: COLORS.red, bg: '#f4877122' };
}

function buildPreview(node: InspectorNode): string {
  const meta: string[] = [];
  if (node.style?.flexGrow > 0) meta.push(`grow=${node.style.flexGrow}`);
  if (node.style?.flexDirection === 'row') meta.push('row');
  if (node.style?.width) meta.push(`w=${node.style.width}`);
  if (node.style?.height) meta.push(`h=${node.style.height}`);
  return meta.length ? meta.join('  ') : '';
}

export default function NodeRow({
  node,
  depth,
  selected,
  hover,
  collapsed,
  diff,
  onSelect,
  onToggleExpand,
  onHover,
  onUnhover,
}: {
  node: InspectorNode;
  depth: number;
  selected: boolean;
  hover: boolean;
  collapsed: boolean;
  diff?: 'added' | 'removed' | 'updated' | null;
  onSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onHover: (id: number) => void;
  onUnhover: () => void;
}) {
  const hasChildren = node.children.length > 0;
  const marker = hasChildren ? (collapsed ? '▸' : '▾') : ' ';
  const indent = depth * TREE_INDENT;
  const short = getTypeShort(node.type);
  const tcolor = getTypeColor(node.type);
  const cls = getClassBadge(node);
  const preview = buildPreview(node);

  const diffColor =
    diff === 'added'
      ? COLORS.green
      : diff === 'updated'
      ? COLORS.yellow
      : diff === 'removed'
      ? COLORS.red
      : null;

  return (
    <Pressable
      hoverable
      onPress={() => onSelect(node.id)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={onUnhover}
      style={{
        backgroundColor: selected
          ? COLORS.bgSelected
          : hover
          ? COLORS.bgHover
          : 'transparent',
        borderLeftWidth: selected ? 3 : diffColor ? 3 : 0,
        borderColor: selected ? COLORS.accentLight : diffColor || 'transparent',
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: indent + 10,
        paddingRight: 8,
        gap: 6,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: node.type === 'TextNode' ? 0.7 : 1,
      }}
    >
      {/* Expand/collapse caret */}
      <Pressable
        onPress={(e: any) => {
          e?.stopPropagation?.();
          onToggleExpand(node.id);
        }}
        style={{
          width: 16,
          height: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 3,
          backgroundColor: hasChildren ? COLORS.bgElevated : 'transparent',
        }}
      >
        <Text fontSize={10} color={COLORS.textDim}>{marker}</Text>
      </Pressable>

      {/* Type icon badge */}
      <Box
        style={{
          backgroundColor: `${tcolor}18`,
          borderRadius: 4,
          paddingLeft: 5,
          paddingRight: 5,
          paddingTop: 2,
          paddingBottom: 2,
          minWidth: 22,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text fontSize={9} color={tcolor} style={{ fontWeight: 'bold' }}>
          {short}
        </Text>
      </Box>

      {/* Node name */}
      <Text
        fontSize={12}
        color={selected ? COLORS.textBright : COLORS.text}
        style={{ fontWeight: node.debugName ? 'bold' : 'normal' }}
      >
        {node.debugName || node.type}
      </Text>

      {/* Render count pill */}
      {node.renderCount != null && node.renderCount > 1 ? (
        <Box
          style={{
            backgroundColor: '#f4877122',
            borderRadius: 8,
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 1,
            paddingBottom: 1,
          }}
        >
          <Text fontSize={8} color={COLORS.red}>{node.renderCount}</Text>
        </Box>
      ) : null}

      {/* Inline preview */}
      {preview ? (
        <Text fontSize={9} color={COLORS.textDim} style={{ flexGrow: 1 }} numberOfLines={1}>
          {preview}
        </Text>
      ) : (
        <Box style={{ flexGrow: 1 }} />
      )}

      {/* Classification badge */}
      {cls ? (
        <Box
          style={{
            backgroundColor: cls.bg,
            borderRadius: 8,
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 1,
            paddingBottom: 1,
          }}
        >
          <Text fontSize={8} color={cls.color}>{cls.text}</Text>
        </Box>
      ) : null}

      {/* Diff indicator */}
      {diffColor ? (
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: diffColor }} />
      ) : null}
    </Pressable>
  );
}
