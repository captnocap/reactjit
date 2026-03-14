# TSZ Compiler Gap Closure Plans

## Tier 2: Developer Experience Gaps

---

### 1. Fragments (`<>...</>`) — Easy

**What it does:** Lets you group children without a wrapper Box node.

**Current state:** The parser (`codegen.zig:parseJSXElement`) expects every `<` to be followed by a tag name (Box, Text, etc.) or `</`. There is no handling for `<>` (empty tag = fragment).

**Lua reference:** React handles fragments at the fiber level before reaching the reconciler — children are flattened into the parent. No special node type needed.

**Implementation plan:**

1. **Lexer** (`lexer.zig`): No changes needed. `<>` already tokenizes as `lt` + `gt`. `</>` tokenizes as `lt_slash` + `gt`.

2. **Codegen** (`codegen.zig:parseJSXElement`):
   - At the top of `parseJSXElement()`, after consuming `lt`, check if the next token is `gt` (meaning `<>`).
   - If so: this is a fragment. Don't create a Node — just parse children in a loop until `</>` is hit.
   - Return children as a **child array** without a wrapper node. The children get spliced directly into the parent's `_arr_N`.
   - For the closing tag, match `lt_slash` + `gt` (no tag name between them).

3. **Codegen detail — splicing children:**
   - Currently `parseJSXElement` returns a single node expression string. Fragments break this — they return *multiple* nodes.
   - **Option A (simplest):** Emit a transparent Box with no style. This is what the Lua stack effectively does — React fragments become invisible containers. The layout engine already treats unstyled Boxes as transparent wrappers (no background, no padding, flex passthrough). One line: emit `Node{ .children = &_arr_N }` with default style.
   - **Option B (correct):** Change `parseJSXElement` to return a list of node expressions, and have the parent array concat them. More invasive but zero-overhead at runtime.

   **Recommendation:** Option A. A no-style Box has zero visual/layout impact with the current flex engine. The overhead is one extra Node in the tree, which is negligible. Option B can come later if profiling shows it matters.

4. **Test:** Write `fragment-test.tsz`:
   ```tsx
   function App() {
     return (
       <Box style={{ padding: 32 }}>
         <>
           <Text>First</Text>
           <Text>Second</Text>
         </>
         <Text>Third</Text>
       </Box>
     );
   }
   ```
   Expected: Three Text nodes as direct flex children of the outer Box (or near-direct, with the transparent wrapper).

**Files touched:** `codegen.zig` (~30 lines)
**Risk:** Low. Fragment is syntactic sugar — worst case, falls back to a wrapper Box.

---

### 2. Custom Hooks (`function useCounter()`) — Hard

**What it does:** Lets users extract reusable state+effect logic into named functions.

**Current state:** The compiler has a single-pass architecture that:
- Finds ONE `function App()` (or whatever the main component is)
- Scans it for `useState` calls → state slots
- Scans it for `useEffect` calls → effect entries
- Scans it for the `return` statement → JSX tree

Custom hooks would be additional functions that also contain `useState`/`useEffect` calls, and their slots need to be merged into the global slot table.

**Lua reference:** In the Love2D stack, hooks are standard React hooks — they work because React's reconciler tracks hook call order per fiber. TSZ has no fibers. State is a flat global array of slots.

**Implementation plan:**

This is a **compiler-level transformation** — custom hooks are inlined at the call site. No runtime changes needed.

#### Phase 1: Hook function collection

