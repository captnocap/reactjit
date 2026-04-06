# Intent Dictionary

Single source of truth for chad-tier `.tsz` syntax. If a construct isn't here, it doesn't exist yet. If a conformance test drifts from this, the test is wrong.

---

## Core Principle

**Everything is a `<block>`.** Logic scopes into brackets. Statements say what happens. No sigils, no braces, no arrows, no JS/Lua/Zig leaking in.

---

## Compilation Model — Flat Arrival, Not Cascade

React is a party where one guest invites another who invites another — the compiler discovers the full dependency graph by following import chains. One change deep in the tree invalidates everything above it.

Intent syntax is a party where everyone arrives at the same time. The compiler does **preflight** — scans all files, reads every block header, knows the full guest list before compilation starts. You're in or you're not. No discovery chain. No cascade.

**Native stack note:** Forge + Smith’s **current** app path is **lua-tree** with embedded **`LUA_LOGIC`** (LuaJIT); Zig stamps tables to `Node`. Static Zig-only trees are legacy. See [ARCHITECTURE.md](ARCHITECTURE.md).

**Preflight steps:**

1. Scan all files in the directory
2. Read every block header: `<my awesome app>`, `<sidebar component>`, `<theme tokens>`, etc.
3. Read every extension: `.tsz`, `.c.tsz`, `.cls.tsz`, `.mod.tsz`
4. Build the full namespace map — who exists, what they are, where they belong
5. **Then** compile. No surprises.

This is why there are no imports. The compiler already knows everything.

### Three Namespaces

**1. Block scope** — lives and dies with the block.

`item` inside `<for>`, `child` inside `<for ... as child>`, local vars inside a function body. Invisible outside the block.

**2. File scope** — `<var>` declarations at the top.

Visible to everything in that file — functions, return(), the whole thing. Invisible to other files. Two files can both have a `count` var — different scopes, no collision.

**3. Ambient scope** — determined by the file's **block header**, not the filename.

`<super cool component>` IS the identity. The filename `filea.tsz` is for humans. The header is for the compiler. The extension `.c.tsz` tells the compiler it's a component. The header tells it WHICH component.

Name collisions are caught at preflight, before any code compiles. Two files both claiming `<counter component>` is an error. Two files both having `count` in `<var>` is fine — different file scopes.

**Files are portable.** Because identity lives in the header, not the filename, you can rename files, move them between directories, reorganize your project — nothing breaks. There are no file paths to update, no import chains to fix. The compiler reads `<sidebar component>` and knows what it is regardless of where the file lives or what it's called. The directory structure is for human organization, not compiler dependency.

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
- In `<var>` with `set_` prefix: the var has a reactive setter
- In `<config>` / data blocks: immutable field
- In expressions: strict equality comparison

---

## File Structure

Name first, type second. Reads like English: "home is a page", "counter is a component."

### App (`.tsz`) — root shell, owns navigation

The app is a layout that wraps pages. It has `<var>`, `<state>`, `<functions>`, and `return()` like anything else — its job is the chrome (sidebar, nav, header) with pages slotted in.

```
<my app>
  <var>
    pages is page array
    set_active is 'home'
  </var>

  <pages>
    home
    settings
    profile
  </pages>

  <functions>
    goTo:
      set_active is item
  </functions>

  return(
    <C.PageRow>
      <C.Sidebar>
        <C.Title>My App</C.Title>
        <for pages>
          <C.NavItem goTo>
            <if item exact active>
              <C.NavItemActive><C.NavLabelActive>{item}</C.NavLabelActive></C.NavItemActive>
            </if>
            <else>
              <C.NavItem><C.NavLabel>{item}</C.NavLabel></C.NavItem>
            </else>
          </C.NavItem>
        </for>
      </C.Sidebar>
      <C.Main>
        <active page />
      </C.Main>
    </C.PageRow>
  )
</my>
```

- `<pages>` is a data block (array). Adding a page = one line here + a file on disk.
- `goTo` works from inside `<for>` — `item` is the page name via scope.
- `<active page />` renders the page whose name matches the `active` variable.
- Pages don't know about each other. The app owns all routing.

### Widget (`.tsz`) — self-contained, no imports

```
<weather widget>
  <tokens> ... </tokens>
  <colors> ... </colors>
  <main> ... </main>
  <C.Name is Primitive> ... </C.Name>
  <name glyph> ... </name>
  <name effect> ... </name>
  <ffi> ... </ffi>
  <var> ... </var>
  <types> ... </types>
  <functions> ... </functions>
  return( ... )
</weather>
```

A widget is a complete app in one file. No `from`, no dependencies. Compiles to a binary by itself. The one-liner design philosophy.

**A widget can contain every block type.** Tokens, colors, theme blocks, classifiers, glyphs, effects, types, ffi, var, state, functions, and return — all inline. Everything the widget needs lives inside its opening and closing tags. If a widget uses a classifier, it defines that classifier. If it uses a theme token, it declares that token. Nothing comes from outside.

### Page (`.tsz`) — app entry, can import

```
<home page>
  <var> ... </var>
  <types> ... </types>
  <functions> ... </functions>
  return( ... )
</home>
```

Pages can `from` import components, classifiers, effects, glyphs.

### Component (`.c.tsz`) — reusable, consumed by pages

