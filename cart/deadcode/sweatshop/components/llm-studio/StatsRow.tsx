// =============================================================================
// StatsRow — per-column timing + cost readout
// =============================================================================
// Four numbers: tokens/s, total tokens (in + out), time to first token,
// estimated cost in USD. Values come straight from the column's stats
// record, which is written by useFanOut from real request timestamps.
// =============================================================================

import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { ColumnStats } from './hooks/useLlmStudioSession';

export interface StatsRowProps {
  stats: ColumnStats;
  streaming: boolean;
}

function fmtMs(ms: number): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return Math.round(ms) + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}
function fmtCost(usd: number): string {
  if (!usd || usd <= 0) return '$0.0000';
  if (usd >= 0.01) return '$' + usd.toFixed(4);
  return '$' + usd.toFixed(6);
}

function Stat(props: { label: string; value: string; tone?: string }) {
  return (
    <Col style={{ gap: 0 }}>
      <Text fontSize={9}  color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{props.label}</Text>
      <Text fontSize={11} color={props.tone || COLORS.textBright} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{props.value}</Text>
    </Col>
  );
}

export function StatsRow(props: StatsRowProps) {
  const { stats, streaming } = props;
  const total = stats.tokensIn + stats.tokensOut;
  return (
    <Row style={{
      gap: 10, padding: 6, flexWrap: 'wrap',
      borderRadius: TOKENS.radiusSm, borderWidth: 1,
      borderColor: streaming ? COLORS.blue : COLORS.border,
      backgroundColor: COLORS.panelAlt,
    }}>
      <Stat label="tok/s" value={stats.tokensPerSec > 0 ? stats.tokensPerSec.toFixed(1) : '—'} tone={streaming ? COLORS.blue : undefined} />
      <Stat label="total" value={total > 0 ? (stats.tokensIn + '+' + stats.tokensOut) : '—'} />
      <Stat label="ttft"  value={fmtMs(stats.ttftMs)} tone={stats.ttftMs > 0 && stats.ttftMs < 500 ? COLORS.green : undefined} />
      <Stat label="elapsed" value={fmtMs(stats.elapsedMs)} />
      <Stat label="cost est" value={fmtCost(stats.costEstUsd)} tone={COLORS.textDim} />
      <Box style={{ flexGrow: 1 }} />
      {streaming ? (
        <Text fontSize={9} color={COLORS.blue} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>● live</Text>
      ) : null}
    </Row>
  );
}
