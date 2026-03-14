# Semantic UI Spec — Building Claude's Own Interface

> **Who this is for:** A Claude instance tasked with building the Claude Code UI
> inside ReactJIT. Read this once. It tells you exactly what exists, what it
> gives you, and what to build with it.

---

## Terminal Geometry Law (READ THIS FIRST)

The PTY runs in a virtual terminal (vterm) with a fixed grid of `cols × rows`.
The CLI (Claude Code) renders its TUI — menus, dashboards, prompts, diffs — into
that grid. We read the grid, classify it, and present it two ways: a debug view
(raw cells) and a pretty view (semantic components). Everything below flows from
how this grid relates to pixels on screen.

### The grid is not the pixels

The vterm grid has a **resolution** (cols × rows) that is independent of the
component's pixel size. Think of it like a video: a 1080p stream can play in a
200px thumbnail or a 4K display. The grid resolution determines what the CLI
*thinks* the terminal looks like. The pixel rect determines how we *render* it.

- **120 cols in a 50px-wide component** → tiny text, or scroll, or scale-to-fit.
  The CLI still renders 120-column menus. We just show them small.
- **30 cols in a 1200px-wide component** → large text or lots of whitespace.
  The CLI wraps everything at 30 characters. We can reflow on the pretty side.
- **cols matching pixel width / char width** → 1:1 cell-to-pixel mapping.
  The debug view is perfectly aligned. Cursor positions are exact.

### Why cols matters

The CLI's behavior is col-dependent:
- **Prompt text wraps** at the col boundary. If a user types 50 chars in a 30-col
  terminal, the prompt spans 2 rows. Our classifier must stitch them back or lose text.
- **Menus, dashboards, spinners** all lay out relative to cols. A 120-col terminal
  gets the full dashboard. A 30-col terminal gets a compact view.
- **Cursor position** is a `(row, col)` in the grid. We detect it by scanning cell
  attributes (background/reverse). For the proxy input bar to show the cursor at
  the right character offset, the col position must be correct.
- **Dynamic UI** (tab completion, slash menus, file pickers) renders at the col width.
  If cols is wrong, these overlap, truncate, or wrap unexpectedly.

### The three consumers and their constraints

1. **Debug view (ClaudeCanvas)** — renders raw cells in a monospace grid.
   Needs: cols × charW ≤ panel pixel width, or horizontal scroll.
   This is a 1:1 mapping. Each cell = one character = `charW` pixels.

2. **Pretty view (BlankSlateCanvas)** — renders semantic tokens as styled components.
   Needs: nothing from cols. It strips terminal artifacts (box-drawing, borders)
   and reflows text to its own container width. A 30-col source renders identically
   to a 120-col source on the pretty side — same text, same meaning, different wrapping.

3. **Proxy input bar** — displays the prompt text extracted from the classified stream.
   Needs: the full prompt text without wrapping artifacts. If the prompt wraps in the
   vterm (because cols is too narrow), the classifier must stitch the rows back together.
   Cursor position comes from cell attribute scanning on the prompt row.

### The rule

**cols is a configuration choice, not derived from pixel width.** It determines the
CLI's rendering behavior. It is set once at session creation and resized explicitly
(e.g., when the user resizes the window or changes a setting). It is NOT
automatically derived from any component's layout rect, because:

- The component might be 50px wide (embedded widget) but want 120-col CLI output.
- The component might be fullscreen but want 80-col output for readability.
- Multiple views (debug + pretty) share the same vterm but have different widths.
- Scale factor exists: the debug view can zoom in/out to fit cols into its rect.

**Default:** 120 cols (matches standard terminal width, CLI renders its full UI).

**Override:** The `<Native type="ClaudeCanvas" cols={N}>` prop sets it explicitly.
The debug view scales its rendering to fit. The pretty view ignores it entirely.

### Scale factor (debug view)

The debug view computes a scale factor to fit the grid into its pixel rect:

```
charW      = monospace font character width at base font size
gridPixelW = cols × charW
panelW     = component's layout rect width
scaleFactor = panelW / gridPixelW   (clamped to [0.25, 2.0])
```

At scale 1.0, each cell is `charW` pixels wide (perfect 1:1).
Below 1.0, the grid is shrunk to fit (readable down to ~0.5, tiny below that).
Above 1.0, the grid is enlarged (useful for small col counts in large panels).

The pretty view has no scale factor — it renders semantic text in its own font at
its own size, reflowing to its own container width.

### Cursor position mapping

The cursor lives in vterm grid coordinates: `(row, col)`. We detect it by scanning
cell attributes (non-zero background or reverse flag) on the prompt row.

For the proxy input bar:
- `promptCursorCol` = the column offset within the prompt text (0-indexed)
- This is a character offset, not a pixel offset
- The `<Input cursorPosition={N}>` prop places the cursor at character N
- The input bar's own font and size don't need to match the vterm's