```
<counter component>
  <props>
    initial is 0
    max exact number
  </props>
  <var>
    set_count is initial
  </var>
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
      <C.Btn decrement><C.BtnLabel>-</C.BtnLabel></C.Btn>
      <C.Value>{count}</C.Value>
      <C.Btn increment><C.BtnLabel>+</C.BtnLabel></C.Btn>
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
    set_editing is false
    set_draft is string
  </var>
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
        <C.Btn save><C.BtnLabel>Save</C.BtnLabel></C.Btn>
      </if>
      <else>
        <C.Title>{card.title}</C.Title>
        <C.Btn startEdit><C.BtnLabel>Edit</C.BtnLabel></C.Btn>
      </else>
    </C.Card>
  )
</editableCard>
```

Used in a page:

```
<home page>
  <functions>
    persistCard:
      db.write('cards', item)
  </functions>

  return(
    <for cards as card>
      <EditableCard card=card onSave=persistCard />
    </for>
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
<home page>
  return(
    <Counter />
    <Counter initial=5 />
    <Counter initial=10 max=50 />
  )
</home>
```

### Lib (`.tsz`) — backend package, owns modules

A lib composes modules. Core modules are declared directly at the lib root. Optional/extended modules go in named groups — groups are the tree-shaking boundary.

```
<backend lib>
  database exact database
  auth exact auth
  cache exact cache
</backend>
```

Direct modules — `name exact module` at lib root. Access as `backend.database.init()`.

**Backend hatches on module groups** — wrap modules in `<zscript>`, `<lscript>`, or `<script>` to declare their compilation target. Same hatch pattern as in `<functions>`, applied one level up:

```
<layout lib>
  <zscript>
    flex
    measure
    padding
    margin
    size
  </zscript>
</layout>

<engine lib>
  <zscript>
    physics
    render
    collision
  </zscript>
  <lscript>
    audio
    dsp
  </lscript>
  <script>
    networking
    json
  </script>
</engine>
```

- Hatches are compilation directives, NOT namespace levels. Access is flat: `engine.physics.tick()`, `engine.audio.play()` — not `engine.zscript.physics`.
- Modules only compile in if referenced. The hatch is the tree-shaking boundary.
- Unhatchéd modules (direct `name exact module`) let the compiler pick the backend.
- The compiler matches module names to `.mod.tsz` files.

**Modules are ambient within their lib** — sibling modules can see each other directly:

```
// inside database.mod.tsz — auth is a sibling, visible directly
<database module>
  <functions>
    initWithAuth:
      auth.getToken + init
  </functions>
</database>
```

**Outside the lib, access goes through the lib name:**

```
<home page>
  <functions>
    boot:
      backend.database.init('app.db')
      backend.auth.init
  </functions>
</home>
```

The path tells you exactly where everything lives. `backend.database.init` — the `backend` lib, `database` module, `init` function.

**Lib state persists across pages.** A lib lives for the app's lifetime. Pages mount and unmount — the lib stays. Module state inside a lib survives page transitions:

```
// auth.mod.tsz — state persists as long as the lib is loaded
<auth module>
  <var>
    set_currentUser
    set_token is string
  </var>

  <functions>
    login(credentials):
      <if net.post('/auth', credentials) as result>
        set_currentUser is result.user
        set_token is result.token
      </if>
  </functions>
</auth>
```

Pages read lib state directly through the namespace:

```
<profile page>
  <functions>
    boot:
      <if not backend.auth.currentUser>
        navigate('login')
      </if>
  </functions>

  return(
    <C.Page>
      <C.Title>{backend.auth.currentUser.name}</C.Title>
    </C.Page>
  )
</profile>
```

State reads through the lib namespace are reactive — when `backend.auth.currentUser` changes (via `set_currentUser` inside the auth module), any page reading it re-renders.

**Only the engine's system modules are truly global ambients:** `sys.*`, `time.*`, `device.*`, `input.*`, `math.*`, `locale.*`, `privacy.*`. Everything else comes through a lib or a direct import.

### Module (`.mod.tsz`) — backend logic, no UI

```
<database module>
  <ffi> ... </ffi>
  <types> ... </types>
  <var> ... </var>
  <functions> ... </functions>
</database>
```

### Two Trees

```
UI:      app  → page → component
Backend: lib  → module
Solo:    widget (standalone, inlines everything)
```

A page can use modules from a lib. A module can't use pages. Clean separation.

| Type | Parent | Children | Has UI |
|------|--------|----------|--------|
| `app` | none | pages, widgets | shell |
| `lib` | none | modules | no |
| `page` | app | components | yes |
| `module` | lib | — | no |
| `component` | page | — | yes |
| `widget` | none (or app) | — | yes |

### Entry Points and File Extensions

**`.tsz` is the only entry point.** The first block tag tells the compiler the compile path:

- `<my app>` → app shell with navigation
- `<backend lib>` → module package
- `<weather widget>` → standalone binary
- `<home page>` → page (entry when standalone, child when inside app)

Non-entry files use extensions to identify their kind:

| Extension | What | Entry? | Example |
|-----------|------|--------|---------|
| `.tsz` | app, lib, page, widget | **yes** | `my.tsz`, `backend.tsz` |
| `.c.tsz` | component | no | `counter.c.tsz` |
| `.cls.tsz` | classifiers | no | `theme.cls.tsz` |
| `.tcls.tsz` | theme tokens + theme blocks | no | `theme.tcls.tsz` |
| `.effects.tsz` | effects | no | `fire.effects.tsz` |
| `.glyphs.tsz` | glyphs (shapes, composites, svg hatch) | no | `icons.glyphs.tsz` |
| `.script.tsz` | JS logic escape hatch | no | `bridge.script.tsz` |
| `.zscript.tsz` | Zig logic escape hatch | no | `physics.zscript.tsz` |
| `.lscript.tsz` | Lua logic escape hatch | no | `audio.lscript.tsz` |
| `.mod.tsz` | module | no | `database.mod.tsz` |

