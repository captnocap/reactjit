// ── Hot Panel ────────────────────────────────────────────────────────
// Live-eval side panel: watches files, transforms JSX, renders components.
// Ported from love2d/examples/hot-code/src/App.tsx

const React: any = require('react');
const { useEffect, useRef, useState, useCallback } = React;

import {
  Box, Col, Pressable, Row, ScrollView, Text, TextInput,
} from '../../runtime/primitives';
import { transformJSX } from '../jsx-transform';

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

const host: any = globalThis;

function fsRead(path: string): string {
  try {
    const out = host.__fs_read(path);
    return typeof out === 'string' ? out : '';
  } catch { return ''; }
}

function fsStat(path: string): { size: number; mtimeMs: number; isDir: boolean } | null {
  try {
    const out = host.__fs_stat_json(path);
    return JSON.parse(typeof out === 'string' ? out : 'null');
  } catch { return null; }
}

function execCmd(cmd: string): string {
  try {
    const out = host.__exec(cmd);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch { return ''; }
}

function langFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const m: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    lua: 'lua', py: 'python', rs: 'rust', go: 'go', json: 'json',
    yaml: 'yaml', yml: 'yaml', md: 'markdown', css: 'css', sh: 'bash',
    zig: 'zig', c: 'c', cpp: 'cpp', h: 'c',
  };
  return m[ext] ?? 'auto';
}

// ── Eval Component ───────────────────────────────────────────────────

export interface EvalResult { component: any | null; error: string | null; }

let _onElementClick: ((info: { tag: string; line: number }) => void) | null = null;

export function setHotPanelElementClickHandler(fn: typeof _onElementClick) {
  _onElementClick = fn;
}

const _elementLines = new Map<string, number>();

function wrappedCreateElement(type: any, props: any, ...children: any[]) {
  if (props && props.__hotTag && props.__hotLine) {
    const tag = props.__hotTag;
    const line = props.__hotLine;
    const key = `${tag}:${line}`;
    const { __hotTag, __hotLine, ...cleanProps } = props;
    const inner = React.createElement(type, cleanProps, ...children);
    return React.createElement(Pressable, {
      onPress: (e: any) => {
        if (e?.ctrl && _onElementClick) {
          _onElementClick({ tag, line });
        }
      },
    }, inner);
  }
  return React.createElement(type, props, ...children);
}

const WrappedReact = { ...React, createElement: wrappedCreateElement };

const MODULE_CACHE = new Map<string, any>();

function splitPath(path: string): string[] {
  return path.split('/').filter((part) => part.length > 0);
}

function normalizePath(path: string): string {
  const isAbs = path.startsWith('/');
  const parts = splitPath(path);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return (isAbs ? '/' : '') + stack.join('/');
}

function dirname(path: string): string {
  const cleaned = normalizePath(path);
  const idx = cleaned.lastIndexOf('/');
  if (idx < 0) return '.';
  if (idx === 0) return '/';
  return cleaned.slice(0, idx);
}

function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter((part) => part && part.length > 0).join('/'));
}

function resolveModuleRequest(fromFile: string, request: string): string | null {
  if (!request.startsWith('.')) return null;
  const dir = dirname(fromFile);
  const base = normalizePath(joinPath(dir, request));
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    joinPath(base, 'index.tsx'),
    joinPath(base, 'index.ts'),
    joinPath(base, 'index.jsx'),
    joinPath(base, 'index.js'),
  ];
  for (const candidate of candidates) {
    const stat = fsStat(candidate);
    if (stat && !stat.isDir) return candidate;
  }
  return null;
}

