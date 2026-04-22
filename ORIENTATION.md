# ReactJIT Orientation

> For AI agents shipping `.tsx` carts. Read this before you write a line of UI.

---

## 1. What ReactJIT Is

React **as algorithm**, not environment.

- ✅ JSX, hooks, `useState`, `useEffect`, `useRef`, `useMemo`, custom hooks
- ✅ Standard React patterns — components, props, context, `memo`
- ❌ **No DOM** — no `document`, `window`, `navigator`, `location`
- ❌ **No CSS** — no stylesheets, `@media`, Grid, `:hover` pseudo-classes, transitions
- ❌ **No fetch** — no `fetch`, `XMLHttpRequest`, `URL`, `Blob`, `FormData`
- ❌ **No browser storage** — no `localStorage` (unless shim installed), `sessionStorage`, `IndexedDB`, cookies
- ❌ **No router** — no `react-router`, no URL bar integration

Your `.tsx` runs inside a **native Zig runtime** (layout, paint, GPU, events). React's reconciler emits `CREATE / APPEND / UPDATE` mutation commands against a Zig-owned `Node` pool. There is no browser beneath you.

---

## 2. What Is Available — Primitives

Import from `../runtime/primitives` (or `runtime/primitives` depending on cart depth):

| Primitive | Key Props | Use Case |
|---|---|---|
| `Box` | `style`, `className`, `onPress`, `onHoverEnter`/`onHoverExit` | Generic container |
| `Row` | same as Box | Horizontal flex container (`flexDirection: 'row'`) |
| `Col` | same as Box | Vertical flex container (default) |
| `Text` | `children`, `fontSize`, `fontFamily`, `color`, `fontWeight` | Text label |
| `Pressable` | `onPress`, `onRightClick`, `onHoverEnter`/`onHoverExit` | Touch/click target |
| `ScrollView` | `style` (needs explicit height), `onScroll` | Scrollable region |
| `TextInput` | `value`, `onChangeText`, `onSubmit`, `placeholder` | Single-line input |
| `TextArea` | same as TextInput | Multi-line input |
| `TextEditor` | `value`, `onChangeText`, `language?` | Code editor surface |
| `Image` | `src` (path or data URL), `style` | Raster image (png/jpg/gif/bmp/tga) |
| `Terminal` | — | Embedded terminal surface |
| `Canvas` | `style`, `viewX?`, `viewY?`, `viewZoom?` | Pan/zoomable node surface |
| `Canvas.Node` | `gx`, `gy`, `gw`, `gh` | Positioned node inside Canvas |
| `Canvas.Path` | `d`, `stroke`, `strokeWidth`, `fill` | SVG-style path inside Canvas |
| `Canvas.Clamp` | — | Viewport-pinned overlay inside Canvas |
| `Graph` | `style`, `viewX?`, `viewY?`, `viewZoom?` | Lightweight static chart surface |
| `Graph.Path` | `d`, `stroke`, `strokeWidth`, `fill` | SVG-style path inside Graph |
| `Graph.Node` | `gx`, `gy`, `gw`, `gh` | Positioned node inside Graph |
| `Effect` | `onRender(e)`, `background?`, `name?` | Per-pixel generative surface |
| `Render` | `renderSrc` (`"app:firefox"`, `"display"`) | External display/app capture |
| `Native` | `type` (any host string), `...props` | Escape hatch for host-handled types |

**HTML tags also work** — remapped in `renderer/hostConfig.ts`:
- `div/section/article/main/nav/header/footer/form/ul/li/table/tr/td/a/button/dialog/menu` → `View`
- `span/p/label/h1-6/strong/b/em/i/code/small` → `Text`
- `img` → `Image`
- `input/textarea` → `TextInput/TextEditor`
- `pre` → `CodeBlock`
- `video` → `Video`

HTML-only attrs (`alt`, `htmlFor`, `aria-*`, `data-*`, `tabIndex`) are stripped before the bridge.

### Tailwind via `className`

