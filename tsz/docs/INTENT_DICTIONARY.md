# Intent Dictionary

Single source of truth for chad-tier `.tsz` syntax. If a construct isn't here, it doesn't exist yet. If a conformance test drifts from this, the test is wrong.

---

## Core Principle

**Everything is a `<block>`.** Logic scopes into brackets. Statements say what happens. No sigils, no braces, no arrows, no JS/Lua/Zig leaking in.

---

## Binding Levels

Three ways to declare anything:

| Syntax | Meaning | Mutability |
|--------|---------|------------|
| `thing` | untyped, uninitialized | mutable, open-ended |
| `thing is value` | initialized with value | mutable |
| `thing exact value` | locked to value | immutable |

`exact` carries the same meaning everywhere it appears:
- In `<var>`: immutable binding
- In `<state>`: constrains what a setter accepts
- In `<config>` / data blocks: immutable field
- In expressions: strict equality comparison

---

## File Structure

Name first, type second. Reads like English: "home is a page", "counter is a component."

### App (`.app.tsz`) — root shell, owns navigation

The app is a layout that wraps pages. It has `<var>`, `<state>`, `<functions>`, and `return()` like anything else — its job is the chrome (sidebar, nav, header) with pages slotted in.

```
<my app>
  <var>
    pages is page array
    active is 'home'
  </var>

  <pages>
    home
    settings
    profile
  </pages>

  <state>
    set_active
  </state>

  <functions>
    goTo:
      set_active is item
  </functions>

  return(
    <C.PageRow>
      <C.Sidebar>
        <C.Title>My App</C.Title>
        <For each=pages>
          <Pressable onPress=goTo>
            <if item exact active>
              <C.NavItemActive><C.NavLabelActive>{item}</C.NavLabelActive></C.NavItemActive>
            </if>
            <else>
              <C.NavItem><C.NavLabel>{item}</C.NavLabel></C.NavItem>
            </else>
          </Pressable>
        </For>
      </C.Sidebar>
      <C.Main>
        <active page />
      </C.Main>
    </C.PageRow>
  )
</my>
```

- `<pages>` is a data block (array). Adding a page = one line here + a file on disk.
- `goTo` works from inside `<For>` — `item` is the page name via scope.
- `<active page />` renders the page whose name matches the `active` variable.
- Pages don't know about each other. The app owns all routing.

### Widget (`.tsz`) — self-contained, no imports

```
<weather widget>
  <ffi> ... </ffi>
  <var> ... </var>
  <state> ... </state>
  <types> ... </types>
  <functions> ... </functions>
  return( ... )
</weather>
```

A widget is a complete app in one file. No `from`, no dependencies. Compiles to a binary by itself. The one-liner design philosophy.

### Page (`.tsz`) — app entry, can import

```
<home page>
  <var> ... </var>
  <state> ... </state>
  <types> ... </types>
  <functions> ... </functions>
  return( ... )
</home>
```

Pages can `from` import components, classifiers, effects, glyphs.

### Component (`.tsz`) — reusable, consumed by pages

```
<counter component>
  <props>
    initial is 0
    max exact number
  </props>
  <var>
    count is initial
  </var>
  <state>
    set_count
  </state>
  <functions>
    increment:
      <if count exact or above max>
        stop
      </if>
      set_count is count + 1

    decrement:
      set_count is count - 1
  </functions>
  return(
    <C.Row>
      <C.Btn onPress=decrement><C.BtnLabel>-</C.BtnLabel></C.Btn>
      <C.Value>{count}</C.Value>
      <C.Btn onPress=increment><C.BtnLabel>+</C.BtnLabel></C.Btn>
    </C.Row>
  )
</counter>
```

Components have `<props>` — what they accept from outside:

- `name` — bare, required, any type
- `name exact type` — required, typed
- `name is value` — optional with default
- `name exact number` — required, constrained
- `onSave` — function reference (callback to parent)

Each instance gets its own `<var>`, `<state>`, `<functions>`. Components are opaque — they do NOT see the caller's scope. Data comes in via `<props>` only.

**Callback props** — a component communicates back to its parent by calling a function passed as a prop:

