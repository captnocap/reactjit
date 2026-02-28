import React, { useMemo } from 'react';
import { Box, Text, Pressable, Modal, ScrollView } from '@reactjit/core';
import { C } from '../theme';
import { choiceLabel, computeStats } from '../hooks/usePermissionLog';
import type { PermLogEntry } from '../hooks/usePermissionLog';

// ── Helpers ───────────────────────────────────────────────────────────────

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)     return 'just now';
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function choiceColor(choice: number | null): string {
  if (choice === 1) return C.approve;
  if (choice === 2) return C.allowAll;
  if (choice === 3) return C.deny;
  return C.textMuted;
}

function choiceSymbol(choice: number | null): string {
  if (choice === 1) return '✓';
  if (choice === 2) return '✓✓';
  if (choice === 3) return '✗';
  return '…';
}

// ── Static styles ─────────────────────────────────────────────────────────
const S = {
  card:    { backgroundColor: '#0e1530', borderRadius: 14, borderWidth: 1, width: 520, overflow: 'hidden' } as const,
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1 } as const,
  left:    { flexDirection: 'row', alignItems: 'center', gap: 8 } as const,
  badge:   { borderRadius: 6, borderWidth: 1, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 } as const,
  statsRow:{ flexDirection: 'row', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1 } as const,
  stat:    { flexGrow: 1, alignItems: 'center', gap: 2 } as const,
  denied:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1 } as const,
  scroll:  { maxHeight: 280 } as const,
  list:    { padding: 12, gap: 4 } as const,
  row:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 8, borderWidth: 1 } as const,
  footer:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 } as const,
};

// ── Ratio bar ─────────────────────────────────────────────────────────────

