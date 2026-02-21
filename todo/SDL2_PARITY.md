# SDL2 Feature Parity Audit

What's handled by Love2D that needs fixing/porting for the SDL2 target.

## Tier 1: Critical (basic UI is broken without these)

| Gap | What's Missing | Love2D Module | Notes |
|-----|---------------|---------------|-------|
| **Images** | No `<Image>` support at all | `images.lua` | `target_sdl2.lua` has `images = nil` with a TODO for stb_image FFI. Every image is invisible. |
| **Custom fonts** | Only one system font loads | `measure.lua` | `sdl2_font.lua` calls `ft_load_font` once. No fontFamily/fontWeight switching. |
| **Color parsing** | Only 7 named colors, no `rgb()`/`hsl()` | `color.lua` | `sdl2_painter.lua` has its own inline parser instead of using the shared `color.lua` module (148 CSS colors, rgb, hsl). Easy fix — just require it. |

## Tier 2: Important (needed for real apps)

| Gap | What's Missing | Love2D Module |
|-----|---------------|---------------|
| **TextInput** | No text input component | `textinput.lua` |
| **TextEditor** | No multi-line text editing | `texteditor.lua` |
| **CodeBlock** | No code block rendering | `codeblock.lua` |
| **Form controls** | No Slider, Switch, Checkbox, Radio, Select | `slider.lua`, `switch.lua`, etc. |
| **Clipboard** | No copy/paste | `love.system.setClipboardText` — SDL2 has `SDL_SetClipboardText`, just needs wiring |
| **Filesystem** | No `love.filesystem.*` equivalent | Used by storage, sqlite, manifest, config, bundle loading |
| **HTTP / fetch** | Uses `love.thread` for worker threads | `http.lua`, `browse.lua` — need pthreads or luasocket alternative |
| **Audio** | No audio playback | `capabilities/audio.lua` — SDL2 has SDL_mixer or miniaudio as options |
| **Per-corner borderRadius** | Only uniform radius works | `painter.lua` supports `borderTopLeftRadius` etc. |
| **Per-side borders** | Only uniform borderWidth/Color | `painter.lua` supports per-side |
| **fontWeight / bold** | Flag parsed but ignored | `sdl2_font.lua` loads one font only |
| **Text truncation** | No `numberOfLines` or `textOverflow: "ellipsis"` | `painter.lua` handles this |
| **Theme integration** | Hardcoded white text default | `painter.lua` reads from theme system |
| **Screenshots** | No headless capture | `screenshot.lua` uses `love.graphics.captureScreenshot` |

## Tier 3: Nice to Have (advanced features)

| Gap | What's Missing |
|-----|---------------|
| **Videos** | `videos.lua` is deeply Love2D — uses libmpv + Love2D Canvas for FBO pipeline |
| **Off-screen Canvas** | No `love.graphics.newCanvas` equivalent — blocks effects, video, 3D, maps, games |
| **Effects system** | All 23 generative effects need Canvas + `love.math.noise` |
| **Scene3D** | Needs Canvas, shaders, mesh API — full GL expansion |
| **Map2D** | Needs Canvas, shaders, `love.math.triangulate` |
| **Games / Emulator** | Need Canvas |
| **Gamepad** | No `love.joystick.*` — SDL2 has `SDL_GameController`, just needs wiring |
| **Diagonal gradients** | Only horizontal/vertical (no mesh API) |
| **Text decorations** | No underline, line-through, text shadow |
| **Scrollbar indicators** | Visual scrollbar overlays missing |
| **On-screen keyboard** | `osk.lua` not ported |
| **Context menu** | `contextmenu.lua` not ported |
| **Drag and drop** | `dragdrop.lua` uses `love.window.*` — SDL2 has `SDL_DropEvent` |

## The Shim (`sdl2_love_shim.lua`)

### Covered (enough for devtools/inspector/console to load)

- `love.graphics`: setColor, rectangle, circle, line, print, newFont, push/pop, translate, setScissor, getDimensions
- `love.mouse`: getPosition, getX/Y
- `love.keyboard`: isDown
- `love.timer`: getTime

### NOT Covered (major gaps)

- `love.graphics.printf` — aligned text (used everywhere)
- `love.graphics.draw` — images, canvases, meshes
- `love.graphics.newCanvas/setCanvas` — off-screen rendering
- `love.graphics.newMesh` — gradients (Love2D painter path)
- `love.graphics.rotate/scale/shear` — CSS transforms in shim path
- `love.graphics.getColor` — reading current color
- `love.filesystem.*` — all file I/O
- `love.audio.*` — all audio
- `love.system.*` — clipboard, OS detection
- `love.thread.*` — worker threads
- `love.math.noise` — Perlin noise
- `love.image.*` — ImageData

