import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text } from './primitives';
import { Input } from './Input';
import { Pressable } from './Pressable';
import type { InputProps, Style } from './types';

const DEFAULT_ACTIVITY_ITEMS = ['EX', 'SE', 'SC', 'RU'];

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

type ExplorerTreeNode = {
  kind: 'file' | 'folder';
  name: string;
  path: string;
  children?: ExplorerTreeNode[];
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

function getFileExtensionLabel(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.tsx')) return 'TSX';
  if (lower.endsWith('.ts')) return 'TS';
  if (lower.endsWith('.jsx')) return 'JSX';
  if (lower.endsWith('.js')) return 'JS';
  if (lower.endsWith('.json')) return 'JSON';
  if (lower.endsWith('.md')) return 'MD';
  if (lower.endsWith('.lua')) return 'LUA';
  if (lower.endsWith('.css')) return 'CSS';
  if (lower.endsWith('.html')) return 'HTML';
  return 'TXT';
}

export interface MonacoMirrorProps extends Omit<InputProps, 'multiline' | 'lineNumbers' | 'syntaxHighlight' | 'style'> {
  style?: Style;
  inputStyle?: Style;
  activityItems?: string[];
  filePath?: string;
  selectedFilePath?: string;
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
  layoutMode = 'auto',
  compactMaxWidth = 560,
  compactMaxHeight = 260,
  ...rest
}: MonacoMirrorProps) {
  const initialText = value ?? defaultValue ?? '';
  const [mirrorText, setMirrorText] = useState(initialText);
  const [internalSelectedFile, setInternalSelectedFile] = useState(normalizePath(filePath));
  const [sidebarOpen, setSidebarOpen] = useState(showSidebar);
  const [minimapOpen, setMinimapOpen] = useState(showMinimap);
  const [panelPreferenceTouched, setPanelPreferenceTouched] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (value !== undefined) setMirrorText(value);
  }, [value]);

  useEffect(() => {
    if (selectedFilePath === undefined) setInternalSelectedFile(normalizePath(filePath));
  }, [filePath, selectedFilePath]);

  const activeFilePath = selectedFilePath ? normalizePath(selectedFilePath) : internalSelectedFile;

  const breadcrumbs = useMemo(() => {
    const source = activeFilePath || filePath || tabLabel || 'untitled.tsx';
    return splitPath(source);
  }, [activeFilePath, filePath, tabLabel]);

  const fileName = useMemo(() => {
    if (tabLabel && tabLabel.length > 0) return tabLabel;
    if (breadcrumbs.length === 0) return 'untitled.tsx';
    return breadcrumbs[breadcrumbs.length - 1];
  }, [breadcrumbs, tabLabel]);

  const languageLabel = useMemo(() => {
    return language ?? inferLanguage(fileName, 'plaintext');
  }, [fileName, language]);

  const lines = useMemo(() => {
    return mirrorText.split('\n');
  }, [mirrorText]);

  const lineCount = Math.max(lines.length, 1);
  const charCount = mirrorText.length;

  const minimapLines = useMemo(() => {
    return lines
      .slice(0, Math.max(1, minimapMaxLines))
      .map((line) => line.replace(/\t/g, '  ').slice(0, 28));
  }, [lines, minimapMaxLines]);

  const explicitWidth = typeof style?.width === 'number' ? style.width : undefined;
  const explicitHeight = typeof style?.height === 'number' ? style.height : undefined;

  const compactBySize = !!(
    (explicitWidth !== undefined && explicitWidth <= compactMaxWidth) ||
    (explicitHeight !== undefined && explicitHeight <= compactMaxHeight)
  );
  const compact = layoutMode === 'compact' || (layoutMode === 'auto' && compactBySize);
  const topBarHeight = compact ? 26 : 34;
  const statusBarHeight = compact ? 18 : 22;
  const editorFontSize = compact ? 10 : 12;

  const widthCanShowSidebar = explicitWidth === undefined || explicitWidth >= 520;
  const widthCanShowMinimap = explicitWidth === undefined || explicitWidth >= 680;

  useEffect(() => {
    if (!showSidebar || compact) setSidebarOpen(false);
  }, [showSidebar, compact]);

  useEffect(() => {
    if (!showMinimap || compact) setMinimapOpen(false);
  }, [showMinimap, compact]);

  useEffect(() => {
    if (panelPreferenceTouched || compact) return;
    if (showSidebar) setSidebarOpen(widthCanShowSidebar);
    if (showMinimap) setMinimapOpen(widthCanShowMinimap && (explicitWidth === undefined || explicitWidth >= 760));
  }, [compact, explicitWidth, panelPreferenceTouched, showMinimap, showSidebar, widthCanShowMinimap, widthCanShowSidebar]);

  const renderActivityBar = showActivityBar && !compact;
  const renderSidebar = showSidebar && !compact && widthCanShowSidebar && sidebarOpen;
  const renderMinimap = showMinimap && !compact && widthCanShowMinimap && minimapOpen;
  const renderBreadcrumbs = showBreadcrumbs && !compact;

  const resolvedSidebarWidth = explicitWidth !== undefined
    ? Math.max(132, Math.min(sidebarWidth, Math.floor(explicitWidth * 0.38)))
    : sidebarWidth;
  const resolvedMinimapWidth = explicitWidth !== undefined
    ? Math.max(72, Math.min(minimapWidth, Math.floor(explicitWidth * 0.22)))
    : minimapWidth;
  const minimapRowCount = Math.max(minimapLines.length, 1);
  const chromeHeight = topBarHeight + (renderBreadcrumbs ? 24 : 0) + (showStatusBar ? statusBarHeight : 0);
  const approxEditorViewportHeight = explicitHeight !== undefined ? Math.max(explicitHeight - chromeHeight, 60) : 220;
  const approxEditorVisibleRows = Math.max(4, Math.floor(approxEditorViewportHeight / (editorFontSize + 4)));
  const minimapViewportRows = Math.max(2, Math.min(minimapRowCount, approxEditorVisibleRows));
  const minimapViewportPx = Math.min(minimapViewportRows * 8, Math.max(14, approxEditorViewportHeight - 26));

  const candidateExplorerPaths = useMemo(() => {
    const fallbackDir = breadcrumbs.slice(0, -1).join('/');
    const baseName = fileName || 'App.tsx';
    const fallback = [
      `${fallbackDir}/${baseName}`,
      `${fallbackDir}/index.ts`,
      `${fallbackDir}/components/EditorPane.tsx`,
      `${fallbackDir}/components/ExplorerTree.tsx`,
      `${fallbackDir}/hooks/useEditorState.ts`,
      'package.json',
      'tsconfig.json',
    ];
    return uniquePaths([...(explorerFiles || []), ...fallback, activeFilePath]);
  }, [activeFilePath, breadcrumbs, explorerFiles, fileName]);

  const explorerTree = useMemo(() => buildExplorerTree(candidateExplorerPaths), [candidateExplorerPaths]);
  const folderPaths = useMemo(() => collectFolderPaths(explorerTree), [explorerTree]);
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

  useEffect(() => {
    if (activeFolderAncestors.length === 0) return;
    setCollapsedFolders((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const path of activeFolderAncestors) {
        if (next[path]) {
          next[path] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeFolderAncestors]);

  const handleLiveChange = useCallback((next: string) => {
    setMirrorText(next);
    onLiveChange?.(next);
  }, [onLiveChange]);

  const handleEditorChange = useCallback((next: string) => {
    setMirrorText(next);
    onChange?.(next);
    onLiveChange?.(next);
  }, [onChange, onLiveChange]);

  const handleChangeText = useCallback((next: string) => {
    setMirrorText(next);
    onChangeText?.(next);
  }, [onChangeText]);

  const handleSubmit = useCallback((next: string) => {
    setMirrorText(next);
    onSubmit?.(next);
  }, [onSubmit]);

  const handleBlur = useCallback((next: string) => {
    setMirrorText(next);
    onBlur?.(next);
  }, [onBlur]);

  const toggleFolder = useCallback((path: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [path]: !(prev[path] ?? false),
    }));
  }, []);

  const handleFileSelect = useCallback((path: string) => {
    if (selectedFilePath === undefined) setInternalSelectedFile(path);
    onFileSelect?.(path);
  }, [onFileSelect, selectedFilePath]);

  const handleCollapseAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const path of folderPaths) next[path] = true;
    setCollapsedFolders(next);
  }, [folderPaths]);

  const handleExpandAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const path of folderPaths) next[path] = false;
    setCollapsedFolders(next);
  }, [folderPaths]);

  const renderExplorerNodes = (nodes: ExplorerTreeNode[], depth: number): React.ReactNode => (
    nodes.map((node) => {
      const isFolder = node.kind === 'folder';
      const isCollapsed = isFolder ? (collapsedFolders[node.path] ?? false) : false;
      const isSelected = !isFolder && node.path === activeFilePath;
      const leftPad = 8 + depth * 12;
      const extLabel = isFolder ? '' : getFileExtensionLabel(node.name);

      return (
        <Box key={node.path}>
          <Pressable
            onPress={() => (isFolder ? toggleFolder(node.path) : handleFileSelect(node.path))}
            style={({ hovered }) => ({
              backgroundColor: isSelected ? '#37373d' : (hovered ? '#2a2d2e' : 'transparent'),
              borderRadius: 4,
              paddingLeft: leftPad,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
            })}
          >
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Box
                style={{
                  width: 2,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: isSelected ? '#0e639c' : 'transparent',
                }}
              />
              {isFolder && (
                <Text style={{ color: '#8a8a8a', fontSize: 8, fontFamily: 'monospace' }}>
                  {isCollapsed ? '[>]' : '[v]'}
                </Text>
              )}
              {!isFolder && <Text style={{ color: '#8a8a8a', fontSize: 8, fontFamily: 'monospace' }}>{'   '}</Text>}
              <Text
                style={{
                  color: isSelected ? '#ffffff' : '#c5c5c5',
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              >
                {node.name}
              </Text>
              {!isFolder && (
                <Box style={{ flexGrow: 1, alignItems: 'end' }}>
                  <Text
                    style={{
                      color: isSelected ? '#8bc4ff' : '#6f6f6f',
                      fontSize: 7,
                      fontFamily: 'monospace',
                    }}
                  >
                    {extLabel}
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
          alignItems: 'end',
          backgroundColor: '#252526',
          borderBottomWidth: 1,
          borderColor: '#3c3c3c',
        }}
      >
        <Box style={{ width: 10 }} />
        <Box
          style={{
            height: compact ? 22 : 28,
            backgroundColor: '#1e1e1e',
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            borderWidth: 1,
            borderColor: '#3c3c3c',
            borderBottomWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 10,
            paddingRight: 10,
          }}
        >
          <Text style={{ color: '#9cdcfe', fontSize: 10, fontFamily: 'monospace' }}>{fileName}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        {!compact && (
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8, paddingBottom: 5 }}>
            {showSidebar && (
              <Pressable
                onPress={() => {
                  if (!widthCanShowSidebar) return;
                  setPanelPreferenceTouched(true);
                  setSidebarOpen((open) => !open);
                }}
                style={({ hovered }) => ({
                  backgroundColor: !widthCanShowSidebar
                    ? '#2b2b2b'
                    : sidebarOpen
                      ? '#0e639c'
                      : (hovered ? '#3c3c3c' : '#2d2d2d'),
                  borderRadius: 4,
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 3,
                  paddingBottom: 3,
                })}
              >
                <Text style={{ color: widthCanShowSidebar ? '#d4d4d4' : '#666666', fontSize: 8, fontFamily: 'monospace' }}>{'EX'}</Text>
              </Pressable>
            )}
            {showMinimap && (
              <Pressable
                onPress={() => {
                  if (!widthCanShowMinimap) return;
                  setPanelPreferenceTouched(true);
                  setMinimapOpen((open) => !open);
                }}
                style={({ hovered }) => ({
                  backgroundColor: !widthCanShowMinimap
                    ? '#2b2b2b'
                    : minimapOpen
                      ? '#0e639c'
                      : (hovered ? '#3c3c3c' : '#2d2d2d'),
                  borderRadius: 4,
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 3,
                  paddingBottom: 3,
                })}
              >
                <Text style={{ color: widthCanShowMinimap ? '#d4d4d4' : '#666666', fontSize: 8, fontFamily: 'monospace' }}>{'MAP'}</Text>
              </Pressable>
            )}
          </Box>
        )}
        <Text
          style={{
            color: '#8a8a8a',
            fontSize: compact ? 8 : 9,
            fontFamily: 'monospace',
            paddingRight: 10,
            paddingBottom: compact ? 5 : 8,
          }}
        >
          {branch}
        </Text>
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
            {activityItems.map((item) => (
              <Box
                key={item}
                style={{
                  width: 30,
                  height: 22,
                  borderRadius: 4,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#252526',
                }}
              >
                <Text style={{ color: '#c5c5c5', fontSize: 8, fontFamily: 'monospace' }}>{item}</Text>
              </Box>
            ))}
          </Box>
        )}

        {renderSidebar && (
          <Box
            style={{
              width: resolvedSidebarWidth,
              minWidth: 132,
              flexShrink: 1,
              backgroundColor: '#252526',
              borderRightWidth: 1,
              borderColor: '#3c3c3c',
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 10,
              paddingBottom: 8,
            }}
          >
            <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#8a8a8a', fontSize: 8, fontFamily: 'monospace' }}>{'EXPLORER'}</Text>
              <Box style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable
                  onPress={handleExpandAll}
                  style={({ hovered }) => ({
                    backgroundColor: hovered ? '#3c3c3c' : '#2d2d2d',
                    borderRadius: 3,
                    paddingLeft: 4,
                    paddingRight: 4,
                    paddingTop: 2,
                    paddingBottom: 2,
                  })}
                >
                  <Text style={{ color: '#c5c5c5', fontSize: 7, fontFamily: 'monospace' }}>{'OPEN'}</Text>
                </Pressable>
                <Pressable
                  onPress={handleCollapseAll}
                  style={({ hovered }) => ({
                    backgroundColor: hovered ? '#3c3c3c' : '#2d2d2d',
                    borderRadius: 3,
                    paddingLeft: 4,
                    paddingRight: 4,
                    paddingTop: 2,
                    paddingBottom: 2,
                  })}
                >
                  <Text style={{ color: '#c5c5c5', fontSize: 7, fontFamily: 'monospace' }}>{'CLOSE'}</Text>
                </Pressable>
              </Box>
            </Box>
            <Text style={{ color: '#c5c5c5', fontSize: 9, fontFamily: 'monospace', paddingTop: 3, paddingBottom: 4 }}>
              {workspaceLabel}
            </Text>
            <Text style={{ color: '#707070', fontSize: 7, fontFamily: 'monospace', paddingBottom: 4 }}>
              {`${candidateExplorerPaths.length} files`}
            </Text>
            <Box style={{ height: 1, backgroundColor: '#3c3c3c', marginBottom: 6 }} />
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
            <Box style={{ flexGrow: 1, minWidth: 0 }}>
              <Input
                {...rest}
                value={value}
                defaultValue={defaultValue}
                onFocus={onFocus}
                onBlur={handleBlur}
                onSubmit={handleSubmit}
                onChangeText={handleChangeText}
                onLiveChange={handleLiveChange}
                onChange={handleEditorChange}
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
                  width: resolvedMinimapWidth,
                  minWidth: 72,
                  flexShrink: 1,
                  backgroundColor: '#252526',
                  borderLeftWidth: 1,
                  borderColor: '#3c3c3c',
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 6,
                  paddingBottom: 6,
                  gap: 1,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box>
                  {minimapLines.map((line, index) => (
                    <Text
                      key={`minimap:${index}`}
                      style={{
                        color: '#6f6f6f',
                        fontSize: 7,
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {line || ' '}
                    </Text>
                  ))}
                </Box>
                <Box
                  style={{
                    position: 'absolute',
                    left: 3,
                    right: 3,
                    top: 6,
                    height: minimapViewportPx,
                    borderWidth: 1,
                    borderColor: '#3f78a8',
                    backgroundColor: '#3f78a822',
                  }}
                />
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
              {`EX:${renderSidebar ? 'on' : 'off'} MAP:${renderMinimap ? 'on' : 'off'}`}
            </Text>
          )}
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ color: '#ffffff', fontSize: compact ? 8 : 9, fontFamily: 'monospace' }}>{`Ln ${lineCount}`}</Text>
          <Text style={{ color: '#ffffff', fontSize: compact ? 8 : 9, fontFamily: 'monospace' }}>{`${charCount} chars`}</Text>
        </Box>
      )}
    </Box>
  );
}
