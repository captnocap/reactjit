# SDL2 Parity Roadmap

Organized by root cause and dependency order. Each phase builds on the previous.
Observations from the 2026-02-22 side-by-side storybook audit are tagged `[#N]`
referencing the original report log at the bottom of this file.

**How to use this across context windows:** Start at Phase 0, work down. Check
boxes as you go. Each phase lists the files to touch and which audit observations
it resolves. When you pick up a new session, read this file first to see where
you left off.

---

## Phase 0: Crashes & Runtime Blockers ✅

Fix these first — they block basic SDL2 storybook usage.

- [x] **Tab navigation crash** `[#48]` — ~~Clicking Docs/Playground tabs crashes SDL2.~~ **FIXED** (commit `cbf99c8`). Root cause: all bridge commands (including `rpc:call`, `http:request`, `theme:set`) were passed directly to `tree.applyCommands()`. Added full command dispatch loop to `sdl2_init.lua` separating RPC/HTTP from tree mutations.
  - Files: `lua/sdl2_init.lua`

- [x] **SDL2 tick rate is ~half of Love2D** `[#34]` — ~~Timing loop mismatch.~~ **FIXED** (commit `cbf99c8`). Root cause: hardcoded `TARGET_MS / 1000` delta-time instead of measuring actual frame time, plus no vsync control. Added `SDL_GL_SetSwapInterval(1)`, real `frameDeltaMs` tracking with [1ms, 100ms] clamp, vsync-first frame cap.
  - Files: `lua/sdl2_init.lua`

- [x] **Capabilities bridge failure** `[#33]` — ~~Registration handshake failing.~~ **FIXED** (commit `cbf99c8`). Root cause: `capabilities.loadAll()` was called but RPC handlers from `capabilities.getHandlers()` were never registered. Added `rpcHandlers` table with capabilities, permit, audit, manifest, clipboard, and audio handlers.
  - Files: `lua/sdl2_init.lua`

---

## Phase 1: SDL2 Painter Foundations

The SDL2 painter (`sdl2_painter.lua`) is missing features that the Love2D painter
has. These are all in one file and fixing them resolves the largest cluster of
visual bugs. **This phase alone fixes ~15 audit observations.**

### 1a: Color & Theme ✅

- [x] **Use shared color.lua** `[#12, #24, #25]` — **FIXED** (commit `75c9463`). Replaced inline 7-color parser with `require("lua.color")` giving 148 CSS named colors + `rgb()`, `rgba()`, `hsl()`, `hsla()`, `transparent`.
  - Files: `lua/sdl2_painter.lua`

- [x] **Theme integration** `[#24]` — **FIXED** (commit `75c9463`). Added `Painter.setTheme(theme)` and themed default text color via `currentTheme.colors.text` with white fallback.
  - Files: `lua/sdl2_painter.lua`

### 1b: Text rendering (3/4)

- [x] **Text clipping / baseline offset** `[#2, #29]` — **FIXED** (commit `75c9463`). Root cause: `sdl2_measure.lua` approximated descent as 20% of line height. Added `Font.descent()` to `sdl2_font.lua` using real FreeType values; updated `sdl2_measure.lua` to use it.
  - Files: `lua/sdl2_measure.lua`, `lua/sdl2_font.lua`

- [x] **Text truncation (numberOfLines)** `[#5]` — **FIXED** (commit `75c9463`). Added `truncateWithEllipsis()` using binary search, `numberOfLines` resolution with parent inheritance, and `textOverflow` ellipsis support.
  - Files: `lua/sdl2_painter.lua`

- [x] **Text decorations** `[#6]` — **FIXED** (commit `75c9463`). Added underline (at baseline) and line-through (at 45% line height) using `GL.LINES`, with `textDecorationLine` parent inheritance.
  - Files: `lua/sdl2_painter.lua`

- [ ] **Text effects** `[#7]` — Full text-effects rendering path missing/disabled in SDL2. Blocked by Phase 7 (FBO/Canvas).
  - Files: `lua/sdl2_painter.lua`
  - Verify: Text story section 4 renders effects

### 1c: Box rendering ✅

- [x] **Per-corner borderRadius** `[#9]` — **FIXED** (commit `75c9463`). Added `resolveCornerRadii()`, `perCornerPoly()` arc vertex generation, `filledPerCornerRect()` (TRIANGLE_FAN), `strokedPerCornerRect()` (LINE_LOOP). Updated stencil clipping, background fill, and border stroke to use per-corner paths.
  - Files: `lua/sdl2_painter.lua`

