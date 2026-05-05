# V8 Video surfaces

Last updated: 2026-05-04.

This document traces the `<Video>` / lowercase `<video>` pipeline end to end in
the V8 runtime. In this repository, video is a paint-side media surface backed
by libmpv. React declares a source path or URL; Zig owns mpv, frame decode,
texture upload, playback keys, cache lifetime, and file-drop replacement.

It is not browser video. There is no DOM media element, no `HTMLVideoElement`,
and no CSS media controls.

## Mental model

`<Video src="...">` creates a normal host node with a `videoSrc` prop. Each
frame:

1. `framework/videos.zig:update()` polls mpv render contexts for decoded frames.
2. New RGBA pixels upload to a wgpu texture.
3. `engine.zig` paints nodes with `node.video_src` by calling
   `videos.paintVideo`.
4. `paintVideo` lazy-loads the source if needed and queues the texture as an
   image quad through `gpu/images.zig`.

Video entries are keyed by source string. Up to eight videos can be loaded at
once. Entries not painted for roughly three seconds are destroyed.

## Public TSX surface

`runtime/primitives.tsx` exposes `Video`:

```tsx
import { Video } from '@reactjit/runtime/primitives';

<Video src="./media/sample.mp4" style={{ width: 640, height: 360 }} />

// Equivalent host prop, if you want to be explicit.
<Video videoSrc="./media/sample.mp4" style={{ width: '100%', height: '100%' }} />
```

The wrapper is intentionally image-shaped:

```ts
export const Video: any = ({ src, videoSrc, ...rest }: any) =>
  h('Image', { ...rest, videoSrc: videoSrc ?? src }, rest.children);
```

So the host type string is `"Image"`. The `videoSrc` prop is what routes the
node to `framework/videos.zig`.

Lowercase JSX also works because `runtime/jsx_shim.ts` maps intrinsic
`<video>` to the same primitive:

```tsx
<video src="./media/sample.mp4" />
```

Use `src` or `videoSrc`. Do not use `source` for video; `source` is decoded as
an ordinary image source. Do not use `video_src`; the V8 prop decoder accepts
camel-case `videoSrc`.

### Props

```ts
type VideoProps = {
  src?: string;
  videoSrc?: string;
  style?: Record<string, any>;
  children?: any;
};
```

Children are accepted by the React wrapper but are not laid out by the current
video layout branch. A video node fills its offered parent bounds and returns
from layout before visiting children.

There are no live V8 host props for playback control today. Old deadcode passes
props such as `paused`, `loop`, `volume`, `rate`, and `time`; those are not
decoded by `v8_app.zig`. The native module has helper functions for play/pause,
volume, mute, loop, seek, duration, and dimensions, but they are not exposed as
JS hooks or host props in the current V8 API.

## End-to-end pipeline

### 1. React to host mutation

`<Video>` emits an `"Image"` host node with a `videoSrc` prop. The generic V8
host pipeline handles it like other nodes:

1. `renderer/hostConfig.ts:createInstance` allocates a numeric host id.
2. Function props are stripped into the handler registry.
3. Clean props emit in `CREATE` or `UPDATE`.
4. `resetAfterCommit` schedules a microtask flush.
5. `flushToHost` sends coalesced JSON to `globalThis.__hostFlush`.

The lowercase `<video>` path goes through `runtime/jsx_shim.ts` first, then
lands on the same `Video` primitive wrapper.

### 2. V8 host prop decode

`v8_app.zig:applyProps` decodes the prop:

```zig
} else if (std.mem.eql(u8, k, "videoSrc")) {
    // Path or URL to a video. framework/videos.zig hooks the paint
    // pass and decodes lazily - no audio yet, just frames.
    if (dupJsonText(v)) |s| node.video_src = s;
}
```

`layout.Node` stores it as:

```zig
video_src: ?[]const u8 = null,
```

Important current quirk: `removePropKeys` resets `renderSrc`, `source`, and many
other props, but it does not reset `videoSrc`. Removing `videoSrc` from a
mounted node can leave the old `node.video_src` value in place. Replace the
source with another string or unmount/remount the node if you need to clear it.

