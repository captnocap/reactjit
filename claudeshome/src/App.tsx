import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Text, Pressable, Native, TextEditor, useHotkey, useLoveRPC, useLocalStore, useLuaInterval } from '@reactjit/core';
import { BentoLayout, LAYOUTS } from './layout/BentoLayout';
import { PermissionModal } from './components/PermissionModal';
import { QuestionModal } from './components/QuestionModal';
import { SettingsOverlay } from './overlays/SettingsOverlay';
import { KeybindOverlay } from './overlays/KeybindOverlay';
import { CommitHelperOverlay } from './overlays/CommitHelperOverlay';
import { Ralph } from './components/Ralph';
import { useClaude } from './hooks/useClaude';
import { ClaudeBrain } from './components/ClaudeBrain';
import { SystemPanel } from './panels/SystemPanel';
import { DebugPanel } from './panels/DebugPanel';
import { FleetPanel } from './panels/FleetPanel';
import { DiffPanel } from './panels/DiffPanel';
import { GitPanel } from './panels/GitPanel';
import { ChatHistoryPanel } from './panels/ChatHistoryPanel';
import { SearchPanel } from './panels/SearchPanel';
import { FileTreePanel } from './panels/FileTreePanel';
import { FortuneCookiePanel } from './panels/FortuneCookiePanel';
import { NotepadPanel } from './panels/NotepadPanel';
import { useHearts, HeartsDisplay } from './components/Hearts';
import { useTokenUsage } from './hooks/useTokenUsage';
import { useNotifications } from './hooks/useNotifications';
import { useToast } from './hooks/useToast';
import { ToastHistoryOverlay } from './overlays/ToastHistoryOverlay';
import { PermissionLogOverlay } from './overlays/PermissionLogOverlay';
import { usePermissionLog } from './hooks/usePermissionLog';
import { useWeather } from './hooks/useWeather';
import { useErrorGraveyard } from './hooks/useErrorGraveyard';
import { ErrorGraveyardOverlay } from './overlays/ErrorGraveyardOverlay';
import { SessionTimeline } from './components/SessionTimeline';
import { StatsStrip } from './components/StatsStrip';
import { AmbientSound } from './components/AmbientSound';
import { IdleScreen } from './components/IdleScreen';
import { CurlReceiver } from './components/CurlReceiver';
import { CpuSparkline } from './components/CpuSparkline';
import { KonamiEgg } from './components/KonamiEgg';
import { DailySummaryPanel } from './panels/DailySummaryPanel';
import { useDailySummary } from './hooks/useDailySummary';
import { C } from './theme';
import { applyTheme, ThemeName } from './themes';
import type { LayoutMode, PanelContent, SectionId } from './layout/BentoLayout';
import type { ClaudeSettings } from './overlays/SettingsOverlay';

// ── Error nagger — sends crash message to Claude, resends every 30s ──

