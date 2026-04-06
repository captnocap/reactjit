# ReactJIT — System Diagrams

Draft ASCII diagrams for review before final illustration.
Each section is self-contained and scoped to one concept.

---

## COMPILER PIPELINE

---

### 1a. Overview (3-step)

```
  app.tsz
  (TypeScript + JSX)
        │
        ▼
  ┌─────────────────────┐
  │   Forge + Smith     │   ← compiler: Zig kernel hosting JS brain
  └─────────────────────┘
        │
        ▼
  generated.zig
  (layout + state + paint + events)
        │
        ▼
  ┌─────────────────────┐
  │    zig build        │   ← links framework runtime
  └─────────────────────┘
        │
        ▼
  native binary
  (SDL3 + wgpu + FreeType + QuickJS + LuaJIT)
```

---

### 1b. Forge Zoom

What lives inside Forge — the Zig kernel.

```
  ┌────────────────────────────────────────────────────┐
  │                      FORGE  (Zig)                  │
  │                                                    │
  │   ┌──────────┐     flat token arrays               │
  │   │  lexer   │ ──► kinds[]  Uint8Array             │
  │   │ (484 ln) │     starts[] Uint32Array            │
  │   └──────────┘     ends[]   Uint32Array            │
  │                         │                          │
  │   ┌──────────────────────▼───────────────────┐     │
  │   │           QuickJS host                   │     │
  │   │                                          │     │
  │   │   loads smith/*.js at startup            │     │
  │   │   passes token arrays + source string    │     │
  │   │   calls compile(inputPath) → string      │     │
  │   └──────────────────────────────────────────┘     │
  │                         │                          │
  │   ┌──────────┐          │                          │
  │   │  file    │ ◄────────┘   receives .zig string   │
  │   │   I/O   │              writes generated.zig    │
  │   └──────────┘                                     │
  └────────────────────────────────────────────────────┘
```

Forge does NOT know about: styles, JSX, components, state, handlers.
It lexes, bridges, and writes. Smith knows everything else.

---

### 1c. Smith Zoom

What lives inside Smith — the JS compiler brain (**many modules** under `tsz/compiler/smith_*` and `smith_*` subdirs; exact size changes — use `zig build smith-sync` / bundle, not a fixed line count). For **current** architecture and lua-tree, see [tsz/docs/ARCHITECTURE.md](tsz/docs/ARCHITECTURE.md).

```
  ┌────────────────────────────────────────────────────────┐
  │                    SMITH  (JavaScript)                 │
  │                                                        │
  │  Input: token arrays + source string (from Forge)      │
  │                                                        │
  │  ┌─────────────────────────────────────────────────┐   │
  │  │  Phase 1 — COLLECT                              │   │
  │  │  index.js + attrs.js                            │   │
  │  │                                                 │   │
  │  │  scan tokens → build compiler state:            │   │
  │  │    states[]      useState declarations          │   │
  │  │    handlers[]    onPress / event bodies         │   │
  │  │    maps[]        .map() calls + item params     │   │
  │  │    components[]  function components            │   │
  │  │    scriptBlock   <script> / <lscript> present?  │   │
  │  └─────────────────────────────────────────────────┘
  │                         │
  │                         ▼
  │  ┌─────────────────────────────────────────────────┐   │
  │  │  Phase 2 — PARSE                                │   │
  │  │  parse.js                                       │   │
  │  │                                                 │   │
  │  │  recursive JSX walk → node tree                 │   │
  │  │    resolve map item props                       │   │
  │  │    inline components                            │   │
  │  │    track scope (nested maps, conditionals)      │   │
  │  │    detect handler captures → mark as luaBody    │   │
  │  └─────────────────────────────────────────────────┘
  │                         │
  │                         ▼
  │  ┌─────────────────────────────────────────────────┐   │
  │  │  Phase 3 — EMIT                                 │   │
  │  │  emit.js + rules.js                             │   │
  │  │                                                 │   │
  │  │  assemble output:                               │   │
  │  │    generated_*.zig (glue, root, handlers)       │   │
  │  │    LUA_LOGIC (default lua-tree + handlers)      │   │
  │  │    JS_LOGIC (<script>, when present)            │   │
  │  └─────────────────────────────────────────────────┘   │
  │                         │                              │
  │                         ▼                              │
  │               .zig source string                       │
  └────────────────────────────────────────────────────────┘
```

