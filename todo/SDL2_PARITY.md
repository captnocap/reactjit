# SDL2 Parity Roadmap

Organized by root cause and dependency order. Each phase builds on the previous.
Observations from the 2026-02-22 side-by-side storybook audit are tagged `[#N]`
referencing the original report log at the bottom of this file.

**How to use this across context windows:** Start at Phase 0, work down. Check
boxes as you go. Each phase lists the files to touch and which audit observations
it resolves. When you pick up a new session, read this file first to see where
you left off.

---

## Phase 0: Crashes & Runtime Blockers

Fix these first — they block basic SDL2 storybook usage.

- [ ] **Tab navigation crash** `[#48]` — Clicking Docs/Playground tabs crashes SDL2. Likely a nil access in a code path that assumes Love2D modules are loaded during panel init/route transition.
  - Files: `lua/sdl2_init.lua`, trace the crash
  - Verify: Click every top tab without crashing

- [ ] **SDL2 tick rate is ~half of Love2D** `[#34]` — Timing loop, delta-time scaling, or vsync/frame cap mismatch causing slower state progression across the board.
  - Files: `lua/sdl2_init.lua` (run loop / frame timing)
  - Verify: Side-by-side animation speed comparison

- [ ] **Capabilities bridge failure** `[#33]` — SDL2 shows "Capabilities not available (bridge not connected?)" immediately. Registration handshake failing at startup.
  - Files: `lua/sdl2_init.lua`, `lua/capabilities.lua`, bridge initialization path
  - Verify: Capabilities story loads and lists registered capabilities

---

## Phase 1: SDL2 Painter Foundations

The SDL2 painter (`sdl2_painter.lua`) is missing features that the Love2D painter
has. These are all in one file and fixing them resolves the largest cluster of
visual bugs. **This phase alone fixes ~15 audit observations.**

### 1a: Color & Theme (quick wins)

- [ ] **Use shared color.lua** `[#12, #24, #25]` — `sdl2_painter.lua` has its own inline color parser with only 7 named colors. Replace with `require("lua.color")` which has 148 CSS colors + rgb() + hsl().
  - Files: `lua/sdl2_painter.lua`
  - Verify: All theme colors render correctly, badge backgrounds match theme

- [ ] **Theme integration** `[#24]` — SDL2 painter uses hardcoded white text default. Wire up the theme system so `painter.setTheme()` works.
  - Files: `lua/sdl2_painter.lua`, `lua/target_sdl2.lua`
  - Verify: Theme switching (F9) changes colors in SDL2

### 1b: Text rendering

- [ ] **Text clipping / baseline offset** `[#2, #29]` — SDL2 tab text clips at bottom by 10-20%. Font metrics (ascent/descent/line-height) don't match between `sdl2_measure.lua` and draw position.
  - Files: `lua/sdl2_measure.lua`, `lua/sdl2_font.lua`, `lua/sdl2_painter.lua`
  - Verify: "Stories / Docs / Playground" tabs render without clipping; "persistent toggle" text in Local Store is fully visible

- [ ] **Text truncation (numberOfLines)** `[#5]` — SDL2 shows wrong line count and doesn't hide overflow text. Off-by-one in wrap count + missing clipping.
  - Files: `lua/sdl2_painter.lua` (text draw pass)
  - Verify: Text story section 2 matches Love2D line counts exactly

- [ ] **Text decorations** `[#6]` — Underline/line-through/strikethrough not implemented in SDL2 painter.
  - Files: `lua/sdl2_painter.lua`
  - Verify: Text story section 3 shows underline and line-through

- [ ] **Text effects** `[#7]` — Full text-effects rendering path missing/disabled in SDL2.
  - Files: `lua/sdl2_painter.lua`
  - Verify: Text story section 4 renders effects

### 1c: Box rendering

- [ ] **Per-corner borderRadius** `[#9]` — SDL2 only supports uniform radius. Love2D painter supports `borderTopLeftRadius` etc.
  - Files: `lua/sdl2_painter.lua`
  - Verify: Style story section 1 shows rounded corners

- [ ] **Per-side borders** `[#10]` — SDL2 applies uniform border color, skips per-edge draw. Love2D painter supports per-side color/width.
  - Files: `lua/sdl2_painter.lua`
  - Verify: Style story section 7 shows different border colors per side

