# Intent Syntax Specification (Chad Tier)

**Version:** 0.1.0  
**Status:** Draft for conformance test validation  
**Date:** 2026-03-31

---

## Overview

Intent syntax is a declarative, constraint-based surface for ReactJIT that prioritizes:

1. **Compiler efficiency** — Minimal ambiguity, single-pass parseable
2. **Explicit exposure** — Everything declared at top level, nothing hidden
3. **AI readability** — Linear top-to-bottom comprehension, no indirection

This document is the **Single Source of Truth (SSoT)** for chad-tier syntax. Conformance tests validate against this spec.

---

## Design Philosophy

### Visibility Rule
**All state, all logic, all types must be declared in named top-level blocks.** No hidden closures. No implicit captures. No inline function definitions in event handlers.

### Naming Convention (enforced)
| Declaration | Usage | Mutation |
|-------------|-------|----------|
| `foo is 0` | `foo` (read) | `set_foo to value` |
| `items` (uninitialized) | `items` (read) | `set_items to value` |

The `set_` prefix is **mandatory** for state mutations. The compiler enforces this pairing.

---

## File Structure

### Pages (`.tsz`)
```
<page route=name>
  <var>       ... </var>      // variable declarations
  <state>     ... </state>    // setter declarations  
  <functions> ... </functions> // logic definitions
  <timer interval=ms> ... </timer>  // optional: scheduled calls
  return( ... )               // JSX view
</page>
```

### Modules (`.mod.tsz`)
```
<module name>
  <imports>   ... </imports>  // optional: FFI imports
  <ffi>       ... </ffi>      // optional: raw FFI bindings
  <types>     ... </types>    // type definitions
  <const>     ... </const>    // optional: module constants
  <state>     ... </state>    // module state
  <functions> ... </functions> // module functions
</module>
```

---

## Keyword Reference

### Declaration Keywords

| Keyword | Context | Meaning |
|---------|---------|---------|
| `is` | `<var>` | Initialize variable with value |
| `from` | file scope | Import classifiers/glyphs/effects |
| `to` | `<functions>` | State assignment target |

### Control Flow Keywords

| Keyword | Usage | Meaning |
|---------|-------|---------|
| `exact` | comparisons | Strict equality (`===` equivalent) |
| `stop` | guard expressions | Early return / halt execution |
| `go` | guard expressions | Continue to next statement |

### Type Keywords

| Keyword | Context | Meaning |
|---------|---------|---------|
| `fn` | `<types>` | Function type signature |
| `union` | `<types>` | Tagged union type |
| `?` | type suffix | Optional/nullable type |

---

## Block Specifications

### `<var>` — Variable Declaration Block

**Purpose:** Declare all local state with optional initial values.

**Syntax:**
```
<var>
  name is value      // initialized
  name               // uninitialized (undefined until set)
  name is [a, b, c]  // array literal
  name is {k: v}     // object literal
```

**Rules:**
- One declaration per line
- `is` separates name from initial value
- No expressions on the right-hand side (literals only)
- Uninitialized vars must be declared before use in `<functions>`

**Valid:**
```
<var>
  count is 0
  items is []
  input is ''
  filter is 'all'
  nextId is 4
  logs               // uninitialized, will be set later
```

**Invalid:**
```
<var>
  count is getInitial()     // ERROR: function calls not allowed
  doubled is count * 2      // ERROR: expressions not allowed
```

---

### `<state>` — Setter Declaration Block

**Purpose:** Declare which state variables can be mutated and their setter names.

**Syntax:**
```
<state>
  set_name
  set_other
```

**Rules:**
- One setter name per line
- Must match pattern `set_<varname>` where `<varname>` exists in `<var>`
- Setters declared here are the **only** way to mutate state

**Valid:**
```
<var>
  count is 0
  items is []

<state>
  set_count
  set_items
```

