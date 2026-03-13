import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text } from './primitives';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { useIFTTT } from './useIFTTT';
import { useMount } from './useLuaEffect';
import type { InputProps, LayoutEvent, Style, TextEditorViewState } from './types';

const DEFAULT_ACTIVITY_ITEMS = ['TAB', 'EX', 'CODE', 'MAP'];

type ViewTarget = 'tabs' | 'explorer' | 'editor' | 'minimap';

const VIEW_TARGET_LABELS: Record<ViewTarget, { label: string; short: string }> = {
  tabs: { label: 'Tabs', short: 'TAB' },
  explorer: { label: 'Files', short: 'FILES' },
  editor: { label: 'Code', short: 'CODE' },
  minimap: { label: 'Map', short: 'MAP' },
};

function resolveActivityTarget(item: string): ViewTarget | null {
  const normalized = item.trim().toLowerCase();
  if (normalized === 'tabs' || normalized === 'tab') return 'tabs';
  if (normalized === 'explorer' || normalized === 'files' || normalized === 'file' || normalized === 'ex') return 'explorer';
  if (normalized === 'editor' || normalized === 'code' || normalized === 'ed') return 'editor';
  if (normalized === 'minimap' || normalized === 'map' || normalized === 'mp') return 'minimap';
  return null;
}

let monacoMirrorInstanceCount = 0;
let shoulderNavigationOwnerId: string | null = null;
const shoulderNavigationOwnerListeners = new Set<(ownerId: string | null) => void>();

function nextMonacoMirrorInstanceId(): string {
  monacoMirrorInstanceCount += 1;
  return `monaco-mirror-${monacoMirrorInstanceCount}`;
}

function setShoulderNavigationOwner(ownerId: string | null) {
  if (shoulderNavigationOwnerId === ownerId) return;
  shoulderNavigationOwnerId = ownerId;
  for (const listener of shoulderNavigationOwnerListeners) listener(ownerId);
}

function subscribeShoulderNavigationOwner(listener: (ownerId: string | null) => void) {
  shoulderNavigationOwnerListeners.add(listener);
  return () => shoulderNavigationOwnerListeners.delete(listener);
}

function inferLanguage(pathOrName: string | undefined, fallback: string): string {
  if (!pathOrName) return fallback;
  const lower = pathOrName.toLowerCase();
  if (lower.endsWith('.tsx') || lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.jsx') || lower.endsWith('.js')) return 'javascript';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.lua')) return 'lua';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html')) return 'html';
  return fallback;
}

function splitPath(input: string): string[] {
  return input.replace(/\\/g, '/').split('/').filter(Boolean);
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim();
}

function dirnamePath(input: string): string {
  const parts = splitPath(normalizePath(input));
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('/');
}

function basenamePath(input: string): string {
  const parts = splitPath(normalizePath(input));
  if (parts.length === 0) return input;
  return parts[parts.length - 1];
}

function compactParentLabel(input: string, fallback: string): string {
  const dir = dirnamePath(input);
  if (!dir) return fallback;
  const parts = splitPath(dir);
  if (parts.length <= 2) return dir;
  return parts.slice(-2).join('/');
}

function uniquePaths(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const normalized = normalizePath(raw);
    if (normalized.length === 0 || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function buildFallbackExplorerPaths(primaryFilePath: string): string[] {
  const normalized = normalizePath(primaryFilePath);
  const dir = dirnamePath(normalized);
  const segments = splitPath(normalized);
  const sourceRoot = segments[0] === 'src' ? 'src' : (segments.length > 1 ? segments[0] : '');

  return uniquePaths([
    normalized,
    dir ? `${dir}/index.ts` : '',
    sourceRoot && sourceRoot !== dir ? `${sourceRoot}/index.ts` : '',
    'package.json',
    'tsconfig.json',
  ]);
}

type ExplorerTreeNode = {
  kind: 'file' | 'folder';
  name: string;
  path: string;
  children?: ExplorerTreeNode[];
};

type LocalFileSelection = {
  baseFilePath: string;
  path: string;
};

type ViewStateSnapshot = {
  filePath: string;
  state: TextEditorViewState;
};

function buildExplorerTree(paths: string[]): ExplorerTreeNode[] {
  const roots: ExplorerTreeNode[] = [];

  for (const path of paths) {
    const segments = splitPath(path);
    if (segments.length === 0) continue;

    let level = roots;
    let runningPath = '';

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      const isFile = i === segments.length - 1;
      runningPath = runningPath.length > 0 ? `${runningPath}/${segment}` : segment;

      // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
      let node = level.find((candidate) => candidate.name === segment && candidate.kind === (isFile ? 'file' : 'folder'));
      if (!node) {
        node = isFile
          ? { kind: 'file', name: segment, path: runningPath }
          : { kind: 'folder', name: segment, path: runningPath, children: [] };
        level.push(node);
      }

      if (!isFile) level = node.children as ExplorerTreeNode[];
    }
  }

  const sortNodes = (nodes: ExplorerTreeNode[]) => {
    // rjit-ignore-next-line — .tslx migration candidate: explorer tree sorting
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.kind === 'folder' && node.children) sortNodes(node.children);
    }
  };

  sortNodes(roots);
  return roots;
}

function collectFolderPaths(nodes: ExplorerTreeNode[]): string[] {
  const output: string[] = [];
  const walk = (list: ExplorerTreeNode[]) => {
    for (const node of list) {
      if (node.kind === 'folder') {
        output.push(node.path);
        walk(node.children || []);
      }
    }
  };
  walk(nodes);
  return output;
}

