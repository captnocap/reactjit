# TODO: Zero-Friction Integration for Existing Love2D Games

## The promise

Someone has a Love2D game. Maybe they've been building it for months. They want React UI — a HUD, an inventory screen, a settings menu, a dialogue box. They should not need to restructure their project, rewrite their main.lua, or understand our internals. The integration is:

```bash
cd my-game/
ilovereact attach
```

Then in their `main.lua`:

```lua
require("ilovereact").attach()
```

That's it. React is now rendering on top of their game. They write `.tsx` files, run `ilovereact dev`, and their UI appears as a transparent overlay. Their game loop is untouched. Their existing `love.draw()`, `love.update()`, `love.keypressed()` — all still work. We hook in alongside, not instead of.

---

## What "attach" actually does under the hood

### The Lua side: callback chaining

`attach()` wraps every Love2D callback without replacing them. If the game already defined `love.draw()`, we save it and install a new one that calls the original first, then ours on top.

```lua
-- What require("ilovereact").attach() does internally:

-- 1. Save every existing callback
local original = {}
for _, name in ipairs(CALLBACKS) do
  original[name] = love[name]
end

-- 2. Initialize ReactLove
ReactLove.init({ mode = "native", bundlePath = "bundle.js" })

-- 3. Chain into love.load (or call init immediately if love.load already ran)
love.load = function(...)
  if original.load then original.load(...) end
  -- ReactLove.init already called above, nothing else needed
end

-- 4. Chain into love.update
love.update = function(dt)
  if original.update then original.update(dt) end
  ReactLove.update(dt)
end

-- 5. Chain into love.draw — game draws first, React overlays on top
love.draw = function()
  if original.draw then original.draw() end
  love.graphics.push("all")   -- isolate our graphics state completely
  ReactLove.draw()
  love.graphics.pop()
  love.graphics.setColor(1, 1, 1, 1)  -- paranoid reset
end

-- 6. Chain ALL input callbacks with event consumption
love.mousepressed = function(x, y, btn, ...)
  local consumed = ReactLove.mousepressed(x, y, btn)
  if not consumed and original.mousepressed then
    original.mousepressed(x, y, btn, ...)
  end
end

-- ... same pattern for all 18+ callbacks
```

**Key behaviors:**
- `love.draw`: game first, React on top (overlay compositing)
- `love.update`: game first, React second (game state is fresh when React reads it)
- Input callbacks: React first, game second — but only if React didn't consume it (click on a React button ≠ fire the game's weapon)

### The CLI side: `ilovereact attach`

A new CLI command that prepares an existing Love2D project for React UI without disrupting anything.

```bash
cd my-existing-game/
ilovereact attach
```

**What it does:**

1. **Detects existing project structure** — looks for `main.lua`, `conf.lua`, `.love` files, `src/` directory. Refuses to run if it looks like an iLoveReact project already (has `lua/init.lua` from us).

2. **Copies runtime files** — places them in a non-conflicting location:
   ```
   my-game/
   ├── main.lua              ← theirs, untouched
   ├── conf.lua              ← theirs, untouched
   ├── game/                 ← their existing code, untouched
   ├── assets/               ← theirs, untouched
   ├── ilovereact/           ← NEW — all our runtime files
   │   ├── init.lua          ← the require("ilovereact") entry point
   │   ├── lua/              ← layout, painter, bridge, etc.
   │   ├── lib/              ← libquickjs.so, libsqlite3.so
   │   └── fonts/            ← Noto Sans fallbacks
   ├── ui/                   ← NEW — their React UI code goes here
   │   ├── main.tsx          ← entry point (we scaffold this)
   │   ├── App.tsx           ← starter overlay component
   │   └── tsconfig.json
   ├── bundle.js             ← NEW — esbuild output (gitignored)
   └── package.json          ← NEW or merged
   ```

3. **Creates the entry point** — `ilovereact/init.lua` is the one file they require. It handles all the internal path setup so `require("ilovereact")` just works regardless of where their `main.lua` lives.

