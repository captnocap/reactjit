// ── Pattern 129: Non-null assertion ─────────────────────────────
// Index: 129
// Group: type_narrowing
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{user!.name}</Text>
//   <Image source={{uri: item!.imageUrl!}} />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Non-null assertion (!) is a TypeScript-only operator.
//   // It is erased during TS→JS transpilation — it has no runtime effect.
//   // The compiled output is identical to regular field access:
//   .{ .text = _oa0_name[_i][0.._oa0_name_lens[_i]] }
//
// Notes:
//   The non-null assertion operator (!) is a TypeScript compile-time hint
//   that tells the TS type checker "trust me, this isn't null/undefined."
//   It has ZERO runtime behavior — TypeScript erases it during compilation.
//
//   Since .tsz files are processed by Smith's lexer (not the TypeScript
//   compiler), the ! token is lexed as TK.bang (logical NOT). If it
//   appears after an identifier (user!.name), the lexer sees:
//   identifier + bang + dot + identifier
//
//   This would likely cause a parse error or incorrect parsing, since
//   Smith interprets ! as logical NOT, not as non-null assertion.
//
//   In practice, .tsz code should NOT use non-null assertions because:
//   1. Smith is not TypeScript — no type system, no type erasure
//   2. The ! is semantically different in Smith's context (it's NOT)
//   3. Optional chaining (?.) or explicit null checks are preferred
//
//   Status is not_applicable because this is a TypeScript-specific feature
//   that doesn't apply to the .tsz compilation model.

function match(c, ctx) {
  // identifier!.field — TypeScript non-null assertion
  if (c.kind() !== TK.identifier) return false;
  if (c.pos + 2 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.bang && c.kindAt(c.pos + 2) === TK.dot;
}

function compile(c, ctx) {
  // Not applicable. TypeScript non-null assertions are erased during
  // TS compilation and have no runtime equivalent. .tsz code should
  // use explicit null checks or optional chaining instead.
  return null;
}