### 3. Layout

`framework/layout.zig` gives video nodes the same layout behavior as render
surfaces:

```zig
if (node.video_src != null or node.render_src != null) {
    node.computed = .{
        .x = px,
        .y = py,
        .w = @min(pw, 8192),
        .h = @min(ph, 8192),
    };
    return;
}
```

The node fills the parent-offered bounds and clamps width/height to 8192 to
avoid exceeding GPU texture limits. Children are not laid out in this branch.

### 4. Engine integration

`framework/engine.zig` imports `videos.zig` when `HAS_VIDEO` is true. When the
ingredient is disabled, a stub module returns no-op behavior.

At startup:

```zig
videos.init();
defer videos.deinit();
```

`videos.init()` subscribes to the generic file-drop system. `deinit()` unloads
libmpv, destroys all entries, and releases the hidden OpenGL context if it was
created.

During the main loop, before paint:

```zig
// Video update - poll mpv for new frames before paint
videos.update();
```

During key handling, after focused text input gets first chance:

```zig
if (!input_consumed and !videos.handleKey(sym)) {
    selection.onKeyDown(...);
    ...
}
```

This makes video keyboard shortcuts process-global. The first ready video entry
gets the key, not a focused video node.

### 5. Paint

`engine.zig:paintNodeVisuals` paints video after background, image, border, and
animated border, and before render surfaces, effects, 3D, terminal, and text:

```zig
if (node.video_src) |src| {
    _ = videos.paintVideo(src, r.x, r.y, r.w, r.h, g_paint_opacity);
}
```

`paintVideo`:

1. Finds an existing entry by `src`, or calls `loadVideo(src)`.
2. Marks the entry active for the unload debounce.
3. Returns early until the entry is ready and has a texture bind group.
4. Clamps the container height to the visible window height.
5. Computes an aspect-ratio contain fit.
6. Queues the video texture with `images.queueQuad`.

Sizing is contain-fit inside the node rect. Unlike `Render` app embeds, video
does not stretch-fill; it preserves source aspect ratio and centers the result.

## Native video module

The implementation lives in `framework/videos.zig`.

### Library loading

libmpv is loaded lazily on first video use:

- Linux: `libmpv.so.2`, then `libmpv.so`
- macOS: `libmpv.2.dylib`, `libmpv.dylib`, Homebrew paths

The module uses `dlopen`/`dlsym` instead of a hard link. If libmpv is missing,
video playback degrades by returning false from load/paint paths and printing a
diagnostic. On Linux, `RTLD_DEEPBIND` is used to isolate mpv's internal Lua
symbols.

After libmpv loads, the module attempts to create a hidden SDL OpenGL window and
dedicated GL context for mpv. If that works, render mode is `.opengl`; otherwise
it falls back to mpv's software renderer.

### Entry lifecycle

Each source string gets a `VideoEntry`:

```zig
const VideoStatus = enum { loading, ready, @"error" };
const MAX_VIDEOS = 8;
const UNLOAD_DEBOUNCE_FRAMES = 180;
```

Status lifecycle:

```text
missing entry -> loading -> ready
                         -> error
```

`paintVideo` creates entries lazily. `update` resets every entry's `active` flag
after checking it, and `paintVideo` sets it again later in the frame. If an
entry is not painted for 180 update frames, `destroyEntry` releases mpv, GPU
objects, FBO resources, and the CPU pixel buffer.

### Loading a source

`loadVideo(src)`:

1. Ensures libmpv is loaded.
2. Rejects new entries after `MAX_VIDEOS`.
3. Creates one mpv handle per source.
4. Sets mpv options.
5. Initializes mpv.
6. Creates an mpv render context.
7. Validates local files, while allowing `http://` and `https://` URLs.
8. Runs `loadfile <src> replace`.
9. Stores the entry as `loading`.

Current mpv options:

