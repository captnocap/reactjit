(function() {
// ── Pattern 073: Direct component call ───────────────────────────
// Index: 73
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   <MyComp />
//   <UserCard user={user} />
//   <Button onClick={handleClick}>Submit</Button>
//
// Mixed syntax (hybrid):
//   <MyComp />
//   <UserCard user={user} />
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Component is inlined — its template is expanded at call site:
//   var _arr_0 = [_]Node{
//     .{ .text = user.name },  // from UserCard's render
//     .{ .style = .{ .padding = 8 } },
//   };
//
//   // Or if not inlined, as a cartridge reference:
//   .{
//     .tag = .Cartridge,
//     .props = .{ .src = "UserCard.so", .user = state.getSlot(0) },
//   }
//
// Notes:
//   Direct component reference where the tag name is an identifier
//   starting with uppercase (PascalCase). Components are resolved
//   through the component registry in ctx.components.
//
//   Resolution order:
//     1. Local component definitions (function MyComp() {})
//     2. Imported components (import { MyComp } from './MyComp')
//     3. Built-in components (Box, Text, Pressable, etc.)
//
//   For inlinable components, the compiler expands the component's
//   JSX template inline, substituting props. For dynamic components,
//   a Cartridge node is emitted.
//
//   Implemented in parse.js → parseJSXElement() → findComponent()
//   and emit.js → inlineComponentCall() for the inlining path.

function match(c, ctx) {
  // Component tag: <Name ... where Name starts with uppercase
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  var next = c.tokenAt(c.pos + 1);
  if (next.kind !== TK.identifier) return false;
  // First character must be uppercase A-Z
  var firstChar = next.text[0];
  return firstChar >= 'A' && firstChar <= 'Z';
}

function compile(c, ctx) {
  // Delegates to parseJSXElement() which:
  // 1. Detects uppercase tag name
  // 2. Calls findComponent() to resolve the component
  // 3. Either inlines via inlineComponentCall() or emits Cartridge
  // 4. Handles prop passing and children insertion
  return null;
}

_patterns[73] = {
  id: 73,
  name: 'direct_component',
  status: 'complete',
  match,
  compile,
};

})();
