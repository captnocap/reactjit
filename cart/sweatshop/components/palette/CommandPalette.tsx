// ── Command Palette ──────────────────────────────────────────────────


import { Box, Col } from '../../../runtime/primitives';
import { COLORS } from '../../theme';
import { exec as hostExec, readFile as hostReadFile } from '../../host';

import { PaletteCommand, SettingsSectionRef, MenuSectionRef, CommandPaletteProps } from './types';
import { fuzzyScore } from './useFuzzyFilter';
import { useCommandHistory } from './useCommandHistory';
import { useCustomCommands } from './useCustomCommands';
import { PaletteInput } from './PaletteInput';
import { PaletteGroups } from './PaletteGroups';
import { FilePreview } from './FilePreview';
import { ShellOutput } from './ShellOutput';
import { PaletteFooter } from './PaletteFooter';

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

  const { record, buildRecentCommands, buildHistoryCommands } = useCommandHistory();
  const customCommands = useCustomCommands(commands);

  const isGotoFileMode = query.startsWith('>');
  const isShellMode = query.startsWith('!');
  const fileQuery = isGotoFileMode ? query.slice(1).trim() : '';
  const shellQuery = isShellMode ? query.slice(1).trim() : '';
  const activeQuery = isGotoFileMode ? fileQuery : isShellMode ? shellQuery : query.trim();
  const isEmptyQuery = !activeQuery;

  // Build base commands (everything except goto-file)
  const baseCommands = useMemo(() => {
    const result: PaletteCommand[] = [...commands, ...customCommands];

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

  // File commands
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

  const allCommands = useMemo(() => [...baseCommands, ...fileCommands], [baseCommands, fileCommands]);

  // ── Filtering (computed inline, never useMemo) ───────────────────────
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
        .map((cmd) => ({ cmd, score: fuzzyScore(activeQuery, cmd.label, 'loose') }))
        .filter((item) => item.score > 0);
      scored.sort((a, b) => b.score - a.score);
      filtered = scored.map((item) => item.cmd);
    }
  } else if (!activeQuery) {
    const recentCmds = buildRecentCommands(allCommands);
    const historyCmds = buildHistoryCommands(allCommands);
    const usedIds = new Set([...recentCmds.map((c) => c.id), ...historyCmds.map((c) => c.id)]);
    const rest = allCommands.filter((c) => !usedIds.has(c.id));
    filtered = [...recentCmds, ...historyCmds, ...rest];
  } else {
    const scored = allCommands
      .map((cmd) => ({ cmd, score: Math.max(
        fuzzyScore(activeQuery, cmd.label, 'loose'),
        cmd.category ? fuzzyScore(activeQuery, cmd.category, 'loose') * 0.6 : 0
      )}))
      .filter((item) => item.score > 0);
    scored.sort((a, b) => b.score - a.score);
    filtered = scored.map((item) => item.cmd);
  }

  const selectedCmd = filtered[selectedIndex] || null;

  // File preview
  let previewLines: string[] = [];
  if (selectedCmd && selectedCmd.id.startsWith('goto.file.')) {
    const content = hostReadFile(selectedCmd.label);
    if (content) previewLines = content.split('\n').slice(0, 10);
  }

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setShellOutput(null);
    }
  }, [open]);

  // Run
  const runCommand = useCallback(
    (cmd: PaletteCommand) => {
      if (cmd.id === 'shell.run') {
        cmd.action();
        return;
      }
      record(cmd);
      onClose();
      cmd.action();
    },
    [onClose, record]
  );

  // Keyboard
  const handleKeyDown = useCallback(
    (payload: any) => {
      const key = payload.keyCode;
      if (key === 81) {
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (key === 82) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (key === 13) {
        const cmd = filtered[selectedIndex];
        if (cmd) runCommand(cmd);
      } else if (key === 27) {
        setShellOutput(null);
        onClose();
      }
    },
    [filtered, selectedIndex, onClose, runCommand]
  );

  // Global shortcut
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

  const placeholder = isShellMode
    ? 'Type a shell command...'
    : isGotoFileMode
    ? 'Type a file name...'
    : 'Type a command...';

  const footerLabel = isShellMode
    ? 'shell mode'
    : isGotoFileMode
    ? filtered.length + ' files'
    : filtered.length + ' commands';

  const modeLabel = isShellMode ? '!shell' : isGotoFileMode ? '>file' : 'ctrl+shift+p';

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
        <PaletteInput
          open={open}
          query={query}
          onChange={setQuery}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />

        <Box style={{ flexGrow: 1, maxHeight: previewLines.length > 0 || shellOutput ? 220 : 360, overflow: 'hidden' }}>
          <PaletteGroups
            filtered={filtered}
            selectedIndex={selectedIndex}
            isGotoFileMode={isGotoFileMode}
            isShellMode={isShellMode}
            isEmptyQuery={isEmptyQuery}
            onRun={runCommand}
          />
        </Box>

        {previewLines.length > 0 && selectedCmd ? (
          <FilePreview path={selectedCmd.label} lines={previewLines} />
        ) : null}

        {shellOutput ? (
          <ShellOutput
            command={shellOutput.command}
            output={shellOutput.output}
            onClear={() => setShellOutput(null)}
          />
        ) : null}

        <PaletteFooter label={footerLabel} modeLabel={modeLabel} />
      </Col>
    </Box>
  );
}