4. **Scaffolds minimal UI code** — `ui/main.tsx` and `ui/App.tsx` with a transparent overlay template:
   ```tsx
   // ui/App.tsx
   import { Box, Text, Pressable } from '@ilovereact/core';
   import { useLoveState } from '@ilovereact/core';

   export function GameUI() {
     const [hp] = useLoveState('player.hp', 100);
     const [score] = useLoveState('game.score', 0);

     return (
       <Box style={{ width: '100%', height: '100%' }}>
         {/* Your UI renders on top of the game */}
         <Box style={{ position: 'absolute', top: 8, left: 8 }}>
           <Text style={{ fontSize: 16, color: '#ffffff' }}>HP: {hp}</Text>
         </Box>
         <Box style={{ position: 'absolute', top: 8, right: 8 }}>
           <Text style={{ fontSize: 16, color: '#ffd700' }}>Score: {score}</Text>
         </Box>
       </Box>
     );
   }
   ```

5. **Adds `.gitignore` entries** — `bundle.js`, `node_modules/`

6. **Prints the one instruction:**
   ```
   ✓ iLoveReact attached to your project.

   Add this line to your main.lua (anywhere before love.load runs):

     require("ilovereact").attach()

   Then run:

     ilovereact dev

   Your React UI will render on top of your game.
   To send game state to the UI, see: ilovereact docs integration
   ```

### The JS bootstrap: `createLove2DApp` simplified for overlay mode

The scaffolded `ui/main.tsx` should be as simple as possible:

```tsx
import { createOverlay } from '@ilovereact/core';
import { GameUI } from './App';

createOverlay(<GameUI />);
```

`createOverlay` is a convenience wrapper around `createLove2DApp` that:
- Creates the bridge + renderer
- Sets up transparent root (no background color)
- Renders the component
- That's it — no config needed for the common case

For advanced users who want providers, routers, etc:

```tsx
import { createLove2DApp } from '@ilovereact/core';
import { StorageProvider } from '@ilovereact/storage';
import { GameUI } from './App';

const app = createLove2DApp();
app.render(
  <StorageProvider>
    <GameUI />
  </StorageProvider>
);
```

---

## The `ilovereact/init.lua` entry module

This is the file users require. It must be bulletproof.

