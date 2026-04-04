# Smith Pattern Manifest

Every React/JSX pattern the compiler handles lives in exactly ONE file under `patterns/`. If a pattern isn't here, it isn't supported. If you need to add support, find the right file by number and implement there. DO NOT put pattern logic in consumer files (attrs.js, conditional.js, ternary.js, etc). Consumers call pattern functions.

## File Format

Every pattern file MUST follow this exact structure:

```js
// ── Pattern 019: array.map() → element ──────────────────────────
// Index: 19
// Group: map
// Status: stub | partial | complete
//
// Soup syntax (copy-paste React):
//   {items.map((item) => (
//     <Box key={item.id} style={{padding: 8}}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   {items.map((item) => (
//     <Box key={item.id} style={{padding: 8}}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Zig output target:
//   for (0.._oa0_len) |_i| {
//     nodes._arr_0[_i] = .{ .style = .{ .padding = 8 } };
//     // text child with _oa0_name[_i][0.._oa0_name_lens[_i]]
//   }
//
// Notes:
//   (anything a future implementer needs to know — edge cases,
//    interactions with other patterns, what the love2d reference does)

function match(c, ctx) {
  // Return true if token stream at cursor matches this pattern.
  // DO NOT advance the cursor. Save/restore if you need to peek.
  return false;
}

function compile(c, ctx) {
  // Consume tokens, emit Zig. Return { zigExpr, nodeExpr, ... }
  // or whatever the consumer contract requires.
  return null;
}
```

### Rules

1. **One pattern per file.** No exceptions.
2. **Soup AND mixed examples required.** Show both syntaxes in the header. If they're identical for this pattern, say so explicitly: `// Mixed: same as soup for this pattern`.
3. **Zig output target required.** Show what the compiled Zig should look like.
4. **Status field required.** `stub` = not implemented. `partial` = some cases work. `complete` = all cases covered.
5. **match() must not advance the cursor.** Peek only. Use `c.save()`/`c.restore()`.
6. **compile() owns its tokens.** Advance past everything you consume.
7. **No imports from other pattern files.** Use the shared resolvers in `resolve/` for cross-cutting concerns (identity resolution, comparison normalization, eval building, etc).
8. **Do not touch consumer files.** Your job is match + compile. The consumer wiring is a separate task.

## Shared Resolvers (resolve/)

Cross-cutting concerns that multiple patterns need live in `resolve/`:

| File | Purpose |
|------|---------|
| `resolve/identity.js` | Resolve identifier → slot/render-local/prop/OA/map-item/script-fn |
| `resolve/comparison.js` | Normalize comparisons: === → ==, string → mem.eql, empty → .len |
| `resolve/truthiness.js` | Bare bool: qjs eval → (expr)?'T':'', slot → != 0 |
| `resolve/field_access.js` | x.field → OA field / qjs eval .field / .length → _len |
| `resolve/eval_builder.js` | Build/parse QuickJS eval strings, extract inner expr |
| `resolve/ternary.js` | cond ? a : b → Zig if/else with correct @as() types |

Pattern files call resolvers. Resolvers never call pattern files.

## Pattern Registry

### Primitives (1–10)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 1 | `primitives/p001_string_literal.js` | String literal render | `<Text>hello</Text>` |
| 2 | `primitives/p002_number_literal.js` | Number literal render | `<Text>{42}</Text>` |
| 3 | `primitives/p003_boolean_render.js` | Boolean render (swallowed) | `<Text>{true}</Text>` → nothing |
| 4 | `primitives/p004_null_render.js` | Null render (swallowed) | `<Text>{null}</Text>` → nothing |
| 5 | `primitives/p005_undefined_render.js` | Undefined render (swallowed) | `<Text>{undefined}</Text>` → nothing |
| 6 | `primitives/p006_jsx_element.js` | JSX element render | `<Box><Text>hi</Text></Box>` |
| 7 | `primitives/p007_fragment.js` | Fragment render | `<><A /><B /></>` |
| 8 | `primitives/p008_named_fragment.js` | Keyed fragment | `<React.Fragment key={id}><A /></React.Fragment>` |
| 9 | `primitives/p009_variable_interpolation.js` | Variable in JSX | `<Text>{username}</Text>` |
| 10 | `primitives/p010_expression_interpolation.js` | Expression in JSX | `<Text>{a + b}</Text>` |