```
<editableCard component>
  <props>
    card
    onSave
  </props>
  <var>
    editing is false
    draft is ''
  </var>
  <state>
    set_editing
    set_draft
  </state>
  <functions>
    startEdit:
      set_editing is true
      set_draft is card.title

    save:
      set_editing is false
      onSave
  </functions>
  return(
    <C.Card>
      <if editing>
        <C.InputWrap>
          <TextInput value={draft} onChange=set_draft />
        </C.InputWrap>
        <C.Btn onPress=save><C.BtnLabel>Save</C.BtnLabel></C.Btn>
      </if>
      <else>
        <C.Title>{card.title}</C.Title>
        <C.Btn onPress=startEdit><C.BtnLabel>Edit</C.BtnLabel></C.Btn>
      </else>
    </C.Card>
  )
</editableCard>
```

Used in a page:

```
from './editableCard'

<home page>
  <functions>
    persistCard:
      db.write('cards', item)
  </functions>

  return(
    <For each=cards as card>
      <EditableCard card=card onSave=persistCard />
    </For>
  )
</home>
```

The component calls `onSave`, which resolves to `persistCard` in the page. The component doesn't know or care what `persistCard` does.

**Scope boundary:**

|  | Sees caller scope | Data in via |
|---|---|---|
| Functions | yes | implicit (scope inheritance) |
| Components | no | explicit (`<props>`) |

Used in a page:
```
from './counter'

<home page>
  return(
    <Counter />
    <Counter initial=5 />
    <Counter initial=10 max=50 />
  )
</home>
```

### Module (`.mod.tsz`) — backend logic, no UI

```
<database module>
  <ffi> ... </ffi>
  <types> ... </types>
  <state> ... </state>
  <functions> ... </functions>
</database>
```

| Type | Imports | Standalone | Reusable | Has UI | File |
|------|---------|------------|----------|--------|------|
| `app` | pages/widgets | yes | no | no (shell) | `.app.tsz` |
| `widget` | no | yes | no | yes | `.tsz` |
| `page` | yes | yes | no | yes | `.tsz` |
| `component` | yes | no | yes | yes | `.tsz` |
| `module` | yes | no | yes | no | `.mod.tsz` |

All blocks are optional. Order doesn't matter. Every block appears at most once (except data blocks — see below).

---

## `<var>` — Variable Declarations

One declaration per line. No expressions on the right side — literals only.

```
<var>
  count is 0
  name is 'default'
  active is true
  input is ''
  items is array
  config is object
  cards is objects
  filter
  thing exact 'locked'
</var>
```

Bare `thing` = untyped `let`. `is` = mutable with initial value. `exact` = immutable.

### Shape Declarations (`has`)

When a variable has fields, declare its shape with `has`:

```
<var>
  <r has>
    .ttl
    .pos.x
    .status exact type
  </r>
</var>
```

- `.fieldName` — mutable, open-ended field
- `.field.nested` — nested field path
- `.field exact type` — field locked to a type defined in `<types>`
- `.field exact value` — field locked to a literal value
- `.field is value` — field with default value

Fields use `.` prefix. The `has` keyword means "this variable has this shape." Everything the variable touches is declared here — no hidden fields.

Type constraints on fields scope to the field path:

```
<types>
  <r.status>
    active
    inactive
  </r.status>
</types>
```

### Data Blocks

When a var is declared as `array`, `object`, or `objects`, its contents go in a named block matching the var name:

**`array`** — one item per line. Optionally typed (`type array`):

```
<var>
  colors is array
  pages is page array
  scores is number array
</var>

<colors>
  red
  green
  blue
</colors>
```

When typed, the compiler knows what's in the array — `page array` holds pages, `number array` holds numbers. Untyped `is array` is open-ended.

**`object`** — key-value pairs:

```
<var>
  config is object
</var>

<config>
  name exact 'app'
  version is 1
  debug is false
</config>
```

Fields use `exact` (immutable) or `is` (mutable). Bare field name = untyped.

**`objects`** — array of objects, one per line, comma-separated fields:

```
<var>
  cards is objects
</var>

<cards>
  id: 1, title: Auth flow, col: todo
  id: 2, title: Write tests, col: todo
  id: 3, title: API layer, col: progress
</cards>
```

---

## `<state>` — Setter Declarations

Declares which variables can be mutated and optionally constrains them.

```
<state>
  set_count
  set_filter exact filter
  set_status exact 'pending' or 'done' or 'error'
  set_thing exact 'some type'
  set_number exact number
</state>
```

- `set_name` — unconstrained setter for `name`
- `set_name exact value` — setter locked to a single value
- `set_name exact typename` — setter constrained to a type declared in `<types>`
- `set_name exact 'a' or 'b' or 'c'` — setter constrained to one of listed values (inline enum)

Every setter must pair with a var: `set_count` requires `count` in `<var>`.

---

## `<types>` — Type Definitions