```lua
-- ilovereact/init.lua
-- Usage: require("ilovereact").attach(config)

local M = {}

function M.attach(config)
  config = config or {}

  -- 1. Set up require paths so lua/init.lua and all its deps resolve
  local base = love.filesystem.getSource()
  local ilrDir = base .. "/ilovereact"
  package.path = package.path
    .. ";" .. ilrDir .. "/?.lua"
    .. ";" .. ilrDir .. "/?/init.lua"
    .. ";" .. ilrDir .. "/lua/?.lua"

  -- 2. Load the core runtime
  local ReactLove = require("lua.init")

  -- 3. Resolve config with sensible defaults
  local initConfig = {
    mode = config.mode or "native",
    bundlePath = config.bundlePath or "bundle.js",
    libpath = config.libpath or "ilovereact/lib/libquickjs",
  }

  -- 4. Save all existing Love2D callbacks
  local CALLBACKS = {
    "load", "update", "draw", "quit",
    "mousepressed", "mousereleased", "mousemoved",
    "keypressed", "keyreleased", "textinput",
    "wheelmoved", "resize",
    "touchpressed", "touchreleased", "touchmoved",
    "joystickadded", "joystickremoved",
    "gamepadpressed", "gamepadreleased", "gamepadaxis",
    "filedropped", "directorydropped",
  }

  local orig = {}
  for _, name in ipairs(CALLBACKS) do
    orig[name] = love[name]
  end

  -- 5. Track initialization state
  local initialized = false
  local lateAttach = false

  local function ensureInit()
    if not initialized then
      ReactLove.init(initConfig)
      initialized = true
    end
  end

  -- 6. If love.load already ran (late attach), init immediately
  --    Detect by checking if love.window is already open
  if love.window and love.window.isOpen and love.window.isOpen() then
    ensureInit()
    lateAttach = true
  end

  -- 7. Chain callbacks

  love.load = function(...)
    if orig.load then orig.load(...) end
    ensureInit()
  end

  love.update = function(dt)
    if orig.update then orig.update(dt) end
    if initialized then ReactLove.update(dt) end
  end

  love.draw = function()
    if orig.draw then orig.draw() end
    if initialized then
      love.graphics.push("all")
      ReactLove.draw()
      love.graphics.pop()
    end
  end

  love.quit = function()
    if initialized then ReactLove.quit() end
    if orig.quit then return orig.quit() end
  end

  love.resize = function(w, h)
    if initialized then ReactLove.resize(w, h) end
    if orig.resize then orig.resize(w, h) end
  end

  -- Input: React checks first (overlays, hit testing), game gets it if unconsumed
  local function chainInput(name)
    love[name] = function(...)
      if initialized then
        local consumed = ReactLove[name](...)
        if consumed then return end
      end
      if orig[name] then orig[name](...) end
    end
  end

  chainInput("mousepressed")
  chainInput("mousereleased")
  chainInput("mousemoved")
  chainInput("wheelmoved")
  chainInput("keypressed")
  chainInput("keyreleased")
  chainInput("textinput")
  chainInput("touchpressed")
  chainInput("touchreleased")
  chainInput("touchmoved")
  chainInput("gamepadpressed")
  chainInput("gamepadreleased")
  chainInput("gamepadaxis")
  chainInput("filedropped")
  chainInput("directorydropped")

  -- 8. Expose bridge for game → UI state flow
  M.bridge = function()
    return ReactLove.getBridge()
  end

  M.rpc = function(method, handler)
    return ReactLove.rpc(method, handler)
  end

  M.pushState = function(key, value)
    local b = ReactLove.getBridge()
    if b then b:pushEvent({ type = "state:" .. key, payload = value }) end
  end

  -- 9. Return the module so they can use the helper methods
  return M
end

-- If someone does: local ilr = require("ilovereact").attach()
-- they get back M with .bridge(), .rpc(), .pushState()

return M
```

---

## Event consumption: the missing piece

### Current state

Right now, `ReactLove.mousepressed()` and friends return nothing. When a user clicks a React button, the game's `love.mousepressed` also fires. This means clicking "Open Inventory" in the React UI also fires the game's "shoot weapon" handler. Unacceptable.

### What we need

Every input callback in `lua/init.lua` must return `true` if the event was consumed by the React UI, `false` / `nil` if it passed through.

**Definition of "consumed":**
- `mousepressed` / `mousereleased`: consumed if the click hit a React node with a handler (pressable, scrollview, text input, etc.)
- `keypressed` / `keyreleased`: consumed if a text input or text editor has focus, or if a React hotkey handler matched
- `textinput`: consumed if a text input/editor has focus
- `wheelmoved`: consumed if the wheel was over a scrollable React node
- `mousemoved`: never consumed (both game and UI should track mouse position)
- `resize`: never consumed (both need to know)
- `gamepad*`: consumed if focus system is in UI mode (e.g., navigating a React menu with controller)
- Overlays (error, inspector, devtools): always consumed when visible

**Implementation in `lua/init.lua`:**

```lua
function ReactLove.mousepressed(x, y, btn)
  -- Overlays consume first
  if ErrorOverlay.mousepressed(x, y) then return true end
  if DevTools.mousepressed(x, y, btn) then return true end

  -- Hit test against React tree
  local target = Events.hitTest(tree, x, y)
  if target and target.hasHandlers then
    -- Process normally (create event, push to bridge)
    -- ...
    return true  -- consumed by React UI
  end

  return false  -- not consumed, game should handle it
end
```

The `hasHandlers` check is important — if the mouse is over a transparent `<Box>` with no event handlers, the click should pass through to the game. Only nodes that actually handle events should consume input.

### Files to modify

| File | Change |
|------|--------|
| `lua/init.lua` | Return `true`/`false` from all input callbacks based on consumption |
| `lua/events.lua` | `hitTest` already returns the target node — we just need to check `hasHandlers` |

