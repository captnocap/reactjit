import { useState } from 'react';
import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { FlowEditor } from '../gallery/components/flow-editor/FlowEditor';
import { FLOW_EDITOR_DEFAULT_THEME } from '../gallery/components/flow-editor/flowEditorTheme';
import { FLOW_EDITOR_DEMO_EDGES, FLOW_EDITOR_DEMO_NODES } from '../gallery/components/flow-editor/demoFlow';
import { useFlowEditorState } from '../gallery/components/flow-editor/useFlowEditorState';
import type { FlowEdge, FlowNode } from '../gallery/components/flow-editor/types';

function cloneNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((node) => ({ ...node }));
}

function cloneEdges(edges: FlowEdge[]): FlowEdge[] {
  return edges.map((edge) => ({ ...edge }));
}

function newActionData() {
  return {
    kind: 'action',
    role: 'ACT',
    state: 'idle',
    kv: [
      { key: 'method', value: 'GET' },
      { key: 'url', value: '/new-step' },
      { key: 'auth', value: 'none' },
      { key: 'timeout', value: '30s' },
    ],
    meta: { runs: '0', ms: '--', cost: '--', model: '--', version: 'v0', lastRun: 'never' },
  };
}

export default function FlowEditorCart() {
  const theme = FLOW_EDITOR_DEFAULT_THEME;
  const [revision, setRevision] = useState(0);
  const flow = useFlowEditorState({
    initialNodes: cloneNodes(FLOW_EDITOR_DEMO_NODES),
    initialEdges: cloneEdges(FLOW_EDITOR_DEMO_EDGES),
  });

  const resetDemo = () => {
    flow.setNodes(cloneNodes(FLOW_EDITOR_DEMO_NODES));
    flow.setEdges(cloneEdges(FLOW_EDITOR_DEMO_EDGES));
    flow.setPending(null);
    flow.setSelectedId(null);
    setRevision((value) => value + 1);
  };

  const clearAll = () => {
    flow.clearAll();
    setRevision((value) => value + 1);
  };

  const status = `${flow.nodes.length} nodes · ${flow.edges.length} wires · click a hairline pin to start wiring`;

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: theme.bg }}>
      <Row
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          gap: 10,
          alignItems: 'center',
          borderBottomWidth: 1,
          borderColor: theme.frameColor,
          backgroundColor: theme.headerBg,
        }}
      >
        <Pressable
          onPress={() => flow.addNode(undefined, newActionData())}
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: theme.radiusMd,
            backgroundColor: theme.flowColor,
          }}
        >
          <Text fontSize={11} color="theme:bg" style={{ fontWeight: 'bold' }}>+ Add action</Text>
        </Pressable>
        <Pressable
          onPress={resetDemo}
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: theme.radiusMd,
            borderWidth: 1,
            borderColor: theme.frameColor,
            backgroundColor: theme.bodyBg,
          }}
        >
          <Text fontSize={11} color={theme.textDim}>reset demo</Text>
        </Pressable>
        <Pressable
          onPress={clearAll}
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: theme.radiusMd,
            borderWidth: 1,
            borderColor: theme.frameColor,
          }}
        >
          <Text fontSize={11} color={theme.textDim}>clear</Text>
        </Pressable>
        <Text fontSize={10} color={theme.textDim} style={{ marginLeft: 6 }}>
          {status}
        </Text>
      </Row>
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, minWidth: 0 }}>
        <FlowEditor
          key={revision}
          nodes={flow.nodes}
          edges={flow.edges}
          onNodesChange={flow.setNodes}
          onEdgesChange={flow.setEdges}
          theme={theme}
        />
      </Box>
    </Col>
  );
}
