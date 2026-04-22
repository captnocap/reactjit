# T3 Code Feature Audit vs cursor-ide

> Scanned ~57k lines of t3code web+server source. Below is what they have that we lack.

---

## 1. Command Palette ⭐ HIGH IMPACT
**What it is:** `mod+k` global searchable overlay for commands, files, threads, projects.
**t3code details:**
- fuzzy search across projects, threads, actions
- filesystem browsing mode (type `~/` to browse directories)
- sub-menu stacking (pick "New thread in..." → shows project list)
- configurable via `~/.t3/keybindings.json`
- actions: new thread, add project, open settings, run project scripts

**Our gap:** We have nothing. A command palette would replace a lot of scattered UI buttons.

---

## 2. Plugin Interface ⭐ UNIQUE TO US
**What it is:** User-authored JS plugins that run inside QJS and can alter the IDE.
**t3code details:** They don't have this — it's our differentiator.
**What we should build:**
- `~/.cursor-ide/plugins/` directory
- Each plugin: `{ name, version, activate(ctx) }`
- `ctx` API: register commands, add panels, subscribe to events, read/write settings
- Hot-reload on plugin file changes

---

## 3. Hot Panel ⭐ UNIQUE TO US
**What it is:** Side panel that live-evaluates JSX/TSX files as they change.
**Reference:** `love2d/examples/hot-code` does this already.
**What it does:**
- Watches `cwd` for file changes
- On `.tsx`/`.jsx` change: transform JSX → JS, `new Function()` eval it
- Render the exported component live in a panel
- Ctrl+click any element to select it → sends steering msg to Claude
- Non-TSX files shown as syntax-highlighted code

**Our gap:** Nothing like this exists. It would be incredibly powerful for rapid UI iteration.

---

## 4. Chat / Composer Enhancements

### 4a. Slash Commands ⭐ HIGH IMPACT
**t3code:** Type `/` in composer → menu with `/model`, `/plan`, `/default`, plus provider-specific commands.
**Our gap:** Chat input is plain text only.

### 4b. Path Mentions (`@file`)
**t3code:** Type `@` → fuzzy file search from workspace, inserts file reference into context.
**Our gap:** No way to reference files in chat.

### 4c. Attachments
**t3code:** Drag/drop images, image paste, file attachments. Shows preview chips below composer.
**Our gap:** No attachment system at all.

### 4d. Context Window Meter
**t3code:** Circular progress indicator showing token usage % vs model limit.
**Our gap:** We estimate tokens but don't show a visual meter.

### 4e. Terminal Context
**t3code:** Attach terminal output to chat messages. Terminal drawer per thread.
**Our gap:** We have a terminal panel but no way to pipe its output into chat context.

### 4f. Pending Approvals / User Input
**t3code:** Structured approval flows — "Allow command? [Yes] [No] [Yes, always]"
**Our gap:** No approval gate system.

### 4g. Plan Mode
**t3code:** Toggle between "Build" and "Plan" modes. Plans generate structured step lists shown in sidebar.
**Our gap:** No plan generation / tracking.

---

## 5. Checkpointing / Diff Panel ⭐ HIGH IMPACT
**What it is:** Git checkpoint diff viewer. After each agent turn, diff against previous checkpoint.
**t3code details:**
- Turn strip: clickable chips for each turn → view that turn's diff
- "All turns" view: cumulative diff across entire conversation
- Stacked vs split diff view toggle
- Word wrap toggle
- File headers are clickable → open in external editor

**Our gap:** No diff viewing at all. Agent edits are invisible after they happen.

---

## 6. Plan Sidebar
**What it is:** Right sidebar showing structured plan steps with status icons.
**t3code details:**
- Steps: pending (dot), in-progress (spinner), completed (check)
- Expandable full plan markdown view
- Copy / download / save-to-workspace actions

**Our gap:** No plan tracking.

---

## 7. Branch / Environment Toolbar
**What it is:** Top toolbar showing current git branch, environment picker, worktree mode.
**t3code details:**
- Branch selector with remote branch list
- Environment selector (local vs worktree)
- Mode selector (local branch, temp worktree, etc.)

**Our gap:** We show branch name in status bar but no picker / switcher.

---

## 8. Keybindings System
**What it is:** Configurable keyboard shortcuts via `~/.t3/keybindings.json`.
**t3code details:**
- JSON array of `{ key, command, when }` rules
- `when` conditions: `terminalFocus`, `terminalOpen`, boolean expressions
- Commands: `terminal.toggle`, `commandPalette.toggle`, `chat.new`, `editor.openFavorite`

**Our gap:** No configurable keybindings. Only hardcoded shortcuts.

---

## 9. Thread Management
**What it is:** Multiple chat threads per project, with history.
**t3code details:**
- Sidebar thread list with status indicators
- Draft threads (local, not yet sent to server)
- Thread sorting: recent, alphabetical
- Thread archival

**Our gap:** Single chat session. No thread history.

---

## 10. Git Integration (deeper)
**What t3code has:**
- PR creation / checkout flow
- Git status broadcaster (live status updates)
- Changed files tree in chat
- Diff stats per turn
- GitHub CLI integration

**Our gap:** Basic git status (branch, ahead/behind, dirty count). No PR flow, no diff stats.

---

## 11. Settings (deeper)
**What t3code has:**
- Connections settings (provider auth)
- General settings (theme, timestamp format, sidebar behavior)
- Archived threads view
- Settings persisted server-side + localStorage hybrid

**Our gap:** We have a basic settings panel with provider/model selection. No theming, no connections mgmt.

---

## 12. Observability / Telemetry
**What t3code has:**
- Client-side tracing
- RPC instrumentation
- Metrics collection
- Local file tracer for debugging

**Our gap:** Nothing.

---

## Priority Ranking (what to build first)

| # | Feature | Impact | Effort | Notes |
|---|---------|--------|--------|-------|
| 1 | **QJS Plugin Interface** | Very High | Medium | Unique differentiator; unlocks everything else |
| 2 | **Hot Panel** | Very High | Medium | Reference already exists in love2d |
| 3 | **Command Palette** | High | Medium | Replaces a lot of UI clutter |
| 4 | **Slash Commands + @mentions** | High | Low | Purely UI/JS work |
| 5 | **Checkpoint / Diff Panel** | High | High | Needs git integration |
| 6 | **Attachments** | Medium | Medium | File picker + image preview |
| 7 | **Keybindings** | Medium | Low | JSON parser + keydown handler |
| 8 | **Plan Sidebar** | Medium | Medium | Needs plan generation first |
| 9 | **Branch Toolbar** | Low | Low | Mostly UI |
| 10 | **Thread Management** | Medium | High | Needs persistence layer |

---

## Recommendation

Build **Plugin Interface** → **Hot Panel** → **Command Palette** → **Composer enhancements** in that order.

The plugin interface is the force-multiplier: once it exists, users (and we) can add features without recompiling the binary.
