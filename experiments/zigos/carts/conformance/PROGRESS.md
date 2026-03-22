# Conformance Test Progress

## Status

### Real-world app ports

| # | Test | Compiles | Builds | Runs | Notes |
|---|------|----------|--------|------|-------|
| 01 | Ecommerce Dashboard | Y | Y | | 15 warnings (spaceBetween/flexStart not mapped as enum values) |
| 02 | Admin Panel | Y | N | | Component props unused param + _p_value out of scope in tick fn |
| 03 | Jira Board | Y | N | | Same component prop forwarding issue as 02 |

### Destructive pattern tests

| # | Test | Compiles | Builds | Runs | Notes |
|---|------|----------|--------|------|-------|
| d01 | Nested Maps | Y | Y | | |
| d02 | Component Returning Map | N | N | | collectComponents skips components where return value is .map() not JSX |
| d03 | Conditional Wrapping Map | Y | Y | | |
| d04 | Map Handler Captures | Y | Y | | |
| d05 | Dynamic Style in Map | Y | Y | | New: consumeStyleValueExpr resolves bar.pct → _oa0_pct[_i] |
| d06 | Ternary JSX Branches | Y | Y | | |
| d07 | Sibling Maps Shared State | Y | Y | | |
| d08 | Map Classifier Components | Y | Y | | |
| d09 | Nested Template Scope | Y | Y | | |
| d10 | Handler Triple Capture | Y | Y | | |
| d11 | Map → Component → Map | Y | Y | | |
| d12 | Evil Kanban | Y | Y | | |
| d13 | Schema Form | Y | Y | | |

## Compiler changes made

1. **emit.zig**: MAP_POOL 4096→256, `undefined` init instead of `** N` splat (fixes Zig compiler hang)
2. **attrs.zig**: Added `consumeStyleValueExpr()` — multi-token style expression parser with map scope resolution (bar.pct → _oa0_pct[_i], f32 cast, Color.rgb bit-shift for int colors)
3. **jsx_map.zig**: Added `skipBalancedElement()` — recursive skip for nested child elements in map template content loop (fixes infinite loop on `<Box><Text>...</Text></Box>` inside maps)
4. **attrs.zig**: Safety `else { self.advance_token(); }` in `parseStyleAttr` main loop to prevent infinite loops on unknown tokens
5. **build.zig**: Compiler stack 64MB (fixes `check` segfault — Generator struct + recursive parseJSXElement frames)
6. **collect.zig**: Positional component props `function Comp(a, b, c)` in addition to destructured `{ a, b, c }`

## Blockers

### d02: Component returning .map()
`collectComponents` at collect.zig:459 only registers components when `return` is followed by `<` (JSX). `TagList` returns `tags.map(...)` directly. Fix requires recognizing `.map()` as a valid component return value and handling it in the component inlining path.

### 02/03: Component prop forwarding
Positional props are now collected but the generated code has issues:
- Unused parameter warnings in init functions (props only used in tick/dynamic text)
- `_p_value` referenced in tick function but not in scope (props are function params in init, not available in tick)
