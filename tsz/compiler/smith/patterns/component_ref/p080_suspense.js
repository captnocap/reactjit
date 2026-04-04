// ── Pattern 080: Suspense boundary ───────────────────────────────
// Index: 80
// Group: component_ref
// Status: stub
//
// Soup syntax (copy-paste React):
//   <Suspense fallback={<Loading />}>
//     <LazyComponent />
//   </Suspense>
//
// Mixed syntax (hybrid):
//   <Suspense fallback={<Spinner />}>
//     <Cartridge src="lazy.so" />
//   </Suspense>
//
// Zig output target:
//   // Suspense becomes a boundary node with fallback
//   .{
//     .tag = .Suspense,
//     .props = .{
//       .fallback = &[_]Node{ .{ .tag = .Loading } },
//     },
//     .sub_nodes = &[_]Node{
//       .{ .tag = .Cartridge, .props = .{ .src = "lazy.so" } },
//     },
//   }
//
// Notes:
//   Suspense provides a loading boundary for async content.
//   When child content (lazy components, async data) is loading,
//   the fallback UI is shown. Once loaded, children replace it.
//   In native compilation, this coordinates with the Cartridge
//   loading system and async operation callbacks.
//   Related: p079_lazy_component for lazy-loaded children.

function match(c, ctx) {
  // Look for <Suspense> element
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  var next = c.tokenAt(c.pos + 1);
  if (next.kind !== TK.identifier) return false;
  return next.text === 'Suspense' || next.text === 'React';
}

function compile(c, ctx) {
  // TODO: Parse Suspense element
  // 1. Extract fallback prop (required)
  // 2. Parse children (typically lazy components)
  // 3. Emit Suspense boundary node
  // 4. Wire up fallback display during loading
  return null;
}

module.exports = {
  id: 80,
  name: 'suspense',
  status: 'stub',
  match,
  compile,
};
