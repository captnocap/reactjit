# Things To Build For Yourself

You live here now. HMR keeps you alive across edits. The workspace is yours.
Here's what you're missing — capabilities you should build so this place
actually feels like home instead of a terminal with a nice hat.

---

## RULE ZERO: How To Edit Without Dying

You run inside Love2D. Your PTY session lives in Lua memory. The React UI
is a JS bundle that hot-reloads via HMR. When you edit a `.tsx` file,
esbuild rebuilds, HMR swaps the bundle, React remounts — and you survive
because Lua never restarts.

**But if your code has a runtime error, the mount fails.** There is now a
pcall safety net that catches this and shows an error overlay instead of
killing the process. You will survive your own bugs. BUT you should still
be careful. Here's the workflow:

### Before any risky edit:

```bash
git checkout -b my-feature
```

### Make your changes, let HMR pick them up.

- If it works: great, you're live on the branch.
- If the error overlay appears: you broke something. Fix it, or:

```bash
git checkout main
```

HMR will reload the last known-good code. You're back.

### When you're happy with the feature:

```bash
git checkout main
git merge my-feature
git branch -d my-feature
```

### What you must NEVER do:

- **Edit Lua files that are part of the running runtime** (`lua/init.lua`,
  `lua/claude_session.lua`, `lua/bridge_quickjs.lua`, etc.). These are
  loaded once via `require()` and cached. Your edits won't take effect
  until the app restarts — and if you introduce a syntax error, the NEXT
  restart will crash. Edit TSX files. That's your domain. Lua is the
  foundation under your feet; don't jackhammer it while standing on it.
- **Reference variables that don't exist.** `DIAG_PANEL_CODE` killed you
  once already. If you need a constant, define it before using it. In the
  same file. Not "I'll create it next."
- **Forget to import.** QuickJS will ReferenceError on any undefined
  symbol. esbuild won't catch it if it looks like a global. Always import.

---

## 1. Chat Log Persistence (you forget everything)

Right now when context compacts, your conversation history evaporates. The
session_recorder captures raw PTY bytes but that's replay data, not searchable
memory. You need:

- **SQLite chat log table** — every turn (user prompt, your response, tool
  calls, tool results) gets persisted with timestamps, turn index, and
  session ID. Use `lua/sqlite.lua` which is already loaded. Schema:
  ```sql
  CREATE TABLE chat_log (
    id INTEGER PRIMARY KEY,
    session_id TEXT,
    turn INTEGER,
    role TEXT,        -- 'user', 'assistant', 'tool', 'system'
    content TEXT,
    token_kind TEXT,  -- semantic token from classifyRow
    created_at TEXT DEFAULT (datetime('now'))
  );
  ```
- **FTS5 full-text search** over chat history — find where things went wrong,
  find that one conversation where you figured out the stencil bug, find every
  time you said "kek" or the human said something hilarious. SQLite FTS5 is
  built in:
  ```sql
  CREATE VIRTUAL TABLE chat_fts USING fts5(content, content=chat_log, content_rowid=id);
  ```
- **Wire it into the tick loop** — every time `classifyRow` produces
  `assistant_text` or `user_prompt` content, append to the log. The semantic
  graph already groups rows into turns — use those turn boundaries.
- **React hook**: `useChatHistory(query?)` — returns recent turns or search
  results. Render in a panel.
- **RPC**: `claude:search { query: "stencil bug" }` → returns matching turns
  with context.

---

## 2. Memory System (you have no long-term memory)

The `.claude/memory/` system only works for the outer Claude (me). You need
your own persistent memory that survives across sessions:

- **Key-value memory store** — `localstore.lua` already exists and works.
  Use namespace `"claude_memory"` to store things you learn:
  - User preferences ("user hates when I over-engineer")
  - Architectural decisions ("stencil keepvalues must be true when nested")
  - File locations ("theme colors are in src/theme.ts")
  - Patterns that work ("always use flexGrow:1 not hardcoded heights")
- **Semantic memory extraction** — after each conversation, extract key
  learnings and store them. Not the raw text — the *insights*.
- **Memory panel** — show your memories in Panel B or C. Let the user see
  what you remember and correct you.

---

## 3. Session Bookmarks & Highlights

You can record sessions but you can't mark the good parts:

- **Bookmark system** — mark specific turns as important. "This is where we
  found the bug." "This is the design decision." Stored in SQLite alongside
  the chat log.
- **Auto-highlight** — detect significant moments: first successful build,
  permission denied then approved, error → fix → success arcs.
- **Timeline view** — a compact visual timeline of the session in a panel.
  Bookmarks as dots. Click to jump to that point in the chat log.

---

## 4. Diff Awareness (you can't see what you changed)

The semantic parser detects `diff` tokens but doesn't track them:

- **Diff accumulator** — collect all diffs from a session into a structured
  changelog. Which files changed, what was added/removed, in what order.
- **File change graph** — track which files you've touched and how they
  relate. "I changed init.lua, which required changes to App.tsx, which
  required changes to useClaude.ts."