export interface MonacoMirrorProps extends Omit<InputProps, 'multiline' | 'lineNumbers' | 'syntaxHighlight' | 'style'> {
  style?: Style;
  inputStyle?: Style;
  activityItems?: string[];
  filePath?: string;
  selectedFilePath?: string;
  openFiles?: string[];
  explorerFiles?: string[];
  onFileSelect?: (path: string) => void;
  tabLabel?: string;
  workspaceLabel?: string;
  branch?: string;
  language?: string;
  sidebarWidth?: number;
  minimapWidth?: number;
  showActivityBar?: boolean;
  showSidebar?: boolean;
  showMinimap?: boolean;
  showBreadcrumbs?: boolean;
  showStatusBar?: boolean;
  minimapMaxLines?: number;
  maxTabs?: number;
  layoutMode?: 'auto' | 'full' | 'compact';
  compactMaxWidth?: number;
  compactMaxHeight?: number;
}

export function MonacoMirror({
  value,
  defaultValue,
  onChangeText,
  onSubmit,
  onBlur,
  onFocus,
  onLiveChange,
  liveChangeDebounce,
  onChange,
  changeDelay,
  placeholder,
  editable,
  spellCheck,
  wordWrap,
  cursorColor,
  textStyle,
  style,
  inputStyle,
  activityItems = DEFAULT_ACTIVITY_ITEMS,
  filePath = 'src/App.tsx',
  selectedFilePath,
  openFiles,
  explorerFiles,
  onFileSelect,
  tabLabel,
  workspaceLabel = 'workspace',
  branch = 'main',
  language,
  sidebarWidth = 190,
  minimapWidth = 120,
  showActivityBar = true,
  showSidebar = true,
  showMinimap = true,
  showBreadcrumbs = true,
  showStatusBar = true,
  minimapMaxLines = 120,
  maxTabs = 5,
  layoutMode = 'auto',
  compactMaxWidth = 560,
  compactMaxHeight = 260,
  ...rest
}: MonacoMirrorProps) {
  const baseFilePath = normalizePath(filePath);
  const initialText = value ?? defaultValue ?? '';
  const [uncontrolledText, setUncontrolledText] = useState(initialText);
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const [localSelectedFile, setLocalSelectedFile] = useState<LocalFileSelection>(() => ({
    baseFilePath,
    path: baseFilePath,
  }));
  const [sessionOpenFiles, setSessionOpenFiles] = useState<string[]>(() => uniquePaths([baseFilePath, ...(openFiles ?? [])]));
  const [preferredSidebarOpen, setPreferredSidebarOpen] = useState(showSidebar);
  const [preferredMinimapOpen, setPreferredMinimapOpen] = useState(showMinimap);
  const [panelPreferenceTouched, setPanelPreferenceTouched] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [editorViewportHeight, setEditorViewportHeight] = useState<number | undefined>(undefined);
  const [editorViewStateSnapshot, setEditorViewStateSnapshot] = useState<ViewStateSnapshot | null>(null);
  const [preferredViewTarget, setPreferredViewTarget] = useState<ViewTarget>('editor');
  const instanceIdRef = useRef<string>(nextMonacoMirrorInstanceId());
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const [isShoulderNavigationOwner, setIsShoulderNavigationOwner] = useState(
    () => shoulderNavigationOwnerId === instanceIdRef.current,
  );
  const mirrorText = value !== undefined ? value : uncontrolledText;
  const activeFilePath = selectedFilePath
    ? normalizePath(selectedFilePath)
    : localSelectedFile.baseFilePath === baseFilePath
      ? localSelectedFile.path
      : baseFilePath;
  const editorViewState = editorViewStateSnapshot?.filePath === activeFilePath
    ? editorViewStateSnapshot.state
    : null;

  useEffect(() => {
    setSessionOpenFiles((prev) => uniquePaths([...prev, baseFilePath, ...(openFiles ?? [])]));
  }, [baseFilePath, openFiles]);

  useEffect(() => {
    setSessionOpenFiles((prev) => uniquePaths([...prev, activeFilePath]));
  }, [activeFilePath]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const breadcrumbs = useMemo(() => {
    const source = activeFilePath || filePath || tabLabel || 'untitled.tsx';
    return splitPath(source);
  }, [activeFilePath, filePath, tabLabel]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const fileName = useMemo(() => {
    if (tabLabel && tabLabel.length > 0) return tabLabel;
    if (breadcrumbs.length === 0) return 'untitled.tsx';
    return breadcrumbs[breadcrumbs.length - 1];
  }, [breadcrumbs, tabLabel]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const languageLabel = useMemo(() => {
    return language ?? inferLanguage(fileName, 'plaintext');
  }, [fileName, language]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const lines = useMemo(() => {
    return mirrorText.split('\n');
  }, [mirrorText]);

  const lineCount = Math.max(lines.length, 1);
  const charCount = mirrorText.length;
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const minimapSourceLines = useMemo(() => {
    return lines
      .slice(0, Math.max(1, minimapMaxLines))
      .map((line) => line.replace(/\t/g, '  '));
  }, [lines, minimapMaxLines]);

  const explicitWidth = typeof style?.width === 'number' ? style.width : undefined;
  const explicitHeight = typeof style?.height === 'number' ? style.height : undefined;

  const compactBySize = !!(
    (explicitWidth !== undefined && explicitWidth <= compactMaxWidth) ||
    (explicitHeight !== undefined && explicitHeight <= compactMaxHeight)
  );
  const compact = layoutMode === 'compact' || (layoutMode === 'auto' && compactBySize);
  const topBarHeight = compact ? 28 : 42;
  const statusBarHeight = compact ? 18 : 22;
  const editorFontSize = compact ? 10 : 12;

  const widthCanShowSidebar = explicitWidth === undefined || explicitWidth >= 520;
  const widthCanShowMinimap = explicitWidth === undefined || explicitWidth >= 620;
  const sidebarAvailable = showSidebar && !compact && widthCanShowSidebar;
  const minimapAvailable = showMinimap && !compact && widthCanShowMinimap;
  const autoSidebarOpen = sidebarAvailable;
  const autoMinimapOpen = minimapAvailable && (explicitWidth === undefined || explicitWidth >= 700);
  const sidebarOpen = panelPreferenceTouched ? (sidebarAvailable && preferredSidebarOpen) : autoSidebarOpen;
  const minimapOpen = panelPreferenceTouched ? (minimapAvailable && preferredMinimapOpen) : autoMinimapOpen;

  const renderActivityBar = showActivityBar && !compact;
  const renderSidebar = sidebarOpen;
  const renderMinimap = minimapOpen;
  const renderBreadcrumbs = showBreadcrumbs && !compact;
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const availableViewTargets = useMemo<ViewTarget[]>(() => {
    const nextTargets: ViewTarget[] = ['tabs'];
    if (sidebarAvailable) nextTargets.push('explorer');
    nextTargets.push('editor');
    if (minimapAvailable) nextTargets.push('minimap');
    return nextTargets;
  }, [minimapAvailable, sidebarAvailable]);
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const viewTarget = useMemo<ViewTarget>(() => {
    if (availableViewTargets.includes(preferredViewTarget)) return preferredViewTarget;
    if (availableViewTargets.includes('editor')) return 'editor';
    return availableViewTargets[0] ?? 'editor';
  }, [availableViewTargets, preferredViewTarget]);

  const resolvedSidebarWidth = explicitWidth !== undefined
    ? Math.max(132, Math.min(sidebarWidth, Math.floor(explicitWidth * 0.38)))
    : sidebarWidth;
  const resolvedMinimapWidth = explicitWidth !== undefined
    ? Math.max(58, Math.min(minimapWidth, Math.floor(explicitWidth * 0.18)))
    : minimapWidth;
  const minimapRowCount = Math.max(minimapSourceLines.length, 1);
  const editorLineHeight = editorFontSize + 4;
  const chromeHeight = topBarHeight + (renderBreadcrumbs ? 24 : 0) + (showStatusBar ? statusBarHeight : 0);
  const approxEditorViewportHeight = explicitHeight !== undefined ? Math.max(explicitHeight - chromeHeight, 60) : 220;
  // Prefer measured editor viewport height so minimap highlight matches what is visible.
  const effectiveEditorViewportHeight = editorViewportHeight !== undefined ? Math.max(editorViewportHeight, 60) : approxEditorViewportHeight;
  const editorVisibleRows = Math.max(1, Math.floor((effectiveEditorViewportHeight - 16) / editorLineHeight));
  const minimapViewportRows = Math.max(1, Math.min(minimapRowCount, editorVisibleRows));
  const minimapTrackRows = Math.max(16, Math.min(84, minimapRowCount));
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const minimapRows = useMemo(() => {
    if (minimapSourceLines.length <= minimapTrackRows) return minimapSourceLines;
    const sampled: string[] = [];
    for (let i = 0; i < minimapTrackRows; i += 1) {
      const ratio = i / Math.max(1, minimapTrackRows - 1);
      const index = Math.floor(ratio * (minimapSourceLines.length - 1));
      sampled.push(minimapSourceLines[index] ?? '');
    }
    return sampled;
  }, [minimapSourceLines, minimapTrackRows]);
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const minimapMaxLineLength = useMemo(() => {
    let maxLen = 1;
    for (const row of minimapRows) {
      const len = row.trim().length;
      if (len > maxLen) maxLen = len;
    }
    return maxLen;
  }, [minimapRows]);
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const minimapInkPercents = useMemo(() => {
    return minimapRows.map((row) => {
      const len = row.trim().length;
      if (len === 0) return 6;
      return Math.max(8, Math.min(100, Math.round((len / minimapMaxLineLength) * 100)));
    });
  }, [minimapMaxLineLength, minimapRows]);
  const minimapTrackHeightPx = Math.max(minimapRows.length * 3, 12);
  const viewStateFirstVisibleLine = editorViewState?.firstVisibleLine ?? 1;
  const viewStateVisibleLineCount = editorViewState?.visibleLineCount ?? minimapViewportRows;
  const viewStateTotalVisibleLines = editorViewState?.totalVisibleLines ?? minimapRowCount;
  const minimapAllVisible = viewStateVisibleLineCount >= viewStateTotalVisibleLines;
  const minimapViewportPx = minimapAllVisible
    ? minimapTrackHeightPx
    : Math.max(10, Math.min(
      minimapTrackHeightPx,
      Math.round((viewStateVisibleLineCount / Math.max(1, viewStateTotalVisibleLines)) * minimapTrackHeightPx),
    ));
  const minimapViewportTopPx = minimapAllVisible
    ? 0
    : Math.max(
      0,
      Math.min(
        minimapTrackHeightPx - minimapViewportPx,
        Math.round(((viewStateFirstVisibleLine - 1) / Math.max(1, viewStateTotalVisibleLines - 1)) * minimapTrackHeightPx),
      ),
    );
  const cursorLineLabel = editorViewState?.cursorLine ?? 1;
  const cursorColumnLabel = (editorViewState?.cursorCol ?? 0) + 1;

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const candidateExplorerPaths = useMemo(() => {
    const sourcePaths = explorerFiles && explorerFiles.length > 0
      ? explorerFiles
      : buildFallbackExplorerPaths(filePath);
    return uniquePaths([...sourcePaths, filePath, activeFilePath]);
  }, [activeFilePath, explorerFiles, filePath]);
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const tabPaths = useMemo(() => {
    const sourcePaths = sessionOpenFiles.length > 0
      ? sessionOpenFiles
      : candidateExplorerPaths;
    const normalized = uniquePaths([filePath, ...sourcePaths]);
    const visible = normalized.slice(0, Math.max(1, maxTabs));
    if (visible.includes(activeFilePath)) return visible;
    return uniquePaths([activeFilePath, ...visible]).slice(0, Math.max(1, maxTabs));
  }, [activeFilePath, candidateExplorerPaths, filePath, maxTabs, sessionOpenFiles]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const explorerTree = useMemo(() => buildExplorerTree(candidateExplorerPaths), [candidateExplorerPaths]);
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const folderPaths = useMemo(() => collectFolderPaths(explorerTree), [explorerTree]);
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const activeFolderAncestors = useMemo(() => {
    const segments = splitPath(activeFilePath);
    const folders = segments.slice(0, -1);
    const output: string[] = [];
    let current = '';
    for (const folder of folders) {
      current = current.length > 0 ? `${current}/${folder}` : folder;
      output.push(current);
    }
    return output;
  }, [activeFilePath]);
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const effectiveCollapsedFolders = useMemo(() => {
    if (activeFolderAncestors.length === 0) return collapsedFolders;
    let changed = false;
    const next = { ...collapsedFolders };
    for (const path of activeFolderAncestors) {
      if (next[path]) {
        next[path] = false;
        changed = true;
      }
    }
    return changed ? next : collapsedFolders;
  }, [activeFolderAncestors, collapsedFolders]);

  useMount(() => {
    return subscribeShoulderNavigationOwner((ownerId) => {
      setIsShoulderNavigationOwner(ownerId === instanceIdRef.current);
    });
  });

  useMount(() => {
    if (shoulderNavigationOwnerId === null) setShoulderNavigationOwner(instanceIdRef.current);
    return () => {
      if (shoulderNavigationOwnerId === instanceIdRef.current) {
        setShoulderNavigationOwner(null);
      }
    };
  });
  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const updateMirrorText = useCallback((next: string) => {
    setUncontrolledText(next);
  }, []);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleLiveChange = useCallback((next: string) => {
    updateMirrorText(next);
    onLiveChange?.(next);
  }, [onLiveChange, updateMirrorText]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleEditorChange = useCallback((next: string) => {
    updateMirrorText(next);
    onChange?.(next);
    onLiveChange?.(next);
  }, [onChange, onLiveChange, updateMirrorText]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleChangeText = useCallback((next: string) => {
    updateMirrorText(next);
    onChangeText?.(next);
  }, [onChangeText, updateMirrorText]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleSubmit = useCallback((next: string) => {
    updateMirrorText(next);
    onSubmit?.(next);
  }, [onSubmit, updateMirrorText]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleBlur = useCallback((next: string) => {
    updateMirrorText(next);
    onBlur?.(next);
  }, [onBlur, updateMirrorText]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const claimShoulderNavigation = useCallback(() => {
    setShoulderNavigationOwner(instanceIdRef.current);
  }, []);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const targetView = useCallback((nextTarget: ViewTarget) => {
    if (!availableViewTargets.includes(nextTarget)) return;
    claimShoulderNavigation();
    setPreferredViewTarget(nextTarget);
    if (nextTarget === 'explorer' && sidebarAvailable) {
      setPanelPreferenceTouched(true);
      setPreferredSidebarOpen(true);
    }
    if (nextTarget === 'minimap' && minimapAvailable) {
      setPanelPreferenceTouched(true);
      setPreferredMinimapOpen(true);
    }
  }, [
    availableViewTargets,
    claimShoulderNavigation,
    minimapAvailable,
    sidebarAvailable,
  ]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const cycleTargetedView = useCallback((direction: -1 | 1) => {
    if (availableViewTargets.length <= 1) return;
    const currentIndex = availableViewTargets.indexOf(viewTarget);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + availableViewTargets.length) % availableViewTargets.length;
    targetView(availableViewTargets[nextIndex]);
  }, [availableViewTargets, targetView, viewTarget]);

  useIFTTT('gamepad:leftshoulder', () => {
    if (!isShoulderNavigationOwner) return;
    cycleTargetedView(-1);
  });

  useIFTTT('gamepad:rightshoulder', () => {
    if (!isShoulderNavigationOwner) return;
    cycleTargetedView(1);
  });

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const toggleFolder = useCallback((path: string) => {
    claimShoulderNavigation();
    setCollapsedFolders((prev) => ({
      ...prev,
      [path]: !(prev[path] ?? false),
    }));
  }, [claimShoulderNavigation]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const commitFileSelect = useCallback((path: string) => {
    setSessionOpenFiles((prev) => uniquePaths([...prev, path]));
    if (selectedFilePath === undefined) {
      setLocalSelectedFile({
        baseFilePath,
        path,
      });
    }
    onFileSelect?.(path);
  }, [baseFilePath, onFileSelect, selectedFilePath]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleTabSelect = useCallback((path: string) => {
    targetView('tabs');
    commitFileSelect(path);
  }, [commitFileSelect, targetView]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleExplorerFileSelect = useCallback((path: string) => {
    claimShoulderNavigation();
    commitFileSelect(path);
  }, [claimShoulderNavigation, commitFileSelect]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleEditorFocus = useCallback(() => {
    claimShoulderNavigation();
    setPreferredViewTarget('editor');
    onFocus?.();
  }, [claimShoulderNavigation, onFocus]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleEditorViewportLayout = useCallback((event: LayoutEvent) => {
    const nextHeight = Math.max(0, Math.round(event.height));
    setEditorViewportHeight((prev) => {
      if (prev !== undefined && Math.abs(prev - nextHeight) < 1) return prev;
      return nextHeight;
    });
  }, []);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleEditorStateChange = useCallback((nextState: TextEditorViewState) => {
    setEditorViewStateSnapshot((prev) => {
      const prevState = prev?.filePath === activeFilePath ? prev.state : null;
      if (
        prevState &&
        prevState.cursorLine === nextState.cursorLine &&
        prevState.cursorCol === nextState.cursorCol &&
        prevState.scrollX === nextState.scrollX &&
        prevState.scrollY === nextState.scrollY &&
        prevState.lineCount === nextState.lineCount &&
        prevState.firstVisibleLine === nextState.firstVisibleLine &&
        prevState.visibleLineCount === nextState.visibleLineCount &&
        prevState.totalVisibleLines === nextState.totalVisibleLines &&
        prevState.lineHeight === nextState.lineHeight &&
        prevState.selectionStartLine === nextState.selectionStartLine &&
        prevState.selectionStartCol === nextState.selectionStartCol &&
        prevState.selectionEndLine === nextState.selectionEndLine &&
        prevState.selectionEndCol === nextState.selectionEndCol
      ) {
        return prev;
      }
      return { filePath: activeFilePath, state: nextState };
    });
  }, [activeFilePath]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleToggleSidebarPanel = useCallback(() => {
    if (!widthCanShowSidebar) return;
    claimShoulderNavigation();
    setPanelPreferenceTouched(true);
    setPreferredSidebarOpen((open) => {
      const next = !open;
      if (next) setPreferredViewTarget('explorer');
      else if (viewTarget === 'explorer') setPreferredViewTarget('editor');
      return next;
    });
  }, [claimShoulderNavigation, viewTarget, widthCanShowSidebar]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleToggleMinimapPanel = useCallback(() => {
    if (!widthCanShowMinimap) return;
    claimShoulderNavigation();
    setPanelPreferenceTouched(true);
    setPreferredMinimapOpen((open) => {
      const next = !open;
      if (next) setPreferredViewTarget('minimap');
      else if (viewTarget === 'minimap') setPreferredViewTarget('editor');
      return next;
    });
  }, [claimShoulderNavigation, viewTarget, widthCanShowMinimap]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleCollapseAll = useCallback(() => {
    claimShoulderNavigation();
    const next: Record<string, boolean> = {};
    for (const path of folderPaths) next[path] = true;
    setCollapsedFolders(next);
  }, [claimShoulderNavigation, folderPaths]);

  // rjit-ignore-next-line — .tslx migration candidate: editor chrome compute
  const handleExpandAll = useCallback(() => {
    claimShoulderNavigation();
    const next: Record<string, boolean> = {};
    for (const path of folderPaths) next[path] = false;
    setCollapsedFolders(next);
  }, [claimShoulderNavigation, folderPaths]);

  const renderExplorerNodes = (nodes: ExplorerTreeNode[], depth: number): React.ReactNode => (
    nodes.map((node) => {
      const isFolder = node.kind === 'folder';
      const isCollapsed = isFolder ? (effectiveCollapsedFolders[node.path] ?? false) : false;
      const isSelected = !isFolder && node.path === activeFilePath;
      const isActiveBranch = isFolder && activeFolderAncestors.includes(node.path);
      const rowIndent = 2 + depth * 8;
      const guideOffset = Math.max(3, rowIndent - 4);

      return (
        <Box key={node.path} style={{ position: 'relative' }}>
          {depth > 0 && (
            <Box
              style={{
                position: 'absolute',
                left: guideOffset,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: isActiveBranch ? '#335f7d' : '#2f3133',
              }}
            />
          )}
          <Pressable
            onPress={() => (isFolder ? toggleFolder(node.path) : handleExplorerFileSelect(node.path))}
            style={({ hovered }) => ({
              backgroundColor: isSelected
                ? '#0f3b60'
                : hovered
                  ? '#2a2d2e'
                  : (isFolder && isActiveBranch ? '#21272e' : 'transparent'),
              borderLeftWidth: isSelected ? 3 : 0,
              borderWidth: isSelected ? 1 : 0,
              borderColor: isSelected ? '#56b6ff' : 'transparent',
              borderRadius: 4,
              minWidth: 0,
            })}
          >
            <Box
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minWidth: 0,
                paddingLeft: rowIndent,
                paddingRight: 2,
                paddingTop: 2,
                paddingBottom: 2,
                gap: 2,
              }}
            >
              <Box style={{ width: 8, flexShrink: 0, alignItems: 'center' }}>
                {isFolder ? (
                  <Text
                    style={{
                      color: isActiveBranch ? '#b8d8f0' : '#8a8a8a',
                      fontSize: 8,
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isCollapsed ? '>' : 'v'}
                  </Text>
                ) : (
                  <Box
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 4,
                      backgroundColor: isSelected ? '#56b6ff' : '#3c3c3c',
                    }}
                  />
                )}
              </Box>
              <Box style={{ flexGrow: 1, minWidth: 0 }}>
                <Text
                  style={{
                    color: isSelected ? '#ffffff' : (isActiveBranch ? '#d3e6f7' : '#c5c5c5'),
                    fontSize: 9,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {node.name}
                </Text>
              </Box>
              {isSelected && (
                <Box
                  style={{
                    flexShrink: 0,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: '#56b6ff',
                    backgroundColor: '#56b6ff22',
                    paddingLeft: 4,
                    paddingRight: 4,
                    paddingTop: 1,
                    paddingBottom: 1,
                  }}
                >
                  <Text style={{ color: '#dff1ff', fontSize: 7, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {'ACTIVE'}
                  </Text>
                </Box>
              )}
            </Box>
          </Pressable>
          {isFolder && !isCollapsed && node.children && renderExplorerNodes(node.children, depth + 1)}
        </Box>
      );
    })
  );

  return (
    <Box
      focusable={false}
      onPointerEnter={claimShoulderNavigation}
      onClick={claimShoulderNavigation}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1e1e1e',
        borderWidth: 1,
        borderColor: '#3c3c3c',
        borderRadius: 8,
        overflow: 'hidden',
        ...style,
      }}
    >
      <Box
        style={{
          flexShrink: 0,
          height: topBarHeight,
          flexDirection: 'row',
          alignItems: 'stretch',
          backgroundColor: '#252526',
          borderBottomWidth: 1,
          borderColor: '#3c3c3c',
        }}
      >
        <Box
          style={{
            flexGrow: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'stretch',
            paddingLeft: compact ? 6 : 8,
            paddingTop: compact ? 4 : 6,
            gap: 2,
            position: 'relative',
          }}
        >
          {!compact && viewTarget === 'tabs' && (
            <Box
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: 2,
                backgroundColor: '#3794ff',
              }}
            />
          )}
          {tabPaths.map((path) => {
            const isActive = path === activeFilePath;
            const parentLabel = compactParentLabel(path, workspaceLabel);
            const tabDisplayName = isActive && tabLabel && tabLabel.length > 0
              ? tabLabel
              : basenamePath(path);
            return (
              <Pressable
                key={path}
                onPress={() => handleTabSelect(path)}
                style={({ hovered }) => ({
                  minWidth: 0,
                  maxWidth: compact ? 180 : 220,
                  height: compact ? 20 : 34,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  borderWidth: 1,
                  borderBottomWidth: 0,
                  borderColor: isActive ? '#4f8cc9' : '#3c3c3c',
                  borderTopWidth: isActive ? 2 : 1,
                  backgroundColor: isActive
                    ? '#1e1e1e'
                    : hovered
                      ? '#323233'
                      : '#2d2d2d',
                })}
              >
                <Box
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minWidth: 0,
                    gap: 6,
                    paddingLeft: 10,
                    paddingRight: 10,
                    paddingTop: compact ? 3 : 5,
                    paddingBottom: compact ? 3 : 4,
                  }}
                >
                  <Box
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 7,
                      flexShrink: 0,
                      backgroundColor: isActive ? '#56b6ff' : '#4b5563',
                    }}
                  />
                  <Box style={{ flexGrow: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        color: isActive ? '#ffffff' : '#d4d4d4',
                        fontSize: compact ? 9 : 10,
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {tabDisplayName}
                    </Text>
                    {!compact && (
                      <Text
                        style={{
                          color: isActive ? '#9fbfe1' : '#8a8a8a',
                          fontSize: 8,
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {parentLabel}
                      </Text>
                    )}
                  </Box>
                </Box>
              </Pressable>
            );
          })}
        </Box>
        {!compact && (
          <Box style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 10 }}>
            <Box style={{ alignItems: 'end', gap: 2 }}>
              <Text style={{ color: isShoulderNavigationOwner ? '#9fbfe1' : '#8a8a8a', fontSize: 7, fontFamily: 'monospace' }}>
                {isShoulderNavigationOwner ? 'LB/RB TARGET' : 'CLICK INSIDE TO ARM'}
              </Text>
              <Box style={{ flexDirection: 'row', gap: 4 }}>
                {availableViewTargets.map((target) => {
                  const isActiveTarget = viewTarget === target;
                  return (
                    <Pressable
                      key={target}
                      onPress={() => targetView(target)}
                      style={({ hovered }) => ({
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor: isActiveTarget ? '#3794ff' : '#4b5563',
                        backgroundColor: isActiveTarget
                          ? '#0f3b60'
                          : hovered
                            ? '#3c3c3c'
                            : '#2d2d2d',
                        paddingLeft: 7,
                        paddingRight: 7,
                        paddingTop: 3,
                        paddingBottom: 3,
                      })}
                    >
                      <Text style={{ color: isActiveTarget ? '#ffffff' : '#d4d4d4', fontSize: 8, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {VIEW_TARGET_LABELS[target].short}
                      </Text>
                    </Pressable>
                  );
                })}
              </Box>
            </Box>
            <Box style={{ width: 1, alignSelf: 'stretch', backgroundColor: '#3c3c3c' }} />
            <Text style={{ color: '#8a8a8a', fontSize: 9, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{branch}</Text>
          </Box>
        )}
        {compact && (
          <Text
            style={{
              color: '#8a8a8a',
              fontSize: 8,
              fontFamily: 'monospace',
              paddingRight: 10,
              paddingTop: 8,
            }}
          >
            {branch}
          </Text>
        )}
      </Box>

      <Box style={{ flexGrow: 1, minHeight: 0, flexDirection: 'row' }}>
        {renderActivityBar && (
          <Box
            style={{
              width: 42,
              backgroundColor: '#333333',
              borderRightWidth: 1,
              borderColor: '#3c3c3c',
              paddingTop: 8,
              gap: 6,
              alignItems: 'center',
            }}
          >
            {activityItems.map((item) => {
              const target = resolveActivityTarget(item);
              const isActive = target !== null && viewTarget === target;
              const canTarget = target !== null && availableViewTargets.includes(target);

              return (
                <Pressable
                  key={item}
                  onPress={canTarget ? () => targetView(target as ViewTarget) : undefined}
                  style={({ hovered }) => ({
                    width: 30,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: isActive ? 1 : 0,
                    borderColor: isActive ? '#3794ff' : 'transparent',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: isActive
                      ? '#0f3b60'
                      : hovered && canTarget
                        ? '#2d2d2d'
                        : '#252526',
                  })}
                >
                  <Text style={{ color: isActive ? '#ffffff' : '#c5c5c5', fontSize: 8, fontFamily: 'monospace' }}>{item}</Text>
                </Pressable>
              );
            })}
          </Box>
        )}

        {renderSidebar && (
          <Box
            style={{
              position: 'relative',
              width: resolvedSidebarWidth,
              minWidth: 132,
              flexShrink: 1,
              backgroundColor: viewTarget === 'explorer' ? '#20262d' : '#252526',
              borderRightWidth: 1,
              borderColor: '#3c3c3c',
              paddingLeft: 4,
              paddingRight: 4,
              paddingTop: 4,
              paddingBottom: 4,
            }}
          >
            {viewTarget === 'explorer' && (
              <Box
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  backgroundColor: '#3794ff',
                }}
              />
            )}
            <Box style={{ gap: 4, paddingBottom: 4 }}>
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0 }}>
                <Text style={{ color: '#8a8a8a', fontSize: 8, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{'EX'}</Text>
                <Text
                  style={{
                    color: '#9a9a9a',
                    fontSize: 8,
                    fontFamily: 'monospace',
                    flexGrow: 1,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {workspaceLabel}
                </Text>
                {viewTarget === 'explorer' && (
                  <Box
                    style={{
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: '#3794ff',
                      backgroundColor: '#3794ff22',
                      paddingLeft: 4,
                      paddingRight: 4,
                      paddingTop: 1,
                      paddingBottom: 1,
                    }}
                  >
                    <Text style={{ color: '#dff1ff', fontSize: 7, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {'TARGET'}
                    </Text>
                  </Box>
                )}
                <Box style={{ flexDirection: 'row', gap: 2 }}>
                  <Pressable
                    onPress={handleExpandAll}
                    style={({ hovered }) => ({
                      backgroundColor: hovered ? '#3c3c3c' : '#2d2d2d',
                      borderRadius: 3,
                      paddingLeft: 3,
                      paddingRight: 3,
                      paddingTop: 1,
                      paddingBottom: 1,
                    })}
                  >
                    <Text style={{ color: '#c5c5c5', fontSize: 7, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{'O'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCollapseAll}
                    style={({ hovered }) => ({
                      backgroundColor: hovered ? '#3c3c3c' : '#2d2d2d',
                      borderRadius: 3,
                      paddingLeft: 3,
                      paddingRight: 3,
                      paddingTop: 1,
                      paddingBottom: 1,
                    })}
                  >
                    <Text style={{ color: '#c5c5c5', fontSize: 7, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{'C'}</Text>
                  </Pressable>
                </Box>
              </Box>
              <Box
                style={{
                  borderRadius: 5,
                  borderWidth: 1,
                  borderColor: '#3c3c3c',
                  backgroundColor: '#1f2328',
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 4,
                  paddingBottom: 4,
                  gap: 2,
                }}
              >
                <Text style={{ color: '#8a8a8a', fontSize: 7, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {'ACTIVE FILE'}
                </Text>
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 8,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activeFilePath}
                </Text>
              </Box>
            </Box>
            <Box style={{ height: 1, backgroundColor: '#3c3c3c', marginBottom: 2 }} />
            <Box style={{ flexGrow: 1, minHeight: 0, overflow: 'auto' }}>
              {renderExplorerNodes(explorerTree, 0)}
            </Box>
          </Box>
        )}

        <Box style={{ flexGrow: 1, minWidth: 0, flexDirection: 'column' }}>
          {renderBreadcrumbs && (
            <Box
              style={{
                flexShrink: 0,
                height: 24,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#252526',
                borderBottomWidth: 1,
                borderColor: '#3c3c3c',
                paddingLeft: 10,
                paddingRight: 10,
                gap: 4,
                overflow: 'hidden',
              }}
            >
              {breadcrumbs.map((segment, index) => (
                <Text
                  key={`${segment}:${index}`}
                  style={{
                    color: index === breadcrumbs.length - 1 ? '#d4d4d4' : '#8a8a8a',
                    fontSize: 9,
                    fontFamily: 'monospace',
                  }}
                >
                  {index === breadcrumbs.length - 1 ? segment : `${segment} >`}
                </Text>
              ))}
            </Box>
          )}

          <Box style={{ flexGrow: 1, minHeight: 0, flexDirection: 'row' }}>
            <Box
              style={{
                flexGrow: 1,
                minWidth: 0,
                position: 'relative',
                backgroundColor: '#1e1e1e',
              }}
              onLayout={handleEditorViewportLayout}
            >
              {viewTarget === 'editor' && !compact && (
                <Box
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    height: 2,
                    backgroundColor: '#3794ff',
                    zIndex: 1,
                  }}
                />
              )}
              <Input
                {...rest}
                value={value}
                defaultValue={defaultValue}
                onFocus={handleEditorFocus}
                onBlur={handleBlur}
                onSubmit={handleSubmit}
                onChangeText={handleChangeText}
                onLiveChange={handleLiveChange}
                onChange={handleEditorChange}
                onEditorStateChange={handleEditorStateChange}
                changeDelay={changeDelay ?? 0.08}
                live
                liveChangeDebounce={liveChangeDebounce ?? 80}
                multiline
                lineNumbers
                syntaxHighlight
                placeholder={placeholder ?? 'Type code here...'}
                editable={editable}
                spellCheck={spellCheck}
                wordWrap={wordWrap}
                cursorColor={cursorColor}
                textStyle={{
                  fontFamily: 'monospace',
                  fontSize: editorFontSize,
                  color: '#d4d4d4',
                  ...textStyle,
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  flexGrow: 1,
                  backgroundColor: '#1e1e1e',
                  borderWidth: 0,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 8,
                  paddingBottom: 8,
                  ...inputStyle,
                }}
              />
            </Box>

            {renderMinimap && (
              <Box
                style={{
                  position: 'relative',
                  width: resolvedMinimapWidth,
                  minWidth: 58,
                  flexShrink: 1,
                  backgroundColor: viewTarget === 'minimap' ? '#20262d' : '#252526',
                  borderLeftWidth: 1,
                  borderColor: '#3c3c3c',
                  paddingLeft: 2,
                  paddingRight: 2,
                  paddingTop: 2,
                  paddingBottom: 2,
                  gap: 2,
                  overflow: 'hidden',
                }}
              >
                {viewTarget === 'minimap' && (
                  <Box
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      height: 2,
                      backgroundColor: '#3794ff',
                      zIndex: 1,
                    }}
                  />
                )}
                <Box style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 }}>
                  <Text style={{ color: '#8a8a8a', fontSize: 7, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{'MAP'}</Text>
                  <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {viewTarget === 'minimap' && (
                      <Text style={{ color: '#dff1ff', fontSize: 7, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {'TARGET'}
                      </Text>
                    )}
                    <Text style={{ color: '#6f6f6f', fontSize: 7, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{`${editorViewState?.lineCount ?? lineCount}L`}</Text>
                  </Box>
                </Box>
                <Box style={{ position: 'relative', height: minimapTrackHeightPx, overflow: 'hidden' }}>
                  {minimapInkPercents.map((percent, index) => (
                    <Box
                      key={`minimap-ink:${index}`}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: index * 3,
                        height: 2,
                        width: `${percent}%`,
                        borderRadius: 1,
                        backgroundColor: index % 5 === 0 ? '#727272' : '#575757',
                      }}
                    />
                  ))}
                  <Box
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: minimapViewportTopPx,
                      height: minimapViewportPx,
                      borderWidth: 1,
                      borderColor: '#3f78a8',
                      backgroundColor: '#3f78a822',
                    }}
                  />
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {showStatusBar && (
        <Box
          style={{
            height: statusBarHeight,
            flexShrink: 0,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#007acc',
            paddingLeft: 10,
            paddingRight: 10,
            gap: 10,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: compact ? 8 : 9, fontFamily: 'monospace' }}>{languageLabel}</Text>
          {!compact && <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>{'Spaces: 2'}</Text>}
          {!compact && <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>{'UTF-8'}</Text>}
          {!compact && (
            <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>
              {`Target:${VIEW_TARGET_LABELS[viewTarget].label}`}
            </Text>
          )}
          {!compact && (
            <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>
              {isShoulderNavigationOwner ? 'LB/RB cycle' : 'click to arm'}
            </Text>
          )}
          {!compact && (
            <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>
              {`EX:${renderSidebar ? 'on' : 'off'} MAP:${renderMinimap ? 'on' : 'off'}`}
            </Text>
          )}
          <Box style={{ flexGrow: 1 }} />
          {showSidebar && (
            <Pressable
              onPress={handleToggleSidebarPanel}
              style={({ hovered }) => ({
                backgroundColor: !widthCanShowSidebar
                  ? '#0369a1'
                  : sidebarOpen
                    ? '#035888'
                    : (hovered ? '#1187c9' : '#0b72ad'),
                borderRadius: 3,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
              })}
            >
              <Text style={{ color: widthCanShowSidebar ? '#ffffff' : '#b4d9eb', fontSize: compact ? 7 : 8, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{'EX'}</Text>
            </Pressable>
          )}
          {showMinimap && (
            <Pressable
              onPress={handleToggleMinimapPanel}
              style={({ hovered }) => ({
                backgroundColor: !widthCanShowMinimap
                  ? '#0369a1'
                  : minimapOpen
                    ? '#035888'
                    : (hovered ? '#1187c9' : '#0b72ad'),
                borderRadius: 3,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
              })}
            >
              <Text style={{ color: widthCanShowMinimap ? '#ffffff' : '#b4d9eb', fontSize: compact ? 7 : 8, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{'MAP'}</Text>
            </Pressable>
          )}
          <Text style={{ color: '#ffffff', fontSize: compact ? 8 : 9, fontFamily: 'monospace' }}>{`Ln ${cursorLineLabel}, Col ${cursorColumnLabel}`}</Text>
          {!compact && (
            <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>{`${editorViewState?.lineCount ?? lineCount} lines`}</Text>
          )}
          <Text style={{ color: '#ffffff', fontSize: compact ? 8 : 9, fontFamily: 'monospace' }}>{`${charCount} chars`}</Text>
        </Box>
      )}
    </Box>
  );
}
