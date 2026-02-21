# ReactJIT — Target Interfaces

> **i** = interface, **Love** = where it started, **React** = what we love

React is a reconciler. It diffs a tree. It emits mutations. It doesn't care what's on the other end.

We already proved this works: a full flexbox layout engine in Lua, a React reconciler that emits serializable commands, a retained tree that consumes them, and a painter that draws the result. The reconciler, tree, and layout engine are **target-agnostic**. Each new target only needs two things:

1. **Transport** — how mutation commands reach the target
2. **Painter** — how the target turns `{x, y, w, h, color, text}` into visible output

```
React JSX
   │
   ▼
Reconciler (hostConfig.ts) ──► mutation commands
   │
   ▼
Transport (QuickJS FFI / WebSocket / IPC / direct embed)
   │
   ▼
Retained Tree (tree.lua) ──► layout.lua ──► computed positions
   │
   ▼
Painter (target-specific) ──► pixels / characters / widgets
```

---

## Current Targets

### Love2D (native)
**Status:** Built and working.
- Transport: QuickJS FFI (JS runs inside the Love2D process, zero-copy)
- Painter: `love.graphics.*` calls
- Full flexbox, text measurement, images, scroll, events, animation

### Web (DOM overlay)
**Status:** Built and working.
- Transport: None (React renders directly to DOM)
- Painter: Browser CSS flexbox
- Shares components via dual-mode primitives

---

## Priority Targets

### OBS Studio (obslua)

**Why this matters:**
StreamLabs/StreamElements overlays are Chrome tabs. A "simple" alert box eats 300MB+ RAM and causes frame drops during encoding. OBS already has a Lua runtime (LuaJIT via obslua). We can render directly to OBS sources with ~15MB RAM and negligible CPU.

**The pitch:** Write stream overlays in React. No browser. No Electron. No frame drops.

**Two paths:**

1. **Love2D window as OBS source (ready now):** OBS captures the Love2D window via Window/Game Capture. Same concept as a browser source — OBS grabs a window — but instead of Chromium you get QuickJS + your layout engine + `love.graphics.*`. This already works with zero additional code. The overlay is just a Love2D app.

2. **Direct obslua embed (deeper integration):** For tighter OBS integration — reacting to scene switches, stream events, source visibility — embed via obslua. The layout engine runs inside OBS's LuaJIT runtime, and the painter renders to an image buffer via `obs_enter_graphics()` / `gs_texture_create()`. No window to capture, no extra process.

- Resolution: Arbitrary (overlay dimensions set by the streamer)
- Color: Full RGBA

**What you'd build with it:**
- Alert boxes, follower notifications, sub goals
- Chat overlays with smooth animations
- Now-playing widgets, countdown timers
- Scene-aware overlays that respond to OBS scene switches
- Real-time stat dashboards (viewer count, stream health)

**Complexity:** Path 1 is free — it's the current Love2D target pointed at an overlay-sized window. Path 2 is medium — OBS's Lua API is well-documented, but the image buffer rendering requires working with OBS's graphics subsystem directly.

**Event model:** Path 1 uses Love2D's input events (mouse, keyboard) as-is. Path 2 taps into OBS signals (scene change, stream start/stop, source visibility) which map cleanly to our event system.

---

### ComputerCraft (Minecraft)

**Why this matters:**
This is the "monitor inside a game" dream. ComputerCraft gives Minecraft computers a Lua terminal with networking. Players already want to display real-world data (Discord chat, server stats, dashboards) in-game. Nobody has given them React.

**The pitch:** Write Minecraft computer UIs in React. Data from the real world, rendered in the block world.

**Architecture:**
- Transport: WebSocket (`http.websocket()` in ComputerCraft)
- Painter: `term` / `paintutils` API — character grid with 16-color palette
- Resolution: 51x19 characters (computer), up to 164x81 pixels (8x monitor array)
- Color: 16 colors (CC palette, remappable)

**Grid mode:**
The layout engine works in pixels. For ComputerCraft, treat 1 character = 1 unit. Flexbox on a 51x19 grid still works — it just means your padding is `1` not `8`. The coarse grid actually makes flexbox *more* useful because manual positioning at this scale is tedious.

