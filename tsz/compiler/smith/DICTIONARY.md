# Smith Compiler Dictionary

Reference for understanding the Smith compiler. Read this before touching any `.js` file in this directory.

## Architecture

```
.tsz source
  -> Forge (forge.zig, ~430 lines Zig)
     1. Read source + recursively resolve imports (depth-first)
     2. Classify imports: .component, .classifier, .script
     3. Merge component sources (strip App() stubs from imported components)
     4. Lex merged source into tokens (lexer.zig, fast Zig)
     5. Init QuickJS, pass tokens + source + flags to Smith
     6. Call compile(), get back complete .zig source string
     7. Write output file(s)

  -> Smith (legacy coordinators + refactor helpers, bundled at build time)
     Runs inside QuickJS. No print() -- debug via globalThis.__dbg.
     Token data arrives as parallel kind/start/end arrays matching lexer.zig's TokenKind enum.
     Authoring source lives under smith/*.js and smith/refactor/**/*.js.
```

**Forge embeds a generated Smith bundle at build time.** The bundle is written to `compiler/smith/dist/smith.bundle.js` from `compiler/smith/refactor/LOAD_ORDER.txt`. After editing `smith/*.js` or `smith/refactor/**/*.js`, run `zig build forge` or `zig build smith-bundle`.

Use `zig build smith-sync` to report:

- dirty active legacy/refactor files
- bundle staleness versus manifest sources
- authored `.js` files that are not in `LOAD_ORDER.txt`

## Load Order

The authoritative Smith load order lives in:

- `compiler/smith/refactor/LOAD_ORDER.txt`

Forge now embeds one generated file:

- `compiler/smith/dist/smith.bundle.js`

The bundle is produced by:

- `compiler/smith/refactor/build_bundle.mjs`

All functions are still in global scope. The bundle is concatenation only; QuickJS does not resolve runtime imports.

## File Inventory