1. **New scan pass** in `generate()` (between Phase 3 and Phase 4):
   - Scan for `function use*()` definitions (any function starting with `use` by convention).
   - For each, record:
     - Function name
     - Token range (body start/end)
     - Local `useState` calls within it → slot descriptors
     - Local `useEffect` calls → effect descriptors
     - Return value (the hook's public API, e.g., `[count, increment]`)

2. **Data structure:**
   ```zig
   const CustomHook = struct {
       name: []const u8,           // "useCounter"
       body_start: u32,            // token index
       body_end: u32,
       state_slots: [8]StateSlot,  // useState calls inside
       state_count: u32,
       effects: [8]EffectInfo,     // useEffect calls inside
       effect_count: u32,
       return_bindings: [8][]const u8,  // what it returns
   };
   const MAX_CUSTOM_HOOKS = 16;
   ```

#### Phase 2: Hook call site inlining

3. In `collectStateHooks()` (Phase 4), when scanning the App function body:
   - If you see `const [...] = useCounter()` and `useCounter` matches a collected custom hook:
   - Allocate global state slots for the hook's internal `useState` calls, offset by current `state_count`.
   - Map the hook's return bindings to the caller's destructured names.
   - Record the slot ID mapping so expressions referencing the hook's getters/setters resolve correctly.

4. In `collectEffects()` (Phase 5):
   - Also collect effects from all custom hooks, with slot IDs remapped to global offsets.

5. **Expression resolution:**
   - When emitting handler bodies or expressions that reference a custom hook's getter (e.g., `count` from `useCounter`), resolve through the binding map to the correct `state.getSlot(N)`.

#### Phase 3: Multiple hook instances

6. If `useCounter()` is called twice, each call gets its own slot range:
   ```
   const [a, incA] = useCounter();  // slots 0,1
   const [b, incB] = useCounter();  // slots 2,3
   ```
   The slot offset advances per call, same as React's hook call-order rule.

#### Edge cases

- **Hook calling hook:** Support one level of nesting (hook A calls hook B). Deep nesting is uncommon and can be deferred.
- **Conditional hook calls:** Not supported (same as React — hooks must be called unconditionally). The compiler can error if it detects a hook call inside a conditional.
- **Hook parameters:** `useCounter(initialValue)` — pass through to `useState(initialValue)`. Parse the parameter list and substitute into the hook's `useState` calls.

**Files touched:** `codegen.zig` (~200-300 lines for the new pass + inlining logic)
**Risk:** Medium-high. The single-pass architecture makes this tricky — hook bodies need to be parsed twice (once to collect metadata, once to emit). But the existing multi-pass scan pattern (phases 4-6) already does exactly this for the App function, so extending it to custom hook functions is architecturally consistent.

**Simplification opportunity:** If custom hooks only contain `useState` + `useEffect` (no JSX), the implementation is much simpler — it's just slot allocation + effect collection with name remapping. No JSX parsing needed.

---

### 3. onKeyDown (Complete Wiring) — Easy

**What it does:** Keyboard shortcuts via `onKeyDown` prop on any element, plus global keyboard handling.

**Current state in TSZ:**
- `runtime/events.zig` already has `on_key: ?*const fn () void` in the `EventHandler` struct.
- `runtime/main.zig` processes `SDL.KEYDOWN` events in the event loop.
- But: the compiler (`codegen.zig`) doesn't parse `onKeyDown` props, and the runtime doesn't route key events through hit-tested nodes.

**Lua reference:** (`love2d/lua/events.lua` + `love2d/packages/renderer/src/eventDispatcher.ts`):
- Key events include: `key`, `scancode`, `isRepeat`, `modifiers` (ctrl, shift, alt, meta)
- Events route to focused node first, then broadcast globally
- `useHotkey(combo, handler)` parses combo strings like `"ctrl+z"`, `"ctrl+shift+s"`

**Implementation plan:**

#### Step 1: Runtime key event routing (`runtime/events.zig` + `runtime/main.zig`)

1. **Expand EventHandler:**
   ```zig
   on_key: ?*const fn (key: u32, mods: u16) void,
   // mods bitfield: bit 0 = ctrl, bit 1 = shift, bit 2 = alt, bit 3 = meta
   ```

2. **Key event dispatch in main.zig:**
   - On `SDL.KEYDOWN`:
     - If a TextInput is focused, route to it first (already happens for text editing).
     - Then walk the node tree for any node with `on_key` handler → call it.
     - Later: add focus tracking so only the focused subtree gets the event.

#### Step 2: Compiler onKeyDown parsing (`codegen.zig`)

3. **In `parseJSXProps()`**, add `onKeyDown` alongside `onPress`:
   - Parse the arrow function body same as `onPress` handlers.
   - But the handler signature takes `(key, mods)` instead of void.
   - Emit a handler function: `fn _handler_key_N(key: u32, mods: u16) void { ... }`

4. **Key matching in handler body:**
   The TSZ syntax would be:
   ```tsx
   <Box onKeyDown={(key) => {
     if (key === 'Enter') setCount(count + 1);
   }}>
   ```

   The compiler maps string key names to SDL keycodes:
   - `'Enter'` → `SDL.SDLK_RETURN`
   - `'Escape'` → `SDL.SDLK_ESCAPE`
   - `'ArrowUp'` → `SDL.SDLK_UP`
   - etc.

   **Simpler alternative (recommended for v1):** Use a `hotkey` prop instead of parsing full handler bodies:
   ```tsx
   <Pressable hotkey="ctrl+s" onPress={() => save()}>
   ```
   This is much easier to compile — just store the key combo in the Node and match it in the runtime event loop.

#### Step 3: Global keyboard handler

5. **Top-level `useKeyboard` hook** (stretch goal):
   ```tsx
   useKeyboard('ctrl+z', () => undo());
   ```
   Compiles to a global key handler registered in the event loop, not attached to any node.

**Files touched:**
- `codegen.zig`: ~50 lines (prop parsing + handler emission)
- `events.zig`: ~10 lines (EventHandler expansion)
- `main.zig`: ~30 lines (key dispatch routing)
- `layout.zig`: ~5 lines (Node struct addition for hotkey string)

**Risk:** Low. Key events are already partially wired. This is mostly connecting existing pieces.

---

### 4. Dynamic Route Params (`:id`) — Medium

**What it does:** `/users/42` → `params.id` available in the matched component.

**Current state in TSZ:**
- Routes exist! `codegen.zig` has `RouteInfo` struct, `MAX_ROUTES = 16`, and `<Route path="/foo" element={...}>` parsing.
- But route matching is currently exact string comparison — no param extraction.

**Lua reference** (`love2d/packages/router/src/matcher.ts`):
- `compilePattern()` converts `/users/:id` to a RegExp with named capture groups.
- Param segments start with `:`. Optional params end with `?`. Wildcards are `:*`.
- Specificity scoring: static=4, required param=3, optional=2, wildcard=1.

**Implementation plan:**

#### Step 1: Route pattern parsing (`codegen.zig`)

1. **Extend `RouteInfo`:**
   ```zig
   const RouteParam = struct {
       name: []const u8,      // "id"
       segment_index: u32,    // which path segment (0-based)
   };

   const RouteInfo = struct {
       path: []const u8,
       arr_name: []const u8,
       child_idx: u32,
       params: [4]RouteParam, // max 4 params per route
       param_count: u32,
       segment_count: u32,    // total segments for matching
       specificity: u32,      // for best-match selection
   };
   ```

2. **At compile time**, when parsing `<Route path="/users/:id">`:
   - Split path on `/`
   - For each segment starting with `:`, record as a RouteParam
   - Compute specificity score

#### Step 2: Runtime route matching (`runtime/` — new file `route.zig`)

3. **Route matching function:**
   ```zig
   pub fn matchRoute(pattern: RouteInfo, path: []const u8) ?RouteMatch {
       // Split actual path on '/'
       // Compare segment count
       // For each segment:
       //   - Static segment: exact match required
       //   - Param segment: capture value
       // Return extracted params
   }
   ```

4. **Params storage:**
   ```zig
   const MAX_ROUTE_PARAMS = 8;
   var route_params: [MAX_ROUTE_PARAMS]struct { name: []const u8, value: []const u8 } = undefined;
   var route_param_count: u32 = 0;
   ```

#### Step 3: Params access in components

5. **In generated code**, params are accessed via a built-in:
   ```tsx
   const id = useParam('id');
   // or
   const { id } = useParams();
   ```

   The compiler maps `useParam('id')` to `route.getParam("id")` which looks up the matched param value.

6. **Since params are strings**, they become state-like bindings that update when the route changes. The route matching runs on navigation and populates the param slots.

#### Step 4: Navigation with params

7. **`navigate('/users/42')`** already works if `navigate()` is supported. The route matcher extracts `42` as `id` and shows the matched route's component.

**Files touched:**
- `codegen.zig`: ~80 lines (RouteInfo expansion + useParam parsing)
- New file `runtime/route.zig`: ~100 lines (pattern matching + param storage)
- `runtime/main.zig`: ~20 lines (integrate route matching into navigation)

**Risk:** Low-medium. Route matching is well-understood. The main complexity is wiring param values into the state/expression system so they can appear in template literals and expressions.

---

### 5. Default Prop Values (`function Card({ title = "Untitled" })`) — Easy

**What it does:** Components can declare fallback values for props not explicitly passed.

**Current state in TSZ:**
- Component composition exists (multi-file imports, prop substitution).
- Props are substituted at compile time: the compiler finds `{props.title}` in the child component and replaces it with the value passed from the parent.
- But there's no fallback if a prop isn't passed.

**Lua reference:** Standard JS destructuring defaults. No special runtime support needed — it's a syntax feature.

**Implementation plan:**

1. **Codegen** (`codegen.zig`), in the component definition parsing:
   - When scanning a component's function signature, look for `= "default"` or `= number` after each parameter name.
   - Store defaults in the component metadata:
     ```zig
     const PropDefault = struct {
         name: []const u8,       // "title"
         default_value: []const u8,  // "\"Untitled\"" or "42"
     };
     ```

2. **At prop substitution time** (when the parent uses `<Card>` without a `title` prop):
   - The compiler already knows which props were passed (from the JSX attributes).
   - For any prop with a default that wasn't passed, substitute the default value.
   - This is purely a **compile-time transformation** — no runtime cost.

3. **Syntax to support:**
   ```tsx
   // In component definition:
   function Card({ title = "Untitled", padding = 16 }) {
     return (
       <Box style={{ padding: padding }}>
         <Text>{title}</Text>
       </Box>
     );
   }

   // Usage:
   <Card />                    // title="Untitled", padding=16
   <Card title="Hello" />     // title="Hello", padding=16
   ```

4. **Parsing detail:**
   - After `{` in the parameter list, parse comma-separated `name` or `name = value` pairs.
   - Value can be: string literal, number literal, boolean (`true`/`false`).
   - Store in the component's metadata alongside existing prop info.

**Files touched:** `codegen.zig` ~40 lines (parameter parsing + substitution fallback)
**Risk:** Very low. This is a compile-time text substitution — no runtime changes, no architectural impact.

---

## Tier 3: Nice-to-Have Gaps

---

### 6. Optional Chaining (`?.`) — Medium

**What it does:** `obj?.prop` returns the value if `obj` is non-null, otherwise short-circuits to a safe default.

**Current state:** The lexer doesn't tokenize `?.`. The expression parser has no concept of nullable types — all state slots are non-nullable value unions.

**Implementation plan:**

1. **Lexer** (`lexer.zig`):
   - When seeing `?`, peek ahead. If next char is `.`, emit a new token kind `question_dot` instead of `question`.
   - Add `question_dot` to `TokenKind` enum.

2. **Codegen** — expression parser:
   - In `emitStateAtom()`, after parsing a primary expression, check for `.` or `?.`:
     - `.prop` → emit as before (member access)
     - `?.prop` → emit a null-checked access

3. **Zig translation:**
   TSZ has no null types currently. Optional chaining would be most useful for:
   - **Object-like state** (not yet supported — state is flat scalars/arrays)
   - **FFI return values** (C pointers can be null)

   For FFI: `ffi.getUser()?.name` → `if (ffi.getUser()) |u| u.name else null`

   **Recommendation:** Defer this until TSZ has object/struct state. For flat scalars and arrays, `?.` has no meaning — values are always defined. Document this as "not needed yet" and revisit when object state lands.

**Files touched:** `lexer.zig` ~10 lines, `codegen.zig` ~30 lines
**Risk:** Low implementation risk, but **low value** until object state exists.

---

### 7. Nullish Coalescing (`??`) — Medium

**What it does:** `a ?? b` returns `a` if non-null, otherwise `b`.

**Current state:** Not tokenized, not parsed.

**Implementation plan:**

1. **Lexer** (`lexer.zig`):
   - When seeing `?`, peek ahead. If next char is `?`, emit `question_question` token.
   - Precedence: add between `question_dot` and `pipe_pipe`.

2. **Codegen** — new precedence level:
   ```
   emitTernary → emitNullishCoalescing → emitLogicalOr → ...
   ```

   ```zig
   fn emitNullishCoalescing(self: *Generator) ![]const u8 {
       var left = try self.emitLogicalOr();
       while (self.curKind() == .question_question) {
           self.advance_token();
           const right = try self.emitLogicalOr();
           left = try std.fmt.allocPrint(self.alloc, "({s} orelse {s})", .{ left, right });
       }
       return left;
   }
   ```

3. **Zig mapping:** `??` maps perfectly to Zig's `orelse` operator — but only for optional types. For TSZ's current value union (non-optional), this would need to check for a "null" sentinel.

   **Practical approach:** Treat `state ?? default` as: if state slot is the initial/zero value, use default. Or: introduce a `null` state type in the Value union.

   **Recommendation:** Same as `?.` — defer until object/optional state exists. For current flat state, ternary `count ? count : default` covers all cases.

**Files touched:** `lexer.zig` ~10 lines, `codegen.zig` ~20 lines
**Risk:** Low, but **low value** without optional types.

---

### 8. Spread Props (`{...props}`) — Hard

**What it does:** Forward all props from parent to child without listing each one.

**Current state:** Props are individually named and substituted at compile time. There's no concept of "all remaining props."

**Implementation plan:**

1. **Syntax:**
   ```tsx
   function Wrapper(props) {
     return <Card {...props} extra="value" />;
   }
   ```

2. **Compiler transformation:**
   At compile time, when the compiler sees `{...props}` on a JSX element:
   - Look up what props were passed to the current component.
   - Enumerate all of them.
   - Emit each one individually on the target element.
   - Explicit props on the same element override spread props.

   This is **pure compile-time prop copying** — iterate the parent's prop set and emit each as if it were written explicitly.

3. **Challenges:**
   - **Unknown prop sets:** If `Wrapper` is called from multiple sites with different props, the compiler needs to handle the union of all possible props. Since TSZ compiles the entire app in one pass, it can see all call sites.
   - **Style merging:** `{...props}` with `style={...}` needs to merge style objects, not replace. The compiler can emit a merged style struct.
   - **Dynamic props:** If a prop value is a state expression, the spread needs to preserve the reactivity binding.

4. **Simpler alternative (recommended):**
   Instead of full spread, support **rest props** as an explicit list:
   ```tsx
   function Wrapper({ title, ...rest: [padding, color] }) {
     return <Card title={title} padding={rest.padding} color={rest.color} />;
   }
   ```
   This keeps prop forwarding explicit and compile-time resolvable.

**Files touched:** `codegen.zig` ~150-200 lines
**Risk:** High. Full spread semantics are hard in a single-pass compiler with no AST. The "explicit rest" alternative is much more tractable.

---

### 9. Array Indexing (`arr[i]`) — Medium

**What it does:** Direct array element access in expressions: `items[0]`, `items[i]`.

**Current state:** Arrays can only be accessed via `.map()`, `.length`, and `.push()`. No subscript access.

**Implementation plan:**

1. **Lexer:** Already has `lbracket`/`rbracket` tokens. No changes.

2. **Codegen** — in `emitStateAtom()`:
   After parsing an identifier that's a known array state, check for `[`:
   ```zig
   if (self.curKind() == .lbracket) {
       self.advance_token(); // [
       const index_expr = try self.emitStateExpr(); // could be literal or state ref
       self.expect(.rbracket); // ]

       // Emit: state.getArrayElement(slot_id, index)
       return try std.fmt.allocPrint(self.alloc,
           "state.getArrayElement({d}, @intCast({s}))", .{ arr_slot, index_expr });
   }
   ```

3. **Runtime** (`state.zig`) — add `getArrayElement`:
   ```zig
   pub fn getArrayElement(slot: u32, index: usize) i64 {
       if (index >= array_lens[slot]) return 0; // bounds check
       return array_slots[slot][index];
   }
   ```

4. **Nested indexing** (`arr[i][j]`): Not needed for v1. Single-level arrays only.

5. **Assignment** (`arr[i] = value`): Add `setArrayElement` to state.zig, wire up in handler emission for `items[0] = newValue` syntax.

**Files touched:**
- `codegen.zig`: ~30 lines in `emitStateAtom()`
- `state.zig`: ~15 lines (getArrayElement + setArrayElement)

**Risk:** Low. Clean extension of existing array state infrastructure.

---

## Priority Recommendation

**Do first (quick wins):**
1. Fragments — 30 min, unblocks cleaner component structure
2. Default prop values — 30 min, unblocks component libraries
3. onKeyDown — 1-2 hours, unblocks all keyboard-driven UIs

**Do next (medium effort, high value):**
4. Array indexing — 1 hour, unblocks data-driven UIs
5. Dynamic route params — 2-3 hours, unblocks multi-page apps

**Do later (high effort or low current value):**
6. Custom hooks — half day, needed for large apps but TSZ apps are currently small
7. Optional chaining / Nullish coalescing — defer until object state exists
8. Spread props — defer, explicit prop passing works fine
