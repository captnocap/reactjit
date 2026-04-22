# cursor-ide — New Features

## What was built

### 1. T3 Code Feature Audit
**File:** `T3CODE_AUDIT.md`

Scanned ~57k lines of t3code and identified everything we lack vs what they have:
- Command palette, checkpoint/diff panel, plan sidebar, branch toolbar
- Chat composer enhancements (slash commands, `@` mentions, attachments, context window meter)
- Thread management, git PR flows, keybindings system, deeper settings
- Ranked by impact/effort — plugin interface and hot panel were prioritized first

---

### 2. QJS Plugin Interface
**Files:** `plugin/{types.ts, context.ts, loader.ts, index.ts}`

A runtime plugin system that loads JS plugins from `~/.cursor-ide/plugins/`.

**Plugin API (`ctx`):**
```js
ctx.registerCommand(id, label, callback)   // appears in command palette
ctx.registerPanel(id, label, component)    // toggleable side panel
ctx.on(event, handler)                     // subscribe to IDE events
ctx.emit(event, ...args)                   // emit cross-plugin events
ctx.readSetting(key, fallback)             // plugin-scoped localstore
ctx.writeSetting(key, value)
ctx.showNotification(msg, type)            // toast strip
ctx.exec(command)                          // shell
ctx.readFile(path) / ctx.writeFile(path, content)
ctx.pathExists(path) / ctx.listDir(path)
ctx.React / ctx.primitives                 // UI building blocks
```

**Example plugin** (`~/.cursor-ide/plugins/hello.js`):
```js
// @plugin name Hello World
// @plugin version 1.0.0

ctx.registerCommand('hello.sayHi', 'Say Hello', () => {
  ctx.showNotification('Hello from plugin!', 'success');
});

ctx.registerPanel('hello.panel', 'Hello Panel', function HelloPanel() {
  return ctx.React.createElement(ctx.primitives.Box, { style: { padding: 20 } },
    ctx.React.createElement(ctx.primitives.Text, { style: { fontSize: 14 } }, 'Hello!')
  );
});
```

Plugins are hot-reloaded on app restart (no recompile needed).

---

### 3. Hot Panel
**Files:** `components/hotpanel.tsx`, `jsx-transform.ts`

A live-eval side panel that watches the workspace for file changes and renders `.tsx`/`.jsx` files in real time.

**How it works:**
- Polls `find` every 2s for modified files
- On `.tsx`/`.jsx` change: transforms JSX → `React.createElement` calls, then `new Function()` evals the component
- Renders the exported component inside a scrollable preview area
- Non-TSX files shown as line-numbered code

**Element inspector:**
- Ctrl+click any tracked element (Box, Text, Pressable, etc.) in the live preview
- Selected element shows line number + tag name
- Type a steer message → sends to the agent chat with file:line context

**Toggle:** Hot button in the top bar (or compact mode surface switcher).

---

### 4. Command Palette
**File:** `components/commandpalette.tsx`

A searchable command overlay. Currently opened via the **Palette** button in the top bar.

**Commands included:**
- Navigation: Open Projects, Settings, Toggle Search/Terminal/Chat/Hot
- File: New File, Save Current File
- Workspace: Refresh, Index Project
- Agent: New Conversation, Send, Cycle Model, Stop Agent
- Plugins: all plugin-registered commands appear automatically

**Future:** wire `Ctrl+K` when global keyboard shortcuts are available in the framework.

---

## Build & Run

```bash
./scripts/ship cursor-ide -d    # debug build
./zig-out/bin/cursor-ide-raw    # run
```

## Next Up (from audit)

1. **Checkpoint / Diff Panel** — git diff per turn, conversation-level diff viewing
2. **Chat Composer enhancements** — slash commands, `@` file mentions, attachments
3. **Plan Sidebar** — structured agent plan steps with status tracking
4. **Keybindings system** — `~/.cursor-ide/keybindings.json`
