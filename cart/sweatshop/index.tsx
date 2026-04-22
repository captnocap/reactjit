const React: any = require('react');
const { useEffect, useRef, useState, useCallback, useMemo } = React;

// ── FFI stubs (aligned with cart/cockpit) ──────────────────────────
const host: any = globalThis;
const claude_init   = typeof host.__claude_init   === 'function' ? host.__claude_init   : (_a: string, _b: string, _c?: string) => 0;
const claude_close  = typeof host.__claude_close  === 'function' ? host.__claude_close  : () => {};
const claude_send   = typeof host.__claude_send   === 'function' ? host.__claude_send   : (_: string) => 0;
const claude_poll   = typeof host.__claude_poll   === 'function' ? host.__claude_poll   : () => null;
const kimi_init     = typeof host.__kimi_init     === 'function' ? host.__kimi_init     : (_a: string, _b: string, _c?: string) => 0;
const kimi_close    = typeof host.__kimi_close    === 'function' ? host.__kimi_close    : () => {};
const kimi_send     = typeof host.__kimi_send     === 'function' ? host.__kimi_send     : (_: string) => 0;
const kimi_poll     = typeof host.__kimi_poll     === 'function' ? host.__kimi_poll     : () => null;

function backendForModel(model: string): string {
  return _backendForModel(model);
}

import {
  Box,
  Col,
  Pressable,
  Row,
  ScrollView,
  Text,
  TextInput,
} from '../../runtime/primitives';

import {
  buildSeedMessages,
  focusPaths,
  SETTINGS_AUTOMATION_ROWS,
  SETTINGS_CAPABILITY_ROWS,
  SETTINGS_CONTEXT_ROWS,
  SETTINGS_MEMORY_ROWS,
  SETTINGS_PLUGIN_ROWS,
  SETTINGS_PROVIDERS,
} from './data';
import { PROVIDER_CONFIGS, backendForModel as _backendForModel, getEnabledModels } from './providers';
import type { ProviderType, ProviderConfig } from './providers';
import { loadDefaultModels, saveDefaultModels, updateTextModel } from './default-models';
import type { DefaultModelsSettings, ModelReference } from './default-models';
import { expandVariables, hasVariables, listCustomVariables } from './variables';
import type { ExpansionResult } from './variables';
import { listProxyConfigs, getProxyStatus } from './proxy';
import type { ProxyConfig } from './proxy';
import { execAsync } from '../../runtime/hooks/process';
import {
  closeWindow,
  exec,
  maximizeWindow,
  minimizeWindow,
  readFile,
  telSystem,
  writeFile,
} from './host';
import {
  baseName,
  COLORS,
  fileGlyph,
  fileTone,
  inferFileType,
  languageForType,
  parentPath,
  samePath,
  statusLabel,
  statusTone,
  stripDotSlash,
  takeList,
  useTheme,
  visibleBreadcrumbs,
  visibleTabs,
  widthBandForSize,
} from './theme';
import { trimLines, estimateTokens, lineMarker, tokenizeLine, editorTokenTone, primaryMainView } from './utils';
import type { Tab, FileItem, Breadcrumb, SearchResult, ToolExecution, Message, TerminalHistoryEntry } from './types';

import { CompactSurfaceButton, TopBar } from './components/toolbar';
import { TabBar } from './components/tabbar';
import { BreadcrumbBar } from './components/breadcrumbs';
import { StatusBar } from './components/statusbar';
import { TerminalPanel } from './components/terminal';
import { Sidebar } from './components/sidebar';
import { EditorSurface } from './components/editor';
import { SearchSurface } from './components/search';
import { ChatSurface } from './components/chat';
import { SettingsSurface } from './components/settings';
import { LandingSurface } from './components/landing';
import { MermaidPanel } from './components/mermaidpanel';
import { WorkerCanvas } from './components/cockpit/WorkerCanvas';
import { FadeIn, PageModeTransition, SlideIn } from './anim';

import { usePersistentState } from './hooks/usePersistentState';
import { useFileContent } from '../../runtime/hooks/useFileContent';
import { loadPlugins, type PluginRegistry } from './plugin';
import { HotPanel } from './components/hotpanel';
import { GitPanel } from './components/gitpanel';
import { PlanPanelWrapper } from './components/planwrapper';
import { saveCheckpoint, loadCheckpoints } from './checkpoint';
import { CommandPalette, type PaletteCommand } from './components/commandpalette';
import type { MenuBarSection } from './components/menubar';
import { getIndexStats } from './indexer';

