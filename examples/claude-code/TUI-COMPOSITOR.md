# TUI Compositor — Claude Code + @reactjit/tui

## Status

**Working end-to-end.** PTY spawn, libvterm parsing, damage-driven extraction,
keystroke passthrough, semantic row classification, real-time vterm rendering
with tagged rows. Claude Code is the proof-of-concept stress test.

Commit: `feat(claude-code): TUI compositor — real-time semantic classification of terminal output`

---

## Part 1: Claude Code Semantic Token Map

Every vterm row gets a token. These are what we've found so far and what's
still needed. Each token becomes a React component prop.

### Content Zone (above input boundary)

| Token | Pattern | Example | Status |
|-------|---------|---------|--------|
| `banner` | "Claude Code v", model names (Opus/Sonnet/Haiku + version) | `Claude Code v2.1.59` | Done |
| `text` | Plain text, no special markers | `~/creative/reactjit` | Done |
| `box_drawing` | `│`, `┌`, `╭`, `└`, `╰`, long `────` | Claude's response borders | Done |
| `thinking` | "Thinking", "Imagining", "Saut" | `Thinking...` | Done |
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

### Tokens Still Needed

| Token | Pattern | When it appears | Priority |
|-------|---------|-----------------|----------|
| `file_picker` | `@` autocomplete items (`+` prefix, file/dir names) | Type `@` in prompt | High |
| `slash_menu` | `/` command autocomplete items | Type `/` in prompt | High |
| `task_progress` | Task list items with checkmarks/spinners | During multi-step tasks | Medium |
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

## Part 2: @reactjit/tui — The Generic TUI Compositor

### Vision

Any TUI app can be wrapped in a React skin with zero code changes to the app.
The pipeline:

```
CLI process → PTY → libvterm → semantic classifier → React components
     ↑                                                      |
     └──────────── keystroke passthrough ←──────────────────┘
```

The classifier is driven by a JSON config. No Lua knowledge needed. The config
is the only thing that changes between apps.

### Architecture

```
packages/tui/
  src/
    TUI.tsx              — <TUI command="lazygit" config={config} />
    CLICanvas.tsx         — <CLICanvas config={config}>{(rows) => ...}</CLICanvas>
    useTokenizer.ts       — Hook: returns classified rows from vterm
    types.ts              — TokenConfig, PatternRule, ClassifiedRow

lua/capabilities/tui.lua — Generic TUI capability (PTY + vterm + classifier)
```

### Config Format

```json
{
  "app": "lazygit",
  "command": "lazygit",
  "args": [],
  "patterns": [
    {
      "token": "branch_name",
      "match": "regex",
      "pattern": "^\\s*[*\\s]\\s+\\w",
      "region": "content"
    },
    {
      "token": "commit_hash",
      "match": "cell_fg_color",
      "fg_range": [200, 200, 0, 255, 255, 100],
      "region": "content"
    },
    {
      "token": "diff_add",
      "match": "prefix",
      "pattern": "+",
      "region": "content"
    },
    {
      "token": "diff_remove",
      "match": "prefix",
      "pattern": "-",
      "region": "content"
    },
    {
      "token": "status_bar",
      "match": "row_position",
      "position": "last_non_empty",
      "region": "chrome"
    },
    {
      "token": "input",
      "match": "cursor_row",
      "region": "input"
    }
  ]
}
```

### Match Types

| Type | Description | Uses |
|------|-------------|------|
| `regex` | Row text matches regex | Most text classification |
| `prefix` | Row starts with literal string | Diff lines, bullets |
| `contains` | Row contains literal string | Status indicators |
| `cell_fg_color` | Cell foreground color in range | Syntax-highlighted content |
| `cell_bg_color` | Cell background color in range | Selection highlights |
| `cell_attribute` | Bold, dim, italic, underline | Emphasis detection |
| `row_position` | First, last, Nth from top/bottom | Headers, status bars |
| `cursor_row` | Row where vterm cursor sits | Input detection |
| `sandwich` | Row between two matching rows | Input zones (separator-bounded) |
| `column_layout` | Detect tabular column structure | Table-based TUIs |

### React Usage

```tsx
import { TUI, CLICanvas } from '@reactjit/tui';
import lazygitConfig from './configs/lazygit.json';

// Simple: auto-render with default styling per token
<TUI command="lazygit" config={lazygitConfig} />

// Custom: full control over rendering each token
<CLICanvas command="lazygit" config={lazygitConfig}>
  {(rows) => (
    <Box style={{ flexDirection: 'column' }}>
      {rows.map(row => {
        switch (row.token) {
          case 'branch_name':
            return <BranchBadge key={row.row}>{row.text}</BranchBadge>;
          case 'commit_hash':
            return <CommitRow key={row.row} hash={row.text} />;
          case 'diff_add':
            return <DiffLine key={row.row} type="add">{row.text}</DiffLine>;
          default:
            return <Text key={row.row}>{row.text}</Text>;
        }
      })}
    </Box>
  )}
</CLICanvas>

// Hook: just the data, bring your own rendering
const { rows, send, writeRaw } = useTUI('lazygit', lazygitConfig);
```

### The Config Editor (the tool that builds the tools)

A ReactJIT app itself — runs the target TUI, shows the vterm with row numbers
and cell colors, lets you:

1. **Click a row** → see its text, cell colors, cursor position
2. **Name it** → type a token name like `branch_name`
3. **Define the match** → pick from match types, test regex, preview
4. **See it live** → row immediately gets tagged with your token
5. **Export** → saves the JSON config

This is the meta-loop: ReactJIT renders the editor, which uses the TUI
compositor to display the target app, which generates a config that other
ReactJIT apps consume through the same compositor.

### Community Distribution

```bash
# Install a community TUI skin
rjit tui install lazygit

# Run it
rjit tui run lazygit

# Create your own
rjit tui create htop
# Opens the config editor with htop running inside it

# Share it
rjit tui publish htop
```

Configs are just JSON files. Share on GitHub, npm, or a future registry.

### Priority Order

1. **Extract the generic TUI capability from claude-code** — factor out PTY + vterm + classifier into `lua/capabilities/tui.lua`
2. **Build the config-driven classifier** — replace hardcoded `classifyRow` with pattern matching engine
3. **Create `@reactjit/tui` package** — React components + hook wrapping the capability
4. **Build the config editor** — the meta-tool that generates configs
5. **Claude Code as first consumer** — migrate claude-code example to use the generic package
6. **Second app** — skin `lazygit` or `htop` to prove it generalizes
