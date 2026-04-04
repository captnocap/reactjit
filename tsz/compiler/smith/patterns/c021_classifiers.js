// ── Chad Pattern c021: Classifiers (C.Name) ────────────────────
// Group: visual
// Status: stub
//
// Chad syntax:
//   // Usage in JSX:
//   <C.Card> ... </C.Card>
//   <C.Title>text</C.Title>
//   <C.Btn decrement><C.BtnLabel>-</C.BtnLabel></C.Btn>
//
//   // Definition in .cls.tsz:
//   <C.Row is Box>
//     flexDirection exact row
//     gap is theme-spaceMd
//     alignItems is center
//   </C.Row>
//
//   <C.Btn is Pressable>
//     backgroundColor is theme-primary
//     borderRadius is theme-radiusSm
//     padding is theme-spaceMd
//   </C.Btn>
//
// Soup equivalent:
//   <Box style={{ flexDirection: 'row', gap: 8 }}>
//   <Pressable onPress={decrement} style={{ backgroundColor: '#...' }}>
//
// Zig output target:
//   Node struct with style fields resolved from classifier definitions.
//   Pressable classifiers wire handler dispatch.
//
// Current owner: lanes/chad.js (collectClassifiers), parse/element/
//
// Notes:
//   C.Name pattern. Base type declared with `is Primitive`.
//   `is` = themeable/overridable. `exact` = locked/structural.
//   Bare word on Pressable = event handler (function/animation/physics).
//   No style= prop in chad. Classifiers handle all visual structure.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