Types are blocks nested inside `<types>`, named after the variable they constrain:

```
<var>
  thing exact types
</var>

<types>
  <thing>
    some type
    another type
    one more type
  </thing>
</types>
```

One variant per line. No pipe syntax. The block name connects to the var name.

### Struct Types (modules)

```
<types>
  <Vec2>
    x is f32
    y is f32
  </Vec2>

  <Record>
    id is u8
    name exact string
    pos is Vec2
    active is true
  </Record>
</types>
```

Fields use `is` for defaults, `exact` for fixed.

### Tagged Unions (modules)

```
<types>
  <Payload is union>
    int is i64
    float is f64
    text is string
    blob is string
  </Payload>
</types>
```

`is union` on the block tag. Same `is` keyword used everywhere else. No bare `union` keyword on its own line.

---

## `<functions>` — Logic Definitions

Named functions. Each does one thing. Big behavior is composition.

### Reserved (Hard) Functions

A small set of names the compiler recognizes as lifecycle hooks:

| Name | When | Notes |
|------|------|-------|
| `boot` | once, at startup, before first render | initialization |
| `shutdown` | once, on exit | cleanup, pairs with `boot` |

```
<functions>
  boot:
    set_active is home
    db.init('app.db')

  shutdown:
    db.close
</functions>
```

Everything else is either called by an event (`onPress=funcName`), composed (`a + b + c`), or scheduled (`funcName every N:`). No `useEffect`, no `componentDidMount`, no `onInit`.

### Nullary Functions

```
<functions>
  reset:
    set_count is 0

  increment:
    set_count is count + 1
</functions>
```

### Functions with Arguments

```
<functions>
  move(id, toCol):
    set_cards is cards.map(id, col: toCol)
</functions>
```

### Composition (the `+` operator)

Functions combine with `+`. Sequential execution. `stop` in any step halts the chain.

```
<functions>
  validateInput:
    <if input exact ''>
      stop
    </if>

  appendItem:
    set_items is items.concat(input)

  clearInput:
    set_input is ''

  bumpId:
    set_nextId is nextId + 1

  addItem:
    validateInput + appendItem + clearInput + bumpId
</functions>
```

**Rule:** if your function needs more than one `<if>`, it's probably two functions and an addition.

### Mutation

Two kinds. The `set_` prefix means reactive state. Plain `is` on a field means data write.

| Syntax | What it is |
|--------|-----------|
| `set_count is count + 1` | state mutation — declared in `<state>`, triggers re-render |
| `r.ttl is r.ttl - 1` | field write — on a scoped variable (loop, `<For>`) |
| `item.done is not item.done` | field write — on `<For>` item |

`set_` is never used for field writes. `field is value` is never used for state. The compiler knows the difference because state setters are declared in `<state>`.

### `stop`

Halts execution of the current function. When inside a composed chain (`a + b + c`), halts the entire chain. Inside a `<while>`, breaks out of the loop.

### `skip`

Skips to the next iteration in a `<for>` or `<while>` loop. Like `continue` in other languages.

```
<for items as item>
  <if not item.active>
    skip
  </if>
  process
</for>
```

### Scope Rule

**Functions see the scope of their call site.** If a function is called from inside a `<For>`, `item` is available. If called from outside, it isn't — the compiler errors.

This means:
- No parameterized event handlers. No closures. No arrows.
- `onPress=toggleItem` inside a `<For>` gives `toggleItem` access to `item`.
- Functions that need `item` only work when called from a context that has it.
- The compiler enforces this — calling a function that uses `item` from outside a `<For>` is a compile error.

---

## Control Flow Blocks

**Every block is self-closing.** Every `<open>` has its own `</close>`. No ambiguity about scope. The function is the container — blocks inside it are linear siblings.

### `<if>` / `<else if>` / `<else>`

```
<if number above 0>
  set_thing exact 'positive'
</if>
<else if number exact 0>
  set_thing exact 'zero'
</else>
<else>
  set_thing exact 'negative'
</else>
```

Each block closes itself: `</if>`, `</else>`. The compiler reads linearly — sees `</if>`, knows the if-body is done. Sees `<else if>`, knows it's the next branch. No backtracking.

### `<for>`

```
<for records as r>
  <if r.active>
    set_count is count + 1
  </if>
</for>
```

### `<during>` — Lifecycle / Reactive Scope

**The most versatile block.** Runs as long as its condition is true. Variable-driven — flip the variable, the block activates or deactivates. Replaces `useEffect`, lifecycle hooks, event subscriptions, recursive walks, and if/else state chains.