| Path | Purpose |
|------|---------|
| rules.js | Constants: TK enum, style/color/enum key maps, HTML tag map, soup constants |
| logs.js | LOG dictionary, `LOG_EMIT()`, print shim |
| refactor/core.js | Shared low-level helpers, cursor, compiler context, slot helpers |
| refactor/collect/* | Collection pass helpers for components, script, state, classifiers, render locals |
| refactor/lanes/* | Lane dispatch and shared app/page finishing |
| index.js | Top-level `compile()` entry and module transpilers |
| mod.js | Block-based module compiler: `<module>` with `<types>/<ffi>/<state>/<functions>` |
| page.js | Page block compiler: `<page route=name>` with `<var>/<state>/<functions>/<timer>` blocks |
| attrs.js | Shared attribute helpers still used by parse coordinators |
| refactor/parse/* | Purpose-scoped parser helpers for maps, brace expressions, children, and element attrs |
| parse_map.js | Compatibility coordinator for legacy map entrypoints |
| parse.js | JSX parser coordinator |
| refactor/preflight/* | Rule-group helpers for preflight validation |
| preflight.js | Preflight rule runner |
| refactor/emit/* | Purpose-scoped emit helpers |
| emit_split.js | Split-output and JS/Lua logic emission helpers |
| emit.js | Top-level emit coordinator |
| soup_smith.js | Separate compiler lane for web React "soup" sources |
| refactor/REFACTOR_CHECKLIST.md | Active migration checklist and sequencing |

---

## Compilation Pipeline

### Entry: `compile()` (index.js)

```
1. `compileLane(source, tokens, file)` chooses the lane.
2. Soup lane -> `compileSoupLane()` -> `compileSoup()`
3. Module lane -> `compileModuleLane()` -> `compileMod*()`
4. Page lane -> `compilePageLane()` -> `compilePage()`
5. App lane:
   a. `mkCursor()` + `resetCtx()`
   b. `collectCompilerInputs(c)`
   c. find App start + collect render locals
   d. move to App return and `parseJSXElement(c)`
   e. `finishParsedLane()` runs preflight + emit + integrity stamping
6. Split-output payloads still bypass integrity wrapping the same way they did before.
```

---

## ctx — The Compiler State (`refactor/core.js` via `resetCtx()`)

This is the central data structure. Every phase reads and writes to it.

**Note:** Core fields are initialized in `resetCtx()`. Several fields are added lazily during compilation and won't appear in resetCtx: `dynStyles`, `effectRenders`, `currentMap`, `nameRemap`, `_orphanColors`, `_preflight`, `mapDynCount`, `terminalCount`, `inputCount`.

### State Slots
```
ctx.stateSlots: [{getter, setter, initial, type}]
  type: 'int' | 'float' | 'boolean' | 'string'
  Populated by: collectState(), collectComponents() (per-component useState)
  Used by: findSlot(), isGetter(), isSetter(), slotGet(), slotSet()
  Example: {getter:'count', setter:'setCount', initial:0, type:'int'}
```

### Components
```
ctx.components: [{name, propNames, bodyPos, stateSlots}]
  bodyPos: token cursor position of first JSX token in return statement
  stateSlots: per-component useState slots (allocated fresh per inline instance)
  Populated by: collectComponents()
  Used by: findComponent(), parseJSXElement() component inlining
```

### Handlers
```
ctx.handlers: [{name, body, luaBody, inMap, mapIdx}]
  name: '_handler_press_N' (auto-generated)
  body: Zig source code for the handler function body
  luaBody: Lua equivalent for LUA_LOGIC dispatch
  inMap: true if handler is inside a .map() template
  mapIdx: which map this handler belongs to (-1 if not in map)
  Populated by: parseJSXElement() (onPress/onTap/onToggle/onSelect/onChange attrs)
  Used by: emitOutput() (handler fn stubs), emitLogicBlocks() (JS/Lua dispatch)
```

### Dynamic Text
```
ctx.dynTexts: [{bufId, fmtString, fmtArgs, arrName, arrIndex, bufSize, inMap, mapIdx, _mapTextIdx}]
  fmtString: Zig format string like "Count: {d}"
  fmtArgs: Zig format args like ".{state.getSlot(0)}"
  inMap: true if this text is inside a map template (per-item buffer needed)
  Populated by: parseTemplateLiteral() in parse_map.js, text node handling in parse.js
  Used by: emitOutput() (_dyn_buf_N declarations, _updateDynamicTexts, map text wiring)
```

### Dynamic Colors
```
ctx.dynColors: [{dcId, arrName, arrIndex, colorExpr}]
  Used for color prop runtime assignments when prop value is a variable.
  Populated by: attrs.js color attribute handling
  Used by: emitOutput() in _updateDynamicTexts
```

### Dynamic Styles
```
ctx.dynStyles: [{field, expression, arrName, arrIndex, isColor}]
  field: Zig style field name (e.g. 'background_color', 'width')
  expression: Zig expression evaluated at runtime (e.g. 'if (cond) Color.rgb(...) else Color.rgb(...)')
  Populated by: parseStyleBlock() ternary paths, color ternary paths in attrs.js
  Used by: emitOutput() in _updateDynamicTexts
```

### Conditionals
```
ctx.conditionals: [{condExpr, kind, arrName, arrIndex, trueIdx, falseIdx, inMap}]
  kind: 'show_hide' ({cond && <X>}) or 'ternary_jsx' ({cond ? <A> : <B>})
  condExpr: Zig boolean expression
  trueIdx/falseIdx: indices into the parent array for display toggling
  Populated by: tryParseConditional(), tryParseTernaryJSX() in parse_map.js
  Used by: emitOutput() in _updateConditionals, map rebuild per-item conditionals
```

### Object Arrays (OA)
```
ctx.objectArrays: [{fields, getter, setter, oaIdx, isConst, constData, constLen, isNested, parentOaIdx, parentField}]
  fields: [{name, type, nestedOaIdx?, nestedFields?}]
    type: 'int' | 'float' | 'string' | 'boolean' | 'nested_array'
  oaIdx: unique index for this OA (used in generated var names: _oaN_fieldName)
  isConst: true for `const arr = [{...}]` (static data, no QJS unpack)
  isNested: true for nested array fields (child OA with parentIdx tracking)
  Storage: Structure-of-Arrays (SoA) -- one flat array per field, not array-of-structs
  Populated by: collectState() (useState arrays), collectConstArrays(), inferOaFromSource()
  Used by: map parsing (tryParseMap needs an OA), emitOutput() (storage + ensureCapacity + unpack)
```

### Maps
```
ctx.maps: [{oaIdx, itemParam, indexParam, oa, textsInMap, innerCount, parentArr, childIdx,
            mapArrayDecls, mapArrayComments, parentMap, isInline, isNested,
            templateExpr, _handlerFieldRefsMap, _parentMi, _mapPerItemDecls}]
  oaIdx: which object array this map iterates over
  itemParam: the name used for the item variable (e.g. 'task', 'item')
  indexParam: the name used for the index variable (e.g. 'i', 'idx')
  oa: reference to the objectArray entry
  mapArrayDecls: array declarations created during template parsing (per-item scope)
  parentMap: reference to enclosing map (for nested/inline resolution)
  isInline: separate-OA map inside another map's template
  isNested: nested array map (e.g. group.items.map())
  templateExpr: the parsed Node expression for one map item
  Three pool types:
    Flat: [MAX_MAP_N]Node -- top-level map
    Nested: [MAX_OUTER][MAX_NESTED]Node -- nested array field map (2D)
    Inline: [MAX_INLINE_OUTER][MAX_INLINE]Node -- separate OA inside parent map (2D)
  Populated by: tryParseMap(), tryParseNestedMap() in parse_map.js
  Used by: emitOutput() (pool declarations, _rebuildMap functions)
```

### Node Tree
```
ctx.arrayDecls: ["var _arr_N = [_]Node{ ... };"]
  The static node tree. Each array holds sibling nodes.
  _root points at the top-level array.
  Maps get placeholder .{} nodes that _rebuildMap fills with .children.

ctx.arrayComments: ["// tsz:file:line -- <Tag>"]
  Source location breadcrumbs for each array (1:1 with arrayDecls).

ctx.arrayCounter: int
  Monotonically increasing counter for unique array names (_arr_0, _arr_1, ...).
  Never reset, even across map boundaries (prevents name collisions).
```

### Counters
```
ctx.handlerCount: int
  Monotonically increasing. Generates unique handler names: _handler_press_0, _handler_press_1, ...

ctx.dynCount: int
  Global dynamic text buffer counter. Each non-map dynText gets a unique bufId.

ctx.mapDynCount: int
  Map-internal dynamic text counter. Separate namespace from dynCount.

ctx.terminalCount: int
  Terminal ID allocator. Each <Terminal> element gets a unique terminal_id.

ctx.inputCount: int
  TextInput ID allocator. Each <TextInput> element gets a unique input_id.
```

### Other ctx Fields
```
ctx.propStack: {propName: value}
  Active during component inlining. Maps prop names to their call-site values.
  Saved/restored around each component inline.

ctx.slotRemap: {getterOrSetterName: slotIndex}
  Per-component-instance state slot remapping. Each component inline gets unique slot indices.

ctx.nameRemap: {originalName: uniqueName}
  Maps original getter/setter names to unique suffixed names for Lua/JS handler strings.

ctx.inlineComponent: string|null
  Name of component currently being inlined (for debug/comments).

ctx.componentChildren: array|null
  Children nodes passed to current component at call site ({children} prop support).

ctx.currentMap: mapInfo|null
  The map currently being parsed. Used by attrs.js/parse.js to resolve item.field access.
  Nested maps push/pop this as a stack via savedMapCtx.

ctx.renderLocals: {varName: resolvedValue}
  Variables between `function App() {` and `return`. Substituted during parse.
  Example: `const total = count * price` -> renderLocals.total = 'state.getSlot(0) * state.getSlot(1)'

ctx.scriptBlock: string|null
  Raw JS from <script>...</script> blocks. Embedded in JS_LOGIC.

ctx.scriptFuncs: [string]
  Function names defined in <script> or imported .script.tsz files.
  Used by isScriptFunc() to wire handler dispatch through qjs_runtime.callGlobal().

ctx.classifiers: {Name: {type, style, fontSize, color, ...}}
  From .cls.tsz imports. C.Name in JSX resolves through this.

ctx.effectRenders: [{id, body, param}]
  <Effect onRender={(e) => {...}}> callbacks, transpiled JS->Zig.

ctx._orphanColors: [{field, value}]
  Color{} placeholders with no dynStyle backing. Tracked for preflight F4 check.

ctx._preflight: {ok, errors, warnings, lane, intents}
  Preflight result. Used by emitOutput() for lane comment.

ctx._debugLines: [string]
  Debug output emitted as Zig comments at end of generated file.

ctx._unresolvedClassifiers: [{name, line}]
  C.Name used in JSX but no classifier definition found. Preflight F11 check.

ctx._droppedExpressions: [{expr, line}]
  {expr} in parseChildren that didn't match any handler. Silent skip tracked here.

ctx._unknownSubsystemTags: [{tag, line}]
  Physics.*/3D.*/Effect/Scene3D tags with no runtime support.