- [x] **Per-side borders** `[#10]` — **FIXED** (commit `75c9463`). Added full per-side border resolution (`borderTopWidth` etc.) with per-side colors (`borderTopColor` etc.). Uniform fast path for stroked rect; per-side path draws individual `GL.LINES` inset by half border width.
  - Files: `lua/sdl2_painter.lua`

- [x] **Arc and polygon rendering** `[#18 partial]` — **FIXED** (commit `75c9463`). Added `drawArcSector()` (solid TRIANGLE_FAN + annular TRIANGLE_STRIP for donuts) and `drawPolygon()` (centroid-based TRIANGLE_FAN). Background rendering checks `arcShape`/`polygonPoints` before rounded rect fallback.
  - Files: `lua/sdl2_painter.lua`

---

## Phase 2: Font System

- [ ] **Custom fonts / fontFamily** `[#1]` — `sdl2_font.lua` loads one font. No fontFamily/fontWeight switching. Love2D text appears bolder because it uses different rasterization.
  - Files: `lua/sdl2_font.lua`, `lua/sdl2_measure.lua`
  - Verify: Multiple font weights render; navigation panel text weight matches Love2D

- [ ] **fontWeight / bold** — Flag is parsed but ignored. Needs font variant loading.
  - Files: `lua/sdl2_font.lua`
  - Verify: Bold text renders bold

---

## Phase 3: Hover & Tooltip System (partial)

- [~] **Hover tooltips** `[#3, #4]` — **PARTIALLY FIXED** (commit `cbf99c8`). Hover events (`pointerEnter`/`pointerLeave`) from `events.updateHover()` are now captured and pushed to the bridge. Previously the return value was discarded. Tooltip rendering may still need additional work.
  - Files: `lua/sdl2_init.lua` (event dispatch)
  - Verify: Box story and Text story tooltips appear on hover

---

## Phase 4: Widget Draw Abstraction

All Lua-owned widgets (`slider.lua`, `fader.lua`, `knob.lua`, `switch.lua`,
`checkbox.lua`, `radio.lua`, `select.lua`, `textinput.lua`, `texteditor.lua`,
`codeblock.lua`) call `love.graphics.*` directly for rendering. They need to
either: (a) route through the target painter abstraction, or (b) have SDL2-specific
draw paths.

**This phase fixes all input/control story failures.**

- [x] **Port widget drawing to target-agnostic API** `[#13, #23, #31, #44]` — **FIXED** (commits `1598c97`–`d8fcc08`). All 7 core widgets now work on SDL2. `slider.lua` and `switch.lua` were already compatible (no text measurement). `fader.lua`, `knob.lua`, `checkbox.lua`, `radio.lua`, `select.lua` each received a `getFontHandle()` helper using injected Measure module with Love2D `newFont()` fallback, replacing `love.graphics.getFont()` which the SDL2 shim doesn't provide.
  - Files: `lua/fader.lua`, `lua/knob.lua`, `lua/checkbox.lua`, `lua/radio.lua`, `lua/select.lua`

- [x] **Port TextInput** `[#31]` — **FIXED** (commit `7852063`). Added shim functions (getScissor, intersectScissor, transformPoint, getFont), TextInput dispatch in sdl2_painter, focus/keyboard/mouse event routing in sdl2_init, blink timer, and change event draining. Hardened getFont fallback in textinput.lua.
  - Files: `lua/sdl2_love_shim.lua`, `lua/sdl2_painter.lua`, `lua/sdl2_init.lua`, `lua/textinput.lua`

- [x] **Port TextEditor** — **FIXED** (commit `27dd617`). Added TextEditor dispatch in sdl2_painter, full event routing in sdl2_init (keyboard, text input, mouse press/release/move, wheel scroll, blink timer). Added `love.graphics.printf` to shim. Hardened getFont fallback.
  - Files: `lua/sdl2_painter.lua`, `lua/sdl2_init.lua`, `lua/sdl2_love_shim.lua`, `lua/texteditor.lua`

- [x] **Port CodeBlock** — **FIXED** (commit `27dd617`). Added CodeBlock dispatch in sdl2_painter, mouse press routing (copy button) in sdl2_init. All required shim functions already existed.
  - Files: `lua/sdl2_painter.lua`, `lua/sdl2_init.lua`

