const React: any = require('react');

import { Box, Col, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { Checkpoint } from '../../checkpoint';
import { useDiffState } from './useDiffState';
import { DiffToolbar } from './DiffToolbar';
import { DiffTurnStrip } from './DiffTurnStrip';
import { DiffFileList } from './DiffFileList';
import { DiffStats } from './DiffStats';
import { DiffVirtualizer } from './DiffVirtualizer';
import { DiffVirtualRow } from './DiffVirtualRow';

interface DiffPanelProps {
  checkpoints: Checkpoint[];
  activeCheckpointId?: string;
  onSelectCheckpoint: (id: string) => void;
  onClose: () => void;
}

const ALL_TURNS_ID = '__all__';
const ROW_HEIGHT = 18;
const VIEWPORT_ESTIMATE = 600;
const OVERSCAN = 8;

export function DiffPanel(props: DiffPanelProps) {
  const state = useDiffState(props);
  const { onSelectCheckpoint, onClose } = props;

  const viewMode = props.activeCheckpointId || ALL_TURNS_ID;
  const isAllTurns = viewMode === ALL_TURNS_ID;

  const cycleThreshold = () => {
    const thresholds = [250, 500, 1000];
    const idx = thresholds.indexOf(state.virtualizeThreshold);
    state.setVirtualizeThreshold(thresholds[(idx + 1) % thresholds.length]);
  };

  const virtualRows = React.useMemo(() => {
    if (!state.parsed) return [];
    const rows: Array<
      | { type: 'hunk-header'; hunkIndex: number; key: string }
      | { type: 'hunk-summary'; hunkIndex: number; hiddenCount: number; key: string }
      | { type: 'diff-row'; hunkIndex: number; row: any; key: string }
    > = [];
    const filePath = state.selectedDiff?.path || '';
    state.parsed.hunks.forEach((hunk, hunkIndex) => {
      const collapsed = state.collapsedHunks.has(`${filePath}::${hunkIndex}`);
      rows.push({ type: 'hunk-header', hunkIndex, key: `h-${hunkIndex}` });
      if (collapsed) {
        rows.push({ type: 'hunk-summary', hunkIndex, hiddenCount: hunk.rows.length, key: `s-${hunkIndex}` });
      } else {
        hunk.rows.forEach((row, rowIndex) => {
          rows.push({ type: 'diff-row', hunkIndex, row, key: `r-${hunkIndex}-${rowIndex}` });
        });
      }
    });
    return rows;
  }, [state.parsed, state.collapsedHunks, state.selectedDiff?.path]);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <DiffToolbar
        totalAdditions={state.totalAdditions}
        totalDeletions={state.totalDeletions}
        inlineView={state.inlineView}
        onToggleInline={() => state.setInlineView(!state.inlineView)}
        wordDiffEnabled={state.wordDiffEnabled}
        onToggleWordDiff={() => state.setWordDiffEnabled(!state.wordDiffEnabled)}
        virtualizeThreshold={state.virtualizeThreshold}
        onCycleThreshold={cycleThreshold}
        onClose={onClose}
      />
      <DiffTurnStrip checkpoints={props.checkpoints} activeCheckpointId={props.activeCheckpointId} onSelectCheckpoint={onSelectCheckpoint} />
      <Row style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
        <DiffFileList diffs={state.diffs} selectedFilePath={state.selectedFilePath} onSelectFile={state.setSelectedFilePath} />
        <Col style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
          <DiffStats selectedDiff={state.selectedDiff} diffsCount={state.diffs.length} totalAdditions={state.totalAdditions} totalDeletions={state.totalDeletions} />
          {state.selectedDiff ? (
            state.inlineView ? (
              <ScrollView style={{ flexGrow: 1, padding: 10 }}>
                <Text fontSize={9} color={COLORS.textDim} style={{ whiteSpace: 'pre' }}>
                  {state.selectedDiff.patch}
                </Text>
              </ScrollView>
            ) : (
              <DiffVirtualizer
                totalRows={virtualRows.length}
                rowHeight={ROW_HEIGHT}
                threshold={state.virtualizeThreshold}
                viewportEstimate={VIEWPORT_ESTIMATE}
                overscan={OVERSCAN}
                scrollY={state.scrollY}
                onScroll={state.setScrollY}
                renderRow={(index) => (
                  <DiffVirtualRow
                    vr={virtualRows[index]}
                    parsed={state.parsed!}
                    filePath={state.selectedDiff?.path || ''}
                    collapsedHunks={state.collapsedHunks}
                    toggleHunk={state.toggleHunk}
                    wordDiffEnabled={state.wordDiffEnabled}
                  />
                )}
              />
            )
          ) : (
            <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text fontSize={10} color={COLORS.textDim}>
                {state.diffs.length === 0 ? 'No changes to display' : 'Select a file to view diff'}
              </Text>
            </Box>
          )}
        </Col>
      </Row>
    </Col>
  );
}

