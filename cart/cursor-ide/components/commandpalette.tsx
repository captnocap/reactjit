// ── Command Palette ──────────────────────────────────────────────────

const React: any = require('react');
const { useCallback, useEffect, useMemo, useRef, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../runtime/primitives';
import { COLORS } from '../theme';

export type PaletteCommand = {
  id: string;
  label: string;
  category?: string;
  shortcut?: string;
  action: () => void;
};

interface SettingsSectionRef {
  id: string;
  label: string;
}

interface MenuSectionRef {
  label: string;
  items: Array<{ label: string; shortcut?: string; action?: () => void; kind?: string }>;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  commands: PaletteCommand[];
  files?: string[];
  settingsSections?: SettingsSectionRef[];
  menuSections?: MenuSectionRef[];
  onOpenFile?: (path: string) => void;
  onJumpToSettingsSection?: (sectionId: string) => void;
}

// ── Fuzzy Scoring ────────────────────────────────────────────────────
// Weights: exact > prefix > word-boundary prefix > substring > subsequence

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (!t) return 0;

  // Exact match
  if (t === q) return 10000;

  // Prefix at start of string
  if (t.startsWith(q)) return 1000 + q.length * 10;

  // Word-boundary prefix (e.g., "of" matches "Open File")
  const words = t.split(/[\s\/\-_\\.]+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(q)) {
      return 800 + q.length * 10 - i * 20;
    }
  }

  // Substring
  const subIdx = t.indexOf(q);
  if (subIdx >= 0) {
    return 600 - subIdx * 2;
  }

  // Subsequence match
  let qi = 0;
  let ti = 0;
  let gaps = 0;
  while (qi < q.length && ti < t.length) {
    if (t[ti] === q[qi]) {
      qi++;
    } else {
      gaps++;
    }
    ti++;
  }
  if (qi === q.length) {
    return Math.max(10, 400 - gaps * 10 - (ti - qi) * 2);
  }

  return 0;
}

function scoreCommand(query: string, cmd: PaletteCommand): number {
  const labelScore = fuzzyScore(query, cmd.label);
  const catScore = cmd.category ? fuzzyScore(query, cmd.category) : 0;
  return Math.max(labelScore, catScore * 0.6);
}

// ── Component ────────────────────────────────────────────────────────

