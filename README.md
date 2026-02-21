# ReactJIT

React rendered through a hand-rolled SDL2 + OpenGL renderer on LuaJIT.

```
React JSX
   │
   ▼
Reconciler ──► mutation commands
   │
   ▼
QuickJS FFI bridge
   │
   ▼
Layout engine ──► computed {x, y, w, h}
   │
   ▼
SDL2 + OpenGL painter ──► pixels
```

A reconciler, a layout engine, and a painter. That's it.

---

## Quick Start

```bash
reactjit init my-app
cd my-app
reactjit dev
```

Your React app renders in a native SDL2 + OpenGL window. No browser, no Electron, no game engine.

## Targets

| Target | What it is |
|--------|-----------|
| **SDL2 / OpenGL** | Hand-rolled renderer — LuaJIT + SDL2 + OpenGL 2.1 + FreeType via FFI. Primary target. |
| **Love2D** | Game engine UI via QuickJS in-process. For game devs who want Love2D's ecosystem. |
| **Web (WASM)** | Same SDL2 renderer compiled to WASM + WebGL via Emscripten. Planned. `<canvas>`, not DOM. |

## Packages

### Core

| Package | Import | What it does |
|---------|--------|-------------|
| `packages/shared` | `@reactjit/core` | Primitives (`Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `Modal`, `Slider`, `Switch`, `Checkbox`, `Radio`, `Select`, `FlatList`), hooks, animation, types |
| `packages/native` | `@reactjit/native` | react-reconciler host config, QuickJS FFI bridge, instance tree, event dispatch |
| `packages/components` | `@reactjit/components` | Layout helpers — `Card`, `Badge`, `FlexRow`, `FlexColumn`, `Spacer`, `Divider` |

### UI & Interaction

| Package | Import | What it does |
|---------|--------|-------------|
| `packages/controls` | `@reactjit/controls` | Hardware-style controls — `Knob`, `Fader`, `Meter`, `LEDIndicator`, `PadButton`, `StepSequencer`, `TransportBar` |
| `packages/theme` | `@reactjit/theme` | Theme system — `ThemeProvider`, `ThemeSwitcher`, `useTheme`, built-in dark/light/solarized themes |
| `packages/router` | `@reactjit/router` | In-app navigation — `useRouter`, `Route`, screen transitions |

### Media & 3D

| Package | Import | What it does |
|---------|--------|-------------|
| `packages/3d` | `@reactjit/3d` | 3D scenes — `Scene`, `Mesh`, `Camera`, `AmbientLight`, `DirectionalLight` (OpenGL) |
| `packages/audio` | `@reactjit/audio` | Audio playback and synthesis hooks |
| `packages/media` | `@reactjit/media` | Video, image, and media library management |
| `packages/geo` | `@reactjit/geo` | Maps — `Map`, `TileLayer`, `Marker`, `Polygon`, `Polyline`, `GeoJSON` |

### Data & Networking

| Package | Import | What it does |
|---------|--------|-------------|
| `packages/crypto` | `@reactjit/crypto` | Cryptography — hashing, encryption, key derivation, signing (noble/scure) |
| `packages/storage` | `@reactjit/storage` | Local persistence — key-value store, CRUD, adapters |
| `packages/server` | `@reactjit/server` | HTTP server hooks for local APIs |
| `packages/rss` | `@reactjit/rss` | RSS feed parsing and subscription |
| `packages/webhooks` | `@reactjit/webhooks` | Webhook listener hooks |
| `packages/apis` | `@reactjit/apis` | External API integration — service registry, API key management |
| `packages/ai` | `@reactjit/ai` | AI chat UI components, MCP protocol, model provider abstraction |

## Features

- **Flexbox layout** — the full set: directions, wrapping, alignment, grow/shrink, gap, padding, margin, `%`/`vw`/`vh` units, absolute positioning
- **Animation** — timing, spring physics, easing, composite (`parallel`, `sequence`, `stagger`, `loop`), interpolation
- **Event system** — mouse, touch, drag, keyboard, file drop — bubbling with `stopPropagation()`
- **Prop diffing** — only changed properties cross the bridge; style objects deep-diffed; updates coalesced per frame
- **Hot reload** — edit components, see changes without restarting
- **Error overlay** — source-mapped errors rendered in-app
- **Visual inspector** — F12 to inspect the layout tree, computed styles, node boundaries
- **Gradients, shadows, transforms, clipping, border radius** — CSS-level visual capability
- **Text rendering** — FreeType font rasterization, font weight, alignment, overflow, line height, letter spacing
- **Binary distribution** — ship as a single self-extracting executable
- **Declarative capabilities** — register native features (audio, sensors, timers) as React components with auto-generated schemas for AI discovery

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

## Built-in Tooling

- **Visual Inspector (F12)** — hover any element to see its computed bounds, style properties, and position in the tree. Click to lock. Works at runtime in both SDL2 and Love2D.
- **Error Overlay** — source-mapped stack traces rendered directly in the app window. No terminal hunting.
- **Console** — in-app eval console for live debugging (`lua/console.lua`)
- **DevTools** — runtime tree viewer, node property inspector, performance stats
- **Screenshot Capture** — headless `reactjit screenshot` for CI/visual regression
- **Static Linter** — catches layout bugs (missing fontSize, hardcoded heights, unicode in Text) at build time as blocking errors
- **Theme Menu** — runtime theme switcher with built-in presets (dark, light, solarized, nord, dracula, etc.)
- **On-Screen Keyboard** — soft keyboard for kiosk/touchscreen deployments
- **Context Menu** — right-click menus with nested submenus
- **Drag & Drop** — file drop events from OS, in-app drag reordering
- **Spellcheck** — inline spellcheck for TextInput/TextEditor
- **Text Editor** — full multiline editor with syntax highlighting, tooltips, cursor management

## Using the CLI

```bash
reactjit init <name>              # Create a new project
reactjit dev [target]             # Watch mode (default: sdl2)
reactjit build [target]           # Lint + bundle for dev
reactjit build dist:<target>      # Production build (sdl2, love)
reactjit lint                     # Static layout linter
reactjit screenshot [--output]    # Headless screenshot capture
reactjit update                   # Sync runtime files into current project
```

---

## Architecture

### Rendering Pipeline

```
React component tree
   │  react-reconciler
   ▼
Instance tree (JS) ──── mutation commands ────► Instance tree (Lua)
                         QuickJS FFI               │
                                                   ▼
                                            Layout engine
                                            (flexbox, % units, auto-sizing)
                                                   │
                                                   ▼
                                            Target painter
                                            SDL2: sdl2_painter.lua (OpenGL 2.1)
                                            Love2D: painter.lua (love.graphics)
```

### Bridge Protocol (Lua ↔ JS)

Values cross the bridge via direct QuickJS C API traversal — no JSON serialization. The bridge validates JSValue tag layout at init and falls back to JSON if needed.

- **Commands** (JS → Lua): Mutation commands coalesced and flushed once per frame
- **Events** (Lua → JS): Input events collected in a Lua queue, returned as raw array when polled
- **Handlers stay in JS** — only `hasHandlers` boolean crosses the bridge; dispatch happens in JS

### Source of Truth

| Source of truth | Copied to projects by `reactjit init/update` |
|---|---|
| `lua/` | `<project>/lua/` |
| `packages/shared/` | `<project>/reactjit/shared/` |
| `packages/native/` | `<project>/reactjit/native/` |

**Never edit copies.** Always edit `lua/`, `packages/shared/`, `packages/native/` at the monorepo root. Run `make cli-setup` then `reactjit update` to propagate.

### Project Structure

```
reactjit/
  lua/                 Lua runtime (layout, painter, tree, events, bridges, inspector)
  packages/
    shared/            @reactjit/core — primitives, components, hooks, animation, types
    native/            @reactjit/native — reconciler, QuickJS bridge, event dispatch
    components/        @reactjit/components — layout helpers (Card, Badge, FlexRow...)
    controls/          @reactjit/controls — hardware UI (Knob, Fader, Meter...)
    theme/             @reactjit/theme — theme system
    router/            @reactjit/router — navigation
    3d/                @reactjit/3d — 3D scenes (OpenGL)
    audio/             @reactjit/audio — audio playback/synthesis
    media/             @reactjit/media — video/media library
    geo/               @reactjit/geo — maps and geospatial
    crypto/            @reactjit/crypto — cryptography
    storage/           @reactjit/storage — local persistence
    server/            @reactjit/server — HTTP server hooks
    ai/                @reactjit/ai — AI chat UI + MCP
    apis/              @reactjit/apis — external API integration
    rss/               @reactjit/rss — RSS feeds
    webhooks/          @reactjit/webhooks — webhook listeners
  storybook/           Reference implementation — component catalog, playground, docs
  cli/                 reactjit CLI and runtime
  examples/            Example projects
```
