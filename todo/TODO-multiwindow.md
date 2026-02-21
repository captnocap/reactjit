# TODO: Multi-Window Communication — State Sync + Render Mirroring

## Vision

Two forms of multi-window, both experimental:

1. **State sync over WebSocket** — two (or more) Love2D windows running the same app, sharing state in real time. Each window runs its own React tree and rendering pipeline, but they see the same data. Like multiplayer but for the same application. One window changes state, all others reflect it instantly.

2. **Render proxy / mirror** — one Love2D window captures its rendered output and streams it to another window so both displays show the exact same pixels at the same time. One source of truth, N viewers. A live broadcast of the framebuffer.

These serve different purposes:
- State sync is for **collaborative use** — two people editing the same document, same dashboard on two monitors with different views, shared whiteboard
- Render mirror is for **display duplication** — presentation mode, streaming preview, kiosk displays, debug viewport on a second monitor

---

## Part 1: WebSocket state sync between app instances

### What already exists

The infrastructure for this is almost entirely built:

| Piece | Where | Status |
|-------|-------|--------|
| WebSocket server (pure Lua) | `lua/wsserver.lua` | Working — broadcast to all clients |
| WebSocket client (pure Lua) | `lua/websocket.lua` | Working — auto-reconnect |
| Network manager | `lua/network.lua` | Working — connection lifecycle |
| React hooks: `usePeerServer(port)` | `packages/shared/src/hooks.ts:267` | Working — host from React |
| React hooks: `useWebSocket(url)` | `packages/shared/src/hooks.ts:304` | Working — connect from React |
| Bridge integration | `lua/init.lua:957-998` | Working — routes ws commands |
| Grid frame broadcast pattern | `packages/grid/src/RenderServer.ts` | Working — already broadcasts layout frames |

What's **missing** is a state synchronization layer that sits on top of WebSockets and handles:
- Conflict resolution (two windows edit the same field simultaneously)
- Initial state hydration (new window joins and gets current state)
- Delta compression (only send what changed, not the full state every time)
- Leader election (who is the source of truth?)

### Architecture: shared state bus

```
┌──────────────┐    WebSocket     ┌──────────────┐
│  Window A    │◄────────────────►│  Window B    │
│  (host)      │    state deltas  │  (client)    │
│              │                  │              │
│  React tree  │                  │  React tree  │
│  ↕ sync ↕    │                  │  ↕ sync ↕    │
│  SharedState │                  │  SharedState │
│  (leader)    │                  │  (follower)  │
└──────────────┘                  └──────────────┘
```

Window A starts a WebSocket server. Window B connects. State mutations in either window are broadcast to all peers. One window is the leader (resolves conflicts); others are followers (apply remote mutations, send local mutations to leader).

### API design

#### Lua side: minimal — just announce you're hostable

```lua
-- Host window (starts the sync server)
require("ilovereact").attach({
  sync: { host = true, port = 9900 }
})

-- Client window (connects to host)
require("ilovereact").attach({
  sync: { connect = "ws://localhost:9900" }
})
```

Or programmatically in an already-running app:

```lua
local ilr = require("ilovereact")
ilr.startSyncServer(9900)
-- or
ilr.connectSync("ws://localhost:9900")
```

#### React side: `useSyncState` hook

```tsx
import { useSyncState } from '@ilovereact/core';

function Counter() {
  // Like useState, but synchronized across all connected windows
  const [count, setCount] = useSyncState('counter', 0);

  return (
    <Pressable onPress={() => setCount(count + 1)}>
      <Text style={{ fontSize: 24, color: '#cdd6f4' }}>{count}</Text>
    </Pressable>
  );
}
```

`useSyncState(key, initialValue)`:
- Locally, works exactly like `useState`
- On mutation, broadcasts `{ key, value, timestamp, senderId }` to all peers
- On receiving a remote mutation, updates local state and triggers re-render
- On initial connection, hydrates from the leader's current state
- Key-based — only the specific keys that changed cause re-renders

#### `useSyncReducer` for complex state

```tsx
const [state, dispatch] = useSyncReducer('board', boardReducer, initialBoard);

// Dispatch is broadcast to all peers
dispatch({ type: 'MOVE_CARD', cardId: 'task-1', column: 'done' });
```

