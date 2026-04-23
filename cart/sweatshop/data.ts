export const SETTINGS_PROVIDERS = [
  {
    id: 'anthropic',
    short: 'claude',
    name: 'Anthropic',
    tone: '#ff7b72',
    status: 'ready',
    driver: 'remote API / policy aware',
    env: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-6',
    route: 'ask / plan / task / agent',
    summary: 'Current live chat path in the TSX cart. This is the baseline provider surface that should grow into a full routing matrix.',
    detail: 'Needs auth state, per-mode routing, retry policy, and provider-local settings components.',
    pressure: 'provider cards + dense route detail + shell state sync + status badges',
    capabilities: ['stream text', 'tool use', 'long context', 'background agent spawn'],
  },
  {
    id: 'openai',
    short: 'gpt',
    name: 'OpenAI',
    tone: '#79c0ff',
    status: 'planned',
    driver: 'remote API / multi-model',
    env: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5.4',
    route: 'chat / tools / memory',
    summary: 'Intended for general chat, tool-heavy orchestration, and provider comparison inside the same settings shell.',
    detail: 'Needs provider-specific auth, rate policy, tool schema controls, and model capability descriptors.',
    pressure: 'multiple provider components with shared shell but distinct configuration depth',
    capabilities: ['tool calling', 'vision', 'realtime previews', 'formatting assistant'],
  },
  {
    id: 'local-runtime',
    short: 'local',
    name: 'Local Runtime',
    tone: '#7ee787',
    status: 'reference',
    driver: 'host runtime / embedded',
    env: 'reactjit runtime',
    defaultModel: 'workspace heuristics',
    route: 'offline helpers / local transforms',
    summary: 'Represents native-local orchestration through host helpers for durable UI behavior and plugin methods.',
    detail: 'Useful for policy engines, long-lived UI helpers, and plugin surfaces that do not require network round-trips.',
    pressure: 'cross-runtime ownership between TSX view state, QuickJS heap state, and host capabilities',
    capabilities: ['local transforms', 'automation hooks', 'UI orchestration', 'plugin glue'],
  },
  {
    id: 'qjs-plugin',
    short: 'qjs',
    name: 'QJS Runtime',
    tone: '#d2a8ff',
    status: 'reference',
    driver: 'embedded JS runtime',
    env: 'qjs_runtime',
    defaultModel: 'plugin logic',
    route: 'extensions / eval / bridge',
    summary: 'Treats QuickJS as a first-class plugin surface instead of a hidden compiler/runtime detail.',
    detail: 'Needed for extension-style logic, VS Code parity experiments, richer plugin sandboxes, and automation graphs.',
    pressure: 'plugin settings + runtime bridge + persistent capability matrix in TSX',
    capabilities: ['extension runtime', 'eval bridge', 'automation workers', 'context transforms'],
  },
];

export const SETTINGS_CONTEXT_ROWS = [
  { name: 'Workspace Snapshot', owner: 'QJS + host exec', source: 'find / rg / file snapshots / curated paths', summary: 'Feeds landing cards, search fallback, agent payload, and settings diagnostics from one shared repo scan.', stress: 'large nested arrays, sort priority, path filtering, and cross-panel reuse', output: 'landing / search / agent / settings', tone: '#2d62ff', status: 'live' },
  { name: 'Git Context', owner: 'host exec', source: 'git status / branch / remote / worktree', summary: 'Branch state, ahead-behind counts, dirty sets, and recent changes plug into providers, memory, and shell chrome.', stress: 'derived summaries reused across top bar, status bar, landing, and chat', output: 'status bar / provider routing / memory summaries', tone: '#7ee787', status: 'live' },
  { name: 'Context Components', owner: 'TSX surface', source: 'selected file, settings surface, open tabs, landing focus', summary: 'The product needs explicit context components instead of ad hoc attachments. This surface models the composition points.', stress: 'componentized chips, dense summaries, special pseudo-documents, and multi-surface selection', output: 'composer / provider config / memory policies', tone: '#d2a8ff', status: 'planned' },
  { name: 'GitHub / External Sources', owner: 'plugin runtime', source: 'connector-backed context feeds', summary: 'External context should live beside workspace and git context instead of bypassing the IDE shell.', stress: 'runtime/plugin boundaries plus TSX-authored inspection UI', output: 'provider routing / plugin tools / slash commands', tone: '#ffa657', status: 'planned' },
];