`runtime/tw.ts` parses utility classes at CREATE time. Full coverage: spacing (`p-4`, `mx-8`), sizing (`w-full`, `h-[300]`), flex (`flex-row`, `gap-2`, `justify-center`, `items-start`), colors (`bg-blue-500`, `text-slate-200`), radius (`rounded-lg`), borders (`border-2`), typography (`text-xl`, `font-bold`), arbitrary bracket values (`p-[20]`, `bg-[#ff6600]`).

`style` props win on conflicts. Mix freely:

```tsx
<Box className="p-4 bg-blue-500 rounded-lg" style={{ borderWidth: 2 }} />
```

---

## 3. Host Primitives — Global Functions

The Zig host registers functions on `globalThis`. Call directly or via `runtime/ffi.ts` helpers (`hasHost`, `callHost`, `callHostJson`, `subscribe`).

### Core / Reconciler

| Global | Signature | Purpose |
|---|---|---|
| `__hostFlush` | `(json: string) => void` | Send mutation batch to Zig node pool |
| `__markDirty` | `() => void` | Mark reconciler state dirty |
| `__registerDispatch` | `(id: number, fn: Function) => void` | Register press handler for node id |
| `__jsTick` | `(now: number) => void` | Frame clock tick (fires timers) |

### Events (Zig → JS)

| Global | Signature | Purpose |
|---|---|---|
| `__dispatchEvent` | `(id: number, type: string) => void` | Generic press event |
| `__dispatchInputChange` | `(id: number) => void` | Input text changed |
| `__dispatchInputSubmit` | `(id: number) => void` | Input submitted (Enter) |
| `__dispatchInputFocus` | `(id: number) => void` | Input gained focus |
| `__dispatchInputBlur` | `(id: number) => void` | Input lost focus |
| `__dispatchInputKey` | `(id: number, keyCode: number, mods: number) => void` | Key pressed in input |
| `__dispatchRightClick` | `(id: number) => void` | Right-click on node |
| `__dispatchScroll` | `(id: number) => void` | Scroll event on node |
| `__dispatchCanvasMove` | `(id: number, gx: number, gy: number) => void` | Canvas pan/zoom move |
| `__dispatchEffectRender` | `(id: number, w: number, h: number, time: number, dt: number, frame: number, mouse_x: number, mouse_y: number, mouse_inside: number) => void` | Effect frame callback |

### Prepared getters (call before dispatch)

| Global | Signature | Purpose |
|---|---|---|
| `__getPreparedRightClick` | `() => { nodeId: number, x: number, y: number } \| null` | Right-click payload |
| `__getPreparedScroll` | `() => { nodeId: number, dx: number, dy: number } \| null` | Scroll payload |

### I/O & System

| Global | Signature | Purpose |
|---|---|---|
| `__fs_read` | `(path: string) => string` | Read file as string |
| `__fs_write` | `(path: string, data: string) => void` | Write string to file |
| `__fs_exists` | `(path: string) => boolean` | Check file exists |
| `__fs_list_json` | `(path: string) => string` | List dir entries (JSON array) |
| `__fs_mkdir` | `(path: string) => void` | Create directory |
| `__fs_remove` | `(path: string) => void` | Delete file/dir |
| `__fs_stat_json` | `(path: string) => string` | File stat (JSON) |
| `__exec` | `(cmd: string) => string` | Execute shell command synchronously |
| `__exec_async` | `(cmd: string, rid: number) => void` | Async exec (result via `__ffiEmit('exec:<rid>', payload)`) |
| `__env_get` | `(key: string) => string \| null` | Get environment variable |
| `__env_set` | `(key: string, value: string) => void` | Set environment variable |
| `__exit` | `(code: number) => void` | Exit process |
| `__openWindow` | `(opts: string) => void` | Open secondary window (JSON opts) |
| `__window_close` / `__window_minimize` / `__window_maximize` | `() => void` | Window controls |

### Storage & Data

