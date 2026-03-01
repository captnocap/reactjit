# Changelog

All notable changes to ReactJIT are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — `MAJOR.MINOR.PATCH`:
- **MAJOR**: breaking changes to the target interface, bridge protocol, or package API
- **MINOR**: new targets, new components, new Lua subsystems, new packages
- **PATCH**: bug fixes, layout corrections, painter improvements, build tooling

---

## [Unreleased]

---

## [0.1.0] - 2026-02-18

Initial baseline release. Everything documented here exists and works.

### Renderer

- **SDL2 / OpenGL target** — custom renderer with no game engine dependency
  - `lua/sdl2_init.lua` — SDL2 run loop (event pump, frame cap, resize handling)
  - `lua/sdl2_painter.lua` — OpenGL 2.1 painter (rects, borders, rounded corners, text, clipping)
  - `lua/sdl2_gl.lua` — OpenGL 2.1 FFI bindings
  - `lua/sdl2_font.lua` — FreeType glyph rasterizer + per-glyph GL texture cache via `ft_helper.so`
  - `lua/sdl2_measure.lua` — text metrics via FreeType
  - `lua/target_sdl2.lua` — target interface implementation
- **Target abstraction interface** — `lua/target_love2d.lua` / `lua/target_sdl2.lua` — both expose `{ name, measure, painter, images?, videos? }`. Swap the table to change the renderer.
- **Love2D target** — reference implementation (`lua/target_love2d.lua`) — full painter with gradients, shadows, transforms, clipping, images, video, audio

### Lua Runtime (`lua/`)

- Layout engine (`layout.lua`) — full flexbox: direction, wrap, justify, align, grow/shrink, gap, padding, margin, %, vw/vh, absolute positioning, auto-sizing
- Retained tree (`tree.lua`) — consumes mutation commands from the React reconciler
- QuickJS FFI bridge (`bridge_quickjs.lua`) — zero-copy JS ↔ Lua command/event transport
- Event system (`events.lua`) — hit testing, hover, bubbling, scroll containers
- Text measurement (`measure.lua`) — Love2D font metrics cache
- Error overlay (`errors.lua`) — source-mapped runtime error display
- Visual inspector (`inspector.lua`) — F12 node inspector, live style panel
- Dev console (`console.lua`) — interactive Lua eval console
- Dev tools panel (`devtools.lua`) — tabbed Elements + Console panel
- Settings overlay (`settings.lua`) — API key manager (F10)
- Theme browser (`theme_menu.lua`) — theme picker (F9)
- Screenshot (`screenshot.lua`) — headless frame capture
- 3D scene system (`scene3d.lua`, `lua/g3d/`) — g3d model loading, camera, collision
- Audio engine (`lua/audio/`) — modular synth: oscillator, filter, envelope, LFO, delay, mixer, sequencer, sampler, polysynth, MIDI
- Theme system (`lua/themes/`) — Catppuccin, Dracula, Nord, Gruvbox, Tokyo Night, One Dark, Solarized, Rosé Pine
- Text editor (`texteditor.lua`) — syntax-highlighted code editor with tooltips
- Code block renderer (`codeblock.lua`)
- Text input manager (`textinput.lua`)
- Text selection (`textselection.lua`)
- Slider interaction (`slider.lua`)
- On-screen keyboard (`osk.lua`)
- Context menu (`contextmenu.lua`)
- Drag and drop (`dragdrop.lua`, X11 hover detection)
- SQLite storage (`sqlite.lua`) — LuaJIT FFI bindings
- Document store (`docstore.lua`) — schema-free store over SQLite
- Spell checker (`spellcheck.lua`)
- Video player (`videoplayer.lua`) — FFmpeg transcoding pipeline
- HTTP client (`http.lua`) — async HTTP + local file fetch
- HTTP server (`httpserver.lua`) — static files + API routes
- WebSocket client/server (`websocket.lua`, `wsserver.lua`)
- Network utils (`network.lua`)
- Tor subprocess (`tor.lua`)
- SOCKS5 proxy (`socks5.lua`)
- Image cache (`images.lua`)
- Video cache + transcoding (`videos.lua`)
- Color utilities (`color.lua`)
- Animation engine (`animate.lua`)
- Focus manager (`focus.lua`)
- System monitor (`sysmon.lua`)
- Storage (`storage.lua`)
- Archive (`archive.lua`)
- Media (`media.lua`)
- Game canvas (`game.lua`, `lua/game/blackhole.lua`)
- JSON (`json.lua`)

### TypeScript Packages

| Package | Role |
|---------|------|
| `@reactjit/core` | Primitives (Box, Text, Image), components, hooks, animation, types |
| `@reactjit/native` | React reconciler host config, QuickJS bridge, event dispatcher |
| `@reactjit/web` | DOM overlay renderer |
| `@reactjit/grid` | Shared layout engine + render server for grid targets |
| `@reactjit/terminal` | Pure-JS terminal renderer (ANSI truecolor) |
| `@reactjit/cc` | ComputerCraft target (WebSocket, 16-color) |
| `@reactjit/nvim` | Neovim target (stdio, floating windows) |
| `@reactjit/hs` | Hammerspoon target (WebSocket, hs.canvas) |
| `@reactjit/awesome` | AwesomeWM target (stdio, Cairo) |
| `@reactjit/components` | Layout helpers (Card, Badge, FlexRow, etc.) |
| `@reactjit/router` | Client-side routing |
| `@reactjit/storage` | Cross-target storage adapters (Love2D files, SQLite, memory, web) |
| `@reactjit/ai` | AI provider hooks (OpenAI, Anthropic), MCP client |
| `@reactjit/apis` | Pre-built API clients (Spotify, GitHub, Weather, TMDB, Hue, etc.) |
| `@reactjit/rss` | RSS/Atom feed parser + OPML |
| `@reactjit/webhooks` | WebSocket/HTTP webhook hooks |
| `@reactjit/crypto` | Noble cryptography wrappers (hashes, ciphers, curves) |
| `@reactjit/server` | Server-side hooks |
| `@reactjit/audio` | Audio API types |
| `@reactjit/3d` | 3D scene types |
| `@reactjit/game` | Game canvas API |
| `@reactjit/theme` | Theme system types |
| `@reactjit/controls` | Control component types |

### Tooling

- `reactjit` CLI — `init`, `dev`, `build`, `build dist:<target>`, `lint`, `screenshot`, `update`
- Static layout linter (`cli/commands/lint.mjs`) — enforces fontSize, no-unicode-symbol-in-text, row-box width, root container sizing
- Headless screenshot capture
- `make cli-setup` / `make build` / `make dist-storybook` build pipeline
- Storybook — component catalog, playground templates, documentation system

### Examples

- `storybook/` — canonical reference implementation (component library + playground + docs)
- `examples/native-hud/` — Love2D game HUD
- `examples/playground/` — interactive playground
- `examples/terminal-demo/` — terminal dashboard
- `examples/cc-demo/` — ComputerCraft dashboard
- `examples/nvim-demo/` — Neovim floating window
- `examples/hs-demo/` — Hammerspoon desktop widget
- `examples/awesome-demo/` — AwesomeWM status bar
- `examples/neofetch/` — multi-target neofetch clone
- `examples/logo/`, `examples/weather/` — single-target demos