function stripTypeScriptSyntax(source: string): string {
  let out = source;
  out = out.replace(/^\s*import\s+type\s+.*$/gm, '');
  out = out.replace(/^\s*export\s+type\s+[\s\S]*?;\s*$/gm, '');
  out = out.replace(/^\s*export\s+interface\s+[\s\S]*?}\s*$/gm, '');
  out = out.replace(/^\s*interface\s+[\s\S]*?}\s*$/gm, '');
  out = out.replace(/:\s*[A-Za-z_$][A-Za-z0-9_$<>,\[\]\|&\s?.]*/g, '');
  out = out.replace(/\s+as\s+[A-Za-z_$][A-Za-z0-9_$<>,\[\]\|&\s?.]*/g, '');
  out = out.replace(/<\s*[A-Za-z_$][A-Za-z0-9_$<>,\s?.]*\s*>(?=\s*\()/g, '');
  return out;
}

const ts: any = {
  transpileModule(source: string) {
    return { outputText: stripTypeScriptSyntax(source) };
  },
  JsxEmit: { Preserve: 1 },
  ModuleKind: { None: 0 },
  ScriptTarget: { ES2018: 0 },
  ImportsNotUsedAsValues: { Remove: 0 },
};

function transpileTsxToJs(source: string): string {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2018,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      isolatedModules: true,
      verbatimModuleSyntax: false,
      skipLibCheck: true,
      noEmitHelpers: true,
      importHelpers: false,
    },
    fileName: 'hotpanel.tsx',
    reportDiagnostics: false,
  });
  return result.outputText || '';
}

function rewriteModuleSyntax(source: string): string {
  const lines = source.split('\n');
  const out: string[] = [];
  const exportLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      out.push(line);
      continue;
    }

    const typeImport = trimmed.match(/^import\s+type\s+/);
    if (typeImport) continue;

    const importStar = line.match(/^(\s*)import\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+(['"][^'"]+['"]);?\s*$/);
    if (importStar) {
      out.push(`${importStar[1]}const ${importStar[2]} = require(${importStar[3]});`);
      continue;
    }

    const importDefault = line.match(/^(\s*)import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+(['"][^'"]+['"]);?\s*$/);
    if (importDefault) {
      out.push(`${importDefault[1]}const ${importDefault[2]} = require(${importDefault[3]}).default || require(${importDefault[3]});`);
      continue;
    }

    const importNamed = line.match(/^(\s*)import\s+\{\s*([^}]+)\s*\}\s+from\s+(['"][^'"]+['"]);?\s*$/);
    if (importNamed) {
      const spec = importNamed[2]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const alias = part.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
          if (alias) return `${alias[1]}: ${alias[2]}`;
          return part;
        })
        .join(', ');
      out.push(`${importNamed[1]}const { ${spec} } = require(${importNamed[3]});`);
      continue;
    }

    if (/^import\s+['"][^'"]+['"];\s*$/.test(trimmed)) continue;

    const exportDefaultNamedFn = line.match(/^(\s*)export\s+default\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
    if (exportDefaultNamedFn) {
      out.push(line.replace('export default ', ''));
      exportLines.push(`module.exports.default = ${exportDefaultNamedFn[2]};`);
      continue;
    }

    const exportDefaultAnonFn = line.match(/^(\s*)export\s+default\s+function\s*\(/);
    if (exportDefaultAnonFn) {
      const indent = exportDefaultAnonFn[1];
      const rewritten = line.replace(/^\s*export\s+default\s+/, indent);
      out.push(rewritten);
      // Anonymous defaults are uncommon here; fall back to returning the module object.
      exportLines.push(`module.exports.default = module.exports.default || module.exports;`);
      continue;
    }

    const exportDefaultExpr = line.match(/^(\s*)export\s+default\s+(.+);\s*$/);
    if (exportDefaultExpr && !exportDefaultExpr[2].startsWith('function')) {
      out.push(`${exportDefaultExpr[1]}module.exports.default = ${exportDefaultExpr[2]};`);
      continue;
    }

    const exportNamedFn = line.match(/^(\s*)export\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
    if (exportNamedFn) {
      out.push(line.replace(/^(\s*)export\s+/, '$1'));
      exportLines.push(`module.exports.${exportNamedFn[2]} = ${exportNamedFn[2]};`);
      continue;
    }

    const exportNamedConst = line.match(/^(\s*)export\s+(const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/);
    if (exportNamedConst) {
      out.push(line.replace(/^(\s*)export\s+/, '$1'));
      exportLines.push(`module.exports.${exportNamedConst[3]} = ${exportNamedConst[3]};`);
      continue;
    }

    const exportList = line.match(/^(\s*)export\s+\{\s*([^}]+)\s*\};?\s*$/);
    if (exportList) {
      const assigns = exportList[2]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const alias = part.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
          if (alias) return `module.exports.${alias[2]} = ${alias[1]};`;
          return `module.exports.${part} = ${part};`;
        });
      exportLines.push(...assigns);
      continue;
    }

    if (/^\s*export\s+type\s+/.test(line) || /^\s*export\s+interface\s+/.test(line)) continue;

    out.push(line);
  }

  if (exportLines.length > 0) out.push(...exportLines);
  return out.join('\n');
}

