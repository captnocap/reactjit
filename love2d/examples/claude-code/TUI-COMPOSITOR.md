# TUI Compositor — Claude Code + Terminal Emulation

## Status

**Working end-to-end.** PTY spawn, libvterm parsing, damage-driven extraction,
keystroke passthrough, semantic row classification, real-time vterm rendering
with tagged rows. Claude Code is the first app built on this.

Commit: `feat(claude-code): TUI compositor — real-time semantic classification of terminal output`

---

## The Big Picture

This is not a CLI wrapper. It's a **terminal emulator that renders through React**.

PTY + libvterm + damage callbacks + keystroke passthrough = a complete terminal.
The semantic classification layer on top turns raw terminal rows into typed
props that React components consume. The terminal app has no idea it's being
composited — it thinks it's talking to xterm.

```
Process → PTY → libvterm → { row, text, token, fg[], bg[] } → React children
   ↑                                                               |
   └──────────────── keystroke passthrough ←────────────────────────┘
```

The foundation is `<Terminal />` — a first-class ReactJIT component. Claude Code
is just one consumer. The semantic token map is just a config passed as props.
Anyone can define their own tokens for any terminal app. The community shares
configs. No code required — just pattern definitions.

### What this means

- **Better xterm.js** — native rendering, React composability, semantic awareness
- **Multi-agent orchestration** — spawn N Claude instances in N PTYs, each with
  its own vterm + classification, all interactive in parallel. Not subagents.
  Real persistent terminal sessions you walk between.
- **Any TUI gets a React face** — lazygit, htop, k9s, vim, docker — define
  tokens, declare components, done.

---

## Part 1: Claude Code Semantic Token Map

The primary build target. Nail every token, build the React overlay, ship
something usable. This work directly informs the generic `<Terminal />`
component — Claude Code is the stress test.

### Content Zone (above input boundary)

| Token | Pattern | Example | Status |
|-------|---------|---------|--------|
| `banner` | "Claude Code v", model names (Opus/Sonnet/Haiku + version) | `Claude Code v2.1.59` | Done |
| `text` | Plain text, no special markers | `~/creative/reactjit` | Done |
| `box_drawing` | `│`, `┌`, `╭`, `└`, `╰`, long `────` | Claude's response borders | Done |
| `thinking` | "Thinking", "Imagining" (in-progress, no prefix) | `Thinking...` | Done |
| `thought_complete` | `✻` prefix + past tense verb + duration (gray) | `✻ Sautéed for 38s` | Done |
| `task_active` | `+` prefix + present participle + `…` + timer (orange, >30s) | `+ Razzmatazzing… (7m 48s)` | Done |
| `task_summary` | "N tasks (N done, N open)" | `9 tasks (8 done, 1 open)` | Done |
| `task_done` | `✔` prefix (completed task) | `✔ Create shared migration…` | Done |
| `task_open` | `◻` prefix (pending task) | `◻ Refactor swiftui, tkinte…` | Done |
| `tool` | Bullet chars `●`, `•`, `◆` followed by tool name | `● Read(file.lua)` | Done |
| `diff` | Lines starting with `+` or `-` | `+ const foo = 1` | Done |
| `error` | Lines matching `Error:` | `Error: file not found` | Done |
| `permission` | "Do you want to" pattern | `Do you want to edit file.lua?` | Done |
| `user_prompt` | `❯` followed by typed text | `❯ fix the bug` | Done |
| `status_bar` | Token counts, cost, shortcut hints | `1.2k tokens` | Done |

### Input Zone (at and below boundary)

