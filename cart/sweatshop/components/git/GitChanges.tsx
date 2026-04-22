
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { Pill } from '../shared';
import type { GitDiff } from './useGitOps';

function statusTone(code: string): string {
  if (code === '??') return COLORS.blue;
  if (code.includes('D')) return COLORS.red;
  if (code.includes('A')) return COLORS.green;
  if (code.includes('M')) return COLORS.yellow;
  return COLORS.textMuted;
}

function statusLabel(code: string): string {
  if (code === '??') return 'new';
  if (code.includes('M')) return 'mod';
  if (code.includes('A')) return 'add';
  if (code.includes('D')) return 'del';
  if (code.includes('R')) return 'ren';
  return code;
}

function FileRow(props: {
  path: string;
  code: string;
  checked: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDiscard?: () => void;
}) {
  const tone = statusTone(props.code);
  return (
    <Pressable
      onPress={props.onSelect}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        borderRadius: 8,
        backgroundColor: props.selected ? COLORS.panelHover : COLORS.panelRaised,
      }}
    >
      <Pressable onPress={props.onToggle}>
        <Box
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            borderWidth: 1,
            borderColor: tone,
            backgroundColor: props.checked ? tone : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {props.checked ? (
            <Text fontSize={8} color={COLORS.appBg} style={{ fontWeight: 'bold' }}>✓</Text>
          ) : null}
        </Box>
      </Pressable>
      <Text fontSize={9} color={tone} style={{ fontWeight: 'bold', minWidth: 28 }}>
        {statusLabel(props.code)}
      </Text>
      <Text fontSize={10} color={props.selected ? COLORS.textBright : COLORS.text} style={{ flexShrink: 1, flexBasis: 0 }}>
        {props.path}
      </Text>
      {props.onDiscard ? (
        <Pressable onPress={props.onDiscard}>
          <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4, borderWidth: 1, borderColor: COLORS.red }}>
            <Text fontSize={8} color={COLORS.red} style={{ fontWeight: 'bold' }}>✕</Text>
          </Box>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

interface GitChangesProps {
  staged: { path: string; code: string }[];
  unstaged: { path: string; code: string }[];
  diffs: GitDiff[];
  stagedDiffs: GitDiff[];
  selectedFile: string | null;
  onToggle: (path: string, isStaged: boolean) => void;
  onSelect: (path: string) => void;
  onDiscard: (path: string, code: string) => void;
}

export function GitChanges(props: GitChangesProps) {
  const selectedDiff = props.selectedFile
    ? props.diffs.find((d) => d.path === props.selectedFile) || null
    : null;

  return (
    <Row style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
      {/* Staged */}
      <Col style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderRightWidth: 1, borderColor: COLORS.borderSoft }}>
        <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>STAGED ({props.staged.length})</Text>
        </Box>
        <ScrollView showScrollbar={true} style={{ flexGrow: 1, padding: 8 }}>
          <Col style={{ gap: 4 }}>
            {props.staged.map((f) => (
              <FileRow
                key={f.path}
                path={f.path}
                code={f.code}
                checked={true}
                selected={props.selectedFile === f.path}
                onToggle={() => props.onToggle(f.path, true)}
                onSelect={() => props.onSelect(f.path)}
                onDiscard={() => props.onDiscard(f.path, f.code)}
              />
            ))}
          </Col>
        </ScrollView>
      </Col>

      {/* Unstaged */}
      <Col style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderRightWidth: 1, borderColor: COLORS.borderSoft }}>
        <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>CHANGES ({props.unstaged.length})</Text>
        </Box>
        <ScrollView showScrollbar={true} style={{ flexGrow: 1, padding: 8 }}>
          <Col style={{ gap: 4 }}>
            {props.unstaged.map((f) => (
              <FileRow
                key={f.path}
                path={f.path}
                code={f.code}
                checked={false}
                selected={props.selectedFile === f.path}
                onToggle={() => props.onToggle(f.path, false)}
                onSelect={() => props.onSelect(f.path)}
                onDiscard={() => props.onDiscard(f.path, f.code)}
              />
            ))}
          </Col>
        </ScrollView>
      </Col>

      {/* Diff preview */}
      <Col style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
        <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>DIFF</Text>
        </Box>
        <ScrollView showScrollbar={true} style={{ flexGrow: 1, padding: 10 }}>
          {selectedDiff ? (
            <Col style={{ gap: 4 }}>
              <Row style={{ gap: 6, marginBottom: 6 }}>
                <Pill label={selectedDiff.status} color={COLORS.yellow} tiny={true} />
                <Text fontSize={10} color={COLORS.textBright}>{selectedDiff.path}</Text>
                <Pill label={'+' + selectedDiff.additions} color={COLORS.green} tiny={true} />
                <Pill label={'-' + selectedDiff.deletions} color={COLORS.red} tiny={true} />
              </Row>
              <Text fontSize={9} color={COLORS.textDim} style={{ whiteSpace: 'pre-wrap' }}>
                {selectedDiff.patch}
              </Text>
            </Col>
          ) : (
            <Text fontSize={10} color={COLORS.textDim}>Select a file to view diff</Text>
          )}
        </ScrollView>
      </Col>
    </Row>
  );
}