- [ ] **Arc and polygon rendering** `[#18 partial]` — PieChart uses `arcShape`, RadarChart uses `polygonPoints`. Neither implemented in SDL2 painter.
  - Files: `lua/sdl2_painter.lua` (add `drawArcSector()` and `drawPolygon()`)
  - Verify: Data story shows pie chart and radar chart

---

## Phase 2: Font System

- [ ] **Custom fonts / fontFamily** `[#1]` — `sdl2_font.lua` loads one font. No fontFamily/fontWeight switching. Love2D text appears bolder because it uses different rasterization.
  - Files: `lua/sdl2_font.lua`, `lua/sdl2_measure.lua`
  - Verify: Multiple font weights render; navigation panel text weight matches Love2D

- [ ] **fontWeight / bold** — Flag is parsed but ignored. Needs font variant loading.
  - Files: `lua/sdl2_font.lua`
  - Verify: Bold text renders bold

---

## Phase 3: Hover & Tooltip System

- [ ] **Hover tooltips** `[#3, #4]` — Tooltips don't appear in SDL2. Hover interaction pipeline (pointer move/enter hit-testing, hover state updates, tooltip render trigger) incomplete.
  - Files: `lua/sdl2_init.lua` (event dispatch), `lua/events.lua` (hover tracking for SDL2 path)
  - Verify: Box story and Text story tooltips appear on hover

---

## Phase 4: Widget Draw Abstraction

All Lua-owned widgets (`slider.lua`, `fader.lua`, `knob.lua`, `switch.lua`,
`checkbox.lua`, `radio.lua`, `select.lua`, `textinput.lua`, `texteditor.lua`,
`codeblock.lua`) call `love.graphics.*` directly for rendering. They need to
either: (a) route through the target painter abstraction, or (b) have SDL2-specific
draw paths.

**This phase fixes all input/control story failures.**

- [ ] **Port widget drawing to target-agnostic API** `[#13, #23, #31, #44]` — Each widget's `draw()` method needs to work on both targets. Consider a shared draw helper module or painter method dispatch.
  - Files: `lua/slider.lua`, `lua/fader.lua`, `lua/knob.lua`, `lua/switch.lua`, `lua/checkbox.lua`, `lua/radio.lua`, `lua/select.lua`
  - Verify: Controls story renders all widgets in SDL2; Input story sections 2-5, 9-11 render

- [ ] **Port TextInput** `[#31]` — Needs full graphics API port for cursor, selection, text rendering.
  - Files: `lua/textinput.lua`
  - Verify: Local Store "text memory" section renders in SDL2

- [ ] **Port TextEditor** — Multi-line text editing with cursor, selection, scrolling.
  - Files: `lua/texteditor.lua`
  - Verify: TextEditor renders and accepts input in SDL2

- [ ] **Port CodeBlock** — Read-only code display with syntax highlighting and copy button.
  - Files: `lua/codeblock.lua`
  - Verify: CodeBlock renders in SDL2

- [ ] **Port devtools/inspector/console overlays** `[#47]` — These use `love.graphics.*` for their draw passes. Need SDL2 painter equivalents.
  - Files: `lua/inspector.lua`, `lua/console.lua`, `lua/devtools.lua`, `lua/errors.lua`
  - Verify: Error Test story shows devtools error panel in SDL2; F12 inspector works

- [ ] **Port context menu** — Right-click context menu rendering.
  - Files: `lua/contextmenu.lua`

- [ ] **Port on-screen keyboard** — Gamepad OSK rendering.
  - Files: `lua/osk.lua`

---

## Phase 5: Images

- [ ] **stb_image FFI for SDL2** — `target_sdl2.lua` has `images = nil` with a TODO. Every `<Image>` is invisible.
  - Files: `lua/target_sdl2.lua`, new `lua/sdl2_images.lua` (or extend existing)
  - Verify: Any story with images shows them; Media Library Gallery tab works `[#22]`; Poly Pizza content renders `[#43]`

---

## Phase 6: SDL2 Runtime Capabilities

Non-rendering capabilities that Love2D provides and SDL2 needs equivalents for.

- [ ] **Clipboard** — `SDL_SetClipboardText` / `SDL_GetClipboardText` FFI wiring.
  - Files: `lua/sdl2_init.lua` or new `lua/sdl2_clipboard.lua`