export function CommandPalette({
  open,
  onClose,
  onOpen,
  commands,
  files,
  settingsSections,
  menuSections,
  onOpenFile,
  onJumpToSettingsSection,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<any>(null);

  // Build merged command list from static + dynamic sources
  const allCommands = useMemo(() => {
    const result: PaletteCommand[] = [...commands];

    // Settings section jumps
    if (settingsSections) {
      for (const section of settingsSections) {
        result.push({
          id: 'settings.jump.' + section.id,
          label: 'Open Settings: ' + section.label,
          category: 'Settings',
          action: () => {
            if (onJumpToSettingsSection) {
              onJumpToSettingsSection(section.id);
            } else {
              console.log('[palette] TODO: jump to settings section ' + section.id);
            }
          },
        });
      }
    }

    // Theme switches (stubbed — no multi-theme system yet)
    result.push({
      id: 'theme.dark',
      label: 'Switch Theme: Dark',
      category: 'Theme',
      action: () => console.log('[palette] TODO: switch to dark theme'),
    });
    result.push({
      id: 'theme.light',
      label: 'Switch Theme: Light',
      category: 'Theme',
      action: () => console.log('[palette] TODO: switch to light theme'),
    });
    result.push({
      id: 'theme.high-contrast',
      label: 'Switch Theme: High Contrast',
      category: 'Theme',
      action: () => console.log('[palette] TODO: switch to high-contrast theme'),
    });

    // Menu items (File / Edit / View / Help)
    if (menuSections) {
      for (const section of menuSections) {
        for (const item of section.items) {
          if (item.kind === 'separator' || !item.action) continue;
          result.push({
            id: 'menu.' + section.label.toLowerCase() + '.' + item.label.toLowerCase().replace(/\s+/g, '-'),
            label: item.label,
            category: section.label,
            shortcut: item.shortcut,
            action: item.action,
          });
        }
      }
    }

    // Goto file
    if (files && onOpenFile) {
      for (const file of files) {
        result.push({
          id: 'goto.file.' + file,
          label: 'Open File: ' + file,
          category: 'Go to File',
          action: () => onOpenFile(file),
        });
      }
    }

    return result;
  }, [commands, files, settingsSections, onOpenFile, onJumpToSettingsSection]);

  // Filter and sort by fuzzy score
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return allCommands;
    const scored = allCommands
      .map((cmd) => ({ cmd, score: scoreCommand(q, cmd) }))
      .filter((item) => item.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.cmd);
  }, [query, allCommands]);

  // Reset selection when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation while open (wired via TextInput onKeyDown)
  const handleKeyDown = useCallback(
    (payload: any) => {
      const key = payload.keyCode;

      if (key === 81) {
        // Down
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (key === 82) {
        // Up
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (key === 13) {
        // Enter
        const cmd = filtered[selectedIndex];
        if (cmd) {
          onClose();
          cmd.action();
        }
      } else if (key === 27) {
        // Escape
        onClose();
      }
    },
    [filtered, selectedIndex, onClose]
  );

  // Global shortcut: Ctrl+Shift+P to open
  // Note: window.addEventListener is shimmed in the native host; will fire
  // when the framework wires global keyboard events (already works in web).
  useEffect(() => {
    const handler = (e: any) => {
      const isP = e.keyCode === 112 || e.key === 'p' || e.key === 'P';
      const ctrl = e.ctrlKey || (e.mods && (e.mods & 2) !== 0);
      const shift = e.shiftKey || (e.mods && (e.mods & 1) !== 0);
      if (isP && ctrl && shift) {
        e.preventDefault?.();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);

  if (!open) return null;

  const exec = (cmd: PaletteCommand) => {
    onClose();
    cmd.action();
  };

  return (
    <Box
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        zIndex: 100,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Col
        style={{
          width: 600,
          maxHeight: 520,
          backgroundColor: COLORS.panelRaised,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          overflow: 'hidden',
        }}
      >
        {/* Input */}
        <Box style={{ padding: 12, borderBottomWidth: 1, borderColor: COLORS.border }}>
          <TextInput
            ref={inputRef}
            value={query}
            onChange={setQuery}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            style={{
              fontSize: 14,
              color: COLORS.textBright,
              backgroundColor: COLORS.panelBg,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
            }}
          />
        </Box>

        {/* Results */}
        <ScrollView style={{ flexGrow: 1, maxHeight: 380 }}>
          {filtered.length === 0 ? (
            <Box style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                No matching commands
              </Text>
            </Box>
          ) : (
            filtered.map((cmd, idx) => (
              <Pressable
                key={cmd.id}
                onPress={() => exec(cmd)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: 14,
                  paddingRight: 14,
                  paddingTop: 10,
                  paddingBottom: 10,
                  backgroundColor:
                    idx === selectedIndex
                      ? 'rgba(45,98,255,0.15)'
                      : 'transparent',
                  borderLeftWidth: 3,
                  borderLeftColor:
                    idx === selectedIndex ? COLORS.blue : 'transparent',
                }}
              >
                <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color:
                        idx === selectedIndex ? COLORS.blue : COLORS.textBright,
                      fontWeight: idx === selectedIndex ? 'bold' : 'normal',
                    }}
                  >
                    {cmd.label}
                  </Text>
                  {cmd.category ? (
                    <Text style={{ fontSize: 10, color: COLORS.textMuted }}>
                      {cmd.category}
                    </Text>
                  ) : null}
                </Col>
                {cmd.shortcut ? (
                  <Box
                    style={{
                      backgroundColor: COLORS.panelAlt,
                      borderRadius: 4,
                      paddingLeft: 6,
                      paddingRight: 6,
                      paddingTop: 2,
                      paddingBottom: 2,
                      marginLeft: 8,
                    }}
                  >
                    <Text style={{ fontSize: 9, color: COLORS.textDim }}>
                      {cmd.shortcut}
                    </Text>
                  </Box>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>

        {/* Footer */}
        <Row
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 8,
            paddingBottom: 8,
            borderTopWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelBg,
          }}
        >
          <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
            {filtered.length} commands
          </Text>
          <Row style={{ gap: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: COLORS.textDim }}>
              &uarr;&darr; to navigate
            </Text>
            <Text style={{ fontSize: 9, color: COLORS.textDim }}>
              &crarr; to run
            </Text>
            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
              ESC to close
            </Text>
          </Row>
        </Row>
      </Col>
    </Box>
  );
}