For the debug view:
- Cursor pixel position = `cellOffsetX + col × charW × scaleFactor`
- Cursor height = `lineH × scaleFactor`

### Prompt text extraction across wrapped rows

When cols is narrow and the user types a long prompt, it wraps across multiple
vterm rows. The classifier must:

1. Find all rows classified as `input_zone` that follow the `❯` prefix row
2. Stitch their text content together (strip leading whitespace from continuation rows)
3. Return the combined text as `promptText`
4. Compute `promptCursorCol` relative to the combined text, not the current row

This is already handled in `claude_session.lua`'s classified handler.

---

## The One Thing You Need to Understand

The PTY running `claude` is already being read and **semantically classified**.
Every row of terminal output has a **token** — a label that tells you what kind
of content it is: `user_prompt`, `thinking`, `tool`, `permission`, `diff`,
`task_done`, etc.

You are not writing a terminal emulator. You are writing a **React UI that
consumes a structured stream of typed content blocks**. The classification is
already done. Your job is: **token → component**.

---

## The Data Pipeline (already built, don't touch)

```
PTY → libvterm → damage callbacks → classifyRow() → classifiedCache
                                                          ↓
                                               semantic graph (nodes)
                                                          ↓
                                         React props via ClaudeCode capability
```

**`lua/classifiers/claude_code.lua`** — classifies each terminal row into one of
25+ tokens. Pattern matching on text + Unicode prefix chars + row position.

**`lua/semantic_graph.lua`** — groups classified rows into stable nodes with:
- `kind` — the token type
- `role` — `"user"` | `"assistant"` | `"system"`
- `lane` — `"prompt"` | `"text"` | `"think"` | `"tool"` | `"result"` | `"diff"` | `"error"` | `"state"`
- `lines[]` — the actual text content
- `scope` — `"session"` (singletons) or `"turn"` (per-conversation-turn)
- `parentId` — forms a tree (turns contain their blocks)

**`lua/capabilities/semantic_terminal.lua`** — the `<SemanticTerminal>` capability.
Owns the PTY, vterm, classifier, graph, and pushes events to React.

**`examples/claude-code/lua/claude_canvas.lua`** — the existing canvas that
receives the classified data and currently renders it with raw `love.graphics`.
This is what you are **replacing** with a proper React component tree.

---

## The Token Vocabulary

These are the labels you will receive. Map each one to a component.

### Conversation turn tokens

| Token | What it is | Render as |
|---|---|---|
| `user_prompt` | The user's submitted message (❯ prefix) | Chat bubble, left-aligned, blue |
| `user_text` | Continuation lines of a long user message | Same bubble, continued |
| `thinking` | Claude is actively thinking ("Thinking...") | Animated spinner + italic text |
| `thought_complete` | Finished thinking block (✻ prefix + duration) | Collapsed/dimmed thought aside |
| `assistant_text` | Claude's prose response | Chat bubble, right-aligned, white |
| `tool` | A tool call in progress (● Read(...)) | Tool card with name + args |
| `result` | Tool result bracket (⎿ ...) | Tool card output section |
| `diff` | File diff lines (+ / -) | Diff viewer with green/red backgrounds |
| `error` | Error message | Red-bordered error block |

### Task list tokens

| Token | What it is | Render as |
|---|---|---|
| `task_summary` | "N tasks (N done, N open)" | Progress bar + summary line |
| `task_done` | ✔ completed task | Checked checkbox, dimmed |
| `task_open` | ◻ pending task | Unchecked checkbox |
| `task_active` | In-progress task with live timer | Spinning indicator + task text |

### Session chrome tokens (render once, persistent)

| Token | What it is | Render as |
|---|---|---|
| `banner` | "Claude Code v2.x / Sonnet / ~/path" | Header bar |
| `status_bar` | Token count, cost, shortcut hints | Footer bar |
| `idle_prompt` | Bare ❯ at bottom, no text | Input ready indicator |

### Interactive / menu tokens (transient overlays)

| Token | What it is | Render as |
|---|---|---|
| `permission` | "Do you want to X?" | Permission card with Approve/Deny buttons |
| `menu_title` | "Select ..." | Menu header |
| `menu_option` | Numbered list item | Selectable row |
| `menu_desc` | Description line after a menu option | Subtitle text |
| `selector` | Horizontal value adjuster (← →) | Segmented control |
| `confirmation` | "Enter to confirm · Esc to exit" | Action footer |
| `hint` | Keyboard shortcut hints | Muted help text |
| `picker_title` | "Resume Session" | Picker modal header |
| `picker_item` | Session entry (non-selected) | Session row |
| `picker_selected` | Session entry (selected) | Session row, highlighted |
| `picker_meta` | "5 hours ago · main · 10.1MB" | Metadata subtitle |

### Plan mode tokens

| Token | What it is | Render as |
|---|---|---|
| `plan_border` | ╌╌╌ dashed border | Plan block wrapper |
| `plan_mode` | "Entered plan mode" | Mode badge / banner |
| `wizard_step` | ← □ ... □ ... ✓ ... → stepper | Step indicator row |

