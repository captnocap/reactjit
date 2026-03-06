import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text } from './primitives';
import { Input } from './Input';
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

export interface MonacoMirrorProps extends Omit<InputProps, 'multiline' | 'lineNumbers' | 'syntaxHighlight' | 'style'> {
  style?: Style;
  inputStyle?: Style;
  activityItems?: string[];
  filePath?: string;
  tabLabel?: string;
  workspaceLabel?: string;
  branch?: string;
  language?: string;
  showActivityBar?: boolean;
  showSidebar?: boolean;
  showMinimap?: boolean;
  showBreadcrumbs?: boolean;
  showStatusBar?: boolean;
  minimapMaxLines?: number;
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
  tabLabel,
  workspaceLabel = 'workspace',
  branch = 'main',
  language,
  showActivityBar = true,
  showSidebar = true,
  showMinimap = true,
  showBreadcrumbs = true,
  showStatusBar = true,
  minimapMaxLines = 120,
  ...rest
}: MonacoMirrorProps) {
  const initialText = value ?? defaultValue ?? '';
  const [mirrorText, setMirrorText] = useState(initialText);

  useEffect(() => {
    if (value !== undefined) setMirrorText(value);
  }, [value]);

  const breadcrumbs = useMemo(() => {
    const source = filePath || tabLabel || 'untitled.tsx';
    return splitPath(source);
  }, [filePath, tabLabel]);

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

  const handleLiveChange = useCallback((next: string) => {
    setMirrorText(next);
    onLiveChange?.(next);
  }, [onLiveChange]);

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
          height: 34,
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
            height: 28,
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
        <Text
          style={{
            color: '#8a8a8a',
            fontSize: 9,
            fontFamily: 'monospace',
            paddingRight: 10,
            paddingBottom: 8,
          }}
        >
          {branch}
        </Text>
      </Box>

      <Box style={{ flexGrow: 1, minHeight: 0, flexDirection: 'row' }}>
        {showActivityBar && (
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

        {showSidebar && (
          <Box
            style={{
              width: 190,
              backgroundColor: '#252526',
              borderRightWidth: 1,
              borderColor: '#3c3c3c',
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 10,
              gap: 4,
            }}
          >
            <Text style={{ color: '#8a8a8a', fontSize: 8, fontFamily: 'monospace' }}>{'EXPLORER'}</Text>
            <Text style={{ color: '#c5c5c5', fontSize: 9, fontFamily: 'monospace' }}>{workspaceLabel}</Text>
            {breadcrumbs.map((segment, index) => (
              <Text
                key={`${segment}-${index}`}
                style={{
                  color: index === breadcrumbs.length - 1 ? '#d4d4d4' : '#8a8a8a',
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              >
                {index === breadcrumbs.length - 1 ? `- ${segment}` : `  ${segment}`}
              </Text>
            ))}
          </Box>
        )}

        <Box style={{ flexGrow: 1, minWidth: 0, flexDirection: 'column' }}>
          {showBreadcrumbs && (
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
                onChange={onChange}
                changeDelay={changeDelay}
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
                  fontSize: 12,
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

            {showMinimap && (
              <Box
                style={{
                  width: 120,
                  backgroundColor: '#252526',
                  borderLeftWidth: 1,
                  borderColor: '#3c3c3c',
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 6,
                  paddingBottom: 6,
                  gap: 1,
                }}
              >
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
            )}
          </Box>
        </Box>
      </Box>

      {showStatusBar && (
        <Box
          style={{
            height: 22,
            flexShrink: 0,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#007acc',
            paddingLeft: 10,
            paddingRight: 10,
            gap: 10,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>{languageLabel}</Text>
          <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>{'Spaces: 2'}</Text>
          <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>{'UTF-8'}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>{`Ln ${lineCount}`}</Text>
          <Text style={{ color: '#ffffff', fontSize: 9, fontFamily: 'monospace' }}>{`${charCount} chars`}</Text>
        </Box>
      )}
    </Box>
  );
}