| Global | Signature | Purpose |
|---|---|---|
| `__store_get` | `(key: string) => string \| null` | localstore read |
| `__store_set` | `(key: string, value: string) => void` | localstore write |
| `__store_remove` | `(key: string) => void` | localstore delete |
| `__store_clear` | `() => void` | localstore wipe |
| `__store_keys_json` | `() => string` | localstore keys (JSON array) |
| `__sql_open` | `(path: string) => number` | Open SQLite DB (returns handle) |
| `__sql_close` | `(handle: number) => void` | Close SQLite DB |
| `__sql_exec` | `(handle: number, json: string) => void` | Execute SQL (JSON: `{sql, params}`) |
| `__sql_query_json` | `(handle: number, json: string) => string` | Query SQL → JSON rows |
| `__sql_last_rowid` | `(handle: number) => number` | Last inserted rowid |
| `__sql_changes` | `(handle: number) => number` | Rows affected |

### Network

| Global | Signature | Purpose |
|---|---|---|
| `__http_request_sync` | `(json: string) => string` | Sync HTTP (JSON: `{url, method, headers, body}`) |
| `__http_request_async` | `(json: string, reqId: number) => void` | Async HTTP (result via `__ffiEmit('http:<reqId>', payload)`) |
| `__fetch` | `(url: string) => string` | Simple sync fetch (V8 only) |

### Crypto

| Global | Signature | Purpose |
|---|---|---|
| `__crypto_random_b64` | `(len: number) => string` | Random bytes (base64) |
| `__crypto_hmac_sha256_b64` | `(key: string, msg: string) => string` | HMAC-SHA256 |
| `__crypto_hkdf_sha256_b64` | `(ikm: string, salt: string, info: string, len: number) => string` | HKDF-SHA256 |
| `__crypto_xchacha_encrypt_b64` | `(key: string, nonce: string, plaintext: string) => string` | XChaCha20-Poly1305 encrypt |
| `__crypto_xchacha_decrypt_b64` | `(key: string, nonce: string, ciphertext: string) => string` | XChaCha20-Poly1305 decrypt |

### Misc

| Global | Signature | Purpose |
|---|---|---|
| `__hostLog` | `(level: number, msg: string) => void` | Log to host (0=log,1=warn,2=error) |
| `__hostLoadFileToBuffer` | `(path: string) => number` | Load file to host buffer (returns handle) |
| `__hostReleaseFileBuffer` | `(handle: number) => void` | Release host buffer |
| `__clipboard_get` | `() => string \| null` | Read system clipboard |
| `__clipboard_set` | `(text: string) => void` | Write system clipboard |
| `__ffiEmit` | `(channel: string, payload: any) => void` | Emit event to JS subscribers |
| `getFps` | `() => number` | Current frame rate |
| `getMouseX` / `getMouseY` / `getMouseDown` / `getMouseRightDown` | `() => number` | Mouse state |
| `isKeyDown` | `(keyCode: number) => boolean` | Keyboard state |
| `__applescript` | `(script: string) => string` | Run AppleScript (macOS) |
| `__applescript_file` | `(path: string) => string` | Run AppleScript from file |

### Async / Streaming pattern

Use `ffi.subscribe(channel, callback)` to listen for async results:

```ts
import { subscribe } from '../runtime/ffi';

// HTTP async
subscribe('http:42', (payload) => console.log(payload));
// Exec async
subscribe('exec:7', (payload) => console.log(payload));
```

The host defers callbacks via `setTimeout(0)` to avoid `setState`-during-commit loops.

---

## 4. Common Anti-Patterns