- [x] **Add all widget dispatch to SDL2 painter** — **FIXED** (commit `27dd617`). SDL2 painter now dispatches to ALL 10 Lua-owned widget types: Slider, Fader, Knob, Switch, Checkbox, Radio, Select, TextInput, TextEditor, CodeBlock. Previously only View/box and Text were rendered — all other widget nodes were invisible.
  - Files: `lua/sdl2_painter.lua`

- [x] **Port devtools/inspector/console overlays** `[#47]` — **FIXED** (commit `96fdb3d`). All overlay modules now use `love.graphics.*` which routes through the SDL2 shim. Devtools (F12) was already working. Added F9 (theme menu), F10 (settings), F11 (system panel) key handlers, text input routing, mouse press/release/move routing, wheel event routing, and overlay drawing after devtools.
  - Files: `lua/sdl2_init.lua`, `lua/sdl2_love_shim.lua`

- [x] **Port context menu** — **FIXED** (commit `96fdb3d`). Right-click context menu wired: button 3 opens menu, mouse press/release routing, keyboard dismiss. Drawing after other overlays.
  - Files: `lua/sdl2_init.lua`

- [ ] **Port on-screen keyboard** — Gamepad OSK rendering.
  - Files: `lua/osk.lua`

---

## Phase 5: Images

- [x] **stb_image FFI for SDL2** — **FIXED** (commit `7a4f61c`). Added `lua/sdl2_images.lua` using stb_image FFI for image loading, GL texture upload, and draw. Wired into `target_sdl2.lua`.
  - Files: `lua/sdl2_images.lua`, `lua/target_sdl2.lua`
  - Verify: Any story with images shows them; Media Library Gallery tab works `[#22]`; Poly Pizza content renders `[#43]`

---

## Phase 6: SDL2 Runtime Capabilities

Non-rendering capabilities that Love2D provides and SDL2 needs equivalents for.

- [x] **Clipboard** — **FIXED** (commit `cbf99c8`). Added `SDL_GetClipboardText`, `SDL_SetClipboardText`, `SDL_HasClipboardText`, `SDL_free` FFI declarations. Registered `clipboard:read` and `clipboard:write` RPC handlers. Added `love.system` shim to `sdl2_love_shim.lua` with `getClipboardText()`, `setClipboardText()`, `getOS()`.
  - Files: `lua/sdl2_init.lua`, `lua/sdl2_love_shim.lua`

- [~] **Filesystem** — **PARTIALLY FIXED** (commit `bd88803`). Added `love.filesystem` stubs to SDL2 shim (read/write/createDirectory using plain Lua IO with `.save/` directory). Settings and system panel persistence now work. Full `love.filesystem` API (enumerate, append, etc.) still incomplete.
  - Files: `lua/sdl2_love_shim.lua`
  - Verify: Settings persist between sessions; Local Store, SQLite stories work in SDL2

- [~] **HTTP / networking** `[#20]` — **PARTIALLY FIXED** (commit `cbf99c8`). Command dispatch now routes `http:request` and `http:stream` commands to the HTTP module with graceful fallback. HTTP response polling added to frame loop. However, the HTTP worker module itself (`http.lua`) uses `love.thread` which doesn't exist on SDL2 — the actual HTTP requests may still fail. Needs pthreads or luasocket alternative for the worker.
  - Files: `lua/sdl2_init.lua` (dispatch wired), `lua/http.lua` (worker still Love2D-only)
  - Verify: Networking story: fetch, websockets, tor work in SDL2

- [ ] **Crypto** `[#21]` — Love2D passes all crypto sections; SDL2 fails every one. Likely FFI path resolution without `love.filesystem`.
  - Files: `lua/crypto.lua`
  - Verify: Crypto story passes all sections in SDL2

- [x] **Drag and drop** `[#38]` — **FIXED**. Added `SDL2_DropEvent` FFI struct, `SDL_DROPFILE`/`SDL_DROPTEXT`/`SDL_DROPBEGIN`/`SDL_DROPCOMPLETE` event handling in the SDL2 event pump. File drops hit-test at cursor position, read file metadata (size, extension, preview text for text files), and dispatch `filedrop`/`directorydrop` events through the bridge. Directory detection via POSIX `/. ` probe. Updated `dragdrop.lua` to accept an explicit SDL2 library handle (required since SDL2 target loads via `ffi.load` not `ffi.C`). X11/XDnD drag-hover detection (enter/leave events) wired into per-frame update loop. Cleanup on exit.
  - Files: `lua/sdl2_init.lua`, `lua/dragdrop.lua`
  - Verify: File drop works in SDL2 (NES emulator test)