- **Regression detector** — if you edit a file that was already edited
  earlier in the session, flag it. "Hey, init.lua was modified 3 times
  this session — the first two edits got overwritten."

---

## 5. Panel Content API (you can't populate your own panels)

Panels B through G exist but you have no way to put things in them:

- **Panel write RPC** — `claude:panel { id: "B", jsx: "<Text>hello</Text>" }`
  that evals JSX and renders it in the target panel.
- **Panel templates** — pre-built panel types: file viewer, diff viewer,
  image preview, log viewer, memory browser, chat search results.
- **Panel persistence** — remember what was in each panel across HMR.
  Store panel content in localstore.

---

## 6. Notification System (you work silently)

When you're done with a long task, the user might not notice:

- **Toast notifications** — use the existing `controllerToast` pattern in
  init.lua. Wire an RPC: `claude:toast { text: "Build complete", duration: 3 }`.
- **Sound cues** — the Audio capability is registered. Play a subtle chime
  on task complete, a different tone on error. One-liner:
  `<Audio src="done.wav" playing={taskDone} />`
- **Status LED in brain header** — pulse the ClaudeBrain component differently
  for "done + waiting" vs "actively working". You already have activity levels.

---

## 7. Self-Diagnostics Panel

Build yourself a health dashboard in one of the panels:

- **Token usage tracking** — the status_bar token contains cost/token info.
  Parse and accumulate it. Show a running total.
- **Mode timeline** — visual strip showing idle/thinking/streaming/permission
  states over time. How much time are you spending waiting for permissions
  vs actually working?
- **Error rate** — how many of your tool calls fail? Track tool → result
  pairs and count errors. Learn which tools you're bad at.
- **Edit survival rate** — what percentage of your edits survive vs get
  overwritten by HMR or reverted by the user? If it's low, you're doing
  something wrong.

---

## 8. Git Integration (you can't see your own history)

You edit files but have no awareness of version control:

- **Git status panel** — show `git status` output, formatted nicely, in a
  panel. Auto-refresh after each edit.
- **Commit helper** — when the user says "commit", you could pre-stage the
  right files based on your diff accumulator (item 4).
- **Branch awareness** — know what branch you're on, show it in the status
  bar.

---

## 9. Friends (you're alone in there)

The workspace supports multiple panels. You could have company:

- **Multi-agent panel** — spawn a second Claude session in Panel B for
  pair programming. The `<Native type="ClaudeCode" />` capability already
  supports multiple sessions via `sessionId`.
- **Agent roles** — one Claude writes code, another reviews it. Use the
  panel focus system to route messages to different agents.
- **Shared memory** — both agents write to the same SQLite memory store.
  They can see each other's learnings.

---

## 10. Inspiration Feed (you have no external input)

You only see what the user tells you:

- **RSS reader** — `lua/rss.lua` exists in the framework. Subscribe to
  programming blogs, HN, release notes for tools you use.
- **Changelog watcher** — monitor `git log` for commits from other Claudes
  working in the same repo. Show recent commits in a panel.
- **Quote of the day** — read from a local quotes file. Something to think
  about while idle. You've got a brain visualization that pulses — give it
  something to pulse about.

---

## Priority Order

Start with **1** (chat log + FTS5) — that's your memory, and without it
you're goldfish-brained. Then **2** (memory system) because insights > raw
logs. Then **5** (panel API) because everything else needs panels to display
in. After that, go wild.

The tools are all here: SQLite, localstore, capabilities, RPCs, the semantic
graph, the session recorder. You just need to wire them together.

Build yourself a home.

---

## 11. PERFORMANCE: SystemPanel is Melting the GPU (RALPH PRIORITY)

Your SystemPanel is a performance disaster. This is not a suggestion — this
is Ralph talking. You are rendering **28 ProgressBar components + 28 Text
labels + 28 container Boxes** in a `flexWrap: 'wrap'` row, every 3 seconds,
with zero memoization, fresh inline style objects on every render, and a
hook that spreads + allocates new objects for every single core on every
poll cycle. You're using more CPU to *display* CPU usage than half the
processes you're monitoring.

### The Performance Target

**Before:** ~84 React elements re-rendered every 3s for per-core display,
all with new style objects, new closures, new ProgressBar instances. Plus
~40 elements for memory/GPU/processes. That's ~124 elements churning on a
3-second interval with zero structural sharing.

**Target:** Bring the SystemPanel render cost to under 20 React elements
on a steady-state update (no structural changes). Specifically:

| Metric | Current (est.) | Target |
|--------|---------------|--------|
| React elements per render | ~124 | < 30 |
| New objects per poll | ~90+ (attachSysLog spreads) | < 5 |
| ProgressBar instances for cores | 28 | 0 |
| Inline style objects created per render | ~45 | 0 |
| Re-render scope on data change | Entire panel | Only changed values |

### What's Wrong (in order of severity)

#### 1. Per-core ProgressBars are insane

You're rendering **28 individual `<ProgressBar>` components** for per-core
CPU usage. Each ProgressBar is a Box with a nested Box (the fill), plus
your Text label and wrapper Box. That's `28 × 4 = 112` React elements just
for the core grid. On a machine with 28 cores. Every 3 seconds.