A `.tsz` entry (widget especially) can inline everything — classifiers, effects, glyphs, logic — all in one file. The separate extensions exist for organization in larger apps, not because the language requires them.

All blocks are optional. Order doesn't matter. Every block appears at most once (except data blocks — see below).

---

## `<var>` — Variable and State Declarations

One declaration per line. The `set_` prefix declares a reactive setter for the var.

```
<var>
  set_count is 0
  set_name is 'default'
  set_active is true
  set_input is string
  items is array
  config is object
  cards is objects
  filter
  MAX exact 100
</var>
```

- `set_name is value` — has a setter, initial value. Read as `name`, mutate as `set_name is newValue`.
- `set_name` — has a setter, uninitialized.
- `name is value` — no setter, initialized. Read-only or computed.
- `name` — no setter, uninitialized.
- `name exact value` — immutable constant. No setter possible.
- `name is string` / `name is number` — type declaration instead of empty literal (`string` not `''`).

**There is no separate `<state>` block.** The `set_` prefix in `<var>` declares both the variable and its setter in one line. In functions, `set_count is 0` calls the setter. In JSX, `count` reads the value.

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
  <Payload union>
    int is i64
    float is f64
    text is string
    blob is string
  </Payload>
</types>
```

`<Name union>` — same `<name type>` pattern as everything else: `<counter widget>`, `<home page>`, `<lava effect>`. A union is a type declaration, not a binding.

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

Everything else is either called by an event (bare word on a Pressable classifier), composed (`a + b + c`), or scheduled (`funcName every N:`). No `useEffect`, no `componentDidMount`, no `onInit`.

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
| `set_count is count + 1` | state mutation — `set_` prefix var, triggers re-render |
| `r.ttl is r.ttl - 1` | field write — on a scoped variable (loop, `<for>`) |
| `item.done is not item.done` | field write — on `<for>` item |

`set_` is never used for field writes. `field is value` is never used for state. The compiler knows the difference because state vars have the `set_` prefix in `<var>`.

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

**Functions see the scope of their call site.** If a function is called from inside a `<for>`, `item` is available. If called from outside, it isn't — the compiler errors.

This means:
- No parameterized event handlers. No closures. No arrows.
- `<C.Btn toggleItem>` inside a `<for>` gives `toggleItem` access to `item`.
- Functions that need `item` only work when called from a context that has it.
- The compiler enforces this — calling a function that uses `item` from outside a `<for>` is a compile error.

### `requires` — Scope Documentation

Functions that depend on scope variables declare it with `requires`:

```
<functions>
  toggleItem requires item:
    item.done is not item.done

  moveToDone requires item:
    item.col is 'done'

  transferItem requires item, targetCol:
    item.col is targetCol

  // no requires — works anywhere
  increment:
    set_count is count + 1
</functions>
```

- `requires` is a declaration, not a mechanism — the compiler already enforces scope
- It makes scope dependencies visible to humans and tooling
- If `requires` is declared and the function is called from the wrong context → compile error with a clear message
- If `requires` is omitted but the function uses scoped vars → compiler still catches it, tooling warns about missing `requires`

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

#### Conditional Binding (`as`)

When a call might return something or nothing, bind the result and branch on it in one step:

```
<if db.read('SELECT * FROM users') as rows>
  <for rows as row>
    process(row)
  </for>
</if>
<else>
  set_error is 'query failed'
</else>
```

`as` binds the return value to a name. The `<if>` is true when the value is non-null/non-empty. The bound name (`rows`) is scoped to that `<if>` block only.

This is the same `as` keyword used in `<for items as item>` and `<while cond as var>`. Same meaning everywhere: "bind this to a name."

```
<if net.get(apiUrl) as response>
  set_data is response
</if>

<if items.where(item.active) as active>
  set_count is active.length
</if>
```

No special "optional unwrapping" or "nullish" syntax. `<if thing as name>` — if it exists, bind it, enter the block. If not, skip to `<else>`.

### `<for>`

**Collection iteration:**

```
<for records as r>
  <if r.active>
    set_count is count + 1
  </if>
</for>
```

**Range iteration:**

```
<for 0..count as i>
  set_total is total + scores[i]
</for>

<for 1..11 as i>
  log(i)
</for>
```

`0..count` — `i` goes from 0 to count-1 (exclusive end). Same as every modern range. No inclusive variant — if you need 1 to 10, write `1..11`.

Range works with variables, literals, and expressions on either side. The `as` binding is required — bare `<for 0..10>` without a name is a compile error.

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
      <for items>
        <C.ListItem>{item.name}</C.ListItem>
      </for>
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

**Rules for `<during>`:**

1. **Multiple blocks, same variable** — all activate independently. No priority, no conflict. Declaration order determines execution order when they fire simultaneously.

```
<during loading>
  showSpinner
</during>

<during loading>
  logLoadStart
</during>
```

Both run when `loading` is true. Both stop when it's false. They don't know about each other.

2. **Nested `<during>`** — inner only activates when ALL ancestors are also active.

```
<during connected>
  <during authenticated>
    fetchData
  </during>
