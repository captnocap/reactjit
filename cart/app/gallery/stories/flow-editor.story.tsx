import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { FlowEditor } from '../components/flow-editor/FlowEditor';
import { useFlowEditorState } from '../components/flow-editor/useFlowEditorState';
import { FLOW_EDITOR_DEFAULT_THEME } from '../components/flow-editor/flowEditorTheme';
import { FLOW_EDITOR_DEMO_EDGES, FLOW_EDITOR_DEMO_NODES } from '../components/flow-editor/demoFlow';

const SEED_NODES = FLOW_EDITOR_DEMO_NODES;
const SEED_EDGES = FLOW_EDITOR_DEMO_EDGES;

function DefaultExample() {
  return (
    <Box style={{ width: 1120, height: 720, borderWidth: 1, borderColor: FLOW_EDITOR_DEFAULT_THEME.tileBorder }}>
      <FlowEditor initialNodes={SEED_NODES} initialEdges={SEED_EDGES} />
    </Box>
  );
}

// Headless usage — drive your own toolbar around the editor's state machine.
function WithToolbarExample() {
  const flow = useFlowEditorState({ initialNodes: SEED_NODES, initialEdges: SEED_EDGES });
  const theme = FLOW_EDITOR_DEFAULT_THEME;
  return (
    <Box style={{ width: 1120, height: 720, borderWidth: 1, borderColor: theme.tileBorder }}>
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
          backgroundColor: 'theme:bg1',
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
          <Text fontSize={11} color="theme:bg1" style={{ fontWeight: 'bold' }}>+ Add node</Text>
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
    <Box style={{ width: 880, height: 440, borderWidth: 1, borderColor: theme.tileBorder }}>
      <FlowEditor
        initialNodes={[
          { id: 'a', label: 'Input', x: -260, y: -30, data: { kind: 'trigger', state: 'ok' } },
          { id: 'b', label: 'Filter', x: 0, y: -30, data: { kind: 'action', state: 'run' } },
          { id: 'c', label: 'Sink', x: 260, y: -30, data: { kind: 'end', state: 'idle' } },
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
    <Box style={{ width: 1120, height: 720, borderWidth: 1, borderColor: 'theme:paperRule' }}>
      <FlowEditor
        initialNodes={SEED_NODES}
        initialEdges={SEED_EDGES}
        allowDelete={false}
        theme={{
          bg: 'theme:bg',
          tileBg: 'theme:bg2',
          tileBgSelected: 'theme:paperInk',
          tileBorder: 'theme:paperRule',
          tileBorderSelected: 'theme:warn',
          edgeColor: 'theme:warn',
          portIn: 'theme:paperRule',
          portOut: 'theme:warn',
          gridColor: 'theme:bg2',
          gridMajorColor: 'theme:paperInk',
          gridStep: 30,
          gridMajorEvery: 4,
          textBright: 'theme:paperAlt',
          textDim: 'theme:paperInkDim',
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
    'cart/app/gallery/components/flow-editor/FlowTile.tsx',
    'cart/app/gallery/components/flow-editor/useFlowEditorState.ts',
    'cart/app/gallery/components/flow-editor/bezier.ts',
    'cart/app/gallery/components/flow-editor/demoFlow.ts',
    'cart/app/gallery/components/flow-editor/flowEditorTheme.ts',
    'cart/app/gallery/components/flow-editor/types.ts',
  ],
  stories: [
    defineGalleryStory({
      id: 'flow-editor/default',
      title: 'Flow Editor',
      source: 'cart/app/gallery/components/flow-editor/FlowEditor.tsx',
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
