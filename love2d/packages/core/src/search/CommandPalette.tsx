/**
 * CommandPalette — full-screen searchable command launcher.
 *
 * Renders as a Modal overlay. Commands can have keyboard shortcuts, groups,
 * and icons. Fuzzy-matches label + keywords.
 *
 * @example
 * // One-liner with hotkey to open
 * const [open, setOpen] = useState(false);
 * useHotkey('ctrl+k', () => setOpen(true));
 *
 * <CommandPalette
 *   visible={open}
 *   onClose={() => setOpen(false)}
 *   commands={[
 *     { id: 'new',  label: 'New File',    action: createFile,  shortcut: 'ctrl+n' },
 *     { id: 'open', label: 'Open...',     action: openDialog,  shortcut: 'ctrl+o' },
 *     { id: 'save', label: 'Save',        action: save,        shortcut: 'ctrl+s' },
 *     { id: 'quit', label: 'Quit',        action: quit,        group: 'App'       },
 *   ]}
 * />
 */

import React, { useCallback, useState, useMemo } from 'react';
import { Box, Text } from '../primitives';
import { Pressable, type PressableState } from '../Pressable';
import { Modal } from '../Modal';
import { TextInput } from '../TextInput';
import { ScrollView } from '../ScrollView';
import type { Style } from '../types';
import { useHotkey } from '../hooks';

export interface CommandDef {
  id: string;
  /** Display label — searched by default. */
  label: string;
  /** Additional searchable terms (not displayed). */
  keywords?: string[];
  /** Group / category name for visual grouping. */
  group?: string;
  /** Keyboard shortcut string (display only). */
  shortcut?: string;
  /** Leading icon slot. */
  icon?: React.ReactNode;
  /** Called when the command is selected. */
  action: () => void;
  /** Disable but still show. */
  disabled?: boolean;
}

export interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
  commands: CommandDef[];
  placeholder?: string;
  /** Max visible items before scroll. Default: 8. */
  maxVisible?: number;
  activeColor?: string;
  textColor?: string;
  mutedColor?: string;
  backgroundColor?: string;
  overlayColor?: string;
  borderColor?: string;
}

function matchCommand(cmd: CommandDef, lower: string): boolean {
  if (cmd.label.toLowerCase().includes(lower)) return true;
  if (cmd.group && cmd.group.toLowerCase().includes(lower)) return true;
  return (cmd.keywords ?? []).some((k) => k.toLowerCase().includes(lower));
}