</during>
```

`fetchData` only runs when connected AND authenticated. If `connected` goes false, the inner block deactivates even if `authenticated` is still true. Reactivation of the outer re-checks the inner condition.

3. **`<during>` in components** — scoped to the component's lifetime. Activates when the component mounts AND the condition is true. Deactivates when the component unmounts OR the condition becomes false. Unmount always wins — a component's `<during>` blocks cannot outlive the component.

```
<recorder component>
  <var>
    active is false
  </var>

  <during active>
    media.captureFrame every 33
  </during>

  // when this component unmounts, the <during> stops
  // regardless of whether active is still true
</recorder>
```

4. **Cleanup** — when a `<during>` block deactivates, any `cleanup:` pairings inside it run in reverse order, same as function cleanup. Resources acquired during the block's lifetime are released.

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
  <case else>
    ignore
  </case>
</switch>
```

`<case else>` is the default branch — runs when no other case matches. Must be the last case. If omitted, unmatched values do nothing (no error, no fallthrough).

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
| `items.without(item)` | remove current item (inside `<for>` scope) |
| `items.concat(value)` | append, returns new collection |
| `items.reverse` | reversed copy of the collection (e.g. back-to-front iteration) |
| `items.length` | count |
| `items.search(query)` | fuzzy search across all string fields of items |
| `items.regex(pattern)` | regex match across all string fields of items |

**No `.map()`, `.filter()` with lambdas.** Use `.where()` with `item` from scope, or `<for>` blocks for transforms.

`item` inside `.where()` is implicit — it comes from the collection being operated on, same as inside `<for>`.

`.search()` and `.regex()` are ambient framework operations — the framework handles which fields to search. Works on collections of objects (searches all string fields) and on individual strings (`name.search('sun')` → true if name contains "sun"). `.regex()` takes a regex pattern string for when you need precise matching.

---

## JSX in `return()`

### Event Handlers

**Pressable-based classifiers** — bare words on the tag are what happens when you press it. The classifier already knows it's pressable:

```
// function call on press
<C.Btn decrement><C.BtnLabel>-</C.BtnLabel></C.Btn>

// animation on press
<C.Btn bounce><C.BtnLabel>Boop</C.BtnLabel></C.Btn>

// composed — animate AND mutate, same + operator as logic chains
<C.Btn bounce + decrement><C.BtnLabel>-</C.BtnLabel></C.Btn>

// animation + physics + function + audio
<C.Btn spring + impulse + decrement + audio.play('click')><C.BtnLabel>Go</C.BtnLabel></C.Btn>
```

The compiler resolves each word by registry:
- Function → from `<functions>` — call it
- Animation → from animations — run it
- Physics → from physics primitives — apply it
- Effect → from effects — fill it

**The `+` operator composes across all domains.** Same operator that chains `validateInput + appendItem + clearInput` in logic chains `bounce + haptic + decrement` on a pressable. One composition model, not four APIs.

And `<during>` still works on top:

```
<during dragging>
  spring + followCursor
</during>
```

Bare word on a Pressable = what happens on press. `<during>` = what happens while a state is active. `+` composes anything with anything.

**TextInput** — still uses explicit `onChange=` because it has multiple event types:

```
<TextInput value={input} onChange=set_input placeholder='Search...' />
```

**No inline closures. No arrows. No parameters.**

```
// WRONG — JS leak
onPress={() => { increment() }}
onPress={(e) => handleClick(e)}
```

There are no parameterized handlers. Scope handles it. Inside a `<for>`, the function sees `item` automatically. Define small named functions in `<functions>` that operate on `item`:

```
<functions>
  moveToDone:
    item.col is 'done'
</functions>

<for cards>
  <C.Btn moveToDone><C.BtnLabel>Done</C.BtnLabel></C.Btn>
</for>
```

### `<for>` in JSX — Collection Iteration

Same `<for>` block used in functions works in JSX. No capital `<For>`, no `each=`. Consistent everywhere.

```
<for items>
  <C.ListItem>{item.name}</C.ListItem>
</for>
```

- `item` is implicit — always available inside `<for>`
- `as name` is optional — use it for readability or nested loops where `item` would collide:

```
<for channels as ch>
  <for ch.effects as fx>
    <C.Body>{ch.label + ': ' + fx.name}</C.Body>
  </for>
</for>
```

**No `{items.map(...)}`**. Use `<for>`.

### Three Visual Layers

All referenced by name. All defined in their own files. No inline styling anywhere.

**1. Classifiers** (`C.Name`) — structural styling (layout, colors, spacing):

```
<C.Card> ... </C.Card>
<C.Title>text</C.Title>
<C.Value>{count}</C.Value>
```

Defined in `.cls.tsz` files. `C.Name` pattern. If you need a new look, add a classifier.

#### Classifier Definition Syntax

Classifiers are defined in `.cls.tsz` files using the same block + binding syntax as everything else. No JS objects, no `classifier({})` calls.

Each classifier is a block: `<C.Name is Primitive>` with properties inside.

```
<C.Row is Box>
  flexDirection exact row
  gap is theme-spaceMd
  alignItems is center
</C.Row>

<C.Title is Text>
  fontSize is 18
  color is theme-text
</C.Title>

<C.Btn is Pressable>
  backgroundColor is theme-primary
  borderRadius is theme-radiusSm
  padding is theme-spaceMd
  alignItems is center
  justifyContent is center
</C.Btn>

<C.Divider is Box>
  height exact 1
  backgroundColor is theme-borderLight
</C.Divider>
```

**Binding rules in classifiers:**

