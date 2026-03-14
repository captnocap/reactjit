/**
 * Processes — The full execution ladder.
 *
 * Environment -> Process -> Terminal -> Semantic Terminal -> Specialized Surfaces
 *
 * Declare an environment. Run a process. Attach I/O. Promote it into a surface.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, TextInput, Terminal, SemanticTerminal, Native, classifiers as S, useLoveRPC } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useEnvironments, useEnvRun } from '../../../packages/environments/src';
import { ClaudeCanvas } from '../../../packages/terminal/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// -- Palette ----------------------------------------------------------

const C = {
  // Section accents (ascending the ladder)
  env: '#8b5cf6',        // purple — environment
  proc: '#22d3ee',       // cyan — process
  term: '#a6e3a1',       // green — terminal
  semantic: '#89b4fa',   // blue — semantic
  surface: '#c084fc',    // light purple — surfaces
  // Shared
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  orange: '#fab387',
  pink: '#ec4899',
  termBg: 'rgb(13, 13, 26)',
  termBorder: 'rgba(64, 64, 89, 0.8)',
  dimText: 'rgba(140, 148, 166, 0.6)',
};

// -- Static code blocks (hoisted) -------------------------------------

// ── Hero
const HERO_CODE = `// The full ladder in four lines:
const proc = useEnvRun('ml', 'python train.py')
<Terminal process={proc} />
<SemanticTerminal process={proc} classifier="basic" />
<ClaudeCanvas sessionId="default" />`;

// ── 1. Environment
const INSTALL_ENV_CODE = `import { useEnvironment, useProcess,
  useEnvironments, useEnvRun }
  from '@reactjit/environments'`;

const PYTHON_CODE = `const env = useEnvironment('ml', {
  type: 'python',
  packages: ['numpy', 'pandas', 'torch'],
  cwd: '/home/user/projects/ml',
})

// Run when ready
if (env.ready) {
  const procId = await env.run('python train.py')
}`;

const NODE_CODE = `const env = useEnvironment('frontend', {
  type: 'node',
  node: '22',
  packages: ['vite', 'react', 'typescript'],
  cwd: '/home/user/app',
  packageManager: 'pnpm',
})`;

const CONDA_CODE = `const env = useEnvironment('science', {
  type: 'conda',
  python: '3.11',
  packages: ['scipy', 'matplotlib', 'jupyterlab'],
  condaEnv: 'science-env',
})`;

const CUSTOM_CODE = `const env = useEnvironment('llm-stack', {
  type: 'custom',
  setup: [
    'source /opt/cuda/env.sh',
    'export MODEL_PATH=/data/models',
    'export CUDA_VISIBLE_DEVICES=0,1',
  ],
  cwd: '/home/user/inference',
  env: { HUGGING_FACE_TOKEN: 'hf_...' },
})`;

const DOCKER_CODE = `const env = useEnvironment('sandbox', {
  type: 'docker',
  image: 'python:3.12-slim',
  dockerFlags: ['--gpus', 'all', '-v', '/data:/data'],
})`;

const MANAGE_CODE = `const { environments, remove, refresh }
  = useEnvironments()

// List all stored environments
environments.map(e =>
  \`\${e.config.name} (\${e.config.type})\`
)

// Delete an environment
await remove('old-project')

// Rebuild from scratch
await env.rebuild()`;

// ── 2. Process
const PROCESS_CODE = `const proc = useProcess(procId, {
  onStdout: (data) => appendLog(data),
  onStderr: (data) => appendErr(data),
  onExit: (code) => setDone(true),
})

proc.sendLine('yes')     // write to stdin
proc.resize(30, 120)     // resize PTY
proc.kill()              // SIGTERM`;

const ONELINER_CODE = `// One-liner: run in a named environment
const proc = useEnvRun('ml', 'python inference.py')

// proc.stdout, proc.running, proc.send()
// proc.exitCode, proc.kill()`;

const USEPTY_CODE = `const { output, send, sendLine, connected, terminalProps } = usePTY({
  type: 'user',        // 'user' | 'root' | 'template'
  shell: 'bash',       // any PATH-resolvable binary
  session: 'main',     // stable name for RPC targeting
});

return <Terminal {...terminalProps} style={{ flexGrow: 1 }} />`;

const PIPELINE_CODE = `-- Lua-side pipeline (what happens under the hood):
--
-- 1. PTY.open(shell, rows, cols)        -- LuaJIT FFI: forkpty()
-- 2. vterm parses ANSI escape sequences  -- libvterm FFI
-- 3. Damage callback fires on cell change
-- 4. Settle timer (16ms) coalesces damage
-- 5. Dirty rows sent to React via bridge event
-- 6. React re-renders with structured row data
--
-- Total latency: PTY output → screen pixel = 1-2 frames`;

const TERMINAL_EVENTS_CODE = `<Terminal
  type="user"
  shell="bash"
  session="main"
  onData={(e) => append(e.data)}
  onDirtyRows={(e) => setRows(e.rows)}
  onCursorMove={(e) => setCursor(e)}
  onConnect={() => setAlive(true)}
  onExit={(e) => setAlive(false)}
  onError={(e) => setErr(e.error)}
/>`;

const TEMPLATE_CODE = `// Template mode: fresh PTY per command
const { runCommand, terminalProps } = usePTY({
  type: 'template',
  env: { MY_API_KEY: 'abc123' },
  session: 'cmd',
});

<Terminal {...terminalProps} />
runCommand('curl -s https://api.example.com/status');`;

// ── 4. Semantic Terminal
const SEMANTIC_CODE = `// Baseline semantic terminal — classifies every row
<SemanticTerminal
  mode="live"
  command="bash"
  classifier="basic"
  showTokens
  style={{ flexGrow: 1 }}
/>

// Claude-specific classifier
<SemanticTerminal
  mode="live"
  command="claude"
  classifier="claude"
  showTokens
  style={{ flexGrow: 1 }}
/>`;

const CLASSIFICATION_CODE = `-- lua/classifiers/ — each row gets a token type:
--
--   command        Shell prompt + command
--   output         Standard output
--   error          Error message
--   success        Success confirmation
--   separator      Horizontal rule / box drawing
--   progress       Percentage / ETA / spinner
--
-- Claude classifier adds 15+ more:
--   thinking       "Thinking..." indicator
--   tool_header    Tool name + action
--   tool_body      Code, paths, content
--   diff_add       Added line in diff
--   diff_remove    Removed line in diff
--   permission     Permission request
--   status_bar     Bottom status line
--   input_zone     Active input area`;

const PLAYBACK_CODE = `const st = useSemanticTerminal({
  mode: 'playback',
  playbackSrc: '/tmp/session.rec.lua',
  showTimeline: true,
  playbackSpeed: 1.0,
});

st.play(); st.pause(); st.seek(5.0);
st.step(); st.stepBack(); st.setSpeed(2);`;

// ── 5. Specialized Surfaces
const CANVAS_CODE = `// Full Claude Code session. One line.
<ClaudeCanvas sessionId="default" style={{ flexGrow: 1 }} />`;

const CANVAS_PROPS_CODE = `interface ClaudeCanvasProps {
  sessionId?: string;      // PTY session name
  debugVisible?: boolean;  // Show debug overlay
  style?: Record<string, any>;
}`;

const USECLAUDE_CODE = `const claude = useClaude();

claude.perm         // { action, target, question } | null
claude.status       // 'idle' | 'streaming' | 'thinking'
claude.autoAccept   // boolean

claude.respond(0)          // accept permission
claude.respond(1)          // deny permission
claude.toggleAutoAccept()  // toggle auto-accept`;

const SESSION_CHROME_CODE = `const {
  statusLeft,      // "Claude Opus 4.6"
  statusRight,     // "12,345 tokens  ·  $0.42"
  promptText,      // current input (from classified tokens)
  cursorPosition,  // character offset
} = useSessionChrome('default');`;

const FUTURE_CODE = `// A process is data. A surface is interpretation.
//
// Today:
//   ClaudeCanvas        — Claude Code session
//
// Tomorrow:
//   <NotebookCanvas />  — Jupyter-ish cells
//   <BuildCanvas />     — webpack/vite build monitor
//   <LogStreamCanvas /> — structured log viewer
//   <DeployCanvas />    — deploy dashboard
//   <REPLCanvas />      — language REPL inspector
//   <AgentCanvas />     — multi-agent orchestration
//
// Same substrate: env -> process -> terminal -> surface`;

// -- Hoisted data arrays ----------------------------------------------

const ENV_TYPES = [
  { label: 'python', desc: 'venv + pip, version selection', color: C.blue },
  { label: 'node', desc: 'nvm + npm/yarn/pnpm', color: C.green },
  { label: 'conda', desc: 'conda create + activate', color: C.yellow },
  { label: 'rust', desc: 'cargo install, PATH setup', color: C.peach },
  { label: 'docker', desc: 'docker run with bind mounts', color: C.pink },
  { label: 'custom', desc: 'arbitrary shell setup commands', color: C.mauve },
];

const STATE_COLORS: Record<string, string> = {
  creating: C.yellow, installing: C.peach, ready: C.green,
  running: C.blue, exited: C.mauve, failed: C.red,
  rebuilding: C.yellow, missing: '#585b70',
};

const ENV_STATES = [
  { label: 'creating', desc: 'venv/conda env being built', key: 'creating' },
  { label: 'installing', desc: 'packages being installed', key: 'installing' },
  { label: 'ready', desc: 'activated, can run processes', key: 'ready' },
  { label: 'rebuilding', desc: 'destroy + recreate in progress', key: 'rebuilding' },
  { label: 'failed', desc: 'setup error or missing dep', key: 'failed' },
];

const PROC_STATES = [
  { label: 'running', desc: 'process alive, PTY attached', key: 'running' },
  { label: 'exited', desc: 'process finished (exitCode)', key: 'exited' },
  { label: 'failed', desc: 'spawn error or crash', key: 'failed' },
];

const PTY_EVENTS = [
  { label: 'onData', desc: 'Raw bytes from PTY (ANSI-encoded)', color: C.proc },
  { label: 'onDirtyRows', desc: 'Settled dirty rows from vterm', color: C.blue },
  { label: 'onCursorMove', desc: 'Cursor position + visibility', color: C.yellow },
  { label: 'onConnect', desc: 'Shell process started', color: C.green },
  { label: 'onExit', desc: 'Shell process exited', color: C.red },
  { label: 'onError', desc: 'Spawn error', color: C.peach },
];

const PTY_TYPES = [
  { label: 'user', desc: 'Interactive login shell. Default.', color: C.green },
  { label: 'root', desc: 'Root shell (sudo).', color: C.red },
  { label: 'template', desc: 'Fresh PTY per command.', color: C.blue },
];

const TOKEN_TYPES = [
  { label: 'command', desc: 'Shell prompt + command', color: C.blue },
  { label: 'output', desc: 'Standard output', color: '#cdd6f4' },
  { label: 'error', desc: 'Error message', color: C.red },
  { label: 'success', desc: 'Success confirmation', color: C.green },
  { label: 'thinking', desc: '"Thinking..." indicator', color: C.yellow },
  { label: 'tool_header', desc: 'Tool name + action', color: C.blue },
  { label: 'diff_add', desc: 'Added line in diff', color: C.green },
  { label: 'diff_remove', desc: 'Removed line in diff', color: C.red },
  { label: 'permission', desc: 'Permission request', color: C.orange },
  { label: 'status_bar', desc: 'Bottom status line', color: C.dimText },
  { label: 'input_zone', desc: 'Active input area', color: C.surface },
];

const TYPE_ICONS: Record<string, string> = {
  python: 'code', node: 'hexagon', conda: 'flask-conical',
  rust: 'cog', docker: 'box', custom: 'wrench',
};

// -- Styles (hoisted) -------------------------------------------------

const S_TERM = {
  width: '100%' as const,
  height: 350,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: 'rgba(64, 64, 89, 0.8)',
};

const S_TOGGLE_ON = {
  backgroundColor: 'rgba(34, 211, 238, 0.15)',
  borderRadius: 6,
  paddingLeft: 12, paddingRight: 12,
  paddingTop: 6, paddingBottom: 6,
  alignItems: 'center' as const,
};

const S_TOGGLE_OFF = {
  backgroundColor: 'rgba(140, 148, 166, 0.1)',
  borderRadius: 6,
  paddingLeft: 12, paddingRight: 12,
  paddingTop: 6, paddingBottom: 6,
  alignItems: 'center' as const,
};

// -- Section Number Badge ---------------------------------------------

function SectionNum({ n, color }: { n: number; color: string }) {
  return (
    <Box style={{
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: color,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Text style={{ fontSize: 10, color: '#000', fontWeight: 'bold' }}>{`${n}`}</Text>
    </Box>
  );
}

// -- Shared Catalog List ----------------------------------------------

function CatalogList({ items }: { items: Array<{ label: string; desc: string; color: string }> }) {
  return (
    <S.StackG3W100>
      {items.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: f.color, width: 80, flexShrink: 0, fontWeight: 'bold' }}>
            {f.label}
          </Text>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// -- Concept Diagram --------------------------------------------------

function ConceptDiagram() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 10 }}>
      <Box style={{ borderWidth: 1, borderColor: C.env, borderRadius: 6, padding: 10, gap: 6 }}>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ backgroundColor: C.accentDim, borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
            <Text style={{ fontSize: 8, color: C.env, fontWeight: 'bold' }}>{'ENVIRONMENT'}</Text>
          </Box>
          <Text style={{ fontSize: 9, color: c.muted }}>{'= setup context'}</Text>
        </Box>
        <Text style={{ fontSize: 9, color: c.text }}>{'Type + packages + env vars + cwd + activation script'}</Text>
        <Text style={{ fontSize: 8, color: c.muted }}>{'Persists across sessions. Created once, reused forever.'}</Text>
        <Box style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          {[{ cmd: 'python train.py', color: C.green }, { cmd: 'jupyter notebook', color: C.blue }].map(p => (
            <Box key={p.cmd} style={{ flexGrow: 1, borderWidth: 1, borderColor: p.color, borderRadius: 4, padding: 6, gap: 3 }}>
              <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <Box style={{ backgroundColor: p.color + '25', borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1 }}>
                  <Text style={{ fontSize: 7, color: p.color, fontWeight: 'bold' }}>{'PROCESS'}</Text>
                </Box>
                <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.color }} />
              </Box>
              <Text style={{ fontSize: 8, color: c.text }}>{p.cmd}</Text>
              <Text style={{ fontSize: 7, color: c.muted }}>{'PTY + stdout + stdin'}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// -- State Lifecycle --------------------------------------------------

function StateLifecycle() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 8, color: c.muted, fontWeight: 'bold' }}>{'ENVIRONMENT STATES'}</Text>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingLeft: 2 }}>
          <Text style={{ fontSize: 8, color: STATE_COLORS.creating }}>{'creating'}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{'-->'}</Text>
          <Text style={{ fontSize: 8, color: STATE_COLORS.installing }}>{'installing'}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{'-->'}</Text>
          <Text style={{ fontSize: 8, color: STATE_COLORS.ready }}>{'ready'}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{'|'}</Text>
          <Text style={{ fontSize: 8, color: STATE_COLORS.failed }}>{'failed'}</Text>
        </Box>
      </Box>
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 8, color: c.muted, fontWeight: 'bold' }}>{'PROCESS STATES'}</Text>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingLeft: 2 }}>
          <Text style={{ fontSize: 8, color: STATE_COLORS.running }}>{'running'}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{'-->'}</Text>
          <Text style={{ fontSize: 8, color: STATE_COLORS.exited }}>{'exited (code)'}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{'|'}</Text>
          <Text style={{ fontSize: 8, color: STATE_COLORS.failed }}>{'failed'}</Text>
        </Box>
      </Box>
      <Box style={{ gap: 2 }}>
        {[...ENV_STATES.map(s => ({ ...s, _prefix: 'env' })), ...PROC_STATES.map(s => ({ ...s, _prefix: 'proc' }))].map(s => (
          <Box key={s._prefix + '-' + s.key + '-desc'} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: STATE_COLORS[s.key] }} />
            <Text style={{ fontSize: 8, color: c.text, width: 65 }}>{s.label}</Text>
            <Text style={{ fontSize: 8, color: c.muted }}>{s.desc}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// -- Pipeline Diagram -------------------------------------------------

function PipelineDiagram() {
  const stages = [
    { label: 'PTY', desc: 'forkpty() via FFI', color: C.proc },
    { label: 'vterm', desc: 'ANSI parse + grid', color: C.blue },
    { label: 'Damage', desc: 'Cell change callback', color: C.yellow },
    { label: 'Settle', desc: '16ms coalesce', color: C.peach },
    { label: 'Bridge', desc: 'Dirty rows to JS', color: C.mauve },
    { label: 'React', desc: 'Re-render', color: C.green },
  ];
  return (
    <S.StackG3W100>
      {stages.map((s, i) => (
        <S.RowCenterG8 key={s.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: s.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: s.color, width: 55, flexShrink: 0, fontWeight: 'bold' }}>{s.label}</Text>
          <S.StoryCap>{s.desc}</S.StoryCap>
          {i < stages.length - 1 && <Text style={{ fontSize: 7, color: C.dimText }}>{'>'}</Text>}
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// -- Live Env Cards ---------------------------------------------------

const SAMPLE_ENVS = [
  { name: 'storybook-shell', type: 'custom', setup: '', cwd: '/tmp' },
  { name: 'demo-python', type: 'python', packages: ['requests'], cwd: '/tmp' },
  { name: 'demo-node', type: 'node', packages: ['lodash'], cwd: '/tmp' },
];

function EnvCardsDemo() {
  const c = useThemeColors();
  const { environments, refresh, remove } = useEnvironments();
  const createRpc = useLoveRPC('env:create');
  const [busy, setBusy] = useState(false);

  const createSamples = async () => {
    setBusy(true);
    for (const env of SAMPLE_ENVS) await createRpc(env);
    await refresh();
    setBusy(false);
  };

  const removeAll = async () => {
    setBusy(true);
    for (const env of environments) await remove(env.config.name);
    await refresh();
    setBusy(false);
  };

  return (
    <Box style={{ width: '100%', gap: 6 }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: c.muted }}>{'Stored environments'}</Text>
        {environments.length === 0 ? (
          <Pressable onPress={createSamples}>
            <Box style={{ backgroundColor: C.env, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: '#000' }}>{busy ? 'Creating...' : 'Create Samples'}</Text>
            </Box>
          </Pressable>
        ) : (
          <Pressable onPress={removeAll}>
            <Box style={{ backgroundColor: C.red + '60', paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: C.red }}>{busy ? 'Removing...' : 'Remove All'}</Text>
            </Box>
          </Pressable>
        )}
      </Box>
      {environments.length === 0 ? (
        <Box style={{ backgroundColor: c.bg, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: c.border, gap: 4, alignItems: 'center' }}>
          <Image src="inbox" style={{ width: 20, height: 20 }} tintColor={c.muted} />
          <Text style={{ fontSize: 10, color: c.muted }}>{'Hit "Create Samples" to populate'}</Text>
        </Box>
      ) : (
        <Box style={{ gap: 6 }}>
          {environments.map(env => {
            const cfg = env.config;
            const typeColor = ENV_TYPES.find(t => t.label === cfg.type)?.color || C.env;
            const statusColor = env.ready ? STATE_COLORS.ready : env.installing ? STATE_COLORS.installing : STATE_COLORS.creating;
            const statusLabel = env.ready ? 'ready' : env.installing ? 'installing' : 'creating';
            return (
              <Box key={cfg.name} style={{ backgroundColor: c.bg, borderRadius: 6, borderWidth: 1, borderColor: c.border, padding: 10, gap: 6 }}>
                <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Image src={TYPE_ICONS[cfg.type] || 'package'} style={{ width: 14, height: 14 }} tintColor={typeColor} />
                  <Text style={{ fontSize: 12, color: c.text, fontWeight: 'bold' }}>{cfg.name}</Text>
                  <Box style={{ backgroundColor: typeColor + '20', borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1 }}>
                    <Text style={{ fontSize: 8, color: typeColor, fontWeight: 'bold' }}>{cfg.type.toUpperCase()}</Text>
                  </Box>
                  <Box style={{ flexGrow: 1 }} />
                  <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
                    <Text style={{ fontSize: 9, color: statusColor }}>{statusLabel}</Text>
                  </Box>
                </Box>
                {cfg.cwd ? (
                  <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Image src="folder" style={{ width: 9, height: 9 }} tintColor={c.muted} />
                    <Text style={{ fontSize: 9, color: c.muted }}>{cfg.cwd}</Text>
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// -- Quick Run Demo ---------------------------------------------------

function QuickRunDemo() {
  const c = useThemeColors();
  const { environments } = useEnvironments();
  const hasEnv = environments.some(e => e.config.name === 'storybook-shell');
  const [started, setStarted] = useState(false);
  const proc = useEnvRun('storybook-shell', 'echo "Hello from environment!" && uname -a && date', { autoStart: false, onExit: () => {} });
  const doRun = () => { setStarted(true); proc.start(); };
  const statusColor = !started ? c.muted : proc.running ? STATE_COLORS.running : proc.exitCode === 0 ? STATE_COLORS.exited : STATE_COLORS.failed;
  const statusLabel = !started ? 'idle' : proc.running ? 'running' : proc.exitCode === 0 ? 'exited (0)' : proc.exitCode !== null ? `failed (${proc.exitCode})` : 'spawning';

  if (!hasEnv) {
    return (
      <Box style={{ width: '100%', backgroundColor: c.bg, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: c.border, gap: 4, alignItems: 'center' }}>
        <Image src="arrow-up" style={{ width: 16, height: 16 }} tintColor={c.muted} />
        <Text style={{ fontSize: 10, color: c.muted }}>{'Create sample environments above first'}</Text>
      </Box>
    );
  }

  return (
    <Box style={{ width: '100%', gap: 6 }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pressable onPress={doRun}>
          <Box style={{ backgroundColor: started ? c.muted : C.green, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 10, color: '#000' }}>{started ? (proc.running ? 'Running...' : 'Done') : 'Run in storybook-shell'}</Text>
          </Box>
        </Pressable>
        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
          <Text style={{ fontSize: 8, color: statusColor }}>{statusLabel}</Text>
        </Box>
      </Box>
      {started && (
        <Box style={{ backgroundColor: c.bg, padding: 8, borderRadius: 4, gap: 3 }}>
          <Text style={{ fontSize: 8, color: c.muted, fontWeight: 'bold' }}>{'STDOUT'}</Text>
          <Text style={{ fontSize: 10, color: C.green }}>{proc.state.stdout || '(waiting...)'}</Text>
        </Box>
      )}
    </Box>
  );
}

// -- Semantic Toggle Demo ---------------------------------------------

function SemanticToggleDemo() {
  const [semantic, setSemantic] = useState(false);
  return (
    <Box style={{ width: '100%', gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pressable onPress={() => setSemantic(!semantic)}>
          <Box style={semantic ? S_TOGGLE_ON : S_TOGGLE_OFF}>
            <Text style={{ fontSize: 10, color: semantic ? C.proc : C.dimText, fontWeight: 'bold' }}>
              {semantic ? 'Semantic PTY' : 'Raw PTY'}
            </Text>
          </Box>
        </Pressable>
        <Text style={{ fontSize: 9, color: C.dimText }}>
          {semantic ? 'Rows classified by lua/classifiers/basic.lua — same PTY session' : 'Standard vterm cell grid'}
        </Text>
      </Box>
      {/* Terminal always mounted — PTY stays alive across toggle */}
      <Box style={{ ...S_TERM, display: semantic ? 'none' : 'flex' }}>
        <Terminal type="user" shell="bash" session="story-toggle" style={{ flexGrow: 1 }} />
      </Box>
      {semantic && (
        <SemanticTerminal session="story-toggle" classifier="basic" showTokens showDebug recording style={S_TERM} />
      )}
    </Box>
  );
}