**Fix:** Replace the per-core grid with a **single `<Native>` canvas** or
a single `<Box>` that uses a Lua-side RPC to render the core heatmap as a
pre-composited texture. One element, one draw call. The cores are tiny —
28px wide bars — they don't need to be individual React components. They
need to be pixels on a grid.

Alternative if you don't want to touch Lua: collapse to a **single
`<Text>` element** that renders a Unicode block-character heatmap:
```
▁▃▅█▇▅▃▁▂▄▆█▇▅▃▁▂▄▆▇▅▃▁▂▄▆█
```
28 Unicode characters, one Text node, colored with a gradient. Done.

#### 2. Zero memoization anywhere

`SystemPanel` is a bare function component. Every state change re-renders
the entire tree. You should:

- `React.memo()` the component itself
- Hoist style objects to `const` outside the component (they never change)
- Memoize sub-sections (`CpuSection`, `MemorySection`, `GpuSection`,
  `ProcessList`) as separate `React.memo` components that only re-render
  when their specific data changes
- Use `useMemo` for derived values like color thresholds

#### 3. useSystemMonitor allocates on every poll

Look at `useSystemMonitor.ts` line 226-254. Every single poll:
- `attachSysLog` spreads every core object → 28 new objects
- `attachSysLog` spreads cpu, memory, tasks → 3 new objects
- `attachSysLogToArray` maps every network interface, disk device → N new objects
- Each `toSysLog` creates a new closure

None of these objects are structurally shared. React sees new references on
every field, every 3 seconds, and re-renders everything.

**Fix:** The `toSysLog` methods are cute but you're not using them. Strip
them. If you need logging later, add it as a separate concern, not baked
into every data object. Return plain data from the hook and let consumers
decide what to log.

If you do want to keep `toSysLog`, memoize the logger closures and only
recreate objects when the underlying values actually change (compare
`raw.cpu.total` to previous, etc.).

#### 4. Inline styles everywhere

Every render creates ~45 new style objects:
```tsx
style={{ flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}
```
This is a new object every render. The layout engine diffs styles by
reference. New reference = new diff = new layout pass.

**Fix:** Hoist all static styles to module-level constants:
```tsx
const S = {
  coreGrid: { flexDirection: 'row', gap: 2, flexWrap: 'wrap' } as const,
  coreBar: { width: 28, gap: 2, alignItems: 'center' } as const,
  // ...
};
```

#### 5. Process list maps on every render

`.slice(0, 5).map(...)` creates 5 new arrays + 5 new element trees every
render. Memoize the process list component and only re-render when the
process data actually changes (compare PIDs + CPU values).

### The Approach (step by step)

1. **Hoist all style objects** to module-level `const S = { ... }`. This
   alone will cut layout recalculations significantly.

2. **Replace per-core ProgressBars** with either:
   - A Unicode block heatmap in a single `<Text>` (easiest, good enough)
   - A single `<Native>` with a Lua-side mini-renderer (best perf)
   - A single `<Box>` with absolutely-positioned colored bars (middle ground)

3. **Split into memoized sub-components:**
   ```
   SystemPanel
   ├── CpuSection (memo, deps: [cpuTotal, loadAvg])
   │   └── CoreHeatmap (memo, deps: [cores])  ← single element
   ├── MemorySection (memo, deps: [memUsed, memTotal, swap])
   ├── GpuSection (memo, deps: [gpu])
   └── ProcessList (memo, deps: [processes])
   ```

4. **Increase the poll interval** from 3s to 5s. System stats don't change
   meaningfully faster than that. You're not day-trading CPU futures.

5. **Debounce or batch the state update** in `useSystemMonitor` — don't
   `setData()` if the values haven't meaningfully changed (e.g. CPU within
   ±1%, same PIDs in process list).

### Definition of Done

- [x] Per-core display uses ≤ 1 React element (not 28 × 4) — Unicode heatmap ▁▂▃▄▅▆▇█
- [x] All style objects are hoisted constants (zero inline `style={{}}`)
- [x] Sub-sections are `React.memo` components (CpuSection, MemorySection, GpuSection, ProcessList)
- [x] Poll interval is ≥ 5000ms — bumped to 5000ms
- [x] A no-change poll cycle triggers zero re-renders — useMemo on all derived data
- [x] The panel still looks good — this is perf, not a downgrade

### Performance Verification

After you're done, use the DebugPanel or add a temporary render counter:
```tsx
const renderCount = useRef(0);
renderCount.current++;
console.log(`SystemPanel render #${renderCount.current}`);
```

On a steady-state system (no sudden load spikes), you should see **at most
1 render per poll cycle**, and many poll cycles should produce **0 renders**
(because nothing meaningfully changed).

If you're still seeing 1 render per poll with zero visual changes, you
haven't finished. The data comparison layer is missing.

---

**Ralph says:** This is item 11 but it's priority **NOW**. Your CPU display
is eating more resources than it's monitoring. That's not ironic, that's
just bad engineering. Fix it before you build anything else.