---

### 1d. Zig Build Zoom

What happens after Smith emits `generated.zig`.

```
  generated.zig
  (Smith output)
        │
        ▼
  zig build app / zig build app-lib
        │
        ├── links framework/          (77 modules: layout, GPU, events, state,
        │                              text, networking, scripting, media, ...)
        │
        ├── links QuickJS             (for <script> runtime + Smith host)
        │
        ├── links LuaJIT              (for <lscript> + handler logic)
        │
        ├── links SDL3 + wgpu         (windowing + GPU pipeline)
        │
        └── links FreeType + blend2d  (text + 2D vector)

                    │
          ┌─────────┴──────────┐
          ▼                    ▼
    zig build app        zig build app-lib
    full binary          .so shared lib
    (production)         (dev hot-reload)
          │                    │
          ▼                    ▼
    bin/myapp           zig-out/lib/myapp.so
                              │
                              ▼
                        tsz dev shell
                        (hot-reload on save,
                         186ms, state survives)
```

---

## SCRIPT RUNTIME ROUTING

---

### 2. When Logic Goes Where

```
  handler body / script block / zscript tag
              │
              ▼
  ┌──────────────────────────────────────┐
  │  Does it need runtime capture?       │
  │  (index, closure, dynamic dispatch)  │
  └──────────────────────────────────────┘
        │                     │
       YES                    NO
        │                     │
        ▼                     ▼
  ┌───────────┐      ┌─────────────────────────────┐
  │  LuaJIT  │      │  Is it a <script> block      │
  │           │      │  or .script.tsz file?        │
  │ emitted   │      └─────────────────────────────┘
  │ into      │             │               │
  │ LUA_LOGIC │            YES              NO
  │           │             │               │
  │ handler   │             ▼               ▼
  │ string    │       ┌──────────┐    ┌──────────┐
  │ baked per │       │ QuickJS  │    │   Zig    │
  │ map item  │       │          │    │          │
  └───────────┘       │ timers   │    │ compiled │
                      │ async    │    │ into     │
  2–11x faster        │ fetch    │    │ binary   │
  than QuickJS        │ mock     │    │          │
  11.1x on            │ data     │    │ no       │
  nested ternaries    └──────────┘    │ ceiling  │
  (cb47b7a1)                         └──────────┘

  QuickJS: 52M ops/sec ceiling (8b7451b1)
  LuaJIT:  JIT-compiled, traces warm after ~50 calls
  Zig:     native speed, no runtime overhead
```

---

## MAP HANDLER ROUTING

---

### 3. Why .map() Handlers Route to LuaJIT

The problem: Zig has no closures. Each map item needs its own handler
with the item index baked in. A static Zig function pointer can't carry
per-item state.

```
  .tsz source:
  ─────────────────────────────────────────────
  items.map((item, i) => (
    <Pressable onPress={() => { setSelected(i) }}>
      ...
    </Pressable>
  ))
  ─────────────────────────────────────────────

  Smith detects: handler captures `i` (map index)
  → marks handler as luaBody, not Zig body

              │
              ▼

  EMIT PHASE — two outputs:

  ┌─────────────────────────────────────────────────────┐
  │  LUA_LOGIC block (embedded Lua string in .zig)      │
  │                                                     │
  │  selected = 0                                       │
  │  function setSelected(v) selected = v               │
  │    __setState(0, v) end                             │
  │                                                     │
  │  function __mapPress_0_0(idx)                       │
  │    setSelected(idx)                                 │
  │  end                                                │
  └─────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────┐
  │  rebuild() fn — runs on each state change           │
  │                                                     │
  │  for (0..item_count) |i| {                          │
  │    // format handler string with index baked in     │
  │    bufPrint(buf, "__mapPress_0_0({d})", .{i})       │
  │    node[i].handlers.lua_on_press = buf[i]           │
  │  }                                                  │
  └─────────────────────────────────────────────────────┘

              │
              ▼

  At runtime: user taps item 3
    → Zig reads node[3].lua_on_press = "__mapPress_0_0(3)"
    → LuaJIT calls __mapPress_0_0(3)
    → setSelected(3) runs
    → __setState(0, 3) updates Zig state slot
    → rebuild() fires
```