### Ternary (11–15)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 11 | `ternary/p011_ternary_element.js` | Ternary → element | `{flag ? <A /> : <B />}` |
| 12 | `ternary/p012_ternary_null.js` | Ternary → null (conditional) | `{flag ? <A /> : null}` |
| 13 | `ternary/p013_ternary_string.js` | Ternary → string | `{flag ? "yes" : "no"}` |
| 14 | `ternary/p014_ternary_nested.js` | Nested ternary | `{a ? <A /> : b ? <B /> : <C />}` |
| 15 | `ternary/p015_ternary_fragment.js` | Ternary → fragment | `{flag ? <><A /><B /></> : null}` |

### Logical Operators (16–18)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 16 | `logical/p016_and_short_circuit.js` | && short-circuit | `{isOpen && <Modal />}` |
| 17 | `logical/p017_or_fallback.js` | \|\| fallback | `{name \|\| "Anonymous"}` |
| 18 | `logical/p018_nullish_fallback.js` | ?? nullish fallback | `{value ?? "default"}` |

### Map (19–29)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 19 | `map/p019_map_element.js` | .map() → element | `{items.map(item => <Box>{item.name}</Box>)}` |
| 20 | `map/p020_map_fragment.js` | .map() → fragment | `{items.map(item => <><A /><B /></>)}` |
| 21 | `map/p021_map_nested.js` | Nested map | `{groups.map(g => g.items.map(i => <C />))}` |
| 22 | `map/p022_map_ternary.js` | .map() with ternary | `{items.map(i => i.active ? <A /> : <B />)}` |
| 23 | `map/p023_map_and_filter.js` | .map() with && | `{items.map(i => i.show && <A />)}` |
| 24 | `map/p024_map_index_key.js` | Index as key | `{items.map((item, i) => <Box key={i} />)}` |
| 25 | `map/p025_map_stable_key.js` | Stable key | `{items.map(item => <Box key={item.id} />)}` |
| 26 | `map/p026_map_compound_key.js` | Compound key | `{items.map(item => <Box key={`${a}-${b}`} />)}` |
| 27 | `map/p027_map_destructured.js` | Destructured params | `{items.map(({name, id}) => <Text>{name}</Text>)}` |
| 28 | `map/p028_map_implicit_return.js` | Implicit return | `{items.map(item => (<Box />))}` |
| 29 | `map/p029_map_explicit_return.js` | Explicit return | `{items.map(item => { return <Box />; })}` |

### Filter/Sort/Reduce (30–38)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 30 | `filter_sort/p030_filter_map.js` | filter().map() | `{items.filter(i => i.active).map(i => <C />)}` |
| 31 | `filter_sort/p031_sort_map.js` | sort().map() | `{items.sort((a,b) => a.n - b.n).map(i => <C />)}` |
| 32 | `filter_sort/p032_filter_sort_map.js` | filter().sort().map() | chained pipeline |
| 33 | `filter_sort/p033_reduce_jsx.js` | reduce() → JSX | `{items.reduce((acc, i) => [...acc, <C />], [])}` |
| 34 | `filter_sort/p034_slice_map.js` | slice().map() | `{items.slice(0, 5).map(i => <C />)}` |
| 35 | `filter_sort/p035_slice_show_more.js` | slice + show more | `{items.slice(0, n).map(...)}` + toggle |
| 36 | `filter_sort/p036_flat_map.js` | flat().map() | `{nested.flat().map(i => <C />)}` |
| 37 | `filter_sort/p037_flatmap_element.js` | flatMap() | `{items.flatMap(i => [<A />, <B />])}` |
| 38 | `filter_sort/p038_spread_concat_map.js` | [...a, ...b].map() | `{[...listA, ...listB].map(i => <C />)}` |

