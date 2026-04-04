(function() {
// ── Pattern 103: Key to force remount ───────────────────────────
// Index: 103
// Group: keys
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Editor key={docId} />
//   <Chat key={conversationId} />
//   <Form key={formVersion} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // N/A — this React pattern has no equivalent in Smith.
//   // The key is dropped like all keys (see p101).
//
// Notes:
//   In React, changing a component's key forces a full unmount/remount,
//   resetting all internal state. This is used as a "reset" mechanism
//   (e.g., changing the document ID on an editor resets its undo history).
//
//   Smith has no unmount/remount lifecycle. Components are compiled to
//   static node trees. State is managed through explicit slots that can
//   be reset by setter calls (e.g., setDocId triggers a handler that
//   resets related state).
//
//   To achieve the "reset on change" pattern in this framework:
//     - Use a state change handler that resets dependent state
//     - Use a script function that clears/reinitializes state slots
//     - For map-based data, the OA system rebuilds when data changes
//
//   Status is "not_applicable" — this is a React-specific lifecycle
//   pattern that doesn't translate to a compile-time model.

function match(c, ctx) {
  // Same token pattern as p101 — key= on any element.
  // Remount vs regular is semantic, not syntactic.
  if (c.kind() !== TK.identifier || c.text() !== 'key') return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.equals;
}

function compile(c, ctx) {
  return null;
}

_patterns[103] = { id: 103, match: match, compile: compile };

})();