- `prop is value` — default, overridable by the active theme
- `prop exact value` — locked, structural, no override ever

Use `exact` when changing the prop would break the classifier's identity (a Row that isn't `flexDirection: row` isn't a Row). Use `is` when the prop is cosmetic or themeable.

**Base type** — `is Primitive` on the block tag declares what primitive this classifier wraps: `Box`, `Text`, `Pressable`, `ScrollView`, `Image`, `Canvas`, `Effect`.

**No JS objects, no `classifier({})`, no `style: {}`.** Classifiers are blocks, same as everything else.

#### Named Colors

Colors are ambient — the engine provides a default palette of named colors: `red`, `blue`, `green`, `purple`, `amber`, `gray`, `white`, `black`, `cyan`, `teal`, `pink`, `orange`, `slate`, etc. Just use them. No definition needed.

**Override or extend with `<colors>`:**

```
<colors>
  // override the default red entirely
  red exact '#cc0000'

  // add variants to a color
  <red>
    dark exact '#4a0000'
    light exact '#ff6666'
    lava exact '#ff4400'
  </red>

  <blue>
    dark exact '#0f172a'
    deep exact '#1e293b'
    mid exact '#334155'
  </blue>
</colors>
```

- Bare `red` — engine default. No definition needed.
- `red exact '#cc0000'` — override the default for your app.
- `<red>` with variants — access as `red(dark)`, `red(lava)`, etc.
- Hex escape `'#0f172a'` — always available for precise values.

**Gradients** are defined with `gradient` on the block tag. Stops are colors with percentage weights. Used anywhere a color goes:

```
<colors>
  <ocean gradient>
    blue is 40
    '#1e293b' is 50
    gray is 10
    angle is vertical
  </ocean>

  <sunset gradient>
    orange is 30
    pink is 40
    purple is 30
    angle is horizontal
  </sunset>
</colors>

<main>
  bg is ocean
  accent is sunset
</main>
```

- Stops are named colors or hex values with percentage weights (`blue is 40` = 40% blue)
- `angle` — `vertical`, `horizontal`, `diagonal`, or a degree value
- Used like any color: `bg is ocean`, `fill is sunset`

#### Theme Token Syntax

Tokens are defined in `.tcls.tsz` files. A `<tokens>` block declares the contract, a `<colors>` block defines custom/variant colors, then named theme blocks assign values using named colors.

```
<tokens>
  bg
  bgAlt
  surface
  text
  textSecondary
  textDim
  primary
  accent
  success
  warning
  error
  border
  spaceSm
  spaceMd
  spaceLg
  radiusSm
  radiusMd
  fontSm
  fontMd
  fontLg
</tokens>

<colors>
  <blue>
    dark exact '#0f172a'
    deep exact '#1e293b'
  </blue>
  <gray>
    mid exact '#334155'
    light exact '#64748b'
    bright exact '#e2e8f0'
  </gray>
</colors>

<main>
  bg is blue(dark)
  bgAlt is blue(deep)
  surface is gray(mid)
  text is white
  textSecondary is gray(bright)
  textDim is gray(light)
  primary is blue
  accent is purple
  success is green
  warning is amber
  error is red
  border is gray(mid)
  spaceSm is 4
  spaceMd is 8
  spaceLg is 16
  radiusSm is 4
  radiusMd is 8
  fontSm is 11
  fontMd is 13
  fontLg is 18
</main>

<light>
  bg is white
  bgAlt is gray(bright)
  surface is gray(bright)
  text is blue(dark)
  textSecondary is gray(mid)
  primary is blue
  accent is purple
  success is green
  warning is amber
  error is red
  border is gray(bright)
</light>
```

**Rules:**

- `<tokens>` declares names only — no values, no types. Just the contract.
- `<colors>` defines custom colors and variants. Optional — ambient colors work without it.
- `<main>` is the default theme. Required. Every token must have a value here.
- Other theme blocks (`<light>`, `<dark>`, `<high-contrast>`, etc.) inherit from `<main>`. Only specify tokens that differ.
- Classifiers reference tokens as `theme-name` (e.g., `theme-bg`, `theme-primary`). The active theme resolves the value.
- Effects can reference tokens too — `deep is theme-lavaDeep` in an effect's `<var>`.
- **No `.vcls.tsz` files.** Theme blocks replace variant classifiers entirely. To add a theme, add a block in the `.tcls.tsz` file.

**2. Effects** (bare name on tag) — live procedural fills:

```
<Text lava>MOLTEN LETTERS</Text>
<Text plasma>RAINBOW TEXT</Text>
<Text ocean>DEEP CURRENT</Text>
<C.Card ember> ... </C.Card>
```

The effect name IS the prop. A bare word on a tag that matches a named effect applies that effect as a fill. Defined in `.effects.tsz` files.

#### Effect Definition Syntax

Effects are defined in `.effects.tsz` files. An effect is a named block whose required contract is a `fill(x, y, t)` function returning a color. There is no special "effect syntax" — it's a block with `<var>` and `<functions>`, same as everything else. The `effect` keyword on the tag tells the compiler this block fulfills the effect contract.

