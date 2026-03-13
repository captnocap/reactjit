/**
 * ResearchView — Multi-step deep research with 3D knowledge graph.
 *
 * Send a research query → Vesper generates sub-questions → parallel research.
 * Results visualized as a 3D node graph: each node is a finding,
 * connections show relationships. Click a node to read details.
 *
 * Layout: 3D scene (left) + detail panel (right).
 */

import React, { useState } from 'react';
import {
  Box, Text, Pressable, TextInput, ScrollView, Markdown, LoadingDots,
} from '@reactjit/core';
import { Scene, OrbitCamera, AmbientLight, DirectionalLight, Mesh } from '@reactjit/3d';
import { useChat } from '@reactjit/ai';
import { useThemeColors } from '@reactjit/theme';
import { V } from '../theme';
import type { AppSettings, ProviderConfig } from '../types';

// ── Research Node ────────────────────────────────────────

interface ResearchNode {
  id: string;
  label: string;
  content: string;
  position: [number, number, number];
  color: string;
  depth: number;  // 0 = root query, 1 = sub-question, 2 = finding
}

// ── Node colors by depth ─────────────────────────────────

const DEPTH_COLORS = [
  V.accent,        // root: violet
  V.user,          // sub-question: emerald
  V.assistant,     // finding: amber
  V.tool,          // deep finding: cyan
];

// ── 3D Knowledge Graph ───────────────────────────────────

function KnowledgeGraph({ nodes, selectedId, onSelect }: {
  nodes: ResearchNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (nodes.length === 0) {
    return (
      <Box style={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 14, color: V.textDim }}>
          Enter a topic to explore
        </Text>
      </Box>
    );
  }

  return (
    <Scene style={{ flexGrow: 1 }}>
      <OrbitCamera
        target={[0, 0, 0]}
        distance={8}
        sensitivity={0.3}
      />
      <AmbientLight intensity={0.4} color="#ffffff" />
      <DirectionalLight
        direction={[1, -1, 0.5]}
        intensity={0.8}
        color="#ffffff"
      />

      {/* Research nodes as spheres */}
      {nodes.map(node => {
        const isSelected = node.id === selectedId;
        const baseScale = 0.3 - (node.depth * 0.05);
        const scale = isSelected ? baseScale * 1.4 : baseScale;

        return (
          <Mesh
            key={node.id}
            geometry="sphere"
            position={node.position}
            scale={[scale, scale, scale]}
            color={node.color}
            opacity={isSelected ? 1.0 : 0.7}
            specular={0.6}
            fresnel={0.3}
            onClick={() => onSelect(node.id)}
          />
        );
      })}
    </Scene>
  );
}

// ── Detail Panel ─────────────────────────────────────────

function DetailPanel({ node }: { node: ResearchNode | null }) {
  const c = useThemeColors();

  if (!node) {
    return (
      <Box style={{
        width: 320,
        backgroundColor: V.bgAlt,
        borderLeftWidth: 1,
        borderLeftColor: V.border,
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 16, paddingRight: 16,
      }}>
        <Text style={{ fontSize: 12, color: V.textDim }}>
          Click a node to see details
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{
      width: 320,
      backgroundColor: V.bgAlt,
      borderLeftWidth: 1,
      borderLeftColor: V.border,
      flexDirection: 'column',
    }}>
      {/* Header */}
      <Box style={{
        width: '100%',
        paddingLeft: 14, paddingRight: 14,
        paddingTop: 12, paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: V.borderSubtle,
        gap: 4,
      }}>
        <Box style={{
          width: 8, height: 8,
          borderRadius: 9999,
          backgroundColor: node.color,
        }} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
          {node.label}
        </Text>
        <Text style={{ fontSize: 10, color: c.textDim }}>
          {`Depth ${node.depth}`}
        </Text>
      </Box>

      {/* Content */}
      <ScrollView style={{ flexGrow: 1, width: '100%' }}>
        <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 16 }}>
          <Markdown content={node.content} style={{ fontSize: 13 }} />
        </Box>
      </ScrollView>
    </Box>
  );
}

// ── ResearchView ─────────────────────────────────────────

