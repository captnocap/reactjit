/**
 * DiagnosticsPanel — self-diagnostics for the Claude workspace session.
 *
 * Tracks time spent in each state, mode transition history, permission
 * requests and resolution rate. Pure React — no Lua required.
 */
import React from 'react';
import { Box, Text, ScrollView } from '@reactjit/core';
import { C } from '../theme';
import { useSessionDiagnostics, formatMs } from '../hooks/useSessionDiagnostics';

interface Props {
  status: string;
}

const STATE_COLOR: Record<string, string> = {
  idle:               C.textMuted,
  running:            C.approve,
  thinking:           C.warning,
  waiting_permission: C.deny,
  stopped:            C.textMuted,
};

const STATE_LABEL: Record<string, string> = {
  idle:               'idle',
  running:            'run',
  thinking:           'think',
  waiting_permission: 'perm',
  stopped:            'stop',
};

function StateBar({ state, ms, total }: { state: string; ms: number; total: number }) {
  const pct = total > 0 ? ms / total : 0;
  const color = STATE_COLOR[state] ?? C.textDim;
  const label = STATE_LABEL[state] ?? state;
  const barW = Math.round(pct * 80);

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Box style={{ width: 38 }}>
        <Text style={{ fontSize: 9, color, fontWeight: 'bold' }}>{label}</Text>
      </Box>
      <Box style={{ width: 80, height: 5, backgroundColor: C.border, borderRadius: 3 }}>
        <Box style={{
          width: barW,
          height: 5,
          backgroundColor: color,
          borderRadius: 3,
        }} />
      </Box>
      <Text style={{ fontSize: 9, color: C.textMuted }}>{formatMs(ms)}</Text>
      <Text style={{ fontSize: 9, color: C.textDim }}>{`${(pct * 100).toFixed(0)}%`}</Text>
    </Box>
  );
}

function MiniTimeline({ history }: { history: Array<{ state: string; durationMs: number }> }) {
  if (history.length === 0) return null;
  const last = history.slice(-20);
  const maxMs = Math.max(...last.map(s => s.durationMs), 1);

  return (
    <Box style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: 24 }}>
      {last.map((seg, i) => {
        const h = Math.max(3, Math.round((seg.durationMs / maxMs) * 24));
        const color = STATE_COLOR[seg.state] ?? C.textDim;
        return (
          <Box key={i} style={{
            width: 6,
            height: h,
            backgroundColor: color + '99',
            borderRadius: 1,
          }} />
        );
      })}
    </Box>
  );
}

export function DiagnosticsPanel({ status }: Props) {
  const diag = useSessionDiagnostics(status);

  const totalMs = Object.values(diag.stateDurations).reduce((a, b) => a + b, 0)
    + (diag.uptimeMs - Object.values(diag.stateDurations).reduce((a, b) => a + b, 0));
  const resolveRate = diag.permissionCount > 0
    ? Math.round((diag.permissionResolved / diag.permissionCount) * 100)
    : 0;

  const stateEntries = Object.entries(diag.stateDurations)
    .sort((a, b) => b[1] - a[1]);

  const currentColor = STATE_COLOR[diag.currentState] ?? C.textDim;

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: C.border,
        flexShrink: 0,
      }}>
        <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'DIAGNOSTICS'}</Text>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Box style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: currentColor,
          }} />
          <Text style={{ fontSize: 9, color: currentColor }}>{diag.currentState}</Text>
        </Box>
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 12, gap: 14 }}>
          {/* Uptime */}
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>{'Session uptime'}</Text>
            <Text style={{ fontSize: 10, color: C.text }}>{formatMs(diag.uptimeMs)}</Text>
          </Box>

          {/* State breakdown */}
          {stateEntries.length > 0 && (
            <Box style={{ gap: 6 }}>
              <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: 'bold' }}>{'STATE BREAKDOWN'}</Text>
              {stateEntries.map(([state, ms]) => (
                <StateBar key={state} state={state} ms={ms} total={diag.uptimeMs} />
              ))}
            </Box>
          )}

          {/* Permission stats */}
          <Box style={{ gap: 4 }}>
            <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: 'bold' }}>{'PERMISSIONS'}</Text>
            <Box style={{ flexDirection: 'row', gap: 20 }}>
              <Box style={{ gap: 2 }}>
                <Text style={{ fontSize: 9, color: C.textDim }}>{'requested'}</Text>
                <Text style={{ fontSize: 16, color: C.deny, fontWeight: 'bold' }}>
                  {String(diag.permissionCount)}
                </Text>
              </Box>
              <Box style={{ gap: 2 }}>
                <Text style={{ fontSize: 9, color: C.textDim }}>{'resolved'}</Text>
                <Text style={{ fontSize: 16, color: C.approve, fontWeight: 'bold' }}>
                  {String(diag.permissionResolved)}
                </Text>
              </Box>
              {diag.permissionCount > 0 && (
                <Box style={{ gap: 2 }}>
                  <Text style={{ fontSize: 9, color: C.textDim }}>{'rate'}</Text>
                  <Text style={{ fontSize: 16, color: C.text, fontWeight: 'bold' }}>
                    {`${resolveRate}%`}
                  </Text>
                </Box>
              )}
            </Box>
          </Box>

          {/* Mode timeline */}
          {diag.history.length > 0 && (
            <Box style={{ gap: 6 }}>
              <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: 'bold' }}>{'MODE HISTORY'}</Text>
              <MiniTimeline history={diag.history} />
              <Text style={{ fontSize: 8, color: C.textDim }}>{`${diag.history.length} transitions`}</Text>
            </Box>
          )}

          {/* Recent history list */}
          {diag.history.length > 0 && (
            <Box style={{ gap: 3 }}>
              <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: 'bold' }}>{'RECENT'}</Text>
              {diag.history.slice(-6).reverse().map((seg, i) => (
                <Box key={i} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Box style={{
                    width: 5, height: 5, borderRadius: 3,
                    backgroundColor: STATE_COLOR[seg.state] ?? C.textDim,
                    flexShrink: 0,
                  }} />
                  <Text style={{ fontSize: 9, color: C.textDim, width: 40 }}>
                    {STATE_LABEL[seg.state] ?? seg.state}
                  </Text>
                  <Text style={{ fontSize: 9, color: C.textMuted }}>{formatMs(seg.durationMs)}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