ctx._ignoredModuleBlocks: [{name}]
  <module name> blocks in page source. page.js tracks these; not processed by page compiler.

ctx._undefinedJSCalls: [{caller, callee}]
  JS function calls in JS_LOGIC to functions not defined anywhere. Validated by page.js buildPageJSLogic().

ctx._duplicateJSVars: [{name}]
  var declared more than once in JS_LOGIC. Validated by page.js buildPageJSLogic().

ctx._jsDynTexts: [{slotIdx, jsExpr}]
  JS-evaluated dynamic text expressions. page.js appends __evalDynTexts() + setInterval(16ms) to scriptBlock.
```

---

## Function Index

### rules.js
No functions. Constants only: `TK`, `styleKeys`, `colorKeys`, `enumKeys`, `htmlTags`, `namedColors`, `soupTags`, `soupFonts`, `soupColors`.

### logs.js
- `LOG_EMIT(id, data)` -- Emit structured log entry. Checks __SMITH_LOGS / __SMITH_LOGS_FIND. Output via __dbg (Zig comments).

### index.js -- Core
- `mkCursor(raw, source)` -- Build token cursor from "kind start end\n..." string. Methods: kind(), text(), textAt(i), advance(), isIdent(n), save(), restore(p). Handles multi-byte UTF-8 via _b2c byte-to-char map.
- `resetCtx()` -- Initialize fresh compiler state.
- `collectComponents(c)` -- Scan for `function Name({props})`, record bodyPos and per-component useState.
- `findComponent(name)` -- Lookup component by name in ctx.components.
- `collectScript(c)` -- Extract all `<script>` blocks, concatenate, scan for function names. Also scans __scriptContent (imported .script.tsz files).
- `isScriptFunc(name)` -- Check if name is defined in script blocks.
- `collectState(c)` -- Scan for `const [g, s] = useState(init)`. Handles int/float/boolean/string/object_array types. Object arrays: parses field schema from first item, supports nested array fields.
- `collectConstArrays(c)` -- Scan for `const name = [{...}, ...]`. Creates read-only OA with constData/constLen.
- `collectClassifiers()` -- eval() __clsContent with local `classifier()` binding. Populates ctx.classifiers.
- `clsStyleFields(def)` -- Convert classifier style object to Zig style fields array.
- `clsNodeFields(def)` -- Convert classifier fontSize/color to Zig node fields.
- `mergeFields(clsFields, inlineFields)` -- Merge classifier defaults with inline overrides (inline wins).
- `stampIntegrity(out)` -- Prepend integrity header with BODYHASH placeholder (filled by forge).
- `compile()` -- **ENTRY POINT.** Orchestrates full pipeline. Returns .zig source string.
- `compileMod(source, file)` -- Line-by-line TS->Zig transpilation (regex-based). Handles imports, functions, variables, control flow.
- `compileModLua(source, file)` -- Line-by-line TS->Lua transpilation.
- `compileModJS(source, file)` -- Line-by-line TS->JS (strip type annotations).
- `transpileType(ts)` -- TS type -> Zig type (number->i64, string->[]const u8, etc).
- `transpileParams(params)` -- Transpile function parameter list.
- `transpileModExpr(expr)` -- Basic expression transpilation (===, !==, ||, &&, ??).

### mod.js -- Block Module Compiler
- `zigEscape(name)` -- Escape Zig keywords with @"name".
- `modTranspileType(ts)` -- TS type -> Zig type (extended: int->i64, float->f32, Type[N]->[N]Type, Type[]->[]Type, ?Type->?Type).
- `compileModBlock(source, file)` -- Parse `<module name>` with `<types>`, `<ffi>`, `<state>`, `<functions>` blocks.
- `emitFfiBlock(content)` -- Parse `symbol @("lib")` declarations -> @cImport or std imports.
- `emitTypesBlock(content, typeNames, enumVariants, allVariants)` -- Parse type declarations: enums (A | B | C), structs ({fields}), tagged unions (union {variants}).
- `emitEnumDecl(name, rest, allVariants)` -- Emit `pub const Name = enum { ... }`.
- `emitStructDecl(name, bodyLines, typeNames)` -- Emit `pub const Name = struct { ... }` with inferred defaults.
- `inferDefault(rawType, zigType, typeNames)` -- Infer default values: string->"", ?Type->null, KnownStruct->.{}.
- `emitUnionDecl(name, bodyLines, typeNames)` -- Emit `pub const Name = union(enum) { ... }`.
- `modTranspileDefault(val, zigType, typeNames)` -- Transpile default value (identifier->.identifier, null->null, etc).
- `emitStateBlock(content, typeNames)` -- Parse `name: Type = default` -> `var name: ZigType = zigDefault`.
- `emitFunctionsBlock(content, typeNames, allVariants)` -- Split functions by signature, call emitOneFunction for each.
- `emitOneFunction(sig, rawBodyLines, typeNames, allVariants)` -- Emit `pub fn name(params) ret { body }`.
- `modTranspileParams(params)` -- Transpile param list for block mode.
- `emitFunctionBody(lines, typeNames, depth)` -- LEGACY body emitter. Handles guards, returns, switch, for loops, assignments.
- `emitModBody(lines, startIdx, typeNames, depth, allVariants, retType)` -- V2 body emitter. More complete: if/else, while, for-as, switch, return, assignments, bare expressions, nested ternaries.
- `emitArmBody/emitArmBodyV2` -- Switch arm body emission.
- `emitForBody/emitForLoopV2` -- For loop body emission with item variable substitution.
- `modTranspileExpr(expr)` -- Expression transpiler. Handles (in order): `exact` keyword (→ ==), enum variant prefixing (bare variant → .variant after = or ==), operators (===→==, !==→!=, ||→or, &&→and, ??→orelse), stdlib mapping (.indexOf→std.mem.indexOf, .indexOfChar→std.mem.indexOfScalar, .eql→std.mem.eql, parseInt→std.fmt.parseInt), FFI call prefixing (sym()→prefix.fn()), Posix constant mapping (AF_INET→posix.AF.INET), string concatenation (a + 'b' → std.fmt.bufPrint via transpileStringConcat).
- `modTranspileForExpr/modTranspileForExprV2` -- Expression transpilation within for loop context.
- `transpileStringConcat(expr)` -- JS string `+` concatenation -> Zig std.fmt.allocPrint.
- `isComparison(lhs)` -- Check if expression contains comparison operators.
- `inferTypeFromValue(val)` -- Infer Zig type from value literal.
- `transpileStructLiteral(inner)` -- `{field: val}` -> `.{.field = val}`.
- `emitMapFunction(fname, zigParams, zigRet, bodyText, typeNames)` -- `return arr.map(...)` -> Zig for loop with result array.

### page.js -- Page Block Compiler
- `extractPageBlock(source, tag)` -- Extract content of a single `<tag>...</tag>` block (source-level regex). Returns empty string if absent.
- `extractPageBlocks(source, tag)` -- Extract all blocks of a given tag. Returns `[{attrs, body}]`.
- `parsePageVarBlock(block)` -- Parse `<var>` block. Each line: `name is value` or bare `name`. Classifies types: ambient reads (`sys.*`, `time.*`, `device.*`, `locale.*`, `privacy.*`, `input.*`), string literals, booleans, int/float, object_array (starts with `[`), expression (fallback). Multi-line values tracked via bracket depth. Returns `[{name, type, initial?, ambient?, namespace?, field?}]`.
- `parsePageStateBlock(block)` -- Parse `<state>` block. Returns list of setter names for validation.
- `parsePageFunctionsBlock(block)` -- Parse `<functions>` block. `name:` or `name(params):` headers collect indented body lines. Returns `[{name, params, bodyLines}]`.
- `transpilePageExpr(expr)` -- Page expression transpiler: `exact` → `===`.
- `transpilePageLine(line, setterNames)` -- Single page function body line transpiler. Guards: `expr ? stop : go` → `if (...) return;`, `expr ? go : stop` → `if (!(...)) return;`. Setters: `set_X to expr` → `set_X(expr);`. Passthrough for everything else.
- `buildPageJSLogic(stateVars, ambients, functionsBlock, timerBlocks)` -- Assemble JS_LOGIC from page blocks. Primitives (int/float/bool/string) are emitted by emit_split — skipped here. Non-primitives get `var + setter`. Ambients get `__ambient(ns, field)`. Functions: composition (`f + g` → `f(); g();`), computed (single expression → `return expr`), regular (multi-line). Timer blocks → `setInterval(...)`. Runs duplicate-var and undefined-call validation, populating `ctx._duplicateJSVars` and `ctx._undefinedJSCalls`.
- `compilePage(source, c, file)` -- **Page mode entry point.** Extracts `<var>/<state>/<functions>/<timer>` blocks, parses vars/ambients, populates `ctx.stateSlots` (primitives only), sets `ctx.scriptBlock` + `ctx.scriptFuncs`, registers OAs for object_array vars, runs `collectComponents`/`collectConstArrays`/`collectClassifiers`, seeks `return(` in tokens, calls `parseJSXElement`, appends `__evalDynTexts` if `ctx._jsDynTexts` non-empty, runs preflight, calls `emitOutput`.

### attrs.js -- Style/Color/Handler Parsing
- `parseColor(hex)` -- Parse color value -> `Color.rgb(R, G, B)` or `Color.rgba(...)`. Handles: #hex (3/6/8 digit), named colors, theme-* tokens (Catppuccin Mocha).
- `parseStyleValue(c)` -- Parse a single style value. Returns {type, value, zigExpr?}. Types: 'string', 'number', 'state' (getter), 'map_field' (item.field), 'map_index', 'unknown'.
- `parseTernaryBranch(c, key)` -- Parse one branch of a ternary in a style value. Handles nested ternaries recursively.
- `parseStyleBlock(c)` -- Parse `style={{ key: value, ... }}`. Returns array of `.zig_field = value` strings. Handles: numeric/string/enum/color values, ternary conditionals, modulo expressions, state-driven dynamic styles, map field access, percentage values.
- `findSlot(name)` -- Find state slot index by getter or setter name. Checks slotRemap first (component instances).
- `isGetter(name)` -- Is this name a state getter?
- `isSetter(name)` -- Is this name a state setter?
- `_condPropValue(pv)` -- Resolve prop value for conditional expressions. Strings -> truthy constant, handlers -> 1.
- `slotGet(name)` -- Emit Zig getter: `state.getSlot(N)`, `state.getSlotString(N)`, `state.getSlotFloat(N)`, `state.getSlotBool(N)`.
- `slotSet(slotIdx)` -- Emit Zig setter function name: `state.setSlot`, `state.setSlotFloat`, `state.setSlotBool`.
- `parseHandler(c)` -- Parse handler expression `() => { body }` -> Zig body string. Handles: single-expression setters, multi-statement blocks, setter calls with arithmetic, script function calls via callGlobal, multi-arg string handler dispatch via evalExpr.
- `parseValueExpr(c)` -- Parse a value expression within a handler (arithmetic, ternary, function calls). Returns Zig expression string.
- `luaParseHandler(c)` -- Same as parseHandler but emits Lua syntax. Used to build luaBody for handlers.
- `luaParseValueExpr(c)` -- Same as parseValueExpr but for Lua.

### parse_map.js -- Maps, Templates, Conditionals
- `inferOaFromSource(c, name)` -- Fallback OA inference. If collectState missed an array, re-scan source to find and register it.
- `tryParseMap(c, oa)` -- Parse `array.map((item, i) => (<JSX>))`. Reserves map slot, redirects arrays to mapArrayDecls, parses template in map context. Returns {nodeExpr: '.{}', mapIdx}.
- `tryParseNestedMap(c, nestedOa, fieldName)` -- Parse nested map `group.items.map(...)`. Uses _j iterator, marks isNested=true.
- `leftFoldExpr(expr)` -- Fold `A+B+C` -> `(((A + B) + C) + D)` for Zig multi-string concatenation.
- `utf8ByteLen(str)` -- Calculate UTF-8 byte length for buffer sizing.
- `parseTemplateLiteral(raw)` -- Parse `` `text ${expr} more` `` -> {fmtString, fmtArgs, bufSize}. Resolves: state getters (int/float/bool all use {d}, string uses {s}), arithmetic expressions (+ - * / with @divTrunc, @mod), map item.field ({s}/{d}), map index ({d}), render locals, prop values, ternary expressions (chained via recursive parseTernaryExpr). Note: floats in templates use {d} same as ints — {d:.2} is only used in direct state getter display in parseChildren.
- `tryParseConditional(c, children)` -- Parse `{condition && <Element>}`. Creates show_hide conditional with display:none toggling.
- `tryParseTernaryJSX(c, children)` -- Parse `{condition ? <A> : <B>}`. Creates ternary_jsx conditional with dual display toggling.
- `tryParseTernaryText(c, children)` -- Parse `{condition ? "textA" : "textB"}`. Creates dynText with ternary format.
- `skipBraces(c)` -- Skip balanced brace pairs.
- `offsetToLine(source, offset)` -- Convert byte offset to line number for source comments.

### parse.js -- JSX Parser
- `resolveTag(name)` -- Map HTML tag to primitive via htmlTags lookup (div->Box, p->Text, button->Pressable).
- `parseJSXElement(c)` -- **THE MAIN PARSER.** Handles:
  - Fragments `<>...</>`
  - `<script>` skip (already collected)
  - `C.Name` classifier resolution
  - `Graph.Path`, `Canvas.Node`, `3D.Mesh`, `Scene3D.Camera` dot-name tags
  - Component inlining (save cursor, jump to bodyPos, parse with propStack, restore)
  - Per-component-instance state slot allocation (unique getter/setter names)
  - Component children (`{children}` prop)
  - HTML attribute parsing: style, onPress/onTap/onToggle/onSelect/onChange, fontSize, color, textEffect, name (Effect), onRender (Effect), src (Cartridge/Image), placeholder (TextInput), multiline
  - Special element setup: ScrollView (overflow:scroll), Canvas (graph_container), Terminal (terminal_id), TextInput (input_id), Scene3D tags
  - Calls buildNode() to create the Zig Node struct expression
- `parseChildren(c)` -- Parse children between `<Tag>` and `</Tag>`. Handles:
  - Nested JSX elements (recursive parseJSXElement)
  - `{expression}` blocks: map calls, conditionals, ternary JSX, ternary text, template literals, state getter text
  - Static text nodes
  - `{children}` prop substitution
  - `<Glyph>` inline parsing
- `parseInlineGlyph(c)` -- Parse `<Glyph d="..." fill="#color" />` -> glyph node field.
- `buildNode(tag, styleFields, children, handlerRef, nodeFields, srcTag, srcOffset)` -- Assemble a Node struct literal. Returns {nodeExpr, dynBufId?, inMap?}. Key behaviors:
  - Creates `_arr_N` array for children, increments arrayCounter
  - Source breadcrumb comments (`// tsz:file:line -- <Tag>`)
  - **Text node optimization**: if tag is 'Text' and any child has dynBufId, hoists dynamic text to parent .text="" and drops all siblings
  - **Static text hoisting**: single static text child hoisted to parent .text field (no children array needed)
  - **Inline glyph assembly**: Text with mixed text + `<Glyph>` children builds combined text with \x01 sentinels + inline_glyphs array
  - **Map placeholder layout**: transfers parent layout fields (gap, flex_direction, etc.) to map placeholder children
  - Handler wiring: lua_on_press (no script) vs js_on_press (with script) vs on_press (direct Zig fn)
  - Binds dynTexts, maps, conditionals, dynColors to their parent array name + index

### preflight.js -- Validation
- `preflight(ctx)` -- Run all checks. Returns {ok, errors[], warnings[], lane, intents}.
  - **Lane detection**: chad (classifiers only) -> mixed (has dynamic content) -> soup (has script block)
  - **Fatal (F1-F10)**:
    - F1: Empty handler body (demoted to warning)
    - F2: .on_press references nonexistent handler
    - F3: Map handler missing Lua dispatch body
    - F4: Orphan Color{} with no dynStyle/dynColor backing
    - F5: OA field accessed but missing from schema
    - F6: Unresolved template literal ${expr}
    - F7: Duplicate handler names
    - F8: Map over nonexistent OA
    - F9: Script function called but not defined
    - F10: JS syntax leaked into luaBody (const/let/===/ etc)
    - F11: C.Name used but no classifier definition found (ctx._unresolvedClassifiers)
    - F17: Array decl references unresolved `item.field` (may be leaked JS handler body)
  - **Warnings (W1-W4)**:
    - W1: Color{} backed by dynStyle (informational)
    - W2: Map handlers with all empty luaBody
    - W3: State slot declared but getter never read
  - `--strict` promotes all warnings to errors
- `preflightErrorZig(result, file)` -- Generate .zig with @compileError for failed preflight.

### emit_split.js -- Effects, Split Output, Logic Blocks
- `transpileEffectBody(jsBody, param)` -- Transpile JS effect onRender body to Zig. Handles: for loops, const decls, e.setPixel/clear/fade calls, Math builtins (@sin, @cos, @sqrt, std.math.pow, @mod).
- `transpileExpr(expr, p)` -- Transpile single JS expression to Zig within effect context. e.time->ctx_e.time, e.width->@floatFromInt(ctx_e.width), etc.
- `splitArgs(s)` -- Split comma-separated function arguments respecting nested parens.
- `splitOutput(monolith, file)` -- Split monolithic .zig into 6 per-concern files:
  - `nodes.zig` -- Node tree arrays
  - `handlers.zig` -- Event handler functions + effect render functions
  - `state.zig` -- State manifest, dynText buffers, OA infrastructure, _initState
  - `maps.zig` -- Map pool declarations + _rebuildMap functions
  - `logic.zig` -- JS_LOGIC + LUA_LOGIC string constants
  - `app.zig` -- _updateDynamicTexts, _updateConditionals, _appInit, _appTick, exports, main
  Adds `pub` to declarations, creates cross-file @import references, framework symlink.
- `emitLogicBlocks(ctx)` -- Generate JS_LOGIC and LUA_LOGIC string constants.
  - JS_LOGIC: OA vars/setters, state var declarations + setter functions, script block content, __mapPress_N_M handler functions for map dispatch.
  - LUA_LOGIC: State var mirrors + setter functions (Lua syntax), OA vars/setters (Lua syntax), __mapPress_N_M functions with field refs as params, luaTransform applied.
- `luaTransform(code)` -- JS->Lua syntax conversion. Operators (!=->~=, ||->or, &&->and), control flow (if/else/while/for->Lua equivalents, }->end), builtins (Math->math, console.log->print, JSON->__jsonEncode/__jsonDecode), string/array methods (.push->table.insert, .length->#, etc), template literals (backtick->..concat), null->nil.
- `jsTransform(code)` -- Reverse Lua->JS fixes for luaBody content that leaked Lua operators (and->&&, or->||, ~=->!=).

### emit.js -- Zig Code Emitter
- `emitOutput(rootExpr, file)` -- **THE BIG FUNCTION (~1588 lines).** Generates complete compilable .zig. Contains one nested function: `resolveInlineCond(expr)` (resolves item.field/index refs for inline map conditionals, swaps _i/_j for inner/outer). Sections in order:
  1. **Header** -- integrity comment, lane comment
  2. **Imports** -- std, layout, Node, Style, Color, state, engine, qjs_runtime. Two paths: fastBuild (api.zig) vs normal (build_options + IS_LIB conditionals)
  3. **State manifest** -- slot comments + comptime assert
  4. **Pre-scan** -- identify arrays promoted to per-item in map pools (_promotedToPerItem set)
  5. **Node tree** -- emit ctx.arrayDecls as `var _arr_N = [_]Node{ ... }` (skip promoted ones)
  6. **Dynamic text buffers** -- `var _dyn_buf_N: [SIZE]u8 = undefined` + `var _dyn_text_N: []const u8 = ""`
  7. **Event handlers** -- `fn _handler_press_N() void { body }` (map handlers: empty stub)
  8. **Effect render functions** -- transpiled JS->Zig via transpileEffectBody
  9. **Object array infrastructure** -- per OA: const arrays (static data), dynamic arrays (SoA storage + ensureCapacity with realloc + QJS unpack function with JS_GetPropertyStr)
  10. **Map pools** -- Two passes: (1) declarations (pool arrays, per-item arrays, inner arrays, handler ptr arrays, text buffer arrays), (2) _rebuildMap functions. Handles: flat/nested/inline pools, per-item text wiring, per-item conditional display, handler string ptr building (Lua format with field refs), dynText in maps.
  10b. **Orphan array recovery** -- Post-map scan for `&_arr_N` references without matching `var _arr_N` declarations. Recovers from mapArrayDecls or stubs as `[_]Node{ .{} }`. Two-pass (first by name lookup, then full output regex). See "Orphan Array Safety Net" in Key Patterns.
  11. **Logic blocks** -- JS_LOGIC + LUA_LOGIC via emitLogicBlocks()
  12. **_initState** -- Initialize state slots with defaults
  13. **_updateDynamicTexts** -- std.fmt.bufPrint into _dyn_buf_N, assign to node .text fields. Also handles dynStyles and dynColors runtime updates.
  14. **_updateConditionals** -- display:flex/none toggling based on state conditions
  15. **_appInit** -- Call _initState, register OA unpack host functions, update texts/conds, init map lua ptrs, rebuild maps
  16. **_appTick** -- On state dirty: update texts, update conds, rebuild maps, clear dirty. DynStyles: update every tick unconditionally.
  17. **Exports** -- app_get_root, app_get_init, app_get_tick, app_get_title, app_get_js_logic, app_get_lua_logic, app_state_count, app_state_* (per-type get/set)
  18. **Main** -- engine.run({...}) for standalone, main_cart() for fast/channel build
  19. **Post-pass** -- Replace `= undefined` with `= std.mem.zeroes(TYPE)` (.bss optimization)
  20. **Split** -- If __splitOutput, call splitOutput()

### soup_smith.js -- Soup Lane (Separate Compiler)
Completely independent path for web React "soup" sources. Own tokenizer, tree builder, emitter.
- `isSoupSource(source, file)` -- Detect soup: filename `s##a_*` or `import React` + HTML tags.
- `soupParseState(source, warns)` -- Regex-based useState extraction.
- `soupCollectHandlers(source, warns)` -- Regex-based `const name = (...) => {` handler collection.
- `soupBlock(src, pos)` -- Extract balanced-brace block content.
- `soupExtractReturn(source)` -- Find `return (...)` JSX block.
- `soupTokenize(jsx)` -- Simple tokenizer: open/close/selfclose tags, {expr} blocks, text.
- `soupBalanced(src, start)` -- Balanced brace extraction.
- `soupParseTag(jsx, start)` -- Parse `<tag attr="val" ...>` or `<tag ... />`.
- `soupBuildTree(tokens)` -- Stack-based tree builder from soup tokens.
- `soupExtractInlineHandlers(node, warns)` -- Extract `() => ...` from onclick attrs.
- `soupToZig(node, warns, inPressable)` -- Recursive tree->Zig node emission. HTML tags->primitives, styles->Zig Style struct, dark theme defaults.
- `soupWireDynTextsInArray(arrName, childResults)` -- Wire dynamic text references within an array.
- `soupHandleMap(expr, warns, inPressable)` -- Parse `arr.map(item => ...)` in soup context.
- `soupFindTopLevelAnd(expr)` / `soupFindTopLevelChar(expr, target)` -- Find operators at depth 0 in expressions.
- `soupExprToZig(expr, warns, inPressable)` -- Convert JSX expression to Zig (ternary, &&, text, etc).
- `soupParseStyle(expr, warns)` -- Parse inline style object from soup JSX.
- `soupHexRgb(hex)` -- Parse hex color -> `Color.rgb(...)`.
- `compileSoup(source, file)` -- Soup entry point. Full pipeline: parse state, extract JSX, tokenize, build tree, emit Zig.

---

## Key Patterns

### Dual Handler Emit
Every handler is parsed twice: once for Zig body (`parseHandler`), once for Lua body (`luaParseHandler`). The Zig body goes into the handler function stub. The Lua body goes into LUA_LOGIC string constant. Map handlers are empty Zig stubs -- dispatch happens through Lua/JS string pointers at runtime.

### Component Inlining
Components are not compiled separately. When `<MyComponent prop="val">` is encountered, the parser saves its position, jumps to the component's bodyPos, sets propStack with prop values, allocates fresh state slots (suffixed with slot index to avoid collisions), parses the component's JSX, then restores position. The result is as if the component body was copy-pasted inline.

### SoA Object Arrays
Object arrays use Structure-of-Arrays layout. `useState([{name: 'a', age: 1}])` becomes separate `_oa0_name: [][]const u8`, `_oa0_age: []i64` arrays. QJS bridge unpacks JSON arrays field-by-field into these flat arrays. This is cache-friendly for map iteration.

### Map Pool Architecture
Maps pre-allocate fixed-size Node pools (`_map_pool_N`). `_rebuildMap` copies the template node for each item, substituting text/color/handler per item. Inner arrays (children of the template root) get separate `_map_inner_N` pools. Handler dispatch uses string pointers to Lua function names built per-item.

### parseChildren Dispatch Order (parse.js:717)
When `{expression}` is encountered inside JSX children, resolution is tried in this order:
1. `tryParseConditional` -- `{expr && <JSX>}`
2. `tryParseTernaryJSX` -- `{expr ? <A> : <B>}`
3. `tryParseTernaryText` -- `{expr == val ? "str" : "str"}`
4. Map detection -- `{arr.map((item, i) => (...))}`
5. Nested map -- `{item.subarray.map(...)}`
6. Template literal -- `` {`text ${expr}`} ``
7. Map item field -- `{item.field}` inside .map()
8. `{children}` splice -- component children substitution
9. Render local -- `{varName}` where varName is a render-local
10. Prop value -- `{propName}` from component propStack
11. State getter -- `{count}` with optional ternary chaining (`{count == 0 ? "A" : "B"}`)
12. Skip unknown -- consume balanced braces silently

First match wins. Order matters because e.g. a state getter named `items` followed by `.map(` must be caught by step 4 (map detection) before step 11 (state getter).

### Handler Dispatch: lua_on_press vs js_on_press
When a `<script>` block exists, handlers use `js_on_press` (dispatched through QuickJS). Without `<script>`, handlers use `lua_on_press` (dispatched through LuaJIT). This selection happens in emit.js map pool emission and affects the generated Node struct field name. The choice is made per-cart, not per-handler.

### Orphan Array Safety Net (emit.js:1308-1358)
After all map emission, emit.js scans the generated output for `&_arr_N` references that have no corresponding `var _arr_N` declaration. This happens when component inlining creates arrays in map context that don't get emitted by any map's per-item path. Missing arrays are recovered from mapArrayDecls or stubbed as `[_]Node{ .{} }` so the build doesn't fail.

### Promoted Arrays
During map emission, arrays that reference `_i` (the map iterator) get "promoted" from the static tree to per-item pools. The pre-scan in emitOutput identifies these transitively -- if array A references promoted array B, A is also promoted. This prevents stale references when map items are rebuilt.

### JSX-Valued Props (Named Slots)
When a prop is passed as JSX (`header={<Component/>}`), the JSX is parsed at call-site and stored in `propStack` as `{__jsxSlot: true, result: parsedNode}`. When the component body renders `{header}`, `parseChildren` detects `propVal.__jsxSlot` and splices the pre-parsed node directly into children. This allows passing JSX fragments as named slots to components without additional compiler lanes.

### Four Compilation Lanes
1. **App mode** (default): .tsz -> .zig with full UI scaffolding
2. **Page mode** (`<page route=name>` in source): declarative `<var>/<state>/<functions>/<timer>` blocks + JSX return. Delegates JSX parsing to existing machinery. Entry: `compilePage()`.
3. **Mod mode** (--mod): .mod.tsz -> .zig/.lua/.js (imperative code, no JSX)
4. **Soup mode** (auto-detected): web React -> .zig via QJS script lane

---

## Known Gaps (not implemented in Smith)

1. **No `<zscript>` support** -- JS->Zig state accessor rewriting. Reference compiler does this. 6 conformance carts (d26b-d31b) depend on it.
2. **No `<lscript>` support** -- JS->Lua state accessor rewriting. Reference compiler does this.
3. **No JS stdlib method mapping** -- .push(), .filter(), .reduce(), .splice() not transpiled.
4. **No expression precedence parser** -- Expressions are token-concatenated, rely on Zig parser.
5. **No `<` comparisons in script blocks** -- Parser treats `x < Name` as JSX tag open.
6. **Object arrays are i64-only** for numeric fields (no f32/f64 support).
7. **Map pool sizes hardcoded** -- MAX_MAP = 256/64/16. No dynamic growth.

---

## CLI Flags (set by Forge as globalThis.__*)

| Flag | Global | Effect |
|------|--------|--------|
| `--fast` | `__fastBuild=1` | Use cached engine .so (api.zig imports) |
| `--mod` | `__modBuild=1` | Module mode (no JSX) |
| `--target=X` | `__modTarget="X"` | Mod target: zig/lua/js |
| `--split` | `__splitOutput=1` | Force split output (now default) |
| `--single` | (no __splitOutput) | Force monolithic output |
| `--strict` | `__strict=1` | Warnings become errors |
| `--logs` | `__SMITH_LOGS=1` | Enable all structured logging |
| `--logs=find:X` | `__SMITH_LOGS_FIND="X"` | Filter logs by keyword |

## Globals Set by Forge

| Global | Source |
|--------|--------|
| `__source` | Merged .tsz source text |
| `__tokens` | "kind start end\n..." flat token data |
| `__file` | Input file path |
| `__scriptContent` | Concatenated imported .script.tsz content |
| `__clsContent` | Concatenated imported .cls.tsz content |