export const SETTINGS_MEMORY_ROWS = [
  { name: 'Session Memory', backend: 'QuickJS heap', scope: 'conversation', retention: 'ephemeral', summary: 'Short-lived coordination for current ask/plan/task/agent work. Good for quick state but risky if it becomes the only memory layer.', risk: 'easy drift between visible UI state and hidden runtime memory', tone: '#2d62ff', status: 'active' },
  { name: 'Workspace Memory', backend: 'SQLite', scope: 'repo', retention: 'durable', summary: 'Persistent repo notes, file embeddings, agent outcomes, and task histories should consolidate into one workspace-local store.', risk: 'needs migration story, conflict handling, and test coverage for real disk-backed flows', tone: '#7ee787', status: 'planned' },
  { name: 'Context Cache', backend: 'QJS runtime', scope: 'provider routing', retention: 'bounded', summary: 'Caches derived context packets so repeated provider requests and plugin rules do not rescan the whole workspace on every action.', risk: 'cache invalidation across git refresh, file writes, and plugin mutations', tone: '#d2a8ff', status: 'planned' },
  { name: 'Agent Transcript Index', backend: 'SQLite + file blobs', scope: 'long running work', retention: 'durable', summary: 'Background agents need indexed transcript, tool output, and attachment trails that can be reopened from real product UI.', risk: 'cross-window replay, media attachments, and compaction policies', tone: '#ffb86b', status: 'reference' },
];

export const SETTINGS_PLUGIN_ROWS = [
  { name: 'Lua Runtime', runtime: 'native long-lived runtime', summary: 'Best fit for embedded automation, UI-coupled plugins, and capability wrappers that need durable in-process state.', stress: 'module boundaries, state ownership, and TSX-authored inspectors', tone: '#7ee787', status: 'reference' },
  { name: 'QJS Runtime', runtime: 'embedded JS plugin surface', summary: 'Supports extension-style logic, parity with Cursor / VS Code mental models, and richer bridge-driven plugin experiments.', stress: 'sandboxing, bridge API shape, settings components, and runtime diagnostics', tone: '#d2a8ff', status: 'reference' },
  { name: 'Marketplace Bridge', runtime: 'Cursor plugins / VS Code extensions', summary: 'The long-term product surface needs install, enable, disable, capability inspect, and runtime pairing UI.', stress: 'manifest parsing, capability cards, extension contribution points, and plugin policy states', tone: '#79c0ff', status: 'planned' },
];

export const SETTINGS_AUTOMATION_ROWS = [
  { name: 'Build Failure Capture', runtime: 'IFTTT + test harness', summary: 'When a conformance slice fails build, capture the failure, attach key diagnostics, and surface it back into the IDE shell.', stress: 'compiler failure plumbing into product UI and long-term storage', tone: '#ff7b72', status: 'planned' },
  { name: 'Post-Write Reindex', runtime: 'IFTTT + workspace scan', summary: 'File writes should be able to trigger targeted refresh, context cache invalidation, and memory persistence without manual refresh clicks.', stress: 'runtime event hooks + repo scans + shell updates', tone: '#79c0ff', status: 'planned' },
  { name: 'Media Preview Rules', runtime: 'IFTTT + video/image preview', summary: 'Dropped media should route into preview panes, metadata extraction, and plugin hooks instead of living as raw attachments only.', stress: 'file drop, previews, and plugin/runtime boundaries', tone: '#7ee787', status: 'reference' },
  { name: 'Network Watchers', runtime: 'net + provider health', summary: 'Provider failures, socket disconnects, and remote index sync issues should trigger actionable shell state changes.', stress: 'live network state inside dense settings surfaces', tone: '#d2a8ff', status: 'reference' },
];