**Variable-driven lifecycle:**

```
<var>
  recording is false
  loading is false
  ready is false
</var>

<during recording>
  media.captureFrame every 33
</during>

<during loading>
  showSpinner
</during>

<during ready>
  showContent
</during>
```

Turn `recording` on → the block activates. Turn it off → the block stops and cleans up. No event listeners. The variable IS the switch.

**In JSX — replaces if/else state chains:**

```
return(
  <C.Page>
    <during loading>
      <C.Spinner />
    </during>
    <during error>
      <C.ErrorCard>{errorMessage}</C.ErrorCard>
    </during>
    <during ready>
      <For each=items>
        <C.ListItem>{item.name}</C.ListItem>
      </For>
    </during>
  </C.Page>
)
```

No chain. No precedence. Each state owns its own view.

**Recursive tree walks:**

```
<during paintNode(node)>
  paintNodeVisuals(node)
  <for node.children as child>
    paintNode(child)
  </for>
</during>
```

Tells the compiler "this is a sustained operation that can re-enter itself."

**Lifecycle phases:**

```
<during boot>
  initSDL + initGPU + initText
  <during page load>
    fetchData + buildTree + firstPaint
  </during>
</during>
```

Phases nest. Cleanups unwind with the phase.

**What `<during>` replaces:**

| Old pattern | `<during>` equivalent |
|------------|----------------------|
| `useEffect(() => {}, [dep])` | `<during dep>` |
| `while (running) { }` | `<during running>` |
| recursive function | `<during funcName(arg)>` |
| lifecycle hooks | `<during boot>`, `<during page load>` |
| event subscriptions | `<during connected>`, `<during recording>` |
| if/else state chains | multiple `<during state>` blocks |

### `<while>`

Condition-based loops for explicit iteration (not lifecycle/reactive — use `<during>` for that):

```
<while sdl.pollEvent as event>
  handleEvent
</while>
```

`stop` inside a `<while>` breaks out of it. `skip` skips to the next iteration.

### `<switch>` / `<case>`

Multi-branch matching. Each case closes itself:

```
<switch event.type>
  <case quit>
    stop
  </case>
  <case resize>
    updateSize
  </case>
  <case keydown>
    handleKey
  </case>
</switch>
```

### Cleanup Pairing (`cleanup`)

Functions can have a paired cleanup that runs when the function's scope unwinds:

```
<functions>
  sdlInit:
    sdl.init('video')

  sdlInit cleanup:
    sdl.quit

  gpuInit:
    gpu.init(window)

  gpuInit cleanup:
    gpu.deinit

  startEngine:
    sdlInit + gpuInit + runLoop
</functions>
```

When the composed chain ends (or `stop` fires), cleanups run in reverse order. No `defer` keyword — just named pairs.

---

## Expressions

### Comparisons

All comparisons are words. No sigils.

| Syntax | Meaning |
|--------|---------|
| `a exact b` | strict equality |
| `a not exact b` | strict inequality |
| `a above b` | greater than |
| `a below b` | less than |
| `a exact or above b` | greater than or equal |
| `a exact or below b` | less than or equal |

**No `===`, `!==`, `==`, `>`, `<`, `>=`, `<=`.** Words only. This eliminates all parser ambiguity — there is no `<` operator to confuse with a block open.

### Logical

| Syntax | Meaning |
|--------|---------|
| `a and b` | logical AND |
| `a or b` | logical OR |
| `not a` | logical NOT |

**No `!`, `&&`, `||`.** Words only.

### Arithmetic

`+`, `-`, `*`, `/`, `%` — standard.

### String

`a + b` — concatenation. That's it.

### Collection Operations

| Syntax | Meaning |
|--------|---------|
| `items.where(condition)` | filter — keep items matching condition |
| `items.without(item)` | remove current item (inside `<For>` scope) |
| `items.concat(value)` | append, returns new collection |
| `items.length` | count |

**No `.map()`, `.filter()` with lambdas.** Use `.where()` with `item` from scope, or `<for>` blocks for transforms.

`item` inside `.where()` is implicit — it comes from the collection being operated on, same as inside `<For>`.

### Null Coalescing

`a ?? b` — if `a` is null/undefined, use `b`.

---

## JSX in `return()`

### Event Handlers

Function names only. No inline closures. No arrows. No parameters.

```
// correct
onPress=increment
onPress=reset
onChange=set_input

// WRONG — JS leak
onPress={() => { increment() }}
onPress={(e) => handleClick(e)}
onPress={() => { moveCard(item.id, 'done') }}
```

