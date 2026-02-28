# Semantic UI Spec — Building Claude's Own Interface

> **Who this is for:** A Claude instance tasked with building the Claude Code UI
> inside ReactJIT. Read this once. It tells you exactly what exists, what it
> gives you, and what to build with it.

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