### Array Construction (39–46)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 39 | `array_construction/p039_array_fill_map.js` | Array(n).fill().map() | `{Array(5).fill(0).map((_, i) => <C />)}` |
| 40 | `array_construction/p040_array_from_map.js` | Array.from().map() | `{Array.from({length: n}).map((_, i) => <C />)}` |
| 41 | `array_construction/p041_spread_array_map.js` | [...Array(n)].map() | `{[...Array(n)].map((_, i) => <C />)}` |
| 42 | `array_construction/p042_object_keys_map.js` | Object.keys().map() | `{Object.keys(obj).map(k => <Text>{k}</Text>)}` |
| 43 | `array_construction/p043_object_values_map.js` | Object.values().map() | `{Object.values(obj).map(v => <C v={v} />)}` |
| 44 | `array_construction/p044_object_entries_map.js` | Object.entries().map() | `{Object.entries(obj).map(([k,v]) => <C />)}` |
| 45 | `array_construction/p045_map_entries.js` | Map.entries() | `{Array.from(map.entries()).map(([k,v]) => <C />)}` |
| 46 | `array_construction/p046_set_to_array_map.js` | Set → array | `{Array.from(set).map(v => <C />)}` |

### Props (47–65)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 47 | `props/p047_string_prop.js` | String prop | `<C name="hello" />` |
| 48 | `props/p048_number_prop.js` | Number prop | `<C count={5} />` |
| 49 | `props/p049_boolean_shorthand.js` | Boolean shorthand | `<C disabled />` |
| 50 | `props/p050_boolean_explicit.js` | Boolean explicit | `<C disabled={true} />` |
| 51 | `props/p051_expression_prop.js` | Expression prop | `<C value={a + b} />` |
| 52 | `props/p052_callback_prop.js` | Callback prop | `<C onClick={() => doThing()} />` |
| 53 | `props/p053_callback_with_args.js` | Callback with args | `<C onClick={() => select(item.id)} />` |
| 54 | `props/p054_spread_props.js` | Spread props | `<C {...props} />` |
| 55 | `props/p055_spread_override.js` | Spread + override | `<C {...props} color="red" />` |
| 56 | `props/p056_computed_prop_name.js` | Computed prop name | `<C {[dynamicKey]: val} />` |
| 57 | `props/p057_object_prop.js` | Object prop | `<C style={{color: 'red'}} />` |
| 58 | `props/p058_array_prop.js` | Array prop | `<C items={[1,2,3]} />` |
| 59 | `props/p059_jsx_prop.js` | JSX as prop | `<C icon={<Icon />} />` |
| 60 | `props/p060_render_prop.js` | Render prop | `<C render={(val) => <Text>{val}</Text>} />` |
| 61 | `props/p061_function_as_children.js` | Function-as-children | `<C>{(val) => <Text>{val}</Text>}</C>` |
| 62 | `props/p062_destructured_signature.js` | Destructured params | `function C({name, age}) {}` |
| 63 | `props/p063_default_prop_values.js` | Default values | `function C({name = "anon"}) {}` |
| 64 | `props/p064_rest_props.js` | Rest props | `function C({name, ...rest}) {}` |
| 65 | `props/p065_forwarded_ref.js` | Forwarded ref prop | `forwardRef((props, ref) => ...)` |

### Children (66–72)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 66 | `children/p066_single_child.js` | Single child | `<Box><Text>hi</Text></Box>` |
| 67 | `children/p067_multiple_children.js` | Multiple children | `<Box><A /><B /><C /></Box>` |
| 68 | `children/p068_string_children.js` | String children | `<Text>hello world</Text>` |
| 69 | `children/p069_expression_children.js` | Expression children | `<Text>{count + 1}</Text>` |
| 70 | `children/p070_mixed_children.js` | Mixed children | `<Box><Text>hi</Text>{name}<A /></Box>` |
| 71 | `children/p071_array_children.js` | Array children | `<Box>{[<A />, <B />]}</Box>` |
| 72 | `children/p072_no_children.js` | Self-closing | `<Image src="a.png" />` |

### Component Reference (73–80)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 73 | `component_ref/p073_direct_component.js` | Direct call | `<MyComp />` |
| 74 | `component_ref/p074_dot_notation.js` | Dot notation | `<Form.Input />` |
| 75 | `component_ref/p075_dynamic_variable.js` | Dynamic component | `const C = map[type]; <C />` |
| 76 | `component_ref/p076_dynamic_ternary.js` | Dynamic ternary | `{flag ? <A /> : <B />}` (dynamic type) |
| 77 | `component_ref/p077_create_element.js` | createElement | `React.createElement(type, props)` |
| 78 | `component_ref/p078_clone_element.js` | cloneElement | `React.cloneElement(el, {newProp})` |
| 79 | `component_ref/p079_lazy_component.js` | Lazy | `React.lazy(() => import('./C'))` |
| 80 | `component_ref/p080_suspense.js` | Suspense | `<Suspense fallback={<Loading />}>` |