---

## Component Mapping — The Actual Work

Each semantic node maps to one React component. The node's `lines[]` is the
content. The node's `kind` picks the component. That's it.

```tsx
function SemanticNode({ node }) {
  switch (node.kind) {
    case 'user_prompt':
    case 'user_text':      return <UserBubble lines={node.lines} />;
    case 'assistant_text': return <AssistantBubble lines={node.lines} />;
    case 'thinking':       return <ThinkingBlock lines={node.lines} />;
    case 'thought_complete': return <ThoughtAside lines={node.lines} />;
    case 'tool':           return <ToolCard lines={node.lines} />;
    case 'result':         return <ToolResult lines={node.lines} />;
    case 'diff':           return <DiffBlock lines={node.lines} />;
    case 'error':          return <ErrorBlock lines={node.lines} />;
    case 'permission':     return <PermissionGate lines={node.lines} />;
    case 'task_summary':
    case 'task_done':
    case 'task_open':
    case 'task_active':    return <TaskItem node={node} />;
    case 'banner':         return <Header lines={node.lines} />;
    case 'status_bar':     return <StatusBar lines={node.lines} />;
    // menus, pickers, selectors → overlay components
    default:               return null;
  }
}
```

---

## Layout Structure

The UI has three zones. These never change.

```
┌─────────────────────────────────────────┐
│  Header (banner token — session scope)  │  ← fixed top
├─────────────────────────────────────────┤
│                                         │
│   Conversation scroll area             │  ← flexGrow: 1, scrollable
│                                         │
│   Turn 1:                               │
│     UserBubble                          │
│     ThinkingBlock                       │
│     ToolCard + ToolResult               │
│     AssistantBubble                     │
│                                         │
│   Turn 2:                               │
│     ...                                 │
│                                         │
├─────────────────────────────────────────┤
│  Input bar (user_input / idle_prompt)   │  ← fixed bottom
│  Status bar (status_bar token)          │
└─────────────────────────────────────────┘
```

Interactive overlays (menus, pickers, permission gates) float above this layout
when their tokens appear. They disappear when their tokens disappear.

---

## How to Send Keystrokes Back

The ClaudeCode capability exposes a `sendKey` method. Use it from interactive
components. You do not type into a text field — you compute the keystroke and
send it to the PTY.

```tsx
// Permission gate: map button press → keystroke
<PermissionGate onApprove={() => sendKey('y')} onDeny={() => sendKey('n')} />

// Menu: up/down arrows navigate, Enter selects
<MenuOption onSelect={() => sendKey('\r')} />

// Selector: compute arrow key delta from current to target value
function onValueChange(targetIdx) {
  const delta = targetIdx - currentIdx;
  const key = delta > 0 ? '\x1b[C' : '\x1b[D';   // right / left arrow
  sendKey(key.repeat(Math.abs(delta)));
}
```

---

## What NOT to Do

- **Do not re-implement classification.** The classifier exists. Read the tokens.
- **Do not render raw terminal text.** If you're drawing characters from a row
  buffer, you've gone wrong. Map tokens to components.
- **Do not hardcode colors per-component.** Use `useThemeColors()`.
  Tokens: `c.text`, `c.bg`, `c.bgElevated`, `c.surface`, `c.primary`, `c.border`, `c.muted`.
- **Do not manage scroll state manually.** Use `<ScrollView>` with `flexGrow: 1`.
- **Do not hardcode pixel heights.** Use `flexGrow: 1` for the conversation area.
  Only the input bar and header need explicit sizing, and only if they have
  known fixed content.
- **Do not start from scratch.** The renderer (`claude_renderer.lua`) and canvas
  (`claude_canvas.lua`) already show you the visual language. Match it.

---

## Key Files to Read

| File | Why |
|---|---|
| `lua/classifiers/claude_code.lua` | The full token vocabulary + what each one means |
| `lua/semantic_graph.lua` | Node structure — what properties every node has |
| `lua/capabilities/semantic_terminal.lua` | The capability API — what events React receives |
| `examples/claude-code/lua/claude_canvas.lua` | Current renderer — visual reference |
| `examples/claude-code/lua/claude_renderer.lua` | Color constants and block shapes to match |
| `examples/claude-code/src/App.tsx` | Current React entry point |

---

## The Test

When you're done, a session should look like this:

- User messages in distinct chat bubbles
- Tool calls in labeled cards (tool name visible, output collapsible)
- Thinking state with a visible animated indicator
- Task lists rendering as actual checkbox-style items with live progress
- Permission prompts as card overlays with real buttons
- The diff view with green/red line backgrounds
- A persistent header showing model + working directory
- A persistent footer showing token count

If it looks like a terminal with colored text, you haven't finished.
If it looks like a purpose-built Claude chat app, you're done.