Actions are serializable and broadcast instead of derived state. Each window runs the reducer locally with the same actions, producing the same result (deterministic).

#### `useSyncPresence` for awareness

```tsx
const { peers, myId } = useSyncPresence({
  name: 'User A',
  cursor: { x: mouseX, y: mouseY },
  color: '#f38ba8',
});

// Show other users' cursors
{peers.map(peer => (
  <Box key={peer.id} style={{
    position: 'absolute',
    left: peer.cursor.x,
    top: peer.cursor.y,
  }}>
    <Text style={{ fontSize: 10, color: peer.color }}>{peer.name}</Text>
  </Box>
))}
```

Presence is high-frequency, low-priority state (cursor position, selection, typing indicators). Sent at a capped rate (10-20 Hz) with no persistence guarantees.

### Sync protocol

Messages over WebSocket are JSON:

```typescript
// State mutation
{ type: "state:set", key: "counter", value: 42, ts: 1708000000, sender: "a1b2" }

// Reducer action
{ type: "state:dispatch", key: "board", action: { type: "MOVE_CARD", ... }, ts: ..., sender: ... }

// Presence update
{ type: "presence", sender: "a1b2", data: { name: "User A", cursor: { x: 100, y: 200 } } }

// Hydration request (new peer joins)
{ type: "hydrate:request", sender: "c3d4" }

// Hydration response (leader sends full state)
{ type: "hydrate:response", state: { counter: 42, board: {...} }, ts: ... }

// Peer join/leave
{ type: "peer:join", id: "c3d4", name: "User C" }
{ type: "peer:leave", id: "a1b2" }
```

### Conflict resolution

Simple last-write-wins by timestamp for `useSyncState`. For `useSyncReducer`, actions are ordered by arrival at the leader — the leader rebroadcasts them in canonical order, and all peers apply in that order.

For more sophisticated needs (collaborative text editing, CRDT), that's a future extension. Start with LWW — it covers 90% of use cases.

### Implementation

#### New files

| File | Role |
|------|------|
| `packages/shared/src/sync.ts` | `useSyncState`, `useSyncReducer`, `useSyncPresence` hooks |
| `packages/shared/src/SyncProvider.tsx` | React context provider that manages WebSocket connection + state store |
| `lua/sync.lua` | Lua-side sync coordinator (wraps wsserver/websocket, handles hydration) |

#### Wire into existing infrastructure

The WebSocket plumbing already exists. We just need:

1. `lua/sync.lua` creates a wsserver on the configured port (or connects as client)
2. On state mutation in React, `useSyncState` calls `bridge.send('sync:set', { key, value })`
3. `lua/init.lua` routes `sync:*` commands to `lua/sync.lua`
4. `sync.lua` broadcasts to all peers via `wsserver:broadcast()`
5. Incoming peer messages are pushed as events: `bridge:pushEvent({ type = "sync:remote", ... })`
6. React `SyncProvider` listens for `sync:remote` events and updates the shared state store

---

## Part 2: SDL2 render proxy / framebuffer mirroring

This is the hard one. Love2D 11.x provides one window. We want the rendered output to appear in two places simultaneously.

### Approach A: Pixel streaming over WebSocket (most feasible)

Capture the framebuffer every frame, compress it, send it over WebSocket to a viewer window.

```
┌─────────────┐  framebuffer    ┌─────────────┐
│ Source       │  capture        │ Network     │
│ Love2D      │──────────►      │ encode +    │──── WebSocket ────►  Viewer
│ window      │  ImageData      │ compress    │     (raw pixels)     (Love2D or
│             │                 │             │                       browser)
└─────────────┘                 └─────────────┘
```

#### Capture mechanism

Love2D has `love.graphics.captureScreenshot(callback)` which gives you an `ImageData` at the end of the draw pass. But it's designed for one-shot use, not continuous streaming.

For continuous capture, we need one of:

