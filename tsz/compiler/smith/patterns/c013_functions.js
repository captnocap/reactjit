// ── Chad Pattern c013: <functions> block ────────────────────────
// Group: functions
// Status: stub
//
// Chad syntax:
//   <functions>
//     reset:
//       set_count is 0
//
//     increment:
//       set_count is count + 1
//
//     move(id, toCol):
//       set_cards is cards.map(id, col: toCol)
//
//     toggleItem requires item:
//       item.done is not item.done
//
//     sdlInit cleanup:
//       sdl.quit
//
//     boot:
//       set_active is home
//   </functions>
//
// Soup equivalent:
//   const reset = () => setCount(0);
//   const increment = () => setCount(c => c + 1);
//   useEffect(() => { setActive('home') }, []);
//
// Zig output target:
//   JS_LOGIC script block with named functions.
//   Handler dispatch entries for event wiring.
//
// Current owner: lanes/chad.js (buildPageJSLogic)
//
// Notes:
//   Nullary (no args), parameterized, `requires` for scope deps.
//   `cleanup:` pairs run in reverse on scope unwind.
//   `boot` / `shutdown` are reserved lifecycle names.
//   Functions see the scope of their call site (<for> gives item).

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