- [ ] **Screenshot capture** — `love.graphics.captureScreenshot` alternative using GL readback.
  - Files: New `lua/sdl2_screenshot.lua`
  - Verify: `reactjit screenshot` works from SDL2 target

---

## Phase 7: FBO / Canvas (The Big Unlock)

`love.graphics.newCanvas` equivalent using OpenGL framebuffer objects. This is one
implementation that unblocks five entire feature categories.

- [x] **Implement FBO wrapper** — **FIXED**. Created `sdl2_canvas.lua` with Canvas object (FBO + RGBA texture + lazy depth renderbuffer). Wired into `sdl2_love_shim.lua` as `love.graphics.newCanvas/setCanvas/getCanvas/draw/clear/setDepthMode/setBlendMode/setShader`. Existing shared modules can now create and render to off-screen surfaces.
  - Files: `lua/sdl2_canvas.lua`, `lua/sdl2_love_shim.lua`

Once FBO exists, these all unblock:

- [ ] **Effects system** `[#27]` — All 23 generative effects need Canvas + `love.math.noise`
  - Files: `lua/effects.lua`, `lua/effects/*.lua`

- [ ] **Scene3D** `[#39]` — Needs Canvas, shaders, mesh API
  - Files: `lua/scene3d.lua`, `lua/g3d/`

- [ ] **Map2D** `[#40]` — Needs Canvas, shaders, `love.math.triangulate`
  - Files: `lua/map.lua`, `lua/tilecache.lua`

- [x] **Video playback** — **FIXED** (commit `cd277ce`). Created `sdl2_videos.lua` (libmpv + dual-FBO pipeline, GL state save/restore, pixel store protection) and `sdl2_videoplayer.lua` (full controls UI in GL immediate mode). Wired into `sdl2_init.lua` with lifecycle management and mouse/keyboard input routing. `sdl2_painter.lua` renders Video and VideoPlayer nodes.
  - Files: `lua/sdl2_videos.lua`, `lua/sdl2_videoplayer.lua`, `lua/sdl2_painter.lua`, `lua/sdl2_init.lua`, `lua/target_sdl2.lua`

- [ ] **Games / Emulator** `[#38]` — Need Canvas for game surface
  - Files: `lua/game.lua`, `lua/emulator.lua`

---

## Phase 8: Advanced Features

Lower priority items that round out full parity.

- [ ] **Audio engine** — `love.audio.newQueueableSource` + `love.sound.newSoundData` alternatives. SDL2 has SDL_mixer or miniaudio.
  - Files: `lua/audio/engine.lua`, `lua/capabilities/audio.lua`
  - Verify: Audio Rack story works `[#41]`

- [ ] **Gamepad support** — SDL2 has `SDL_GameController`. Wire up joystick/gamepad events.
  - Files: `lua/sdl2_init.lua`

- [ ] **printf in shim** — Aligned text using Font.measureWidth + draw offset. Used by inspector/console/devtools.
  - Files: `lua/sdl2_love_shim.lua`

- [ ] **Diagonal gradients** — Only horizontal/vertical work (no mesh API equivalent yet).
  - Files: `lua/sdl2_painter.lua`

- [ ] **Scrollbar indicators** — Visual scrollbar overlays missing in SDL2.
  - Files: `lua/sdl2_painter.lua`

---

## Separate: Story Bugs (not SDL2 parity)

These are broken on both renderers or are story-level authoring issues.

- [x] **DataStory Section children** `[#18]` — `Section` component accepted children but never rendered them. **FIXED** (commit `75a6cb5`).

- [x] **Navigation story section structure** `[#16]` — **FIXED** (commit `04be0a2`). Restructured into 5 numbered sections: NavPanel, Tabs, Breadcrumbs, Toolbar, Combined Layout. Standard Section pattern, scroll wrapper, maxWidth 760.

- [ ] **Navigation story SDL2 render failure** `[#17]` — Entire story doesn't render in SDL2. May be resolved by Phase 0 tab crash fix — needs verification.

- [x] **Networking story needs sections** `[#19]` — **FIXED** (commit `c03b757`). Removed tab-selector pattern. All 6 capabilities now visible as standalone sections: Fetch, WebSocket, REST APIs, RSS, Webhooks, Tor.

- [x] **Theme System page overflow** `[#26]` — **FIXED** (commit `76cd10a`). Replaced ScrollView with `overflow: 'scroll'` Box. Constrained ThemeCard to `maxWidth: 360`, removed `flexGrow`/`flexBasis`/`flexShrink` causing X overflow. Replaced hardcoded `rgba()` with theme tokens.

