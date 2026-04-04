// ── Chad Pattern c027: Backend hatches ──────────────────────────
// Group: hatches
// Status: stub
//
// Chad syntax:
//   <functions>
//     // Compiler picks backend:
//     increment:
//       set_count is count + 1
//
//     // Forced to Zig — hot particle loop:
//     <zscript>
//     tick every 16:
//       <for particles as p>
//         p.x is p.x + p.vx * dt_sec
//       </for>
//     </zscript>
//
//     // Forced to Lua — DSP thread:
//     <lscript>
//     processAudio:
//       <for samples as s>
//         s is s * gain
//       </for>
//     </lscript>
//
//     // Forced to JS — needs fetch/JSON:
//     <script>
//     fetchExternal:
//       result is net.get(apiUrl)
//       set_data is result
//     </script>
//   </functions>
//
//   // Also at lib level:
//   <engine lib>
//     <zscript>
//       physics
//       render
//     </zscript>
//     <lscript>
//       audio
//       dsp
//     </lscript>
//   </engine>
//
// Soup equivalent:
//   // No equivalent — single-target compilation
//
// Zig output target:
//   Routes function compilation to JS/Lua/Zig backend.
//   Same intent syntax inside — only compilation target changes.
//
// Current owner: not yet implemented (chad lane always targets JS)
//
// Notes:
//   <script> = QuickJS. <lscript> = LuaJIT. <zscript> = Zig native.
//   Hatches are compilation directives, not namespace levels.
//   Hatched functions compose with + across backends.
//   Same syntax inside — if/for/during/is/exact all work identically.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