No closures needed. The index is a string, baked at rebuild time.
LuaJIT executes it. Zig only stores the string.

---

## THREE-TIER COMPILE PATH

---

### 4. Soup → Mixed → Chad

Same output, three different inputs, three different compile speeds.

```
  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
  │  SOUP  (a files)     │  │  MIXED  (b files)    │  │  CHAD  (c files)     │
  │                      │  │                      │  │                      │
  │  <div                │  │  <Box                │  │  <C.Card             │
  │    className="card"  │  │    style={{          │  │    cls={styles.card} │
  │    onClick={fn}      │  │      padding: 16,    │  │    onPress={fn}      │
  │    style="padding:   │  │      background:     │  │  >                   │
  │      16px"           │  │        '#1e1e2a'     │  │    <C.Title>         │
  │  >                   │  │    }}                │  │      {title}         │
  │    {title}           │  │    onPress={fn}      │  │    </C.Title>        │
  │  </div>              │  │  >                   │  │  </C.Card>           │
  │                      │  │    <Text>{title}     │  │                      │
  │  real model output   │  │  </Box>              │  │  classifiers +       │
  │  zero context        │  │                      │  │  theme tokens +      │
  │                      │  │  primitives +        │  │  named shapes        │
  │                      │  │  inline styles       │  │                      │
  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘
            │                          │                          │
            ▼                          ▼                          ▼
  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
  │  compiler runs:      │  │  compiler runs:      │  │  compiler runs:      │
  │  HTML tag mapping    │  │  style validation    │  │  (nothing extra)     │
  │  style parsing       │  │  event normalization │  │                      │
  │  event normalization │  │                      │  │  preflight detects   │
  │  className→cls conv  │  │  (skip HTML mapping) │  │  chad structure →    │
  │  CSS string parsing  │  │                      │  │  skip all passes     │
  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘
            │                          │                          │
            └──────────────────────────┴──────────────────────────┘
                                       │
                                       ▼
                              identical .zig output
                              identical native binary
```

Chad compiles fastest because the compiler does least work.
The framework literally rewards clean code with speed.

---

## CARTRIDGE MODEL

---

### 5a. Dev Shell (multi-cart host)

```
  ┌───────────────────────────────────────────────────────┐
  │                    dev shell                          │
  │                                                       │
  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
  │  │  cart A     │  │  cart B     │  │  cart C     │   │
  │  │  .so        │  │  .so        │  │  .so        │   │
  │  │             │  │             │  │             │   │
  │  │  state      │  │  state      │  │  state      │   │
  │  │  handlers   │  │  handlers   │  │  handlers   │   │
  │  │  lifecycle  │  │  lifecycle  │  │  lifecycle  │   │
  │  └─────────────┘  └─────────────┘  └─────────────┘   │
  │         ▲                                             │
  │         │  file watcher detects .tsz change           │
  │         │  forge+smith recompile → new .so            │
  │         │  shell swaps cart, state survives           │
  │         │  186ms, no restart                          │
  │                                                       │
  │  cross-cart state access via shell                    │
  │  each cart hot-reloads independently                  │
  └───────────────────────────────────────────────────────┘
```

### 5b. Inline Cartridge Embed

```
  parent app (.tsz)
  ──────────────────────────────────────────
  <Box style={{ flexDirection: 'row' }}>
    <Cartridge src="sidebar.so"
               style={{ width: 250 }} />
    <Cartridge src="editor.so"
               style={{ flexGrow: 1 }} />
  </Box>
  ──────────────────────────────────────────

  at runtime:
  ┌─────────────────────────────────────────────────────┐
  │  parent layout                                      │
  │  ┌──────────────────┐  ┌──────────────────────────┐ │
  │  │  sidebar.so      │  │  editor.so               │ │
  │  │  (250px)         │  │  (flexGrow: 1)           │ │
  │  │                  │  │                          │ │
  │  │  own state       │  │  own state               │ │
  │  │  own tick        │  │  own tick                │ │
  │  │  own handlers    │  │  own handlers            │ │
  │  └──────────────────┘  └──────────────────────────┘ │
  └─────────────────────────────────────────────────────┘

  ABI: 6 C exports per .so
    app_get_root, app_get_init, app_get_tick,
    app_get_title, app_state_count, app_state_*

  any language that compiles to .so works:
  Zig, Rust, C, Go
```

---