export const SETTINGS_CAPABILITY_ROWS = [
  { name: 'SQLite Memory Stores', status: 'planned', tone: '#7ee787', surface: 'memory / settings / history', summary: 'Use the existing SQLite runtime as the durable memory backbone for conversations, repo notes, and agent transcripts.', reference: 'runtime/hooks/sqlite.ts', pressure: 'durable stores, migration UI, and long-lived product state' },
  { name: 'File Drop Intake', status: 'reference', tone: '#79c0ff', surface: 'composer / plugin install / media preview', summary: 'Dropped files should attach to chat, seed plugins, and populate preview cards through one intake path.', reference: 'framework/filedrop.zig', pressure: 'runtime input events + attachments + previews + automation' },
  { name: 'Image / Video Preview', status: 'reference', tone: '#ffb86b', surface: 'editor / attachments / artifact viewer', summary: 'The IDE needs native previews for screenshots, generated assets, and agent artifacts rather than shelling out to external tools.', reference: 'framework/videos.zig and video surfaces', pressure: 'media nodes, playback controls, and dense inspector UI' },
  { name: 'Multiwindow Workflows', status: 'planned', tone: '#d2a8ff', surface: 'diffs / agent consoles / preview docks', summary: 'Real IDE work spills into multiple windows. Settings should expose policies and the shell should be able to spawn paired surfaces.', reference: 'framework/windows.zig', pressure: 'window lifecycle + cross-window state + plugin scopes' },
  { name: 'Net Connections', status: 'reference', tone: '#79c0ff', surface: 'providers / remote indexes / collaboration', summary: 'Provider health, sockets, and remote tools should show up as first-class connection state.', reference: 'runtime/hooks/http.ts + websocket roadmap', pressure: 'live network events reflected into settings and shell chrome' },
  { name: 'Effects / Animations', status: 'reference', tone: '#7ee787', surface: 'dense settings affordances / transitions', summary: 'Use transitions to keep dense power-user surfaces legible instead of visually flat.', reference: 'runtime + renderer transitions plan', pressure: 'lifecycle effects + animated dense cards + real state transitions' },
  { name: 'Physics / Math Views', status: 'reference', tone: '#ffa657', surface: 'agent graphs / orchestration maps', summary: 'Graph-heavy agent and memory views can use math and physics layouts instead of static boxes.', reference: 'framework/math and future graph surfaces', pressure: 'interactive visualizations inside product UIs' },
  { name: 'Formatting / Syntax Surfaces', status: 'planned', tone: '#ff7b72', surface: 'editor / extension parity', summary: 'Monaco-style syntax features, formatting, and extension contribution points need real shell placement even if implementation lands through runtime bridges.', reference: 'editor parity plan', pressure: 'editor-specific runtime hooks exposed back through TSX' },
];

export function buildSeedMessages(branch: string, dirty: number, root: string, model: string) {
  return [
    {
      role: 'assistant',
      time: 'now',
      model,
      text: 'Workspace online. Watching ' + root + ' on ' + branch + '. ' + dirty + ' paths are dirty, and the landing page is tuned for fast jumps.',
    },
    {
      role: 'assistant',
      time: 'now',
      model,
      text: 'Try asking for a repo sweep, attaching the current file, or launching a task with terminal access. Search, git, and landing cards all read the same workspace.',
    },
  ];
}

export function focusPaths(): string[] {
  return [
    'cart/sweatshop/index.tsx',
    'cart/sweatshop/data.ts',
    'cart/sweatshop/theme.ts',
    'cart/sweatshop/host.ts',
    'runtime/index.tsx',
    'runtime/primitives.tsx',
    'renderer/hostConfig.ts',
    'qjs_app.zig',
    'tsz/carts/conformance/mixed/sweatshop/sweatshop.tsz',
    'tsz/carts/conformance/mixed/sweatshop/cursor.script.tsz',
  ];
}