| Token | Pattern | Example | Status |
|-------|---------|---------|--------|
| `input_border` | Separator lines `────` within input zone | `────────────────` | Done |
| `user_input` | Prompt row (`❯`, `!`, `>`) with user text | `❯ hey claude @` | Done |
| `input_zone` | Generic catch-all for unclassified input zone rows | Various | Done |
| `menu_option` | Numbered items `1.`, `2.`, with optional `❯` cursor | `❯ 2. Sonnet 4.6` | Done |
| `menu_title` | "Select ..." headers | `Select model` | Done |
| `selector` | Horizontal value adjuster with `← →` | `High effort ← → to adjust` | Done |
| `confirmation` | "Enter to confirm" footer | `Enter to confirm · Esc to exit` | Done |
| `slash_menu` | `/command description` items in input zone | `/resume Resume a previous...` | Done |
| `list_selectable` | Box-drawing row with bright/def fg (clickable) | Agent names, config items | Done |
| `list_selected` | `❯` inside a menu context (cursor on this row) | `❯ Sonnet 4.6` | Done |
| `list_info` | Box-drawing row with dim fg (non-interactive) | Descriptions, metadata | Done |
| `menu_desc` | Text after a menu_option (option description) | `Best for most tasks` | Done |
| `search_box` | Search bar inside a menu | `Search settings` | Done |
| `picker_selected` | User_prompt followed by picker_meta | Selected resume session | Done |
| `picker_item` | Text followed by picker_meta | Non-selected resume session | Done |
| `picker_meta` | "N ago · branch · size" metadata | `5 hours ago · main · 10.1MB` | Done |
| `picker_title` | Picker header (e.g. "Resume Session") | `Resume Session` | Done |
| `user_text` | Text continuation after user_prompt (multi-line) | Long user input wrap lines | Done |
| `hint` | Footer hints (Enter/Arrow/Esc instructions) | `Arrow keys to navigate` | Done |
| `result` | `⎿` bracket (menu dismissed, tool result) | `⎿ (no content)` | Done |
| `assistant_text` | Text after tool/thinking/thought_complete/result (state machine) | Claude's multiline prose | Done |
| `plan_border` | `╌╌╌` dashed borders (content block wrapper) | Plan content delimiters | Done |
| `wizard_step` | `← □ ... □ ... ✓ ... →` step indicators | Plan mode question stepper | Done |

### Tokens Still Needed

| Token | Pattern | When it appears | Priority |
|-------|---------|-----------------|----------|
| `file_picker` | `@` autocomplete items (`+` prefix, file/dir names) | Type `@` in prompt | High |
| `code_block` | Code inside `│` borders with syntax highlighting | Claude's code responses | Medium |
| `file_path` | File path references in tool output | `src/App.tsx:42` | Medium |
| `streaming_cursor` | The blinking cursor during response generation | Active streaming | Low |
| `cost_badge` | Token/cost display at bottom | `$0.03 · 1.2k tokens` | Low |
| `warning` | Warning-level messages (not errors) | Various | Low |
| `collapsed_block` | Collapsed tool output indicator | `(ctrl+r to expand)` | Low |
| `context_mention` | `@file` references in user input | `@src/App.tsx` | Low |
| `image_block` | Image/screenshot references | Screenshot paths | Low |

### Edge Cases to Test

- [ ] Multi-line user input (long messages that wrap)
- [ ] Permission prompt with file paths containing spaces
- [ ] Nested tool calls (tool within tool output)
- [ ] Claude asking questions with numbered options (different from /model menu)
- [ ] Diff blocks with very long lines
- [ ] Error recovery (Claude retrying after permission deny)
- [ ] `/compact` conversation summary
- [ ] Streaming response that includes code blocks
- [ ] `!` bash mode with multi-line output
- [ ] Tab completion accepting a suggestion
- [ ] `Esc` to interrupt mid-response

---

## Part 2: `<Terminal />` — The Foundation

### What it is

A first-class ReactJIT capability that IS a terminal emulator. Not a wrapper,
not a skin, not a compositor on top of something else. PTY + libvterm + React
rendering. The app inside sees a normal terminal. React sees typed rows.

### Architecture