---

## Game → UI state flow: `pushState` and `useLoveState`

The native-hud example already demonstrates this pattern, but it's not documented or streamlined. We need to make it dead obvious.

### Lua side (in their game code)

```lua
-- Option 1: Direct bridge access (current pattern)
local bridge = require("ilovereact").bridge()
bridge:pushEvent({ type = "state:player.hp", payload = 85 })

-- Option 2: Convenience helper (new)
local ilr = require("ilovereact")
ilr.pushState("player.hp", 85)
ilr.pushState("player.position", { x = 100, y = 200 })
ilr.pushState("inventory", { "sword", "potion", "key" })

-- Option 3: Batch update (new — single event, multiple keys)
ilr.pushStates({
  ["player.hp"] = 85,
  ["player.mana"] = 40,
  ["game.score"] = 1250,
  ["game.wave"] = 3,
})
```

### React side (in their UI code)

```tsx
import { useLoveState } from '@ilovereact/core';

function PlayerHUD() {
  const [hp] = useLoveState('player.hp', 100);
  const [mana] = useLoveState('player.mana', 50);
  const [score] = useLoveState('game.score', 0);

  return (
    <Box style={{ flexDirection: 'row', gap: 12 }}>
      <HealthBar current={hp} max={100} />
      <ManaBar current={mana} max={50} />
      <Text style={{ fontSize: 18, color: '#ffd700' }}>Score: {score}</Text>
    </Box>
  );
}
```

### UI → Game communication (actions)

When the UI needs to tell the game something (player clicked "Use Potion", opened a menu, etc.):

```tsx
// React side
import { useLoveSend } from '@ilovereact/core';

function InventorySlot({ item }) {
  const send = useLoveSend();

  return (
    <Pressable onPress={() => send('inventory:use', { item: item.id })}>
      <Text>{item.name}</Text>
    </Pressable>
  );
}
```

```lua
-- Lua side: register handler
local ilr = require("ilovereact")

ilr.rpc("inventory:use", function(params)
  local item = params.item
  useItem(player, item)
  return { success = true }
end)
```

### RPC for request/response (UI asks game for data)

```tsx
// React side
const rpc = useLoveRPC('getInventory');
const [items, setItems] = useState([]);

useEffect(() => {
  rpc.call({}).then(result => setItems(result.items));
}, []);
```

```lua
-- Lua side
ilr.rpc("getInventory", function(params)
  return { items = player.inventory }
end)
```

---

## `ilovereact detach` — clean removal

If someone wants to remove iLoveReact from their project:

```bash
ilovereact detach
```

**What it does:**
1. Removes `ilovereact/` directory
2. Removes `ui/` directory (with confirmation if it has modifications)
3. Removes `bundle.js`
4. Removes added `package.json`, `node_modules/`
5. Removes `.gitignore` entries we added
6. Prints: "Remove `require('ilovereact').attach()` from your main.lua"

The game is back to exactly what it was. No residue.

---

## `ilovereact update` for attached projects

When we release a new version of the framework, attached projects need to update their runtime files:

```bash
cd my-game/
ilovereact update
```

This replaces `ilovereact/lua/`, `ilovereact/lib/`, `ilovereact/fonts/` with the latest versions. Does NOT touch `ui/` (their code) or `ilovereact/init.lua` (unless the schema changed, in which case we migrate it).

---

## Graphics state isolation — full safety

The `attach()` function wraps `ReactLove.draw()` in `love.graphics.push("all")` / `love.graphics.pop()`. But the painter itself also needs to be safe. Audit and fix:

