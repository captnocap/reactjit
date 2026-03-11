/**
 * Environments — Process environment management for ReactJIT.
 *
 * Create, manage, and run processes inside isolated environments (Python venvs,
 * Node, Conda, Rust, Docker, custom). Persistent configs, PTY I/O, one-liner API.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { useEnvironments, useEnvRun } from '../../../packages/environments/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
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
  pink: '#ec4899',
};

// ── State colors (lifecycle) ─────────────────────────────

const STATE_COLORS: Record<string, string> = {
  creating: C.yellow,
  installing: C.peach,
  ready: C.green,
  running: C.blue,
  exited: C.mauve,
  failed: C.red,
  rebuilding: C.yellow,
  missing: '#585b70',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { useEnvironment, useProcess,
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

// ── Hoisted data arrays ─────────────────────────────────

const ENV_TYPES = [
  { label: 'python', desc: 'venv + pip, version selection', color: C.blue },
  { label: 'node', desc: 'nvm + npm/yarn/pnpm', color: C.green },
  { label: 'conda', desc: 'conda create + activate', color: C.yellow },
  { label: 'rust', desc: 'cargo install, PATH setup', color: C.peach },
  { label: 'docker', desc: 'docker run with bind mounts', color: C.pink },
  { label: 'custom', desc: 'arbitrary shell setup commands', color: C.mauve },
];

const HOOKS_LIST = [
  { label: 'useEnvironment', desc: 'Create and manage a single env', color: C.blue },
  { label: 'useProcess', desc: 'Attach to a running process I/O', color: C.green },
  { label: 'useEnvironments', desc: 'List and manage all stored envs', color: C.yellow },
  { label: 'useEnvRun', desc: 'One-liner: run command in an env', color: C.peach },
];

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

// ── Type icon map ────────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  python: 'code',
  node: 'hexagon',
  conda: 'flask-conical',
  rust: 'cog',
  docker: 'box',
  custom: 'wrench',
};

// ── Concept Diagram ──────────────────────────────────────

function ConceptDiagram() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 10 }}>
      {/* Environment box */}
      <Box style={{
        borderWidth: 1, borderColor: C.accent, borderRadius: 6,
        padding: 10, gap: 6,
      }}>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{
            backgroundColor: C.accentDim, borderRadius: 3,
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
          }}>
            <Text style={{ fontSize: 8, color: C.accent, fontWeight: 'bold' }}>{'ENVIRONMENT'}</Text>
          </Box>
          <Text style={{ fontSize: 9, color: c.muted }}>{'= setup context'}</Text>
        </Box>
        <Text style={{ fontSize: 9, color: c.text }}>
          {'Type + packages + env vars + cwd + activation script'}
        </Text>
        <Text style={{ fontSize: 8, color: c.muted }}>
          {'Persists across sessions. Created once, reused forever.'}
        </Text>

        {/* Process boxes inside */}
        <Box style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <Box style={{
            flexGrow: 1, borderWidth: 1, borderColor: C.green,
            borderRadius: 4, padding: 6, gap: 3,
          }}>
            <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Box style={{
                backgroundColor: 'rgba(166, 227, 161, 0.15)', borderRadius: 3,
                paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
              }}>
                <Text style={{ fontSize: 7, color: C.green, fontWeight: 'bold' }}>{'PROCESS'}</Text>
              </Box>
              <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.green }} />
            </Box>
            <Text style={{ fontSize: 8, color: c.text }}>{'python train.py'}</Text>
            <Text style={{ fontSize: 7, color: c.muted }}>{'PTY + stdout + stdin'}</Text>
          </Box>
          <Box style={{
            flexGrow: 1, borderWidth: 1, borderColor: C.blue,
            borderRadius: 4, padding: 6, gap: 3,
          }}>
            <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Box style={{
                backgroundColor: 'rgba(137, 180, 250, 0.15)', borderRadius: 3,
                paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
              }}>
                <Text style={{ fontSize: 7, color: C.blue, fontWeight: 'bold' }}>{'PROCESS'}</Text>
              </Box>
              <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.mauve }} />
            </Box>
            <Text style={{ fontSize: 8, color: c.text }}>{'jupyter notebook'}</Text>
            <Text style={{ fontSize: 7, color: c.muted }}>{'PTY + stdout + stdin'}</Text>
          </Box>
        </Box>
      </Box>

      {/* Arrow: env.run() spawns processes */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12 }}>
        <Image src="arrow-right" style={{ width: 10, height: 10 }} tintColor={c.muted} />
        <Text style={{ fontSize: 8, color: c.muted }}>
          {'env.run() spawns processes inside the activated environment'}
        </Text>
      </Box>
    </Box>
  );
}

