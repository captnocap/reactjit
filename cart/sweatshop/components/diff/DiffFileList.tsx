import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { CheckpointDiff } from '../../checkpoint';

interface DiffFileListProps {
  diffs: CheckpointDiff[];
  selectedFilePath: string | null;
  onSelectFile: (path: string) => void;
}

function statusColor(status: string): string {
  if (status === 'added') return COLORS.green;
  if (status === 'deleted') return COLORS.red;
  return COLORS.yellow;
}

function statusLabel(status: string): string {
  if (status === 'added') return 'A';
  if (status === 'deleted') return 'D';
  return 'M';
}

export function DiffFileList(props: DiffFileListProps) {
  const { diffs, selectedFilePath, onSelectFile } = props;

  return (
    <Col style={{ width: 240, borderRightWidth: 1, borderColor: COLORS.borderSoft }}>
      <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          FILES ({diffs.length})
        </Text>
      </Box>
      <ScrollView style={{ flexGrow: 1, padding: 8 }}>
        <Col style={{ gap: 4 }}>
          {diffs.map((d) => (
            <Pressable
              key={d.path}
              onPress={() => onSelectFile(d.path)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: TOKENS.radiusMd,
                backgroundColor: selectedFilePath === d.path ? COLORS.panelHover : COLORS.panelRaised,
              }}
            >
              <Text fontSize={9} color={statusColor(d.status)} style={{ fontWeight: 'bold', minWidth: 18 }}>
                {statusLabel(d.status)}
              </Text>
              <Text
                fontSize={10}
                color={selectedFilePath === d.path ? COLORS.textBright : COLORS.text}
                style={{ flexShrink: 1, flexBasis: 0 }}
              >
                {d.path}
              </Text>
              <Box style={{ flexGrow: 1 }} />
              <Row style={{ gap: 4 }}>
                {d.additions > 0 && <Text fontSize={9} color={COLORS.green}>{'+' + d.additions}</Text>}
                {d.deletions > 0 && <Text fontSize={9} color={COLORS.red}>{'-' + d.deletions}</Text>}
              </Row>
            </Pressable>
          ))}
          {diffs.length === 0 && (
            <Text fontSize={10} color={COLORS.textDim} style={{ padding: 8 }}>
              No changes
            </Text>
          )}
        </Col>
      </ScrollView>
    </Col>
  );
}
