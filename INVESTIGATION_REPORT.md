# Investigation Report: Component Inlining Content Loss in sweatshop

## Executive Summary

The `sweatshop` cart compiles but produces empty component nodes with no children or text content. Component bodies render as skeleton layout boxes with style fields only. This is caused by component inlining failing for imported components whose names collide with classifier names.

## Issues Identified

### Issue 1: `_hasFlatMaps is not defined` (Straightforward Bug)

**Location:** `tsz/compiler/smith/emit.js`, line ~1096

**Problem:** The previous worker's refactoring extracted the runtime entrypoints into `refactor/emit/entrypoints.js` but removed the `_hasFlatMaps` variable declaration while still referencing it when calling `emitRuntimeEntrypoints()`.

**Evidence:**
```javascript
// In emit.js line 1086-1097:
const hasDynStyles = ctx.dynStyles && ctx.dynStyles.length > 0;
out += emitRuntimeEntrypoints(ctx, {
  ...
  hasFlatMaps: _hasFlatMaps,  // ReferenceError: _hasFlatMaps is not defined
});
```

**Fix:** Add before line 1087:
```javascript
const _hasFlatMaps = ctx.maps.some(m => !m.isNested && !m.isInline);
```

### Issue 2: Component Inlining Content Loss (Root Problem)

**Location:** Component resolution in `parseJSXElement` → `findComponent`

**Problem:** When `sweatshop.app.tsz` is compiled, imported components (TopBar, Sidebar, etc.) are not being inlined. Instead, they fall back to classifier behavior, producing nodes with styles but no children.

**Evidence:**

1. **Generated output has classifier styles but no component children:**
```zig
// Generated _arr_3 from sweatshop - TopBar node has NO children:
pub var _arr_3 = [_]Node{
  .{ .style = .{ .height = 40, ... } },  // TopBar - empty!
  .{ .style = .{ ... }, .children = &_arr_2 },  // Workspace
  .{ .style = .{ .height = 24, ... } }   // StatusBar - empty!
};
```

2. **Dashboard cart (which works) shows component comments:**
```zig
// Generated from Dashboard - StatCard has children AND comment:
pub var _arr_1 = [_]Node{
  .{ .text = "CPU", ... },
  .{ .text = "", ... }
}; // StatCard
```

3. **sweatshop output has NO `// ComponentName` comments**, confirming inlining never happened.

## Root Cause Analysis

### What Works vs What Doesn't

| Test Case | Components In Same File | Imported Components | Name Collides With Classifier | Inlining Works? |
|-----------|------------------------|---------------------|-------------------------------|-----------------|
| d100_named_slots | ✓ | ✗ | ✗ | ✓ YES |
| d08_map_classifier_components | ✓ | ✗ | ✗ | ✓ YES |
| Dashboard | ✗ | ✓ (StatCard, MetricRow) | ✗ | ✓ YES |
| sweatshop | ✗ | ✓ (TopBar, Sidebar, etc.) | ✓ YES | ✗ NO |

### Key Finding

The issue occurs specifically when:
1. Component is imported from a separate `.c.tsz` file
2. Component name collides with a classifier name (e.g., `TopBar` is both a component function AND a classifier key)

### Hypothesis

`findComponent()` returns `null` for imported components that share names with classifiers, causing `parseJSXElement` to fall through to classifier handling instead of component inlining.

**Why this happens:**
- `collectComponents()` scans the merged token stream and SHOULD find all components
- `ctx.components` array SHOULD contain entries for TopBar, Sidebar, etc.
- `findComponent('TopBar')` SHOULD return the component
- But the observed behavior (classifier styles, no children) proves it returns `null`

**Possible causes:**
1. `collectComponents` is not finding components in merged imports (though token scan suggests it should)
2. Components are being collected but then removed/overwritten
3. Name collision causes lookup shadowing somewhere in the resolution chain

## Verification Steps Performed

1. ✅ Token stream analysis: Verified merged source contains all component tokens at correct positions
2. ✅ Component file classification: Verified `.c.tsz` files are classified as `FileClass.component`
3. ✅ Merge order: Verified component files are merged before main app file
4. ✅ Classifier conflict: Verified `TopBar`, `Sidebar`, etc. ARE classifiers in `cursor_cls.tsz`
5. ✅ Working comparison: Verified Dashboard's `StatCard` is NOT a classifier (only `Card` is)

## Proposed Solution Path

### Phase 1: Fix the `_hasFlatMaps` Bug (5 minutes)
```javascript
// In tsz/compiler/smith/emit.js, line ~1086
const hasDynStyles = ctx.dynStyles && ctx.dynStyles.length > 0;
const _hasFlatMaps = ctx.maps.some(m => !m.isNested && !m.isInline);  // ADD THIS
out += emitRuntimeEntrypoints(ctx, {
  ...
});
```

### Phase 2: Debug Component Collection (30 minutes)
Add diagnostic output to verify `ctx.components` contents:

```javascript
// In collectComponents() after collection loop:
if (globalThis.__SMITH_DEBUG) {
  globalThis.__dbg.push('[COMPONENTS] Found: ' + 
    ctx.components.map(c => c.name).join(', '));
}

// In parseJSXElement() before findComponent:
if (globalThis.__SMITH_DEBUG) {
  globalThis.__dbg.push('[PARSE] Looking for component: ' + rawTag + 
    ', found: ' + (findComponent(rawTag) ? 'YES' : 'NO'));
}
```

Run with `--logs` and check if:
- Components ARE found → Issue is in `findComponent` lookup
- Components NOT found → Issue is in `collectComponents` scanning

### Phase 3: Fix Component Resolution (Unknown - depends on Phase 2 findings)

**If components are not being collected:**
- Debug `collectComponents` loop to see why it's skipping imported components
- Check for early exit or token position issues

**If components ARE collected but `findComponent` fails:**
- Check if name collision causes shadowing
- May need to adjust lookup precedence (check components before classifiers)

## Files to Examine

1. `tsz/compiler/smith/refactor/collect/components.js` - Component collection logic
2. `tsz/compiler/smith/parse.js` - `parseJSXElement` and `findComponent`
3. `tsz/compiler/smith/refactor/parse/element/component_inline.js` - Inlining logic
4. `tsz/compiler/smith/refactor/parse/element/tags.js` - `normalizeRawTag` classifier lookup

## Recommendation

1. Apply the `_hasFlatMaps` fix immediately to restore compilation
2. Add debug logging to pinpoint whether components are being collected
3. Based on findings, fix either collection or resolution logic
4. Test with `sweatshop` to verify components have children
5. Run conformance tests to ensure no regressions

## Appendix: Evidence Comparison

### Dashboard (Works)
```tsx
// StatCard.c.tsz
function StatCard({ label, value, color, tooltip }) {
  return (
    <C.Card tooltip={tooltip}>
      <C.Label>{label}</C.Label>
      <Text fontSize={22} color={color}>{value}</Text>
    </C.Card>
  );
}
```
- `StatCard` is NOT a classifier (only `Card` is)
- Generated output shows `// StatCard` comment
- Children are properly inlined

### sweatshop (Broken)
```tsx
// TopBar.c.tsz
function TopBar(props) {
  return (
    <C.TopBar>
      <C.TopBarLeft>
        <C.WindowTitle>{props.title}</C.WindowTitle>
      </C.TopBarLeft>
      ...
    </C.TopBar>
  );
}
```
```tsx
// cursor_cls.tsz
TopBar: { type: 'Box', style: { height: 40, ... } }
```
- `TopBar` IS a classifier
- Generated output has TopBar styles (height: 40) but NO children
- NO `// TopBar` comment in output