**The client is trivial:**
```lua
-- startup.lua (runs inside Minecraft)
local ws = http.websocket("ws://localhost:8080")
while true do
    local msg = ws.receive()
    local tree = textutils.unserialize(msg)
    term.clear()
    for _, node in pairs(tree) do
        paintutils.drawFilledBox(node.x, node.y, node.x + node.w, node.y + node.h, node.color)
        if node.text then
            term.setCursorPos(node.x, node.y)
            term.setTextColor(node.textColor or colors.white)
            term.write(node.text)
        end
    end
end
```

**What you'd build with it:**
- Server status dashboards on in-game monitors
- Discord/Twitch chat displays
- Redstone system control panels (buttons that trigger real redstone)
- Stock tickers, weather widgets, clocks
- Multi-monitor setups with React layouts spanning a 4x3 monitor wall

**Complexity:** Low. The transport is a websocket. The painter is ~30 lines. The main work is a color quantization step (map RGB to the nearest CC palette color) and a grid-snapping pass on layout output.

**Event model:** ComputerCraft supports `monitor_touch` events (x, y coordinates on click). These map directly to our hit-testing system. Keyboard input works on the computer's own terminal.

---

## Strong Candidates

### AwesomeWM

**Why this matters:**
AwesomeWM is a tiling window manager written in Lua. Its widget system (wibox) is powerful but arcane — you define layouts in nested Lua tables with a custom constraint-based system. React's component model would be a massive DX improvement.

**Architecture:**
- Transport: Direct embed (AwesomeWM runs LuaJIT, QuickJS can embed alongside)
- Painter: Cairo via `wibox.widget.base` / `cr:rectangle()`, `cr:fill()`, etc.
- Resolution: Screen pixels
- Color: Full RGBA (Cairo)

**What you'd build with it:**
- Status bars (replace Polybar/Waybar with React components)
- Notification centers
- App launchers
- System dashboards (CPU, RAM, disk, network graphs)
- Dynamic wallpapers with data visualization

**Complexity:** Medium-high. AwesomeWM's widget lifecycle is callback-driven and assumes widgets are long-lived Lua objects. We'd need to bridge between React's reconciler model and Awesome's widget tree, or bypass wibox entirely and paint to a raw Cairo surface.

---

### Neovim

**Why this matters:**
Neovim has a LuaJIT runtime and a rich UI API (floating windows, virtual text, extmarks, custom highlights). Plugin UIs are currently built with hand-rolled Lua or TUI libraries. React would bring composability and state management to plugin development.

**Architecture:**
- Transport: Direct embed (Neovim runs LuaJIT) or RPC (`vim.fn.jobstart` + stdio)
- Painter: Neovim API — `nvim_open_win()` for floating windows, `nvim_buf_set_lines()` for content, highlight groups for color
- Resolution: Character grid (terminal cells)
- Color: 24-bit via terminal, applied through highlight groups

**What you'd build with it:**
- Floating documentation panels
- Interactive file explorers
- Git diff viewers with inline controls
- Dashboard/start screens
- Debug variable inspectors

**Complexity:** Medium. The floating window API is straightforward. The challenge is that Neovim's "canvas" is a buffer (lines of text with highlight spans), not a pixel grid. The painter needs to translate layout rectangles into buffer regions and manage highlight groups for styling.

---

### Hammerspoon (macOS)

**Why this matters:**
Hammerspoon is a macOS automation tool with LuaJIT. It can draw arbitrary overlays on the desktop via `hs.canvas`. Think: desktop widgets, notification overlays, clipboard managers, keyboard shortcut cheat sheets — all in React.

**Architecture:**
- Transport: Direct embed (LuaJIT, same as Love2D path)
- Painter: `hs.canvas` — supports rectangles, text, images, rounded corners, shadows
- Resolution: Screen pixels (Retina-aware)
- Color: Full RGBA

**What you'd build with it:**
- Desktop widget overlays (clock, weather, system stats)
- Application switcher / launcher
- Clipboard history viewer
- Meeting reminders / notification center
- Keyboard shortcut cheat sheets that appear on hotkey

**Complexity:** Low-medium. `hs.canvas` is already a retained-mode drawing API with elements that have position, size, fill, stroke, text — very close to what our painter already outputs. The main work is mapping our layout output to canvas elements.

---

### ReaScript (REAPER DAW)

**Why this matters:**
REAPER is a professional DAW with a Lua scripting API. The built-in `gfx.*` API for custom UIs is immediate-mode and painful. React would bring real component architecture to audio plugin UIs and workflow tools.