export function CommandPalette({
  visible,
  onClose,
  commands,
  placeholder = 'Type a command...',
  maxVisible = 8,
  activeColor = '#3b82f6',
  textColor = 'rgba(255,255,255,0.9)',
  mutedColor = 'rgba(255,255,255,0.4)',
  backgroundColor = 'rgba(18,18,24,0.98)',
  overlayColor = 'rgba(0,0,0,0.6)',
  borderColor = 'rgba(255,255,255,0.1)',
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // rjit-ignore-next-line — .tslx migration candidate: command filtering
  const filtered = useMemo(() => {
    const lower = query.toLowerCase().trim();
    if (!lower) return commands;
    return commands.filter((cmd) => matchCommand(cmd, lower));
  }, [query, commands]);

  // Group filtered results
  // rjit-ignore-next-line — .tslx migration candidate: command filtering
  const grouped = useMemo(() => {
    const groups: Record<string, CommandDef[]> = {};
    for (const cmd of filtered) {
      const g = cmd.group ?? '';
      if (!groups[g]) groups[g] = [];
      groups[g].push(cmd);
    }
    return groups;
  }, [filtered]);

  // rjit-ignore-next-line — .tslx migration candidate: command filtering
  const handleClose = useCallback(() => {
    setQuery('');
    setActiveIndex(0);
    onClose();
  }, [onClose]);

  // rjit-ignore-next-line — .tslx migration candidate: command filtering
  const handleSelect = useCallback(
    (cmd: CommandDef) => {
      if (cmd.disabled) return;
      handleClose();
      cmd.action();
    },
    [handleClose],
  );

  useHotkey('arrowdown', () => {
    setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
  }, { enabled: visible });

  useHotkey('arrowup', () => {
    setActiveIndex((i) => Math.max(i - 1, 0));
  }, { enabled: visible });

  useHotkey('escape', () => {
    if (visible) handleClose();
  }, { enabled: visible });

  useHotkey('return', () => {
    if (!visible) return;
    const cmd = filtered[activeIndex];
    if (cmd) handleSelect(cmd);
  }, { enabled: visible && activeIndex >= 0 });

  const ITEM_H = 44;
  const listHeight = Math.min(maxVisible, filtered.length) * ITEM_H + 8;

  return (
    <Modal visible={visible} onRequestClose={handleClose}>
      <Box
        style={{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: overlayColor,
          paddingTop: 80,
        }}
      >
        <Box
          style={{
            width: 560,
            backgroundColor,
            borderRadius: 12,
            borderWidth: 1,
            borderColor,
            overflow: 'hidden',
          } as Style}
        >
          {/* Search input row */}
          <Box
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 14,
              paddingRight: 14,
              borderBottomWidth: 1,
              borderBottomColor: borderColor,
              gap: 10,
            }}
          >
            {/* Magnifier icon */}
            <Box style={{ width: 16, height: 16, opacity: 0.5 }}>
              <Box
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: textColor,
                }}
              />
            </Box>
            <TextInput
              autoFocus
              placeholder={placeholder}
              onLiveChange={(q) => { setQuery(q); setActiveIndex(0); }}
              liveChangeDebounce={120}
              style={{
                flexGrow: 1,
                paddingTop: 14,
                paddingBottom: 14,
                backgroundColor: 'transparent',
              }}
              textStyle={{ fontSize: 14, color: textColor }}
            />
            {/* ESC hint */}
            <Box
              style={{
                borderRadius: 4,
                borderWidth: 1,
                borderColor,
                paddingLeft: 5,
                paddingRight: 5,
                paddingTop: 2,
                paddingBottom: 2,
              }}
            >
              <Text style={{ fontSize: 10, color: mutedColor }}>esc</Text>
            </Box>
          </Box>

          {/* Results */}
          {filtered.length === 0 ? (
            <Box style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: mutedColor, fontSize: 13 }}>
                {query ? 'No commands match' : 'No commands available'}
              </Text>
            </Box>
          ) : (
            <ScrollView style={{ height: listHeight }}>
              <Box style={{ padding: 4, gap: 1 }}>
                {Object.entries(grouped).map(([groupName, cmds]) => (
                  <Box key={groupName}>
                    {groupName !== '' && (
                      <Box style={{ paddingLeft: 12, paddingTop: 8, paddingBottom: 4 }}>
                        <Text style={{ fontSize: 10, color: mutedColor, fontWeight: 'bold' }}>
                          {groupName.toUpperCase()}
                        </Text>
                      </Box>
                    )}
                    {cmds.map((cmd) => {
                      const idx = filtered.indexOf(cmd);
                      const isActive = idx === activeIndex;
                      return (
                        <Pressable
                          key={cmd.id}
                          onPress={() => handleSelect(cmd)}
                          style={({ hovered }: PressableState) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingLeft: 12,
                            paddingRight: 12,
                            paddingTop: 10,
                            paddingBottom: 10,
                            borderRadius: 6,
                            gap: 10,
                            backgroundColor: isActive
                              ? `${activeColor}22`
                              : hovered
                                ? 'rgba(255,255,255,0.04)'
                                : 'transparent',
                            borderWidth: isActive ? 1 : 0,
                            borderColor: isActive ? `${activeColor}44` : 'transparent',
                            opacity: cmd.disabled ? 0.4 : 1,
                          })}
                        >
                          {cmd.icon && (
                            <Box style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                              {cmd.icon}
                            </Box>
                          )}
                          <Text
                            style={{
                              flexGrow: 1,
                              fontSize: 13,
                              color: isActive ? activeColor : textColor,
                            }}
                          >
                            {cmd.label}
                          </Text>
                          {cmd.shortcut && (
                            <Box
                              style={{
                                borderRadius: 4,
                                borderWidth: 1,
                                borderColor: isActive ? `${activeColor}66` : borderColor,
                                paddingLeft: 6,
                                paddingRight: 6,
                                paddingTop: 2,
                                paddingBottom: 2,
                              }}
                            >
                              <Text style={{ fontSize: 10, color: isActive ? activeColor : mutedColor }}>
                                {cmd.shortcut}
                              </Text>
                            </Box>
                          )}
                        </Pressable>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </ScrollView>
          )}

          {/* Footer */}
          {filtered.length > 0 && (
            <Box
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 8,
                paddingBottom: 8,
                borderTopWidth: 1,
                borderTopColor: borderColor,
              }}
            >
              <Text style={{ fontSize: 10, color: mutedColor }}>
                {`${filtered.length} command${filtered.length !== 1 ? 's' : ''}`}
              </Text>
              <Text style={{ fontSize: 10, color: mutedColor }}>arrows to navigate</Text>
              <Text style={{ fontSize: 10, color: mutedColor }}>enter to run</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Modal>
  );
}