There are no parameterized handlers. Scope handles it. Inside a `<For>`, the function sees `item` automatically. Define small named functions in `<functions>` that operate on `item`:

```
<functions>
  moveToDone:
    set item.col is 'done'
</functions>

<For each=cards>
  <Pressable onPress=moveToDone>
</For>
```

### `<For>` — Collection Iteration

```
<For each=items>
  <Text>{item.name}</Text>
</For>
```

- `item` refers to the current element inside `<For>`
- `each` references a var name — no braces needed

**No `{items.map(...)}`**. Use `<For>`.

### Three Visual Layers

All referenced by name. All defined in their own files. No inline styling anywhere.

**1. Classifiers** (`C.Name`) — structural styling (layout, colors, spacing):

```
<C.Card> ... </C.Card>
<C.Title>text</C.Title>
<C.Value>{count}</C.Value>
```

Defined in `.cls.tsz` files. `C.Name` pattern. If you need a new look, add a classifier.

**2. Effects** (bare name on tag) — live procedural fills:

```
<Text lava>MOLTEN LETTERS</Text>
<Text plasma>RAINBOW TEXT</Text>
<Text ocean>DEEP CURRENT</Text>
<C.Card ember> ... </C.Card>
```

The effect name IS the prop. A bare word on a tag that matches a named effect applies that effect as a fill. Defined in `.effects.tsz` files.

**3. Glyphs** (`:name:` in text) — Discord-style inline shortcodes:

```
<Text>Status :check: all good</Text>
<Text>Alert :warning: something wrong</Text>
<Text>Energy :star[plasma]: reactor online</Text>
<Text>Heat :flame[lava]: critical :laugh:</Text>
```

- `:name:` — inserts a named glyph with its default fill
- `:name[effect]:` — glyph with a named effect as its fill override
- Works anywhere inside text content — inline like emoji

Defined in `.glyphs.tsz` files. The compiler resolves `:name:` from the glyphs registry.

**Chad-tier JSX has no `style=` prop.** No visual props (`fontSize`, `color`, `backgroundColor`) on primitives. Classifiers handle structure, effects handle procedural fills, glyphs handle inline assets.

Primitives (`Box`, `Text`, `Pressable`, etc.) appear in `.cls.tsz` definitions, not directly in page files.

### Props

Props are bare — no braces for values:

```
// correct
<TextInput value={input} onChange=set_input placeholder='Add item...' />
<For each=items>

// WRONG — JS braces
<Text fontSize={18} color="#e2e8f0">
<Box style={{ padding: 24 }}>
```

Exception: `{varName}` braces for dynamic value interpolation in text and prop bindings remain.

### Primitives

`Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `Canvas`, `Effect`

These are building blocks for classifiers. They appear in `.cls.tsz` files, not in page-level JSX (except `TextInput` and `Pressable` which have behavioral props like `onChange` and `onPress`).

---

## `<ffi>` — Foreign Function Interface (modules)

```
<ffi>
  open    @("libsqlite3.so")
  exec    @("libsqlite3.so")
  socket  @("std.posix", "socket")
</ffi>
```

`symbolName @("library")` or `symbolName @("library", "function")`.

---

## Scheduled Functions (`every`)

A timer is a function with `every ms` after its name:

```
<functions>
  tick every 33:
    set_frame is frame + 1

  autosave every 5000:
    saveSnapshot