function compileHotSource(source: string, fileName: string): string {
  const transpiled = transpileTsxToJs(source);
  const { code, errors } = transformJSX(transpiled);
  if (errors.length > 0) {
    const first = errors[0];
    throw new Error(`Line ${first.line}:${first.col} ${first.message}`);
  }
  return rewriteModuleSyntax(code);
}

function runHotModule(filePath: string): any {
  const cached = MODULE_CACHE.get(filePath);
  if (cached) return cached.exports;

  const raw = fsRead(filePath);
  if (!raw) throw new Error(`Unable to read ${filePath}`);

  const record = { exports: {} as any };
  MODULE_CACHE.set(filePath, record);

  const compiled = compileHotSource(raw, filePath);

  const localRequire = (request: string) => {
    if (request === 'react') return WrappedReact;
    if (request === '../../../runtime/primitives' || request === '../../runtime/primitives' || request === '../runtime/primitives' || request === './runtime/primitives' || request === 'runtime/primitives') {
      return { Box, Col, Pressable, Row, ScrollView, Text, TextInput };
    }
    const resolved = resolveModuleRequest(filePath, request);
    if (resolved) return runHotModule(resolved);
    try {
      return require(request);
    } catch {
      return {};
    }
  };

  try {
    const fn = new Function('React', 'require', 'module', 'exports', compiled);
    fn(WrappedReact, localRequire, record, record.exports);
  } catch (e: any) {
    MODULE_CACHE.delete(filePath);
    throw e;
  }

  return record.exports;
}

function pickExportedComponent(exportsObj: any): any | null {
  if (!exportsObj) return null;
  if (typeof exportsObj === 'function') return exportsObj;
  if (typeof exportsObj.default === 'function') return exportsObj.default;
  const keys = Object.keys(exportsObj).filter((key) => typeof exportsObj[key] === 'function');
  if (keys.length === 1) return exportsObj[keys[0]];
  const named = keys.find((key) => /^[A-Z]/.test(key));
  return named ? exportsObj[named] : null;
}

export function evalComponent(transformedCode: string, sourcePath: string = 'hotpanel.tsx'): EvalResult {
  try {
    const module = { exports: {} as any };
    const fn = new Function('React', 'require', 'module', 'exports', transformedCode);
    fn(WrappedReact, (request: string) => {
      if (request === 'react') return WrappedReact;
      const resolved = resolveModuleRequest(sourcePath, request);
      if (resolved) return runHotModule(resolved);
      try {
        return require(request);
      } catch {
        return {};
      }
    }, module, module.exports);
    const component = pickExportedComponent(module.exports);
    if (component) return { component, error: null };
    return { component: null, error: 'No exported component found.' };
  } catch (e: any) {
    return { component: null, error: e?.message || String(e) };
  }
}

// ── File Watcher ─────────────────────────────────────────────────────

