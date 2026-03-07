# Lua Latches

## The Formula

```
Lua + 1(n) → React = latch
```

- There is a primary Lua source
- Additional Lua systems attach to it
- Lua resolves the chain
- React receives the final resolved value

## The Full Flow

```
Lua source
   + Lua system
   + Lua system
   + Lua system
        ↓
     Lua resolves
        ↓
       latch
        ↓
      React
```

A latch is not just "many Lua values."
It is **Lua systems interacting before the bridge.**

That is why the word latch works — the systems latch together first.

---

## Hook vs Latch

### Hook
Single Lua system exposes state to React.

```
Lua → React
```

Examples:
- `timer.tick`
- `network.status`
- `physics.body.position`

React is just subscribing.

### Latch
Multiple Lua systems combine to produce a derived value.

```
Lua + Lua + Lua → React
```

or in formula notation:

```
Lua + 1(n) → React
```

Examples:
- `spring + time + math → position`
- `physics + collision + mask → opacity`
- `audio + spectrum + effects → color`

React sees only the result.

**The conceptual rule:**

> Hooks expose Lua state.
> Latches expose Lua composition.

---

## The Conceptual Stack

```
Capabilities   (Lua systems)
      ↓
Behaviors      (Lua composition)
      ↓
Latches        (Lua outputs)
      ↓
React UI
```

- **Capabilities** = individual Lua systems (spring, timer, physics, audio, etc.)
- **Behaviors** = composition logic that wires capabilities together
- **Latches** = the resolved outputs that React reads

Latches are produced by behaviors, not capabilities directly.
That separation keeps the architecture clean.

---

## Shatter Block Example

**Lua side:**
```
time
spring
math
physics
effects
mask
      ↓
Lua resolves block transforms
      ↓
Latches.set("shatter.block[5].x",       value)
Latches.set("shatter.block[5].rot",     value)
Latches.set("shatter.block[5].opacity", value)
```

**React side:**
```tsx
<Box style={{
  x:       latch("shatter.block[5].x"),
  rotate:  latch("shatter.block[5].rot"),
  opacity: latch("shatter.block[5].opacity"),
}} />
```

React never knows how the value was produced.

---

## Implementation

- Lua: `lua/latches.lua` — `Latches.set(key, value)` / `Latches.get(key)`
- JS: `useLatch(key)` from `@reactjit/core` — reads the resolved value
- Transport: `latches:frame` bridge event, flushed once per frame after all capability ticks
- Contract: **latch → style. Nothing between them.**
