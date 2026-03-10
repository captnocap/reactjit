import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, Native, CodeBlock, FileWatcher, Pressable, ScrollView, TextInput, useLoveRPC } from '@reactjit/core';
import { ClaudeCanvas } from '@reactjit/terminal';
import { useClaude, useSessionChrome } from '@reactjit/terminal';
import { transformJSX } from './jsx-transform';
import { evalComponent, setElementClickHandler } from './eval-component';

// ── Palette ──────────────────────────────────────────────
const C = {
  bg: '#0d0d1a',
  surface: '#161625',
  border: 'rgba(64, 64, 89, 0.6)',
  text: '#cdd6f4',
  muted: '#6c7086',
  accent: '#89b4fa',
  green: '#a6e3a1',
  red: '#f38ba8',
  yellow: '#f9e2af',
};

const WORK_DIR = '/home/siah/creative/reactjit';

function langFromPath(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const m: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    lua: 'lua', py: 'python', rs: 'rust', go: 'go', json: 'json',
    yaml: 'yaml', yml: 'yaml', md: 'markdown', css: 'css', sh: 'bash',
  };
  return m[ext] ?? 'auto';
}

// ── Error boundary ───────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey: any },
  { error: string | null }
> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e: any) { return { error: e?.message || String(e) }; }
  componentDidUpdate(prev: any) { if (prev.resetKey !== this.props.resetKey) this.setState({ error: null }); }
  render() {
    if (this.state.error) return (
      <Box style={{ padding: 12 }}>
        <Text style={{ fontSize: 11, color: C.red }}>{`Runtime error: ${this.state.error}`}</Text>
      </Box>
    );
    return this.props.children;
  }
}

// ── Selected element info ────────────────────────────────
interface SelectedElement {
  tag: string;
  line: number;
  x: number;
  y: number;
}