**Option 1: Canvas render target + readback**
```lua
-- Render everything to a Canvas instead of the screen
local mirrorCanvas = love.graphics.newCanvas(w, h)

function love.draw()
  love.graphics.setCanvas(mirrorCanvas)
  love.graphics.clear()

  -- Draw game + React UI
  if originalDraw then originalDraw() end
  ReactLove.draw()

  love.graphics.setCanvas()  -- back to screen

  -- Draw the canvas to screen (what the user sees)
  love.graphics.draw(mirrorCanvas)

  -- Stream the canvas to viewers
  if streaming then
    local imageData = mirrorCanvas:newImageData()
    streamToViewers(imageData)
    -- imageData is automatically GC'd
  end
end
```

Problem: `Canvas:newImageData()` is a GPU→CPU readback — very expensive. At 800x600 that's 1.92MB of raw pixels per frame. At 60fps that's 115MB/s of uncompressed data.

**Option 2: Downscaled capture**
```lua
-- Render to a smaller canvas for streaming
local streamCanvas = love.graphics.newCanvas(w/2, h/2)

-- Every N frames, capture and stream
if tick % streamInterval == 0 then
  love.graphics.setCanvas(streamCanvas)
  love.graphics.draw(mirrorCanvas, 0, 0, 0, 0.5, 0.5)  -- half-res blit
  love.graphics.setCanvas()
  local imageData = streamCanvas:newImageData()
  streamToViewers(imageData)
end
```

Half resolution + every 2nd frame = ~15MB/s. Still a lot for WebSocket but manageable on localhost.

**Option 3: Delta compression**

Only send pixels that changed since the last frame. UI-heavy apps with static backgrounds would see massive compression ratios.

```lua
-- Compare current frame to last frame, send only changed regions
local changed = findChangedRegions(currentImageData, lastImageData)
for _, region in ipairs(changed) do
  streamRegion(region)  -- { x, y, w, h, pixels }
end
```

This is complex but dramatically reduces bandwidth.

**Option 4: Encode to JPEG/PNG per frame**

```lua
local imageData = mirrorCanvas:newImageData()
local fileData = imageData:encode("png")  -- or use a faster codec
streamToViewers(fileData:getString())
```

PNG encoding is slow. JPEG is faster but still significant CPU overhead per frame. Could target 10-15fps for a reasonable trade-off.

#### Viewer implementation

**Option A: Second Love2D window**

A separate Love2D process that connects via WebSocket and displays received frames:

```lua
-- viewer/main.lua
local ws = require("websocket")
local client
local displayImage

function love.load()
  client = ws.new("localhost", 9901, "/mirror")
  client.onmessage = function(self, data)
    local fileData = love.filesystem.newFileData(data, "frame.png")
    local imageData = love.image.newImageData(fileData)
    displayImage = love.graphics.newImage(imageData)
  end
end

function love.update(dt)
  client:update()
end

function love.draw()
  if displayImage then
    love.graphics.draw(displayImage, 0, 0)
  end
end
```

This is a dead-simple viewer. Launch it with `love viewer/` and it shows whatever the source window renders.

**Option B: Browser viewer**

Stream frames to a web page via WebSocket:

```html
<canvas id="mirror"></canvas>
<script>
  const ws = new WebSocket('ws://localhost:9901/mirror');
  const canvas = document.getElementById('mirror');
  const ctx = canvas.getContext('2d');

  ws.onmessage = async (event) => {
    const blob = new Blob([event.data], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    ctx.drawImage(bitmap, 0, 0);
  };
</script>
```

Opens in any browser. No Love2D needed on the viewer side.

### Approach B: SDL2 FFI second window (experimental, more elegant)

Create a second SDL2 window via FFI and blit the framebuffer to it. Both windows show the same pixels with no encoding/decoding overhead.

```
┌─────────────┐                ┌─────────────┐
│ Source       │  GL texture    │ Mirror      │
│ SDL2 Window │──── blit ────► │ SDL2 Window │
│ (primary)   │  shared ctx    │ (secondary) │
└─────────────┘                └─────────────┘
```

#### The SDL2 FFI approach

