# ReactJIT

React rendered through Love2D + OpenGL on LuaJIT.

```
React JSX
   |
   v
Reconciler --> mutation commands
   |
   v
QuickJS FFI bridge
   |
   v
Layout engine --> computed {x, y, w, h}
   |
   v
Love2D painter (OpenGL 2.1) --> pixels
```

A reconciler, a layout engine, and a painter. That's it.

---

## Quick Start

```bash
reactjit init my-app
cd my-app
reactjit dev
```

Your React app renders in a native Love2D window. No browser, no Electron, no game engine runtime — just LuaJIT + Love2D + OpenGL 2.1.

## Target

| Target | What it is |
|--------|-----------|
| **Love2D** | LuaJIT + Love2D + OpenGL 2.1 via QuickJS in-process. The only renderer. |
| **WASM** | Same Love2D pipeline compiled to WebAssembly via love.js (Emscripten). Renders to `<canvas>`, not DOM. |

There is no DOM target. No react-dom. No SDL2 primary target. No terminal grid target. Love2D is the renderer — WASM is the same renderer running in a browser canvas.

## Packages

### Core (load-bearing)

| Package | Import | What it does |
|---------|--------|-------------|
| `packages/core` | `@reactjit/core` | Primitives (`Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `Input`, `Modal`, `FlatList`), form controls (`Slider`, `Switch`, `Checkbox`, `Radio`, `Select`), layout (`FlexRow`, `FlexColumn`, `Spacer`), navigation (`NavPanel`, `Tabs`, `Breadcrumbs`, `Toolbar`), data viz (`Table`, `BarChart`, `LineChart`, `PieChart`, `RadarChart`, `Sparkline`, `CandlestickChart`, `DepthChart`, `OrderBook`, `AreaChart`), chat UI (`MessageBubble`, `ChatInput`, `MessageList`), animation, effects, masks, search, capabilities, types |
| `packages/renderer` | `@reactjit/renderer` | react-reconciler host config, QuickJS FFI bridge, instance tree, event dispatch |

### UI & Interaction

| Package | Import | What it does |
|---------|--------|-------------|
| `packages/controls` | `@reactjit/controls` | Hardware-style controls — `Knob`, `Fader`, `Meter`, `LEDIndicator`, `PadButton`, `StepSequencer`, `TransportBar`, `PianoKeyboard` |
| `packages/theme` | `@reactjit/theme` | Theme system — `ThemeProvider`, `useTheme`, built-in presets |
| `packages/router` | `@reactjit/router` | In-app navigation — `useRouter`, `Route`, screen transitions |
| `packages/layouts` | `@reactjit/layouts` | Page/container/nav layout presets |
| `packages/icons` | `@reactjit/icons` | Icon registry + SVG-to-pixel icon set |

### Media & 3D

| Package | Import | What it does |
|---------|--------|-------------|
| `packages/3d` | `@reactjit/3d` | 3D scenes — `Scene`, `Mesh`, `Camera`, `AmbientLight`, `DirectionalLight` (OpenGL) |
| `packages/audio` | `@reactjit/audio` | Modular audio rack, MIDI, sampler, sequencer |
| `packages/media` | `@reactjit/media` | Archive reading, media library indexing |
| `packages/geo` | `@reactjit/geo` | Leaflet-style maps — `MapContainer`, `TileLayer`, `Marker`, `Polygon`, `GeoJSON` |
| `packages/geo3d` | `@reactjit/geo3d` | 3D geographic scenes with terrain |
| `packages/imaging` | `@reactjit/imaging` | Image processing, layer composition, draw canvas, golden testing |
| `packages/physics` | `@reactjit/physics` | 2D physics (Box2D via Love2D) |

### Data & Networking

| Package | Import | What it does |
|---------|--------|-------------|
| `packages/crypto` | `@reactjit/crypto` | Hashing, encryption, key derivation, signing via libsodium |
| `packages/storage` | `@reactjit/storage` | CRUD, schema validation, adapters |
| `packages/server` | `@reactjit/server` | HTTP server, static file serving |
| `packages/rss` | `@reactjit/rss` | RSS feed parsing + OPML |
| `packages/webhooks` | `@reactjit/webhooks` | Webhook send/receive |
| `packages/apis` | `@reactjit/apis` | External API wrappers (Spotify, GitHub, Weather, etc.) |
| `packages/ai` | `@reactjit/ai` | LLM providers, chat hooks, MCP protocol, AI components |
| `packages/networking` | `@reactjit/networking` | Game server hosting (Minecraft, etc.) |
| `packages/wireguard` | `@reactjit/wireguard` | WireGuard + userspace P2P tunnels |
| `packages/privacy` | `@reactjit/privacy` | GPG, keyrings, PII redaction, secure storage |

### Domain

| Package | Import | What it does |
|---------|--------|-------------|
| `packages/chemistry` | `@reactjit/chemistry` | Periodic table, molecules, reactions, reagent tests, spectra, phase diagrams, PubChem API |
| `packages/finance` | `@reactjit/finance` | Technical analysis, portfolio tracking, price feeds |
| `packages/math` | `@reactjit/math` | Vector/matrix math, noise, bezier, geometry |
| `packages/data` | `@reactjit/data` | Spreadsheet formula engine |
| `packages/convert` | `@reactjit/convert` | Unit/color/encoding conversions |
| `packages/time` | `@reactjit/time` | Timers, stopwatch, countdown, date utils |
| `packages/terminal` | `@reactjit/terminal` | Claude Canvas (PTY + classified terminal) |

## Features

- **Flexbox layout** — directions, wrapping, alignment, grow/shrink, gap, padding, margin, `%`/`vw`/`vh` units, absolute positioning
- **Auto-sizing** — containers size from content, empty surfaces fall back to 1/4 parent, `flexGrow` fills remaining space
- **Animation** — timing, spring physics, easing, composite (`parallel`, `sequence`, `stagger`, `loop`), interpolation, presets (`usePulse`, `useShake`, `useEntrance`, `useBounce`, `useTypewriter`)
- **Generative effects** — `Spirograph`, `Rings`, `FlowParticles`, `Mirror`, `Mandala`, `Cymatics`, `Constellation`, `Mycelium`, `Terrain`, `Automata`, `LSystem`, and more
- **Post-processing masks** — `CRT`, `VHS`, `Scanlines`, `Dither`, `Ascii`, `Watercolor`, `DataMosh`, `FeedbackLoop`, `FishEye`, `Tile`
- **Event system** — mouse, touch, drag, keyboard, file drop — bubbling with `stopPropagation()`
- **Prop diffing** — only changed properties cross the bridge; style objects deep-diffed; updates coalesced per frame
- **Hot reload** — edit components, see changes without restarting
- **Error overlay** — source-mapped errors rendered in-app
- **Visual inspector** — F12 to inspect the layout tree, computed styles, node boundaries
- **Gradients, shadows, transforms, clipping, border radius** — CSS-level visual capability
- **Text rendering** — FreeType font rasterization, full Unicode (DejaVu Sans covers arrows, math, dingbats, block elements), font weight, alignment, overflow, line height, letter spacing
- **Declarative capabilities** — register native features (audio, GPIO, timers, boids, image processing, game servers) as React components with auto-generated schemas for AI discovery
- **Search** — `SearchBar`, `SearchResults`, `CommandPalette`, `AppSearch`, fuzzy/async search hooks
- **Binary distribution** — ship as a single self-extracting executable (Linux, macOS Intel/ARM, Windows)
- **GIF/video capture** — `useGifRecorder`, `useRecorder` for screen recording via ffmpeg
- **Classifier** — global named primitive registry for semantic UI classification

## Components

```tsx
import { Box, Text, Image, Pressable } from '@reactjit/core';

<Box style={{ flexDirection: 'row', gap: 8, padding: 16, alignItems: 'center' }}>
  <Image src="avatar.png" style={{ width: 48, height: 48, borderRadius: 24 }} />
  <Box style={{ flexGrow: 1 }}>
    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#f8fafc' }}>Username</Text>
    <Text style={{ fontSize: 13, color: '#94a3b8' }}>Online now</Text>
  </Box>
  <Pressable onPress={() => console.log('tap')} style={{ padding: 8, backgroundColor: '#3b82f6', borderRadius: 6 }}>
    <Text style={{ fontSize: 13, color: '#fff' }}>Message</Text>
  </Pressable>
</Box>
```

### Animation

```tsx
import { useAnimation, useSpring, Easing, parallel } from '@reactjit/core';

const opacity = useAnimation({ from: 0, to: 1, duration: 300, easing: Easing.easeOut });
const scale = useSpring({ from: 0.8, to: 1, stiffness: 200, damping: 15 });

parallel([
  opacity.timing({ to: 1, duration: 200 }),
  scale.spring({ to: 1.2 }),
]).start();
```

### Declarative Capabilities

```tsx
import { Audio, TTS, Timer, GameServer, Window } from '@reactjit/core';

// One-liner components — Lua does the work, React declares intent
<Audio src="beat.mp3" playing volume={0.8} />
<TTS text="Hello world" voice="en-us" rate={1.0} />
<Timer duration={30000} onComplete={() => setDone(true)} />
<GameServer type="minecraft" port={25565} maxPlayers={20} />
<Window title="Settings" width={400} height={300} />
```

### Chemistry

```tsx
import { PeriodicTable, ReagentTest, BohrModel } from '@reactjit/chemistry';
import { useElement, useMolecule } from '@reactjit/chemistry';

const element = useElement(26); // Iron
const water = useMolecule('H2O');

<PeriodicTable onSelect={setElement} />
<BohrModel element={26} />
<ReagentTest compound="FeCl3" reagent="NaOH" />
```

## TSL — TypeScript-to-Lua

TSL (`.tsl` files) lets you write Lua-side logic in TypeScript syntax. The transpiler converts it 1:1 to idiomatic Lua — no runtime, no class emulation, no bridge overhead. It runs at LuaJIT speed because the output *is* Lua.

**Who it's for:** Application developers who want Lua performance for hot paths (particle systems, physics, shaders, data transforms) without learning Lua's syntax or module system.

**What it is not:** A language bridge. If Lua can't do something natively, TSL can't either. Arrays are 1-indexed. No promises, no DOM, no Node APIs.

### Workflow

Place `.tsl` files in `src/tsl/`. The CLI handles the rest:

```bash
reactjit dev    # transpiles src/tsl/*.tsl -> lua/tsl/*.lua on startup, re-transpiles on save
reactjit build  # transpiles before bundling; TSL errors block the build like lint errors
```

Then require the output from Lua normally:

```lua
local particles = require("lua.tsl.particles")
particles.update(state, dt)
```

### What works

```typescript
// src/tsl/easing.tsl

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

export function bounce(t: number): number {
  if (t < 1 / 2.75) {
    return 7.5625 * t * t
  } else if (t < 2 / 2.75) {
    t -= 1.5 / 2.75
    return 7.5625 * t * t + 0.75
  } else {
    t -= 2.625 / 2.75
    return 7.5625 * t * t + 0.984375
  }
}
```

Transpiles to clean, readable Lua — no wrappers, no overhead.

Supported features:
- Variables (`const`, `let`) -> `local`
- Functions, arrow functions -> `function`
- `if / else if / else`
- `for`, `while`, `do-while`, numeric `for`, `for-of`, `for-in`
- Objects -> tables, arrays -> tables
- Destructuring, template literals, optional chaining (`?.`), nullish coalescing (`??`)
- `Math.*`, `string.*`, array method transforms (`map`, `filter`, `forEach`, `find`, `reduce`, `some`, `every`, `flat`, etc.)
- Imports -> `require`, exports -> return table
- Type annotations stripped cleanly
- Comments preserved

Standard library helpers (injected automatically only when used): `map`, `filter`, `forEach`, `indexOf`, `reverse`, `find`, `findIndex`, `some`, `every`, `reduce`, `flat`, `keys`, `values`, `entries`, `split`, `merge`.

### Linting

`reactjit lint` checks `.tsl` files alongside `.tsx` files. TSL-specific rules:

| Rule | Severity | What it catches |
|------|----------|----------------|
| `tsl-no-js-globals` | error | `console`, `Date`, `setTimeout`, `setInterval`, `fetch`, `window`, `document`, and other JS globals that don't exist in LuaJIT |
| `tsl-no-zero-index` | error | `arr[0]` — always `nil` in Lua; arrays are 1-indexed |
| `tsl-no-any` | warning | `any` type annotations that suppress checking |

Suppressions:

```typescript
// tsl-ignore        — suppress the next line (any rule)
// tsl-any           — suppress tsl-no-any on the next line or same line
```

### What's not supported (hard errors)

These are build-blocking errors — TSL will refuse to transpile:

| Feature | Why |
|---------|-----|
| `class` | Lua has no classes. Use tables and functions. |
| `async` / `await` | No event loop in LuaJIT. |
| `try` / `catch` | Use `pcall`. |
| `new` | No constructors. Return a table from a function. |
| `yield` / generators | Not available in LuaJIT. |

### CLI

```bash
reactjit tsl src/tsl/myfile.tsl          # transpile to stdout
reactjit tsl src/tsl/myfile.tsl -o out.lua  # transpile to file
reactjit tsl src/tsl/                    # transpile whole directory
reactjit tsl --test                      # run the test suite
```

---

## Built-in Tooling

- **Visual Inspector (F12)** — hover any element to see its computed bounds, style properties, and position in the tree. Click to lock.
- **Error Overlay** — source-mapped stack traces rendered directly in the app window
- **Console** — in-app eval console for live debugging
- **DevTools** — runtime tree viewer, node property inspector, performance stats
- **Screenshot Capture** — headless `reactjit screenshot` for CI/visual regression
- **Static Linter** — catches layout bugs (hardcoded heights, mixed text children, invalid styles) at build time as blocking errors
- **Theme Menu** — runtime theme switcher with built-in presets
- **On-Screen Keyboard** — soft keyboard for kiosk/touchscreen deployments
- **Context Menu** — right-click menus with nested submenus
- **Drag & Drop** — file drop events from OS
- **Spellcheck** — inline spellcheck for text inputs
- **Text Editor** — full multiline editor with syntax highlighting, tooltips, cursor management
- **CartridgeInspector** — inspect and debug Love2D cartridge internals

## Using the CLI

```bash
reactjit init <name>              # Create a new project
reactjit dev                      # Watch mode + HMR (Love2D)
reactjit build                    # Lint + bundle for dev
reactjit build linux              # Production: self-extracting Linux binary (x64)
reactjit build macos              # Production: macOS bundle (Intel x64)
reactjit build macmseries         # Production: macOS bundle (Apple Silicon arm64)
reactjit build windows            # Production: Windows archive (x64)
reactjit build dist:love          # Production: self-extracting Linux binary (Love2D + glibc)
reactjit lint                     # Static layout linter
reactjit screenshot [--output]    # Headless screenshot capture
reactjit update                   # Sync runtime files into current project
reactjit test <spec.ts>           # Run tests inside Love2D process
```

---

## Architecture

### Rendering Pipeline

```
React component tree
   |  react-reconciler
   v
Instance tree (JS) ---- mutation commands ----> Instance tree (Lua)
                         QuickJS FFI               |
                                                   v
                                            Layout engine
                                            (flexbox, % units, auto-sizing)
                                                   |
                                                   v
                                            Love2D painter
                                            painter.lua (love.graphics / OpenGL 2.1)
```

### Bridge Protocol (Lua <-> JS)

Values cross the bridge via direct QuickJS C API traversal — no JSON serialization. The bridge validates JSValue tag layout at init and falls back to JSON if needed.

- **Commands** (JS -> Lua): Mutation commands coalesced and flushed once per frame
- **Events** (Lua -> JS): Input events collected in a Lua queue, returned as raw array when polled
- **Handlers stay in JS** — only `hasHandlers` boolean crosses the bridge; dispatch happens in JS

### Source of Truth

| Source of truth | Copied to projects by `reactjit init/update` |
|---|---|
| `lua/` | `<project>/lua/` |
| `packages/core/` | `<project>/reactjit/shared/` |
| `packages/renderer/` | `<project>/reactjit/renderer/` |

**Never edit copies.** Always edit `lua/`, `packages/core/`, `packages/renderer/` at the monorepo root. Run `make cli-setup` then `reactjit update` to propagate.

## Layout

### How sizing works

The layout engine has three sizing tiers. They resolve in order — the first one that applies wins:

1. **Explicit dimensions** — `width`, `height`, `flexGrow`, or `flexBasis`. Always takes priority.
2. **Content auto-sizing** — containers with children auto-size from their content. Text measures from font metrics. Default for any element with children.
3. **Proportional surface fallback** — empty surface nodes (`Box`, `Image`, `Video`, `Scene3D`) with no explicit dimensions and no children fall back to 1/4 of parent's available space.

### Rules

- Root containers need `width: '100%', height: '100%'`
- Use `flexGrow: 1` for space-filling elements — not hardcoded pixel heights
- `ScrollView` needs explicit height (excluded from proportional fallback)
- Don't mix text and expressions in `<Text>` — use template literals: `` {`Hello ${name}!`} ``
- No `paddingHorizontal`/`paddingVertical` — use `paddingLeft`/`paddingRight`/`paddingTop`/`paddingBottom`
- No `flex: 1` shorthand — use `flexGrow: 1`
- Unicode works fine in `<Text>` — DejaVu Sans has full coverage (arrows, math, dingbats, block elements)

## Contributing

### Source-of-truth rules

This is the #1 source of "it builds but doesn't work" bugs. There are two kinds of files:

- **Framework files** (`lua/`, `packages/*/src/`) — edit these at the monorepo root, then run `make cli-setup` to propagate to `cli/runtime/`. Consumer projects pull updates via `reactjit update`.
- **Project files** (`src/`, `main.lua`, `conf.lua`) — unique to each project, safe to edit directly.

**Never edit copies.** `cli/runtime/`, `<project>/lua/`, and `<project>/reactjit/` are generated — edits there get overwritten silently.

### The storybook is special

`storybook/lua` is a **symlink** to `../lua`. It reads framework source directly. Do not:
- Run `reactjit update` from the storybook directory
- Replace the symlink with a real directory
- Create `storybook/lua/` or `storybook/reactjit/` as real directories

### Build commands

Always use the CLI (`rjit build`, `rjit dev`, `rjit lint`). Never run raw esbuild commands — the CLI encodes correct flags, enforces lint gates, and handles runtime file placement.

### AI agents

See `CLAUDE.md` for Claude Code instructions and `AGENTS.md` for sandboxed agents (Codex, etc.).

### Project Structure

```
reactjit/
  lua/                 Lua runtime (layout, painter, tree, events, bridge, inspector, capabilities)
  packages/
    core/              @reactjit/core — primitives, components, hooks, animation, effects, masks, types
    renderer/          @reactjit/renderer — reconciler, QuickJS bridge, event dispatch
    3d/                @reactjit/3d — 3D scenes (OpenGL)
    ai/                @reactjit/ai — LLM providers, chat hooks, MCP
    apis/              @reactjit/apis — external API wrappers
    audio/             @reactjit/audio — modular audio rack, MIDI, sampler, sequencer
    chemistry/         @reactjit/chemistry — periodic table, molecules, reactions, spectra
    controls/          @reactjit/controls — hardware UI (Knob, Fader, PianoKeyboard...)
    convert/           @reactjit/convert — unit/color/encoding conversions
    crypto/            @reactjit/crypto — hashing, encryption, signing
    data/              @reactjit/data — spreadsheet formula engine
    finance/           @reactjit/finance — technical analysis, portfolio, price feeds
    geo/               @reactjit/geo — Leaflet-style maps
    geo3d/             @reactjit/geo3d — 3D geographic scenes with terrain
    icons/             @reactjit/icons — icon registry + SVG-to-pixel icons
    imaging/           @reactjit/imaging — image processing, composition, draw canvas
    layouts/           @reactjit/layouts — page/container/nav presets
    math/              @reactjit/math — vector/matrix, noise, bezier, geometry
    media/             @reactjit/media — archive reading, media library
    networking/        @reactjit/networking — game server hosting
    physics/           @reactjit/physics — 2D physics (Box2D via Love2D)
    privacy/           @reactjit/privacy — GPG, keyrings, PII redaction
    router/            @reactjit/router — client-side routing
    rss/               @reactjit/rss — RSS feed parsing + OPML
    server/            @reactjit/server — HTTP server, static files
    storage/           @reactjit/storage — CRUD, schema validation
    terminal/          @reactjit/terminal — Claude Canvas (PTY + classifier)
    theme/             @reactjit/theme — theming system
    time/              @reactjit/time — timers, stopwatch, countdown
    webhooks/          @reactjit/webhooks — webhook send/receive
    wireguard/         @reactjit/wireguard — WireGuard + P2P tunnels
  storybook/           Reference implementation — component catalog, playground, docs
  cli/                 reactjit CLI and runtime distribution
  examples/            Consumer projects (native-hud, neofetch, wallet, audio-synth, browser, etc.)
  content/             Documentation source (.txt files, 14 sections, 198 pages)
```
