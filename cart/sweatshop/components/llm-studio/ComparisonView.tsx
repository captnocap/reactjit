// =============================================================================
// ComparisonView — side-by-side last-response diff, highlighting disagreements
// =============================================================================
// Pulls the most-recent assistant message from each column and shows them
// side by side with a per-line agreement tint: lines present in every column
// render neutral; lines unique to ≤half the columns render orange. This is
// a coarse signal — good enough to spot where models diverge without a full
// LCS diff implementation.
// =============================================================================

import { Box, Col, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { LlmColumn, LlmStudioSession } from './hooks/useLlmStudioSession';

export interface ComparisonViewProps {
  session: LlmStudioSession;
}

function lastAssistantContent(col: LlmColumn): string {
  for (let i = col.messages.length - 1; i >= 0; i--) {
    const m = col.messages[i];
    if (m.role === 'assistant') return typeof m.content === 'string' ? m.content : '';
  }
  return col.streaming ? col.streamedText : '';
}

function normaliseLine(l: string): string {
  return l.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function ComparisonView(props: ComparisonViewProps) {
  const responses = props.session.columns.map((c) => ({
    id: c.id,
    label: c.config.provider + ' / ' + c.config.model,
    text: lastAssistantContent(c),
  }));

  const hasAnyContent = responses.some((r) => r.text.trim().length > 0);
  if (!hasAnyContent) {
    return (
      <Box style={{
        padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1,
        borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
      }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Comparison</Text>
        <Text fontSize={10} color={COLORS.textDim}>Nothing to compare yet — fan out a prompt to populate column responses.</Text>
      </Box>
    );
  }

  // Build an agreement map: each normalised line → how many columns emit it.
  const agreement = new Map<string, number>();
  for (const r of responses) {
    const seen = new Set<string>();
    for (const raw of r.text.split(/\r?\n/)) {
      const key = normaliseLine(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      agreement.set(key, (agreement.get(key) || 0) + 1);
    }
  }
  const total = responses.filter((r) => r.text.trim().length > 0).length;

  return (
    <Col style={{
      gap: 6, padding: 10,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Comparison</Text>
        <Text fontSize={9} color={COLORS.textDim}>
          {total} column{total === 1 ? '' : 's'} with output · lines agreed across all columns neutral, divergent lines tinted
        </Text>
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {responses.map((r) => (
          <Col key={r.id} style={{
            flexGrow: 1, flexBasis: 240, minWidth: 200,
            padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1,
            borderColor: COLORS.border, backgroundColor: COLORS.panelBg,
          }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 0.5 }}>
              {r.label}
            </Text>
            <ScrollView style={{ maxHeight: 260 }}>
              <Col style={{ gap: 1 }}>
                {r.text.split(/\r?\n/).map((line, i) => {
                  const key = normaliseLine(line);
                  const seenIn = key ? (agreement.get(key) || 0) : 0;
                  const divergent = key && total > 1 && seenIn * 2 <= total;
                  return (
                    <Text key={i} fontSize={10}
                      color={divergent ? COLORS.orange : COLORS.text}
                      style={{ fontFamily: 'monospace' }}>
                      {line || ' '}
                    </Text>
                  );
                })}
                {r.text.trim().length === 0 ? (
                  <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
                    (no response yet)
                  </Text>
                ) : null}
              </Col>
            </ScrollView>
          </Col>
        ))}
      </Row>
    </Col>
  );
}
