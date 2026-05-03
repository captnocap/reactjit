import { Box, Canvas, Pressable, Text } from '@reactjit/runtime/primitives';
import type { FlowEditorTheme } from './flowEditorTheme';
import type { FlowNode, FlowTileBodyRenderer } from './types';

export type FlowTileProps = {
  node: FlowNode;
  theme: FlowEditorTheme;
  selected: boolean;
  pendingIn: boolean;
  pendingOut: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onPortClick: (id: string, side: 'in' | 'out') => void;
  onTileClick: (id: string) => void;
  onRemove?: (id: string) => void;
  renderBody?: FlowTileBodyRenderer;
};

export function FlowTile({
  node,
  theme,
  selected,
  pendingIn,
  pendingOut,
  onMove,
  onPortClick,
  onTileClick,
  onRemove,
  renderBody,
}: FlowTileProps) {
  const PORT_R = theme.portRadius;
  const NODE_W = theme.tileWidth;
  const NODE_H = theme.tileHeight;
  const anyPending = pendingIn || pendingOut;
  return (
    <Canvas.Node
      gx={node.x}
      gy={node.y}
      gw={NODE_W}
      gh={NODE_H}
      onMove={(e: any) => onMove(node.id, e.gx, e.gy)}
    >
      <Box
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          borderRadius: theme.radiusMd,
          backgroundColor: selected ? theme.tileBgSelected : theme.tileBg,
          borderWidth: anyPending ? 2 : 1,
          borderColor: anyPending ? theme.tilePending : selected ? theme.tileBorderSelected : theme.tileBorder,
        }}
      >
        <Pressable
          onPress={() => onTileClick(node.id)}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            paddingLeft: 18,
            paddingRight: 18,
            paddingTop: 8,
            paddingBottom: 8,
            gap: 2,
          }}
        >
          {renderBody ? (
            renderBody({ node, selected, pending: anyPending })
          ) : (
            <>
              <Text fontSize={11} color={theme.textBright} style={{ fontWeight: 'bold' }}>
                {node.label}
              </Text>
              <Text fontSize={9} color={theme.textDim}>
                {node.id}
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => onPortClick(node.id, 'in')}
          style={{
            position: 'absolute',
            left: 2,
            top: NODE_H / 2 - PORT_R - 1,
            width: PORT_R * 2,
            height: PORT_R * 2,
            borderRadius: PORT_R,
            backgroundColor: pendingIn ? theme.tilePending : theme.portIn,
            borderWidth: 1,
            borderColor: pendingIn ? theme.tilePending : theme.portOut,
          }}
        />
        <Pressable
          onPress={() => onPortClick(node.id, 'out')}
          style={{
            position: 'absolute',
            left: NODE_W - PORT_R * 2 - 4,
            top: NODE_H / 2 - PORT_R - 1,
            width: PORT_R * 2,
            height: PORT_R * 2,
            borderRadius: PORT_R,
            backgroundColor: pendingOut ? theme.tilePending : theme.portOut,
            borderWidth: 1,
            borderColor: theme.deleteBg,
          }}
        />
        {onRemove ? (
          <Pressable
            onPress={() => onRemove(node.id)}
            style={{
              position: 'absolute',
              left: NODE_W - 20,
              top: 4,
              width: 16,
              height: 16,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.deleteBg,
            }}
          >
            <Text fontSize={10} color={theme.textDim}>×</Text>
          </Pressable>
        ) : null}
      </Box>
    </Canvas.Node>
  );
}
