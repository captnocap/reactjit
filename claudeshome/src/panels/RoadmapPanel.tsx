import React from 'react';
import { Box, Text, ScrollView } from '@reactjit/core';
import { C } from '../theme';

interface RoadmapItem {
  feature: string;
  status: 'blocked' | 'ready' | 'wip' | 'done';
  blocker?: string;
  note: string;
}

const ROADMAP: RoadmapItem[] = [
  {
    feature: 'Ralph (idle loop)',
    status: 'done',
    note: 'Self-nagging component. Fires every 60s.',
  },
  {
    feature: 'Panel infrastructure',
    status: 'done',
    note: 'BentoLayout accepts React nodes for B-G.',
  },
  {
    feature: 'System monitor panel',
    status: 'done',
    note: 'CPU, memory, GPU, top processes.',
  },
  {
    feature: 'TODO tracker panel',
    status: 'done',
    note: 'Static TODO list with priority badges.',
  },
  {
    feature: 'Chat log persistence',
    status: 'blocked',
    blocker: 'Needs Lua: SQLite table + tick loop hook',
    note: 'Wire classifyRow output to SQLite. FTS5 search.',
  },
  {
    feature: 'Memory system',
    status: 'blocked',
    blocker: 'Needs Lua: localstore namespace + extraction hook',
    note: 'Key-value persistent memory. Insight extraction.',
  },
  {
    feature: 'Panel write RPC',
    status: 'blocked',
    blocker: 'Needs Lua: claude:panel RPC handler',
    note: 'Push JSX to panels from Claude via RPC.',
  },
  {
    feature: 'Toast notifications',
    status: 'blocked',
    blocker: 'Needs Lua: claude:toast RPC handler',
    note: 'Visual + audio feedback on task completion.',
  },
  {
    feature: 'Diff accumulator',
    status: 'ready',
    note: 'Parse diff tokens from semantic stream. Pure React.',
  },
  {
    feature: 'Git status panel',
    status: 'blocked',
    blocker: 'Needs Lua: git:status RPC',
    note: 'Show branch, status, recent commits.',
  },
];

const STATUS_ICON: Record<string, string> = {
  done: '\u2714',
  wip: '\u25B6',
  ready: '\u25CB',
  blocked: '\u2717',
};

const STATUS_COLOR: Record<string, string> = {
  done: C.approve,
  wip: C.accent,
  ready: C.text,
  blocked: C.deny,
};

export function RoadmapPanel() {
  const counts = {
    done: ROADMAP.filter(r => r.status === 'done').length,
    blocked: ROADMAP.filter(r => r.status === 'blocked').length,
    ready: ROADMAP.filter(r => r.status === 'ready').length,
  };

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
        <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'ROADMAP'}</Text>
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ fontSize: 9, color: C.approve }}>{`${counts.done} done`}</Text>
          <Text style={{ fontSize: 9, color: C.deny }}>{`${counts.blocked} blocked`}</Text>
          <Text style={{ fontSize: 9, color: C.text }}>{`${counts.ready} ready`}</Text>
        </Box>
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 8, gap: 4 }}>
          {ROADMAP.map((item, i) => (
            <Box key={i} style={{
              flexDirection: 'column',
              gap: 2,
              paddingTop: 6,
              paddingBottom: 6,
              paddingLeft: 8,
              paddingRight: 8,
              borderRadius: 4,
              backgroundColor: item.status === 'blocked' ? C.deny + '08' : 'transparent',
            }}>
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 11, color: STATUS_COLOR[item.status] }}>
                  {STATUS_ICON[item.status]}
                </Text>
                <Text style={{
                  fontSize: 11,
                  color: item.status === 'done' ? C.textDim : C.text,
                  fontWeight: item.status === 'wip' ? 'bold' : 'normal',
                  flexGrow: 1,
                }}>
                  {item.feature}
                </Text>
              </Box>
              {item.blocker && (
                <Text style={{ fontSize: 9, color: C.deny + 'aa', paddingLeft: 19 }}>
                  {item.blocker}
                </Text>
              )}
              <Text style={{ fontSize: 9, color: C.textMuted, paddingLeft: 19 }}>
                {item.note}
              </Text>
            </Box>
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
}
