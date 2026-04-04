(function() {
// ── Pattern 084: Object lookup rendering ────────────────────────
// Index: 84
// Group: conditional_rendering
// Status: complete
//
// Soup syntax (copy-paste React):
//   const views = {
//     home: <HomePage />,
//     profile: <ProfilePage />,
//     settings: <SettingsPage />,
//   };
//   return views[currentView] || <NotFound />;
//
// Mixed syntax (hybrid):
//   <if currentView exact "home">
//     <HomePage />
//   </if>
//   <else if currentView exact "profile">
//     <ProfilePage />
//   </else>
//   <else if currentView exact "settings">
//     <SettingsPage />
//   </else>
//   <else>
//     <NotFound />
//   </else>
//
// Zig output target:
//   // Conditional 0: std.mem.eql(u8, state.getSlotString(N), "home")
//   // nodes[0] = HomePage    (condIdx: 0)
//   // Conditional 1: !(prev) and std.mem.eql(u8, ..., "profile")
//   // nodes[1] = ProfilePage (condIdx: 1)
//   // ... etc
//
// Notes:
//   Object lookup rendering in React uses a JS object as a dispatch
//   table mapping keys to JSX elements. This is syntactic sugar for
//   a switch/if-else chain. In our compiler, it compiles identically
//   to chained <if>/<else if>/<else> blocks with string equality
//   conditions.
//
//   The mixed/chad representation is more explicit and compiles directly.
//   Each key becomes an `exact` string comparison against the state slot.
//   The fallback (|| <NotFound />) becomes the final <else> block.
//
//   For page routing specifically, the compiler also supports the
//   <varName page /> dynamic page selector (parse/children/elements.js)
//   which renders the current state value as a page reference.

function match(c, ctx) {
  // Object lookup compiles as chained <if>/<else if>/<else>.
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  return c.textAt(c.pos + 1) === 'if';
}

function compile(c, ctx) {
  var children = [];
  parseIfBlock(c, children);
  return { children: children };
}

_patterns[84] = { id: 84, match: match, compile: compile };

})();