| Option | Value |
| --- | --- |
| `vo` | `libmpv` |
| `hwdec` | `auto` for OpenGL mode, `no` for software mode |
| `load-scripts` | `no` |
| `ytdl` | `no` |
| `osd-level` | `0` |
| `sub` | `no` |
| `terminal` | `yes` |
| `msg-level` | `all=warn` |
| `keep-open` | `yes` |
| `idle` | `yes` |
| `input-default-bindings` | `no` |
| `input-vo-keyboard` | `no` |
| `pause` | `yes` |

Videos start paused. The first frame is still rendered once dimensions become
available so a paused video can display a poster-like initial frame.

### Render context creation

`createRenderContext` tries OpenGL first when the hidden GL context is
available:

- mpv API type: `"opengl"`
- init params: `MPV_RENDER_PARAM_OPENGL_INIT_PARAMS`
- proc lookup: `SDL_GL_GetProcAddress`

If OpenGL render-context creation fails, it tries software:

- mpv API type: `"sw"`

The selected mode is stored per entry. That matters because a process can have
global render mode `.opengl` while a specific entry falls back to `.software`.

## Frame update and upload

`videos.update()` does two phases for each loaded entry.

### Phase 1: initialize resources

For `loading` entries, it queries mpv dimensions:

- `video-params/w`
- `video-params/h`
- `video-params/dw`
- `video-params/dh`
- `width`
- `height`

The actual allocated texture size uses `video-params/w` and `video-params/h`.
`initVideoResources` then creates:

- a page-allocated RGBA CPU pixel buffer
- OpenGL private FBO and texture for `.opengl` mode
- wgpu `rgba8_unorm` texture with `texture_binding | copy_dst`
- texture view
- linear clamp sampler
- image bind group via `images.createBindGroup`

When resources succeed, status becomes `ready` and the module force-renders one
frame immediately. This covers paused videos where mpv may have emitted the
first render update before the framework had resources.

### Phase 2: render new frames

For `ready` entries, `update` calls `mpv_render_context_update`. When the flags
include `MPV_RENDER_UPDATE_FRAME`, it renders through the entry's mode.

#### OpenGL path

OpenGL mode uses a dedicated hidden SDL window and GL context separate from the
main wgpu/Vulkan renderer. mpv renders into a private GL FBO:

1. `mpv_render_context_render` renders into `MpvOpenGLFbo`.
2. `mpv_render_context_report_swap` tells mpv the frame was consumed.
3. `glReadPixels` reads RGBA bytes into the CPU pixel buffer.
4. Rows are flipped vertically before upload.
5. `queue.writeTexture` uploads the buffer to the wgpu texture.

`MPV_RENDER_PARAM_FLIP_Y` is set to `0`. The shared image shader flips UV Y, so
the CPU row flip cancels that and gives correct orientation.

This path uses mpv/OpenGL for hardware decode and color conversion, but still
bridges into wgpu through CPU readback.

#### Software path

Software mode asks mpv to render into the CPU buffer directly:

- size: entry width/height
- format: `rgb0`
- stride: `width * 4`
- pointer: entry pixel buffer

After render, the module writes alpha `255` into every pixel because the shared
image shader now respects texture alpha. The buffer then uploads with the same
`queue.writeTexture` helper.

## Paint-time texture draw

`paintVideo(src, x, y, w, h, opacity)` returns `true` only when a video quad was
queued. The current engine ignores the return value because video is already
painted after the normal node background and border.

The draw rect is:

```text
ch = min(node_h, window_h - y)
contain video aspect inside (node_w, ch)
center draw rect inside the clamped box
```

The texture is queued as an image quad:

```zig
images.queueQuad(draw_x, draw_y, draw_w, draw_h, opacity, bg);
```

`gpu/images.zig` and the image shader are shared by static images, video,
render surfaces, static surfaces, and filter composites. `gpu/gpu.zig` always
uploads image quads when present because video and render surfaces can change
without React mutations.

## Playback control surface

The native module exposes these Zig functions:

