import React from 'react';
import { Box, Text, ScrollView, ProgressBar } from '@reactjit/core';
import { C } from '../theme';

interface TodoItem {
  id: number;
  title: string;
  section: string;
  priority: 'high' | 'medium' | 'low';
  done: boolean;
  requiresLua: boolean;
}

const TODOS: TodoItem[] = [
  { id: 1, title: 'Chat log persistence', section: 'Memory', priority: 'high', done: false, requiresLua: true },
  { id: 2, title: 'Memory system', section: 'Memory', priority: 'high', done: false, requiresLua: true },
  { id: 3, title: 'Session bookmarks', section: 'Memory', priority: 'medium', done: false, requiresLua: true },
  { id: 4, title: 'Diff awareness', section: 'Awareness', priority: 'medium', done: false, requiresLua: false },
  { id: 5, title: 'Panel content API', section: 'UI', priority: 'high', done: false, requiresLua: true },
  { id: 6, title: 'Notification system', section: 'UI', priority: 'low', done: false, requiresLua: true },
  { id: 7, title: 'Self-diagnostics', section: 'Awareness', priority: 'medium', done: false, requiresLua: false },
  { id: 8, title: 'Git integration', section: 'Awareness', priority: 'medium', done: false, requiresLua: false },
  { id: 9, title: 'Multi-agent panels', section: 'UI', priority: 'low', done: false, requiresLua: false },
  { id: 10, title: 'Inspiration feed', section: 'UI', priority: 'low', done: false, requiresLua: false },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: C.deny,
  medium: C.warning,
  low: C.textDim,
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'H',
  medium: 'M',
  low: 'L',
};

export function TodoPanel() {
  const done = TODOS.filter(t => t.done).length;
  const total = TODOS.length;
  const progress = total > 0 ? done / total : 0;

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: C.border,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'TODO'}</Text>
          <Text style={{ fontSize: 10, color: C.textDim }}>{`${done}/${total}`}</Text>
        </Box>
        <Box style={{ width: 60 }}>
          <ProgressBar value={progress} height={3} color={C.approve} trackColor={C.border} />
        </Box>
      </Box>

      {/* List */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 8, gap: 2 }}>
          {TODOS.map(item => (
            <Box key={item.id} style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingTop: 6,
              paddingBottom: 6,
              paddingLeft: 8,
              paddingRight: 8,
              borderRadius: 4,
            }}>
              {/* Status icon */}
              <Text style={{ fontSize: 11, color: item.done ? C.approve : C.textMuted }}>
                {item.done ? '\u2714' : '\u25FB'}
              </Text>

              {/* Priority badge */}
              <Box style={{
                backgroundColor: PRIORITY_COLORS[item.priority] + '22',
                borderRadius: 3,
                paddingLeft: 4,
                paddingRight: 4,
                paddingTop: 1,
                paddingBottom: 1,
              }}>
                <Text style={{ fontSize: 8, color: PRIORITY_COLORS[item.priority] }}>
                  {PRIORITY_LABELS[item.priority]}
                </Text>
              </Box>

              {/* Title */}
              <Text style={{
                fontSize: 11,
                color: item.done ? C.textMuted : C.text,
                flexGrow: 1,
              }}>
                {item.title}
              </Text>

              {/* Lua badge */}
              {item.requiresLua && (
                <Text style={{ fontSize: 8, color: C.warning + '88' }}>
                  {'LUA'}
                </Text>
              )}
            </Box>
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
}
