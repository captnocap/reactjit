# Investigation Report 2: RenderLocals Resolution Bugs in sweatshop

## Summary

Three related bugs in renderLocals resolution for inlined components with map item field access and boolean expressions:

1. **`msg.role` double-slicing**: OA string field slices are being applied twice
2. **`!hasInput` bool comparison**: Boolean expressions are incorrectly compared to `0` instead of using `!`
3. **Operator spacing**: Comparison operators in renderLocal expressions lack proper spacing

## Bug 1: `msg.role` Double-Slicing

### Location
`tsz/compiler/smith/refactor/parse/brace/ternary.js` - `_resolveStringComparison()` function

### Problem
When a renderLocal like `isUser = msg.role == 'user'` is used as a ternary condition (`isUser ? 'You' : 'AI'`), the `_resolveStringComparison` function applies slice transformation even though the slice is already present from the renderLocals collector.

### Generated Error
```zig
// WRONG - double slicing:
if (std.mem.eql(u8, st._oa5_role[_i][0..st._oa5_role_lens[_i]][0..st._oa5_role[_i][0..st._oa5_role_lens[_i]]], "user"))

// Should be:
if (std.mem.eql(u8, st._oa5_role[_i][0..st._oa5_role_lens[_i]], "user"))
```

### Root Cause
1. `component_inline.js` renderLocals collector resolves `msg.role` to `_oa5_role[_i][0.._oa5_role_lens[_i]]` for string fields
2. The condition expression becomes: `_oa5_role[_i][0..st._oa5_role_lens[_i]] == "user"`
3. `_resolveStringComparison()` in `ternary.js` matches the `==` pattern and transforms it
4. The regex at line 10: `/_oa\d+_\w+\[_i\]$/` matches BEFORE the slice, so it adds ANOTHER slice

### Fix Required
In `ternary.js`, modify `_resolveStringComparison` to check if the LHS already contains `[0..` before adding the slice:

```javascript
// Line 10: Check if already sliced
if (!lhs.includes('[0..') && /_oa\d+_\w+\[_i\]/.test(lhs)) {
  // Add slice only if not already present
}
```

## Bug 2: `!hasInput` Boolean Comparison

### Location
`tsz/compiler/smith/refactor/parse/brace/conditional.js` - `tryParseConditional()` function

### Problem
When negating a renderLocal that contains a boolean expression (`hasInput = currentInput.length > 0`), the code wraps it as `(bool_expr == 0)` which fails in Zig because `bool != int`.

### Generated Error
```zig
// WRONG - comparing bool to int:
nodes._arr_59[2].style.display = if ((((state.getSlotString(1).len > 0) == 0))) .flex else .none;

// Should be:
nodes._arr_59[2].style.display = if ((!(state.getSlotString(1).len > 0))) .flex else .none;
```

### Current Partial Fix
The previous worker added detection for boolean expressions:
```javascript
const isBoolExpr = / > | < | >= | <= | == | != /.test(rlVal) || rlVal.includes('.len');
if (isBoolExpr) {
  condParts.push('(!(' + rlVal + '))');
} else {
  condParts.push('((' + rlVal + ') == 0)');
}
```

### Issue with Current Fix
The fix is in `conditional.js` but the same logic may be needed elsewhere (ternary handling, other negation sites).

### Verification
Current output shows the fix IS working for conditionals:
```zig
nodes._arr_59[2].style.display = if ((((state.getSlotString(1).len > 0) == 0))) .flex else .none;
```
Actually, this shows the fix is NOT working - it's still producing `== 0`. The regex may not be matching because there's no space around `>` in `state.getSlotString(1).len > 0`.

**Root cause**: The regex `/ > /` requires spaces, but the renderLocal value has `> 0` with space only on one side.

### Fix Required
Update the `isBoolExpr` check in `conditional.js` to handle cases without surrounding spaces:
```javascript
// Line 20: More flexible regex
const isBoolExpr = /\s*[<>!=]=?\s*/.test(rlVal) || rlVal.includes('.len');
```

