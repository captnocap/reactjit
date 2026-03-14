# Universal Style Parser — Accept Any CSS Vocabulary

## Goal

A user can write styles in whatever format they know — CSS properties, Tailwind classes, Bootstrap utilities, JSX camelCase — and it all compiles to the same Zig `Style` struct. Zero runtime cost, all resolved at compile time.

## What Already Exists

| Format | Status | Where |
|--------|--------|-------|
| JSX camelCase (`backgroundColor`, `flexGrow`) | Working | `codegen.zig` `mapStyleKey()` / `mapEnumKey()` |
| Tailwind classes (`p-4 bg-blue-500 flex`) | Working | `tailwind.zig` |
| Classifiers (`<C.Card>`) | Working | `codegen.zig` `collectClassifiers()` |
| Hex colors (`#1e1e2a`, `#fff`) | Working | `codegen.zig` `parseColorValue()` |

## What's Missing — 5 Layers

### Layer 1: CSS Property Name Normalization

Accept CSS kebab-case alongside JSX camelCase. Users who know CSS write `background-color`, not `backgroundColor`.

**Implementation:** In `parseStyleAttr()`, before calling `mapStyleKey()`, normalize the key:

```
background-color → backgroundColor → background_color
flex-direction   → flexDirection   → flex_direction
border-radius    → borderRadius    → border_radius
padding-left     → paddingLeft     → padding_left
justify-content  → justifyContent  → justify_content
align-items      → alignItems      → align_items
text-align       → textAlign       → text_align
flex-grow        → flexGrow        → flex_grow
flex-shrink      → flexShrink      → flex_shrink
flex-basis       → flexBasis       → flex_basis
min-width        → minWidth        → min_width
max-width        → maxWidth        → max_width
min-height       → minHeight       → min_height
max-height       → maxHeight       → max_height
margin-left      → marginLeft      → margin_left
(etc — full padding/margin set)
```

**Approach:** A simple `kebabToCamel()` function. Split on `-`, capitalize first letter of each segment after the first, rejoin. Then pass through existing `mapStyleKey()`.

This is the smallest change with the biggest payoff — instantly doubles the accepted vocabulary.

**File:** `tsz/compiler/codegen.zig` — add `kebabToCamel()` helper, call it in `parseStyleAttr()` before key lookup.

### Layer 2: CSS Value Parsing

Accept CSS value syntax alongside bare numbers.

| CSS Value | Current | Needed |
|-----------|---------|--------|
| `32px` | Not supported (only `32`) | Strip `px`, use number |
| `2rem` | Not supported | Convert: 1rem = 16px |
| `100%` | Not supported | Pass as `100.0` for width/height (percentage flag future work) |
| `0` | Works | Already works |
| `auto` | Not supported | Map to null/default |

**Approach:** In `parseStyleAttr()`, when reading a value:
1. If it's a string like `"32px"`, strip the suffix and parse the number
2. If it's `"2rem"`, multiply by 16
3. If it's `"100%"`, parse as number (layout.zig already treats `100.0` for width/height as full)
4. If it's `"auto"`, skip (use default)

**File:** `tsz/compiler/codegen.zig` — add `parseCSSValue()` helper called from `parseStyleAttr()`.

### Layer 3: CSS Color Names

Accept named colors (`red`, `blue`, `white`, `transparent`) alongside hex.

**The 17 CSS basic colors + common extras:**

```
black       → #000000
white       → #ffffff
red         → #ff0000
green       → #008000
blue        → #0000ff
yellow      → #ffff00
cyan/aqua   → #00ffff
magenta/fuchsia → #ff00ff
gray/grey   → #808080
silver      → #c0c0c0
maroon      → #800000
olive       → #808000
navy        → #000080
purple      → #800080
teal        → #008080
orange      → #ffa500
transparent → rgba(0,0,0,0)
```

**Approach:** In `parseColorValue()`, check if the input is a known color name before trying hex parse. Simple string comparison table.

**File:** `tsz/compiler/codegen.zig` — expand `parseColorValue()` with a name lookup.

### Layer 4: `className` Prop

Accept a `className` string of space-separated utility classes. Route through Tailwind parser (already exists) + Bootstrap mapper (new).

```tsx
<Box className="p-4 bg-blue-500 flex items-center">        // Tailwind
<Box className="container d-flex justify-content-center">   // Bootstrap
<Box className="p-4 container flex">                        // Mixed
```

**Approach:**
1. In `parseJSXElement()` attribute parsing, add `className` handler
2. Split the string by spaces
3. For each class, try Tailwind first (`tailwind.zig` `parseClass()`), then Bootstrap mapper
4. Collect all resulting style fields, merge them
5. Merge with any inline `style={}` (inline wins on conflict)

**File:** `tsz/compiler/codegen.zig` — add className attribute handling in parseJSXElement(). New file `tsz/compiler/bootstrap.zig` for Bootstrap class mapping.

### Layer 5: Bootstrap Utility Classes

Map Bootstrap's utility class vocabulary to Style fields. Bootstrap utilities overlap heavily with Tailwind — many are identical or close.