**Architecture:**
- Transport: Direct embed (REAPER embeds Lua)
- Painter: `gfx.*` API — `gfx.rect()`, `gfx.drawstr()`, `gfx.blit()` in an immediate-mode window
- Resolution: Pixel-based (resizable window)
- Color: Full RGB (0-1 float)

**What you'd build with it:**
- Custom mixer control surfaces
- MIDI editors with piano rolls
- Envelope editors
- Track template browsers
- Session notes / lyrics displays

**Complexity:** Medium. The `gfx.*` API is immediate-mode (draw every frame), which maps well to our painter model. The challenge is that ReaScript runs synchronously in REAPER's defer loop, and the `gfx` window has its own event polling (`gfx.mouse_x`, `gfx.getchar()`).

---

## Exploratory Targets

### Roblox (Luau)

Roblox uses Luau (a Lua 5.1 derivative with types). The platform has 70M+ daily active users, and custom UI is built with Roblox's `ScreenGui` / `Frame` / `TextLabel` system. A React bridge would let developers write Roblox UIs with familiar tooling.

- Transport: Direct embed (Luau runs in-engine)
- Painter: Roblox GUI instances — `Frame`, `TextLabel`, `ImageLabel` with `UDim2` positioning
- Gotcha: Roblox's Luau is sandboxed. No FFI, no `require` from filesystem. The layout engine would need to be pure Lua (no LuaJIT dependency). The tree and commands would need to serialize over Roblox's messaging system.
- Complexity: High (sandboxing constraints), but massive potential audience.

### Playdate (Lua)

Panic's Playdate handheld uses a Lua SDK. 400x240 1-bit display, crank input. A React target would bring component-based UI to Playdate game menus and HUDs.

- Transport: Direct embed (Playdate Lua runtime)
- Painter: `playdate.graphics.*` — `fillRect`, `drawText`, sprites
- Gotcha: 1-bit display (black and white only), very constrained memory. Layout engine needs to be lean.
- Complexity: Medium. Interesting constraint-driven design challenge.

### Terminal / TUI

Pure terminal rendering with ANSI escape codes. No Lua runtime needed — the painter outputs escape sequences to stdout. This would position ReactJIT as a React-based TUI framework (similar to Ink but with our own layout engine).

- Transport: Direct (Node.js process, or any JS runtime)
- Painter: ANSI escape codes — `\033[row;colH` for positioning, `\033[38;2;r;g;bm` for color
- Resolution: Terminal character grid
- Complexity: Low. The painter is simple string concatenation.

### Qt (via Lua bindings)

Full desktop application rendering through Qt's widget or QML system. This would put ReactJIT in the same space as React Native for desktop.

- Transport: lqt bindings or custom C bridge
- Painter: QPainter / QWidget API
- Complexity: High. Qt's object model is complex, but the payoff is native desktop apps.

---

## Target Comparison Matrix

| Target | Transport | Resolution | Colors | Lua Runtime | Complexity | Audience |
|--------|-----------|-----------|--------|-------------|------------|----------|
| **Love2D** | QuickJS FFI | Pixels | Full RGBA | LuaJIT | Done | Game devs |
| **Web** | DOM | Pixels | Full CSS | N/A | Done | Everyone |
| **OBS Studio** | WebSocket / embed | Pixels | Full RGBA | LuaJIT | Medium | Streamers |
| **ComputerCraft** | WebSocket | 51x19 chars | 16 colors | CC Lua | Low | Minecraft |
| **AwesomeWM** | Direct embed | Pixels | Full RGBA | LuaJIT | Med-High | Linux |
| **Neovim** | Direct embed / RPC | Char grid | 24-bit | LuaJIT | Medium | Devs |
| **Hammerspoon** | Direct embed | Pixels | Full RGBA | LuaJIT | Low-Med | macOS |
| **ReaScript** | Direct embed | Pixels | Full RGB | Lua 5.4 | Medium | Audio |
| **Roblox** | In-engine | UDim2 | Full RGBA | Luau | High | Massive |
| **Playdate** | Direct embed | 400x240 | 1-bit | Lua 5.4 | Medium | Niche |
| **Terminal** | Direct (Node) | Char grid | 256/True | N/A | Low | Devs |
| **Qt** | C bridge | Pixels | Full RGBA | Optional | High | Desktop |

---

## Implementation Strategy

### Package Architecture

Painters and transports are plug-in packages. A target is a `transport` + `painter` pair. The core is shared.

