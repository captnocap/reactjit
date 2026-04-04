// ── Chad Pattern c005: <types> block ────────────────────────────
// Group: core
// Status: stub
//
// Chad syntax:
//   // String enums:
//   <types>
//     <mode>
//       time
//       date
//       system
//     </mode>
//   </types>
//
//   // Struct types (modules):
//   <types>
//     <Vec2>
//       x is f32
//       y is f32
//     </Vec2>
//   </types>
//
//   // Tagged unions (modules):
//   <types>
//     <Payload union>
//       int is i64
//       float is f64
//       text is string
//     </Payload>
//   </types>
//
// Soup equivalent:
//   type Mode = 'time' | 'date' | 'system';
//   interface Vec2 { x: number; y: number; }
//
// Zig output target:
//   String enums → variant quoting in JS logic.
//   Structs → Zig struct definitions.
//   Unions → Zig tagged unions.
//
// Current owner: lanes/chad.js (ctx._typeVariants parsing)
//
// Notes:
//   Enum variants are bare words, one per line.
//   The block name connects to the var name it constrains.
//   Scoped type constraints: <r.status> constrains the status field of r.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