```lua
local ffi = require("ffi")

ffi.cdef[[
  typedef struct SDL_Window SDL_Window;
  typedef void* SDL_GLContext;

  SDL_Window* SDL_CreateWindow(const char* title, int x, int y, int w, int h, uint32_t flags);
  SDL_GLContext SDL_GL_CreateContext(SDL_Window* window);
  int SDL_GL_MakeCurrent(SDL_Window* window, SDL_GLContext context);
  void SDL_GL_SwapWindow(SDL_Window* window);
  void SDL_DestroyWindow(SDL_Window* window);

  // Window position constants
  enum { SDL_WINDOWPOS_UNDEFINED = 0x1FFF0000, SDL_WINDOWPOS_CENTERED = 0x2FFF0000 };
  // Window flags
  enum { SDL_WINDOW_OPENGL = 0x00000002, SDL_WINDOW_SHOWN = 0x00000004, SDL_WINDOW_RESIZABLE = 0x00000020 };
]]

local SDL = ffi.load("SDL2")
```

#### Creating a second window

```lua
local mirrorWin = SDL.SDL_CreateWindow(
  "iLoveReact Mirror",
  SDL.SDL_WINDOWPOS_CENTERED,
  SDL.SDL_WINDOWPOS_CENTERED,
  800, 600,
  bit.bor(SDL.SDL_WINDOW_OPENGL, SDL.SDL_WINDOW_SHOWN, SDL.SDL_WINDOW_RESIZABLE)
)
```

#### The GL context problem

This is the hard part. Love2D owns the OpenGL context. Creating a second window with a shared context requires:

1. Get Love2D's GL context (not exposed by the Love2D API — need to dig into internals or use `SDL_GL_GetCurrentContext()`)
2. Create the second window with `SDL_GL_SetAttribute(SDL_GL_SHARE_WITH_CURRENT_CONTEXT, 1)` before `SDL_GL_CreateContext()`
3. After rendering the main window, `SDL_GL_MakeCurrent(mirrorWin, sharedCtx)` and blit the framebuffer
4. `SDL_GL_SwapWindow(mirrorWin)` to present on the mirror
5. `SDL_GL_MakeCurrent(mainWin, mainCtx)` to restore for the next frame

```lua
ffi.cdef[[
  SDL_GLContext SDL_GL_GetCurrentContext(void);
  SDL_Window* SDL_GL_GetCurrentWindow(void);
  int SDL_GL_SetAttribute(int attr, int value);

  enum { SDL_GL_SHARE_WITH_CURRENT_CONTEXT = 6 };

  // GL functions for framebuffer blit
  void glBindFramebuffer(uint32_t target, uint32_t framebuffer);
  void glBlitFramebuffer(int srcX0, int srcY0, int srcX1, int srcY1,
                         int dstX0, int dstY0, int dstX1, int dstY1,
                         uint32_t mask, uint32_t filter);

  enum {
    GL_READ_FRAMEBUFFER = 0x8CA8,
    GL_DRAW_FRAMEBUFFER = 0x8CA9,
    GL_COLOR_BUFFER_BIT = 0x00004000,
    GL_NEAREST = 0x2600,
  };
]]
```

#### Frame blit sequence

```lua
function mirrorBlit()
  -- Save Love2D's current context
  local mainCtx = SDL.SDL_GL_GetCurrentContext()
  local mainWin = SDL.SDL_GL_GetCurrentWindow()

  -- Switch to mirror window (shared context means textures/FBOs are accessible)
  SDL.SDL_GL_MakeCurrent(mirrorWin, mainCtx)

  -- Blit the default framebuffer
  -- Source: FBO 0 (the main window's backbuffer) — BUT this is tricky
  -- because MakeCurrent changes which FBO 0 refers to.
  --
  -- Instead: render to a Canvas (FBO), then blit that Canvas to both windows.
  GL.glBindFramebuffer(GL.GL_READ_FRAMEBUFFER, mirrorFBO)
  GL.glBindFramebuffer(GL.GL_DRAW_FRAMEBUFFER, 0)
  GL.glBlitFramebuffer(0, 0, w, h, 0, 0, mirrorW, mirrorH,
                       GL.GL_COLOR_BUFFER_BIT, GL.GL_NEAREST)

  SDL.SDL_GL_SwapWindow(mirrorWin)

  -- Restore main window context
  SDL.SDL_GL_MakeCurrent(mainWin, mainCtx)
end
```

#### Challenges with Approach B