// ── State Lifecycle ──────────────────────────────────────

function StateLifecycle() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 8 }}>
      {/* Environment states */}
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 8, color: c.muted, fontWeight: 'bold' }}>{'ENVIRONMENT STATES'}</Text>
        <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {ENV_STATES.map((s) => (
            <Box key={s.key} style={{
              flexDirection: 'row', gap: 4, alignItems: 'center',
              backgroundColor: c.bg, borderRadius: 4,
              paddingLeft: 6, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
            }}>
              <Box style={{
                width: 7, height: 7, borderRadius: 4,
                backgroundColor: STATE_COLORS[s.key],
              }} />
              <Text style={{ fontSize: 9, color: c.text, fontWeight: 'normal' }}>{s.label}</Text>
            </Box>
          ))}
        </Box>
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

      {/* Process states */}
      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 8, color: c.muted, fontWeight: 'bold' }}>{'PROCESS STATES'}</Text>
        <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
          {PROC_STATES.map((s) => (
            <Box key={s.key} style={{
              flexDirection: 'row', gap: 4, alignItems: 'center',
              backgroundColor: c.bg, borderRadius: 4,
              paddingLeft: 6, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
            }}>
              <Box style={{
                width: 7, height: 7, borderRadius: 4,
                backgroundColor: STATE_COLORS[s.key],
              }} />
              <Text style={{ fontSize: 9, color: c.text, fontWeight: 'normal' }}>{s.label}</Text>
            </Box>
          ))}
        </Box>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingLeft: 2 }}>
          <Text style={{ fontSize: 8, color: STATE_COLORS.running }}>{'running'}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{'-->'}</Text>
          <Text style={{ fontSize: 8, color: STATE_COLORS.exited }}>{'exited (code)'}</Text>
          <Text style={{ fontSize: 8, color: c.muted }}>{'|'}</Text>
          <Text style={{ fontSize: 8, color: STATE_COLORS.failed }}>{'failed'}</Text>
        </Box>
      </Box>

      {/* Descriptions */}
      <Box style={{ gap: 2 }}>
        {[...ENV_STATES, ...PROC_STATES].map((s) => (
          <Box key={s.key + '-desc'} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{
              width: 5, height: 5, borderRadius: 3,
              backgroundColor: STATE_COLORS[s.key],
            }} />
            <Text style={{ fontSize: 8, color: c.text, width: 65 }}>{s.label}</Text>
            <Text style={{ fontSize: 8, color: c.muted }}>{s.desc}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Live Demo: Environment Cards ─────────────────────────

function EnvCardsDemo() {
  const c = useThemeColors();
  const { environments, refresh } = useEnvironments();
  const [refreshing, setRefreshing] = useState(false);

  const doRefresh = useCallback(() => {
    setRefreshing(true);
    refresh().finally(() => setRefreshing(false));
  }, [refresh]);

  return (
    <>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: c.muted }}>
          {'Stored environments on this machine'}
        </Text>
        <Pressable onPress={doRefresh}>
          <Box style={{
            backgroundColor: C.accent,
            paddingLeft: 8, paddingRight: 8,
            paddingTop: 3, paddingBottom: 3,
            borderRadius: 4,
          }}>
            <Text style={{ fontSize: 10, color: '#000', fontWeight: 'normal' }}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </Box>
        </Pressable>
      </Box>

      {environments.length === 0 ? (
        <Box style={{
          backgroundColor: c.bg, padding: 12, borderRadius: 6,
          borderWidth: 1, borderColor: c.border, gap: 4, alignItems: 'center',
        }}>
          <Image src="inbox" style={{ width: 20, height: 20 }} tintColor={c.muted} />
          <Text style={{ fontSize: 10, color: c.muted }}>
            {'No environments yet'}
          </Text>
          <Text style={{ fontSize: 9, color: c.muted }}>
            {'useEnvironment(name, config) creates one'}
          </Text>
        </Box>
      ) : (
        <Box style={{ gap: 6 }}>
          {environments.map((env) => {
            const cfg = env.config;
            const typeColor = ENV_TYPES.find((t) => t.label === cfg.type)?.color || C.accent;
            const statusColor = env.ready ? STATE_COLORS.ready :
              env.installing ? STATE_COLORS.installing : STATE_COLORS.creating;
            const statusLabel = env.ready ? 'ready' :
              env.installing ? 'installing' : 'creating';
            const pkgCount = cfg.packages?.length || 0;
            const icon = TYPE_ICONS[cfg.type] || 'package';

            return (
              <Box key={cfg.name} style={{
                backgroundColor: c.bg, borderRadius: 6,
                borderWidth: 1, borderColor: c.border,
                padding: 10, gap: 6,
              }}>
                {/* Card header: name + type badge + status */}
                <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Image src={icon} style={{ width: 14, height: 14 }} tintColor={typeColor} />
                  <Text style={{ fontSize: 12, color: c.text, fontWeight: 'bold' }}>
                    {cfg.name}
                  </Text>
                  <Box style={{
                    backgroundColor: typeColor + '20', borderRadius: 3,
                    paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1,
                  }}>
                    <Text style={{ fontSize: 8, color: typeColor, fontWeight: 'bold' }}>
                      {cfg.type.toUpperCase()}
                    </Text>
                  </Box>
                  <Box style={{ flexGrow: 1 }} />
                  <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                    <Box style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: statusColor,
                    }} />
                    <Text style={{ fontSize: 9, color: statusColor }}>{statusLabel}</Text>
                  </Box>
                </Box>

                {/* Card details: cwd, packages, path */}
                <Box style={{ gap: 3 }}>
                  {cfg.cwd ? (
                    <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="folder" style={{ width: 9, height: 9 }} tintColor={c.muted} />
                      <Text style={{ fontSize: 9, color: c.muted }}>{cfg.cwd}</Text>
                    </Box>
                  ) : null}
                  {pkgCount > 0 ? (
                    <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="package" style={{ width: 9, height: 9 }} tintColor={c.muted} />
                      <Text style={{ fontSize: 9, color: c.muted }}>
                        {`${pkgCount} package${pkgCount !== 1 ? 's' : ''}`}
                      </Text>
                      <Text style={{ fontSize: 8, color: c.muted }}>
                        {(cfg.packages || []).slice(0, 5).join(', ')}
                        {pkgCount > 5 ? ` +${pkgCount - 5} more` : ''}
                      </Text>
                    </Box>
                  ) : null}
                  {env.path ? (
                    <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="hard-drive" style={{ width: 9, height: 9 }} tintColor={c.muted} />
                      <Text style={{ fontSize: 8, color: c.muted }}>{env.path}</Text>
                    </Box>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </>
  );
}

// ── Live Demo: Quick Run ────────────────────────────────

function QuickRunDemo() {
  const c = useThemeColors();
  const [started, setStarted] = useState(false);
  const proc = useEnvRun('demo-env', 'echo "Hello from environment!" && uname -a && date', {
    autoStart: false,
    onExit: () => {},
  });

  const doRun = useCallback(() => {
    setStarted(true);
    proc.start();
  }, [proc]);

  const statusColor = !started ? c.muted :
    proc.running ? STATE_COLORS.running :
    proc.exitCode === 0 ? STATE_COLORS.exited : STATE_COLORS.failed;
  const statusLabel = !started ? 'idle' :
    proc.running ? 'running' :
    proc.exitCode === 0 ? 'exited (0)' :
    proc.exitCode !== null ? `failed (${proc.exitCode})` : 'spawning';

  return (
    <>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: c.muted }}>
          {'Run a command in any stored environment'}
        </Text>
        <Pressable onPress={doRun}>
          <Box style={{
            backgroundColor: started ? c.muted : C.green,
            paddingLeft: 8, paddingRight: 8,
            paddingTop: 3, paddingBottom: 3,
            borderRadius: 4,
          }}>
            <Text style={{ fontSize: 10, color: '#000', fontWeight: 'normal' }}>
              {started ? (proc.running ? 'Running...' : 'Done') : 'Run'}
            </Text>
          </Box>
        </Pressable>
        {/* Status indicator */}
        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
          <Text style={{ fontSize: 8, color: statusColor }}>{statusLabel}</Text>
        </Box>
      </Box>

      {started && (
        <Box style={{ backgroundColor: c.bg, padding: 8, borderRadius: 4, gap: 3 }}>
          <Text style={{ fontSize: 8, color: c.muted, fontWeight: 'bold' }}>{'STDOUT'}</Text>
          <Text style={{ fontSize: 10, color: C.green }}>
            {proc.state.stdout || '(waiting...)'}
          </Text>
        </Box>
      )}
    </>
  );
}

// ── Feature catalog ─────────────────────────────────────

function EnvTypeCatalog() {
  const c = useThemeColors();
  return (
    <>
      {ENV_TYPES.map((t) => (
        <Box key={t.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.color }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'normal', width: 60 }}>{t.label}</Text>
          <Text style={{ fontSize: 10, color: c.muted }}>{t.desc}</Text>
        </Box>
      ))}
    </>
  );
}

function HooksCatalog() {
  const c = useThemeColors();
  return (
    <>
      {HOOKS_LIST.map((h) => (
        <Box key={h.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: h.color }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'normal', width: 120 }}>{h.label}</Text>
          <Text style={{ fontSize: 10, color: c.muted }}>{h.desc}</Text>
        </Box>
      ))}
    </>
  );
}