- [x] **Local Store needs sections** `[#30]` — **FIXED** (commit `12ffc32`). Added numbered sections with standard Section pattern: Persistent Counter, Text Memory, Persistent Toggle, Manage Store.

- [x] **Local Store scroll container** `[#32]` — **FIXED** (commit `12ffc32`). Added `overflow: 'scroll'` to root wrapper with `height: '100%'`.

- [x] **Effects story toggle copy** `[#28]` — **FIXED** (commit `db7c33a`). Renamed: Normal→Static, Infinite→Tiling, Reactive→Cursor. Updated all corresponding content labels.

- [ ] **Capabilities story sparse layout** `[#35]` — Needs visual/content-density improvement.

- [ ] **Games story removal** `[#37]` — Story should be removed from storybook.

- [ ] **Layout story spring animation** `[#8]` — Missing 80px container + choppy spring motion. Needs investigation on both renderers.

- [ ] **Style story section 1 clipping** `[#9 partial]` — Content clipping observed on both renderers. Layout bounds issue.

- [ ] **Demos story content binding** `[#36]` — "Choose a demo" doesn't show content in SDL2. May be a Select widget dependency (Phase 4).

- [ ] **Stress Test Hub select** `[#44]` — Same Select widget gap as Demos. Resolves with Phase 4.

- [ ] **Audio Rack load performance** `[#41]` — SDL2 takes seconds to open vs instant on Love2D. Startup bottleneck investigation.

---

## Separate: Love2D-Side Issues

These are bugs in Love2D, not SDL2 parity gaps.

- [ ] **Badge "footballs"** `[#11]` — Love2D badges render as footballs; SDL2 is correct. Love2D corner rasterization bug.

- [ ] **Input horizontal clip** `[#14]` — Love2D clips horizontal content that shouldn't clip.

- [ ] **TSL binds not rendering** `[#45]` — Effect visible in SDL2 but not Love2D. Love2D-side bind execution failure.

- [ ] **Multi-window crash** `[#46]` — Love2D crashes; SDL2 works great. Love2D multi-window path instability.

---

## Phase Resolution Map

Which phases fix which audit observations. ✅ = fully done, 🔶 = partially done.

| Phase | Resolves | Count | Status |
|-------|----------|-------|--------|
| 0 | #33, #34, #48 | 3 | ✅ All 3 fixed |
| 1a | #12, #24, #25 | 3 | ✅ All 3 fixed |
| 1b | #2, #5, #6, #29 done; #7 blocked | 5 | 🔶 4/5 fixed (#7 needs FBO) |
| 1c | #9 (partial), #10, #18 (partial) | 3 | ✅ All 3 fixed |
| 2 | #1 | 1 | Not started |
| 3 | #3, #4 | 2 | 🔶 Hover events wired; tooltip render unverified |
| 4 | #13, #23, #31, #44 done; #47 remains | 5 | 🔶 4/5 fixed (devtools remain) |
| 5 | #22, #43 | 2 | Not started |
| 6 | clipboard done; #20 partial; #38 done; #21 remain | 3 | 🔶 2.5/3 |
| 7 | #27, #38, #39, #40 | 4 | Not started |
| 8 | #41 | 1 | Not started |
| Story bugs | #16, #19, #26, #28, #30, #32 done; #8, #17, #35, #36, #37 remain | 11 | 🔶 6/11 fixed |
| Love2D bugs | #11, #14, #45, #46 | 4 | Not started |
| **Already fixed** | **#18** | **1** | ✅ |
| Deferred | #15, #42 | 2 | — |

**Overall progress:** ~22 of 48 observations resolved or partially resolved. Phases 0, 1a, 1c fully complete. Core rendering pipeline (color, theme, text, borders, arcs) is solid. The biggest remaining blocker is Phase 7 (FBO/Canvas) which gates effects, 3D, maps, video, and games.

---

## Original Audit Log (2026-02-22)

Raw observations from the side-by-side storybook comparison session. Each entry
is referenced by `[#N]` throughout the roadmap above.