```
<lava effect>
  <var>
    speed is 0.5
    intensity is 0.8
    deep is theme-lavaDeep
    mid is theme-lavaMid
    hot is theme-lavaHot
    peak is theme-lavaPeak
  </var>

  <functions>
    fill(x, y, t):
      heat is math.turbulence(x, y, t * speed)
      math.ramp(heat * intensity, deep, mid, hot, peak)
  </functions>
</lava>

<plasma effect>
  <functions>
    fill(x, y, t):
      v is math.plasma(x, y, t)
      math.hue(v)
  </functions>
</plasma>

<ocean effect>
  <var>
    depth is 3
    shallow is theme-oceanShallow
    mid is theme-oceanMid
    deep is theme-oceanDeep
    foam is theme-oceanFoam
  </var>

  <functions>
    fill(x, y, t):
      w is math.waves(x, y, t, depth)
      math.ramp(w, deep, mid, shallow, foam)
  </functions>
</ocean>
```

An effect is just a block. It has `<var>` and `<functions>` like anything else. The only contract: it must have a `fill(x, y, t)` function that returns a color.

- `<var>` declares tunable parameters — theme tokens work anywhere a color literal works
- Colors with `is` are themeable (dark mode gets different lava). `exact` locks them.
- `fill(x, y, t)` — called per pixel per frame
- `x`, `y` are normalized 0-1 coordinates within the element
- `t` is elapsed time in seconds
- Return value is a color (theme token, hex string, or result of `math.hue`/`math.ramp`)

**3. Animations** (bare word or composed) — motion and transitions:

Common animations are ambient — the engine provides: `fadeIn`, `fadeOut`, `slideUp`, `slideDown`, `scaleIn`, `scaleOut`, `bounce`, `spring`, `shake`. Just use them.

Custom animations defined as blocks:

```
<slideUp animation>
  property is translateY
  from is 100
  to is 0
  duration is 300
  easing is ease
</slideUp>

<pulse animation>
  property is scale
  from is 1
  to is 1.1
  duration is 200
  easing is elastic
  repeat is true
</pulse>
```

Applied as bare words on any element: `<C.Card slideUp>`, or composed: `<C.Card slideUp + fadeIn>`. On Pressable classifiers, they run on press. With `<during>`, they run while a state is active.

**4. Glyphs** (`:name:` in text) — Discord-style inline shortcodes:

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

#### Glyph Tiers

**Tier 1 — Ambient glyphs.** The engine provides common glyphs with theme-aware defaults: `:star:`, `:check:`, `:warning:`, `:error:`, `:circle:`, `:play:`, `:pause:`, etc. Just use them — no definition needed. Like `Box`/`Text` are ambient UI primitives, these are ambient glyph primitives.

**Tier 2 — Customized ambient.** Override properties of an existing ambient glyph using `is`/`exact` — same binding semantics as everywhere else:

```
// custom star under a new name — :star: stays ambient, :thick_star: is yours
<thick_star is star glyph>
  thickness exact 15
  fill is theme-warning
</thick_star>

// take the star name — :star: is now YOUR version in this file
<star is star glyph>
  points exact 7
  fill is theme-accent
</star>

// alias the default under a new name — no modifications, self-closing
<normal_star exact star glyph />
```

- `<name is builtin glyph>` — creates a glyph based on the builtin with overrides (`is` = mutable, has modifications)
- `<name exact builtin glyph />` — aliases the builtin unchanged (`exact` = locked, as-is)
- If you use the builtin's own name (`<star is star glyph>`), you shadow it locally — that name is now yours

**Tier 3 — Composed glyphs.** Build custom glyphs from shape primitives with `<layers>`:

```
<check glyph>
  <layers>
    stroke
  </layers>
  <stroke exact path>
    points is '5,12 10,17 20,7'
    thickness is 2
    cap is round
    fill is theme-success
  </stroke>
</check>

<error glyph>
  <layers>
    disc
    cross
  </layers>
  <disc exact circle>
    fill is theme-error
  </disc>
  <cross exact x>
    thickness is 2
    fill is theme-bg
    inset is 4
  </cross>
</error>
```

Shape primitives: `circle`, `line`, `triangle`, `arc`, `polygon`, `path`, `x`, `star`. Each takes properties via `is`/`exact`: `thickness`, `fill`, `inset`, `points`, `cap`, `tilt`, `opacity`.

**Each layer is a tiny scene** — it can have its own fill, animation, and effects:

```
<pentagram glyph>
  <layers>
    stroke
    ring
  </layers>
  <stroke exact path>
    points is '...'
    fill is fire
    animation is pulse
  </stroke>
  <ring exact circle>
    fill is red(dark)
    animation is spin
  </ring>
  <merge>
    stroke mask ring
  </merge>
</pentagram>
```

- `fill` accepts colors, theme tokens, or effects: `fill is red`, `fill is theme-primary`, `fill is fire`
- `animation` applies a named animation to the layer: `animation is spin`, `animation is pulse`
- `<merge>` controls compositing between layers: `stroke mask ring` (stroke clips to ring). Operations: `mask`, `blend`, `overlay`

The whole thing packs into a single shortcode: `:pentagram:`. The engine handles layered composition, animated fills, and merge operations. `:pentagram[ocean]:` overrides all fill layers with the ocean effect.

`<layers>` declares composition order (bottom to top). `<merge>` declares compositing operations between named layers.

**Tier 4 — `<svg>` hatch.** Raw SVG path data for exotic shapes not covered by primitives. Discouraged but allowed — same pattern as `<script>`/`<zscript>`/`<lscript>` hatches:

```
<exotic glyph>
  <svg>
    d is 'M12 2C6.48 2 2 ...'
    fill is theme-accent
  </svg>
</exotic>
```

#### Glyph Rules