// ── EnvironmentsStory ─────────────────────────────────────────

export function EnvironmentsStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="container" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Environments'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/environments'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Process environments + PTY I/O'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Declare an environment. Run a process. Attach I/O. Persist the config.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'React declares the operational domain. Lua owns the ugly reality: venv activation, PTY lifecycle, package installation, process signals. The environment is the setup context. The process is the running command inside it.'}
          </Text>
        </HeroBand>

        <Divider />

        {/* ── CONCEPT: Environment vs Process ── */}
        <Band>
          <Half>
            <SectionLabel icon="git-branch" accentColor={C.accent}>{'CONCEPT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Two distinct abstractions. An environment is a stored config — type, packages, env vars, activation script. A process is a running command inside that context. One env spawns many processes.'}
            </Text>
            <ConceptDiagram />
          </Half>
          <Half>
            <SectionLabel icon="activity" accentColor={C.accent}>{'STATE LIFECYCLE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Both environments and processes have explicit state machines. The current state is always visible — no silent transitions, no mystery waiting.'}
            </Text>
            <StateLifecycle />
          </Half>
        </Band>

        <Divider />

        {/* ── text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Four hooks. useEnvironment creates and manages an env. useProcess attaches to running process I/O. useEnvironments lists all stored envs. useEnvRun is the one-liner.'}
            </Text>
            <Box style={{ marginTop: 4, gap: 3 }}>
              <HooksCatalog />
            </Box>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — PYTHON ENV (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={PYTHON_CODE} />
          <Half>
            <SectionLabel icon="code" accentColor={C.blue}>{'PYTHON ENVIRONMENT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Creates a venv, installs packages via pip, and activates automatically before running any command. Specify python version, packages, and working directory.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9, marginTop: 4 }}>
              {'env.ready flips to true once venv creation and pip install complete. Package installation runs asynchronously in a background PTY.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── text | code — PROCESS I/O ── */}
        <Band>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.green}>{'PROCESS I/O'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useProcess gives you full control over a running process. Read stdout/stderr via callbacks, write to stdin, resize the PTY, or kill the process.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9, marginTop: 4 }}>
              {'Processes run in a real PTY by default — programs see a terminal (isatty=true), colors work, readline works, Ctrl+C works.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={PROCESS_CODE} />
        </Band>

        <Divider />

        {/* ── Callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'All process I/O runs through Lua PTY — zero JS event loop jitter. Environments activate via shell preamble (source venv, conda activate, nvm use) before your command runs.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── code | text — ONE-LINER (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={ONELINER_CODE} />
          <Half>
            <SectionLabel icon="zap" accentColor={C.peach}>{'ONE-LINER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useEnvRun combines useEnvironment + useProcess into a single call. Pass an env name and a command — get back stdout, running state, send(), and kill().'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Live demo: env cards + quick run ── */}
        <Band>
          <Half>
            <SectionLabel icon="database" accentColor={C.accent}>{'LIVE: STORED ENVIRONMENTS'}</SectionLabel>
            <EnvCardsDemo />
          </Half>
          <Half>
            <SectionLabel icon="play" accentColor={C.green}>{'LIVE: QUICK RUN'}</SectionLabel>
            <QuickRunDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── text | code — ENV TYPES ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'ENVIRONMENT TYPES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Six built-in types. Each has its own activation strategy — the right shell preamble runs automatically before every command.'}
            </Text>
            <Box style={{ marginTop: 4, gap: 3 }}>
              <EnvTypeCatalog />
            </Box>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={NODE_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — CONDA (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={CONDA_CODE} />
          <Half>
            <SectionLabel icon="flask-conical" accentColor={C.yellow}>{'CONDA'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Conda environments get created with conda create and activated via conda shell hook. Specify python version and conda packages directly.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── text | code — CUSTOM ── */}
        <Band>
          <Half>
            <SectionLabel icon="wrench" accentColor={C.mauve}>{'CUSTOM SETUP'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'For environments that don\'t fit a preset type. Provide arbitrary shell setup commands that run before every process. Set env vars, source scripts, configure paths.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={CUSTOM_CODE} />
        </Band>

        <Divider />

        {/* ── code | text — DOCKER (zigzag) ── */}
        <Band>
          <CodeBlock language="tsx" fontSize={9} code={DOCKER_CODE} />
          <Half>
            <SectionLabel icon="box" accentColor={C.pink}>{'DOCKER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Pull an image and run commands inside containers. Pass docker flags for GPU access, volume mounts, network config, or resource limits.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── text | code — MANAGEMENT ── */}
        <Band>
          <Half>
            <SectionLabel icon="settings" accentColor={C.accent}>{'MANAGEMENT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useEnvironments() lists all stored envs. Remove old ones, refresh the list, or rebuild an env from scratch. Configs persist in ~/.reactjit/environments/index.json.'}
            </Text>
          </Half>
          <CodeBlock language="tsx" fontSize={9} code={MANAGE_CODE} />
        </Band>

        <Divider />

        {/* ── Scope callout ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="shield" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'Scope: declare env, run process, attach I/O, persist config. This is not a task runner, CI system, or orchestrator. It is a substrate for connecting existing toolchains to a reactive surface.'}
          </Text>
        </CalloutBand>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Dev'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="container" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Environments'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