</functions>
```

No `<timer>` block. It's still a function — composable, scoped, `stop` works. `every` just tells the compiler to schedule it.

---

## Ambient Namespaces

Always available. No import needed. These are modules the engine provides — the FFI and equations live inside, the author just uses named verbs.

### System / Device

| Namespace | Examples |
|-----------|----------|
| `sys.*` | `sys.user`, `sys.uptime`, `sys.os`, `sys.host`, `sys.kernel` |
| `time.*` | `time.hour`, `time.timestamp`, `time.fps`, `time.delta`, `time.elapsed` |
| `device.*` | `device.width`, `device.height`, `device.battery`, `device.online`, `device.dpi` |
| `locale.*` | `locale.language`, `locale.region`, `locale.direction`, `locale.currency` |
| `privacy.*` | `privacy.camera`, `privacy.mic`, `privacy.location`, `privacy.storage` |
| `input.*` | `input.mouse.x`, `input.mouse.y`, `input.keys.shift`, `input.touch.count` |

### Math

Common equations as named operations. The author never writes trig.

| Function | What it does |
|----------|-------------|
| `math.clamp(v, lo, hi)` | constrain value to range |
| `math.lerp(a, b, t)` | linear interpolation |
| `math.min(a, b)` | smaller of two |
| `math.max(a, b)` | larger of two |
| `math.abs(v)` | absolute value |
| `math.floor(v)` | round down |
| `math.ceil(v)` | round up |
| `math.slope(x1, y1, x2, y2)` | rise over run |
| `math.dist(x1, y1, x2, y2)` | euclidean distance |
| `math.angle(x1, y1, x2, y2)` | angle in degrees |
| `math.plasma(x, y, t)` | 4-wave sine interference, 0-1 |
| `math.turbulence(x, y, t, speed)` | multiplied sine noise, 0-1 |
| `math.waves(x, y, t, [...])` | layered directional waves, 0-1 |
| `math.fbm(x, y, octaves)` | fractal brownian motion, 0-1 |
| `math.voronoi(x, y)` | cell noise, 0-1 |
| `math.radial(x, y)` | distance from origin, normalized |
| `math.hue(v)` | 0-1 → rainbow rgb |
| `math.ramp(v, stops)` | value through color stops → rgb |
| `math.smoothstep(e0, e1, v)` | hermite curve, 0-1 |
| `math.drift(v, t, freq, amp)` | animated sine oscillation |
| `math.px(rem)` | rem to pixels at current dpi |
| `math.rem(px)` | pixels to rem |
| `math.vw(pct)` | viewport width % to pixels |
| `math.vh(pct)` | viewport height % to pixels |
| `math.map(v, inLo, inHi, outLo, outHi)` | remap value range |
| `math.deg(rad)` | radians to degrees |
| `math.rad(deg)` | degrees to radians |

### Animate

Interpolation and motion primitives for transitions and effects.

| Function | What it does |
|----------|-------------|
| `animate.shift(from, to, progress)` | linear move between values |
| `animate.fade(opacity, duration)` | opacity transition |
| `animate.spring(value, target, stiffness)` | spring physics interpolation |
| `animate.bounce(value, floor)` | bounce off a surface |
| `animate.ease(t)` | ease-in-out curve, 0-1 |
| `animate.elastic(t)` | elastic overshoot curve |

### Physics

Collision detection and body dynamics.

| Function | What it does |
|----------|-------------|
| `physics.collision(a, b)` | do two bodies overlap? |
| `physics.overlap(a, b)` | penetration depth |
| `physics.gravity(mass, distance)` | gravitational force |
| `physics.impulse(body, force, angle)` | apply force to body |
| `physics.velocity(body)` | current speed and direction |
| `physics.friction(body, surface)` | friction coefficient |

### Audio

Playback and control.

| Function | What it does |
|----------|-------------|
| `audio.play(track)` | start playback |
| `audio.pause(track)` | pause playback |
| `audio.stop(track)` | stop and reset |
| `audio.volume(track, level)` | set volume 0-100 |
| `audio.open(path)` | load a track |

### Media

Capture and hardware.

| Function | What it does |
|----------|-------------|
| `media.screenshot(path)` | capture screen to file |
| `media.startRecording(path)` | begin video recording |
| `media.stopRecording()` | end video recording |
| `media.openCamera()` | start camera feed |
| `media.captureFrame()` | grab one camera frame |
| `media.closeCamera()` | stop camera |
| `media.openMic()` | start microphone |
| `media.readMic()` | read audio buffer |
| `media.closeMic()` | stop microphone |

### Network

HTTP and WebSocket.

| Function | What it does |
|----------|-------------|
| `net.get(url)` | HTTP GET |
| `net.post(url, body)` | HTTP POST |
| `net.socket(url)` | open WebSocket |
| `net.send(socket, msg)` | send on WebSocket |
| `net.disconnect(socket)` | close WebSocket |

### File System

Local file operations.

| Function | What it does |
|----------|-------------|
| `fs.read(path)` | read file contents |
| `fs.write(path, data)` | write file |
| `fs.list(path)` | list directory |
| `fs.stat(path)` | file metadata |
| `fs.delete(path)` | remove file |
| `fs.mkdir(path)` | create directory |

### Database

SQLite operations.

| Function | What it does |
|----------|-------------|
| `db.init(path)` | open database |
| `db.write(sql)` | execute SQL (insert/update/create) |
| `db.read(sql)` | query SQL (select) |
| `db.close()` | close database |

### Crypto

Hashing and encryption.

| Function | What it does |
|----------|-------------|
| `crypto.hash(data)` | SHA-256 hash |
| `crypto.sign(key, data)` | HMAC signature |
| `crypto.random(n)` | n random bytes |
| `crypto.encrypt(key, data)` | AES encrypt |
| `crypto.decrypt(key, data)` | AES decrypt |

---

## Backend Hatches (`<script>`, `<lscript>`, `<zscript>`)

By default, the compiler picks the best backend for each function. When the author knows better, they force it with a hatch. **The syntax inside is identical** — same `<if>`, `<for>`, `<during>`, `is`, `exact`, everything. The hatch only changes the compilation target.

| Hatch | Target | Use when |
|-------|--------|----------|
| (none) | compiler picks | default — let the routing table decide |
| `<script>` | QuickJS (JavaScript) | browser APIs, JSON, string-heavy logic |
| `<lscript>` | LuaJIT | DSP threads, compute workers, audio |
| `<zscript>` | Zig (native) | hot loops, GPU, physics, zero-alloc paths |

### Inside `<functions>`

Wrap any function or group of functions in a hatch:

```
<functions>
  // compiler picks
  increment:
    set_count is count + 1

  // forced to Zig — hot particle loop
  <zscript>
  tick every 16:
    <for particles as p>
      p.x is p.x + p.vx * dt_sec
      p.y is p.y + p.vy * dt_sec
      p.vy is p.vy + gravity
    </for>
  </zscript>

  // forced to Lua — runs on DSP thread
  <lscript>
  processAudio:
    <for samples as s>
      s is s * gain
      s is math.clamp(s, -1.0, 1.0)
    </for>
  </lscript>

  // forced to JS — needs fetch/JSON
  <script>
  fetchExternal:
    result is net.get(apiUrl)
    set_data is result
  </script>