| Issue | Status | Fix |
|-------|--------|-----|
| Stencil state leakage | Current — painter sets stencil for rounded overflow:hidden | Reset stencil test at end of `Painter.paint()` |
| Scissor leakage | Current — painter uses `intersectScissor` | Already restores previous scissor (safe) |
| Font leakage | Current — painter calls `setFont()` | `push("all")` covers this |
| Line width leakage | Current — painter sets `setLineWidth()` for borders | `push("all")` covers this |
| Blend mode leakage | Current — painter may change blend mode for opacity | `push("all")` covers this |
| Shader leakage | Future — theme shaders will set custom shaders | `push("all")` covers this |
| Color leakage | Current — painter calls `setColor()` everywhere | Already resets to `(1,1,1,1)` at end, `push("all")` double-covers |
| Canvas leakage | Unlikely — painter doesn't use off-screen canvases yet | `push("all")` covers future use |

**Action items:**
1. Ensure `Painter.paint()` ends with `love.graphics.setStencilTest()` (disable stencil test) — this is the only thing `push("all")` might not fully protect against depending on Love2D version behavior
2. Add `love.graphics.setLineWidth(1)` reset at end of paint pass as paranoid safety
3. Test with a game that uses stencils, shaders, and canvases to verify full isolation

---

## Edge cases and hard problems

### 1. Resolution / coordinate mismatch

The game might use `love.graphics.scale()` or `love.window.setMode()` with different canvas dimensions than the window. ReactLove's layout engine uses `love.graphics.getWidth()/getHeight()` for viewport dimensions. If the game uses a virtual resolution (e.g., 320x180 scaled to 1280x720), our UI will render at the virtual resolution.

**Options:**
- a) Detect and auto-compensate: check `love.graphics.getDimensions()` vs `love.window.getMode()` ratio, apply inverse transform before painting
- b) Explicit config: `require("ilovereact").attach({ resolution = "window" })` to render at window resolution regardless of game's transform stack
- c) Document it: if using virtual resolution, wrap `ReactLove.draw()` with inverse scale

Recommendation: option (b) as default behavior with (a) auto-detection fallback. The UI should look crisp at native resolution by default — you don't want pixel art scaling applied to your inventory text.

```lua
-- In the chained love.draw:
love.draw = function()
  if orig.draw then orig.draw() end

  -- Reset to window coordinates for UI
  love.graphics.push("all")
  love.graphics.origin()  -- clear all transforms
  love.graphics.setScissor()  -- clear scissor
  ReactLove.draw()
  love.graphics.pop()
end
```

### 2. love.run() override

Some games override `love.run()` entirely for custom frame timing. Our `attach()` can't chain callbacks that don't exist. Detection + fallback:

```lua
-- If love.run is overridden, we can't chain. Provide manual helpers:
if love.run ~= defaultLoveRun then
  print("[ilovereact] Custom love.run detected. Use manual integration:")
  print("  Call ReactLove.update(dt) in your update step")
  print("  Call ReactLove.draw() after your draw step")
  -- Still set up everything else, just don't chain love.update/draw
end
```

### 3. Multiple require paths

Love2D games might use `require("game.player")` or `require("src.enemy")` — all sorts of path conventions. Our runtime must not collide:

- All our Lua files live under `ilovereact/` prefix
- We add our paths to `package.path` but don't modify existing entries
- Our module names are namespaced: `require("ilovereact.lua.init")` internally, never bare `require("init")`

### 4. Thread safety