// -- Canvas Preview ---------------------------------------------------

function CanvasPreview() {
  const rows = [
    { kind: 'status_bar', text: 'Claude Opus 4.6                    12,345 tokens', color: C.dimText },
    { kind: 'empty', text: '', color: 'transparent' },
    { kind: 'assistant', text: "  I'll read the file and fix the bug.", color: '#cdd6f4' },
    { kind: 'tool_header', text: '  Read  src/App.tsx', color: C.blue },
    { kind: 'tool_body', text: '    1  import React from "react"', color: C.teal },
    { kind: 'tool_body', text: '    2  export function App() {', color: C.teal },
    { kind: 'diff_add', text: '  + return <Box style={{ padding: 8 }}>Hello</Box>', color: C.green },
    { kind: 'diff_remove', text: '  - return <Box>Hello</Box>', color: C.red },
    { kind: 'empty', text: '', color: 'transparent' },
    { kind: 'prompt', text: '  > _', color: C.green },
  ];
  return (
    <Box style={{ width: '100%', backgroundColor: C.termBg, borderRadius: 6, borderWidth: 1, borderColor: C.termBorder, padding: 8, gap: 1 }}>
      {rows.map((row, i) => (
        <Box key={i} style={{ flexDirection: 'row', gap: 6, minHeight: 11 }}>
          <Box style={{ width: 3, backgroundColor: row.kind === 'empty' ? 'transparent' : row.color, borderRadius: 1, opacity: 0.5 }} />
          <Text style={{ fontSize: 8, color: row.color, fontFamily: 'monospace' }}>{row.text}</Text>
        </Box>
      ))}
    </Box>
  );
}