- [ ] **Filesystem** — `love.filesystem.*` alternative for SDL2. Used by storage, sqlite, manifest, config, bundle loading.
  - Files: New `lua/sdl2_filesystem.lua` or integrate into shim
  - Verify: Local Store, SQLite stories work in SDL2

- [ ] **HTTP / networking** `[#20]` — `http.lua` uses `love.thread` for workers. SDL2 needs pthreads or luasocket alternative.
  - Files: `lua/http.lua`, `lua/network.lua`
  - Verify: Networking story: fetch, websockets, tor work in SDL2

- [ ] **Crypto** `[#21]` — Love2D passes all crypto sections; SDL2 fails every one. Likely FFI path resolution without `love.filesystem`.
  - Files: `lua/crypto.lua`
  - Verify: Crypto story passes all sections in SDL2

- [ ] **Drag and drop** `[#38]` — SDL2 has `SDL_DropEvent`. Wire it up.
  - Files: `lua/sdl2_init.lua`, `lua/dragdrop.lua`
  - Verify: File drop works in SDL2 (NES emulator test)

- [ ] **Screenshot capture** — `love.graphics.captureScreenshot` alternative using GL readback.
  - Files: New `lua/sdl2_screenshot.lua`
  - Verify: `reactjit screenshot` works from SDL2 target

---

## Phase 7: FBO / Canvas (The Big Unlock)

`love.graphics.newCanvas` equivalent using OpenGL framebuffer objects. This is one
implementation that unblocks five entire feature categories.

- [ ] **Implement FBO wrapper** — `glGenFramebuffers` / `glBindFramebuffer` / `glFramebufferTexture2D`. OpenGL 2.1 `GL_EXT_framebuffer_object` is universally available.
  - Files: New `lua/sdl2_canvas.lua`, integrate into `lua/sdl2_gl.lua`

Once FBO exists, these all unblock:

- [ ] **Effects system** `[#27]` — All 23 generative effects need Canvas + `love.math.noise`
  - Files: `lua/effects.lua`, `lua/effects/*.lua`

- [ ] **Scene3D** `[#39]` — Needs Canvas, shaders, mesh API
  - Files: `lua/scene3d.lua`, `lua/g3d/`

- [ ] **Map2D** `[#40]` — Needs Canvas, shaders, `love.math.triangulate`
  - Files: `lua/map.lua`, `lua/tilecache.lua`

- [ ] **Video playback** — libmpv GL pipeline needs FBO for texture rendering
  - Files: `lua/videos.lua`, `lua/videoplayer.lua`

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

- [ ] **Navigation story section structure** `[#16]` — Shows "unified navigation story" instead of broken-out sections. Story composition issue, not renderer bug.

- [ ] **Navigation story SDL2 render failure** `[#17]` — Entire story doesn't render in SDL2. Separate from #16. Needs crash/bailout investigation.

- [ ] **Networking story needs sections** `[#19]` — Should use explicit numbered sections, not internal nav panel.

- [ ] **Theme System page overflow** `[#26]` — Overflows X and Y, only Y scroll. Needs layout rework.

- [ ] **Local Store needs sections** `[#30]` — Page should be sectioned with numbered sections.

- [ ] **Local Store scroll container** `[#32]` — Y overflow with no scroll container. Content inaccessible.

- [ ] **Effects story toggle copy** `[#28]` — "What is infinite?" label needs clarification.

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

Which phases fix which audit observations:

| Phase | Resolves | Count |
|-------|----------|-------|
| 0 | #33, #34, #48 | 3 |
| 1a | #12, #24, #25 | 3 |
| 1b | #2, #5, #6, #7, #29 | 5 |
| 1c | #9 (partial), #10, #18 (partial) | 3 |
| 2 | #1 | 1 |
| 3 | #3, #4 | 2 |
| 4 | #13, #23, #31, #44, #47 | 5 |
| 5 | #22, #43 | 2 |
| 6 | #20, #21, #38 | 3 |
| 7 | #27, #38, #39, #40 | 4 |
| 8 | #41 | 1 |
| Story bugs | #8, #16, #17, #19, #26, #28, #30, #32, #35, #36, #37 | 11 |
| Love2D bugs | #11, #14, #45, #46 | 4 |
| **Already fixed** | **#18** | **1** |
| Deferred | #15, #42 | 2 |

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
