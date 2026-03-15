# Compiler Completion — Close Every Language Gap

## STOP ALL OTHER WORK UNTIL THIS IS DONE

The compiler must reach the point where there is ZERO reason to hand-write Zig
for application-level code. Every gap below is mechanical — parse the pattern,
emit the Zig. No architectural changes. No runtime modifications. Pure compiler work.

**After this plan is complete:** if someone writes hand-written Zig for anything
that isn't the engine core (layout, painter, state, GPU bridge), they are wrong.
No exceptions. No excuses. The compiler handles it.

## The Gaps (all in `tsz/compiler/codegen.zig` or the split files)

### Tier 1: Control Flow

**1. While loops**
```tsx
while (count < 10) {
  setCount(count + 1);
}
```
Emits: `while (state.getSlot(N) < 10) { state.setSlot(N, state.getSlot(N) + 1); }`

Parse: `while` `(` expression `)` `{` statements `}`
The expression parser already exists. Statement parsing already exists (multi-statement handlers). This is wiring them together.

**2. For loops**
```tsx
for (let i = 0; i < items.length; i++) {
  // ...
}
```
Emits: `var i: i64 = 0; while (i < arr_len) : (i += 1) { ... }`

Alternatively, `.map()` already covers the primary iteration use case.
For loops are syntactic sugar over while. Implement while first, for is optional.

**3. Switch/case**
```tsx
switch (mode) {
  case 0: return <HomeScreen />;
  case 1: return <Settings />;
  default: return <NotFound />;
}
```
Emits: chained `if/else if/else` (Zig has `switch` but the if-chain is simpler to emit)

Parse: `switch` `(` expression `)` `{` (`case` value `:` statements)* (`default` `:` statements)? `}`

### Tier 2: Functions & Computation

**4. Utility functions**
```tsx
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
```
Emits: `fn clamp(value: i64, min: i64, max: i64) i64 { ... }`

The compiler already collects function definitions via `collectComponents()`.
Extend it: if a function doesn't return JSX, treat it as a utility function
instead of a component. Emit as a Zig function. Call sites resolve to direct calls.

**5. Return values from functions**
```tsx
function double(x) { return x * 2; }
const result = double(count);
```
Emits: `fn double(x: i64) i64 { return x * 2; }` + call site `double(state.getSlot(N))`

Requires: type inference for return type (int, float, bool, string) based on
the return expression.

**6. Multi-expression blocks everywhere**
Currently multi-statement works in handlers and effects. Extend to:
- Style value computations
- Local variable initializers
- Function bodies

### Tier 3: String Operations

**7. String concatenation with +**
```tsx
const greeting = "Hello, " + name + "!";
```
Emits: `std.fmt.bufPrint(&buf, "{s}{s}{s}", .{ "Hello, ", state.getSlotString(N), "!" })`

In the expression parser, detect `+` where one operand is a string type.
Emit `bufPrint` with `{s}` format specifiers instead of arithmetic.

**8. String methods**
```tsx
const upper = name.toUpperCase();
const sub = text.slice(0, 5);
const idx = text.indexOf("hello");
const parts = text.split(",");
const trimmed = text.trim();
const len = text.length;
```
Each maps to a Zig stdlib call or a simple loop:
- `.toUpperCase()` → `std.ascii.upperString()`
- `.toLowerCase()` → `std.ascii.lowerString()`
- `.slice(a, b)` → `str[a..b]`
- `.indexOf(sub)` → `std.mem.indexOf(u8, str, sub)`
- `.includes(sub)` → `std.mem.indexOf(u8, str, sub) != null`
- `.split(sep)` → `std.mem.splitScalar(u8, str, sep)`
- `.trim()` → `std.mem.trim(u8, str, " \t\n\r")`
- `.length` → `str.len`
- `.startsWith(prefix)` → `std.mem.startsWith(u8, str, prefix)`
- `.endsWith(suffix)` → `std.mem.endsWith(u8, str, suffix)`
- `.replace(old, new)` → `std.mem.replace(u8, ...)`

In `emitStateAtom()`, after identifier lookup, if followed by `.methodName(`, emit the corresponding Zig call.

### Tier 4: Array Operations

**9. Array methods beyond .map()**
```tsx
const filtered = items.filter(item => item > 5);
const found = items.find(item => item == target);
const total = items.reduce((sum, item) => sum + item, 0);
const has = items.includes(3);
```

These build on the .map() pool pattern:
- `.filter()` → same loop as .map() but with an `if` guard, output count varies
- `.find()` → loop with early break, returns single value
- `.reduce()` → loop with accumulator
- `.includes()` → loop with equality check, returns bool
- `.push(item)` → already exists for array state
- `.pop()` → remove last element, decrement count
- `.slice(a, b)` → return sub-slice of array
- `.length` → already exists

