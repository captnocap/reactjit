# Lua Tree Emit Architecture

## Three-Phase Model

This directory implements the emit phase of a strict three-phase architecture:

### Phase 1: Patterns (Syntax Recognition)
**Location:** `tsz/compiler/smith/patterns/*`
**Responsibility:** Recognize .tsz syntax patterns only
**Output:** Markers and metadata attached to parse context

**Files:**
- `p019_map_element.js` — recognizes `array.map((item) => <JSX>)`
- `p022_map_nested.js` — recognizes nested map patterns
- `p011_ternary_element.js` — recognizes `{cond ? <A/> : <B/>}`
- etc.

### Phase 2: Contract (Semantic Data)
**Location:** `tsz/compiler/smith/contract/*`
**Responsibility:** Own normalized semantic data only
**Input:** Parse results from Phase 1
**Output:** Structured contracts (luaNode objects)

**Key Contract Files:**
- `CONTRACT_SCHEMA.md` — schema documentation
- `tsz/compiler/smith/parse/build_node.js` — builds luaNode for each element
- `tsz/compiler/smith/parse/children/brace_maps.js` — builds map loop contracts

### Phase 3: Emit (Final Assembly)
**Location:** `tsz/compiler/smith/emit_atoms/maps_lua/*`
**Responsibility:** Own final Lua/JS/Zig assembly only
**Input:** Contracts from Phase 2
**Output:** Lua source strings

**Emit Atom Files:**
- `lua_map_subs.js` — `_jsExprToLua()`: JS→Lua expression conversion (SOLO SOURCE)
- `lua_map_node.js` — `_nodeToLua()`: consumes full node contracts
- `lua_map_text.js` — `_textToLua()`: consumes text contracts
- `lua_map_style.js` — `_styleToLua()`: consumes style contracts
- `lua_map_handler.js` — `_handlerToLua()`: consumes handler contracts

## Contract Boundaries

### What Emit Atoms Can Access
✅ `ctx.stateSlots` — state getter/setter metadata
✅ `ctx.objectArrays` — OA field definitions
✅ `ctx._luaRootNode` — the full lua tree contract
✅ `ctx._luaMapRebuilders` — map loop contracts
✅ `ctx.handlers` — handler contracts
✅ Other emit atoms via shared functions (e.g., `_jsExprToLua`)

### What Emit Atoms Must NOT Do
❌ Parse strings to extract field names (DONE - no violations)
❌ Re-infer map identities from source text (DONE - no violations)
❌ Access `globalThis.__source` (DONE - no violations)
❌ Call token cursor methods (c.kind(), c.advance()) - EXCEPT `lua_expr.js` (legacy path)
❌ Access `ctx.propStack` directly - REMAINING WORK in `lua_map_subs.js`

## Known Technical Debt

### `lua_expr.js` — Token Cursor Access
**Status:** LEGACY PATH — This file provides direct token-to-Lua conversion for the non-lua-tree path. It is NOT part of the lua-tree emit architecture.

**Location:** Used by soup lane and legacy emit paths.

**Future:** Will be deprecated when all lanes use lua-tree contracts.

### `lua_map_subs.js` — PropStack Access
**Status:** PARTIAL VIOLATION — This file accesses `ctx.propStack` to resolve prop references during JS→Lua expression translation.

**Why it exists:** Prop resolution during emit is a historical artifact from before strict contract separation.

**Future cleanup:** Move prop resolution to contract phase (build_node.js), emit only pre-resolved prop values.

## File Status

### Active (Source of Truth)
| File | Role | Status |
|------|------|--------|
| lua_map_subs.js | Expression conversion | ✅ Active (with tech debt) |
| lua_map_node.js | Node emission | ✅ Active |
| lua_map_text.js | Text emission | ✅ Active |
| lua_map_style.js | Style emission | ✅ Active |
| lua_map_handler.js | Handler emission | ✅ Active |
| lua_text_*.js | Text category helpers | ✅ Active |

### Deleted (Disconnected from Live Path)
| File | Replacement | Status |
|------|-------------|--------|
| ~~emit_ops/emit_lua_element.js~~ | lua_map_node.js | 🚫 DELETED |
| ~~emit_ops/emit_lua_text.js~~ | lua_map_text.js | 🚫 DELETED |
| ~~emit_ops/emit_lua_style.js~~ | lua_map_style.js | 🚫 DELETED |
| ~~emit_ops/emit_lua_rebuild.js~~ | a034_lua_logic_block.js | 🚫 DELETED |

### Wrapper-Only
| File | Current Role | Future |
|------|--------------|--------|
| a034_lua_logic_block.js | LUA_LOGIC wrapper + delegator | ✅ Properly reduced |

## Usage Pattern

### Parse Phase (build_node.js)
```javascript
// Build the semantic contract
const luaNode = {
  tag: 'Text',
  text: { type: 'field', field: 'title' },  // Text contract
  style: { font_size: '16' },                // Style contract
  handler: 'toggle(item.id)',                // Handler contract
  children: []
};

return { nodeExpr: zigExpr, luaNode: luaNode };
```

### Emit Phase (lua_map_node.js)
```javascript
// Consume the contract — NO REPARSING
function _nodeToLua(node, itemParam, indexParam, indent) {
  // Use _textToLua for text contracts
  const textLua = node.text ? _textToLua(node.text, itemParam, indexParam) : null;
  
  // Use _styleToLua for style contracts
  const styleLua = node.style ? _styleToLua(node.style, itemParam, indexParam) : null;
  
  // Use _handlerToLua for handler contracts
  const handlerLua = node.handler ? _handlerToLua(node.handler, itemParam, indexParam) : null;
  
  // Assemble final Lua table
  return '{ ' + [textLua, styleLua, handlerLua].filter(Boolean).join(', ') + ' }';
}
```

## Migration Checklist

- [x] Create lua_map_*.js with proper contract consumption
- [x] Establish contract schema in contract/
- [x] Disconnect emit_ops/emit_lua_*.js from load order
- [x] Delete emit_ops/emit_lua_*.js files
- [x] Reduce a034_lua_logic_block.js to wrapper
- [ ] Remove propStack access from lua_map_subs.js (future work)
- [ ] Deprecate lua_expr.js token cursor usage (future work)

## Regression Lockdown

See: `tsz/carts/conformance/REGRESSION_LOCKDOWN.md`

Key test coverage:
- d41, d55: Component props, nested objects
- d04, d10, d20: Map handlers
- d01, d09, d21, d55: Nested OA fields
- d48, d67: Template text in maps
- d03, d17, d25, d61: Conditionals in maps

---

**Architecture Verification Date:** 2026-04-09  
**Co-Authored-By:** Kimi-K2.5 <noreply@moondream.ai>