```
lua/capabilities/terminal.lua    — PTY + vterm + classifier (the engine)
packages/core/src/Terminal.tsx   — <Terminal /> component
packages/core/src/useTerminal.ts — Hook: rows, writeRaw, resize
```

Claude Code's `claude_session.lua` / `claude_canvas.lua` become a CONSUMER
of this capability, not the implementation. The hard-won lessons from parsing
Claude CLI (sandwich detection, menu handling, streaming) become the reference
semantic config.

### React API

```tsx
// Raw terminal — full control
<Terminal command="bash" args={["-l"]}>
  {(rows) => rows.map(row => (
    <Text key={row.index} style={{ color: row.fg }}>
      {row.text}
    </Text>
  ))}
</Terminal>

// With semantic tokens — rows get classified
<Terminal command="claude" args={["--verbose"]} tokens={claudeTokens}>
  {(rows) => rows.map(row => {
    if (row.token === 'thinking') return <Spinner key={row.index} />;
    if (row.token === 'permission') return <PermissionCard key={row.index} row={row} />;
    if (row.token === 'user_input') return <InputBar key={row.index} row={row} />;
    return <TerminalRow key={row.index} row={row} />;
  })}
</Terminal>

// Hook for custom layouts
const term = useTerminal('claude', ['--verbose'], claudeTokens);
// term.rows: ClassifiedRow[]
// term.writeRaw(data): send bytes to PTY
// term.resize(cols, rows): resize terminal
// term.cursor: { row, col }
```

### Semantic Token Config

Tokens are defined as pattern rules. The classifier runs them top-to-bottom,
first match wins. Passed as props, not hardcoded.

```ts
const claudeTokens: TokenRule[] = [
  { token: 'permission',   match: 'contains', text: 'Do you want to' },
  { token: 'menu_option',  match: 'regex',    pattern: /^\s*[›>]?\s*\d+\.\s+/ },
  { token: 'banner',       match: 'contains', text: 'Claude Code' },
  { token: 'thinking',     match: 'contains', text: 'Thinking' },
  { token: 'tool',         match: 'contains', text: '● ' },
  { token: 'diff',         match: 'regex',    pattern: /^[+-]/ },
  { token: 'selector',     match: 'contains', text: '← →' },
  { token: 'confirmation', match: 'contains', text: 'Enter to confirm' },
  { token: 'status_bar',   match: 'regex',    pattern: /\d+\s*tokens/ },
  { token: 'box_drawing',  match: 'regex',    pattern: /[│┌╭└╰]/ },
  { token: 'error',        match: 'regex',    pattern: /^\s*[Ee]rror:/ },
  { token: 'user_prompt',  match: 'contains', text: '❯' },
  // Zone-aware rules
  { token: 'input_border', match: 'separator', zone: 'input' },
  { token: 'user_input',   match: 'cursor_row', zone: 'input' },
];
```

### Row Data Shape

```ts
interface ClassifiedRow {
  index: number;         // vterm row number
  text: string;          // full row text
  token: string;         // semantic classification
  zone: 'content' | 'input';  // above or below boundary
  cells: Cell[];         // per-cell data (char, fg, bg, bold, etc.)
  cursor?: { col: number }; // if cursor is on this row
}
```

---

## Part 3: Interactive Semantics — Controlling What You See

Classification tells you what a row IS. Interactive semantics tell you what you
can DO with it. This is the second config layer — pure data, no code.

### The Problem

The effort selector shows `High effort ← → to adjust`. We classify it as
`selector`. But to render three React buttons (Low / Med / High) that actually
work, we need to:

1. Parse current value from row text → "High"
2. Know all possible values in order → ["low", "medium", "high"]
3. Calculate: from "High" to "Low" = 2 left arrows
4. Send those keystrokes to the PTY

This applies to every interactive element in every TUI. Permission prompts,
model menus, file pickers, question prompts. Same shape, different configs.

### Interaction Types

