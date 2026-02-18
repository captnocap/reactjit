import React from 'react';
import { Box, Text } from '@ilovereact/core';
import type { QuestState } from '../systems/useQuest';
import { StatusBar } from './StatusBar';

export interface QuestLogProps {
  quests: QuestState;
  width?: number;
  showCompleted?: boolean;
}

export function QuestLog({
  quests,
  width = 250,
  showCompleted = false,
}: QuestLogProps) {
  const displayQuests = showCompleted
    ? [...quests.active, ...quests.completed]
    : quests.active;

  if (displayQuests.length === 0) {
    return React.createElement(
      Box,
      {
        style: {
          width,
          backgroundColor: '#1e293b',
          borderRadius: 8,
          padding: 16,
        },
      },
      React.createElement(Text, {
        style: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8' },
      }, 'No active quests'),
    );
  }

  return React.createElement(
    Box,
    {
      style: {
        width,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        padding: 12,
        gap: 12,
      },
    },
    React.createElement(Text, {
      style: { fontSize: 14, fontWeight: 'bold', color: '#e2e8f0' },
    }, 'Quest Log'),
    ...displayQuests.map(quest =>
      React.createElement(
        Box,
        {
          key: quest.def.id,
          style: {
            backgroundColor: '#0f172a',
            borderRadius: 6,
            padding: 10,
            gap: 6,
            borderWidth: 1,
            borderColor: quest.status === 'completed' ? '#22c55e' : '#334155',
          },
        },
        React.createElement(Text, {
          style: {
            fontSize: 12,
            fontWeight: 'bold',
            color: quest.status === 'completed' ? '#22c55e' : '#f8fafc',
          },
        }, quest.def.name),
        ...quest.objectives.map((obj, i) =>
          React.createElement(
            Box,
            { key: i, style: { gap: 2 } },
            React.createElement(Text, {
              style: { fontSize: 10, color: '#94a3b8' },
            }, `${obj.description} (${obj.current}/${obj.target})`),
            React.createElement(StatusBar, {
              value: obj.current,
              max: obj.target,
              width: width - 48,
              height: 4,
              fillColor: obj.current >= obj.target ? '#22c55e' : '#3b82f6',
            }),
          ),
        ),
      ),
    ),
  );
}