// ── Hot Panel ─────────────────────────────────────────────
function HotPanel() {
  const readFile = useLoveRPC<{ content?: string; error?: string; truncated?: boolean }>('file:read');
  const readFileRef = useRef(readFile);
  readFileRef.current = readFile;

  const sendMessage = useLoveRPC('claude:send');
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [changeType, setChangeType] = useState<string>('');
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [steerText, setSteerText] = useState('');

  const isTsx = filePath?.endsWith('.tsx') || filePath?.endsWith('.jsx');
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;

  // Wire up element click handler
  useEffect(() => {
    setElementClickHandler((info) => {
      setSelected(info);
      setSteerText('');
    });
    return () => setElementClickHandler(null);
  }, []);

  const handleSteerSubmit = useCallback(() => {
    if (!steerText.trim() || !selected) return;
    const shortPath = (filePathRef.current ?? 'unknown').replace(WORK_DIR + '/', '');
    const msg = `[${shortPath}:${selected.line} <${selected.tag}>] ${steerText.trim()}`;
    sendRef.current({ message: msg, session: 'default' });
    setSteerText('');
    setSelected(null);
  }, [steerText, selected]);

  const loadFile = useCallback(async (path: string, ct: string) => {
    const res = await readFileRef.current({ path });
    if (!res?.content) return;
    setFilePath(path);
    setContent(res.content);
    setChangeType(ct);

    if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
      const { code, errors } = transformJSX(res.content);
      if (errors.length > 0) {
        setEvalError(`Line ${errors[0].line}: ${errors[0].message}`);
        setUserComponent(null);
      } else {
        const result = evalComponent(code);
        if (result.error) { setEvalError(result.error); setUserComponent(null); }
        else { setEvalError(null); setUserComponent(() => result.component!); }
      }
    } else {
      setUserComponent(null);
      setEvalError(null);
    }
  }, []);

  const handleChange = useCallback((e: any) => {
    const path = e.path as string;
    if (!path) return;
    if (path.includes('/.git/')) return;
    if (path.includes('/node_modules/')) return;
    if (path.includes('/love/bundle')) return;
    if (path.includes('/lua/generated/')) return;
    if (/\.(png|jpg|gif|svg|ico|woff|ttf|so|o|a|lock)$/i.test(path)) return;
    loadFile(path, e.changeType as string);
  }, [loadFile]);

  const changeColor = changeType === 'created' ? C.green : changeType === 'deleted' ? C.red : C.yellow;

  return (
    <Box style={{ flexGrow: 1, flexBasis: 0, height: '100%', flexDirection: 'column', backgroundColor: C.surface }}>
      <FileWatcher path={WORK_DIR} recursive interval={500} onChange={handleChange} />

      {/* Header */}
      <Box style={{
        flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
        borderBottomWidth: 1, borderColor: C.border, width: '100%',
      }}>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
        <Text style={{ fontSize: 11, color: C.text, fontWeight: 'bold' }}>HOT CODE</Text>
        {isTsx && (
          <Box style={{ backgroundColor: 'rgba(137,180,250,0.12)', borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1 }}>
            <Text style={{ fontSize: 9, color: C.accent }}>LIVE</Text>
          </Box>
        )}
      </Box>

      {/* File label */}
      {filePath && (
        <Box style={{
          flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4,
          borderBottomWidth: 1, borderColor: C.border, width: '100%',
        }}>
          <Box style={{ backgroundColor: changeColor, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2 }}>
            <Text style={{ fontSize: 8, color: C.bg, fontWeight: 'bold' }}>{changeType.toUpperCase()}</Text>
          </Box>
          <Text style={{ fontSize: 10, color: C.accent, flexShrink: 1 }} numberOfLines={1}>
            {filePath.replace(WORK_DIR + '/', '')}
          </Text>
        </Box>
      )}

      {/* Content area */}
      <Box style={{ flexGrow: 1, overflow: 'hidden' }}>
        {!filePath ? (
          <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, color: C.muted }}>Watching for file changes...</Text>
            <Text style={{ fontSize: 10, color: C.muted, opacity: 0.5 }}>Ask Claude to write something</Text>
          </Box>
        ) : isTsx ? (
          <Box style={{ flexGrow: 1 }}>
            <ScrollView style={{ flexGrow: 1 }}>
              {evalError ? (
                <Box style={{ padding: 16 }}>
                  <Text style={{ fontSize: 11, color: C.red }}>{evalError}</Text>
                </Box>
              ) : UserComponent ? (
                <ErrorBoundary resetKey={UserComponent}>
                  <UserComponent />
                </ErrorBoundary>
              ) : null}
            </ScrollView>

            {/* Steer input — appears when an element is clicked */}
            {selected && (
              <Box style={{
                flexShrink: 0, borderTopWidth: 1, borderColor: C.accent,
                backgroundColor: 'rgba(137,180,250,0.06)',
                paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
                gap: 4,
              }}>
                <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' }}>
                  <Box style={{ backgroundColor: C.accent, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2 }}>
                    <Text style={{ fontSize: 8, color: C.bg, fontWeight: 'bold' }}>{`L${selected.line}`}</Text>
                  </Box>
                  <Text style={{ fontSize: 9, color: C.accent }}>{`<${selected.tag}>`}</Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Pressable onPress={() => setSelected(null)}>
                    <Text style={{ fontSize: 9, color: C.muted }}>ESC</Text>
                  </Pressable>
                </Box>
                <TextInput
                  autoFocus
                  value={steerText}
                  onChangeText={setSteerText}
                  onSubmit={handleSteerSubmit}
                  placeholder="steer claude..."
                  style={{
                    width: '100%', fontSize: 11, color: C.text,
                    backgroundColor: C.bg, borderRadius: 4,
                    borderWidth: 1, borderColor: C.accent,
                    paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
                  }}
                />
              </Box>
            )}
          </Box>
        ) : (
          <ScrollView style={{ flexGrow: 1 }}>
            <CodeBlock code={content} language={langFromPath(filePath)} fontSize={11} style={{ width: '100%' }} />
          </ScrollView>
        )}
      </Box>
    </Box>
  );
}

// ── App ───────────────────────────────────────────────────
export function App() {
  const claude = useClaude();
  const { statusLeft, statusRight } = useSessionChrome('default');

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, flexDirection: 'column' }}>
      <Native
        type="ClaudeCode"
        workingDir={WORK_DIR}
        model="sonnet"
        sessionId="default"
        onStatusChange={claude.onStatusChange}
        onPermissionRequest={claude.onPerm}
        onPermissionResolved={claude.onPermResolved}
        onQuestionPrompt={claude.onQuestion}
      />

      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        <Box style={{ flexGrow: 2, flexBasis: 0, flexDirection: 'column' }}>
          <ClaudeCanvas sessionId="default" style={{ flexGrow: 1 }} />
        </Box>
        <Box style={{ width: 2, backgroundColor: C.border }} />
        <HotPanel />
      </Box>

      {(statusLeft.length > 0 || statusRight.length > 0) && (
        <Box style={{
          width: '100%', flexShrink: 0, flexDirection: 'row', justifyContent: 'space-between',
          paddingLeft: 12, paddingRight: 12, paddingTop: 2, paddingBottom: 2,
          backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.border,
        }}>
          <Text style={{ fontSize: 11, color: C.muted, opacity: 0.6, flexShrink: 1 }} numberOfLines={1}>{statusLeft}</Text>
          <Text style={{ fontSize: 11, color: C.muted, opacity: 0.6, flexShrink: 0 }} numberOfLines={1}>{statusRight}</Text>
        </Box>
      )}
    </Box>
  );
}
