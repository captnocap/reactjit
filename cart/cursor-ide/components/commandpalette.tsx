// ── Command Palette ──────────────────────────────────────────────────

const React: any = require('react');
const { useCallback, useEffect, useMemo, useRef, useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../runtime/primitives';
import { COLORS } from '../theme';
import { exec as hostExec, readFile as hostReadFile } from '../host';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};

const RECENT_KEY = 'cursor-ide.palette.recent';
const MAX_RECENT = 10;

function loadRecent(): string[] {
  try {
    const raw = storeGet(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT);
  } catch {}
  return [];
}

function saveRecent(ids: string[]) {
  try {
    storeSet(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {}
}

function pushRecent(ids: string[], id: string): string[] {
  const next = [id, ...ids.filter((x) => x !== id)];
  return next.slice(0, MAX_RECENT);
}

const HISTORY_KEY = 'cursor-ide.palette.history';
const MAX_HISTORY = 20;

type HistoryEntry = { id: string; label: string; category?: string };

function loadHistory(): HistoryEntry[] {
  try {
    const raw = storeGet(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_HISTORY);
  } catch {}
  return [];
}

function saveHistory(history: HistoryEntry[]) {
  try {
    storeSet(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {}
}

function pushHistory(history: HistoryEntry[], cmd: PaletteCommand): HistoryEntry[] {
  const entry: HistoryEntry = { id: cmd.id, label: cmd.label, category: cmd.category };
  return [entry, ...history.filter((h) => h.id !== cmd.id)].slice(0, MAX_HISTORY);
}

const KEYBINDINGS_KEY = 'cursor-ide.palette.keybindings';

function loadKeybindings(): Array<{ name: string; command: string }> {
  try {
    const raw = storeGet(KEYBINDINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

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

// ── Grouping ─────────────────────────────────────────────────────────

type GroupedCategory = { category: string; items: PaletteCommand[] };

function groupByCategory(cmds: PaletteCommand[]): GroupedCategory[] {
  const map = new Map<string, PaletteCommand[]>();
  for (const cmd of cmds) {
    const cat = cmd.category || 'Other';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(cmd);
  }

  const order = [
    'Recent',
    'History',
    'Navigation',
    'File',
    'Edit',
    'View',
    'Help',
    'Settings',
    'Theme',
    'Workspace',
    'Agent',
    'Plugins',
    'Custom',
    'Go to File',
    'Files',
    'Shell',
    'Other',
  ];

  const result: GroupedCategory[] = [];
  for (const cat of order) {
    if (map.has(cat)) {
      result.push({ category: cat, items: map.get(cat)! });
      map.delete(cat);
    }
  }
  for (const [cat, items] of map) {
    result.push({ category: cat, items });
  }
  return result;
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
  const [shellOutput, setShellOutput] = useState<{ command: string; output: string } | null>(null);
  const inputRef = useRef<any>(null);
  const recentIdsRef = useRef<string[]>(loadRecent());
  const historyRef = useRef<HistoryEntry[]>(loadHistory());

  const isGotoFileMode = query.startsWith('>');
  const isShellMode = query.startsWith('!');
  const fileQuery = isGotoFileMode ? query.slice(1).trim() : '';
  const shellQuery = isShellMode ? query.slice(1).trim() : '';
  const activeQuery = isGotoFileMode ? fileQuery : isShellMode ? shellQuery : query.trim();

  // Custom user commands from Settings > Keybindings
  const customBindings = loadKeybindings();
  const customCommands: PaletteCommand[] = customBindings.map((b, i) => ({
    id: 'custom.' + i + '.' + b.name,
    label: b.name,
    category: 'Custom',
    action: () => {
      const out = hostExec(b.command);
      setShellOutput({ command: b.command, output: out.slice(0, 800) });
    },
  }));

  // Base commands (everything except goto-file)
  const baseCommands = useMemo(() => {
    const result: PaletteCommand[] = [...commands, ...customCommands];

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

    // Theme switches (stubbed)
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

    return result;
  }, [commands, customCommands, settingsSections, menuSections, onJumpToSettingsSection]);

  // File commands (for goto-file mode and normal mode)
  const fileCommands = useMemo(() => {
    const result: PaletteCommand[] = [];
    if (files && onOpenFile) {
      for (const file of files) {
        result.push({
          id: 'goto.file.' + file,
          label: file,
          category: 'Go to File',
          action: () => onOpenFile(file),
        });
      }
    }
    return result;
  }, [files, onOpenFile]);

  // All commands (base + file) for normal mode
  const allCommands = useMemo(() => {
    return [...baseCommands, ...fileCommands];
  }, [baseCommands, fileCommands]);

  // Filtered selectable items — computed inline so query changes always flow through
  let filtered: PaletteCommand[];
  if (isShellMode) {
    if (!shellQuery) {
      filtered = [];
    } else {
      filtered = [{
        id: 'shell.run',
        label: 'Run: ' + shellQuery,
        category: 'Shell',
        action: () => {
          const out = hostExec(shellQuery);
          setShellOutput({ command: shellQuery, output: out.slice(0, 800) });
        },
      }];
    }
  } else if (isGotoFileMode) {
    if (!activeQuery) {
      filtered = fileCommands;
    } else {
      const scored = fileCommands
        .map((cmd) => ({ cmd, score: fuzzyScore(activeQuery, cmd.label) }))
        .filter((item) => item.score > 0);
      scored.sort((a, b) => b.score - a.score);
      filtered = scored.map((item) => item.cmd);
    }
  } else if (!activeQuery) {
    // Empty query: recent items first, then history, then rest
    const recentSet = new Set(recentIdsRef.current);
    const recent: PaletteCommand[] = [];
    const rest: PaletteCommand[] = [];
    for (const cmd of allCommands) {
      if (recentSet.has(cmd.id)) recent.push(cmd);
      else rest.push(cmd);
    }
    const orderMap = new Map(recentIdsRef.current.map((id, i) => [id, i]));
    recent.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    const historyEntries = historyRef.current;
    const recentIds = new Set(recentIdsRef.current);
    const historyCommands: PaletteCommand[] = [];
    for (const entry of historyEntries) {
      if (recentIds.has(entry.id)) continue;
      const live = allCommands.find((c) => c.id === entry.id);
      if (live) {
        historyCommands.push({ ...live, category: 'History' });
      } else {
        historyCommands.push({
          id: 'history.' + entry.id,
          label: entry.label,
          category: 'History',
          action: () => console.log('[palette] History command no longer available: ' + entry.label),
        });
      }
    }

    filtered = [
      ...recent.map((cmd) => ({ ...cmd, category: 'Recent' })),
      ...historyCommands,
      ...rest,
    ];
  } else {
    const scored = allCommands
      .map((cmd) => ({ cmd, score: scoreCommand(activeQuery, cmd) }))
      .filter((item) => item.score > 0);
    scored.sort((a, b) => b.score - a.score);
    filtered = scored.map((item) => item.cmd);
  }

  // Group for display
  const grouped = groupByCategory(filtered);

  // Selected command
  const selectedCmd = filtered[selectedIndex] || null;

  // File preview for selected item
  let previewLines: string[] = [];
  if (selectedCmd && selectedCmd.id.startsWith('goto.file.')) {
    const content = hostReadFile(selectedCmd.label);
    if (content) previewLines = content.split('\n').slice(0, 10);
  }

  // Reset query + selection + output when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setShellOutput(null);
    }
  }, [open]);

  // Run a command (recent + history + close)
  const runCommand = useCallback(
    (cmd: PaletteCommand) => {
      if (cmd.id === 'shell.run') {
        cmd.action();
        return;
      }
      recentIdsRef.current = pushRecent(recentIdsRef.current, cmd.id);
      saveRecent(recentIdsRef.current);
      historyRef.current = pushHistory(historyRef.current, cmd);
      saveHistory(historyRef.current);
      onClose();
      cmd.action();
    },
    [onClose]
  );

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
        if (cmd) runCommand(cmd);
      } else if (key === 27) {
        // Escape
        setShellOutput(null);
        onClose();
      }
    },
    [filtered, selectedIndex, onClose, runCommand]
  );

  // Global shortcut: Ctrl+Shift+P to open
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

  const footerLabel = isShellMode
    ? 'shell mode'
    : isGotoFileMode
    ? filtered.length + ' files'
    : filtered.length + ' commands';

  const placeholder = isShellMode
    ? 'Type a shell command...'
    : isGotoFileMode
    ? 'Type a file name...'
    : 'Type a command...';

  let itemIdx = 0;

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
          maxHeight: 560,
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
            placeholder={placeholder}
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
        <ScrollView style={{ flexGrow: 1, maxHeight: previewLines.length > 0 || shellOutput ? 220 : 360 }}>
          {filtered.length === 0 ? (
            <Box style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                {isShellMode
                  ? 'Type a command to run'
                  : isGotoFileMode
                  ? 'No matching files'
                  : 'No matching commands'}
              </Text>
            </Box>
          ) : (
            grouped.map((group, groupIdx) => {
              const rows: any[] = [];
              rows.push(
                <Box
                  key={'hdr:' + group.category + ':' + groupIdx}
                  style={{
                    paddingLeft: 14,
                    paddingRight: 14,
                    paddingTop: 8,
                    paddingBottom: 4,
                    backgroundColor: 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 9, color: COLORS.textDim, fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {group.category}
                  </Text>
                </Box>
              );
              for (const cmd of group.items) {
                const idx = itemIdx;
                const isSel = idx === selectedIndex;
                itemIdx++;
                rows.push(
                  <Pressable
                    key={cmd.id}
                    onPress={() => runCommand(cmd)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingLeft: 14,
                      paddingRight: 14,
                      paddingTop: 10,
                      paddingBottom: 10,
                      backgroundColor: isSel ? 'rgba(45,98,255,0.15)' : 'transparent',
                      borderLeftWidth: 3,
                      borderLeftColor: isSel ? COLORS.blue : 'transparent',
                    }}
                  >
                    <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: isSel ? COLORS.blue : COLORS.textBright,
                          fontWeight: isSel ? 'bold' : 'normal',
                        }}
                      >
                        {cmd.label}
                      </Text>
                      {cmd.category && !isGotoFileMode && !isShellMode ? (
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
                );
              }
              return rows;
            })
          )}
        </ScrollView>

        {/* File preview */}
        {previewLines.length > 0 ? (
          <Box
            style={{
              borderTopWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.panelBg,
              padding: 10,
              maxHeight: 120,
            }}
          >
            <Text style={{ fontSize: 9, color: COLORS.textDim, marginBottom: 4 }}>
              Preview: {selectedCmd?.label}
            </Text>
            {previewLines.map((line, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 10,
                  color: COLORS.textMuted,
                  fontFamily: 'monospace',
                }}
              >
                {String(i + 1).padStart(3, ' ')}  {line.slice(0, 80)}
              </Text>
            ))}
          </Box>
        ) : null}

        {/* Shell output */}
        {shellOutput ? (
          <Box
            style={{
              borderTopWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.panelBg,
              padding: 10,
              maxHeight: 140,
            }}
          >
            <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 9, color: COLORS.textDim }}>
                Output: {shellOutput.command}
              </Text>
              <Pressable onPress={() => setShellOutput(null)}>
                <Text style={{ fontSize: 9, color: COLORS.textMuted }}>Clear</Text>
              </Pressable>
            </Row>
            {shellOutput.output.split('\n').slice(0, 12).map((line, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 10,
                  color: COLORS.textMuted,
                  fontFamily: 'monospace',
                }}
              >
                {line.slice(0, 90)}
              </Text>
            ))}
          </Box>
        ) : null}

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
            {footerLabel}
          </Text>
          <Row style={{ gap: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: COLORS.textDim }}>
              {isShellMode ? '!shell' : isGotoFileMode ? '>file' : 'ctrl+shift+p'}
            </Text>
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