// -- Session State Preview --------------------------------------------

function StatePreview() {
  const states = [
    { label: 'Idle', desc: 'At the prompt', color: C.green, active: false },
    { label: 'Thinking', desc: '"Thinking..." phase', color: C.yellow, active: false },
    { label: 'Streaming', desc: 'Generating response', color: C.blue, active: true },
    { label: 'PermGate', desc: 'Awaiting tool permission', color: C.orange, active: false },
  ];
  return (
    <S.StackG3W100>
      {states.map(s => (
        <S.RowCenterG8 key={s.label}>
          <Box style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: s.active ? s.color : 'transparent',
            borderWidth: 1, borderColor: s.color, flexShrink: 0,
          }} />
          <Text style={{ fontSize: 9, color: s.color, width: 70, flexShrink: 0, fontWeight: s.active ? 'bold' : 'normal' }}>{s.label}</Text>
          <S.StoryCap>{s.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// -- Claude Canvas Live Toggle ----------------------------------------

function ClaudeCanvasDemo() {
  const [showLive, setShowLive] = useState(false);
  const [debugMode, setDebugMode] = useState(true);
  const [workingDir, setWorkingDir] = useState('.');
  return (
    <Box style={{ width: '100%', gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => setShowLive(!showLive)}>
          <Box style={{
            backgroundColor: showLive ? 'rgba(243, 139, 168, 0.15)' : 'rgba(166, 227, 161, 0.15)',
            borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 10, color: showLive ? C.red : C.green, fontWeight: 'bold' }}>
              {showLive ? 'Stop Session' : 'Launch Claude Session'}
            </Text>
          </Box>
        </Pressable>
        {showLive ? (
          <Pressable onPress={() => setDebugMode(!debugMode)}>
            <Box style={{
              backgroundColor: debugMode ? 'rgba(137, 180, 250, 0.15)' : 'rgba(250, 179, 135, 0.15)',
              borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 10, color: debugMode ? C.blue : C.peach, fontWeight: 'bold' }}>
                {debugMode ? 'Debug Tags' : 'Styled View'}
              </Text>
            </Box>
          </Pressable>
        ) : null}
      </Box>
      {showLive ? (
        <Box style={{ width: '100%', height: 300 }}>
          <Native type="ClaudeCode" sessionId="story-claude" workingDir={workingDir} configDir="/tmp/claude-login-test" />
          <ClaudeCanvas sessionId="story-claude" recording debugVisible={debugMode} style={{ width: '100%', height: 300, borderRadius: 6 }} />
        </Box>
      ) : (
        <Box style={{
          width: '100%', height: 300, backgroundColor: C.termBg, borderRadius: 6,
          borderWidth: 1, borderColor: C.termBorder, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 11, color: C.dimText }}>{'Canvas inactive'}</Text>
          <Text style={{ fontSize: 8, color: C.dimText }}>{'Press Launch to start'}</Text>
        </Box>
      )}
    </Box>
  );
}

// =====================================================================
// ProcessesStory
// =====================================================================

export function ProcessesStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* Header */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="cpu" tintColor={C.env} />
        <S.StoryTitle>{'Processes'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.env, fontSize: 10 }}>{'@reactjit/environments'}</Text>
        </Box>
        <Box style={{ backgroundColor: 'rgba(34, 211, 238, 0.12)', borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.proc, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ backgroundColor: 'rgba(192, 132, 252, 0.12)', borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.surface, fontSize: 10 }}>{'@reactjit/terminal'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'Reactive process orchestration'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* Content */}
      <ScrollView style={{ flexGrow: 1 }}>
        <PageColumn>

        {/* ═══════════════════════════════════════════════════════════════
            HERO
            ═══════════════════════════════════════════════════════════ */}

        <HeroBand accentColor={C.env}>
          <S.StoryHeadline>
            {'Declare an environment. Run a process. Attach I/O. Promote it into a surface.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'A general-purpose execution layer where commands become UI-native surfaces. Environment sets up context. Process runs inside it. Terminal renders raw I/O. Semantic terminal classifies rows. Specialized surfaces interpret meaning. React declares. Lua executes.'}
          </S.StoryMuted>
          <CodeBlock language="tsx" fontSize={9} code={HERO_CODE} style={{ width: '100%' }} />
        </HeroBand>

        <Divider />

        {/* ═══════════════════════════════════════════════════════════════
            1. ENVIRONMENT — setup context
            ═══════════════════════════════════════════════════════════ */}

        <HeroBand accentColor={C.env}>
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <SectionNum n={1} color={C.env} />
            <SectionLabel icon="container" accentColor={C.env}>{'ENVIRONMENT'}</SectionLabel>
          </Box>
          <S.StoryCap>
            {'Stored setup context. Type + packages + env vars + cwd + activation script. Created once, persisted, reused forever. React declares the domain. Lua owns the ugly reality.'}
          </S.StoryCap>
        </HeroBand>

        <Band>
          <Half>
            <SectionLabel icon="git-branch" accentColor={C.env}>{'CONCEPT'}</SectionLabel>
            <S.StoryBody>
              {'An environment is a stored config. A process is a running command inside that context. One env spawns many processes.'}
            </S.StoryBody>
            <ConceptDiagram />
          </Half>
          <Half>
            <SectionLabel icon="activity" accentColor={C.env}>{'STATE LIFECYCLE'}</SectionLabel>
            <S.StoryBody>
              {'Both environments and processes have explicit state machines. No silent transitions.'}
            </S.StoryBody>
            <StateLifecycle />
          </Half>
        </Band>

        <Divider />

        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={PYTHON_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="code" accentColor={C.blue}>{'PYTHON'}</SectionLabel>
            <S.StoryBody>
              {'Creates a venv, installs packages via pip, activates before running. env.ready flips true once setup completes.'}
            </S.StoryBody>
            <CatalogList items={ENV_TYPES} />
          </Half>
        </Band>

        <Divider />

        <Band>
          <Half>
            <SectionLabel icon="settings" accentColor={C.env}>{'MORE TYPES'}</SectionLabel>
            <S.StoryBody>
              {'Node, Conda, Docker, Custom. Each has its own activation strategy.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={8} code={NODE_CODE} style={{ width: '100%' }} />
            <CodeBlock language="tsx" fontSize={8} code={DOCKER_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="database" accentColor={C.env}>{'LIVE: STORED ENVIRONMENTS'}</SectionLabel>
            <EnvCardsDemo />
          </Half>
        </Band>

        <Divider />

        {/* ═══════════════════════════════════════════════════════════════
            2. PROCESS — running command + PTY lifecycle
            ═══════════════════════════════════════════════════════════ */}

        <HeroBand accentColor={C.proc}>
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <SectionNum n={2} color={C.proc} />
            <SectionLabel icon="terminal" accentColor={C.proc}>{'PROCESS'}</SectionLabel>
          </Box>
          <S.StoryCap>
            {'A running command inside an environment. Real PTY, real shell, real stdio. forkpty() via LuaJIT FFI. libvterm parses ANSI. Damage callbacks coalesce. Events flow to React.'}
          </S.StoryCap>
        </HeroBand>

        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={ONELINER_CODE} style={{ width: '100%' }} />
            <CodeBlock language="tsx" fontSize={8} code={PROCESS_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="zap" accentColor={C.peach}>{'useEnvRun + useProcess'}</SectionLabel>
            <S.StoryBody>
              {'useEnvRun is the one-liner: env name + command = running process. useProcess gives full control: stdout/stderr callbacks, stdin write, resize, kill.'}
            </S.StoryBody>
            <SectionLabel icon="play" accentColor={C.green}>{'LIVE: QUICK RUN'}</SectionLabel>
            <QuickRunDemo />
          </Half>
        </Band>

        <Divider />

        <Band>
          <Half>
            <SectionLabel icon="code" accentColor={C.proc}>{'usePTY + TERMINAL EVENTS'}</SectionLabel>
            <S.StoryBody>
              {'usePTY is the lower-level hook. Returns output, send, sendLine, connected, and terminalProps. Three PTY types: user, root, template.'}
            </S.StoryBody>
            <CatalogList items={PTY_TYPES} />
            <CatalogList items={PTY_EVENTS} />
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={USEPTY_CODE} style={{ width: '100%' }} />
            <CodeBlock language="tsx" fontSize={8} code={TERMINAL_EVENTS_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* Pipeline callout */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Full pipeline: forkpty() via LuaJIT FFI allocates a kernel pseudo-terminal. libvterm parses ANSI into a cell grid. Damage callbacks coalesce at 16ms. Dirty rows flush to React as typed events. Total latency: 1-2 frames.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        <Band>
          <Half>
            <PipelineDiagram />
          </Half>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={PIPELINE_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ═══════════════════════════════════════════════════════════════
            3. TERMINAL — raw I/O surface
            ═══════════════════════════════════════════════════════════ */}

        <HeroBand accentColor={C.term}>
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <SectionNum n={3} color={C.term} />
            <SectionLabel icon="monitor" accentColor={C.term}>{'TERMINAL'}</SectionLabel>
          </Box>
          <S.StoryCap>
            {'Visual, interactive PTY terminal. Click to focus, type to interact. ANSI colors, cursor blink, scroll. Attach to any process.'}
          </S.StoryCap>
          <Terminal type="user" shell="bash" session="story-raw" rows={24} cols={120} style={S_TERM} />
          <Text style={{ fontSize: 9, color: C.dimText }}>
            {'Click to focus. Type to interact. Scroll with mouse wheel. Ctrl+C to interrupt.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ═══════════════════════════════════════════════════════════════
            4. SEMANTIC TERMINAL — classified rows
            ═══════════════════════════════════════════════════════════ */}

        <HeroBand accentColor={C.semantic}>
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <SectionNum n={4} color={C.semantic} />
            <SectionLabel icon="eye" accentColor={C.semantic}>{'SEMANTIC TERMINAL'}</SectionLabel>
          </Box>
          <S.StoryCap>
            {'Same bytes, richer ontology. Each row is classified into semantic tokens by a Lua-side classifier. Token badges, colored gutter, debug info — same PTY, different view.'}
          </S.StoryCap>
          <SemanticToggleDemo />
        </HeroBand>

        <Divider />

        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={SEMANTIC_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="tag" accentColor={C.mauve}>{'ROW CLASSIFICATION'}</SectionLabel>
            <S.StoryBody>
              {'Classifiers live in lua/classifiers/. "basic" detects prompts vs output. "claude" detects thinking, tool use, diffs, permissions. Custom classifiers are Lua modules returning classify(row_text, context).'}
            </S.StoryBody>
            <CatalogList items={TOKEN_TYPES} />
          </Half>
        </Band>

        <Divider />

        <Band>
          <Half>
            <CodeBlock language="lua" fontSize={8} code={CLASSIFICATION_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="play-circle" accentColor={C.yellow}>{'PLAYBACK'}</SectionLabel>
            <S.StoryBody>
              {'Record sessions to .rec.lua files. Play back with transport controls. Classification results identical to live mode.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={8} code={PLAYBACK_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ═══════════════════════════════════════════════════════════════
            5. SPECIALIZED SURFACES
            ═══════════════════════════════════════════════════════════ */}

        <HeroBand accentColor={C.surface}>
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <SectionNum n={5} color={C.surface} />
            <SectionLabel icon="zap" accentColor={C.surface}>{'SPECIALIZED SURFACES'}</SectionLabel>
          </Box>
          <S.StoryCap>
            {'A process is data. A surface is interpretation. ClaudeCanvas is the first specialized surface — a full Claude Code session with semantic graph, stable identity, and block renderer. More coming.'}
          </S.StoryCap>
        </HeroBand>

        <Band>
          <Half>
            <SectionLabel icon="zap" accentColor={C.surface}>{'CLAUDE CANVAS'}</SectionLabel>
            <S.StoryBody>
              {'One element. One prop. Full Claude Code session with semantic rendering, scroll, keyboard input, permission gates, and status chrome.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={CANVAS_CODE} style={{ width: '100%' }} />
            <CodeBlock language="tsx" fontSize={8} code={CANVAS_PROPS_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <CanvasPreview />
          </Half>
        </Band>

        <Divider />

        <Band>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.green}>{'LIVE CANVAS'}</SectionLabel>
            <ClaudeCanvasDemo />
          </Half>
          <Half>
            <SectionLabel icon="activity" accentColor={C.yellow}>{'SESSION STATE MACHINE'}</SectionLabel>
            <S.StoryBody>
              {'claude_session.lua tracks where Claude is. Idle shows input, Streaming shows progress, PermGate shows permission modal.'}
            </S.StoryBody>
            <StatePreview />
          </Half>
        </Band>

        <Divider />

        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={8} code={SESSION_CHROME_CODE} style={{ width: '100%' }} />
            <CodeBlock language="tsx" fontSize={8} code={USECLAUDE_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="monitor" accentColor={C.blue}>{'SESSION HOOKS'}</SectionLabel>
            <S.StoryBody>
              {'useSessionChrome reads classified tokens for display chrome. useClaude manages permission/question/status state. Both read from the PTY via the classifier — never write.'}
            </S.StoryBody>
          </Half>
        </Band>

        <Divider />

        {/* Future surfaces */}
        <S.StoryFullBand>
          <SectionLabel icon="layers" accentColor={C.surface}>{'THE FUTURE'}</SectionLabel>
          <CodeBlock language="tsx" fontSize={8} code={FUTURE_CODE} style={{ width: '100%' }} />
        </S.StoryFullBand>

        <Divider />

        {/* Architecture callout */}
        <CalloutBand borderColor={'rgba(192, 132, 252, 0.3)'} bgColor={'rgba(192, 132, 252, 0.06)'}>
          <S.StoryInfoIcon src="info" tintColor={C.surface} />
          <S.StoryBody>
            {'This is not a terminal widget. This is not just a process runner. This is not just a Claude embed. It is a general-purpose execution layer where commands become UI-native surfaces. React declares. Lua executes. PTY/process lifecycle is owned in Lua. Render surfaces are just views over runtime state.'}
          </S.StoryBody>
        </CalloutBand>

        </PageColumn>
      </ScrollView>

      {/* Footer */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="cpu" />
        <S.StoryBreadcrumbActive>{'Processes'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