```
@reactjit/core              ← reconciler, tree, layout engine, primitives
@reactjit/transport-ffi     ← QuickJS FFI (in-process, zero-copy)
@reactjit/transport-ws      ← WebSocket (cross-process, cross-machine)
@reactjit/transport-stdio   ← stdio pipe (child process)
@reactjit/painter-love2d    ← love.graphics.*
@reactjit/painter-obs       ← obs_enter_graphics / gs_texture
@reactjit/painter-cc        ← term / paintutils (ComputerCraft)
@reactjit/painter-terminal  ← ANSI escape codes
@reactjit/painter-awesome   ← Cairo / wibox
@reactjit/painter-nvim      ← nvim_buf_set_lines / floating windows
@reactjit/painter-hs        ← hs.canvas (Hammerspoon)
@reactjit/painter-reaper    ← gfx.* (ReaScript)
```

**Why this structure matters:**
- The package list *is* the documentation. Scan the npm org, see every target.
- Adding a target = publish two small packages. Core never changes.
- Users install exactly what they need. `npm i @reactjit/core @reactjit/transport-ws @reactjit/painter-cc` and they're rendering React inside Minecraft.
- Community can contribute painters without touching core. The interface is small enough that a painter is a weekend project.

**Usage:**
```tsx
import { createRoot } from '@reactjit/core'
import { WebSocketTransport } from '@reactjit/transport-ws'
import { ComputerCraftPainter } from '@reactjit/painter-cc'

const transport = new WebSocketTransport({ port: 8080 })
const painter = new ComputerCraftPainter({ palette: 'default' })
const root = createRoot(transport, painter)

root.render(<App />)
```

### Interfaces

**PainterInterface** (what every painter implements):
```lua
function Painter:drawRect(x, y, w, h, color, borderRadius)
function Painter:drawText(x, y, text, font, color)
function Painter:drawImage(x, y, w, h, src)
function Painter:setClip(x, y, w, h)
function Painter:clearClip()
function Painter:flush()  --
```

**TransportInterface** (what every transport implements):
```
send(commands)   → push mutation commands to the target
receive()        → pull events from the target
connect()        → establish connection
disconnect()     → tear down
```

Note: For Lua-side painters (Love2D, AwesomeWM, Hammerspoon, ReaScript), the painter is a `.lua` file that implements the interface. For JS-side painters (Terminal), it's a `.ts` file. The interface is the same shape either way — the transport determines which side the painter runs on.

### Rollout

**Phase 1: Extract interfaces from current code**
- Factor `painter.lua` into `PainterInterface` + `painter-love2d`
- Factor `bridge_quickjs.lua` into `TransportInterface` + `transport-ffi`
- Core becomes `@reactjit/core` (reconciler, tree, layout, primitives)

**Phase 2: First two new targets**
- `@reactjit/transport-ws` + `@reactjit/painter-cc` — ComputerCraft. Proves the architecture generalizes across process boundaries.
- `@reactjit/painter-love2d` as OBS window source — already works, just needs packaging and a guide.

**Phase 3: Direct-embed targets**
- Hammerspoon, AwesomeWM, Neovim — all LuaJIT, so `@reactjit/core` (layout engine) drops in directly. Each target is just a new painter package.

**Phase 4: Non-Lua targets**
- `@reactjit/painter-terminal` — JS-native, no Lua needed
- Qt, Roblox — custom bridges

**Phase 5: Rebrand and README rewrite**
- Rename project from `reactjit` to `ReactJIT`
- Rewrite the README to reflect the multi-target identity:
  - Lead with the universal pitch: "Write it in React, render it anywhere there's a surface"
  - Architecture diagram showing core + pluggable transports/painters
  - Quick-start examples for each implemented target (not hypothetical ones — only targets that ship)
  - Package table listing every published `@reactjit/*` package with one-line descriptions
  - Feature highlights: HMR, error reporting with source maps, binary distribution, flexbox layout engine
  - "Add a target" guide showing the painter/transport interfaces for community contributors
- Update package.json names, repo references, and imports across the monorepo
- Rename GitHub repo (`reactjit` → `reactjit`), set up redirect from the old name

---

## The Unifying Idea

Every target on this list is a **surface that people already want to put UI on**, but where the DX is terrible. Lua tables, immediate-mode `gfx` calls, ANSI escape codes, XML widget trees.

ReactJIT says: **write it in React, render it anywhere there's a surface.**

Not "React Native for X." Not "Electron but smaller." Just: here's a reconciler, here's a layout engine, here's a 50-line painter for your target. Ship it.
