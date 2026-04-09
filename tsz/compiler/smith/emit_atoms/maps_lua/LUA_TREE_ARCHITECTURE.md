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
- `node_contract.js` — schema for text nodes, map loops, handlers, conditionals
- `emit_contract.js` — interface between parse and emit

**Parse files that BUILD contracts:**
- `tsz/compiler/smith/parse/build_node.js` — builds luaNode for each element
- `tsz/compiler/smith/parse/children/brace_maps.js` — builds map loop contracts
- `tsz/compiler/smith/parse/element/component_inline.js` — builds inlined component contracts

### Phase 3: Emit (Final Assembly)
**Location:** `tsz/compiler/smith/emit_atoms/maps_lua/*`
**Responsibility:** Own final Lua/JS/Zig assembly only
**Input:** Contracts from Phase 2
**Output:** Lua source strings

**Emit Atom Files:**
- `lua_map_subs.js` — `_jsExprToLua()`: ONLY js→lua expression conversion
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
❌ Parse strings to extract field names
❌ Resolve prop references from ctx.propStack
❌ Re-infer map identities from source text
❌ Access `globalThis.__source`
❌ Call token cursor methods (c.kind(), c.advance())

## File Status

### Active (Source of Truth)
| File | Role | Status |
|------|------|--------|
| lua_map_subs.js | Expression conversion | ✅ Active |
| lua_map_node.js | Node emission | ✅ Active |
| lua_map_text.js | Text emission | ✅ Active |
| lua_map_style.js | Style emission | ✅ Active |
| lua_map_handler.js | Handler emission | ✅ Active |

### Deprecated (Being Disconnected)
| File | Replacement | Status |
|------|-------------|--------|
| emit_ops/emit_lua_element.js | lua_map_node.js | 🚫 Deprecated |
| emit_ops/emit_lua_text.js | lua_map_text.js | 🚫 Deprecated |
| emit_ops/emit_lua_style.js | lua_map_style.js | 🚫 Deprecated |
| emit_ops/emit_lua_rebuild.js | a034_lua_logic_block.js | 🚫 Deprecated |

### Disabled (Migrated to Lua-Tree Path)
| File | Status | Migration |
|------|--------|-----------|
| a034_lua_logic_block.js | DISABLED — returns false from applies() | LUA_LOGIC owned by lua_tree_nodes.js::emitLuaTreeLuaSource() |

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
- [x] Establish contract schema in contract/*
- [x] Disconnect a034_lua_logic_block.js (applies() returns false)
- [ ] Disconnect emit_ops/emit_lua_*.js from load order
- [ ] Delete emit_ops/emit_lua_*.js files
- [ ] Document contract schema in AGENTS.md

## Co-Authored-By
Kimi-K2-5 <noreply@moondream.ai>