**Spacing** (Bootstrap uses 0-5 scale, not Tailwind's 0-96):
```
p-0 → padding: 0       p-1 → padding: 4      p-2 → padding: 8
p-3 → padding: 16      p-4 → padding: 24     p-5 → padding: 48
px-*, py-*, ps-*, pe-*, pt-*, pb-* → individual sides
m-0 through m-5 → same scale for margin
mx-auto → not directly mappable (no auto margin yet)
```

**Display:**
```
d-flex → display: flex        d-none → display: none
```

**Flex:**
```
flex-row → flexDirection: row           flex-column → flexDirection: column
flex-grow-0 → flexGrow: 0              flex-grow-1 → flexGrow: 1
flex-shrink-0 → flexShrink: 0          flex-shrink-1 → flexShrink: 1
justify-content-start/center/end/between/around/evenly → justifyContent
align-items-start/center/end/stretch → alignItems
```

**Sizing:**
```
w-100 → width: 100%     w-75 → width: 75%     w-50 → width: 50%
h-100 → height: 100%    h-auto → (skip)
```

**Gap:**
```
gap-0 through gap-5 → same scale as spacing
```

**Text:**
```
text-start → textAlign: left       text-center → textAlign: center
text-end → textAlign: right
```

**Rounded:**
```
rounded → borderRadius: 4          rounded-0 → borderRadius: 0
rounded-1 → borderRadius: 4        rounded-2 → borderRadius: 8
rounded-3 → borderRadius: 12       rounded-circle/rounded-pill → borderRadius: 9999
```

**Colors:**
```
bg-primary → #0d6efd    bg-secondary → #6c757d    bg-success → #198754
bg-danger → #dc3545     bg-warning → #ffc107      bg-info → #0dcaf0
bg-light → #f8f9fa      bg-dark → #212529         bg-white → #ffffff
bg-black → #000000
text-primary → text_color (same palette)
```

**File:** New `tsz/compiler/bootstrap.zig` — mirrors `tailwind.zig` structure. Takes a class name, returns a style field string or empty.

## Implementation Order

**Phase 1: CSS property names** (Layer 1)
- `kebabToCamel()` in codegen.zig
- Instant win, 30 minutes of work
- Test: `style={{ 'background-color': '#1e1e2a', 'flex-direction': 'column' }}`

**Phase 2: CSS values + color names** (Layers 2 + 3)
- `parseCSSValue()` and color name table in codegen.zig
- Test: `style={{ padding: '32px', backgroundColor: 'red' }}`

**Phase 3: className prop** (Layer 4)
- Wire `className` attribute in parseJSXElement
- Route through existing Tailwind parser
- Test: `<Box className="p-8 bg-slate-900 flex flex-col">`

**Phase 4: Bootstrap classes** (Layer 5)
- New `bootstrap.zig` file
- Wire into className pipeline
- Test: `<Box className="container d-flex justify-content-center p-3 bg-primary">`

## Files Changed

| File | Change |
|------|--------|
| `tsz/compiler/codegen.zig` | Add `kebabToCamel()`, `parseCSSValue()`, expand `parseColorValue()`, add `className` attribute parsing |
| `tsz/compiler/bootstrap.zig` | New file — Bootstrap utility class parser (mirrors tailwind.zig) |
| `tsz/compiler/tailwind.zig` | No changes needed — already complete |
| `tsz/examples/universal-style-test.tsz` | Test with mixed CSS/TW/Bootstrap styles |

## Architecture

```
User writes:
  style={{ 'background-color': '32px' }}     ← CSS syntax
  style={{ backgroundColor: 32 }}             ← JSX syntax (existing)
  className="p-4 bg-blue-500"                 ← Tailwind classes
  className="d-flex justify-content-center"   ← Bootstrap classes
  className="p-4 d-flex bg-blue-500"          ← Mixed

All go through:
  ┌─────────────────────────────┐
  │  Style Normalization Layer  │
  │                             │
  │  CSS kebab → camelCase      │
  │  CSS values → numbers       │
  │  Color names → hex          │
  │  TW classes → fields        │
  │  Bootstrap classes → fields │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │  Existing mapStyleKey()     │
  │  mapEnumKey()               │
  │  parseColorValue()          │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │  Zig Style struct           │
  │  (layout.zig)               │
  └─────────────────────────────┘
```

Zero runtime cost. All resolved at compile time. The generated Zig has no traces of CSS, Tailwind, or Bootstrap — just `.field = value`.

## What This Does NOT Cover

- **SCSS nesting** — `.tsz` doesn't have component-scoped stylesheets. SCSS property names work (they're just CSS), but nesting/variables/mixins don't apply.
- **styled-components** — that's a runtime pattern (tagged template literals creating components). Classifiers already serve this purpose at compile time.
- **CSS Grid** — the runtime only supports flexbox layout. Grid properties are silently ignored.
- **CSS animations/transitions** — no animation system in the runtime yet.
- **Media queries / responsive** — no viewport-aware layout yet.
- **CSS custom properties (variables)** — could be a future compile-time feature.
- **Percentage-based layout** — `100%` works for width/height but arbitrary percentages need layout engine support.

## Why This Matters

The target user "knows their domain but doesn't know internals." If they've used CSS for 10 years, they shouldn't have to learn camelCase. If they learned Tailwind in a bootcamp, they should be able to use that. If their team uses Bootstrap, those classes should just work.

One-liner design philosophy: every capability should be usable by someone who doesn't know internals.