Love2D supports threads (`love.thread`). QuickJS is single-threaded. If the game uses threads, all React operations must happen on the main thread. This is already the case (QuickJS runs in the main thread's `love.update`), but we should document it clearly.

### 5. State updates from love.thread workers

If the game computes things in threads and wants to push state to the UI, they can't call `pushState` from a thread. Standard Love2D pattern: use a channel to send data to the main thread, then push to React from the main thread's update:

```lua
-- In love.update:
local data = channel:pop()
if data then
  ilr.pushState("world.generated", data)
end
```

Document this pattern. Not our problem to solve, but our problem to explain.

### 6. Existing libraries (bump, windfield, sti, etc.)

Love2D games commonly use libraries like:
- **bump.lua** — collision detection
- **windfield** — physics (Box2D wrapper)
- **sti** — tiled map loader
- **hump** — gamestate, timer, vector
- **anim8** — sprite animation
- **suit** — immediate mode GUI (they're replacing this with us!)

None of these should conflict with iLoveReact. We don't monkey-patch Love2D globals or modify the love table (besides adding our callbacks). Document compatibility and provide bridge examples:

```lua
-- Example: bump.lua collision → React damage numbers
local world = bump.newWorld()
-- ... on collision:
ilr.pushState("damage", { amount = 25, x = enemy.x, y = enemy.y })
```

---

## Documentation plan

### 1. Quick start guide: "Add React UI to Your Love2D Game"

A single page that gets someone from zero to working overlay in 5 minutes:

1. Install: `npm install -g @anthropic/ilovereact`
2. Attach: `cd my-game && ilovereact attach`
3. One line: add `require("ilovereact").attach()` to main.lua
4. Write UI: edit `ui/App.tsx`
5. Run: `ilovereact dev`
6. Send state: `ilr.pushState("player.hp", 85)` → `useLoveState("player.hp")`

### 2. Integration cookbook: "Common Patterns"

Recipe-style docs for:
- Displaying game state in React (HP bars, score, minimap data)
- Sending UI actions to the game (button clicks, menu selections)
- Modal UIs that pause the game (inventory, settings, dialogue)
- Conditional UI visibility (only show HUD during gameplay)
- Handling resolution scaling
- Working with save/load
- Using `@ilovereact/storage` alongside game saves
- Performance: what to push per-frame vs. on-change

### 3. API reference: `require("ilovereact")`

```lua
M.attach(config)       -- Chain into Love2D callbacks
M.bridge()             -- Get the raw bridge (advanced)
M.pushState(key, val)  -- Send state to React
M.pushStates(tbl)      -- Batch state update
M.rpc(method, handler) -- Register RPC handler
M.detach()             -- Runtime detach (undo callback chaining)
```

Config options:
```lua
{
  mode = "native",            -- "native" | "web" | "canvas"
  bundlePath = "bundle.js",   -- path to esbuild output
  libpath = "ilovereact/lib/libquickjs",
  resolution = "window",      -- "window" | "canvas" | { w, h }
  inputPriority = "ui",       -- "ui" (React first) | "game" (game first) | "both" (no consumption)
  drawOrder = "overlay",      -- "overlay" (after game) | "underlay" (before game)
  devtools = true,            -- enable F12 inspector / error overlay
}
```

### 4. Example projects

Port or build 3 examples that demonstrate the integration on real-ish games:

| Example | Game type | What the React UI does |
|---------|-----------|----------------------|
| `examples/attach-platformer/` | Simple platformer (built with bump.lua) | HUD: health, coins, lives. Pause menu. |
| `examples/attach-rpg/` | Top-down RPG (built with sti + hump) | Dialogue boxes, inventory, quest log, minimap |
| `examples/attach-shmup/` | Bullet hell (pure Love2D) | Score, combo meter, boss HP bar, game over screen |

Each example has:
- A `game/` directory with a functional Love2D game (no React)
- A `ui/` directory with the React overlay
- A `main.lua` with the one-line `require("ilovereact").attach()`
- A README explaining the integration

### 5. Video walkthrough outline (for docs site / YouTube)

0:00 — "You have a Love2D game. You want React UI. Here's how."
0:15 — Show the game running (no UI)
0:30 — `ilovereact attach` in terminal
0:45 — Add `require("ilovereact").attach()` to main.lua
1:00 — `ilovereact dev` — empty overlay appears (transparent)
1:15 — Edit `ui/App.tsx` — add a health bar
1:30 — Hot reload — health bar appears on screen
1:45 — Wire `ilr.pushState("hp", player.hp)` in game update loop
2:00 — Health bar is live, responds to game state
2:15 — Add an inventory button — click it, React handles input, game ignores it
2:30 — "That's it. React UI on your Love2D game. No refactoring."

---

## Testing matrix

We must test every scenario before shipping. This is the matrix:

### Boot scenarios

| Scenario | Expected behavior |
|----------|-------------------|
| `attach()` before `love.load` | Normal — init happens in chained `love.load` |
| `attach()` after `love.load` already ran | Late init — detect window open, init immediately |
| `attach()` with no existing `love.load` | Creates one from scratch |
| `attach()` with existing callbacks for all 20+ events | All chain correctly |
| `attach()` with no existing callbacks | Works standalone (React handles everything) |
| `attach()` called twice | Second call is a no-op with a warning |

### Draw compositing

| Scenario | Expected behavior |
|----------|-------------------|
| Game uses `love.graphics.scale()` for virtual resolution | UI renders at window resolution (crisp text) |
| Game uses `love.graphics.translate()` for camera | UI is not affected (origin reset) |
| Game uses shaders | Shader is not applied to React UI |
| Game uses stencils | Stencils are isolated |
| Game uses canvases | React renders to main canvas (or a configurable canvas) |
| Game clears with a color | React overlay is transparent where no nodes exist |
| Game uses `love.graphics.setBackgroundColor()` | Background is the game's, React layers on top |

### Input isolation

| Scenario | Expected behavior |
|----------|-------------------|
| Click on a React button | React handles it, game does NOT receive it |
| Click on empty space (no React node) | Passes through to game |
| Click on a transparent React Box (no handlers) | Passes through to game |
| Type while React TextInput is focused | React handles it, game does NOT receive keystrokes |
| Type while no React input is focused | Passes through to game |
| Gamepad while navigating React menu | React handles it |
| Gamepad during gameplay (no React focus) | Passes through to game |
| Mouse hover over React node | Both React and game receive mousemoved |
| Scroll wheel over React ScrollView | React handles it, game does NOT |
| Scroll wheel over empty space | Passes through to game |

### Library compatibility

| Library | Test |
|---------|------|
| bump.lua | Collision detection works, React UI overlays correctly |
| sti (Simple Tiled Implementation) | Map rendering works, React UI on top |
| hump.gamestate | State switching works, React persists across states |
| windfield | Physics works, React UI unaffected |
| anim8 | Sprite animation works, React UI on top |
| moonshine | Shader effects work on game only, React UI clean |

---

## Build order

### Phase 1 — Foundation (make it work)
1. **Event consumption returns** — modify `lua/init.lua` to return `true`/`false` from all input callbacks
2. **`ilovereact/init.lua` module** — the callback chaining + `attach()` API
3. **Graphics state isolation** — `push("all")` / `origin()` / `pop()` wrapping in the chained `love.draw`
4. **`ilovereact attach` CLI command** — file scaffolding and detection
5. **`pushState` / `pushStates` helpers** — convenience over raw bridge

### Phase 2 — Polish (make it smooth)
6. **Resolution auto-detection** — handle virtual resolution games
7. **Late attach support** — detect if love.load already ran
8. **`ilovereact detach` CLI command** — clean removal
9. **`ilovereact update` for attached projects** — runtime file updates
10. **Error messaging** — helpful errors for common mistakes (missing bundle.js, wrong libpath, etc.)

### Phase 3 — Documentation (make it obvious)
11. **Quick start guide**
12. **Integration cookbook**
13. **API reference**
14. **3 example projects** (platformer, RPG, shmup)
15. **Troubleshooting page** (common issues: resolution, input, performance)

### Phase 4 — Advanced (make it powerful)
16. **`inputPriority` config** — choose whether React or game gets input first
17. **`drawOrder` config** — underlay mode (React draws first, game on top)
18. **Canvas-based isolation** — render React to a separate canvas for perfect compositing
19. **Hot reload** — `ilovereact dev` watches `ui/` and live-reloads the bundle without restarting Love2D
20. **Multi-viewport** — multiple React overlay regions at different positions/sizes

---

## The pitch

> "I had a Love2D game. I ran one command. I added one line to my main.lua. Now I have React UI rendering on top of my game. My existing code didn't change. My game loop didn't change. I just... have a HUD now."

> "The inventory system took me 45 minutes. It would have taken me a week in immediate mode GUI."

That's the testimonial we're designing for. Zero friction means zero excuses not to try it.