### Conditional Rendering (81–85)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 81 | `conditional_rendering/p081_if_else_early_return.js` | If/else return | `if (!data) return <Loading />; return <Main />` |
| 82 | `conditional_rendering/p082_guard_null.js` | Guard clause | `if (!user) return null;` |
| 83 | `conditional_rendering/p083_switch_return.js` | Switch statement | `switch(status) { case 'a': return <A /> }` |
| 84 | `conditional_rendering/p084_object_lookup.js` | Object lookup | `const views = {a: <A />, b: <B />}; return views[type]` |
| 85 | `conditional_rendering/p085_iife.js` | IIFE in JSX | `{(() => { if (x) return <A />; return <B />; })()}` |

### Composition (86–93)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 86 | `composition/p086_wrapper.js` | Wrapper component | `function Layout({children}) { return <Box>{children}</Box> }` |
| 87 | `composition/p087_hoc.js` | HOC | `const Enhanced = withAuth(MyComp)` |
| 88 | `composition/p088_forwarded_ref.js` | forwardRef | `forwardRef((props, ref) => <input ref={ref} />)` |
| 89 | `composition/p089_context_provider.js` | Context provider | `<ThemeCtx.Provider value={theme}>` |
| 90 | `composition/p090_context_consumer.js` | useContext | `const theme = useContext(ThemeCtx)` |
| 91 | `composition/p091_portal.js` | Portal | `createPortal(<Modal />, document.body)` |
| 92 | `composition/p092_error_boundary.js` | Error boundary | `componentDidCatch(error, info)` |
| 93 | `composition/p093_slot_pattern.js` | Slots | `<Layout header={<H />} sidebar={<S />} />` |

### Hooks in Render (94–100)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 94 | `hooks/p094_usestate_value.js` | useState value | `const [count, setCount] = useState(0); <Text>{count}</Text>` |
| 95 | `hooks/p095_usereducer_dispatch.js` | useReducer | `const [state, dispatch] = useReducer(r, init)` |
| 96 | `hooks/p096_usememo_computed.js` | useMemo | `const sorted = useMemo(() => items.sort(), [items])` |
| 97 | `hooks/p097_usecallback_handler.js` | useCallback | `const handler = useCallback(() => {}, [dep])` |
| 98 | `hooks/p098_useref_current.js` | useRef | `const ref = useRef(null); <Box ref={ref} />` |
| 99 | `hooks/p099_useid_generated.js` | useId | `const id = useId(); <label htmlFor={id}>` |
| 100 | `hooks/p100_custom_hook.js` | Custom hook | `const {data, loading} = useApi('/endpoint')` |

### Keys (101–104)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 101 | `keys/p101_key_element.js` | Key on element | `<Box key={item.id} />` |
| 102 | `keys/p102_key_fragment.js` | Key on fragment | `<Fragment key={id}><A /><B /></Fragment>` |
| 103 | `keys/p103_key_remount.js` | Key to force remount | `<Editor key={docId} />` (resets state) |
| 104 | `keys/p104_missing_key.js` | Missing key | `{items.map(i => <C />)}` (no key — anti-pattern) |

### Style (105–114)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 105 | `style/p105_inline_object.js` | Inline style | `style={{color: 'red', padding: 8}}` |
| 106 | `style/p106_computed_inline.js` | Computed style | `style={{width: `${n}px`}}` |
| 107 | `style/p107_classname_string.js` | className string | `className="header"` |
| 108 | `style/p108_classname_ternary.js` | className ternary | `className={active ? 'on' : 'off'}` |
| 109 | `style/p109_classname_template.js` | className template | `` className={`btn ${variant}`} `` |
| 110 | `style/p110_classname_array_join.js` | className array | `className={[a, b].filter(Boolean).join(' ')}` |
| 111 | `style/p111_classnames_utility.js` | classnames/clsx | `className={clsx('btn', {active})}` |
| 112 | `style/p112_css_module.js` | CSS module | `className={styles.header}` |
| 113 | `style/p113_css_in_js_template.js` | CSS-in-JS template | `` css`color: ${theme.primary}` `` |
| 114 | `style/p114_css_in_js_object.js` | CSS-in-JS object | `css({color: theme.primary})` |

