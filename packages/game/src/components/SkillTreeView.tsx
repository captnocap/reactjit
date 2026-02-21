import React from 'react';
import { Box, Text } from '@reactjit/core';
import type { SkillTreeState } from '../systems/useSkillTree';

export interface SkillTreeViewProps {
  skills: SkillTreeState;
  onNodeClick?: (skillId: string) => void;
  nodeSize?: number;
  scale?: number;
}

export function SkillTreeView({
  skills,
  onNodeClick,
  nodeSize = 40,
  scale = 60,
}: SkillTreeViewProps) {
  const nodes: React.ReactNode[] = [];
  const lines: React.ReactNode[] = [];

  for (const [id, node] of Object.entries(skills.nodes)) {
    const pos = skills.layout[id] ?? { x: 0, y: 0 };
    const px = pos.x * scale + 120;
    const py = pos.y * scale + 40;

    // Draw prerequisite lines
    if (node.requires) {
      for (const reqId of node.requires) {
        const reqPos = skills.layout[reqId] ?? { x: 0, y: 0 };
        const rx = reqPos.x * scale + 120 + nodeSize / 2;
        const ry = reqPos.y * scale + 40 + nodeSize / 2;
        const tx = px + nodeSize / 2;
        const ty = py + nodeSize / 2;

        // Vertical line
        if (Math.abs(rx - tx) < 2) {
          lines.push(
            React.createElement(Box, {
              key: `line-${reqId}-${id}`,
              style: {
                position: 'absolute',
                left: rx - 1,
                top: Math.min(ry, ty),
                width: 2,
                height: Math.abs(ty - ry),
                backgroundColor: node.unlocked ? '#22c55e' : '#475569',
              },
            }),
          );
        } else {
          // L-shaped connector
          lines.push(
            React.createElement(Box, {
              key: `line-h-${reqId}-${id}`,
              style: {
                position: 'absolute',
                left: Math.min(rx, tx),
                top: ry - 1,
                width: Math.abs(tx - rx),
                height: 2,
                backgroundColor: node.unlocked ? '#22c55e' : '#475569',
              },
            }),
          );
          lines.push(
            React.createElement(Box, {
              key: `line-v-${reqId}-${id}`,
              style: {
                position: 'absolute',
                left: tx - 1,
                top: Math.min(ry, ty),
                width: 2,
                height: Math.abs(ty - ry),
                backgroundColor: node.unlocked ? '#22c55e' : '#475569',
              },
            }),
          );
        }
      }
    }

    const bgColor = node.unlocked
      ? '#22c55e'
      : node.available ? '#3b82f6' : '#1e293b';
    const borderColor = node.unlocked
      ? '#4ade80'
      : node.available ? '#60a5fa' : '#475569';

    nodes.push(
      React.createElement(
        Box,
        {
          key: id,
          onClick: onNodeClick ? () => onNodeClick(id) : undefined,
          style: {
            position: 'absolute',
            left: px,
            top: py,
            width: nodeSize,
            height: nodeSize,
            backgroundColor: bgColor,
            borderWidth: 2,
            borderColor,
            borderRadius: nodeSize / 2,
            justifyContent: 'center',
            alignItems: 'center',
          },
        },
        React.createElement(Text, {
          style: { fontSize: 8, color: '#f8fafc', textAlign: 'center' },
        }, id.slice(0, 5)),
        React.createElement(Text, {
          style: { fontSize: 7, color: '#cbd5e1' },
        }, `${node.cost}pt`),
      ),
    );
  }

  return React.createElement(
    Box,
    {
      style: {
        position: 'relative',
        width: 400,
        height: 300,
        backgroundColor: '#0f172a',
        borderRadius: 8,
        overflow: 'hidden',
      },
    },
    ...lines,
    ...nodes,
  );
}