</functions>
```

### Rules

- **Same syntax everywhere.** The hatch does not change the language — only the backend.
- **Hatched functions compose with `+`.** A chain can mix backends: `validate + processAudio + updateUI` where each step compiles to a different target.
- **Hatched functions work with `every`, `cleanup`, `<during>`.** All function features apply.
- **The compiler handles boundary crossings.** Marshaling data between QuickJS/LuaJIT/Zig at the seams is automatic. The author doesn't think about it unless they want to.
- **Hatches can wrap multiple functions.** Everything between `<zscript>` and `</zscript>` compiles to that target.

### Cross-backend composition

A single composed chain can cross all three backends. The compiler handles marshaling at each boundary:

```
<functions>
  // one line — four functions, three backends
  frameTick:
    parseInput + processAudio + stepPhysics + updateUI

  // JS: parse JSON input, set state
  <script>
  parseInput:
    raw is input.poll
    commands is json.parse(raw)
    <for commands as cmd>
      <switch cmd.type>
        <case 'move'>
          set_player_target is cmd.position
        </case>
        <case 'fire'>
          set_firing is true
        </case>
      </switch>
    </for>
  </script>

  // Lua: audio DSP on worker thread
  <lscript>
  processAudio:
    <during firing>
      audio.playSample('laser')
    </during>
    <for audio_channels as ch>
      ch.volume is ch.volume * decay
      ch.pan is math.lerp(ch.pan, ch.target_pan, 0.1)
    </for>
  </lscript>

  // Zig: hot physics loop, zero alloc
  <zscript>
  stepPhysics:
    <for bodies as body>
      body.vx is body.vx + body.ax * dt_sec
      body.vy is body.vy + body.ay * dt_sec + gravity
      body.x is body.x + body.vx * dt_sec
      body.y is body.y + body.vy * dt_sec
      <for bodies as other>
        <if other not exact body and physics.collision(body, other)>
          physics.impulse(body, other)
        </if>
      </for>
    </for>
  </zscript>

  // default backend: UI update
  updateUI:
    set_frame is frame + 1
    set_fps_display is time.fps
