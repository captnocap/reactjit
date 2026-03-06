/**
 * KeybindOverlay — F1 or ? to open. Shows all registered hotkeys.
 * Dismiss with Escape, F1, or clicking outside.
 */
import React from 'react';
import { Box, Text, Pressable, useHotkey } from '@reactjit/core';
import { C } from '../theme';

const BINDINGS: Array<{ key: string; desc: string; category: string }> = [
  // View
  { category: 'View',   key: 'F5',          desc: 'Toggle terminal / brain view' },
  { category: 'View',   key: 'F8',          desc: 'Open settings' },
  { category: 'View',   key: 'F1 / ?',      desc: 'Toggle this help overlay' },
  { category: 'View',   key: 'F3',          desc: 'Toggle search panel (Panel G)' },
  { category: 'View',   key: 'F4',          desc: 'Open commit helper' },
  { category: 'View',   key: 'F6',          desc: 'Toggle file tree (Panel F)' },
  { category: 'View',   key: 'F9',          desc: 'Toggle notepad (Panel B) — leave notes for Claude' },
  { category: 'View',   key: 'F10',         desc: 'Toggle daily log (Panel B) — work stats by day' },
  { category: 'View',   key: 'F11',         desc: 'Toggle messages (Panel G) — talk to Vesper' },
  { category: 'View',   key: 'F12',         desc: 'Toggle Game of Life (Panel C)' },
  { category: 'View',   key: 'F2',          desc: 'Permission log overlay' },
  { category: 'View',   key: 'F7',          desc: 'Toast history overlay' },
  // Navigation
  { category: 'Nav',    key: 'Tab',         desc: 'Focus next panel' },
  { category: 'Nav',    key: 'Shift+Tab',   desc: 'Focus previous panel' },
  // Canvas (terminal mode)
  { category: 'Canvas', key: 'Ctrl+C',      desc: 'Interrupt current operation' },
  { category: 'Canvas', key: 'Ctrl+Shift+D', desc: 'Clipboard dump (classified rows)' },
  { category: 'Canvas', key: 'Ctrl+Shift+G', desc: 'Clipboard dump (semantic graph)' },
  // Layouts
  { category: 'Layout', key: 'ABCD',        desc: 'Four-panel grid (status bar)' },
  { category: 'Layout', key: 'AB',          desc: 'Two-panel split' },
  { category: 'Layout', key: 'A',           desc: 'Canvas only' },
];

const CATEGORIES = ['View', 'Nav', 'Canvas', 'Layout'];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function KeybindOverlay({ visible, onClose }: Props) {
  useHotkey('escape', () => { if (visible) onClose(); });

  if (!visible) return null;

  return (
    <Box style={{
      position:        'absolute',
      top:             0,
      left:            0,
      right:           0,
      bottom:          0,
      alignItems:      'center',
      justifyContent:  'center',
      backgroundColor: '#000000bb',
    }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* Card */}
      <Box style={{
        backgroundColor: C.surface,
        borderWidth:     1,
        borderColor:     C.borderActive,
        borderRadius:    8,
        padding:         24,
        gap:             20,
        minWidth:        380,
      }}>
        {/* Title */}
        <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 9, color: C.accent }}>{'◈'}</Text>
            <Text style={{ fontSize: 13, color: C.text, fontWeight: 'bold' }}>{'KEYBINDINGS'}</Text>
          </Box>
          <Pressable onPress={onClose}>
            <Text style={{ fontSize: 11, color: C.textMuted }}>{'✕'}</Text>
          </Pressable>
        </Box>

        {/* Sections */}
        {CATEGORIES.map(cat => {
          const rows = BINDINGS.filter(b => b.category === cat);
          return (
            <Box key={cat} style={{ gap: 6 }}>
              <Text style={{ fontSize: 8, color: C.textMuted, fontWeight: 'bold', letterSpacing: 1 }}>
                {cat.toUpperCase()}
              </Text>
              {rows.map(b => (
                <Box key={b.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Box style={{
                    backgroundColor: C.bg,
                    borderWidth:     1,
                    borderColor:     C.border,
                    borderRadius:    4,
                    paddingLeft:     8,
                    paddingRight:    8,
                    paddingTop:      3,
                    paddingBottom:   3,
                    minWidth:        96,
                    alignItems:      'center',
                  }}>
                    <Text style={{ fontSize: 10, color: C.accent, fontWeight: 'bold' }}>{b.key}</Text>
                  </Box>
                  <Text style={{ fontSize: 11, color: C.textDim, flexGrow: 1 }}>{b.desc}</Text>
                </Box>
              ))}
            </Box>
          );
        })}

        {/* Footer */}
        <Text style={{ fontSize: 9, color: C.textMuted, textAlign: 'center' }}>
          {'Press F1 or Escape to close'}
        </Text>
      </Box>
    </Box>
  );
}
