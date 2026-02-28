import React from 'react';
import { Box, Text, Pressable, Modal, ScrollView } from '@reactjit/core';
import { C } from '../theme';
import type { ToastEntry } from '../hooks/useToast';

// ── Relative-time formatter ───────────────────────────────────────────────
function relTime(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 5)    return 'just now';
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Static styles ─────────────────────────────────────────────────────────
const S = {
  card:    { backgroundColor: '#0e1530', borderRadius: 14, borderWidth: 1, width: 420, overflow: 'hidden', gap: 0 } as const,
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1 } as const,
  left:    { flexDirection: 'row', alignItems: 'center', gap: 8 } as const,
  badge:   { borderRadius: 6, borderWidth: 1, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 } as const,
  divider: { height: 1 } as const,
  scroll:  { maxHeight: 320 } as const,
  list:    { padding: 12, gap: 4 } as const,
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, borderWidth: 1 } as const,
  dot:     { width: 6, height: 6, borderRadius: 3, flexShrink: 0 } as const,
  rowText: { flexGrow: 1 } as const,
  footer:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 } as const,
};

interface Props {
  visible:      boolean;
  entries:      ToastEntry[];
  onClose:      () => void;
  onClear:      () => void;
}

export function ToastHistoryOverlay({ visible, entries, onClose, onClear }: Props) {
  return (
    <Modal visible={visible} backdropDismiss onRequestClose={onClose}>
      <Box style={{ ...S.card, borderColor: C.border }}>

        {/* Header */}
        <Box style={{ ...S.header, borderColor: C.border }}>
          <Box style={S.left}>
            <Text style={{ fontSize: 16, color: C.accent }}>{'🔔'}</Text>
            <Text style={{ fontSize: 15, color: C.text, fontWeight: 'bold' }}>{'Toast History'}</Text>
            {entries.length > 0 && (
              <Box style={{ ...S.badge, backgroundColor: C.accentDim + '22', borderColor: C.accentDim }}>
                <Text style={{ fontSize: 10, color: C.accent }}>{String(entries.length)}</Text>
              </Box>
            )}
          </Box>
          <Box style={{ ...S.badge, backgroundColor: C.bg, borderColor: C.border }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>{'F7 to close'}</Text>
          </Box>
        </Box>

        {/* Entry list */}
        <ScrollView style={S.scroll}>
          <Box style={S.list}>
            {entries.length === 0 ? (
              <Box style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: C.textMuted }}>{'No toasts yet.'}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>{'They will appear here when they fire.'}</Text>
              </Box>
            ) : (
              entries.map(e => (
                <Box key={e.id} style={{ ...S.row, backgroundColor: C.bg, borderColor: C.border }}>
                  <Box style={{ ...S.dot, backgroundColor: C.accent + '88' }} />
                  <Text style={{ ...S.rowText, fontSize: 12, color: C.text }}>{e.text}</Text>
                  <Text style={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>{relTime(e.ts)}</Text>
                </Box>
              ))
            )}
          </Box>
        </ScrollView>

        {/* Divider */}
        <Box style={{ ...S.divider, backgroundColor: C.border }} />

        {/* Footer */}
        <Box style={S.footer}>
          <Pressable onPress={onClear} style={{ ...S.badge, backgroundColor: C.bg, borderColor: C.deny + '55' }}>
            <Text style={{ fontSize: 12, color: C.deny }}>{'Clear all'}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }}>
            <Text style={{ fontSize: 13, color: C.text }}>{'Close'}</Text>
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );
}