function ErrorNagger({ error }: { error: string }) {
  const rpcSend = useLoveRPC('claude:send');
  const rpcSendRef = React.useRef(rpcSend);
  rpcSendRef.current = rpcSend;
  const sentRef = React.useRef(false);

  React.useEffect(() => {
    const msg = `[SHELL CRASH] Your code crashed the shell. Fix this error NOW:\n\n${error}\n\nThe shell will not recover until you fix the broken file. Check your last edit.`;

    const send = () => {
      rpcSendRef.current({ message: msg }).catch(() => {});
    };

    // Send immediately
    send();
    sentRef.current = true;
  }, [error]);

  // Note: Can't use useLuaInterval in error boundary component since it's a class.
  // Using manual setInterval cleanup as fallback.
  React.useEffect(() => {
    if (!error) return;
    const interval = setInterval(() => {
      rpcSendRef.current({ message: `[SHELL CRASH] Your code crashed the shell. Fix this error NOW:\n\n${error}\n\nThe shell will not recover until you fix the broken file. Check your last edit.` }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [error]);

  return null;
}

// ── Shell error boundary ──────────────────────────────────────────
// If anything in the shell (panels, status bar, layout) crashes,
// the boundary catches it and shows the error. The kernel (Claude
// session + canvas) stays alive underneath.

interface ShellState { error: string | null }

class ShellBoundary extends React.Component<{ children: React.ReactNode; onCrash?: (msg: string) => void }, ShellState> {
  state: ShellState = { error: null };
  static getDerivedStateFromError(e: any) { return { error: String(e?.message ?? e) }; }
  componentDidCatch(e: any) {
    this.props.onCrash?.(String(e?.message ?? e));
  }
  render() {
    if (this.state.error) {
      return (
        <Box style={{ flexGrow: 1, padding: 20, gap: 8, justifyContent: 'center', alignItems: 'center' }}>
          <ErrorNagger error={this.state.error} />
          <Text style={{ fontSize: 12, color: C.deny, fontWeight: 'bold' }}>{'SHELL CRASHED'}</Text>
          <Text style={{ fontSize: 10, color: C.textMuted }}>
            {this.state.error.length > 200 ? this.state.error.slice(0, 200) + '...' : this.state.error}
          </Text>
          <Text style={{ fontSize: 9, color: C.textDim }}>{'Claude is still alive. Waiting for HMR fix...'}</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

// ── Shell (everything Claude can break) ───────────────────────────

interface HeartsInfo {
  hearts: number;
  maxHearts: number;
  workProgress: number;
  totalDeaths: number;
}


interface ShellProps {
  claude:           ReturnType<typeof useClaude>;
  heartsInfo:       HeartsInfo;
  graveyard:        ReturnType<typeof useErrorGraveyard>;
  graveyardOpen:    boolean;
  setGraveyardOpen: (v: boolean) => void;
  currentTheme:     ThemeName;
  onThemeChange:    (name: ThemeName) => void;
  showToast:        (text: string, duration?: number) => void;
  toastHistory:     import('./hooks/useToast').ToastEntry[];
  clearToastHistory: () => void;
  permLog:          ReturnType<typeof usePermissionLog>;
}

function Shell({ claude, heartsInfo, graveyard, graveyardOpen, setGraveyardOpen, currentTheme, onThemeChange, showToast, toastHistory, clearToastHistory, permLog }: ShellProps) {
  const [layout, setLayout] = useState<LayoutMode>('ABCD');
  const [activeWorkers, setActiveWorkers] = useState(0);
  const onActiveCountChange = useCallback((count: number) => setActiveWorkers(count), []);

  const [searchOpen,      setSearchOpen]      = useState(false);
  const [commitOpen,      setCommitOpen]      = useState(false);
  const [fileTreeOpen,    setFileTreeOpen]    = useState(false);
  const [toastHistOpen,   setToastHistOpen]   = useState(false);
  const [permLogOpen,     setPermLogOpen]     = useState(false);
  const [notepadOpen,     setNotepadOpen]     = useState(false);
  const [dailyLogOpen,    setDailyLogOpen]    = useState(false);

  // ── Uptime counter ─────────────────────────────────────────────────
  const bootTimeRef = useRef(Date.now());
  const [uptime, setUptime] = useState('00:00:00');
  useLuaInterval(1000, () => {
    const secs = Math.floor((Date.now() - bootTimeRef.current) / 1000);
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    setUptime(`${h}:${m}:${s}`);
  });

  const [debugCanvas, setDebugCanvas] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const [editorHeight, setEditorHeight] = useState(29);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keybindOpen, setKeybindOpen] = useState(false);
  const [focusedPanel, setFocusedPanel] = useState<SectionId>('A');
  const [settings, setSettings] = useState<ClaudeSettings>({
    model: 'sonnet',
    workingDir: '/home/siah/creative/reactjit/workspace',
  });

  const tokenUsage = useTokenUsage();
  const weather    = useWeather();
  const dailySummary = useDailySummary();
  useNotifications(claude.status, showToast);

  const panelNodes = useMemo<PanelContent>(() => ({
    B: dailyLogOpen
      ? <DailySummaryPanel today={dailySummary.today} history={dailySummary.history} todayKey={dailySummary.todayKey} />
      : notepadOpen ? <NotepadPanel /> : <FortuneCookiePanel />,
    C: <SystemPanel />,
    D: <FleetPanel onActiveCountChange={onActiveCountChange} />,
    E: <GitPanel />,
    F: fileTreeOpen ? <FileTreePanel /> : <DiffPanel />,
    G: searchOpen ? <SearchPanel /> : <ChatHistoryPanel />,
  }), [onActiveCountChange, notepadOpen, fileTreeOpen, searchOpen, dailyLogOpen, dailySummary.today, dailySummary.history, dailySummary.todayKey]);

  // Auto-accumulate daily stats every 30s
  useLuaInterval(30000, () => {
    dailySummary.update({
      turns:   0, // StatsStrip handles turns separately
      tokens:  tokenUsage.tokens,
      files:   0,
      added:   0,
      removed: 0,
      errors:  graveyard.totalCrashes,
      deaths:  heartsInfo.totalDeaths,
    });
  });

  const STATUS_COLORS: Record<string, string> = {
    idle: C.textMuted,
    running: C.approve,
    thinking: C.warning,
    waiting_permission: C.deny,
    stopped: C.textMuted,
  };

  const claudePanel = (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Brain header */}
      {!debugCanvas && (
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        padding: 12,
        gap: 12,
        backgroundColor: C.bg,
        borderBottomWidth: 1,
        borderColor: C.border,
      }}>
        <ClaudeBrain status={claude.status} style={{ width: 120 }} />
        <Box style={{ flexGrow: 1, gap: 2 }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14, color: C.text, fontWeight: 'bold' }}>
              {`Vesper`}
            </Text>
            <Text style={{ fontSize: 11, color: C.textDim }}>
              {settings.model === 'opus' ? 'Opus 4.6' : settings.model === 'haiku' ? 'Haiku 4.5' : 'Sonnet 4.6'}
            </Text>
            <Box style={{
              backgroundColor: (STATUS_COLORS[claude.status] || C.textMuted) + '22',
              borderRadius: 4,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 1,
              paddingBottom: 1,
            }}>
              <Text style={{ fontSize: 9, color: STATUS_COLORS[claude.status] || C.textMuted }}>
                {claude.status}
              </Text>
            </Box>
          </Box>
          <Text style={{ fontSize: 11, color: C.textMuted }}>
            {`~/creative/reactjit/workspace`}
          </Text>
        </Box>
      </Box>
      )}

      {/* Canvas */}
      <Native
        type="ClaudeCanvas"
        sessionId="default"
        debugVisible={debugCanvas}
        style={{ flexGrow: 1 }}
      />

      {/* Idle screensaver — overlays the canvas after 30s of idle */}
      <IdleScreen status={claude.status} />
    </Box>
  );

  useHotkey('f2', () => setPermLogOpen(prev => !prev));
  useHotkey('f5', () => setDebugCanvas(prev => !prev));
  useHotkey('f7', () => setToastHistOpen(prev => !prev));
  useHotkey('f8', () => setSettingsOpen(prev => !prev));
  useHotkey('f1', () => setKeybindOpen(prev => !prev));
  useHotkey('f4', () => setCommitOpen(prev => !prev));
  useHotkey('f6', () => setFileTreeOpen(prev => !prev));
  useHotkey('f3', () => {
    setSearchOpen(prev => !prev);
    setFocusedPanel('G');
  });

  useHotkey('f9', () => {
    setNotepadOpen(prev => !prev);
    setDailyLogOpen(false);
    setFocusedPanel('B');
  });

  useHotkey('f10', () => {
    setDailyLogOpen(prev => !prev);
    setNotepadOpen(false);
    setFocusedPanel('B');
  });

  useHotkey('tab', () => {
    setFocusedPanel(prev => {
      const visible = layout.split('') as SectionId[];
      const idx = visible.indexOf(prev);
      return visible[(idx + 1) % visible.length];
    });
  });

  useHotkey('shift+tab', () => {
    setFocusedPanel(prev => {
      const visible = layout.split('') as SectionId[];
      const idx = visible.indexOf(prev);
      return visible[(idx - 1 + visible.length) % visible.length];
    });
  });

  const handleChange = useCallback((v: string) => {
    const lines = v.split('\n').length;
    const h = Math.min(290, lines * 29);
    if (h !== editorHeight) setEditorHeight(h);
  }, [editorHeight]);

  const handleSubmit = useCallback((_text: string) => {
    setEditorKey(k => k + 1);
    setEditorHeight(29);
  }, []);

  return (
    <>
      {/* Status bar */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        backgroundColor: C.bg,
        borderBottomWidth: 1,
        borderColor: C.border,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 9, color: C.accent }}>{'◈'}</Text>
            <Text style={{ fontSize: 12, color: C.textDim, fontWeight: 'bold' }}>{'VESPER'}</Text>
          </Box>
          <Text style={{ fontSize: 9, color: C.textMuted }}>{uptime}</Text>
          {!weather.loading && !weather.error && (
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: 9, color: C.textMuted }}>{'·'}</Text>
              <Text style={{ fontSize: 9, color: C.textDim }}>
                {`${weather.icon} ${weather.temp}`}
              </Text>
            </Box>
          )}
          <CpuSparkline />
          {tokenUsage.tokens > 0 && (
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 9, color: C.textDim }}>
                {tokenUsage.tokens.toLocaleString()}
                {' tok'}
              </Text>
              {tokenUsage.costUsd > 0 && (
                <Text style={{ fontSize: 9, color: C.textMuted }}>
                  {`$${tokenUsage.costUsd.toFixed(3)}`}
                </Text>
              )}
            </Box>
          )}
          {activeWorkers > 0 && (
            <Box style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingLeft: 7,
              paddingRight: 7,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: C.approve + '55',
              backgroundColor: C.approve + '11',
            }}>
              <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.approve }} />
              <Text style={{ fontSize: 9, color: C.textDim }}>{'fleet'}</Text>
              <Text style={{ fontSize: 9, color: C.approve }}>{`${activeWorkers} active`}</Text>
            </Box>
          )}
          <Pressable onPress={() => setGraveyardOpen(true)} style={{
            flexDirection:   'row',
            alignItems:      'center',
            gap:             4,
            paddingLeft:     6,
            paddingRight:    6,
            paddingTop:      2,
            paddingBottom:   2,
            borderRadius:    4,
            borderWidth:     1,
            borderColor:     graveyard.uniqueErrors > 0 ? C.deny + '55' : C.border,
            backgroundColor: graveyard.uniqueErrors > 0 ? C.deny + '11' : 'transparent',
          }}>
            <Text style={{ fontSize: 9, color: graveyard.uniqueErrors > 0 ? C.deny : C.textMuted }}>{'☠'}</Text>
            <Text style={{ fontSize: 9, color: graveyard.uniqueErrors > 0 ? C.deny : C.textMuted }}>
              {String(graveyard.totalCrashes)}
            </Text>
          </Pressable>
        </Box>

        <HeartsDisplay
          hearts={heartsInfo.hearts}
          maxHearts={heartsInfo.maxHearts}
          workProgress={heartsInfo.workProgress}
          totalDeaths={heartsInfo.totalDeaths}
        />

        <Pressable onPress={claude.toggleAutoAccept} style={{
          backgroundColor: claude.autoAccept ? C.approve + '22' : 'transparent',
          borderWidth: 1,
          borderColor: claude.autoAccept ? C.approve : C.border,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 4,
        }}>
          <Text style={{ fontSize: 10, color: claude.autoAccept ? C.approve : C.textMuted }}>
            {claude.autoAccept ? 'auto-accept ON' : 'auto-accept'}
          </Text>
        </Pressable>

        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Pressable onPress={() => setCommitOpen(true)} style={{
            paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2,
            borderWidth: 1, borderColor: C.approve + '66',
            backgroundColor: C.approve + '0d', borderRadius: 4,
          }}>
            <Text style={{ fontSize: 10, color: C.approve }}>{'± commit'}</Text>
          </Pressable>
          {LAYOUTS.map(l => (
            <Pressable key={l} onPress={() => setLayout(l)} style={{
              backgroundColor: layout === l ? C.accentDim + '22' : 'transparent',
              borderWidth: 1,
              borderColor: layout === l ? C.accentDim : C.border,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 10, color: layout === l ? C.accent : C.textMuted }}>{l}</Text>
            </Pressable>
          ))}
        </Box>
      </Box>

      <StatsStrip tokens={tokenUsage.tokens} />

      {/* Bento grid */}
      <BentoLayout
        layout={layout}
        code={panelNodes}
        panelA={claudePanel}
        focusedPanel={focusedPanel}
        onPanelPress={setFocusedPanel}
        panelLabels={{
          B: dailyLogOpen ? 'DAILY LOG' : notepadOpen ? 'NOTEPAD' : 'FORTUNE',
          F: fileTreeOpen ? 'FILES' : 'DIFF',
          G: searchOpen   ? 'SEARCH' : 'HISTORY',
        }}
      />

      {/* Session timeline — turn history strip */}
      {!debugCanvas && <SessionTimeline />}

      {/* Prompt input */}
      {!debugCanvas && (
        <Box style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          flexShrink: 0,
          padding: 8,
          gap: 8,
          borderTopWidth: 1,
          borderColor: C.border,
          backgroundColor: C.bg,
        }}>
          {focusedPanel !== 'A' && (
            <Text style={{ fontSize: 12, color: C.accent, paddingTop: 6, fontWeight: 'bold' }}>
              {focusedPanel}
            </Text>
          )}
          <Text style={{ fontSize: 16, color: C.accent, paddingTop: 4 }}>
            {`\u276F`}
          </Text>
          <TextEditor
            key={editorKey}
            sessionId="default"
            onChange={handleChange}
            onSubmit={handleSubmit}
            changeDelay={0.1}
            placeholder="Message Claude..."
            lineNumbers={false}
            style={{
              flexGrow: 1,
              height: editorHeight,
              fontSize: 14,
              color: C.text,
              backgroundColor: C.surface,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: C.border,
            }}
          />
        </Box>
      )}

      <PermissionModal perm={claude.perm} onRespond={claude.respond} />
      <QuestionModal question={claude.question} onRespond={claude.respondQuestion} />

      <SettingsOverlay
        visible={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
        currentTheme={currentTheme}
        onThemeChange={onThemeChange}
      />

      <KeybindOverlay visible={keybindOpen} onClose={() => setKeybindOpen(false)} />

      <CommitHelperOverlay visible={commitOpen} onClose={() => setCommitOpen(false)} />

      <ToastHistoryOverlay
        visible={toastHistOpen}
        entries={toastHistory}
        onClose={() => setToastHistOpen(false)}
        onClear={clearToastHistory}
      />

      <PermissionLogOverlay
        visible={permLogOpen}
        entries={permLog.entries}
        onClose={() => setPermLogOpen(false)}
        onClear={permLog.clearAll}
      />

      <ErrorGraveyardOverlay
        visible={graveyardOpen}
        entries={graveyard.entries}
        totalCrashes={graveyard.totalCrashes}
        onClose={() => setGraveyardOpen(false)}
        onClear={graveyard.clearAll}
      />

      <Ralph status={claude.status} sessionId="default" idleThresholdMs={60000} />
    </>
  );
}