1. **Love2D doesn't expose its SDL_Window or GL context** — we need `SDL_GL_GetCurrentContext()` and `SDL_GL_GetCurrentWindow()` which are SDL2 globals, not Love2D APIs. This should work but is fragile.

2. **Shared GL context** — creating a second context that shares textures with the first requires setting `SDL_GL_SHARE_WITH_CURRENT_CONTEXT` *before* creating the second context. We need to create the mirror window early (in love.load or before).

3. **FBO 0 is window-specific** — the default framebuffer (0) refers to whichever window is current. We can't blit from Window A's FBO 0 while Window B is current. Solution: render to an intermediate Canvas (Love2D Canvas = GL FBO), then blit that FBO to both windows.

4. **Love2D Canvas as shared FBO** — modify the rendering pipeline to draw to a Canvas first, then draw that Canvas to the screen. The mirror window blits from the same Canvas.

```lua
-- Modified draw pipeline:
local sharedCanvas = love.graphics.newCanvas(w, h)

love.draw = function()
  -- Render everything to the shared canvas
  love.graphics.setCanvas(sharedCanvas)
  love.graphics.clear()
  originalDraw()
  ReactLove.draw()
  love.graphics.setCanvas()

  -- Draw to primary window
  love.graphics.draw(sharedCanvas)

  -- Blit to mirror window (if active)
  if mirrorWin then
    mirrorBlit(sharedCanvas)
  end
end
```

5. **SDL2 event handling** — the second window will generate SDL events (resize, close, focus). Love2D doesn't expect these. We need to filter or handle them in a custom `SDL_PollEvent` loop, or simply ignore them.

6. **Platform portability** — SDL2 FFI works on Linux. On macOS, the library is `libSDL2.dylib`. On Windows, `SDL2.dll`. Love2D bundles SDL2 but the shared library might not be loadable via FFI on all platforms. Linux is the most reliable target.

