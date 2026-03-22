# Nested Maps

Nested `.map()` calls — an inner `.map()` inside an outer `.map()` template — with per-column filtering and 2D pool allocation.

## .tsz API

```tsx
const [columns, setColumns] = useState([{ title: '', wip: 0 }]);
const [tasks, setTasks] = useState([{ title: '', colIdx: 0, priority: 0 }]);

function App() {
  return (
    <Box style={{ flexDirection: "row", gap: 8 }}>
      {columns.map((col, ci) => (
        <Box style={{ flexGrow: 1 }}>
          <Text>{col.title}</Text>
          <ScrollView style={{ flexGrow: 1, gap: 6 }}>
            {tasks.map((task, ti) => (
              <Box>
                {task.colIdx == ci && <Box>
                  <Text>{task.title}</Text>
                </Box>}
              </Box>
            ))}
          </ScrollView>
        </Box>
      ))}
    </Box>
  );
}
```

The inner `tasks.map()` iterates a global object array. The conditional `{task.colIdx == ci && ...}` filters tasks by the outer column index `ci`. Each column only shows its matching tasks.

## Compiler files

| File | What it does |
|------|-------------|
| `compiler/jsx_map.zig` | `parseMapExpression` pre-reserves map slot so inner maps can reference parent. Detects `.map()` in `parseMapTemplateChild` brace handler. Sets `parent_map_idx`, `parent_inner_idx` on inner MapInfo. Saves `parent_map_index_param` for cross-scope index resolution. |
| `compiler/codegen.zig` | `MapInfo.parent_map_idx` (-1 = independent, >=0 = nested). `MapInfo.parent_inner_idx` (which inner node of parent to attach to). `Generator.parent_map_index_param` for resolving outer index in inner templates. |
| `compiler/emit.zig` | 2D pool declarations `[MAX_OUTER][MAX_INNER]Node` for nested maps. 3D inner arrays `[MAX_OUTER][MAX_INNER][N]Node`. Parameterized rebuild function `fn _rebuildMapN(_ci: usize) void` with filtered output using `_nc` counter. Skips independent rebuild for nested maps in `_appInit`. |
| `compiler/emit_map.zig` | `emitMapRebuildCalls` chains nested rebuilds: `for (0.._map_count_0) |_ci| { _rebuildMap1(_ci); ... }`. Assigns per-column pool slice to parent inner node children. |
| `compiler/attrs.zig` | `consumeStyleValueExpr` resolves `parent_map_index_param` identifiers. |
| `compiler/handlers.zig` | `emitStateAtom` resolves map item fields and index params in handler bodies. |

## Framework files

No framework changes needed. Uses existing:
- `framework/layout.zig` — flex layout with `display: none` support
- `framework/state.zig` — dirty tracking triggers rebuild

## How it works

1. **Parse**: Inner `.map()` detected inside outer map template child. Pre-reserved slot ensures `parent_map_idx` is set correctly.
2. **Emit pool**: 2D arrays `_map_pool_1[MAX_MAP_0][MAX_MAP_1]` and `_map_count_1[MAX_MAP_0]` — one pool per outer item.
3. **Emit rebuild**: Parameterized function `_rebuildMap1(_ci: usize)` iterates ALL inner items, filters by `colIdx == _ci`, populates only matching items using `_nc` output counter.
4. **Chain**: After outer rebuild, loop calls `_rebuildMap1(_ci)` per column and assigns `_map_inner_0[_ci][scroll_idx].children = _map_pool_1[_ci][0.._map_count_1[_ci]]`.
5. **First string field**: Inner pool nodes automatically get `.text` from the inner object array's first string field (e.g., `task.title`).

## Known limitations

- **Only global array inner sources**: `tasks.map()` works when `tasks` is a top-level `useState([{...}])`. Per-item nested arrays (`group.items.map()` in d01) are NOT supported — the inner array is a field of the outer item, not a known array source.
- **Title text only**: Inner pool nodes show the first string field as text. Full template content (priority dots, tags, assignee avatars, component invocations inside nested maps) requires deeper template emission — the inner template's components/conditionals are not yet inlined.
- **Single filter field**: The filter uses the first conditional's display condition (`colIdx == _ci`). Multiple filter criteria or non-equality filters are not supported.
- **No inner map onPress handlers**: The parameterized rebuild doesn't generate comptime handler factories for inner map items.
- **Memory**: 2D pools use `MAX_OUTER * MAX_INNER` nodes. With defaults (256 * 256 = 65K nodes), this is ~20MB of BSS. Acceptable for desktop but could be reduced with smaller nested limits.