### Events (115–120)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 115 | `events/p115_inline_arrow.js` | Inline arrow | `onPress={() => setCount(c + 1)}` |
| 116 | `events/p116_bound_method.js` | Method ref | `onPress={handleClick}` |
| 117 | `events/p117_event_param.js` | Event param | `onChange={(e) => setText(e.target.value)}` |
| 118 | `events/p118_prevent_default.js` | preventDefault | `onSubmit={(e) => { e.preventDefault(); ... }}` |
| 119 | `events/p119_closure_map_item.js` | Closure over item | `onPress={() => select(item.id)}` (inside .map) |
| 120 | `events/p120_synthetic_parent.js` | Pass to parent | `onPress={() => props.onSelect(item)}` |

### Strings/Templates (121–124)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 121 | `strings/p121_template_literal_jsx.js` | Template in JSX | `` <Text>{`Hello ${name}`}</Text> `` |
| 122 | `strings/p122_template_literal_prop.js` | Template as prop | `` <C title={`Page ${n}`} /> `` |
| 123 | `strings/p123_string_concat.js` | String concat | `<Text>{"Hello " + name}</Text>` |
| 124 | `strings/p124_array_join.js` | Array join | `<Text>{items.join(", ")}</Text>` |

### Type Narrowing (125–131)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 125 | `type_narrowing/p125_typeof_gate.js` | typeof gate | `{typeof x === 'string' && <Text>{x}</Text>}` |
| 126 | `type_narrowing/p126_array_isarray.js` | isArray gate | `{Array.isArray(v) && v.map(i => <C />)}` |
| 127 | `type_narrowing/p127_prop_in_obj.js` | 'prop' in obj | `{'url' in item && <Image src={item.url} />}` |
| 128 | `type_narrowing/p128_optional_chaining.js` | Optional chain | `<Text>{user?.name}</Text>` |
| 129 | `type_narrowing/p129_non_null_assertion.js` | Non-null assert | `<Text>{user!.name}</Text>` (TS) |
| 130 | `type_narrowing/p130_type_predicate.js` | Type predicate | `{isAdmin(user) && <AdminPanel />}` |
| 131 | `type_narrowing/p131_discriminated_union.js` | Discriminated union | `{item.type === 'text' ? <Text /> : <Image />}` |

### Misc JSX (132–140)

| # | File | Pattern | Soup Example |
|---|------|---------|-------------|
| 132 | `misc_jsx/p132_dangerously_set_html.js` | innerHTML | `dangerouslySetInnerHTML={{__html: str}}` |
| 133 | `misc_jsx/p133_spread_dom_attrs.js` | Spread on DOM | `<div {...domProps} />` |
| 134 | `misc_jsx/p134_data_attributes.js` | Data attrs | `<Box data-testid="main" />` |
| 135 | `misc_jsx/p135_aria_attributes.js` | Aria attrs | `<Box aria-label="close" role="button" />` |
| 136 | `misc_jsx/p136_svg_elements.js` | SVG in JSX | `<svg><path d="M0 0..." /></svg>` |
| 137 | `misc_jsx/p137_namespaced_attrs.js` | Namespaced attrs | `<use xlinkHref="#icon" />` |
| 138 | `misc_jsx/p138_jsx_comment.js` | JSX comment | `{/* this is a comment */}` |
| 139 | `misc_jsx/p139_multiline_parens.js` | Multiline parens | `return (\n  <Box>\n    ...\n  </Box>\n)` |
| 140 | `misc_jsx/p140_adjacent_fragment.js` | Adjacent elements | `return <A /><B />` → needs fragment wrapper |

---

## Chad Intent Patterns (c001–c030)

These catalog Intent Dictionary constructs — the chad-tier compiler lane. Same `match()`/`compile()` contract. Source of truth: `tsz/docs/INTENT_DICTIONARY.md`.

