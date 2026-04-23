
import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { LogEntry } from './useLogStream';

function copyToClipboard(text: string): void {
  const host: any = globalThis;
  if (typeof host.__clipboard_set === 'function') {
    try { host.__clipboard_set(text); } catch {}
  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try { navigator.clipboard.writeText(text); } catch {}
  }
}

export interface LogExportProps {
  entries: LogEntry[];
}

export function LogExport(props: LogExportProps) {
  const exportAs = (format: 'jsonl' | 'ndjson' | 'pretty') => {
    let out = '';
    if (format === 'pretty') {
      out = props.entries
        .map((e) => `[${new Date(e.timestamp).toISOString()}] [${e.level.toUpperCase()}] [${e.category}] ${e.message}`)
        .join('\n');
    } else {
      out = props.entries.map((e) => JSON.stringify(e)).join('\n');
    }
    copyToClipboard(out);
  };

  return (
    <Row style={{ gap: 4 }}>
      {(['jsonl', 'ndjson', 'pretty'] as const).map((fmt) => (
        <Pressable
          key={fmt}
          onPress={() => exportAs(fmt)}
          style={{
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
            borderRadius: 4,
            backgroundColor: COLORS.grayChip,
          }}
        >
          <Text fontSize={9} color={COLORS.textDim}>{fmt}</Text>
        </Pressable>
      ))}
    </Row>
  );
}
