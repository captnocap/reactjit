const React: any = require('react');
const { useState, useMemo } = React;

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Glyph, Pill } from './shared';
import type { Checkpoint, CheckpointDiff } from '../checkpoint';

interface DiffPanelProps {
  checkpoints: Checkpoint[];
  activeCheckpointId?: string;
  onSelectCheckpoint: (id: string) => void;
  onClose: () => void;
}

const ALL_TURNS_ID = '__all__';

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

function mergeCumulativeDiffs(checkpoints: Checkpoint[]): CheckpointDiff[] {
  const map = new Map<string, CheckpointDiff>();
  for (const cp of checkpoints) {
    for (const d of cp.diff) {
      const existing = map.get(d.path);
      if (existing) {
        existing.additions += d.additions;
        existing.deletions += d.deletions;
        // Keep latest patch and most severe status
        existing.patch = d.patch;
        if (d.status === 'deleted' || existing.status === 'deleted') existing.status = 'deleted';
        else if (d.status === 'added' || existing.status === 'added') existing.status = 'added';
        else existing.status = 'modified';
      } else {
        map.set(d.path, { ...d });
      }
    }
  }
  return Array.from(map.values());
}

export function DiffPanel(props: DiffPanelProps) {
  const { checkpoints, activeCheckpointId, onSelectCheckpoint, onClose } = props;

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [stackedView, setStackedView] = useState(true);

  const viewMode = activeCheckpointId || ALL_TURNS_ID;
  const isAllTurns = viewMode === ALL_TURNS_ID;

  const activeCheckpoint = isAllTurns
    ? null
    : checkpoints.find((cp) => cp.id === activeCheckpointId) || null;

  const diffs: CheckpointDiff[] = useMemo(() => {
    if (isAllTurns) return mergeCumulativeDiffs(checkpoints);
    return activeCheckpoint?.diff || [];
  }, [checkpoints, activeCheckpointId, isAllTurns]);

  const selectedDiff = diffs.find((d) => d.path === selectedFilePath) || null;

  // Auto-select first file when switching checkpoints
  useMemo(() => {
    if (diffs.length > 0 && !selectedDiff) {
      setSelectedFilePath(diffs[0].path);
    } else if (diffs.length === 0) {
      setSelectedFilePath(null);
    }
  }, [activeCheckpointId, diffs.length]);

  const totalAdditions = diffs.reduce((sum, d) => sum + d.additions, 0);
  const totalDeletions = diffs.reduce((sum, d) => sum + d.deletions, 0);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      {/* Header */}
      <Row
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          borderBottomWidth: 1,
          borderColor: COLORS.borderSoft,
        }}
      >
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Glyph icon="git" tone={COLORS.blue} backgroundColor="transparent" tiny={true} />
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            Checkpoint Diff
          </Text>
          {totalAdditions > 0 || totalDeletions > 0 ? (
            <Row style={{ gap: 6 }}>
              {totalAdditions > 0 ? (
                <Pill label={'+' + totalAdditions} color={COLORS.green} tiny={true} />
              ) : null}
              {totalDeletions > 0 ? (
                <Pill label={'-' + totalDeletions} color={COLORS.red} tiny={true} />
              ) : null}
            </Row>
          ) : null}
        </Row>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          {/* View toggle — stacked only for now */}
          <Pressable onPress={() => setStackedView(!stackedView)}>
            <Box
              style={{
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: stackedView ? COLORS.panelHover : 'transparent',
              }}
            >
              <Text fontSize={9} color={stackedView ? COLORS.blue : COLORS.textDim}>
                {stackedView ? 'Stacked' : 'Split'}
              </Text>
            </Box>
          </Pressable>
          {/* Word wrap toggle */}
          <Pressable onPress={() => setWordWrap(!wordWrap)}>
            <Box
              style={{
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: wordWrap ? COLORS.panelHover : 'transparent',
              }}
            >
              <Text fontSize={9} color={wordWrap ? COLORS.blue : COLORS.textDim}>
                Wrap
              </Text>
            </Box>
          </Pressable>
          <Pressable onPress={onClose}>
            <Text fontSize={12} color={COLORS.textDim}>
              X
            </Text>
          </Pressable>
        </Row>
      </Row>

      {/* Turn strip */}
      <ScrollView horizontal={true} style={{ maxHeight: 48 }}>
        <Row
          style={{
            alignItems: 'center',
            gap: 6,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderColor: COLORS.borderSoft,
          }}
        >
          <TurnChip
            label="All turns"
            active={isAllTurns}
            onPress={() => onSelectCheckpoint(ALL_TURNS_ID)}
          />
          {checkpoints.map((cp) => (
            <TurnChip
              key={cp.id}
              label={'Turn ' + (cp.turnIndex + 1)}
              active={cp.id === activeCheckpointId}
              onPress={() => onSelectCheckpoint(cp.id)}
            />
          ))}
        </Row>
      </ScrollView>

      {/* Main content */}
      <Row style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
        {/* File list */}
        <Col
          style={{
            width: 240,
            borderRightWidth: 1,
            borderColor: COLORS.borderSoft,
          }}
        >
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
                  onPress={() => setSelectedFilePath(d.path)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: selectedFilePath === d.path ? COLORS.panelHover : COLORS.panelRaised,
                  }}
                >
                  <Text
                    fontSize={9}
                    color={statusColor(d.status)}
                    style={{ fontWeight: 'bold', minWidth: 18 }}
                  >
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
                    {d.additions > 0 ? (
                      <Text fontSize={9} color={COLORS.green}>
                        {'+' + d.additions}
                      </Text>
                    ) : null}
                    {d.deletions > 0 ? (
                      <Text fontSize={9} color={COLORS.red}>
                        {'-' + d.deletions}
                      </Text>
                    ) : null}
                  </Row>
                </Pressable>
              ))}
              {diffs.length === 0 ? (
                <Text fontSize={10} color={COLORS.textDim} style={{ padding: 8 }}>
                  No changes
                </Text>
              ) : null}
            </Col>
          </ScrollView>
        </Col>

        {/* Diff view */}
        <Col style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
              {selectedDiff ? selectedDiff.path : 'DIFF'}
            </Text>
          </Box>
          <ScrollView style={{ flexGrow: 1, padding: 10 }}>
            {selectedDiff ? (
              <Col style={{ gap: 4 }}>
                <Row style={{ gap: 6, marginBottom: 6 }}>
                  <Pill
                    label={selectedDiff.status}
                    color={statusColor(selectedDiff.status)}
                    tiny={true}
                  />
                  <Pill
                    label={'+' + selectedDiff.additions}
                    color={COLORS.green}
                    tiny={true}
                  />
                  <Pill
                    label={'-' + selectedDiff.deletions}
                    color={COLORS.red}
                    tiny={true}
                  />
                </Row>
                <Text
                  fontSize={9}
                  color={COLORS.textDim}
                  style={{
                    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                  }}
                >
                  {selectedDiff.patch}
                </Text>
              </Col>
            ) : (
              <Text fontSize={10} color={COLORS.textDim}>
                {diffs.length === 0
                  ? 'No changes to display'
                  : 'Select a file to view diff'}
              </Text>
            )}
          </ScrollView>
        </Col>
      </Row>
    </Col>
  );
}

function TurnChip(props: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={props.onPress}>
      <Box
        style={{
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 5,
          paddingBottom: 5,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: props.active ? COLORS.blue : COLORS.border,
          backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt,
        }}
      >
        <Text
          fontSize={10}
          color={props.active ? COLORS.blue : COLORS.text}
          style={{ fontWeight: 'bold' }}
        >
          {props.label}
        </Text>
      </Box>
    </Pressable>
  );
}