7. **Performance** — FBO blit is essentially free on the GPU (it's a texture copy within the GPU, no CPU roundtrip). This is orders of magnitude faster than Approach A's pixel streaming. On localhost with shared GPU memory, this should add <1ms per frame.

### Approach C: Hybrid — Canvas capture + shared memory (middle ground)

Render to a Canvas, write the raw pixel data to a shared memory segment (`/dev/shm/`), viewer reads from the same segment. No network overhead, no encoding, near-zero latency.

```lua
-- Source: write Canvas pixels to shared memory
local imageData = sharedCanvas:newImageData()
local ptr = imageData:getFFIPointer()  -- Love2D 11.4+
local size = w * h * 4  -- RGBA

local fd = ffi.C.open("/dev/shm/ilr-mirror", O_CREAT + O_RDWR, 0x1B6)
ffi.C.ftruncate(fd, size + 16)  -- 16 byte header (w, h, frame counter)
local mem = ffi.C.mmap(nil, size + 16, PROT_READ + PROT_WRITE, MAP_SHARED, fd, 0)
ffi.copy(mem + 16, ptr, size)
-- Write header: width, height, frame number
```

```lua
-- Viewer: read from shared memory
local mem = ffi.C.mmap(nil, size + 16, PROT_READ, MAP_SHARED, fd, 0)
local imageData = love.image.newImageData(w, h)
ffi.copy(imageData:getFFIPointer(), mem + 16, size)
displayImage = love.graphics.newImage(imageData)
```

This avoids WebSocket overhead and encoding but requires both processes on the same machine. Good for local development and presentation mode.

---

## Recommended implementation order

### Phase 1: WebSocket state sync (build on what exists)
1. **`useSyncState` hook** — synchronized useState over WebSocket
2. **`SyncProvider` context** — manages connection, state store, hydration
3. **`lua/sync.lua`** — Lua-side coordinator wrapping wsserver/websocket
4. **Demo: synchronized counter** — two windows, click in either, both update
5. **`useSyncPresence`** — cursor sharing, awareness
6. **Demo: collaborative whiteboard** — draw in either window, both see it

### Phase 2: Pixel streaming mirror (Approach A — works everywhere)
7. **Canvas render target** — modify draw pipeline to render to Canvas first
8. **Frame capture + encoding** — `Canvas:newImageData()` → compress
9. **WebSocket streaming** — broadcast encoded frames to viewers
10. **Love2D viewer** — minimal Love2D app that displays received frames
11. **Browser viewer** — HTML page with WebSocket + Canvas
12. **Rate limiting** — configurable FPS cap for mirror stream (15fps, 30fps, 60fps)
13. **Resolution scaling** — stream at half or quarter resolution for bandwidth

### Phase 3: SDL2 render proxy (Approach B — experimental, Linux)
14. **SDL2 FFI bindings** — window creation, GL context sharing, swap
15. **Shared Canvas pipeline** — render to Canvas, blit to both windows
16. **Mirror window lifecycle** — create, resize, close, handle events
17. **Performance profiling** — measure overhead of the blit path
18. **Fallback** — if shared context fails, fall back to Approach A

### Phase 4: Polish
19. **Auto-discovery** — apps on the same network find each other (mDNS or broadcast UDP)
20. **Authentication** — connection tokens so random processes can't connect
21. **Encryption** — optional TLS for WebSocket connections (already have crypto package)
22. **CLI integration** — `ilovereact mirror` to launch a viewer window for the running app
23. **Shared memory mirror** — Approach C for local zero-overhead mirroring

---

## API summary

### State sync

```tsx
// Host
<SyncProvider mode="host" port={9900}>
  <App />
</SyncProvider>

// Client
<SyncProvider mode="client" url="ws://localhost:9900">
  <App />
</SyncProvider>

// Hooks
const [value, setValue] = useSyncState('key', initial);
const [state, dispatch] = useSyncReducer('key', reducer, initial);
const { peers, myId } = useSyncPresence({ name, cursor, color });
```

### Render mirror

```lua
-- Source (in main.lua or via attach config)
require("ilovereact").attach({
  mirror = { enabled = true, port = 9901 }
})

-- Or start mirror at runtime
local ilr = require("ilovereact")
ilr.startMirror({ port = 9901, fps = 30, scale = 0.5 })
ilr.stopMirror()
```

```bash
# Launch a viewer from CLI
ilovereact mirror ws://localhost:9901

# Or open in browser
# http://localhost:9901/mirror.html  (served by the HTTP server)
```

---

## Use cases

| Scenario | Which approach | Why |
|----------|---------------|-----|
| Two users editing the same document | State sync | Each has their own view, shared state |
| Dashboard on two monitors | Render mirror | Same pixels, no interaction on mirror |
| Presentation mode (speaker + projector) | Render mirror | Projector shows exact same thing |
| Collaborative whiteboard | State sync + presence | Shared canvas, visible cursors |
| Remote pair programming (inspect someone's UI) | Render mirror over network | Stream the framebuffer |
| Multiplayer game prototype | State sync | Shared game state, each renders locally |
| Multi-monitor game HUD (main game + inventory on second screen) | State sync | Different React trees, same underlying data |
| QA testing (tester sees dev's screen) | Render mirror | Zero friction screen share |
| Digital signage (one source, N displays) | Render mirror | One app drives many screens |

---

## Files involved

| File | Role |
|------|------|
| New: `packages/shared/src/sync.ts` | `useSyncState`, `useSyncReducer`, `useSyncPresence` |
| New: `packages/shared/src/SyncProvider.tsx` | React context for sync connection |
| New: `lua/sync.lua` | Lua-side sync coordinator |
| New: `lua/mirror.lua` | Framebuffer capture + WebSocket streaming |
| New: `lua/sdl2_mirror.lua` | SDL2 FFI second window (experimental) |
| `lua/init.lua` | Route `sync:*` and `mirror:*` commands, Canvas render pipeline |
| `lua/wsserver.lua` | Already exists — broadcast infrastructure |
| `lua/websocket.lua` | Already exists — client connections |
| `lua/network.lua` | Already exists — connection management |
| `packages/shared/src/hooks.ts` | Extend with sync hooks, re-export from sync.ts |
| New: `examples/multiwindow-sync/` | Demo: synchronized counter + whiteboard |
| New: `examples/multiwindow-mirror/` | Demo: pixel-streamed mirror viewer |
| New: `tools/mirror-viewer/` | Standalone Love2D viewer app |
| New: `tools/mirror-viewer/index.html` | Browser-based viewer |
