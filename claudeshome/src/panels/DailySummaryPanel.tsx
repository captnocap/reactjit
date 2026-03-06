/**
 * DailySummaryPanel — shows today's work stats and recent day history.
 *
 * Wired into useDailySummary which auto-accumulates from other hooks.
 * Shows a compact card for today + scrollable history of past days.
 */
import React from 'react';
import { Box, Text, ScrollView } from '@reactjit/core';
import { C } from '../theme';
import type { DaySummary } from '../hooks/useDailySummary';

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 9, color: C.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 9, color: color ?? C.textDim, fontWeight: 'bold' }}>{String(value)}</Text>
    </Box>
  );
}

function DayCard({ day, isToday }: { day: DaySummary; isToday: boolean }) {
  const label = isToday ? 'TODAY' : day.date;
  return (
    <Box style={{
      padding: 10,
      gap: 4,
      backgroundColor: isToday ? C.surface : 'transparent',
      borderRadius: isToday ? 6 : 0,
      borderBottomWidth: isToday ? 0 : 1,
      borderColor: C.border + '33',
    }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 10, color: isToday ? C.accent : C.textDim, fontWeight: 'bold' }}>{label}</Text>
        {day.sessionCount > 0 && (
          <Text style={{ fontSize: 8, color: C.textMuted }}>{`${day.sessionCount} sessions`}</Text>
        )}
      </Box>
      <StatRow label="turns" value={day.turnsTotal} />
      <StatRow label="tokens" value={day.tokensTotal > 0 ? day.tokensTotal.toLocaleString() : '0'} />
      <StatRow label="files changed" value={day.filesChanged} />
      {(day.linesAdded > 0 || day.linesRemoved > 0) && (
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 9, color: C.textMuted }}>{'diff'}</Text>
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontSize: 9, color: C.approve }}>{`+${day.linesAdded}`}</Text>
            <Text style={{ fontSize: 9, color: C.deny }}>{`-${day.linesRemoved}`}</Text>
          </Box>
        </Box>
      )}
      {day.errorsHit > 0 && (
        <StatRow label="errors" value={day.errorsHit} color={C.deny} />
      )}
      {day.heartsLost > 0 && (
        <StatRow label="hearts lost" value={day.heartsLost} color={C.deny} />
      )}
    </Box>
  );
}

interface Props {
  today: DaySummary;
  history: DaySummary[];
  todayKey: string;
}

export function DailySummaryPanel({ today, history, todayKey }: Props) {
  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      <Box style={{
        paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 8,
        borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'DAILY LOG'}</Text>
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 8, gap: 6 }}>
          <DayCard day={today} isToday />
          {history.filter(d => d.date !== todayKey).map(day => (
            <DayCard key={day.date} day={day} isToday={false} />
          ))}
          {history.length <= 1 && (
            <Box style={{ padding: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: C.textDim }}>{'History builds over time.'}</Text>
            </Box>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