### Core Binding & Declaration (c001–c006)

| # | File | Construct | Chad Example |
|---|------|-----------|-------------|
| c001 | `c001_blocks.js` | Block headers | `<my app>`, `<home page>`, `<counter component>` |
| c002 | `c002_var.js` | `<var>` block | `set_count is 0`, `items is array`, `MAX exact 100` |
| c003 | `c003_is.js` | `is` binding | `set_count is 0`, `fontSize is 18`, `set_count is count + 1` |
| c004 | `c004_exact.js` | `exact` binding | `MAX exact 100`, `<if count exact 0>`, `height exact 1` |
| c005 | `c005_types.js` | `<types>` block | `<types><mode>time\ndate</mode></types>` |
| c006 | `c006_props.js` | `<props>` block | `initial is 0`, `max exact number`, `onSave` |

### Control Flow (c007–c012)

| # | File | Construct | Chad Example |
|---|------|-----------|-------------|
| c007 | `c007_if.js` | `<if>` conditional | `<if count above 0>`, `<if status exact 'active'>` |
| c008 | `c008_else.js` | `<else>` / `<else if>` | `<else if number exact 0>`, `<else>` |
| c009 | `c009_for.js` | `<for>` iteration | `<for items>`, `<for channels as ch>`, `<for 0..count as i>` |
| c010 | `c010_during.js` | `<during>` lifecycle | `<during recording>`, `<during loading>` |
| c011 | `c011_while.js` | `<while>` loop | `<while sdl.pollEvent as event>` |
| c012 | `c012_switch.js` | `<switch>` / `<case>` | `<switch event.type><case quit>stop</case></switch>` |

### Functions & Logic (c013–c017)

| # | File | Construct | Chad Example |
|---|------|-----------|-------------|
| c013 | `c013_functions.js` | `<functions>` block | `increment:\n  set_count is count + 1` |
| c014 | `c014_composition.js` | `+` composition | `validateInput + appendItem + clearInput` |
| c015 | `c015_stop.js` | `stop` / `skip` | `stop` (halt chain), `skip` (next iteration) |
| c016 | `c016_every.js` | Scheduled functions | `tick every 33:` |
| c017 | `c017_set.js` | `set_` mutation | `set_count is count + 1` |

### Data & Structure (c018–c020)

| # | File | Construct | Chad Example |
|---|------|-----------|-------------|
| c018 | `c018_data_blocks.js` | Named data blocks | `<cards>\n  id: 1, title: Auth\n</cards>` |
| c019 | `c019_ffi.js` | `<ffi>` block | `<sqlite3 ffi>\n  open\n  close\n</sqlite3>` |
| c020 | `c020_log.js` | `<log>` block | `<log save>\n  fetchData + writeToDb\n</log>` |

### Visual Layer (c021–c026)

| # | File | Construct | Chad Example |
|---|------|-----------|-------------|
| c021 | `c021_classifiers.js` | Classifiers (`C.Name`) | `<C.Row is Box>`, `<C.Btn decrement>` |
| c022 | `c022_effects.js` | Effects | `<Text lava>`, `<lava effect>fill(x,y,t)` |
| c023 | `c023_glyphs.js` | Glyph shortcodes | `:check:`, `:star[plasma]:`, glyph tiers 1-4 |
| c024 | `c024_tokens.js` | Theme tokens | `<tokens>`, `<main>`, `theme-primary` |
| c025 | `c025_colors.js` | `<colors>` block | `red(dark)`, `<ocean gradient>` |
| c026 | `c026_animations.js` | Animations | `<C.Card fadeIn>`, `<pulse animation>` |

### Backend Hatches (c027)

| # | File | Construct | Chad Example |
|---|------|-----------|-------------|
| c027 | `c027_hatches.js` | `<script>`/`<zscript>`/`<lscript>` | Backend target directives |

### Collection Operations (c028–c030)

| # | File | Construct | Chad Example |
|---|------|-----------|-------------|
| c028 | `c028_where.js` | `items.where()` | `items.where(item.active)` |
| c029 | `c029_without.js` | `items.without()` | `items.without(item)` |
| c030 | `c030_concat.js` | `items.concat()` | `items.concat(newItem)` |