| What you reach for | Why it fails | What to use instead |
|---|---|---|
| `document.querySelector` / `document.createElement` | No DOM | React refs + primitives |
| `window.addEventListener` | No `window` | Props: `onPress`, `onHoverEnter`, `onKeyDown` |
| `fetch` | No browser networking | `runtime/hooks/http.ts` (`get`/`post` sync, `getAsync`/`postAsync`) or `installFetchShim()` |
| `localStorage` | Not a browser | `runtime/hooks/localstore.ts` or `installLocalStorageShim()` |
| `sessionStorage` / `IndexedDB` / cookies | Not a browser | `localstore` (persistent SQLite-backed KV) |
| `setTimeout` for animation | Janky, no VSync | `useEffect` + `useFrame` or `requestAnimationFrame` pattern |
| `CSS :hover` / `:focus` | No CSS engine | `onHoverEnter` / `onHoverExit` props |
| `CSS transitions` / `@keyframes` | No CSS engine | `useEffect` + interval + `style` tweening, or `anim.ts` helpers |
| `className` with arbitrary CSS | Only Tailwind utilities parsed | `className` for Tailwind utilities, `style` for raw values |
| `styled-components` / `emotion` | No CSS cascade | `style` prop or `className` + Tailwind |
| `react-router` | No URL bar | Tab state in `useState`, switch on value |
| `<svg>` with `<path>` / `<circle>` | Not remapped | `<Canvas.Path d="..." />` or `<Graph.Path>` |
| `<iframe>` | No browser | `<Render renderSrc="app:firefox" />` or `Native` escape hatch |
| `new Blob()` / `new URL()` | Not defined | Pass data as strings or arrays |
| `FormData` / `FileReader` | Not defined | Read files via `__fs_read` or `__hostLoadFileToBuffer` |

---

## 5. Cart Structure

```
cart/
  my_app/
    index.tsx      ← entry point (must export default component)
    cart.json      ← optional manifest (only customChrome today)
  my_app.tsx       ← single-file cart (alternative to directory)
```

### `cart.json` manifest

```json
{
  "customChrome": true
}
```

- `customChrome: true` — borderless window, top strip IS the titlebar (tabs, drag-to-move, double-click maximize)
- `customChrome: false` or missing — standard OS window chrome

### Ship pipeline

```bash
./scripts/ship my_app       # release, self-extracting binary
./scripts/ship my_app -d    # debug, raw ELF
./scripts/ship my_app --raw # release, raw ELF
```

Pipeline:
1. **esbuild** bundles `cart/my_app/index.tsx` + `runtime/` + `renderer/` → `bundle-my_app.js`
2. **build-jsast** (JSRT only) runs acorn → `bundle-my_app.ast.lua`
3. **Zig build** compiles cart host with bundle embedded via `@embedFile`
4. **Package** — Linux: self-extracting tarball with all `.so` deps; macOS: `.app` bundle

### Dev loop (hot reload)

```bash
./scripts/dev my_app
```

No rebuild needed for `cart/`, `runtime/`, `renderer/` changes. Save → re-bundle → visible in ~300ms. Rebuild only when `framework/`, `build.zig`, or `scripts/` change.

---

## 6. Runtime Choice

Three VM backends exist. The `scripts/ship` and `scripts/dev` commands pick one:

| Runtime | File | Status | When to use |
|---|---|---|---|
| **V8** | `v8_app.zig` | **Default** | Production, general use. Best compatibility. |
| **QJS** | `qjs_app.zig` | Legacy | Not recommended. Hit 2000ms-per-click ceiling on large trees. |
| **JSRT** | `jsrt_app.zig` | Experimental | `--jsrt` flag. JS evaluator in LuaJIT. Target for large-tree perf. |

```bash
./scripts/ship my_app        # V8 (default)
./scripts/ship my_app --qjs  # QuickJS (legacy)
./scripts/ship my_app --jsrt # JSRT (experimental)
```

JSRT is the long-term direction: JS stays JS as data; a Lua evaluator executes JS semantics directly. LuaJIT's trace JIT specializes hot paths, effectively JIT-compiling the JS running through it. See `framework/lua/jsrt/README.md` and `TARGET.md`.

---

## Quick Reference — One-Liners

```tsx
// Root container MUST fill parent
<Box style={{ width: '100%', height: '100%' }}>

// Space-filling child
<Box style={{ flexGrow: 1 }} />

// ScrollView needs explicit height
<ScrollView style={{ height: 300 }}>...</ScrollView>

// Don't mix text + expressions in <Text>
<Text>{`Count: ${count}`}</Text>

// Use template literals, not concatenation

// Copy-paste HTML works
<div className="p-4 flex-row gap-2">
  <h1>Title</h1>
  <button onClick={handleClick}>Go</button>
</div>
```
