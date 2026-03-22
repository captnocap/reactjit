# Conformance Test Progress

## Status

### Real-world app ports

| # | Test | Compiles | Builds | Runs | Notes |
|---|------|----------|--------|------|-------|
| 01 | Ecommerce Dashboard | Y | Y | Y | Layout correct, map items render, some template literals unresolved |
| 02 | Admin Panel | Y | Y | Y | Sidebar + widgets + datatable render, ${value}/${user.age} unresolved |
| 03 | Jira Board | Y | Y | Y | Kanban columns + headers render, issue cards need deeper template resolution |

### Destructive pattern tests

| # | Test | Compiles | Builds | Runs | Notes |
|---|------|----------|--------|------|-------|
| d01 | Nested Maps | Y | Y | Y | |
| d02 | Component Returning Map | Y | Y | Y | Tag pills render with correct colors |
| d03 | Conditional Wrapping Map | Y | Y | Y | |
| d04 | Map Handler Captures | Y | Y | Y | |
| d05 | Dynamic Style in Map | Y | Y | Y | Dynamic widths + colors from item fields work |
| d06 | Ternary JSX Branches | Y | Y | Y | Both ternary branches render correctly |
| d07 | Sibling Maps Shared State | Y | Y | Y | |
| d08 | Map Classifier Components | Y | Y | Y | |
| d09 | Nested Template Scope | Y | Y | Y | |
| d10 | Handler Triple Capture | Y | Y | Y | |
| d11 | Map → Component → Map | Y | Y | Y | |
| d12 | Evil Kanban | Y | Y | Y | 4 columns, filter bar, 243 FPS |
| d13 | Schema Form | Y | Y | Y | |

## Compiler changes made

1. **emit.zig**: MAP_POOL 4096→256, `undefined` init instead of `** N` splat (fixes Zig compiler hang at ReleaseFast)
2. **attrs.zig**: Added `consumeStyleValueExpr()` — multi-token style expression parser with map scope resolution (bar.pct → _oa0_pct[_i], f32 cast, Color.rgb bit-shift for int colors)
3. **jsx_map.zig**: Added `skipBalancedElement()` — recursive skip for nested child elements in map template content loop (fixes infinite loop on `<Box><Text>...</Text></Box>` inside maps)
4. **attrs.zig**: Safety `else { self.advance_token(); }` in `parseStyleAttr` main loop to prevent infinite loops on unknown tokens
5. **build.zig**: Compiler stack 64MB (fixes `check` segfault — Generator struct + recursive parseJSXElement frames)
6. **collect.zig**: Positional component props `function Comp(a, b, c)` in addition to destructured `{ a, b, c }`
7. **collect.zig**: Register components returning `.map()` expressions (not just JSX `<elements>`)
8. **components.zig**: Map-aware component inlining — `isMapAhead()` at body_pos uses `parseMapExpression`
9. **components.zig**: Disabled multi-use init function optimization for components with props (prop forwarding broken in shared functions)

## Known rendering issues (non-blocking)

- Template literals with map item field references (`${bar.pct}`, `${user.age}`) show as raw text — the template literal parser doesn't resolve object array fields in all contexts
- `justifyContent: "spaceBetween"` and `alignSelf: "flexStart"` not recognized (camelCase vs kebab-case enum values) — layout falls back to defaults