| Function | Behavior |
| --- | --- |
| `getStatus(src)` | Returns `loading`, `ready`, `error`, or null if no entry exists. |
| `getDimensions(src)` | Returns intrinsic `{ w, h }` after resources initialize. |
| `setPaused(src, paused)` | Writes mpv `pause=yes/no` and updates cached paused state. |
| `setVolume(src, volume)` | Converts `0.0..1.0` style input to mpv `0..100`. |
| `setMuted(src, muted)` | Writes mpv `mute=yes/no`. |
| `setLoop(src, loop)` | Writes mpv `loop-file=inf/no`. |
| `seek(src, time)` | Absolute seek in seconds. |
| `getCurrentTime(src)` | Reads mpv `time-pos`. |
| `getDuration(src)` | Reads mpv `duration`. |
| `getPaused(src)` | Returns cached paused state, defaulting to true. |
| `videoCount()` | Returns loaded entry count. |

These are currently framework-internal. `runtime/hooks/README.md` lists a
future `video` hook, but there is no implemented V8 `runtime/hooks/video.ts`
and no `__video_*` binding in `v8_app.zig`.

### Keyboard controls

`videos.handleKey(sym)` finds the first ready entry and consumes these keys:

| Key | Action |
| --- | --- |
| Space | Toggle pause. |
| Left | Seek -5 seconds. |
| Right | Seek +5 seconds. |
| Up | Volume +5, clamped to 150. |
| Down | Volume -5, clamped to 0. |
| M | Toggle mute. |

Text input gets priority. Render-surface key forwarding also runs before video
shortcuts. There is no per-node focus model for video yet.

## File-drop behavior

`videos.init()` subscribes `onFileDrop` with `framework/filedrop.zig`.

When a file is dropped:

1. libmpv loads if needed.
2. All existing videos are destroyed.
3. The dropped path is loaded as a new video.
4. The new entry is auto-played by setting `pause=no`.
5. Every node in the current tree with `video_src != null` has its
   `node.video_src` rewritten to the dropped path.

This is broad by design. A dropped video replaces every mounted video surface,
not just the hovered one.

## Resource lifetime

`destroyEntry`:

1. Pauses and stops mpv.
2. Releases image bind group, sampler, texture view, and texture.
3. Makes the GL context current for OpenGL-mode cleanup.
4. Deletes private FBO and GL texture.
5. Frees mpv render context.
6. Terminates and destroys the mpv handle.
7. Frees the CPU pixel buffer.
8. Resets the entry struct.

`unloadLibrary` calls `clearCache`, tears down the GL context, `dlclose`s libmpv,
and resets lazy-load flags. Engine shutdown calls this through `videos.deinit`.

## API map

| Layer | File | Surface |
| --- | --- | --- |
| TSX primitive | `runtime/primitives.tsx` | `Video`, `src -> videoSrc` |
| Intrinsic shim | `runtime/jsx_shim.ts` | `<video>` -> `Video` |
| Host prop types | `runtime/host_props.ts` | advisory `videoSrc` prop |
| Prop decode | `v8_app.zig` | `videoSrc -> node.video_src` |
| Node storage/layout | `framework/layout.zig` | `video_src`, fill-parent layout |
| Engine integration | `framework/engine.zig` | init/deinit, key routing, update, paint |
| Native backend | `framework/videos.zig` | libmpv, GL/SW render, upload, controls |
| GPU draw | `framework/gpu/images.zig` | textured quad queue |

## Known gaps and sharp edges

- No JS playback-control hook exists yet. The native helper API is not exposed
  to cart code.
- `paused`, `loop`, `volume`, `rate`, and `time` props are not decoded by V8.
- `videoSrc` removal is not handled by `removePropKeys`, so removing the prop
  can leave the old source on the node.
- Videos start paused unless file drop, a keyboard shortcut, or native code
  explicitly unpauses them.
- First paint can be blank; the entry is created during paint, then resources
  initialize on a later `videos.update()` once mpv exposes dimensions.
- Keyboard controls target the first ready video globally.
- `source` is an image prop, not a video prop.
- Local non-URL sources must exist relative to the process working directory.
- Remote URL support is limited to `http://` and `https://`; ytdl is disabled.
- The OpenGL path still uses CPU readback before wgpu upload.
- Video layout does not visit children.