export interface ResearchViewProps {
  provider: ProviderConfig;
  settings: AppSettings;
}

export function ResearchView({ provider, settings }: ResearchViewProps) {
  const c = useThemeColors();
  const [query, setQuery] = useState('');
  const [nodes, setNodes] = useState<ResearchNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);

  const chat = useChat({
    provider: provider.type,
    model: settings.activeModel || undefined,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    temperature: 0.3,
    maxTokens: settings.maxTokens,
    systemPrompt: 'You are a research assistant. When given a topic, break it into 3-5 key sub-questions and provide concise findings for each. Format each finding as a clear paragraph.',
  });

  const startResearch = async () => {
    if (!query.trim() || researching) return;
    setResearching(true);
    setNodes([]);
    setSelectedNodeId(null);

    // Create root node
    const rootNode: ResearchNode = {
      id: 'root',
      label: query,
      content: `Research topic: **${query}**\n\nGenerating sub-questions...`,
      position: [0, 0, 0],
      color: DEPTH_COLORS[0],
      depth: 0,
    };
    setNodes([rootNode]);

    await chat.send(`Research this topic thoroughly: ${query}`);

    // Parse response into sub-nodes (simple splitting)
    const response = chat.messages[chat.messages.length - 1];
    if (response && response.role === 'assistant') {
      const text = typeof response.content === 'string' ? response.content : '';
      // rjit-ignore-next-line
      const paragraphs = text.split('\n\n').filter(p => p.trim().length > 20);

      const subNodes: ResearchNode[] = paragraphs.slice(0, 6).map((p, i) => {
        const angle = (i / Math.min(paragraphs.length, 6)) * Math.PI * 2;
        const radius = 3;
        return {
          id: `node-${i}`,
          label: p.slice(0, 50).trim(),
          content: p.trim(),
          position: [
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * 2,
            Math.sin(angle) * radius,
          ] as [number, number, number],
          color: DEPTH_COLORS[Math.min(i % 3 + 1, 3)],
          depth: 1,
        };
      });

      setNodes([
        { ...rootNode, content: `Research topic: **${query}**\n\n${paragraphs.length} findings generated.` },
        ...subNodes,
      ]);
    }

    setResearching(false);
  };

  // rjit-ignore-next-line
  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  return (
    <Box style={{ flexGrow: 1, width: '100%', flexDirection: 'column' }}>
      {/* Search bar */}
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        gap: 8,
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 10, paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: V.border,
        backgroundColor: V.bgAlt,
      }}>
        <Box style={{ flexGrow: 1 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmit={startResearch}
            placeholder="What would you like to research?"
            style={{
              width: '100%',
              fontSize: 13,
              backgroundColor: V.bgInset,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: V.borderSubtle,
              paddingLeft: 10, paddingRight: 10,
              paddingTop: 6, paddingBottom: 6,
              color: c.text,
            }}
          />
        </Box>
        <Pressable
          onPress={startResearch}
          style={(state) => ({
            paddingLeft: 16, paddingRight: 16,
            paddingTop: 6, paddingBottom: 6,
            borderRadius: 4,
            backgroundColor: state.hovered ? V.accentHover : V.accent,
          })}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>
            {researching ? 'Researching...' : 'Research'}
          </Text>
        </Pressable>
      </Box>

      {/* Main area: 3D graph + detail panel */}
      <Box style={{ flexGrow: 1, width: '100%', flexDirection: 'row' }}>
        {/* 3D Knowledge Graph */}
        <KnowledgeGraph
          nodes={nodes}
          selectedId={selectedNodeId}
          onSelect={setSelectedNodeId}
        />

        {/* Detail panel */}
        <DetailPanel node={selectedNode} />
      </Box>

      {/* Status bar */}
      {researching && (
        <Box style={{
          width: '100%',
          paddingLeft: 16, paddingRight: 16,
          paddingTop: 6, paddingBottom: 6,
          backgroundColor: V.bgAlt,
          borderTopWidth: 1,
          borderTopColor: V.border,
        }}>
          <LoadingDots label="Researching" color={V.accent} />
        </Box>
      )}
    </Box>
  );
}