## Bug 3: RenderLocals Comparison Operator Spacing

### Location
`tsz/compiler/smith/refactor/parse/element/component_inline.js` - renderLocals collector

### Problem
When collecting renderLocals like `hasInput = currentInput.length > 0`, the operator `>` is not getting proper spacing, producing `state.getSlotString(1).len > 0` (note single space before `0`).

### Current Code (Lines 131-133)
```javascript
} else if (c.kind() === TK.star || c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.slash || c.kind() === TK.percent ||
           c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq) {
  valParts.push(' ' + c.text() + ' ');
```

This appears correct - adding spaces around comparison operators.

### Verification Needed
Check if the spacing is actually missing in the output. Looking at `_updateConditionals`:
```zig
if ((state.getSlotString(1).len > 0))  // Has space around >
```

Actually the spacing appears correct in the output. The issue may be elsewhere.

## Relationship Between Bugs

The three bugs form a chain:

1. `component_inline.js` renderLocals collector resolves `msg.role` → `_oa5_role[_i][0.._oa5_role_lens[_i]]`
2. The ternary parser in `ternary.js` then applies `_resolveStringComparison` which adds ANOTHER slice
3. For `hasInput`, the renderLocals collector produces `state.getSlotString(1).len > 0`
4. The negation in `conditional.js` uses `== 0` instead of `!` because the regex doesn't match

## Proposed Solution Priority

### Priority 1: Fix Double-Slicing (Bug 1)
**File**: `tsz/compiler/smith/refactor/parse/brace/ternary.js`

```javascript
// Around line 10 in _resolveStringComparison
function _resolveStringComparison(condExpr) {
  var m = condExpr.match(/^(.+?)\s*==\s*['"]([^'"]+)['"]$/);
  if (m) {
    var lhs = m[1].trim();
    var rhs = m[2];
    // Only add slice if not already present
    if (!lhs.includes('[0..') && /_oa\d+_\w+\[_i\]$/.test(lhs)) {
      var lenField = lhs.replace(/\[_i\]$/, '_lens[_i]');
      lhs = lhs + '[0..' + lenField + ']';
    }
    return 'std.mem.eql(u8, ' + lhs + ', "' + rhs + '")';
  }
  // Similar fix for != case...
}
```

### Priority 2: Fix Boolean Negation (Bug 2)
**File**: `tsz/compiler/smith/refactor/parse/brace/conditional.js`

```javascript
// Line 20: Update regex to match operators without surrounding spaces
const isBoolExpr = /[<>!=]=?/.test(rlVal) || rlVal.includes('.len');
```

### Priority 3: Verify Operator Spacing (Bug 3)
The spacing appears correct in output. Verify the actual issue before making changes.

## Test Cases

### Test 1: Double-Slicing
Source:
```tsx
function Message(props) {
  var msg = props.msg;
  var isUser = msg.role == 'user';
  return <Text>{isUser ? 'You' : 'AI'}</Text>;
}
```

Expected output:
```zig
if (std.mem.eql(u8, st._oa5_role[_i][0..st._oa5_role_lens[_i]], "user"))
```

### Test 2: Boolean Negation
Source:
```tsx
function ChatInput() {
  var hasInput = currentInput.length > 0;
  return (
    <Box>
      {hasInput && <ActiveBtn />}
      {!hasInput && <DisabledBtn />}
    </Box>
  );
}
```

Expected output:
```zig
// For !hasInput:
if ((!(state.getSlotString(1).len > 0)))  // Using ! not == 0
```

## Verification Steps

1. Build sweatshop with proposed fixes
2. Check `generated_sweatshop.app/maps.zig` for correct slicing
3. Check `generated_sweatshop.app/app.zig` `_updateConditionals` for correct boolean negation
4. Run conformance tests to ensure no regressions

## Files Modified

1. `tsz/compiler/smith/refactor/parse/brace/ternary.js` - Fix double-slicing
2. `tsz/compiler/smith/refactor/parse/brace/conditional.js` - Fix boolean negation regex