export default function CursorIdeApp() {
  // Subscribe the root shell to theme changes so applyTheme() re-renders
  // the entire tree. Without this, components importing COLORS/TOKENS
  // directly (rather than via useTheme) don't re-render on theme switch
  // and appear stuck on the previous palette until some other state change.
  useTheme();
  const [activeTabId, setActiveTabId] = useState('home');
  const [currentInput, setCurrentInputState] = useState('');
  const [isGenerating, setIsGenerating] = useState(0);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [activeAgentId, setActiveAgentId] = useState('');
  const [agentStatusText, setAgentStatusText] = useState('idle');
  const [activeBackend, setActiveBackend] = useState('');
  const [activeSessionModel, setActiveSessionModel] = useState('');
  const [sessionInitState, setSessionInitState] = useState(0); // 0=idle 1=connected 2=error
  const [streamingBuffer, setStreamingBuffer] = useState('');
  const [workDir, setWorkDir] = useState('.');
  const [workspaceName, setWorkspaceName] = useState('reactjit');
  const [workspaceTagline, setWorkspaceTagline] = useState('Native agent workspace');
  const [workspaceStats, setWorkspaceStats] = useState([
    { label: 'indexed', value: '0', tone: '#2d62ff' },
    { label: 'dirty', value: '0', tone: COLORS.yellow },
    { label: 'tabs', value: '1', tone: COLORS.green },
    { label: 'agent', value: 'idle', tone: COLORS.purple },
  ]);
  const [landingProjects, setLandingProjects] = useState<any[]>([
    { name: 'reactjit', path: '__landing__', displayPath: 'Project landing', summary: 'Live workspace overview', badge: 'workspace', accent: '#2d62ff' },
  ]);
  const [landingRecentFiles, setLandingRecentFiles] = useState<any[]>([]);
  const [gitConnections, setGitConnections] = useState<any[]>([]);
  const [gitChanges, setGitChanges] = useState<any[]>([]);
  const [gitRemote, setGitRemote] = useState('origin');
  const [branchAhead, setBranchAhead] = useState(0);
  const [branchBehind, setBranchBehind] = useState(0);
  const [changedCount, setChangedCount] = useState(0);
  const [stagedCount, setStagedCount] = useState(0);
  const [activeView, setActiveView] = useState('landing');
  const [windowWidth, setWindowWidth] = useState(1280);
  const [windowHeight, setWindowHeight] = useState(800);
  const [widthBand, setWidthBand] = useState('desktop');
  const [compactSurface, setCompactSurface] = useState('landing');
  const [showChat, setShowChat] = usePersistentState('cursor-ide.showChat', 1);
  const [showTerminal, setShowTerminal] = usePersistentState('cursor-ide.showTerminal', 0);
  const [terminalPane, setTerminalPane] = usePersistentState('cursor-ide.terminalPane', 'live');
  const [terminalHistory, setTerminalHistory] = usePersistentState<TerminalHistoryEntry[]>('cursor-ide.terminalHistory', []);
  const [terminalDockExpanded, setTerminalDockExpanded] = usePersistentState('cursor-ide.terminalDockExpanded', 0);
  const [terminalDockHeight, setTerminalDockHeight] = usePersistentState('cursor-ide.terminalDockHeight', 250);
  const [showSearch, setShowSearch] = useState(0);
  const [files, setFiles] = useState<FileItem[]>([
    { name: 'reactjit', type: 'workspace', indent: 0, expanded: 1, selected: 1, visible: 1, git: '', hot: 1, path: '.' },
  ]);
  const [editorContent, setEditorContent] = useState('');
  const editorContentRef = useRef('');
  const rebuildTimerRef = useRef<any>(null);
  const [editorModified, setEditorModified] = useState(0);
  const [currentFilePath, setCurrentFilePath] = useState('__landing__');
  // Handle-based file content. The TextEditor primitive reads the file bytes
  // directly from a Zig-owned buffer keyed by this handle, so the content
  // never crosses the JS bridge as a prop. Replaces the 1MB `value=` prop
  // diff that used to dominate click latency on large files.
  const fileContentHandle = useFileContent(currentFilePath);
  const [editorRows, setEditorRows] = useState<any[]>([]);
  const [editorColorRows, setEditorColorRows] = useState<any[] | null>(null);
  const [totalLines, setTotalLines] = useState(0);
  const [editorLargeFileMode, setEditorLargeFileMode] = useState(0);
  const [settingsSection, setSettingsSection] = usePersistentState('cursor-ide.settingsSection', 'providers');
  const [selectedProviderId, setSelectedProviderId] = usePersistentState('cursor-ide.selectedProvider', 'anthropic');
  const [openTabs, setOpenTabs] = useState<Tab[]>([
    { id: 'home', name: 'Projects', path: '__landing__', type: 'home', modified: 0, pinned: 1, git: '' },
  ]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const firstEnabledModel = getEnabledModels()[0];
  const [selectedModel, setSelectedModel] = usePersistentState('cursor-ide.selectedModel', firstEnabledModel ? firstEnabledModel.id : '');
  const [modelDisplayName, setModelDisplayName] = usePersistentState('cursor-ide.modelDisplayName', firstEnabledModel ? firstEnabledModel.displayName : 'No Model');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitStatus, setGitStatus] = useState('');
  const [errors, setErrors] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [languageMode, setLanguageMode] = useState('Workspace');
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { label: 'Projects', icon: 'house', tone: '#2d62ff', active: 0, kind: 'home' },
    { label: 'reactjit', icon: 'package', tone: COLORS.green, active: 1, kind: 'workspace', meta: 'workspace' },
  ]);
  const [agentMode, setAgentModeState] = useState('ask');
  const [attachments, setAttachmentsState] = useState<Array<{ id: string; type: string; name: string; path: string }>>([]);
  const [webSearch, setWebSearchState] = useState(0);
  const [termAccess, setTermAccessState] = useState(0);
  const [autoApply, setAutoApplyState] = useState(0);
  const [inputTokenEstimate, setInputTokenEstimateState] = useState(0);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(0);
  const [showHotPanel, setShowHotPanel] = usePersistentState('cursor-ide.showHotPanel', 0);
  const [showGitPanel, setShowGitPanel] = usePersistentState('cursor-ide.showGitPanel', 0);
  const [showPlanPanel, setShowPlanPanel] = usePersistentState('cursor-ide.showPlanPanel', 0);
  const [activePlanId, setActivePlanId] = usePersistentState('cursor-ide.activePlan', '');
  const [terminalRecording, setTerminalRecording] = useState(0);
  const [terminalRecordFrames, setTerminalRecordFrames] = useState(0);
  const [terminalPlaybackState, setTerminalPlaybackState] = useState<any>(null);
  const [pluginRegistry, setPluginRegistry] = useState<PluginRegistry | null>(null);
  const [pluginNotifications, setPluginNotifications] = useState<any[]>([]);
  const [showPalette, setShowPalette] = useState(0);
  const openPalette = useCallback(() => setShowPalette(1), []);
  const [dockPanels, setDockPanels] = usePersistentState<string[]>('cursor-ide.dockPanels', ['files', 'source-control']);

  // ── New ported state ─────────────────────────────────────────────────
  const [providerConfigs, setProviderConfigs] = usePersistentState<ProviderConfig[]>('cursor-ide.providerConfigs', Object.values(PROVIDER_CONFIGS));
  const [defaultModels, setDefaultModels] = useState<DefaultModelsSettings>(loadDefaultModels());
  const [variablePreview, setVariablePreview] = useState<ExpansionResult[]>([]);
  const [proxyConfigs, setProxyConfigs] = useState<ProxyConfig[]>(listProxyConfigs());
  const [proxyStatus, setProxyStatus] = useState(getProxyStatus());

  const fileContentsRef = useRef<Record<string, string>>({});
  const gitStatusByPathRef = useRef<Record<string, string>>({});
  const cachedTreePathsRef = useRef<string[]>([]);
  const workspaceBootstrappedRef = useRef(false);
  const stateRef = useRef<any>({});

  const execCacheRef = useRef<Record<string, string>>({});
    const execCached = useCallback((cmd: string): string => {
    const cache = execCacheRef.current;
    if (cache[cmd] !== undefined) return cache[cmd];
    const result = exec(cmd);
    cache[cmd] = result;
    return result;
  }, []);
    const clearExecCache = useCallback((): void => {
    execCacheRef.current = {};
  }, []);

    const normalizeDockPanels = useCallback((list: string[]): string[] => {
    const next: string[] = [];
    const seen: Record<string, number> = {};
    for (const panelId of list) {
      if (!panelId || seen[panelId]) continue;
      next.push(panelId);
      seen[panelId] = 1;
    }
    return next.length > 0 ? next : ['files'];
  }, []);

    const focusDockPanel = useCallback((panelId: string) => {
    setDockPanels((prev) => {
      const base = normalizeDockPanels(prev);
      return [panelId, ...base.filter((id) => id !== panelId)].slice(0, 4);
    });
  }, []);

    const closeDockPanel = useCallback((panelId: string) => {
    setDockPanels((prev) => {
      const next = normalizeDockPanels(prev).filter((id) => id !== panelId);
      return next.length > 0 ? next : ['files'];
    });
  }, []);

  const cursorPosition = { line: 1, column: 1 };

  stateRef.current = {
    activeTabId, activeAgentId, activeView, attachments, agentMode, agentStatusText,
    activeBackend, activeSessionModel, sessionInitState, streamingBuffer,
    changedCount, chatMessages, compactSurface, currentFilePath, currentInput,
    editorContent, files, gitBranch, gitRemote, modelDisplayName, openTabs,
    searchQuery, selectedModel, stagedCount, workDir, widthBand, windowHeight,
    windowWidth, workspaceName, showSearch, showChat, showTerminal, showHotPanel, showGitPanel, showPlanPanel,
    defaultModels, providerConfigs, proxyConfigs, proxyStatus, terminalDockHeight, dockPanels,
  };

  host.__setTerminalDockHeight = (value: number) => {
    setTerminalDockHeight(clampTerminalDockHeight(Number(value)));
  };

    const clampTerminalDockHeight = useCallback((value: number): number => {
    const minHeight = 140;
    const maxHeight = Math.max(180, Math.floor((stateRef.current.windowHeight || 800) * 0.65));
    return Math.max(minHeight, Math.min(maxHeight, Math.round(value)));
  }, []);

    const addToolExecution = useCallback((id: string, name: string, input: string) => {
    setToolExecutions((prev) => [...prev, { id, name, input, status: 'running', percent: 20, result: '' }]);
  }, []);
    const completeToolExecution = useCallback((id: string, result: string) => {
    setToolExecutions((prev) => prev.map((item) => item.id === id ? { ...item, status: 'completed', percent: 100, result } : item));
  }, []);
    const failToolExecution = useCallback((id: string, result: string) => {
    setToolExecutions((prev) => prev.map((item) => item.id === id ? { ...item, status: 'error', percent: 0, result } : item));
  }, []);
    const replaceComposer = useCallback((nextText: string, nextAttachments?: Array<{ id: string; type: string; name: string; path: string }>) => {
    const attachmentList = nextAttachments ?? stateRef.current.attachments;
    setCurrentInputState(nextText);
    setInputTokenEstimateState(estimateTokens(nextText, attachmentList));
    // Update variable preview
    if (hasVariables(nextText)) {
      const results = expandVariables(nextText, {
        workDir: stateRef.current.workDir || '.',
        gitBranch: stateRef.current.gitBranch || 'main',
        userName: 'user',
      });
      setVariablePreview(results);
    } else {
      setVariablePreview([]);
    }
  }, []);
    const replaceAttachments = useCallback((nextAttachments: Array<{ id: string; type: string; name: string; path: string }>) => {
    setAttachmentsState(nextAttachments);
    setInputTokenEstimateState(estimateTokens(stateRef.current.currentInput, nextAttachments));
  }, []);

    const syncWindowMetrics = useCallback(() => {
    const sys = telSystem();
    if (!sys) return;
    const w = sys.window_w || stateRef.current.windowWidth || 1280;
    const h = sys.window_h || stateRef.current.windowHeight || 800;
    const band = widthBandForSize(w, h);
    const mainSurface = primaryMainView(stateRef.current.activeView, stateRef.current.currentFilePath);
    if (w !== stateRef.current.windowWidth) setWindowWidth(w);
    if (h !== stateRef.current.windowHeight) setWindowHeight(h);
    if (band !== stateRef.current.widthBand) setWidthBand(band);
    if (band === 'narrow' || band === 'widget' || band === 'minimum') {
      let nextSurface = stateRef.current.compactSurface || mainSurface;
      if (nextSurface === 'editor' && mainSurface === 'landing') nextSurface = 'landing';
      if (nextSurface === 'landing' && mainSurface === 'editor') nextSurface = 'editor';
      if ((nextSurface === 'landing' || nextSurface === 'editor' || nextSurface === 'settings') && mainSurface === 'settings') nextSurface = 'settings';
      if (nextSurface === 'settings' && mainSurface !== 'settings') nextSurface = mainSurface;
      if (nextSurface !== stateRef.current.compactSurface) setCompactSurface(nextSurface);
    } else if (
      (stateRef.current.compactSurface === 'landing' || stateRef.current.compactSurface === 'editor' || stateRef.current.compactSurface === 'settings') &&
      stateRef.current.compactSurface !== mainSurface
    ) {
      setCompactSurface(mainSurface);
    }
  }, []);

    const pathPriority = useCallback((path: string): number => {
    if (path.indexOf('cart/cursor-ide') === 0) return 0;
    if (path.indexOf('tsz/carts/conformance/mixed/cursor-ide') === 0) return 1;
    if (path.indexOf('runtime/') === 0) return 2;
    if (path.indexOf('renderer/') === 0) return 3;
    if (path === 'qjs_app.zig') return 4;
    return 5;
  }, []);
    const shouldKeepPath = useCallback((path: string): boolean => {
    if (!path) return false;
    if (path.indexOf('.git/') === 0) return false;
    if (path.indexOf('zig-cache/') === 0) return false;
    if (path.indexOf('zig-out/') === 0) return false;
    if (path.indexOf('node_modules/') === 0) return false;
    if (path.indexOf('archive/') === 0) return false;
    if (path.indexOf('love2d/') === 0) return false;
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')) return false;
    return true;
  }, []);
    const hasPath = useCallback((list: string[], path: string): boolean => {
    return list.some((item) => samePath(item, path));
  }, []);
    const dirGitStatus = useCallback((path: string): string => {
    for (const key of Object.keys(gitStatusByPathRef.current)) {
      if (key.indexOf(path + '/') === 0) return 'dirty';
    }
    return '';
  }, []);
    const isHotPath = useCallback((path: string): boolean => {
    return path.indexOf('cursor-ide') >= 0 || path.indexOf('runtime/') === 0 || path === 'qjs_app.zig';
  }, []);
    const shouldExpand = useCallback((path: string): number => {
    return (
      path === 'cart' ||
      path === 'cart/cursor-ide' ||
      path === 'runtime' ||
      path === 'renderer' ||
      path === 'tsz' ||
      path === 'tsz/carts' ||
      path === 'tsz/carts/conformance' ||
      path === 'tsz/carts/conformance/mixed' ||
      path === 'tsz/carts/conformance/mixed/cursor-ide'
    ) ? 1 : 0;
  }, []);
    const findTreeItem = useCallback((list: FileItem[], path: string): FileItem | null => {
    return list.find((item) => samePath(item.path, path)) || null;
  }, []);
    const applyTreeVisibility = useCallback((list: FileItem[]): FileItem[] => {
    return list.map((item) => {
      if (item.type === 'workspace') return { ...item, visible: 1 };
      let visible = 1;
      let parent = parentPath(item.path);
      while (parent !== '.' && parent.length > 0) {
        const parentItem = findTreeItem(list, parent);
        if (parentItem && parentItem.expanded !== 1) visible = 0;
        parent = parentPath(parent);
      }
      return { ...item, visible };
    });
  }, []);
    const flattenTreeNode = useCallback((node: any, depth: number, items: FileItem[]) => {
    const dirNames = Object.keys(node.dirs).sort();
    for (const dirName of dirNames) {
      const dir = node.dirs[dirName];
      items.push({
        name: dir.name, type: 'dir', indent: depth + 1, expanded: shouldExpand(dir.path),
        selected: 0, visible: 1, git: dirGitStatus(dir.path), hot: isHotPath(dir.path) ? 1 : 0, path: dir.path,
      });
      flattenTreeNode(dir, depth + 1, items);
    }
    node.files.sort((a: any, b: any) => {
      const pa = pathPriority(a.path); const pb = pathPriority(b.path);
      if (pa !== pb) return pa - pb;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });
    for (const file of node.files) {
      items.push({
        name: file.name, type: file.type, indent: depth + 1, expanded: 0,
        selected: samePath(file.path, stateRef.current.currentFilePath) ? 1 : 0,
        visible: 1, git: gitStatusByPathRef.current[file.path] || '', hot: isHotPath(file.path) ? 1 : 0, path: file.path,
      });
    }
  }, []);

    const buildWorkspaceSnapshot = useCallback((rootName: string) => {
    const raw = execCached('find . -maxdepth 5 \\( -path "./.git" -o -path "./zig-cache" -o -path "./zig-out" -o -path "./node_modules" -o -path "./archive" -o -path "./love2d" \\) -prune -o -type f -print 2>/dev/null | sed -n "1,180{s#^\\./##;p;}"');
    const discovered = trimLines(raw);
    const merged: string[] = [];
    for (const path of focusPaths()) {
      if (shouldKeepPath(path) && !hasPath(merged, path)) merged.push(path);
    }
    for (const path of discovered) {
      if (shouldKeepPath(path) && !hasPath(merged, path)) merged.push(path);
    }
    merged.sort((a, b) => {
      const pa = pathPriority(a); const pb = pathPriority(b);
      if (pa !== pb) return pa - pb;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    cachedTreePathsRef.current = merged;

    const tree = { name: rootName, path: '.', dirs: {} as Record<string, any>, files: [] as any[] };
    for (const path of merged) {
      const parts = path.split('/');
      let node = tree;
      let current = '';
      for (let idx = 0; idx < parts.length; idx += 1) {
        const part = parts[idx];
        if (idx === parts.length - 1) {
          node.files.push({ name: part, path, type: inferFileType(path) });
        } else {
          current = current.length === 0 ? part : current + '/' + part;
          if (!node.dirs[part]) node.dirs[part] = { name: part, path: current, dirs: {}, files: [] };
          node = node.dirs[part];
        }
      }
    }

    const items: FileItem[] = [
      { name: rootName, type: 'workspace', indent: 0, expanded: 1, selected: stateRef.current.activeView === 'landing' ? 1 : 0, visible: 1, git: '', hot: 1, path: '.' },
    ];
    flattenTreeNode(tree, 0, items);
    return { items: applyTreeVisibility(items), paths: merged };
  }, []);

    const markSelectedPath = useCallback((path: string) => {
    setFiles((prev) => prev.map((item) => ({
      ...item,
      selected: path === '__landing__' ? (item.type === 'workspace' ? 1 : 0) : (samePath(item.path, path) ? 1 : 0),
    })));
  }, []);

    const buildLandingProjects = useCallback((paths: string[], info: any, nextWorkspaceName: string) => {
    const projects: any[] = [
      { name: nextWorkspaceName, path: '__landing__', displayPath: 'Project landing', summary: 'Branch ' + info.branch + ' with ' + info.dirty + ' dirty paths and ' + paths.length + ' indexed files.', badge: 'workspace', accent: '#2d62ff' },
      { name: 'cursor-ide TSX cart', path: 'cart/cursor-ide/index.tsx', displayPath: 'cart/cursor-ide/index.tsx', summary: 'Runtime-native port of the mixed-lane Cursor IDE shell for the active ReactJIT stack.', badge: 'active', accent: COLORS.green },
      { name: 'legacy TSZ reference', path: 'tsz/carts/conformance/mixed/cursor-ide/cursor-ide.tsz', displayPath: 'tsz/carts/conformance/mixed/cursor-ide/cursor-ide.tsz', summary: 'Frozen Smith-era source that the current cart mirrors surface-for-surface.', badge: 'reference', accent: COLORS.purple },
      { name: 'settings surface', path: '__settings__', displayPath: 'Settings', summary: 'Provider routing, context layering, memory orchestration, plugin runtimes, and capability references in one dense shell.', badge: 'surface', accent: COLORS.orange },
    ];
    if (hasPath(paths, 'runtime/primitives.tsx')) {
      projects.push({ name: 'runtime primitives', path: 'runtime/primitives.tsx', displayPath: 'runtime/primitives.tsx', summary: 'Current primitive surface map for Box/Text/Terminal/Native nodes.', badge: 'runtime', accent: COLORS.blue });
    }
    setLandingProjects(projects);
  }, []);

    const buildLandingRecentFiles = useCallback((paths: string[], info: any) => {
    const recent: any[] = [];
    const seen: Record<string, number> = {};
    function pushRecent(path: string, label: string, reason: string) {
      const clean = stripDotSlash(path);
      if (!clean || seen[clean]) return;
      seen[clean] = 1;
      const type = inferFileType(clean);
      recent.push({ path: clean, displayPath: clean === '__landing__' ? 'Project landing' : clean === '__settings__' ? 'Settings' : clean, label, reason, icon: fileGlyph(type), tone: fileTone(type) });
    }
    for (let i = 0; i < info.changes.length && recent.length < 4; i += 1) pushRecent(info.changes[i].path, baseName(info.changes[i].path), info.changes[i].status);
    for (let i = 0; i < stateRef.current.openTabs.length && recent.length < 6; i += 1) {
      const tab = stateRef.current.openTabs[i];
      if (tab.path !== '__landing__') pushRecent(tab.path, tab.name, 'open tab');
    }
    for (let i = 0; i < paths.length && recent.length < 8; i += 1) {
      if (paths[i].indexOf('cursor-ide') >= 0) pushRecent(paths[i], baseName(paths[i]), 'focus surface');
    }
    setLandingRecentFiles(recent);
  }, []);

    const buildBreadcrumbs = useCallback((path: string, workspaceNameOverride?: string, gitBranchOverride?: string) => {
    const nextWorkspaceName = workspaceNameOverride || stateRef.current.workspaceName;
    const nextGitBranch = gitBranchOverride || stateRef.current.gitBranch;
    if (path === '__landing__') {
      setBreadcrumbs([
        { label: 'Projects', icon: 'house', tone: '#2d62ff', active: 0, kind: 'home' },
        { label: nextWorkspaceName, icon: 'package', tone: COLORS.green, active: 1, kind: 'workspace', meta: nextGitBranch },
      ]); return;
    }
    if (path === '__settings__') {
      setBreadcrumbs([
        { label: 'Projects', icon: 'house', tone: '#2d62ff', active: 0, kind: 'home' },
        { label: nextWorkspaceName, icon: 'package', tone: COLORS.green, active: 0, kind: 'workspace', meta: nextGitBranch },
        { label: 'Settings', icon: 'palette', tone: COLORS.purple, active: 1, kind: 'settings', meta: 'providers / memory' },
      ]); return;
    }
    const crumbs: Breadcrumb[] = [
      { label: 'Projects', icon: 'house', tone: '#2d62ff', active: 0, kind: 'home' },
      { label: nextWorkspaceName, icon: 'package', tone: COLORS.green, active: 0, kind: 'workspace', meta: nextGitBranch },
    ];
    let current = '';
    for (const [idx, part] of path.split('/').entries()) {
      current = current.length === 0 ? part : current + '/' + part;
      const isLast = idx === path.split('/').length - 1;
      const type = isLast ? inferFileType(current) : 'dir';
      crumbs.push({ label: part, icon: fileGlyph(type), tone: fileTone(type), active: isLast ? 1 : 0, kind: type, meta: isLast && gitStatusByPathRef.current[path] ? gitStatusByPathRef.current[path] : '' });
    }
    setBreadcrumbs(crumbs);
  }, []);

    const loadGitSummary = useCallback(() => {
    let branch = execCached('git branch --show-current 2>/dev/null').replace(/\s+/g, '');
    if (!branch) branch = 'detached';
    setGitBranch(branch);
    let remoteName = 'origin';
    const connections: any[] = [];
    const seenRemote: Record<string, number> = {};
    const remoteLines = trimLines(execCached('git remote -v 2>/dev/null | sed -n "1,6p"'));
    for (const line of remoteLines) {
      let tab = line.indexOf('\t');
      if (tab < 0) tab = line.indexOf(' ');
      if (tab < 0) continue;
      const name = line.slice(0, tab);
      let rest = line.slice(tab + 1);
      const modeIdx = rest.indexOf(' ');
      if (modeIdx >= 0) rest = rest.slice(0, modeIdx);
      if (seenRemote[name] !== 1) {
        connections.push({ name, detail: rest, kind: 'remote', tone: '#2d62ff' });
        seenRemote[name] = 1;
        if (connections.length === 1) remoteName = name;
      }
    }
    setGitRemote(remoteName);
    const worktreeLines = trimLines(execCached('git worktree list 2>/dev/null | sed -n "1,3p"'));
    for (const line of worktreeLines) connections.push({ name: 'worktree', detail: line, kind: 'worktree', tone: COLORS.green });
    let ahead = 0; let behind = 0;
    const counts = exec('git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null').trim();
    if (counts) {
      const parts = counts.includes('\t') ? counts.split('\t') : counts.split(' ');
      if (parts.length >= 2) { behind = parseInt(parts[0], 10) || 0; ahead = parseInt(parts[1], 10) || 0; }
    }
    setBranchAhead(ahead); setBranchBehind(behind);
    connections.unshift({ name: branch, detail: 'ahead ' + ahead + ' / behind ' + behind, kind: 'branch', tone: COLORS.green });
    const statusLines = trimLines(exec('git status --short 2>/dev/null'));
    const changes: any[] = [];
    let dirty = 0; let staged = 0;
    gitStatusByPathRef.current = {};
    for (const statusLine of statusLines) {
      if (statusLine.length < 3) continue;
      const code = statusLine.slice(0, 2);
      let path = statusLine.slice(3);
      const rename = path.indexOf(' -> ');
      if (rename >= 0) path = path.slice(rename + 4);
      path = stripDotSlash(path);
      dirty += 1;
      if (code.charAt(0) !== ' ' && code.charAt(0) !== '?') staged += 1;
      gitStatusByPathRef.current[path] = code.replace(/\s+/g, '');
      changes.push({ path, status: statusLabel(code), short: code.replace(/\s+/g, ''), tone: statusTone(code) });
    }
    setGitConnections(connections); setGitChanges(changes);
    setChangedCount(dirty); setStagedCount(staged);
    setGitStatus(dirty > 0 ? '*' + dirty : '');
    return { branch, dirty, staged, remote: remoteName, ahead, behind, changes, connections };
  }, []);

    const refreshWorkspace = useCallback(() => {
    syncWindowMetrics();
    let pwd = execCached('pwd 2>/dev/null').trim();
    if (!pwd) pwd = '.';
    const nextWorkspaceName = baseName(pwd) || 'workspace';
    setWorkDir(pwd); setWorkspaceName(nextWorkspaceName);
    setWorkspaceTagline('Conformance-grade IDE cart with live explorer, git, and agent context');
    const gitInfo = loadGitSummary();
    const snapshot = buildWorkspaceSnapshot(nextWorkspaceName);
    setFiles(snapshot.items);
    setWorkspaceStats([
      { label: 'indexed', value: String(snapshot.paths.length), tone: '#2d62ff' },
      { label: 'dirty', value: String(gitInfo.dirty), tone: COLORS.yellow },
      { label: 'tabs', value: String(stateRef.current.openTabs.length), tone: COLORS.green },
      { label: 'agent', value: stateRef.current.activeAgentId ? 'live' : stateRef.current.agentStatusText, tone: COLORS.purple },
    ]);
    buildLandingProjects(snapshot.paths, gitInfo, nextWorkspaceName);
    buildLandingRecentFiles(snapshot.paths, gitInfo);
    setOpenTabs((prev) => prev.map((tab) => ({ ...tab, git: tab.path !== '__landing__' ? (gitStatusByPathRef.current[tab.path] || '') : '' })));
    if (!workspaceBootstrappedRef.current || stateRef.current.chatMessages.length === 0) {
      setChatMessages(buildSeedMessages(gitInfo.branch, gitInfo.dirty, pwd, stateRef.current.modelDisplayName || 'AI'));
    }
    if (stateRef.current.activeView === 'landing' || stateRef.current.currentFilePath === '__landing__' || !stateRef.current.currentFilePath) {
      buildBreadcrumbs('__landing__', nextWorkspaceName, gitInfo.branch); markSelectedPath('__landing__');
    } else if (stateRef.current.activeView === 'settings' || stateRef.current.currentFilePath === '__settings__') {
      buildBreadcrumbs('__settings__', nextWorkspaceName, gitInfo.branch); markSelectedPath('__landing__');
    } else {
      buildBreadcrumbs(stateRef.current.currentFilePath, nextWorkspaceName, gitInfo.branch); markSelectedPath(stateRef.current.currentFilePath);
    }
    workspaceBootstrappedRef.current = true;
  }, []);

    const rebuildPlain = useCallback((content: string, path: string) => {
    const lines = content.length > 0 ? content.split('\n') : [''];
    const rows = new Array(lines.length);
    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const display = line.indexOf('\t') >= 0 ? line.replace(/\t/g, '  ') : line;
      rows[idx] = { line: idx + 1, charCount: display.length, marker: lineMarker(line), previewWidth: 20 + ((line.length * 3) % 80) };
    }
    setTotalLines(lines.length); setEditorRows(rows); setEditorColorRows(null); setEditorLargeFileMode(1);
    setLanguageMode(languageForType(inferFileType(path)));
  }, []);

    const rebuildColor = useCallback((content: string, path: string) => {
    try {
      const lines = content.length > 0 ? content.split('\n') : [''];
      const largeFileMode = lines.length > 1800 || content.length > 90000;
      let inImportSpecifiers = false;
      const rows = new Array(lines.length);
      const colorRows = new Array(lines.length);
      for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx];
        const trimmed = line.trim();
        const display = line.indexOf('\t') >= 0 ? line.replace(/\t/g, '  ') : line;
        const tokens = tokenizeLine(line, { inImportSpecifiers });
        rows[idx] = { line: idx + 1, charCount: display.length, marker: lineMarker(line), previewWidth: 20 + ((line.length * 3) % 80) };
        colorRows[idx] = tokens.map((token: any) => ({ text: token.text, color: editorTokenTone(token.kind) }));
        if (!inImportSpecifiers && /^import\s*\{/.test(trimmed) && !trimmed.includes('}')) inImportSpecifiers = true;
        else if (inImportSpecifiers && trimmed.includes('}')) inImportSpecifiers = false;
      }
      setTotalLines(lines.length); setEditorRows(rows); setEditorColorRows(colorRows); setEditorLargeFileMode(largeFileMode ? 1 : 0);
      setLanguageMode(languageForType(inferFileType(path)));
    } catch (error) {
      console.error('[cursor-ide] rebuildColor failed', path, content.length, error);
      rebuildPlain(content, path);
    }
  }, []);

    const ensureHomeTab = useCallback((list: Tab[]): Tab[] => {
    if (list.some((tab) => tab.path === '__landing__')) return list;
    return [{ id: 'home', name: 'Projects', path: '__landing__', type: 'home', modified: 0, pinned: 1, git: '' }, ...list];
  }, []);
    const ensureTabForPath = useCallback((path: string) => {
    let nextTabs = ensureHomeTab([...stateRef.current.openTabs]);
    let tabId = '';
    nextTabs = nextTabs.map((tab) => { if (tab.path === path) { tabId = tab.id; return { ...tab, git: gitStatusByPathRef.current[path] || '' }; } return tab; });
    if (!tabId) {
      tabId = 't' + String(nextTabs.length + 1);
      nextTabs.push({ id: tabId, name: baseName(path), path, type: inferFileType(path), modified: 0, pinned: 0, git: gitStatusByPathRef.current[path] || '' });
    }
    setOpenTabs(nextTabs); setActiveTabId(tabId);
  }, []);

    const openLandingPage = useCallback(() => {
    setOpenTabs((prev) => ensureHomeTab([...prev]));
    setActiveView('landing');
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('landing');
    setCurrentFilePath('__landing__'); editorContentRef.current = ''; setEditorContent('');
    setEditorRows([]); setEditorColorRows(null); setEditorLargeFileMode(0); setEditorModified(0); setTotalLines(0); setLanguageMode('Workspace');
    setActiveTabId('home'); buildBreadcrumbs('__landing__'); markSelectedPath('__landing__');
  }, []);
    const openSettingsSurface = useCallback(() => {
    let nextTabs = ensureHomeTab([...stateRef.current.openTabs]);
    let tabId = 'settings';
    if (!nextTabs.some((tab) => tab.path === '__settings__')) {
      nextTabs.push({ id: 'settings', name: 'Settings', path: '__settings__', type: 'settings', modified: 0, pinned: 1, git: '' });
    } else { const settingsTab = nextTabs.find((tab) => tab.path === '__settings__'); if (settingsTab) tabId = settingsTab.id; }
    setOpenTabs(nextTabs); setActiveView('settings');
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('settings');
    setCurrentFilePath('__settings__'); editorContentRef.current = ''; setEditorContent('');
    setEditorRows([]); setEditorColorRows(null); setEditorLargeFileMode(0); setEditorModified(0); setTotalLines(0); setLanguageMode('Settings');
    setActiveTabId(tabId); buildBreadcrumbs('__settings__'); markSelectedPath('__landing__');
  }, []);

    const openCockpitSurface = useCallback(() => {
    let nextTabs = ensureHomeTab([...stateRef.current.openTabs]);
    let tabId = 'cockpit';
    if (!nextTabs.some((tab) => tab.path === '__cockpit__')) {
      nextTabs.push({ id: 'cockpit', name: 'Cockpit', path: '__cockpit__', type: 'cockpit', modified: 0, pinned: 1, git: '' });
    } else { const t = nextTabs.find((tab) => tab.path === '__cockpit__'); if (t) tabId = t.id; }
    setOpenTabs(nextTabs); setActiveView('cockpit');
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('cockpit');
    setCurrentFilePath('__cockpit__'); editorContentRef.current = ''; setEditorContent('');
    setEditorRows([]); setEditorColorRows(null); setEditorLargeFileMode(0); setEditorModified(0); setTotalLines(0); setLanguageMode('Cockpit');
    setActiveTabId(tabId); buildBreadcrumbs('__cockpit__'); markSelectedPath('__landing__');
  }, []);

    const openMermaidSurface = useCallback(() => {
    setOpenTabs((prev) => ensureHomeTab([...prev]));
    setActiveView('editor');
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('editor');
    setCurrentFilePath('__mermaid__'); editorContentRef.current = ''; setEditorContent('');
    setEditorRows([]); setEditorColorRows(null); setEditorLargeFileMode(0); setEditorModified(0); setTotalLines(0); setLanguageMode('Mermaid');
    setActiveTabId('mermaid'); buildBreadcrumbs('__mermaid__'); markSelectedPath('__landing__');
  }, [ensureHomeTab, buildBreadcrumbs, markSelectedPath]);

    const loadFileByPath = useCallback((path: string) => {
    if (path === '__cockpit__') { openCockpitSurface(); return; }
    if (path === '__mermaid__') { openMermaidSurface(); return; }
    if (path === '__settings__') { openSettingsSurface(); return; }
    if (path === '__landing__' || path === '.' || inferFileType(path) === 'workspace') { openLandingPage(); return; }
    let content = fileContentsRef.current[path];
    if (!content) {
      const diskContent = readFile(path);
      if (diskContent) { content = diskContent; fileContentsRef.current[path] = diskContent; }
      else { content = '// ' + path + '\n'; }
    }
    setActiveView('editor');
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('editor');
    editorContentRef.current = content; setEditorContent(content); setCurrentFilePath(path); setEditorModified(0);
    rebuildColor(content, path); buildBreadcrumbs(path); ensureTabForPath(path); markSelectedPath(path);
  }, []);

  const activateTab = useCallback((id: string) => {
    if (id === 'home') { openLandingPage(); return; }
    if (id === 'settings') { openSettingsSurface(); return; }
    if (id === 'cockpit') { openCockpitSurface(); return; }
    if (id === 'mermaid') { openMermaidSurface(); return; }
    const tab = stateRef.current.openTabs.find((item: Tab) => item.id === id);
    if (tab) loadFileByPath(tab.path);
  }, []);
    const closeTab = useCallback((id: string) => {
    if (id === 'home') return;
    const tabs = stateRef.current.openTabs.filter((tab: Tab) => tab.id !== id);
    setOpenTabs(tabs);
    if (tabs.length === 0 || stateRef.current.activeTabId === id) { openLandingPage(); }
    else { activateTab(tabs[tabs.length - 1].id); }
  }, []);
    const closeCurrentFile = useCallback(() => {
    closeTab(stateRef.current.activeTabId);
  }, [closeTab]);
    const toggleDir = useCallback((path: string) => {
    setFiles((prev) => {
      const next = prev.map((item) => samePath(item.path, path) ? { ...item, expanded: item.expanded ? 0 : 1 } : { ...item });
      return applyTreeVisibility(next);
    });
  }, []);
    const openFileByPath = useCallback((path: string) => {
    const item = stateRef.current.files?.find((entry: FileItem) => samePath(entry.path, path));
    if (item && item.type === 'dir') { toggleDir(path); return; }
    loadFileByPath(path);
  }, []);
    const openSearchResult = useCallback((path: string, line: number) => {
    if (path === '(no results)') return;
    loadFileByPath(path); setShowSearch(0);
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('editor');
  }, []);

  // useCallback with [] — all mutable reads go through refs, setState setters
  // are stable by React contract, so these closures are self-sufficient. Stable
  // identity lets React.memo(EditorSurface) actually bail out.
  const updateEditorContent = useCallback((text: string) => {
    const path = stateRef.current.currentFilePath;
    if (path === '__landing__' || path === '__settings__') return;
    editorContentRef.current = text;
    fileContentsRef.current[path] = text;
    const curTab = stateRef.current.openTabs.find((t: Tab) => t.path === path);
    if (!curTab || curTab.modified !== 1) {
      setEditorModified(1);
      setGitStatus('*' + (stateRef.current.changedCount > 0 ? stateRef.current.changedCount : 1));
      setOpenTabs((prev: Tab[]) => prev.map((tab) => tab.path === path ? { ...tab, modified: 1 } : tab));
    }
    setEditorColorRows(null);
    if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
    rebuildTimerRef.current = setTimeout(() => {
      rebuildTimerRef.current = null;
      rebuildColor(editorContentRef.current, stateRef.current.currentFilePath);
    }, 300);
  }, []);

  const saveCurrentFile = useCallback(() => {
    const path = stateRef.current.currentFilePath;
    if (path === '__landing__' || path === '__settings__') return;
    const execId = 'write_' + Date.now();
    addToolExecution(execId, 'writeFile', path);
    const text = editorContentRef.current;
    const wrote = writeFile(path, text);
    fileContentsRef.current[path] = text;
    setOpenTabs((prev: Tab[]) => prev.map((tab) => tab.path === path ? { ...tab, modified: 0 } : tab));
    setEditorModified(0);
    if (wrote) completeToolExecution(execId, 'saved ' + path);
    else failToolExecution(execId, 'write failed');
    refreshWorkspace();
  }, []);

    const createNewFile = useCallback(() => {
    setShowNewFileInput(1);
    setNewFileName('');
  }, []);
    const confirmCreateFile = useCallback(() => {
    const name = newFileName.trim();
    if (!name) { setShowNewFileInput(0); return; }
    const path = name.startsWith('/') ? name.slice(1) : name;
    if (!fileContentsRef.current[path]) {
      fileContentsRef.current[path] = '// ' + baseName(path) + '\n';
      writeFile(path, fileContentsRef.current[path]);
    }
    clearExecCache();
    refreshWorkspace();
    loadFileByPath(path);
    setShowNewFileInput(0);
  }, []);

    const recentSearchFallback = useCallback((): SearchResult[] => {
    return cachedTreePathsRef.current.slice(0, 8).map((path) => ({ file: path, line: 1, text: 'Recent workspace path', matches: 1 }));
  }, []);
    const searchProject = useCallback((query: string) => {
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('search');
    setSearchQuery(query);
    if (!query) { setSearchResults(recentSearchFallback()); return; }
    const execId = 'grep_' + Date.now();
    addToolExecution(execId, 'grep', query);
    const raw = exec('rg -n --no-heading ' + JSON.stringify(query) + ' . 2>/dev/null | head -60');
    const results: SearchResult[] = [];
    if (raw) {
      for (const line of raw.split('\n')) {
        const clean = stripDotSlash(line);
        if (!clean) continue;
        const c1 = clean.indexOf(':');
        if (c1 < 0) continue;
        const file = clean.slice(0, c1);
        const rest = clean.slice(c1 + 1);
        const c2 = rest.indexOf(':');
        if (c2 < 0) continue;
        results.push({ file, line: parseInt(rest.slice(0, c2), 10) || 1, text: rest.slice(c2 + 1), matches: 1 });
      }
    }
    if (results.length === 0) results.push({ file: '(no results)', line: 0, text: 'No matches for: ' + query, matches: 0 });
    setSearchResults(results);
    completeToolExecution(execId, results.length + ' result(s)');
  }, []);

    const indexProject = useCallback(() => {
    const execId = 'index_' + Date.now();
    addToolExecution(execId, 'index', '.');
    clearExecCache();
    refreshWorkspace();
    completeToolExecution(execId, cachedTreePathsRef.current.length + ' paths indexed');
  }, []);
    const setAgentMode = useCallback((mode: string) => { setAgentModeState(mode); }, []);
    const addAttachment = useCallback((type: string, name: string, path: string) => {
    const id = 'a' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1000));
    replaceAttachments([...stateRef.current.attachments, { id, type, name, path }]);
  }, []);
    const removeAttachment = useCallback((id: string) => { replaceAttachments(stateRef.current.attachments.filter((a: any) => a.id !== id)); }, []);
    const clearAttachments = useCallback(() => { replaceAttachments([]); }, []);
    const attachCurrentFile = useCallback(() => {
    if (stateRef.current.currentFilePath === '__landing__') { addAttachment('workspace', stateRef.current.workspaceName, stateRef.current.workDir || '.'); return; }
    if (stateRef.current.currentFilePath === '__settings__') { addAttachment('surface', 'Settings', '__settings__'); return; }
    addAttachment('file', baseName(stateRef.current.currentFilePath), stateRef.current.currentFilePath);
  }, []);
    const attachGitContext = useCallback(() => { addAttachment('git', stateRef.current.gitBranch + ' diff', 'git-status'); }, []);
    const triggerSymbolMention = useCallback(() => {
    if (stateRef.current.currentFilePath !== '__landing__' && stateRef.current.currentFilePath !== '__settings__') {
      addAttachment('symbol', baseName(stateRef.current.currentFilePath) + ':focus', stateRef.current.currentFilePath);
    }
  }, []);
    const toggleWebSearch = useCallback(() => { setWebSearchState((prev: number) => prev ? 0 : 1); }, []);
    const toggleTermAccess = useCallback(() => { setTermAccessState((prev: number) => prev ? 0 : 1); }, []);
    const toggleAutoApply = useCallback(() => { setAutoApplyState((prev: number) => prev ? 0 : 1); }, []);
    const cycleModel = useCallback(() => {
    const models = stateRef.current.providerConfigs
      .filter((provider: ProviderConfig) => provider.enabled)
      .flatMap((provider: ProviderConfig) => provider.models);
    let idx = models.findIndex((model) => model.id === stateRef.current.selectedModel);
    if (idx < 0) idx = 0;
    const next = models[(idx + 1) % models.length] || models[0];
    if (next) {
      setSelectedModel(next.id);
      setModelDisplayName(next.displayName);
      setSelectedProviderId(next.provider);
    }
  }, []);
    const selectModel = useCallback((modelId: string, displayName: string, provider: ProviderType) => {
    setSelectedModel(modelId);
    setModelDisplayName(displayName);
    setSelectedProviderId(provider);
  }, []);
    const updateProviderConfig = useCallback((providerType: ProviderType, patch: Partial<ProviderConfig>) => {
    setProviderConfigs((prev) => prev.map((provider: ProviderConfig) => provider.type === providerType ? { ...provider, ...patch } : provider));
  }, []);
    const toggleProviderEnabled = useCallback((providerType: ProviderType) => {
    setProviderConfigs((prev) => {
      const next = prev.map((provider: ProviderConfig) => provider.type === providerType ? { ...provider, enabled: !provider.enabled } : provider);
      const selected = next.find((provider: ProviderConfig) => provider.type === stateRef.current.selectedProviderId);
      if (selected && !selected.enabled) {
        const fallback = next.find((provider: ProviderConfig) => provider.enabled);
        if (fallback) setSelectedProviderId(fallback.type);
      }
      return next;
    });
  }, []);
    const startNewConversation = useCallback(() => {
    setChatMessages(buildSeedMessages(stateRef.current.gitBranch, stateRef.current.changedCount, stateRef.current.workDir || '.', stateRef.current.modelDisplayName || 'AI'));
    replaceAttachments([]); replaceComposer(''); setIsGenerating(0);
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('agent');
  }, []);

    const closeBackendSession = useCallback(() => {
    if (stateRef.current.activeBackend === 'claude') claude_close();
    else if (stateRef.current.activeBackend === 'kimi') kimi_close();
    setActiveBackend(''); setActiveSessionModel(''); setSessionInitState(0);
  }, []);

    const ensureBackendConnected = useCallback((backend: string, model: string): boolean => {
    if (stateRef.current.sessionInitState === 1 && stateRef.current.activeBackend === backend && stateRef.current.activeSessionModel === model) {
      return true;
    }
    if (stateRef.current.activeBackend && stateRef.current.activeBackend !== backend) {
      closeBackendSession();
    }
    const cwd = stateRef.current.workDir || '.';
    let ok = 0;
    if (backend === 'claude') ok = claude_init(cwd, model);
    else if (backend === 'kimi') ok = kimi_init(cwd, model);
    if (ok) {
      setActiveBackend(backend); setActiveSessionModel(model); setSessionInitState(1);
      return true;
    }
    setActiveBackend(backend); setActiveSessionModel(model); setSessionInitState(2);
    return false;
  }, []);

  const assistantBufferRef = useRef('');
  const streamingMsgIdRef = useRef('');

    const sendMessage = useCallback((forceText?: string) => {
    let inputText = forceText ?? stateRef.current.currentInput;
    if (inputText.length === 0 && stateRef.current.attachments.length === 0) return;
    // Expand variables before sending
    const expanded = expandVariables(inputText, {
      workDir: stateRef.current.workDir || '.',
      gitBranch: stateRef.current.gitBranch || 'main',
      userName: 'user',
    });
    if (expanded.some(r => r.data !== undefined)) {
      inputText = expanded.reduce((text, r) => {
        if (r.data !== undefined) {
          return text.replace(new RegExp('\\{\\{' + r.variable + '\\}\\}', 'g'), r.data);
        }
        return text;
      }, inputText);
    }
    const text = inputText.length > 0 ? inputText : '[attached ' + stateRef.current.attachments.length + ' context item(s)]';
    const nextMessages: Message[] = [...stateRef.current.chatMessages, { role: 'user', time: 'now', text, mode: stateRef.current.agentMode, model: stateRef.current.selectedModel, attachments: stateRef.current.attachments }];
    setChatMessages(nextMessages);
    setCurrentInputState(''); setAttachmentsState([]); setInputTokenEstimateState(0); setIsGenerating(1); setAgentStatusText('streaming'); setToolExecutions([]);

    if (stateRef.current.agentMode === 'agent') {
      const agentId = 'agent_' + Date.now();
      setActiveAgentId(agentId); setAgentStatusText('executing');
      const backend = backendForModel(stateRef.current.selectedModel);
      const connected = ensureBackendConnected(backend, stateRef.current.selectedModel);
      if (connected) {
        const ok = backend === 'claude' ? claude_send(text) : kimi_send(text);
        if (!ok) {
          setChatMessages([...nextMessages, { role: 'assistant', time: 'now', model: stateRef.current.selectedModel, text: 'Agent send failed. The backend session may have exited.' }]);
          setIsGenerating(0); setAgentStatusText('idle'); setActiveAgentId(''); return;
        }
        setChatMessages([...nextMessages, { role: 'assistant', time: 'now', model: stateRef.current.selectedModel, text: 'Background agent launched. Streaming responses will appear as they arrive.' }]);
        streamingMsgIdRef.current = 'agent_' + agentId;
      } else {
        setChatMessages([...nextMessages, { role: 'assistant', time: 'now', model: stateRef.current.selectedModel, text: 'Background agent mode: backend CLI not on PATH. The shell tracks the agent session, but no external worker is wired.' }]);
        setIsGenerating(0); setAgentStatusText('idle'); setActiveAgentId('');
      }
      return;
    }

    const toolSnapshot: ToolExecution[] = [];
    if (stateRef.current.termAccess) {
      toolSnapshot.push({ id: 'glob_' + Date.now(), name: 'glob', input: 'workspace scan', status: 'completed', percent: 100, result: cachedTreePathsRef.current.length + ' indexed paths' });
      toolSnapshot.push({ id: 'git_' + (Date.now() + 1), name: 'git', input: 'status --short', status: 'completed', percent: 100, result: stateRef.current.changedCount + ' dirty / ' + stateRef.current.stagedCount + ' staged' });
    }
    const llmId = 'llm_' + Date.now();
    setToolExecutions([...toolSnapshot, { id: llmId, name: 'LLM', input: stateRef.current.selectedModel + ': ' + text.slice(0, 48), status: 'running', percent: 20, result: '' }]);

    const backend = backendForModel(stateRef.current.selectedModel);
    const connected = ensureBackendConnected(backend, stateRef.current.selectedModel);
    if (!connected) {
      const fallback = 'Backend ' + backend + ' (' + stateRef.current.selectedModel + ') is not wired on this build. Install the CLI and restart to use live model streaming.';
      const llmDone = { id: llmId, name: 'LLM', input: stateRef.current.selectedModel + ': ' + text.slice(0, 48), status: 'error', percent: 0, result: fallback };
      setToolExecutions([...toolSnapshot, llmDone]);
      setChatMessages([...nextMessages, { role: 'assistant', time: 'now', text: fallback, model: stateRef.current.selectedModel, toolSnapshot: [...toolSnapshot, llmDone] }]);
      setIsGenerating(0); setAgentStatusText('idle'); return;
    }

    const ok = backend === 'claude' ? claude_send(text) : kimi_send(text);
    if (!ok) {
      const fail = 'Send failed — the backend session may have exited.';
      const llmDone = { id: llmId, name: 'LLM', input: stateRef.current.selectedModel + ': ' + text.slice(0, 48), status: 'error', percent: 0, result: fail };
      setToolExecutions([...toolSnapshot, llmDone]);
      setChatMessages([...nextMessages, { role: 'assistant', time: 'now', text: fail, model: stateRef.current.selectedModel, toolSnapshot: [...toolSnapshot, llmDone] }]);
      setIsGenerating(0); setAgentStatusText('idle'); return;
    }

    assistantBufferRef.current = '';
    streamingMsgIdRef.current = llmId;
    setChatMessages([...nextMessages, { role: 'assistant', time: 'now', text: '', model: stateRef.current.selectedModel, toolSnapshot: toolSnapshot }]);
  }, []);

    const finalizeStream = useCallback((finalText: string, toolSnapshot: ToolExecution[]) => {
    setChatMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        const updated = [...prev.slice(0, -1), { ...last, text: finalText, toolSnapshot }];
        // Save checkpoint after assistant turn
        try {
          const turnIndex = updated.filter((m: Message) => m.role === 'assistant').length;
          saveCheckpoint(turnIndex, last.id || 'msg_' + Date.now(), stateRef.current.workDir);
        } catch {}
        return updated;
      }
      return prev;
    });
  }, []);

    const appendStreamChunk = useCallback((chunk: string) => {
    assistantBufferRef.current += chunk;
    const buf = assistantBufferRef.current;
    setChatMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        return [...prev.slice(0, -1), { ...last, text: buf }];
      }
      return prev;
    });
  }, []);

    const stopBackgroundAgent = useCallback(() => {
    closeBackendSession();
    setActiveAgentId(''); setAgentStatusText('idle'); setIsGenerating(0);
  }, []);

    const pushTerminalHistory = useCallback((kind: string, title: string, detail: string, path?: string) => {
    const entry: TerminalHistoryEntry = {
      id: 'term_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      kind,
      title,
      detail,
      time: Date.now(),
      path,
    };
    setTerminalHistory((prev) => [entry, ...prev].slice(0, 14));
  }, []);

    const startTerminalRecording = useCallback(() => {
    if (typeof host.__rec_start !== 'function') return;
    if (typeof host.__rec_is_recording === 'function' && host.__rec_is_recording()) return;
    host.__rec_start();
    setTerminalRecording(1);
    pushTerminalHistory('record', 'Recording started', 'terminal output is now being captured');
  }, []);

    const stopAndSaveTerminalRecording = useCallback((reason: string) => {
    const isRecording = typeof host.__rec_is_recording === 'function' ? host.__rec_is_recording() : 0;
    if (!isRecording || typeof host.__rec_save !== 'function' || typeof host.__rec_stop !== 'function') return;
    const path = '/tmp/cursor-ide-terminal-' + Date.now() + '.trec';
    const ok = host.__rec_save(path);
    host.__rec_stop();
    setTerminalRecording(0);
    setTerminalRecordFrames(0);
    if (ok) {
      pushTerminalHistory('snapshot', reason, 'saved terminal recording', path);
    } else {
      pushTerminalHistory('snapshot', reason, 'failed to save terminal recording');
    }
  }, []);

    const openTerminal = useCallback(() => {
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('terminal');
    setTerminalPane('live');
    startTerminalRecording();
    pushTerminalHistory('session', 'Terminal opened', stateRef.current.workDir + ' • ' + stateRef.current.gitBranch);
  }, []);

    const closeTerminalSurface = useCallback((reason: string) => {
    stopTerminalDockResize();
    setShowTerminal(0);
    setTerminalDockExpanded(0);
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') {
      setCompactSurface(mainSurface);
    }
    stopAndSaveTerminalRecording(reason);
    pushTerminalHistory('session', 'Terminal closed', reason);
  }, []);

    const toggleTerminalDockExpanded = useCallback(() => {
    stopTerminalDockResize();
    const next = terminalDockExpanded ? 0 : 1;
    setTerminalDockExpanded(next);
    pushTerminalHistory(next ? 'layout' : 'layout', next ? 'Terminal expanded' : 'Terminal collapsed', stateRef.current.workDir);
  }, []);

    const stopTerminalDockResize = useCallback(() => {
    if (typeof host.__endTerminalDockResize === 'function') {
      host.__endTerminalDockResize();
    }
  }, []);

    const beginTerminalDockResize = useCallback(() => {
    const begin = typeof host.__beginTerminalDockResize === 'function' ? host.__beginTerminalDockResize : null;
    const getMouseY = typeof host.getMouseY === 'function' ? host.getMouseY : null;
    if (!begin || !getMouseY) return;
    begin(Number(getMouseY()), clampTerminalDockHeight(stateRef.current.terminalDockHeight || 250));
  }, []);

    const toggleTerminalRecording = useCallback(() => {
    if (terminalRecording) {
      stopAndSaveTerminalRecording('manual stop');
      pushTerminalHistory('record', 'Recording stopped', 'manual stop');
    } else {
      startTerminalRecording();
    }
  }, []);

    const saveTerminalSnapshot = useCallback(() => {
    if (typeof host.__rec_save !== 'function') return;
    if (!(typeof host.__rec_is_recording === 'function' ? host.__rec_is_recording() : 0)) startTerminalRecording();
    const path = '/tmp/cursor-ide-terminal-' + Date.now() + '.trec';
    const ok = host.__rec_save(path);
    if (ok) pushTerminalHistory('snapshot', 'Snapshot saved', 'saved terminal recording', path);
    else pushTerminalHistory('snapshot', 'Snapshot failed', 'unable to save terminal recording');
  }, []);

    const loadTerminalPlayback = useCallback(() => {
    if (typeof host.__play_load !== 'function') return;
    const ok = host.__play_load();
    pushTerminalHistory('playback', ok ? 'Playback loaded' : 'Playback unavailable', ok ? 'loaded current recorder buffer' : 'no recorder buffer to load');
  }, []);

    const toggleTerminalPlayback = useCallback(() => {
    if (typeof host.__play_toggle !== 'function') return;
    host.__play_toggle();
    pushTerminalHistory('playback', 'Playback toggled', 'current recorder playback state changed');
  }, []);

    const stepTerminalPlayback = useCallback(() => {
    if (typeof host.__play_step !== 'function') return;
    host.__play_step();
    pushTerminalHistory('playback', 'Playback stepped', 'advanced current recorder by one step');
  }, []);

    const clearTerminalHistory = useCallback(() => {
    setTerminalHistory([]);
  }, []);
    const selectSlashCommand = useCallback((cmd: string) => { replaceComposer(cmd + ' '); }, []);
    const sendSteerMessage = useCallback((message: string) => {
    sendMessage(message);
  }, []);

  // ── Lint / error count (basic) ──────────────────────────────────────
  const refreshDiagnostics = useCallback(() => {
    const path = stateRef.current.currentFilePath;
    if (!path || path === '__landing__' || path === '__settings__') { setErrors(0); setWarnings(0); return; }
    const type = inferFileType(path);
    if (type === 'tsx' || type === 'ts') {
      execAsync('npx tsc --noEmit --pretty false ' + path + ' 2>/dev/null || true').then((res) => {
        // Stale-result guard: if the user switched files before tsc finished,
        // drop this result.
        if (stateRef.current.currentFilePath !== path) return;
        const raw = res.stdout.trim();
        let e = 0, w = 0;
        for (const line of raw.split('\n')) {
          if (line.includes('error TS')) e++;
          else if (line.includes('warning TS')) w++;
        }
        setErrors(e); setWarnings(w);
      });
    } else if (type === 'zig') {
      execAsync('zig ast-check ' + path + ' 2>/dev/null || true').then((res) => {
        if (stateRef.current.currentFilePath !== path) return;
        const raw = res.stdout.trim();
        let e = 0;
        for (const line of raw.split('\n')) { if (line.includes('error:')) e++; }
        setErrors(e); setWarnings(0);
      });
    } else {
      setErrors(0); setWarnings(0);
    }
  }, []);

  useEffect(() => {
    syncWindowMetrics();
    refreshWorkspace();
    setSearchResults(recentSearchFallback());
    const timer = setInterval(syncWindowMetrics, 120);
    const diagTimer = setInterval(refreshDiagnostics, 8000);
    return () => { clearInterval(timer); clearInterval(diagTimer); stopTerminalDockResize(); };
  }, []);

  useEffect(() => {
    const next = clampTerminalDockHeight(terminalDockHeight);
    if (next !== terminalDockHeight) setTerminalDockHeight(next);
  }, [windowHeight, terminalDockHeight]);

  // ── Plugin system init ─────────────────────────────────────────────
  useEffect(() => {
    try {
      const registry = loadPlugins(React, {
        Box, Col, Pressable, Row, ScrollView, Text, TextInput,
      });
      setPluginRegistry(registry);
      const unsub = registry.onNotification((n) => {
        setPluginNotifications((prev) => [...prev.slice(-9), n]);
      });
      return unsub;
    } catch (e: any) {
      console.error('[plugin] init failed:', e?.message || String(e));
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const recIsRecording = typeof host.__rec_is_recording === 'function' ? host.__rec_is_recording() : 0;
      const frameCount = typeof host.__rec_frame_count === 'function' ? host.__rec_frame_count() : 0;
      const playState = typeof host.__play_state === 'function' ? host.__play_state() : null;
      setTerminalRecording(recIsRecording ? 1 : 0);
      setTerminalRecordFrames(frameCount || 0);
      setTerminalPlaybackState(playState || null);
    }, 240);
    return () => clearInterval(id);
  }, []);

  // Diagnostics run via execAsync (detached thread on the host, __ffiEmit on
  // completion). Click handler returns immediately; the error/warning badges
  // update a few seconds later when tsc finishes.
  useEffect(() => { refreshDiagnostics(); }, [currentFilePath]);

  // ── Backend poll loop (aligned with cart/cockpit) ──────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const backend = stateRef.current.activeBackend;
      if (!backend || stateRef.current.sessionInitState !== 1) return;
      let drained = 0;
      while (drained < 8) {
        let evt: any = null;
        if (backend === 'claude') evt = claude_poll();
        else if (backend === 'kimi') evt = kimi_poll();
        if (!evt) break;
        drained += 1;
        if (evt.type === 'assistant') {
          if (evt.text) appendStreamChunk(evt.text);
        } else if (evt.type === 'result') {
          const finalText = assistantBufferRef.current || (evt.result ? String(evt.result) : 'Done.');
          const toolSnapshot = stateRef.current.toolExecutions.map((t: ToolExecution) => ({ ...t, status: 'completed', percent: 100 }));
          finalizeStream(finalText, toolSnapshot);
          setIsGenerating(0); setAgentStatusText('idle'); setActiveAgentId('');
          assistantBufferRef.current = '';
        } else if (evt.type === 'system') {
          // session metadata — ignore for now
        }
      }
    }, 60);
    return () => clearInterval(id);
  }, []);

  const mainSurface = primaryMainView(activeView, currentFilePath);
  const compactMode = widthBand === 'narrow' || widthBand === 'widget' || widthBand === 'minimum';

  // ── Command palette commands ───────────────────────────────────────
  const paletteCommands: PaletteCommand[] = [
    { id: 'nav.home', label: 'Open Projects', category: 'Navigation', action: openLandingPage },
    { id: 'nav.settings', label: 'Open Settings', category: 'Navigation', action: openSettingsSurface },
    { id: 'nav.cockpit', label: 'Open Cockpit (Worker Supervisor)', category: 'Navigation', action: openCockpitSurface },
    { id: 'nav.mermaid', label: 'Open Mermaid Canvas', category: 'Navigation', action: openMermaidSurface },
    { id: 'nav.search', label: 'Toggle Search', category: 'Navigation', action: () => { setShowSearch(showSearch ? 0 : 1); if (!showSearch) searchProject(searchQuery); } },
    { id: 'nav.terminal', label: 'Toggle Terminal', category: 'Navigation', action: () => { if (showTerminal) closeTerminalSurface('palette toggle off'); else { openTerminal(); setShowTerminal(1); setTerminalDockExpanded(0); } } },
    { id: 'nav.chat', label: 'Toggle Agent Chat', category: 'Navigation', action: () => { setShowChat(showChat ? 0 : 1); } },
    { id: 'nav.hot', label: 'Toggle Hot Panel', category: 'Navigation', action: () => { setShowHotPanel(showHotPanel ? 0 : 1); } },
    { id: 'nav.git', label: 'Toggle Git Panel', category: 'Navigation', action: () => { setShowGitPanel(showGitPanel ? 0 : 1); } },
    { id: 'nav.plan', label: 'Toggle Plan Canvas', category: 'Navigation', action: () => { setShowPlanPanel(showPlanPanel ? 0 : 1); } },

    { id: 'file.new', label: 'New File', category: 'File', action: createNewFile },
    { id: 'file.save', label: 'Save Current File', category: 'File', action: saveCurrentFile },
    { id: 'workspace.refresh', label: 'Refresh Workspace', category: 'Workspace', action: refreshWorkspace },
    { id: 'workspace.index', label: 'Index Project', category: 'Workspace', action: indexProject },
    { id: 'chat.new', label: 'New Conversation', category: 'Agent', action: startNewConversation },
    { id: 'chat.send', label: 'Send Message', category: 'Agent', action: sendMessage },
    { id: 'model.cycle', label: 'Cycle Model', category: 'Agent', action: cycleModel },
    { id: 'agent.stop', label: 'Stop Background Agent', category: 'Agent', action: stopBackgroundAgent },
  ];
  if (pluginRegistry) {
    pluginRegistry.commands.forEach((cmd, id) => {
      paletteCommands.push({ id, label: cmd.label, category: 'Plugins', action: cmd.callback });
    });
  }
  const widgetMode = widthBand === 'widget';
  const minimumMode = widthBand === 'minimum';
  const mediumMode = widthBand === 'medium';
  const rightRail = showSearch ? 'search' : showChat ? 'agent' : '';

  // Stable style/handler refs so memo'd surfaces can bail out on unchanged input.
  // Without these, every App render creates fresh `style={{...}}` + `onX={() => ...}`
  // identities and every memo'd child re-renders. This was the actual 1800ms fix.
  const sidebarStyle = useMemo(() => ({ width: '100%', borderRightWidth: 0 }), []);
  const fullWidthStyle = useMemo(() => ({ width: '100%' }), []);
  const searchWideStyle = useMemo(() => ({ width: mediumMode ? 320 : 390 }), [mediumMode]);
  const chatWideStyle = useMemo(() => ({ width: mediumMode ? 340 : 420 }), [mediumMode]);
  const closeSearchToMainSurface = useCallback(() => {
    setShowSearch(0);
    const ms = primaryMainView(stateRef.current.activeView, stateRef.current.currentFilePath);
    setCompactSurface(ms);
  }, []);
  const closeSearchOnly = useCallback(() => setShowSearch(0), []);
  const onChatInputChange = useCallback((value: string) => replaceComposer(value), []);
  let tabsForBar = openTabs;
  let landingStats = workspaceStats;
  let landingRecent = landingRecentFiles;
  let landingConnections = gitConnections;
  if (compactMode) {
    tabsForBar = minimumMode ? visibleTabs(openTabs, activeTabId, 2) : widgetMode ? visibleTabs(openTabs, activeTabId, 3) : visibleTabs(openTabs, activeTabId, 4);
  } else if (mediumMode) {
    tabsForBar = visibleTabs(openTabs, activeTabId, 6);
  }
  if (minimumMode) landingStats = takeList(workspaceStats, 2);
  else if (widgetMode) landingStats = takeList(workspaceStats, 3);
  if (minimumMode) landingRecent = takeList(landingRecentFiles, 3);
  else if (widgetMode) landingRecent = takeList(landingRecentFiles, 4);
  else if (compactMode) landingRecent = takeList(landingRecentFiles, 5);
  if (compactMode) landingConnections = widgetMode ? takeList(gitConnections, 3) : takeList(gitConnections, 4);
  const showStatusBar = !minimumMode && windowHeight >= 300;
  const showDockedSearch = !compactMode && rightRail === 'search';
  const showDockedChat = !compactMode && rightRail === 'agent';
  const showTerminalPanel = showTerminal === 1 && !compactMode;
  const showDockedHot = showHotPanel === 1 && !compactMode;
  const showDockedGit = showGitPanel === 1 && !compactMode;
  const showDockedPlan = showPlanPanel === 1 && !compactMode;
  const compactMainView = compactSurface === 'landing' ? 'landing' : compactSurface === 'settings' ? 'settings' : compactSurface === 'cockpit' ? 'cockpit' : 'editor';
  const dockedTerminalHeight = clampTerminalDockHeight(terminalDockHeight);
  const todoAction = useCallback((label: string) => () => {
    console.log('[cursor-ide] TODO: ' + label);
  }, []);
  const toggleSearchSurface = useCallback(() => {
    if (compactMode) {
      if (compactSurface === 'search') { setShowSearch(0); setCompactSurface(mainSurface); }
      else { setShowSearch(1); searchProject(searchQuery); setCompactSurface('search'); }
    } else {
      const next = showSearch ? 0 : 1;
      setShowSearch(next);
      if (next) searchProject(searchQuery);
    }
  }, [compactMode, compactSurface, mainSurface, searchProject, searchQuery, setShowSearch, showSearch]);
  const toggleTerminalSurface = useCallback(() => {
    if (compactMode) {
      if (compactSurface === 'terminal') { closeTerminalSurface('compact close'); setCompactSurface(mainSurface); }
      else { openTerminal(); setShowTerminal(1); setTerminalDockExpanded(0); setCompactSurface('terminal'); }
    } else {
      if (showTerminal) { closeTerminalSurface('toggle off'); }
      else { openTerminal(); setShowTerminal(1); setTerminalDockExpanded(0); }
    }
  }, [closeTerminalSurface, compactMode, compactSurface, mainSurface, openTerminal, showTerminal]);
  const toggleHotSurface = useCallback(() => {
    if (compactMode) {
      if (compactSurface === 'hot') { setShowHotPanel(0); setCompactSurface(mainSurface); }
      else { setShowHotPanel(1); setCompactSurface('hot'); }
    } else { setShowHotPanel(showHotPanel ? 0 : 1); }
  }, [compactMode, compactSurface, mainSurface, showHotPanel]);
  const toggleGitSurface = useCallback(() => {
    if (compactMode) {
      if (compactSurface === 'git') { setShowGitPanel(0); setCompactSurface(mainSurface); }
      else { setShowGitPanel(1); setCompactSurface('git'); }
    } else { setShowGitPanel(showGitPanel ? 0 : 1); }
  }, [compactMode, compactSurface, mainSurface, showGitPanel]);
  const togglePlanSurface = useCallback(() => {
    if (compactMode) {
      if (compactSurface === 'plan') { setShowPlanPanel(0); setCompactSurface(mainSurface); }
      else { setShowPlanPanel(1); setCompactSurface('plan'); }
    } else { setShowPlanPanel(showPlanPanel ? 0 : 1); }
  }, [compactMode, compactSurface, mainSurface, showPlanPanel]);
  const toggleChatSurface = useCallback(() => {
    if (compactMode) {
      if (compactSurface === 'agent') { setShowChat(0); setCompactSurface(mainSurface); }
      else { setShowChat(1); setCompactSurface('agent'); }
    } else { setShowChat(showChat ? 0 : 1); }
  }, [compactMode, compactSurface, mainSurface, showChat]);
  const toggleSidebarSurface = useCallback(() => {
    console.log('[cursor-ide] TODO: View > Toggle Sidebar');
  }, []);
  const zoomIn = useCallback(() => {
    console.log('[cursor-ide] TODO: View > Zoom In');
  }, []);
  const zoomOut = useCallback(() => {
    console.log('[cursor-ide] TODO: View > Zoom Out');
  }, []);
  const resetZoom = useCallback(() => {
    console.log('[cursor-ide] TODO: View > Reset Zoom');
  }, []);
  const openDocs = useCallback(() => {
    console.log('[cursor-ide] TODO: Help > Docs');
  }, []);
  const showAbout = useCallback(() => {
    console.log('[cursor-ide] TODO: Help > About');
  }, []);
  const menuSections: MenuBarSection[] = [
    {
      label: 'File',
      items: [
        { label: 'New', shortcut: 'Ctrl+N', action: createNewFile },
        { label: 'Open', shortcut: 'Ctrl+O', action: openLandingPage },
        { label: 'Save', shortcut: 'Ctrl+S', action: saveCurrentFile },
        { label: 'Close', shortcut: 'Ctrl+W', action: closeCurrentFile },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: todoAction('Edit > Undo') },
        { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: todoAction('Edit > Redo') },
        { label: 'Cut', shortcut: 'Ctrl+X', action: todoAction('Edit > Cut') },
        { label: 'Copy', shortcut: 'Ctrl+C', action: todoAction('Edit > Copy') },
        { label: 'Paste', shortcut: 'Ctrl+V', action: todoAction('Edit > Paste') },
        { kind: 'separator', label: '' },
        { label: 'Find', shortcut: 'Ctrl+F', action: toggleSearchSurface },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Toggle Sidebar', action: toggleSidebarSurface },
        { label: 'Toggle Terminal', action: toggleTerminalSurface },
        { label: 'Mermaid Canvas', action: openMermaidSurface },
        { label: 'Command Palette', shortcut: 'Ctrl+K', action: () => setShowPalette(1) },
        { kind: 'separator', label: '' },
        { label: 'Zoom In', shortcut: 'Ctrl++', action: zoomIn },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: zoomOut },
        { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: resetZoom },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Docs', action: openDocs },
        { label: 'About', action: showAbout },
      ],
    },
  ];
  const settingsSections = [
    { id: 'providers', label: 'Providers', meta: 'model routing + auth + components', tone: '#79c0ff', icon: 'globe', count: String(providerConfigs.filter((provider: ProviderConfig) => provider.enabled).length) + '/' + String(providerConfigs.length) },
    { id: 'defaults', label: 'Defaults', meta: 'default models per task type', tone: '#ff7b72', icon: 'bot', count: '5' },
    { id: 'variables', label: 'Variables', meta: 'system + custom variable expansion', tone: '#d2a8ff', icon: 'braces', count: String(listCustomVariables().length) },
    { id: 'proxy', label: 'Proxy', meta: 'http/socks5 proxy routing', tone: '#7ee787', icon: 'network', count: String(proxyConfigs.length) },
    { id: 'context', label: 'Context', meta: 'workspace + git + external sources', tone: '#7ee787', icon: 'folder', count: String(SETTINGS_CONTEXT_ROWS.length) },
    { id: 'memory', label: 'Memory', meta: 'session + sqlite + transcript stores', tone: '#d2a8ff', icon: 'bot', count: String(SETTINGS_MEMORY_ROWS.length) },
    { id: 'plugins', label: 'Plugins', meta: 'lua + qjs + marketplace parity', tone: '#ffa657', icon: 'palette', count: String(SETTINGS_PLUGIN_ROWS.length) },
    { id: 'automations', label: 'Automations', meta: 'ifttt rules + build hooks', tone: '#ff7b72', icon: 'sparkles', count: String(SETTINGS_AUTOMATION_ROWS.length) },
    { id: 'capabilities', label: 'Capabilities', meta: 'existing runtime references to bake in', tone: '#ffb86b', icon: 'braces', count: String(SETTINGS_CAPABILITY_ROWS.length) },
    { id: 'checkpoints', label: 'Checkpoints', meta: 'diff per AI turn', tone: '#79c0ff', icon: 'git-commit', count: String(loadCheckpoints().length) },
  ];
  const renderMainSurface = (mode: 'landing' | 'settings' | 'editor' | 'cockpit') => {
    if (mode === 'cockpit') {
      return <FadeIn delay={0} style={{ width: '100%', height: '100%', flexGrow: 1, flexBasis: 0, minHeight: 0 }}><WorkerCanvas widthBand={widthBand} windowHeight={windowHeight} /></FadeIn>;
    }
    if (mode === 'landing') {
      return (
        <FadeIn delay={0} style={{ width: '100%', height: '100%', flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          <LandingSurface workspaceName={workspaceName} workspaceTagline={workspaceTagline} workDir={workDir} gitBranch={gitBranch} gitRemote={gitRemote} branchAhead={branchAhead} branchBehind={branchBehind} changedCount={changedCount} stagedCount={stagedCount} widthBand={widthBand} stats={landingStats} projects={landingProjects} recentFiles={landingRecent} connections={landingConnections} onOpenPath={openFileByPath} onIndexWorkspace={indexProject} onOpenSettings={openSettingsSurface} />
        </FadeIn>
      );
    }

    if (mode === 'settings') {
      return (
        <FadeIn delay={0} style={{ width: '100%', height: '100%', flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          <SettingsSurface activeSection={settingsSection} selectedProviderId={selectedProviderId} selectedModelName={modelDisplayName} workspaceName={workspaceName} gitBranch={gitBranch} agentStatusText={agentStatusText} workDir={workDir} widthBand={widthBand} sections={settingsSections} providers={SETTINGS_PROVIDERS} providerConfigs={providerConfigs} contextRows={SETTINGS_CONTEXT_ROWS} memoryRows={SETTINGS_MEMORY_ROWS} pluginRows={SETTINGS_PLUGIN_ROWS} automationRows={SETTINGS_AUTOMATION_ROWS} capabilityRows={SETTINGS_CAPABILITY_ROWS} defaultModels={defaultModels} proxyConfigs={proxyConfigs} proxyStatus={proxyStatus} checkpoints={loadCheckpoints()} onSelectSection={setSettingsSection} onSelectProvider={setSelectedProviderId} onToggleProvider={toggleProviderEnabled} onUpdateProvider={updateProviderConfig} onSelectModel={selectModel} onUpdateDefaultModels={(s: DefaultModelsSettings) => { setDefaultModels(s); saveDefaultModels(s); }} onVariablesChange={() => {}} onProxyChange={() => { setProxyConfigs(listProxyConfigs()); setProxyStatus(getProxyStatus()); }} onKeysChange={() => {}} onIndexChange={() => {}} onSelectCheckpoint={(id: string) => setSettingsSection('checkpoints')} />
        </FadeIn>
      );
    }

    if (currentFilePath === '__mermaid__') {
      return (
        <FadeIn delay={0} style={{ width: '100%', height: '100%', flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
          <MermaidPanel widthBand={widthBand} title="Mermaid Canvas" onClose={openLandingPage} />
        </FadeIn>
      );
    }

    return (
      <Box style={{ display: 'flex', flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
        <FadeIn delay={0} style={{ width: '100%', height: '100%', flexGrow: 1, flexBasis: 0, minHeight: 0, display: 'flex' }}>
          <EditorSurface content={editorContent} contentHandle={fileContentHandle} editorRows={editorRows} editorColorRows={editorColorRows} largeFileMode={editorLargeFileMode} totalLines={totalLines} cursorLine={cursorPosition.line} cursorColumn={cursorPosition.column} modified={editorModified} currentFilePath={currentFilePath} widthBand={widthBand} windowHeight={windowHeight} onChange={updateEditorContent} onSave={saveCurrentFile} />
        </FadeIn>
      </Box>
    );
  };

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: COLORS.appBg }}>
      <Col style={{ width: '100%', height: '100%' }}>
        <TopBar
          menuSections={menuSections}
          displayTitle={currentFilePath === '__landing__' ? 'Project landing' : currentFilePath === '__settings__' ? 'Settings' : currentFilePath === '__mermaid__' ? 'Mermaid' : minimumMode ? baseName(currentFilePath) : currentFilePath}
          workspaceName={workspaceName}
          gitBranch={gitBranch}
          changedCount={changedCount}
          stagedCount={stagedCount}
          widthBand={widthBand}
          settingsActive={compactMode ? compactSurface === 'settings' : activeView === 'settings'}
          searchActive={compactMode ? compactSurface === 'search' : showDockedSearch}
          chatActive={compactMode ? compactSurface === 'agent' : showDockedChat}
          terminalActive={compactMode ? compactSurface === 'terminal' : showTerminal}
          onOpenHome={openLandingPage}
          onOpenSettings={openSettingsSurface}
          onRefreshWorkspace={refreshWorkspace}
          onToggleChat={toggleChatSurface}
          onToggleTerminal={toggleTerminalSurface}
          onToggleSearch={toggleSearchSurface}
          onToggleHot={toggleHotSurface}
          onToggleGit={toggleGitSurface}
          gitActive={compactMode ? compactSurface === 'git' : showDockedGit}
          onTogglePlan={togglePlanSurface}
          planActive={compactMode ? compactSurface === 'plan' : showDockedPlan}
          onOpenPalette={() => setShowPalette(1)}
          paletteActive={showPalette}
        />

        {compactMode ? (
          <Col style={{ flexGrow: 1, flexBasis: 0 }}>
            <Row style={{ gap: 8, padding: 10, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
              <CompactSurfaceButton label="Files" showLabel={!minimumMode} active={compactSurface === 'explorer'} onPress={() => setCompactSurface('explorer')} icon="folder" />
              {mainSurface === 'landing' ? <CompactSurfaceButton label="Projects" showLabel={!minimumMode} active={compactSurface === 'landing'} onPress={openLandingPage} icon="house" /> : null}
              {mainSurface === 'editor' ? <CompactSurfaceButton label="Editor" showLabel={!minimumMode} active={compactSurface === 'editor'} onPress={() => setCompactSurface('editor')} icon="panel-left" /> : null}
              <CompactSurfaceButton label="Settings" showLabel={!minimumMode} active={compactSurface === 'settings'} onPress={openSettingsSurface} icon="palette" />
              <CompactSurfaceButton label="Cockpit" showLabel={!minimumMode} active={compactSurface === 'cockpit'} onPress={openCockpitSurface} icon="grid" />
              <CompactSurfaceButton label="Search" showLabel={!minimumMode} active={compactSurface === 'search'} onPress={() => { setShowSearch(1); searchProject(searchQuery); setCompactSurface('search'); }} icon="search" />
              <CompactSurfaceButton label="Term" showLabel={!minimumMode} active={compactSurface === 'terminal'} onPress={() => { openTerminal(); setShowTerminal(1); setTerminalDockExpanded(0); setCompactSurface('terminal'); }} icon="terminal" />
              <CompactSurfaceButton label="Hot" showLabel={!minimumMode} active={compactSurface === 'hot'} onPress={() => { setShowHotPanel(1); setCompactSurface('hot'); }} icon="flame" />
              <CompactSurfaceButton label="Git" showLabel={!minimumMode} active={compactSurface === 'git'} onPress={() => { setShowGitPanel(1); setCompactSurface('git'); }} icon="git-branch" />
              <CompactSurfaceButton label="Plan" showLabel={!minimumMode} active={compactSurface === 'plan'} onPress={() => { setShowPlanPanel(1); setCompactSurface('plan'); }} icon="map" />
              <CompactSurfaceButton label="Agent" showLabel={!minimumMode} active={compactSurface === 'agent'} onPress={() => { setShowChat(1); setCompactSurface('agent'); }} icon="message" />
            </Row>

            {compactSurface === 'explorer' ? (
              <Sidebar
                files={files}
                tabs={openTabs}
                gitChanges={gitChanges}
                workspaceName={workspaceName}
                workDir={workDir}
                gitBranch={gitBranch}
                changedCount={changedCount}
                stagedCount={stagedCount}
                currentFilePath={currentFilePath}
                widthBand={widthBand}
                style={sidebarStyle}
                multiPanel={false}
                dockPanels={dockPanels}
                onOpenHome={openLandingPage}
                onRefreshWorkspace={refreshWorkspace}
                onSelectPath={openFileByPath}
                onCreateFile={createNewFile}
                onFocusDockPanel={focusDockPanel}
                onCloseDockPanel={closeDockPanel}
              />
            ) : null}

            {showNewFileInput && compactSurface === 'explorer' ? (
              <Box style={{ padding: 12, gap: 8, backgroundColor: COLORS.panelBg }}>
                <Text fontSize={10} color={COLORS.textMuted}>New file name</Text>
                <TextInput value={newFileName} onChange={setNewFileName} fontSize={11} color={COLORS.text} style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, padding: 8 }} />
                <Row style={{ gap: 8 }}>
                  <Pressable onPress={confirmCreateFile} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
                    <Text fontSize={10} color={COLORS.blue}>Create</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowNewFileInput(0)} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                    <Text fontSize={10} color={COLORS.textDim}>Cancel</Text>
                  </Pressable>
                </Row>
              </Box>
            ) : null}

            {compactSurface === 'landing' || compactSurface === 'editor' || compactSurface === 'settings' ? (
              <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
                <TabBar tabs={tabsForBar} activeId={activeTabId} compact={true} onActivate={activateTab} onClose={closeTab} />
                <BreadcrumbBar items={visibleBreadcrumbs(breadcrumbs, widthBand)} compact={true} onOpenHome={openLandingPage} />
                <PageModeTransition mode={compactMainView as any} durationMs={220} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }} renderPage={renderMainSurface} />
              </Col>
            ) : null}

            {compactSurface === 'search' ? (
              <SearchSurface query={searchQuery} results={searchResults} workspaceName={workspaceName} gitBranch={gitBranch} widthBand={widthBand} style={fullWidthStyle} onClose={closeSearchToMainSurface} onQuery={searchProject} onOpenResult={openSearchResult} />
            ) : null}
            {compactSurface === 'hot' ? (
              <HotPanel workDir={workDir} visible={true} onSteer={sendSteerMessage} />
            ) : null}
            {compactSurface === 'git' ? (
              <GitPanel workDir={workDir} gitBranch={gitBranch} changedCount={changedCount} stagedCount={stagedCount} onRefresh={refreshWorkspace} />
            ) : null}
            {compactSurface === 'plan' ? (
              <PlanPanelWrapper workDir={workDir} activePlanId={activePlanId} onChange={(id) => setActivePlanId(id)} onSendToAI={sendMessage} />
            ) : null}
            {compactSurface === 'agent' ? (
              <ChatSurface messages={chatMessages} isGenerating={!!isGenerating} currentFilePath={currentFilePath} gitBranch={gitBranch} gitRemote={gitRemote} changedCount={changedCount} workspaceName={workspaceName} activeView={activeView} widthBand={widthBand} style={fullWidthStyle} selectedModel={selectedModel} currentInput={currentInput} agentMode={agentMode} attachments={attachments} webSearch={!!webSearch} termAccess={!!termAccess} autoApply={!!autoApply} inputTokenEstimate={inputTokenEstimate} modelDisplayName={modelDisplayName} toolExecutions={toolExecutions} activeAgentId={activeAgentId} agentStatusText={agentStatusText} variablePreview={variablePreview} workspaceFiles={cachedTreePathsRef.current} onNewConversation={startNewConversation} onIndex={indexProject} onSetMode={setAgentMode} onInputChange={onChatInputChange} onAttachCurrentFile={attachCurrentFile} onAttachSymbol={triggerSymbolMention} onAttachGit={attachGitContext} onToggleWebSearch={toggleWebSearch} onToggleTermAccess={toggleTermAccess} onToggleAutoApply={toggleAutoApply} onCycleModel={cycleModel} onSend={sendMessage} onRemoveAttachment={removeAttachment} onClearAttachments={clearAttachments} onSelectSlash={selectSlashCommand} onStopAgent={stopBackgroundAgent} />
            ) : null}
            {compactSurface === 'terminal' ? (
              <TerminalPanel
                workDir={workDir}
                gitBranch={gitBranch}
                widthBand={widthBand}
                pane={terminalPane}
                history={terminalHistory}
                recording={terminalRecording}
                recordFrames={terminalRecordFrames}
                playState={terminalPlaybackState}
                expanded={0}
                onSetPane={(pane: string) => setTerminalPane(pane)}
                onToggleExpanded={() => {}}
                onBeginResize={beginTerminalDockResize}
                onToggleRecording={toggleTerminalRecording}
                onSaveSnapshot={saveTerminalSnapshot}
                onLoadPlayback={loadTerminalPlayback}
                onTogglePlayback={toggleTerminalPlayback}
                onStepPlayback={stepTerminalPlayback}
                onJumpLive={() => setTerminalPane('live')}
                onClearHistory={clearTerminalHistory}
                onClose={() => { closeTerminalSurface('compact close'); setCompactSurface(mainSurface); }}
              />
            ) : null}
          </Col>
        ) : (
          <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
            <Sidebar
              files={files}
              tabs={openTabs}
              gitChanges={gitChanges}
              workspaceName={workspaceName}
              workDir={workDir}
              gitBranch={gitBranch}
              changedCount={changedCount}
              stagedCount={stagedCount}
              currentFilePath={currentFilePath}
              widthBand={widthBand}
              style={mediumMode ? { width: 304 } : undefined}
              multiPanel={true}
              dockPanels={dockPanels}
              onOpenHome={openLandingPage}
              onRefreshWorkspace={refreshWorkspace}
              onSelectPath={openFileByPath}
              onCreateFile={createNewFile}
              onFocusDockPanel={focusDockPanel}
              onCloseDockPanel={closeDockPanel}
            />

            {showNewFileInput ? (
              <Box style={{ position: 'absolute', left: 12, top: 60, width: 260, padding: 12, gap: 8, backgroundColor: COLORS.panelRaised, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, zIndex: 10 }}>
                <Text fontSize={10} color={COLORS.textMuted}>New file name</Text>
                <TextInput value={newFileName} onChange={setNewFileName} fontSize={11} color={COLORS.text} style={{ borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, padding: 8 }} />
                <Row style={{ gap: 8 }}>
                  <Pressable onPress={confirmCreateFile} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
                    <Text fontSize={10} color={COLORS.blue}>Create</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowNewFileInput(0)} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
                    <Text fontSize={10} color={COLORS.textDim}>Cancel</Text>
                  </Pressable>
                </Row>
              </Box>
            ) : null}

            <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
              <TabBar tabs={tabsForBar} activeId={activeTabId} compact={false} onActivate={activateTab} onClose={closeTab} />
              <BreadcrumbBar items={visibleBreadcrumbs(breadcrumbs, widthBand)} compact={false} onOpenHome={openLandingPage} />
              <Box style={{ display: showTerminalPanel && terminalDockExpanded ? 'none' : 'flex', flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
                <PageModeTransition mode={activeView as any} durationMs={220} style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }} renderPage={renderMainSurface} />
              </Box>
              {showTerminalPanel ? (
                terminalDockExpanded ? (
                  <TerminalPanel
                    workDir={workDir}
                    gitBranch={gitBranch}
                    widthBand={widthBand}
                    height={'100%'}
                    pane={terminalPane}
                    history={terminalHistory}
                    recording={terminalRecording}
                    recordFrames={terminalRecordFrames}
                    playState={terminalPlaybackState}
                    expanded={terminalDockExpanded}
                    onSetPane={(pane: string) => setTerminalPane(pane)}
                    onToggleExpanded={toggleTerminalDockExpanded}
                    onBeginResize={undefined}
                    onToggleRecording={toggleTerminalRecording}
                    onSaveSnapshot={saveTerminalSnapshot}
                    onLoadPlayback={loadTerminalPlayback}
                    onTogglePlayback={toggleTerminalPlayback}
                    onStepPlayback={stepTerminalPlayback}
                    onJumpLive={() => setTerminalPane('live')}
                    onClearHistory={clearTerminalHistory}
                    onClose={() => closeTerminalSurface('close button')}
                  />
                ) : (
                  <SlideIn from="bottom" delay={0} durationMs={180} style={{ width: '100%', flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
                    <TerminalPanel
                      workDir={workDir}
                      gitBranch={gitBranch}
                      widthBand={widthBand}
                      height={dockedTerminalHeight}
                      pane={terminalPane}
                      history={terminalHistory}
                      recording={terminalRecording}
                      recordFrames={terminalRecordFrames}
                      playState={terminalPlaybackState}
                      expanded={terminalDockExpanded}
                      onSetPane={(pane: string) => setTerminalPane(pane)}
                      onToggleExpanded={toggleTerminalDockExpanded}
                      onBeginResize={beginTerminalDockResize}
                      onToggleRecording={toggleTerminalRecording}
                      onSaveSnapshot={saveTerminalSnapshot}
                      onLoadPlayback={loadTerminalPlayback}
                      onTogglePlayback={toggleTerminalPlayback}
                      onStepPlayback={stepTerminalPlayback}
                      onJumpLive={() => setTerminalPane('live')}
                      onClearHistory={clearTerminalHistory}
                      onClose={() => closeTerminalSurface('close button')}
                    />
                  </SlideIn>
                )
              ) : null}
            </Col>

            {showDockedSearch ? (
              <SearchSurface query={searchQuery} results={searchResults} workspaceName={workspaceName} gitBranch={gitBranch} widthBand={widthBand} style={searchWideStyle} onClose={closeSearchOnly} onQuery={searchProject} onOpenResult={openSearchResult} />
            ) : null}
            {showDockedHot ? (
              <HotPanel workDir={workDir} visible={true} onSteer={sendSteerMessage} />
            ) : null}
            {showDockedGit ? (
              <GitPanel workDir={workDir} gitBranch={gitBranch} changedCount={changedCount} stagedCount={stagedCount} onRefresh={refreshWorkspace} />
            ) : null}
            {showDockedPlan ? (
              <PlanPanelWrapper workDir={workDir} activePlanId={activePlanId} onChange={(id) => setActivePlanId(id)} onSendToAI={sendMessage} />
            ) : null}
            {showDockedChat ? (
              <ChatSurface messages={chatMessages} isGenerating={!!isGenerating} currentFilePath={currentFilePath} gitBranch={gitBranch} gitRemote={gitRemote} changedCount={changedCount} workspaceName={workspaceName} activeView={activeView} widthBand={widthBand} style={chatWideStyle} selectedModel={selectedModel} currentInput={currentInput} agentMode={agentMode} attachments={attachments} webSearch={!!webSearch} termAccess={!!termAccess} autoApply={!!autoApply} inputTokenEstimate={inputTokenEstimate} modelDisplayName={modelDisplayName} toolExecutions={toolExecutions} activeAgentId={activeAgentId} agentStatusText={agentStatusText} variablePreview={variablePreview} workspaceFiles={cachedTreePathsRef.current} onNewConversation={startNewConversation} onIndex={indexProject} onSetMode={setAgentMode} onInputChange={onChatInputChange} onAttachCurrentFile={attachCurrentFile} onAttachSymbol={triggerSymbolMention} onAttachGit={attachGitContext} onToggleWebSearch={toggleWebSearch} onToggleTermAccess={toggleTermAccess} onToggleAutoApply={toggleAutoApply} onCycleModel={cycleModel} onSend={sendMessage} onRemoveAttachment={removeAttachment} onClearAttachments={clearAttachments} onSelectSlash={selectSlashCommand} onStopAgent={stopBackgroundAgent} />
            ) : null}
          </Row>
        )}

        {/* Plugin notifications */}
        {pluginNotifications.length > 0 ? (
          <Box style={{ backgroundColor: COLORS.panelBg, borderTopWidth: 1, borderColor: COLORS.border, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4 }}>
            {pluginNotifications.slice(-3).map((n: any) => (
              <Row key={n.id} style={{ alignItems: 'center', gap: 6 }}>
                <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: n.type === 'error' ? COLORS.red : n.type === 'success' ? COLORS.green : n.type === 'warning' ? COLORS.yellow : COLORS.blue }} />
                <Text fontSize={9} color={COLORS.textDim}>{n.message}</Text>
              </Row>
            ))}
          </Box>
        ) : null}

        {showStatusBar ? (
          <StatusBar
            gitBranch={gitBranch}
            gitStatus={gitStatus}
            gitRemote={gitRemote}
            branchAhead={branchAhead}
            branchBehind={branchBehind}
            changedCount={changedCount}
            stagedCount={stagedCount}
            cursorLine={cursorPosition.line}
            cursorColumn={cursorPosition.column}
            languageMode={languageMode}
            errors={errors}
            warnings={warnings}
            modified={editorModified}
            fileName={currentFilePath}
            workDir={workDir}
            selectedModel={modelDisplayName}
            agentStatusText={agentStatusText}
            widthBand={widthBand}
            indexStats={getIndexStats()}
            inputTokenEstimate={inputTokenEstimate}
            lineEnding={editorContent.includes('\r\n') ? 'CRLF' : 'LF'}
            encoding="UTF-8"
            onOpenGitPanel={() => setShowGitPanel(1)}
            onOpenChat={() => setShowChat(1)}
            onOpenSettings={(section: string) => { setActiveView('settings'); setSettingsSection(section); }}
          />
        ) : null}

        <CommandPalette
          open={showPalette === 1}
          onClose={() => setShowPalette(0)}
          onOpen={openPalette}
          commands={paletteCommands}
          files={cachedTreePathsRef.current}
          settingsSections={settingsSections.map((s: any) => ({ id: s.id, label: s.label }))}
          menuSections={menuSections}
          onOpenFile={loadFileByPath}
          onJumpToSettingsSection={(sectionId: string) => {
            openSettingsSurface();
            setSettingsSection(sectionId);
          }}
        />
      </Col>
    </Box>
  );
}