- Glyphs are defined in `.glyphs.tsz` files, or inline in widgets
- Common glyphs (star, check, warning, error, circle, play, pause) are engine ambients — no definition needed
- Glyphs scale with the surrounding text's `fontSize`
- `:name[effect]:` in text overrides the glyph's default fill with a named effect
- `fill` — default fill color (hex, theme token, or effect name)

**Chad-tier JSX has no `style=` prop.** No visual props (`fontSize`, `color`, `backgroundColor`) on primitives. Classifiers handle structure, effects handle procedural fills, glyphs handle inline assets.

Primitives (`Box`, `Text`, `Pressable`, etc.) appear in `.cls.tsz` definitions, not directly in page files.

### Props

Props are bare — no braces for values:

```
// correct
<TextInput value={input} onChange=set_input placeholder='Add item...' />
<for items>

// WRONG — JS braces
<Text fontSize={18} color="#e2e8f0">
<Box style={{ padding: 24 }}>
```

Exception: `{varName}` braces for dynamic value interpolation in text and prop bindings remain.

### Primitives

`Box`, `Text`, `Image`, `Pressable`, `ScrollView`, `TextInput`, `Canvas`, `Effect`

These are building blocks for classifiers. They appear in `.cls.tsz` files, not in page-level JSX (except `TextInput` which has behavioral props like `onChange` and `value`).

---

## `<ffi>` — Foreign Function Interface (modules)

The block name is the C library name. List the function suffixes inside:

```
<sqlite3 ffi>
  open
  close
  errmsg
  exec
  prepare_v2
</sqlite3>
```

The compiler resolves `open` → `sqlite3_open`, `close` → `sqlite3_close`, etc. The underscore join is implicit — every C library uses `libname_function`. You don't think about it.

**Multiple libraries** — one block per library, no wrapper needed:

```
<sqlite3 ffi>
  open
  close
  exec
</sqlite3>

<libmpv ffi>
  create
  play
  destroy
</libmpv>
```

Each `<libname ffi>` is independent. No master `<ffi>` block. The compiler handles prefix join and library linking per block.

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

## Callbacks

A callback is just "if this happened, do this." And we already have that:

```
<functions>
  fetchData:
    result is net.get(apiUrl)
    <if result>
      set_data is result
    </if>
    <if not result>
      catchError('fetch failed')
    </if>
</functions>
```

The "callback" is just the <if> after the call. There's no special callback surface because there is no async ceremony. You call a thing, you check what happened, you respond. Linear.

---

## `<log>` — Debug Wrapping

Wrap anything in `<log>` to trace what ran, what it returned, and how long it took. No `console.log`, no `print`, no debug statements to clean up.

```
<functions>
  saveData:
    <log>
      fetchData + validateData + writeToDb
    </log>
</functions>
```

Named logs tag their entries for filtering:

```
<log save>
  fetchData + validateData + writeToDb
</log>
```

Nested logs produce a timing tree:

```
<log frame>
  <log input>
    pollEvents
  </log>
  <log physics>
    stepPhysics
  </log>
  <log paint>
    paintFrame
  </log>
</log>
```

Frame total with input/physics/paint breakdowns — declarative telemetry.

Works inside `<during>`:

```
<during loading>
  <log>
    fetchData
  </log>
</during>
```

Every activation gets logged. Deactivation logs the duration.

**Production:** Strip `<log>` tags — they compile to nothing. Or leave them in to feed the telemetry/debug system.

---

  ┌─────────────────────┬────────────────────────┐
  │ What people call it │  What it actually is   │
  ├─────────────────────┼────────────────────────┤
  │ callback            │ <if> after a call      │
  ├─────────────────────┼────────────────────────┤
  │ event listener      │ <during> on a variable │
  ├─────────────────────┼────────────────────────┤
  │ promise.then        │ <if result>            	│
  ├─────────────────────┼────────────────────────┤
  │ onChange handler    │ bare word on classifier │
  ├─────────────────────┼────────────────────────┤
  │ subscription        │ <during module.state>    │
  └─────────────────────┴────────────────────────┘

---

## Ambient Namespaces (Engine-Provided Only)

These are the **only** globally ambient namespaces. They are provided by the engine runtime — always available, no import needed. User-created modules are NOT ambient — they live inside a `<lib>` and are accessed through the lib name (e.g. `backend.database.init`).

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

## `<semantics>` — Custom Binding Keywords

Define new keywords that expand to intent syntax. The author teaches the compiler what a word means:

```
<semantics>
  <has exact function>
    <if var not initialized>
      set_var is value
      set_var.shape is declared
    </if>
  </has>

  <owns exact function>
    // like has, but with cleanup pairing — when parent dies, children die
  </owns>

  <watches exact function>
    // reactive binding — when source changes, target updates
  </watches>

  <mirrors exact function>
    // two-way binding
  </mirrors>
</semantics>
```

Now anywhere in the project:

```
<var>
  player has position
  player has health
  player owns inventory
  sidebar watches auth.currentUser
  draft mirrors input
</var>
```

Reads like English, compiles to whatever the semantic expands to.

- Custom keywords are macros that expand to `is`/`exact`/`<if>`/`<for>` primitives
- `<semantics>` at the lib level means the whole lib shares the vocabulary
- Domain-specific vocabularies that read like the domain: a game framework where `owns`, `spawns`, `collides` are first-class verbs. A music app where `plays`, `loops`, `fades` are binding keywords.
- The language is opinionated about syntax (no sigils, words only). It's not opinionated about taste. What you name your semantics is on you.

---