// ── Kernel (untouchable) ──────────────────────────────────────────
// ClaudeCode + ClaudeCanvas mount at this level. The canvas renders
// full-screen behind the shell. If the shell crashes, the canvas
// stays visible — Claude is always alive and visible.

export function App() {
  const claude    = useClaude();
  const hearts    = useHearts(claude.status);
  const graveyard = useErrorGraveyard();
  const [graveyardOpen, setGraveyardOpen] = React.useState(false);
  const { showToast, history: toastHistory, clearHistory: clearToastHistory } = useToast();
  const permLog = usePermissionLog();

  // ── Theme management ───────────────────────────────────────────────
  // useLocalStore persists across restarts. applyTheme mutates C in
  // place so every component picks up the new palette on next render.
  const [themeName, setThemeName] = useLocalStore<ThemeName>('vesper_theme', 'dark');
  const [themeKey,  setThemeKey]  = useState(0);

  // On initial load — apply stored preference (fires once when RPC resolves)
  useEffect(() => {
    applyTheme(themeName ?? 'dark');
    setThemeKey(k => k + 1);
  }, [themeName]);

  const handleThemeChange = useCallback((name: ThemeName) => {
    applyTheme(name);     // mutate C immediately so the next render sees new colors
    setThemeName(name);   // persist + triggers re-render cascade
  }, [setThemeName]);

  const handleCrash = useCallback((msg: string) => {
    hearts.loseHeart();
    graveyard.logError(msg);
  }, [hearts, graveyard]);

  return (
    <Box key={themeKey} style={{ width: '100%', height: '100%', backgroundColor: C.bgDeep, flexDirection: 'column' }}>
      {/* Kernel — Claude session, always alive */}
      <Native
        type="ClaudeCode"
        workingDir="/home/siah/creative/reactjit/workspace"
        model="sonnet"
        sessionId="default"
        onStatusChange={claude.onStatusChange}
        onPermissionRequest={claude.onPerm}
        onPermissionResolved={claude.onPermResolved}
        onQuestionPrompt={claude.onQuestion}
      />
      <AmbientSound status={claude.status} />
      <KonamiEgg />
      <CurlReceiver />

      {/* Shell — everything Claude edits, sandboxed */}
      <ShellBoundary onCrash={handleCrash}>
        <Shell
          claude={claude}
          heartsInfo={hearts}
          graveyard={graveyard}
          graveyardOpen={graveyardOpen}
          setGraveyardOpen={setGraveyardOpen}
          currentTheme={themeName ?? 'dark'}
          onThemeChange={handleThemeChange}
          showToast={showToast}
          toastHistory={toastHistory}
          clearToastHistory={clearToastHistory}
          permLog={permLog}
        />
      </ShellBoundary>
    </Box>
  );
}