| Type | What it is | Navigation | Examples |
|------|-----------|------------|----------|
| `discrete` | Ordered values, arrow nav | prev/next keys, computed delta | Effort selector, theme picker |
| `choice` | Named keystroke options | Direct key per option | Permission (y/a/n) |
| `menu` | Cursor-navigated list | Up/down + select | Model picker, question options |
| `action` | Simple button → keystroke | Direct key per action | Confirm (Enter), Cancel (Esc) |

### Interaction Config (alongside token config)

```ts
const claudeInteractions: InteractionRule[] = [
  {
    token: 'selector',
    type: 'discrete',
    values: ['low', 'medium', 'high'],
    parseValue: /^(\w+)\s+effort/i,     // extract current from row text
    prevKey: '\x1b[D',                   // left arrow
    nextKey: '\x1b[C',                   // right arrow
  },
  {
    token: 'permission',
    type: 'choice',
    options: [
      { label: 'Approve', key: 'y' },
      { label: 'Allow All', key: 'a' },
      { label: 'Deny', key: 'n' },
    ],
  },
  {
    token: 'menu_option',
    type: 'menu',
    parseOption: /\d+\.\s+(.*)/,         // extract option text per row
    cursorUp: '\x1b[A',
    cursorDown: '\x1b[B',
    selectKey: '\r',
  },
  {
    token: 'confirmation',
    type: 'action',
    actions: [
      { label: 'Confirm', key: '\r' },
      { label: 'Cancel', key: '\x1b' },
    ],
  },
];
```

### Enriched Row Data

When a classified row matches an interaction rule, it gets an `interaction`
property. React components use this to render controls and compute keystrokes.

```ts
interface ClassifiedRow {
  index: number;
  text: string;
  token: string;
  zone: 'content' | 'input';
  cells: Cell[];
  cursor?: { col: number };
  // Present when an interaction rule matches this token
  interaction?: {
    type: 'discrete' | 'choice' | 'menu' | 'action';
    currentValue?: string;      // parsed from row text
    currentIndex?: number;      // position in values array
    values?: string[];          // for discrete
    options?: InteractionOption[];  // for choice/action/menu
  };
}
```

### React Consumption

The Terminal exposes `write()` — raw bytes to PTY. React computes what to send
from the interaction data. No magic, fully explicit.

```tsx
<Terminal command="claude" tokens={claudeTokens} interactions={claudeInteractions}>
  {(rows, write) => rows.map(row => {
    if (row.token === 'selector' && row.interaction) {
      const { values, currentIndex } = row.interaction;
      return (
        <SegmentedControl
          options={values}
          selected={currentIndex}
          onSelect={(targetIdx) => {
            const delta = targetIdx - currentIndex;
            const key = delta > 0 ? '\x1b[C' : '\x1b[D';
            write(key.repeat(Math.abs(delta)));
          }}
        />
      );
    }
    if (row.token === 'permission') {
      return (
        <PermissionCard
          options={row.interaction.options}
          onSelect={(opt) => write(opt.key)}
        />
      );
    }
  })}
</Terminal>
```

### Why This Can't Be Hacked Around

Env vars, settings files, and API flags are workarounds for a single app's
single control. The interaction layer solves the general case:

- Any TUI, any selector, any menu — same pattern
- Pure data config — an AI or visual editor can generate these
- No app-specific knowledge baked into the framework
- The terminal IS the source of truth — we read and write it directly

---

### Priority Order

1. **Keep building Claude Code** — it's the daily driver and the stress test
2. **Factor the engine** — extract PTY + vterm + classifier from claude_session
   into `lua/capabilities/terminal.lua`
3. **Wire `<Terminal />`** — React component consuming the capability
4. **Build interaction layer** — enrich classified rows with interaction data
5. **Claude Code migrates** — becomes `<Terminal command="claude" tokens={...}>`
   with custom overlay components
6. **Multi-instance** — spawn N terminals side by side, per-session focus
7. **Config editor** — the meta-tool: run any TUI, click rows, name tokens, export