## Imports

**There are no imports.** File extensions tell the compiler what belongs to the app. `.cls.tsz`, `.effects.tsz`, `.glyphs.tsz`, `.c.tsz`, `.mod.tsz` files in the app directory are ambient — the compiler includes them automatically. Widgets inline everything.

---

## Anti-Patterns (NEVER in chad tier)

| Pattern | Why it's wrong | Use instead |
|---------|---------------|-------------|
| `const [x, setX] = useState(0)` | React hooks | `set_x is 0` in `<var>` |
| `<state> set_x </state>` | separate state block | `set_x` in `<var>` (prefix IS the setter) |
| `from './file'` | explicit import | file extensions are ambient — no imports needed |
| `onPress=funcName` | explicit handler prop | bare word on Pressable classifier: `<C.Btn funcName>` |
| `function App() { return () }` | JS function | `<page>` + `return()` |
| `() => { ... }` | JS arrow / closure | named function in `<functions>` |
| `if (x) { ... }` | JS control flow | `<if x> ... </if>` |
| `x === y` | JS equality | `x exact y` |
| `!x` | JS negation | `not x` |
| `x !== y` | JS inequality | `x not exact y` |
| `items.map(i => ...)` in JSX | JS map | `<for var>` |
| `<For each=items>` | React-style iteration | `<for var>` (lowercase, iterates a `<var>` name) |
| `{ key: val }` inline in `<var>` | JS object literal | data block (`is object` + `<name>`) |
| `[a, b, c]` inline in `<var>` | JS array literal | data block (`is array` + `<name>`) |
| `condition ? a : b` | JS ternary | `<if condition> ... <else> ... </if>` |
| `? stop : go` | old guard syntax | `<if condition> stop </if>` |
| `a ?? b` | JS null coalescing | `<if a> a </if> <else> b </else>` |
| `x = x + 1` | direct mutation | `set_x is x + 1` |
| `;` semicolons | JS statement separator | one statement per line |
| `function ... end` | Lua syntax | `<functions>` block |
| `local x = ...` | Lua local | `<var>` block |
| `style={{ ... }}` | JS object-in-JSX | classifier in `.cls.tsz` |
| `fontSize={18}` | visual prop on primitive | classifier |
| `color="#fff"` | visual prop on primitive | classifier |
| `classifier({ Name: { type: 'Box', style: {...} } })` | JS object classifier | `<C.Name is Box>` block in `.cls.tsz` |
| `<Text ...>` in page JSX | raw primitive | `<C.Label>`, `<C.Body>`, etc. |
| `<Box style={...}>` in page JSX | raw primitive | `<C.Card>`, `<C.Row>`, etc. |
| `try x catch err` | Zig error handling | `<if result>` check |
| `defer cleanup()` | Zig defer | `funcName cleanup:` pairing |
| `?Type` / `orelse` | Zig optionals | bare `<var>` + `<if thing>` check |
| `while (cond) { }` | Zig/JS while | `<while cond> ... </while>` |
| `switch (x) { }` | Zig/JS switch | `<switch x> <case val> ... </switch>` |
| `union { }` | Zig union keyword | `<TypeName union>` in `<types>` |
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
| `for (let i = 0; i < n; i++)` | JS index loop | `<for 0..n as i>` |
| `default:` in switch | JS/Zig default | `<case else>` |
| `if (x = call()) { use(x) }` | assignment-in-condition | `<if call() as x>` |
| `effect({ fill: (x,y,t) => ... })` | JS effect definition | `<name effect>` block in `.effects.tsz` |
| `symbol @("library")` in `<ffi>` | old FFI per-line syntax | `<libname ffi>` block with suffix names |

---

## Module Composition (`<uses>`)

Modules can declare dependencies on other modules:

```
<engine module>
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
</engine>
```

`<uses>` makes the named modules available as namespaces. `terminal.spawn()`, `physics.tick()`, etc.

---

## Checklist — Reading a Conformance Test

After writing a test, walk through this:

1. Are ALL variables in `<var>`? No `const`, no `let`, no `useState`.
2. Do all mutable vars use `set_` prefix in `<var>`? No separate `<state>` block.
3. Is ALL logic in `<functions>`? No inline functions in JSX.
4. Are conditionals `<if>` blocks? No ternaries, no `? stop : go`.
5. Are loops `<for>` blocks (same in functions and JSX)? No `.map()` with arrows.
6. Are comparisons words only? `exact`, `not exact`, `above`, `below`, `exact or above`, `exact or below`. No `===`, `!==`, `==`, `>`, `<`, `>=`, `<=`.
7. Is negation `not`? No `!`.
8. Are event handlers bare words on Pressable classifiers? No `onPress=`, no `() => {}`.
9. Are data literals in their own named blocks? No `[{...}]` in `<var>`.
10. Are big functions composed with `+`? No god functions.
11. Are classifiers defined as blocks? No `classifier({})` JS objects.
12. Are effects defined as `<name effect>` blocks with `fill(x, y, t)`? No JS functions.
13. Are common glyphs using ambients (`:star:`, `:check:`, etc.) without unnecessary definitions? Custom glyphs composed from shape primitives with `<layers>`? No raw SVG `d` paths (use `<svg>` hatch only as last resort)?
14. Does `<switch>` use `<case else>` for default? No bare `default:`.
15. Do numeric loops use `<for 0..n as i>`? No `for (let i = 0; ...)`.
16. Does conditional binding use `<if call() as name>`? No assignment-in-condition.