</functions>
```

The author reads `parseInput + processAudio + stepPhysics + updateUI`. One line, one mental model. The hatches are implementation detail — the intent is the composition.

### When to use hatches

Most authors never will. The compiler's routing table picks the right backend. Hatches are for:

- **Performance-critical code** — force `<zscript>` for particle systems, physics, pixel loops
- **Thread affinity** — force `<lscript>` for audio DSP that must run on the Lua worker thread
- **Platform APIs** — force `<script>` for browser interop, JSON parsing, string manipulation
- **Debugging** — temporarily force a backend to isolate where a bug lives

---

## Imports

```
from './path/to/file'
```

Imports everything exported (classifiers, effects, glyphs).

---

## Anti-Patterns (NEVER in chad tier)

| Pattern | Why it's wrong | Use instead |
|---------|---------------|-------------|
| `const [x, setX] = useState(0)` | React hooks | `<var>` + `<state>` |
| `function App() { return () }` | JS function | `<page>` + `return()` |
| `() => { ... }` | JS arrow / closure | named function in `<functions>` |
| `if (x) { ... }` | JS control flow | `<if x> ... </if>` |
| `x === y` | JS equality | `x exact y` |
| `!x` | JS negation | `not x` |
| `x !== y` | JS inequality | `x not exact y` |
| `items.map(i => ...)` in JSX | JS map | `<For each=items>` |
| `{ key: val }` inline in `<var>` | JS object literal | data block (`is object` + `<name>`) |
| `[a, b, c]` inline in `<var>` | JS array literal | data block (`is array` + `<name>`) |
| `condition ? a : b` | JS ternary | `<if condition> ... <else> ... </if>` |
| `? stop : go` | old guard syntax | `<if condition> stop </if>` |
| `x = x + 1` | direct mutation | `set_x is x + 1` |
| `;` semicolons | JS statement separator | one statement per line |
| `function ... end` | Lua syntax | `<functions>` block |
| `local x = ...` | Lua local | `<var>` block |
| `style={{ ... }}` | JS object-in-JSX | classifier in `.cls.tsz` |
| `fontSize={18}` | visual prop on primitive | classifier |
| `color="#fff"` | visual prop on primitive | classifier |
| `<Text ...>` in page JSX | raw primitive | `<C.Label>`, `<C.Body>`, etc. |
| `<Box style={...}>` in page JSX | raw primitive | `<C.Card>`, `<C.Row>`, etc. |
| `try x catch err` | Zig error handling | `<if result>` check |
| `defer cleanup()` | Zig defer | `funcName cleanup:` pairing |
| `?Type` / `orelse` | Zig optionals | bare `<var>` + `<if thing>` check |
| `while (cond) { }` | Zig/JS while | `<while cond> ... </while>` |
| `switch (x) { }` | Zig/JS switch | `<switch x> <case val> ... </switch>` |
| `union { }` | Zig union keyword | `<TypeName is union>` in `<types>` |
| `<timer interval=N>` | old timer block | `funcName every N:` in `<functions>` |
| `a > b` | sigil comparison | `a above b` |
| `a < b` | sigil comparison | `a below b` |
| `a >= b` | sigil comparison | `a exact or above b` |
| `a <= b` | sigil comparison | `a exact or below b` |
| `useEffect(() => {}, [x])` | React effect hook | `<during x>` |
| `componentDidMount` | React lifecycle | `boot:` or `<during boot>` |
| `while (true) { }` for state | loop as state machine | `<during varName>` |
| nested if/else for UI states | branching chains | multiple `<during state>` blocks |
| raw JS inside `<script>` | language leak | intent syntax with `<script>` hatch |
| raw Lua inside `<lscript>` | language leak | intent syntax with `<lscript>` hatch |
| raw Zig inside `<zscript>` | language leak | intent syntax with `<zscript>` hatch |

---

## Module Composition (`<uses>`)

Modules can declare dependencies on other modules:

```
<module engine>
  <uses>
    terminal
    physics
    canvas
    paint
  </uses>

  <functions>
    startEngine:
      sdlInit + gpuInit + runLoop

    sdlInit:
      sdl.init('video')

    sdlInit cleanup:
      sdl.quit
  </functions>
</module>
```

`<uses>` makes the named modules available as namespaces. `terminal.spawn()`, `physics.tick()`, etc.

---

## Checklist — Reading a Conformance Test

After writing a test, walk through this:

1. Are ALL variables in `<var>`? No `const`, no `let`, no `useState`.
2. Are ALL setters in `<state>`? No inline `setX`.
3. Is ALL logic in `<functions>`? No inline functions in JSX.
4. Are conditionals `<if>` blocks? No ternaries, no `? stop : go`.
5. Are loops `<for>` blocks (in functions) or `<For>` (in JSX)? No `.map()` with arrows.
6. Are comparisons words only? `exact`, `not exact`, `above`, `below`, `exact or above`, `exact or below`. No `===`, `!==`, `==`, `>`, `<`, `>=`, `<=`.
7. Is negation `not`? No `!`.
8. Are event handlers bare names? No `() => {}`.
9. Are data literals in their own named blocks? No `[{...}]` in `<var>`.
10. Are big functions composed with `+`? No god functions.