**Invalid:**
```
<state>
  set_count      // ERROR: no 'count' in <var>
  increment      // ERROR: not a setter pattern
```

---

### `<functions>` — Logic Definition Block

**Purpose:** Define all application logic as named, linear statement sequences.

**Syntax:**
```
<functions>
  // Nullary function (no arguments)
  funcName:
    statements

  // Function with arguments
  funcName(arg: type, arg2: type): returnType
    statements

  // Guard expression
  condition ? stop : go

  // State mutation
  set_var to expression

  // Ternary in expressions
  condition ? ifTrue : ifFalse
```

**Statement Types:**

1. **Guard:** `condition ? stop : go`
   - If condition is true, stop (return early)
   - If false, go (continue)
   - `go` is required — explicit continuation

2. **State Mutation:** `set_name to expression`
   - Only `set_` names from `<state>` can be targets
   - `to` separates target from source

3. **Local Binding:** `name = expression`
   - Creates temporary, function-scoped binding
   - Not state — disappears after function returns

4. **For Loop:** `for collection as item: statements`
   - Iterates over arrays or slices
   - `continue` skips to next iteration

5. **Switch:** `switch expr: case: statements`
   - Pattern matching on enums
   - Falls through unless `stop` or `return`

6. **Return:** `return expression`
   - Returns value from function
   - Last expression is implicit return

**Valid:**
```
<functions>
  // Guard pattern
  addItem:
    input exact '' ? stop : go
    set_items to items.concat([input])
    set_input to ''

  // With args and local binding
  double(x: int): int
    result = x * 2
    return result

  // Computed property
  activeCount:
    items.filter(i => !i.done).length

  // For loop with condition
  sum(): int
    total = 0
    for items as item:
      item.active == true
        ? total = total + item.value
        : continue
    return total
```

**Invalid:**
```
<functions>
  addItem:
    if (input === '') return        // ERROR: JS syntax
    items.push(input)               // ERROR: direct mutation
    set_count to count + 1          // OK
    count = count + 1               // ERROR: missing set_
```

---

### `<types>` — Type Definition Block (Modules)

**Purpose:** Define enums, structs, unions, and function types.

**Syntax:**
```
<types>
  // Enum (PascalCase or lowercase)
  Status: pending | active | done

  // Struct with defaults
  Config: {
    max: int = 100,
    min: int = 0,
    enabled: bool = true
  }

  // Tagged union
  Result: union {
    ok: int,
    err: string
  }

  // Function type
  Handler: fn(arg: string) -> void
  Predicate: fn(item: Item) -> bool
```

**Rules:**
- Enum variants: lowercase or PascalCase, must be unique
- Struct fields: comma-separated, trailing comma allowed
- Default values: only literals
- Nested structs: full type reference required

**Valid:**
```
<types>
  Priority: LOW | MEDIUM | HIGH
  
  Vec2: {
    x: f32 = 0.0,
    y: f32 = 0.0
  }

  Record: {
    id: u8 = 0,
    pos: Vec2,
    active: bool = true
  }

  Callback: fn(data: string) -> void
```

---

### `<ffi>` — Foreign Function Interface Block (Modules)

**Purpose:** Bind to native libraries.

**Syntax:**
```
<ffi>
  symbolName @("library", "function")
  symbolName @("library")           // symbol same as function name
```

**Valid:**
```
<ffi>
  socket  @("std.posix", "socket")
  connect @("std.posix", "connect")
  open    @("libsqlite3.so")
```

---

### `<For>` — Collection Iteration (JSX)

**Purpose:** Render elements for each item in a collection.

**Syntax:**
```
<For each=collection>
  ... JSX using `item` ...
</For>
```

**Rules:**
- `each` prop references a variable from `<var>` (no braces preferred)
- Inside `<For>`, `item` refers to the current element
- For nested maps, use `item` in inner, named destructuring in outer

