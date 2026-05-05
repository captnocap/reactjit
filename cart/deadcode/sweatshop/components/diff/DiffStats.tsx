import { Box, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { Pill } from '../shared';
import type { CheckpointDiff } from '../../checkpoint';

interface DiffStatsProps {
  selectedDiff: CheckpointDiff | null;
  diffsCount: number;
  totalAdditions: number;
  totalDeletions: number;
}

function statusColor(status: string): string {
  if (status === 'added') return COLORS.green;
  if (status === 'deleted') return COLORS.red;
  return COLORS.yellow;
}

export function DiffStats(props: DiffStatsProps) {
  const { selectedDiff, diffsCount, totalAdditions, totalDeletions } = props;

  return (
    <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          {selectedDiff ? selectedDiff.path : `DIFF (${diffsCount} files)`}
        </Text>
        {selectedDiff ? (
          <Row style={{ gap: 6 }}>
            <Pill label={selectedDiff.status} color={statusColor(selectedDiff.status)} tiny={true} />
            <Pill label={'+' + selectedDiff.additions} color={COLORS.green} tiny={true} />
            <Pill label={'-' + selectedDiff.deletions} color={COLORS.red} tiny={true} />
          </Row>
        ) : totalAdditions > 0 || totalDeletions > 0 ? (
          <Row style={{ gap: 6 }}>
            {totalAdditions > 0 && (
              <Pill label={'+' + totalAdditions} color={COLORS.green} tiny={true} />
            )}
            {totalDeletions > 0 && (
              <Pill label={'-' + totalDeletions} color={COLORS.red} tiny={true} />
            )}
          </Row>
        ) : null}
      </Row>
    </Box>
  );
}