interface WatchedFile {
  path: string;
  mtimeMs: number;
}

function useFileWatcher(workDir: string, intervalMs: number): WatchedFile | null {
  const [changedFile, setChangedFile] = useState<WatchedFile | null>(null);
  const lastFilesRef = useRef<Record<string, number>>({});
  const excludedRef = useRef(new Set(['.git', 'node_modules', '.zig-cache', 'zig-out', 'dist', '.cache']));

  useEffect(() => {
    if (!workDir) return;

    const tick = () => {
      // Use find to get all files with mtimes
      const out = execCmd(`find "${workDir}" -type f -not -path '*/\.git/*' -not -path '*/node_modules/*' -not -path '*/\.zig-cache/*' -not -path '*/zig-out/*' -printf '%T@ %p\\n' 2>/dev/null || true`);
      const lines = out.split('\n').filter((l: string) => l.trim());
      const current: Record<string, number> = {};
      let newest: WatchedFile | null = null;

      for (const line of lines) {
        const spaceIdx = line.indexOf(' ');
        if (spaceIdx < 0) continue;
        const mtime = parseFloat(line.slice(0, spaceIdx)) * 1000;
        const path = line.slice(spaceIdx + 1);
        current[path] = mtime;

        const prev = lastFilesRef.current[path];
        if (prev !== undefined && mtime > prev) {
          // File changed
          if (!newest || mtime > newest.mtimeMs) {
            newest = { path, mtimeMs: mtime };
          }
        }
      }

      // Also detect new files
      for (const path of Object.keys(current)) {
        if (!(path in lastFilesRef.current)) {
          if (!newest || current[path] > newest.mtimeMs) {
            newest = { path, mtimeMs: current[path] };
          }
        }
      }

      lastFilesRef.current = current;

      if (newest) {
        setChangedFile(newest);
      }
    };

    // Initial scan
    tick();

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [workDir, intervalMs]);

  return changedFile;
}

// ── Error Boundary ───────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: any; resetKey: any },
  { error: string | null }
> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e: any) { return { error: e?.message || String(e) }; }
  componentDidUpdate(prev: any) {
    if (prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <Box style={{ padding: 12 }}>
          <Text style={{ fontSize: 11, color: C.red }}>{`Runtime error: ${this.state.error}`}</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

// ── Hot Panel Component ──────────────────────────────────────────────

interface HotPanelProps {
  workDir: string;
  visible: boolean;
  onSteer?: (message: string) => void;
}

export function HotPanel({ workDir, visible, onSteer }: HotPanelProps) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [evalError, setEvalError] = useState<string | null>(null);
  const [UserComponent, setUserComponent] = useState<any | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [steerText, setSteerText] = useState('');

  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;

  const changedFile = useFileWatcher(workDir, 2000);

  useEffect(() => {
    setHotPanelElementClickHandler((info) => {
      setSelectedLine(info.line);
      setSelectedTag(info.tag);
      setSteerText('');
    });
    return () => setHotPanelElementClickHandler(null);
  }, []);

  useEffect(() => {
    if (!changedFile) return;
    const path = changedFile.path;
    MODULE_CACHE.clear();
    // Skip binary files
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff|ttf|so|o|a|lock|tar\.gz|zip)$/i.test(path)) return;

    const text = fsRead(path);
    setFilePath(path);
    setContent(text);
    setSelectedLine(null);
    setSelectedTag(null);

    if (path.endsWith('.tsx') || path.endsWith('.jsx')) {
      const { code, errors } = transformJSX(text);
      if (errors.length > 0) {
        setEvalError(`Line ${errors[0].line}: ${errors[0].message}`);
        setUserComponent(null);
      } else {
        const result = evalComponent(code, path);
        if (result.error) {
          setEvalError(result.error);
          setUserComponent(null);
        } else {
          setEvalError(null);
          setUserComponent(() => result.component);
        }
      }
    } else {
      setUserComponent(null);
      setEvalError(null);
    }
  }, [changedFile]);

  const handleSteerSubmit = useCallback(() => {
    const val = steerText.trim();
    if (!val || selectedLine == null) return;
    const shortPath = (filePathRef.current ?? 'unknown').replace(workDir + '/', '');
    const msg = `[${shortPath}:${selectedLine} <${selectedTag ?? '?'}>] ${val}`;
    onSteer?.(msg);
    setSteerText('');
    setSelectedLine(null);
    setSelectedTag(null);
  }, [steerText, selectedLine, selectedTag, onSteer, workDir]);

  const isTsx = filePath?.endsWith('.tsx') || filePath?.endsWith('.jsx');
  const displayPath = filePath ? filePath.replace(workDir + '/', '') : '';

  if (!visible) return null;

  return (
    <Box style={{ width: 360, height: '100%', flexDirection: 'column', backgroundColor: C.surface, borderLeftWidth: 1, borderColor: C.border }}>
      {/* Header */}
      <Row style={{ flexShrink: 0, alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderColor: C.border }}>
        <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
        <Text style={{ fontSize: 11, color: C.text, fontWeight: 'bold' }}>HOT CODE</Text>
        {isTsx && (
          <Box style={{ backgroundColor: 'rgba(137,180,250,0.12)', borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1 }}>
            <Text style={{ fontSize: 9, color: C.accent }}>LIVE</Text>
          </Box>
        )}
      </Row>

      {/* File path */}
      {filePath && (
        <Row style={{ flexShrink: 0, alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, borderBottomWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 10, color: C.accent, flexShrink: 1 }} numberOfLines={1}>{displayPath}</Text>
        </Row>
      )}

      {/* Content */}
      <Box style={{ flexGrow: 1, overflow: 'hidden' }}>
        {!filePath ? (
          <Box style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, color: C.muted }}>Watching for file changes...</Text>
            <Text style={{ fontSize: 10, color: C.muted, opacity: 0.5 }}>Edit any file in the workspace</Text>
          </Box>
        ) : isTsx ? (
          <Box style={{ flexGrow: 1 }}>
            <ScrollView showScrollbar={true} style={{ flexGrow: 1 }}>
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

            {/* Steer input */}
            {selectedLine != null && (
              <Box style={{ flexShrink: 0, borderTopWidth: 1, borderColor: C.accent, backgroundColor: 'rgba(137,180,250,0.06)', paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, gap: 4 }}>
                <Row style={{ alignItems: 'center', gap: 6, width: '100%' }}>
                  <Box style={{ backgroundColor: C.accent, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1, borderRadius: 2 }}>
                    <Text style={{ fontSize: 8, color: C.bg, fontWeight: 'bold' }}>{`L${selectedLine}`}</Text>
                  </Box>
                  <Text style={{ fontSize: 9, color: C.accent }}>{`<${selectedTag ?? '?'}>`}</Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Pressable onPress={() => { setSelectedLine(null); setSelectedTag(null); }}>
                    <Text style={{ fontSize: 9, color: C.muted }}>ESC</Text>
                  </Pressable>
                </Row>
                <TextInput
                  value={steerText}
                  onChange={setSteerText}
                  onSubmit={handleSteerSubmit}
                  placeholder="steer agent..."
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
          <ScrollView showScrollbar={true} style={{ flexGrow: 1 }}>
            <Box style={{ padding: 12 }}>
              {content.split('\n').map((line: string, i: number) => (
                <Row key={i} style={{ gap: 8 }}>
                  <Text style={{ fontSize: 10, color: C.muted, width: 32, textAlign: 'right', flexShrink: 0 }}>{i + 1}</Text>
                  <Text style={{ fontSize: 10, color: C.text, flexGrow: 1 }}>{line || ' '}</Text>
                </Row>
              ))}
            </Box>
          </ScrollView>
        )}
      </Box>
    </Box>
  );
}
