import { Box, Pressable, Row, Text } from '../../../runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { FlowEditor } from '../components/flow-editor/FlowEditor';
import { useFlowEditorState } from '../components/flow-editor/useFlowEditorState';
import { FLOW_EDITOR_DEFAULT_THEME } from '../components/flow-editor/flowEditorTheme';
import type { FlowNode } from '../components/flow-editor/types';

const SEED_NODES: FlowNode[] = [
  { id: 'trigger', label: 'Trigger', x: -260, y: -40 },
  { id: 'transform', label: 'Transform', x: 0, y: -40 },
  { id: 'http', label: 'HTTP Out', x: 260, y: -40 },
];
const SEED_EDGES = [
  { id: 'e1', from: 'trigger', to: 'transform' },
  { id: 'e2', from: 'transform', to: 'http' },
];

function DefaultExample() {
  return (
    <Box style={{ width: 720, height: 420, borderWidth: 1, borderColor: FLOW_EDITOR_DEFAULT_THEME.tileBorder }}>
      <FlowEditor initialNodes={SEED_NODES} initialEdges={SEED_EDGES} />
    </Box>
  );
}

// Headless usage — drive your own toolbar around the editor's state machine.
function WithToolbarExample() {
  const flow = useFlowEditorState({ initialNodes: SEED_NODES, initialEdges: SEED_EDGES });
  const theme = FLOW_EDITOR_DEFAULT_THEME;
  return (
    <Box style={{ width: 720, height: 420, borderWidth: 1, borderColor: theme.tileBorder }}>
      <Row
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          gap: 10,
          alignItems: 'center',
          borderBottomWidth: 1,
          borderColor: theme.tileBorder,
          backgroundColor: '#0b1118',
        }}
      >
        <Pressable
          onPress={() => flow.addNode()}
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: theme.radiusMd,
            backgroundColor: theme.edgeColor,
          }}
        >
          <Text fontSize={11} color="#06121f" style={{ fontWeight: 'bold' }}>+ Add node</Text>
        </Pressable>
        <Pressable
          onPress={flow.clearAll}
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: theme.radiusMd,
            borderWidth: 1,
            borderColor: theme.tileBorder,
          }}
        >
          <Text fontSize={11} color={theme.textDim}>clear</Text>
        </Pressable>
        <Text fontSize={10} color={theme.textDim}>
          {flow.nodes.length} nodes · {flow.edges.length} edges
        </Text>
      </Row>
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <FlowEditor
          nodes={flow.nodes}
          edges={flow.edges}
          onNodesChange={flow.setNodes}
          onEdgesChange={flow.setEdges}
        />
      </Box>
    </Box>
  );
}

// Custom tile body — same wiring engine, different content slot.
function CustomTileExample() {
  const theme = FLOW_EDITOR_DEFAULT_THEME;
  return (
    <Box style={{ width: 720, height: 420, borderWidth: 1, borderColor: theme.tileBorder }}>
      <FlowEditor
        initialNodes={[
          { id: 'a', label: 'Input', x: -240, y: -30, data: { kind: 'source' } },
          { id: 'b', label: 'Filter', x: 0, y: -30, data: { kind: 'op' } },
          { id: 'c', label: 'Sink', x: 240, y: -30, data: { kind: 'target' } },
        ]}
        initialEdges={[
          { id: 'e1', from: 'a', to: 'b' },
          { id: 'e2', from: 'b', to: 'c' },
        ]}
        renderTileBody={({ node }) => {
          const kind = (node.data as { kind?: string } | undefined)?.kind ?? '?';
          return (
            <>
              <Text fontSize={11} color={theme.textBright} style={{ fontWeight: 'bold' }}>
                {node.label}
              </Text>
              <Text fontSize={9} color={theme.textDim}>
                kind: {kind}
              </Text>
            </>
          );
        }}
      />
    </Box>
  );
}

// Re-skinned theme override — warm palette, denser grid, no delete button.
function CustomThemeExample() {
  return (
    <Box style={{ width: 720, height: 420, borderWidth: 1, borderColor: '#3a2418' }}>
      <FlowEditor
        initialNodes={SEED_NODES}
        initialEdges={SEED_EDGES}
        allowDelete={false}
        theme={{
          bg: '#0f0a07',
          tileBg: '#1c1410',
          tileBgSelected: '#2a1d14',
          tileBorder: '#3a2418',
          tileBorderSelected: '#f08a4a',
          edgeColor: '#f08a4a',
          portIn: '#3a2418',
          portOut: '#f08a4a',
          gridColor: '#1c1410',
          gridMajorColor: '#2a1d14',
          gridStep: 30,
          gridMajorEvery: 4,
          textBright: '#f4e2cd',
          textDim: '#a08266',
        }}
      />
    </Box>
  );
}

export const flowEditorSection = defineGallerySection({
  id: 'flow-editor',
  title: 'Flow Editor',
  group: { id: 'compositions', title: 'Compositions' },
  kind: 'top-level',
  composedOf: [
    'cart/component-gallery/components/flow-editor/FlowTile.tsx',
    'cart/component-gallery/components/flow-editor/useFlowEditorState.ts',
    'cart/component-gallery/components/flow-editor/bezier.ts',
    'cart/component-gallery/components/flow-editor/flowEditorTheme.ts',
    'cart/component-gallery/components/flow-editor/types.ts',
  ],
  stories: [
    defineGalleryStory({
      id: 'flow-editor/default',
      title: 'Flow Editor',
      source: 'cart/component-gallery/components/flow-editor/FlowEditor.tsx',
      status: 'ready',
      tags: ['canvas', 'graph', 'flow', 'wiring', 'n8n'],
      variants: [
        { id: 'default', name: 'Default', render: () => <DefaultExample /> },
        { id: 'with-toolbar', name: 'Headless + toolbar', render: () => <WithToolbarExample /> },
        { id: 'custom-tile', name: 'Custom tile body', render: () => <CustomTileExample /> },
        { id: 'custom-theme', name: 'Custom theme', render: () => <CustomThemeExample /> },
      ],
    }),
  ],
});