| # | Story / Screen | Observation | Technical Clue | Priority |
|---|----------------|-------------|----------------|----------|
| 1 | Nav panel text | Love2D bolder; SDL2 regular weight | Font weight/rasterization mismatch | P2 |
| 2 | Top tabs | SDL2 text clips bottom 10-20% | Line-height/baseline offset mismatch | P1 |
| 3 | Box story tooltips | No tooltips in SDL2 | Hover pipeline incomplete | P1 |
| 4 | Text story tooltips | Same as #3 | Shared root cause | P1 |
| 5 | Text numberOfLines | SDL2 off-by-one + no overflow clip | Wrap count + draw pass mismatch | P1 |
| 6 | Text decorations | SDL2 missing underline/line-through | Decoration pass unimplemented | P2 |
| 7 | Text effects | SDL2 renders nothing | Effects path missing | P1 |
| 8 | Layout spring | Missing 80px container + choppy motion | Layout omission + timestep mismatch | P1 |
| 9 | Style section 1 | Both clip; SDL2 missing borderRadius | Shared clip bug + SDL2 radius gap | P1+P2 |
| 10 | Style per-side borders | SDL2 no per-side colors | Per-edge draw path missing | P1 |
| 11 | Composition badges | Love2D "footballs"; SDL2 correct | Love2D corner rasterization bug | P2 |
| 12 | Composition text color | SDL2 text color wrong | Style inheritance/theme divergence | P2 |
| 13 | Input sections 2-11 | SDL2 renders nothing | Widget draw not ported | P1 |
| 14 | Input section 3 Love2D | Horizontal clip shouldn't clip | Love2D overflow bug | P2 |
| 15 | Input section 5 | Unclear behavior | Defer | P3 |
| 16 | Navigation section 1 | Wrong content on both | Story composition issue | P1 |
| 17 | Navigation SDL2 | Entire story fails | SDL2 render bailout | P1 |
| 18 | Data story both | No charts render | ~~Section discards children~~ **FIXED** | ~~P1~~ |
| 19 | Networking structure | Needs sections not nav | Story architecture | P1 |
| 20 | Networking features | SDL2 only webhooks works | Networking capability gaps | P1 |
| 21 | Crypto | SDL2 fails all sections | Module/FFI path gap | P1 |
| 22 | Media Library gallery | SDL2 no gallery content | Tab content/image gap | P1 |
| 23 | Controls knob/fader | SDL2 missing knob+fader render | Widget draw not ported | P1 |
| 24 | Theme badges | SDL2 ignores active theme | Theme token propagation gap | P1 |
| 25 | Theme swatches | SDL2 white border + aliasing | Rect/border draw artifacts | P2 |
| 26 | Theme page layout | X+Y overflow, only Y scroll | Container sizing issue | P1 |
| 27 | Effects SDL2 | Nothing renders | Canvas/FBO missing | P1 |
| 28 | Effects toggle copy | "What is infinite?" unclear | UX copy issue | P3 |
| 29 | Local Store text | SDL2 text clipping | Same root as #2 | P1 |
| 30 | Local Store structure | Needs numbered sections | Story architecture | P2 |
| 31 | Local Store text memory | SDL2 no TextInput | Widget draw not ported | P1 |
| 32 | Local Store overflow | Y overflow no scroll | Missing scroll container | P1 |
| 33 | Capabilities SDL2 | "bridge not connected" | Registration handshake failure | P1 |
| 34 | Tick rate | SDL2 ~half of Love2D | Frame timing mismatch | P1 |
| 35 | Capabilities canvas | Sparse/bare layout | Story polish needed | P3 |
| 36 | Demos SDL2 | No demo content shown | Select/binding gap | P1 |
| 37 | Games story | Should be removed | Content curation | P2 |
| 38 | NES emulator SDL2 | Doesn't work | Canvas or drag-drop gap | P1 |
| 39 | 3D Showcase SDL2 | Nothing renders | Canvas/shader/3D missing | P1 |
| 40 | Map SDL2 | UI renders, map doesn't | Canvas/shader gap | P1 |
| 41 | Audio Rack perf | SDL2 slow to open | Startup bottleneck | P1 |
| 42 | Audio Rack parity | Mostly matches otherwise | Known shared issues | P2 |
| 43 | Poly Pizza SDL2 | Only title renders | Content subtree failure | P1 |
| 44 | Stress Test select | SDL2 no select control | Widget draw not ported | P1 |
| 45 | TSL Binds | SDL2 works, Love2D doesn't | Love2D bind execution bug | P1 |
| 46 | Multi-window | SDL2 great, Love2D crashes | Love2D stability bug | P1 |
| 47 | Error Test SDL2 | No devtools error panel | Overlay integration missing | P1 |
| 48 | Tab navigation SDL2 | Docs/Playground crashes app | Route transition crash | P1 |
