// ── Pattern 060: Render prop ────────────────────────────────────
// Index: 60
// Group: props
// Status: partial
//
// Soup syntax (copy-paste React):
//   <DataProvider render={(data) => <Text>{data.name}</Text>} />
//   <Mouse render={({x, y}) => <Cursor x={x} y={y} />} />
//   <Form validate={(values) => values.name ? null : "Required"} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//   (Chad syntax would use slots or conditional blocks instead.)
//
// Zig output target:
//   // Render props require runtime function invocation — the parent
//   // component calls the function with data and renders the result.
//   // In a compile-time model, this would need:
//   //   1. The function body compiled as a template with parameter holes
//   //   2. The parent component's data wired to those holes at emit time
//   // Currently NOT emitted as a general pattern.
//   //
//   // Special case: onRender={(e) => { ... }} on Effect elements
//   // IS handled — see attrs_handlers.js → parseElementRenderAttr().
//   // Emits:
//   //   .effect_render = _effect_render_0,
//   //   .effect_shader = _effect_shader_0,
//
// Notes:
//   NOT IMPLEMENTED as a general pattern.
//
//   Render props are fundamentally a runtime pattern — the parent component
//   decides WHEN and WITH WHAT DATA to call the render function. This
//   conflicts with Smith's compile-time model where all JSX is statically
//   resolved to Zig node trees.
//
//   Special case that IS handled:
//     onRender={(effectCtx) => { ... }}
//     Used on Effect elements to define GPU shader render callbacks.
//     The arrow function body is extracted as source text and compiled
//     into an effect render function. This works because the Effect
//     element has a known contract for when/how to invoke the callback.
//     See parseElementRenderAttr() in attrs_handlers.js.
//
//   For the general render prop pattern, alternatives in this framework:
//     - JSX props (p059): <Parent icon={<Icon />} /> for static slots
//     - Slot pattern (p093): named slots for layout composition
//     - Conditional blocks (chad): <if>/<else> for dynamic rendering
//     - Component inlining: Smith inlines component bodies at call sites,
//       so parent data is already available without render callbacks
//
//   The render prop pattern exists in React because components are opaque
//   functions. In Smith, components are compile-time templates — the data
//   flow is visible and can be resolved statically in most cases.

function match(c, ctx) {
  // attr={ (params) => JSX }
  // Distinguished from callback (p052) by the return value: render props
  // return JSX (indicated by < in the arrow body), callbacks return void/side-effects.
  if (c.kind() !== TK.lbrace) return false;
  var saved = c.save();
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  // Find closing paren
  var la = c.pos, pd = 1; la++;
  while (la < c.count && pd > 0) {
    if (c.kindAt(la) === TK.lparen) pd++;
    if (c.kindAt(la) === TK.rparen) pd--;
    la++;
  }
  if (!(la < c.count && c.kindAt(la) === TK.arrow)) { c.restore(saved); return false; }
  // Check if arrow body contains JSX (starts with < or has ( then <)
  la++; // skip arrow
  if (la < c.count && c.kindAt(la) === TK.lt) { c.restore(saved); return true; }
  if (la < c.count && c.kindAt(la) === TK.lparen) {
    la++;
    if (la < c.count && c.kindAt(la) === TK.lt) { c.restore(saved); return true; }
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // General render props: not implemented (use JSX props/slots instead).
  // onRender={(e) => {...}} on Effect elements: handled by
  // parseElementRenderAttr() in attrs_handlers.js — extracts function body,
  // compiles to effect_render/effect_shader node fields.
  return null;
}
