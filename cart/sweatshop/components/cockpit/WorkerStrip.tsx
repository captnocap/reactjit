const React: any = require('react');
import { Box, Row, ScrollView, Text, Pressable } from '../../../../runtime/primitives';
import type { Worker, WorkerStatus } from './WorkerTile';

const DOT_COLOR: Record<WorkerStatus, string> = {
  idle: '#5c6a78',
  thinking: '#79c0ff',
  tool: '#7ee787',
  stuck: '#ffb86b',
  rationalizing: '#ff6b6b',
  done: '#d2a8ff',
};

export interface WorkerStripProps {
  workers: Worker[];
  focusedId?: string | null;
  onFocus?: (id: string) => void;
}

export function WorkerStrip({ workers, focusedId, onFocus }: WorkerStripProps) {
  return (
    <Box style={{
      height: 44,
      backgroundColor: '#05090f',
      borderTopWidth: 1,
      borderColor: '#1a222c',
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    }}>
      <Text style={{ color: '#5c6a78', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>FLEET</Text>
      <Box style={{ width: 1, height: 20, backgroundColor: '#1a222c', marginHorizontal: 6 }} />
      <ScrollView horizontal style={{ flexGrow: 1 }}>
        <Row style={{ gap: 6 }}>
          {workers.map((w) => {
            const active = w.id === focusedId;
            const dot = DOT_COLOR[w.status] || DOT_COLOR.idle;
            return (
              <Pressable key={w.id} onPress={() => onFocus && onFocus(w.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? w.accent : '#0b1018',
                  borderWidth: 1,
                  borderColor: active ? w.accent : '#1f2630',
                }}>
                <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
                <Text style={{ color: active ? '#05090f' : '#e6edf3', fontSize: 11, fontWeight: 700 }}>{w.name}</Text>
                <Text style={{ color: active ? '#05090f' : '#6b7684', fontSize: 10 }}>· {w.status}</Text>
              </Pressable>
            );
          })}
        </Row>
      </ScrollView>
      <Box style={{ width: 1, height: 20, backgroundColor: '#1a222c', marginHorizontal: 6 }} />
      <Text style={{ color: '#7ee787', fontSize: 11, fontWeight: 700 }}>{workers.length} LIVE</Text>
    </Box>
  );
}
