// ── Pattern 105: Inline style object ────────────────────────────
// Index: 105
// Group: style
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box style={{color: 'red', padding: 8}} />
//   <Box style={{backgroundColor: '#1e1e2e', borderRadius: 4}} />
//   <Box style={{flexDirection: 'row', gap: 10, flexGrow: 1}} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   nodes._arr_0[0] = .{
//     .style = .{
//       .padding = .{ .top = 8, .right = 8, .bottom = 8, .left = 8 },
//       .background_color = Color.rgb(30, 30, 46),
//       .border_radius = 4,
//       .flex_direction = .row,
//       .gap = 10,
//       .flex_grow = 1,
//     },
//   };
//
// Notes:
//   Implemented in attrs.js → parseStyleBlock().
//
//   The style parser handles three categories of CSS properties via lookup tables
//   defined in rules.js:
//
//   styleKeys (numeric → f32):
//     width, height, minWidth, maxWidth, minHeight, maxHeight,
//     flexGrow, flexShrink, flexBasis, gap, rowGap, columnGap, order,
//     padding, paddingLeft/Right/Top/Bottom,
//     margin, marginLeft/Right/Top/Bottom,
//     borderRadius, borderTopLeftRadius, etc.,
//     opacity, borderWidth, borderLeftWidth, etc.,
//     shadowOffsetX/Y, shadowBlur, top/left/right/bottom,
//     aspectRatio, rotation, scaleX, scaleY
//
//   colorKeys (string → Color):
//     backgroundColor, borderColor, shadowColor, gradientColorEnd
//
//   enumKeys (string → Zig enum):
//     flexDirection, justifyContent, alignItems, alignSelf, flexWrap,
//     position, display, textAlign, overflow, gradientDirection, shadowMethod
//
//   Value types supported in each property:
//     - Number literals: padding: 8 → .padding = 8
//     - String colors: backgroundColor: '#ff0000' → Color.rgb(255, 0, 0)
//     - Theme tokens: backgroundColor: 'theme-bg' → Color.rgb(30, 30, 46)
//     - Named colors: color: 'red' → Color.rgb(255, 0, 0)
//     - Percentage strings: width: '100%' → .width = -1 (sentinel)
//     - Enum strings: flexDirection: 'row' → .flex_direction = .row
//
//   Special handling:
//     - padding/margin shorthand: single value → all four sides
//     - fontSize inside style → hoisted to node field (.font_size)
//     - color inside style → hoisted to node field (.text_color)
//
//   Complete because all CSS property categories are covered with proper
//   type mapping (numeric, color, enum).

function match(c, ctx) {
  // style={{ ... }}
  // Detected by attr name 'style' + double brace opening
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.lbrace;
}

function compile(c, ctx) {
  // Delegates to parseStyleBlock() in attrs.js.
  // Returns array of Zig style field strings.
  return null;
}