**Valid:**
```
<For each=messages>
  <C.Body>{item.text}</C.Body>
</For>

<For each={visible}>   // braces also accepted
  <C.Item>{item.name}</C.Item>
</For>
```

**Invalid:**
```
{items.map(i => (...))}     // ERROR: JS map syntax
<For each={items.filter(...)}>  // ERROR: expressions in each
```

---

### `<timer>` — Scheduled Execution Block (Provisional)

**Status:** Only appears in manifest. Syntax not finalized.

**Purpose:** Call functions at intervals.

**Syntax:**
```
<timer interval=milliseconds>
  functionName
```

**Rules:**
- One function reference per timer
- Function must be nullary (no arguments)
- Interval is milliseconds

**Valid:**
```
<timer interval=33>
  tick
```

---

## Expression Grammar

### Comparisons

| Syntax | Meaning |
|--------|---------|
| `a exact b` | Strict equality (`a === b`) |
| `a !== b` | Strict inequality |
| `a == b` | Loose equality (avoid) |
| `a > b`, `a < b` | Ordering |
| `a >= b`, `a <= b` | Ordering inclusive |

### Logical

| Syntax | Meaning |
|--------|---------|
| `a and b` | Logical AND |
| `a or b` | Logical OR |
| `not a` | Logical NOT |

### Arithmetic

Standard: `+`, `-`, `*`, `/`, `%`

Compound assignment in functions: `+=`, `-=`

### Array/Collection Operations

| Syntax | Meaning |
|--------|---------|
| `arr.concat([item])` | Append, returns new array |
| `arr.filter(fn)` | Filter by predicate |
| `arr.map(fn)` | Transform each element |
| `arr.find(fn)` | Find first match |
| `arr.length` | Array length |
| `arr[index]` | Index access |
| `arr[start..end]` | Slice (exclusive end) |

### String Operations

| Syntax | Meaning |
|--------|---------|
| `a + b` | Concatenation |
| `s.len` | String length |
| `s.indexOf(sub)` | Find substring |
| `s.eql(other)` | Equality test |
| `s[start..end]` | Substring (exclusive end) |

### Null Coalescing

| Syntax | Meaning |
|--------|---------|
| `a ?? b` | If `a` is null/undefined, use `b` |

---

## Ambient Namespaces

These are always available without import:

| Namespace | Properties |
|-----------|------------|
| `sys.*` | `user`, `host`, `os`, `uptime` |
| `time.*` | `hour`, `minute`, `second`, `timestamp`, `date`, `elapsed`, `delta`, `fps` |
| `device.*` | `width`, `height`, `dpi`, `battery`, `charging`, `online`, `orientation` |
| `locale.*` | `language`, `region`, `direction`, `currency` |
| `privacy.*` | `camera`, `mic`, `location`, `storage`, `notifications` |
| `input.*` | `mouse.x`, `mouse.y`, `keys.*`, `touch.count` |
| `math.*` | `clamp`, `lerp`, `map`, `min`, `max`, `abs`, `floor`, `ceil` |

---

## Import Syntax

```
from './path/to/file'
```

Imports everything exported (classifiers, effects, glyphs).

**Valid:**
```
from './s00c_manifest_cls'
from './theme.tcls'
```

---

## JSX in `return()`

Standard JSX with these constraints:

1. **Event handlers:** Must be function names, not inline definitions
   - Valid: `onPress=handlerName`
   - Invalid: `onPress={() => { ... }}`

2. **Map iteration:** Use `<For>` component
   - Valid: `<For each=items>...</For>`
   - Invalid: `{items.map(...)}`

3. **Classifiers:** Use `C.Name` pattern
   - Valid: `<C.Card>...</C.Card>`
   - Defined in `.cls.tsz` files

4. **Effects:** Reference by name
   - Valid: `<Effect name="plasma" />`
   - Defined in `.effects.tsz` files

5. **Glyphs:** Use `:name:` shortcodes in text
   - Valid: `<Text>Status :check: ready</Text>`
   - Valid: `<Text>Active :plasma[ON]: now</Text>`