**10. Array indexing**
```tsx
const first = items[0];
const nth = items[index];
```
Emits: `state.getArraySlot(N)[0]` or with bounds check

### Tier 5: Operators & Syntax

**11. Bitwise operators**
```tsx
const flags = a & b;
const mask = x | y;
const shifted = n << 2;
```
Lexer already has `&` and `|` as potential single-char tokens.
Add: `&`, `|`, `^`, `~`, `<<`, `>>` to expression parser.
Emits same operators in Zig.

**12. Compound assignment**
```tsx
count += 1;
total *= 2;
name += " suffix";
```
Parse: identifier `+=` expression → `state.setSlot(N, state.getSlot(N) + expr)`

**13. Optional chaining**
```tsx
const name = user?.name ?? "Anonymous";
```
Emits: `if (user_name_slot_valid) state.getSlotString(N) else "Anonymous"`

Lower priority — most cases covered by explicit checks.

**14. Nullish coalescing**
```tsx
const value = input ?? defaultValue;
```
Emits: `if (input_valid) input_val else default_val`

**15. typeof**
```tsx
if (typeof count === "number") { ... }
```
Types are known at compile time. This resolves statically — no runtime check needed.

**16. Destructuring in local vars**
```tsx
const { name, age } = user;
const [first, second] = items;
```
Object destructuring → multiple local var bindings from object fields.
Array destructuring → multiple local var bindings from array indices.

### Tier 6: Module System

**17. Named exports/imports (beyond components)**
```tsx
// utils.tsz
export function clamp(v, min, max) { ... }
export const PI = 3.14159;

// app.tsz
import { clamp, PI } from './utils';
```
Token concatenation already handles component imports.
Extend: exported utility functions and constants resolve the same way.

**18. Barrel exports**
```tsx
// index.tsz
export { Sidebar } from './Sidebar';
export { Header } from './Header';
```
Re-export pattern. Resolve transitively during import processing.

## Implementation Strategy

### Do the codegen split FIRST

The codegen file is 5,610 lines. Adding all these features to a god file is insane.
Split it per `codegen-split.md`, THEN implement features in the focused files:

- Control flow (while, for, switch) → `collect.zig` + `emit.zig`
- Utility functions → `collect.zig` + `expressions.zig`
- String methods → `expressions.zig`
- Array methods → `jsx.zig` (extends .map() pattern)
- Operators → `expressions.zig`
- Module system → `collect.zig`

### Agent split (after codegen split)

| Agent | Features | File |
|-------|----------|------|
| A | While, for, switch, if/else improvements | Control flow in `collect.zig` + `emit.zig` |
| B | Utility functions, return values, multi-expression blocks | `collect.zig` + `expressions.zig` |
| C | String concat, string methods, typeof | `expressions.zig` |
| D | .filter(), .find(), .reduce(), array indexing, .push/.pop | `jsx.zig` + `expressions.zig` |
| E | Bitwise ops, compound assignment, optional chaining, nullish coalescing | `expressions.zig` |
| F | Destructuring, named exports, barrel exports | `collect.zig` |

**Codegen split must land first.** Then A-F can run in parallel since they touch different files.

## Verification

After ALL features land:

```tsx
// This file must compile. If it doesn't, the compiler isn't done.
function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function App() {
  const [items, setItems] = useState([10, 20, 30, 40, 50]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState(0);

  const filtered = items.filter(item => item > 25);
  const total = items.reduce((sum, item) => sum + item, 0);
  const display = search.length > 0 ? search.toUpperCase() : "Type something";
  const clamped = clamp(total, 0, 100);

  let label = "";
  switch (mode) {
    case 0: label = "Home"; break;
    case 1: label = "Settings"; break;
    default: label = "Unknown";
  }

  return (
    <Box style={{ padding: 32, backgroundColor: '#1e1e2a', width: '100%', height: '100%' }}>
      <Text fontSize={24} color="#ffffff">{`${label} — Total: ${clamped}`}</Text>
      <Text fontSize={14} color="#888888">{`${display}`}</Text>
      <TextInput onChangeText={(t) => setSearch(t)} placeholder="Search..." />
      {filtered.map(item => (
        <Text fontSize={14} color="#4ec9b0">{`Item: ${item}`}</Text>
      ))}
    </Box>
  );
}
```

If this compiles and runs, the compiler is complete. No more excuses.

## What This Does NOT Cover (by design)

- Classes — not needed, functions + objects cover it
- Generators/iterators — use .map() and .filter()
- Async/await — use FFI + poll pattern (architectural decision)
- Decorators — not needed
- Type annotations — parsed and erased (already works)
- JSX spread props — lower priority, can add later
