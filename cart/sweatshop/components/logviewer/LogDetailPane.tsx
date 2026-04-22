
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
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

export interface LogDetailPaneProps {
  entry: LogEntry | null;
}

export function LogDetailPane(props: LogDetailPaneProps) {
  if (!props.entry) {
    return (
      <Box style={{ width: 280, padding: 12, borderLeftWidth: 1, borderColor: COLORS.border }}>
        <Text fontSize={10} color={COLORS.textDim}>Select a log entry to view details.</Text>
      </Box>
    );
  }

  const json = JSON.stringify(props.entry, null, 2);

  return (
    <Box style={{ width: 280, borderLeftWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: COLORS.border }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Log Detail</Text>
        <Pressable
          onPress={() => copyToClipboard(json)}
          style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4, backgroundColor: COLORS.grayChip }}
        >
          <Text fontSize={9} color={COLORS.blue}>Copy JSON</Text>
        </Pressable>
      </Row>

      <ScrollView style={{ flexGrow: 1, padding: 10 }}>
        <Col style={{ gap: 8 }}>
          <InfoRow label="Time" value={new Date(props.entry.timestamp).toISOString()} />
          <InfoRow label="Level" value={props.entry.level.toUpperCase()} />
          <InfoRow label="Category" value={props.entry.category} />
          <InfoRow label="Message" value={props.entry.message} />

          {props.entry.fields && (
            <Box style={{ gap: 4 }}>
              <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Fields</Text>
              {Object.entries(props.entry.fields).map(([k, v]) => (
                <InfoRow key={k} label={k} value={String(v)} />
              ))}
            </Box>
          )}

          {props.entry.stack && (
            <Box style={{ gap: 4 }}>
              <Text fontSize={10} color={COLORS.red} style={{ fontWeight: 'bold' }}>Stack Trace</Text>
              <Box style={{ padding: 8, backgroundColor: COLORS.panelRaised, borderRadius: 6 }}>
                <Text fontSize={9} color={COLORS.textDim} style={{ lineHeight: 14 }}>
                  {props.entry.stack}
                </Text>
              </Box>
            </Box>
          )}
        </Col>
      </ScrollView>
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      <Text fontSize={9} color={COLORS.textDim} style={{ minWidth: 60 }}>{label}</Text>
      <Text fontSize={9} color={COLORS.text} style={{ flexGrow: 1, flexBasis: 0 }}>{value}</Text>
    </Row>
  );
}