---

## Anti-Patterns (Invalid in Chad Tier)

These are **not allowed** in chad-tier code. They may work in mixed/soup tiers but violate intent syntax principles.

| Anti-Pattern | Why Invalid | Correct Form |
|--------------|-------------|--------------|
| `const [x, setX] = useState(0)` | Hidden React internals | `<var> x is 0 </var>` + `<state> set_x </state>` |
| `function handle() { ... }` | Not in `<functions>` block | Move to `<functions>` |
| `onPress={() => { ... }}` | Inline closure | `onPress=handlerName` |
| `if (x) { ... }` | JS control flow | Guard expressions with `? stop : go` |
| `x === y` | JS equality | `x exact y` |
| `x = y` | Direct assignment | `set_x to y` |
| `items.push(x)` | Mutation | `set_items to items.concat([x])` |
| `className="foo"` | CSS class strings | Classifiers `C.Name` |
| `useEffect(...)` | Hidden lifecycle | `<timer>` block |

---

## Conformance Validation

Conformance tests should validate:

1. **Parser acceptance** — Does this syntax parse?
2. **Intent derivation** — Does the compiler correctly identify constructs?
3. **Code generation** — Does emitted code match the spec?
4. **Error messages** — Are violations clearly reported?

### Test File Naming

| Tier | Pattern | Purpose |
|------|---------|---------|
| Soup | `s{NN}a_{name}.tsz` | Model output, compiler resilience |
| Mixed | `s{NN}b_{name}.tsz` | Current API surface |
| Chad | `s{NN}c_{name}.tsz` | This spec, golden path |

---

## Examples

### Minimal Counter (Complete)

```
// s01c_counter.tsz

<page route=counter>
  <var>
    count is 0
  </var>

  <state>
    set_count
  </state>

  <functions>
    decrement:
      set_count to count - 1

    increment:
      set_count to count + 1

    reset:
      set_count to 0
  </functions>

  return(
    <Box style={{ padding: 24 }}>
      <Text>{count}</Text>
      <Pressable onPress=decrement><Text>-</Text></Pressable>
      <Pressable onPress=reset><Text>Reset</Text></Pressable>
      <Pressable onPress=increment><Text>+</Text></Pressable>
    </Box>
  )
</page>
```

### Module with FFI (Complete)

```
// counter.mod.tsz

<module counter>
  <types>
    Direction: up | down | reset

    Config: {
      max: int = 100,
      min: int = 0
    }
  </types>

  <state>
    value: int = 0
    config: Config
  </state>

  <functions>
    step(dir: Direction): int
      switch dir:
        up:
          value < config.max
            ? value = value + 1
            : go
        down:
          value > config.min
            ? value = value - 1
            : go
        reset:
          value = 0
      return value

    get(): int
      return value
  </functions>
</module>
```

---

## Reference Examples Audit

| File | Status | Notes |
|------|--------|-------|
| `s01c_counter.tsz` | ✅ Perfect | Minimal, no leaks, pure intent syntax |
| `s02c_todo.tsz` | ⚠️ Leaks | Uses `onPress={() => {...}}` inline arrows (mixed tier) |
| `s03c_chat.tsz` | ✅ Good | Clean, uses `onPress=handlerName` |
| `s00c_manifest.tsz` | ✅ Good | Full vocabulary, comprehensive |
| `m99_stress.mod.tsz` | ✅ Perfect | Complete module syntax |

## Changelog

| Date | Change |
|------|--------|
| 2026-03-31 | Initial draft based on counter, manifest, m99 |

---

## References

- `tsz/carts/conformance/s01c_counter.tsz` — Minimal perfect example
- `tsz/carts/conformance/s00c_manifest.tsz` — Full surface vocabulary
- `tsz/carts/conformance/modules/m99_stress.mod.tsz` — Complete module example