## Quick Wins (fix in a day)

1. **Color parsing** — just `require("lua.color")` in sdl2_painter instead of the inline parser
2. **Clipboard** — SDL2 has `SDL_SetClipboardText`/`SDL_GetClipboardText`, add to shim
3. **Theme integration** — pass theme colors to sdl2_painter
4. **printf in shim** — implement aligned text using Font.measureWidth + draw offset
5. **Text truncation** — port the numberOfLines/ellipsis logic from painter.lua

## The Big Architecture Unlock: `love.graphics.newCanvas`

Canvas (FBO/off-screen rendering) is the single biggest blocker. It gates:

- All 23 effects
- Video playback
- Scene3D
- Map2D
- Games/Emulator

An SDL2 FBO implementation (`glGenFramebuffers`/`glBindFramebuffer`) would unblock all of these at once. OpenGL 2.1 supports framebuffer objects via the `GL_EXT_framebuffer_object` extension which is universally available.

## Module-by-Module Status

### Target-Agnostic (no Love2D deps, works on SDL2)

- `tree.lua`, `zindex.lua`, `focus.lua`, `debug_log.lua`, `syntax.lua`
- `capabilities.lua` (registry), `capabilities/timer.lua`, `capabilities/window.lua`
- `localstore.lua`, `docstore.lua`, `permit.lua`, `audit.lua`
- `sysmon.lua`, `socks5.lua`, `httpserver.lua`
- `themes/init.lua`, `effects/util.lua`
- `g3d/matrices.lua`, `g3d/vectors.lua`, `g3d/collisions.lua`
- `audio/module.lua`, `audio/graph.lua`, all `audio/modules/*.lua`

### Has SDL2 Equivalent (fully ported)

- `painter.lua` → `sdl2_painter.lua` (feature gaps listed above)
- `measure.lua` → `sdl2_measure.lua` (single font limitation)
- `init.lua` → `sdl2_init.lua` (separate run loop, not a port)
- `target_love2d.lua` → `target_sdl2.lua`

### Partially Works via Shim

- `events.lua` — only `love.keyboard.isDown` for modifiers
- `layout.lua` — only `love.graphics.getWidth/Height` fallback (fixed to use `Layout._viewportW/H`)
- `animate.lua` — only `love.timer.getTime` (shim covers it)
- `inspector.lua` — basic drawing works, missing printf/getColor
- `console.lua` — same as inspector
- `devtools.lua` — same as inspector
- `errors.lua` — basic overlay works
- `color.lua` — `love.graphics.setColor` (shim covers it)

### Not Ported (won't work on SDL2)

- `images.lua` — needs stb_image FFI
- `videos.lua` — needs Canvas + libmpv GL pipeline
- `scene3d.lua` — needs Canvas, shaders, mesh
- `map.lua` — needs Canvas, shaders, triangulate
- `game.lua` + `game/*.lua` — needs Canvas
- `emulator.lua` — needs Canvas + ImageData
- `effects.lua` + all `effects/*.lua` — needs Canvas + noise
- `textinput.lua` — needs full graphics API port
- `texteditor.lua` — needs full graphics API port
- `codeblock.lua` — needs full graphics API + clipboard
- `videoplayer.lua` — needs video + full graphics API
- `slider.lua`, `fader.lua`, `knob.lua`, `switch.lua`, `checkbox.lua`, `radio.lua`, `select.lua` — need graphics API port
- `osk.lua`, `contextmenu.lua` — need graphics API port
- `textselection.lua` — needs clipboard + graphics
- `http.lua`, `browse.lua` — need `love.thread` alternative
- `storage.lua` — needs `love.filesystem` alternative
- `screenshot.lua` — needs `love.graphics.captureScreenshot` alternative
- `dragdrop.lua` — needs `love.window` alternative (SDL2 has SDL_DropEvent)
- `settings.lua`, `theme_menu.lua` — need full graphics API
- `wsserver.lua` — needs `love.data.hash`/`love.data.encode` (SHA1 + base64)
- `capabilities/audio.lua` — needs `love.audio` alternative
- `capabilities/llm_agent.lua` — mostly works, just needs `love.filesystem.getSource` alternative
- `sqlite.lua`, `crypto.lua`, `spellcheck.lua`, `manifest.lua`, `archive.lua` — core logic is FFI, just need path resolution without `love.filesystem`
- `tilecache.lua` — needs image loading
- `media.lua` — needs filesystem
- `audio/engine.lua` — needs `love.audio.newQueueableSource` + `love.sound.newSoundData`