function RatioBar({ approved, denied, total }: { approved: number; denied: number; total: number }) {
  const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
  const deniedPct   = total > 0 ? Math.round((denied   / total) * 100) : 0;
  return (
    <Box style={{ flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', width: '100%', backgroundColor: C.border }}>
      <Box style={{ width: `${approvedPct}%`, backgroundColor: C.approve }} />
      <Box style={{ width: `${deniedPct}%`,   backgroundColor: C.deny }} />
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  visible:  boolean;
  entries:  PermLogEntry[];
  onClose:  () => void;
  onClear:  () => void;
}

export function PermissionLogOverlay({ visible, entries, onClose, onClear }: Props) {
  const stats = useMemo(() => computeStats(entries), [entries]);

  return (
    <Modal visible={visible} backdropDismiss onRequestClose={onClose}>
      <Box style={{ ...S.card, borderColor: C.border }}>

        {/* Header */}
        <Box style={{ ...S.header, borderColor: C.border }}>
          <Box style={S.left}>
            <Text style={{ fontSize: 15, color: C.warning }}>{'⚑'}</Text>
            <Text style={{ fontSize: 15, color: C.text, fontWeight: 'bold' }}>{'Permission Log'}</Text>
            {entries.length > 0 && (
              <Box style={{ ...S.badge, backgroundColor: C.warning + '22', borderColor: C.warning + '55' }}>
                <Text style={{ fontSize: 10, color: C.warning }}>{String(stats.total)}</Text>
              </Box>
            )}
          </Box>
          <Box style={{ ...S.badge, backgroundColor: C.bg, borderColor: C.border }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>{'F2 to close'}</Text>
          </Box>
        </Box>

        {/* Stats strip */}
        {stats.total > 0 && (
          <Box style={{ ...S.statsRow, borderColor: C.border }}>
            <Box style={S.stat}>
              <Text style={{ fontSize: 18, color: C.text, fontWeight: 'bold' }}>{String(stats.total)}</Text>
              <Text style={{ fontSize: 9, color: C.textMuted }}>{'TOTAL'}</Text>
            </Box>
            <Box style={{ width: 1, backgroundColor: C.border }} />
            <Box style={S.stat}>
              <Text style={{ fontSize: 18, color: C.approve, fontWeight: 'bold' }}>{String(stats.approved)}</Text>
              <Text style={{ fontSize: 9, color: C.textMuted }}>{'APPROVED'}</Text>
            </Box>
            <Box style={{ width: 1, backgroundColor: C.border }} />
            <Box style={S.stat}>
              <Text style={{ fontSize: 18, color: C.deny, fontWeight: 'bold' }}>{String(stats.denied)}</Text>
              <Text style={{ fontSize: 9, color: C.textMuted }}>{'DENIED'}</Text>
            </Box>
            <Box style={{ width: 1, backgroundColor: C.border }} />
            <Box style={{ flexGrow: 2, gap: 4, justifyContent: 'center' }}>
              <RatioBar approved={stats.approved} denied={stats.denied} total={stats.total} />
              <Text style={{ fontSize: 9, color: C.textMuted }}>
                {stats.total > 0
                  ? `${Math.round((stats.approved / stats.total) * 100)}% trust rate`
                  : 'no data'}
              </Text>
            </Box>
          </Box>
        )}

        {/* Most-denied tools */}
        {stats.topDenied.length > 0 && (
          <Box style={{ ...S.denied, borderColor: C.border }}>
            <Text style={{ fontSize: 9, color: C.textMuted, width: '100%' }}>{'MOST DENIED:'}</Text>
            {stats.topDenied.map(({ tool, count }) => (
              <Box key={tool} style={{ ...S.badge, backgroundColor: C.deny + '18', borderColor: C.deny + '44', flexDirection: 'row', gap: 4 }}>
                <Text style={{ fontSize: 10, color: C.deny }}>{tool}</Text>
                <Text style={{ fontSize: 10, color: C.deny + 'bb' }}>{`×${count}`}</Text>
              </Box>
            ))}
          </Box>
        )}

        {/* Entry list */}
        <ScrollView style={S.scroll}>
          <Box style={S.list}>
            {entries.length === 0 ? (
              <Box style={{ padding: 24, alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 13, color: C.textMuted }}>{'No permissions recorded yet.'}</Text>
                <Text style={{ fontSize: 11, color: C.textDim }}>{'Every request + response will appear here.'}</Text>
              </Box>
            ) : (
              entries.map(e => (
                <Box key={e.id} style={{ ...S.row, backgroundColor: C.bg, borderColor: C.border }}>
                  {/* choice badge */}
                  <Box style={{ width: 22, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: choiceColor(e.choice), fontWeight: 'bold' }}>
                      {choiceSymbol(e.choice)}
                    </Text>
                  </Box>
                  {/* tool name */}
                  <Box style={{ ...S.badge, backgroundColor: choiceColor(e.choice) + '15', borderColor: choiceColor(e.choice) + '44' }}>
                    <Text style={{ fontSize: 9, color: choiceColor(e.choice) }}>{e.action}</Text>
                  </Box>
                  {/* target */}
                  <Text style={{ flexGrow: 1, fontSize: 11, color: C.textDim }} numberOfLines={1}>
                    {e.target || e.question}
                  </Text>
                  {/* response label */}
                  <Text style={{ fontSize: 9, color: choiceColor(e.choice), flexShrink: 0 }}>
                    {choiceLabel(e.choice)}
                  </Text>
                  {/* timestamp */}
                  <Text style={{ fontSize: 9, color: C.textMuted, flexShrink: 0 }}>{relTime(e.ts)}</Text>
                </Box>
              ))
            )}
          </Box>
        </ScrollView>

        {/* Footer */}
        <Box style={{ ...S.footer, borderTopWidth: 1, borderColor: C.border }}>
          <Pressable onPress={onClear} style={{ ...S.badge, backgroundColor: C.bg, borderColor: C.deny + '55' }}>
            <Text style={{ fontSize: 12, color: C.deny }}>{'Clear log'}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }}>
            <Text style={{ fontSize: 13, color: C.text }}>{'Close'}</Text>
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );
}
