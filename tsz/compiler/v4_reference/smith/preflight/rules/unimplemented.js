// ── Preflight: unimplemented JSX block detection ────────────────
// Catches dictionary constructs that parse as JSX elements but
// don't actually compile to conditional/loop behavior yet.
// Without this, they silently render all children unconditionally.

function checkUnimplementedJSXBlocks(errors) {
  var source = globalThis.__source;
  if (!source) return;

  // Only check inside return() — find the return( boundary
  var retIdx = source.indexOf('return(');
  if (retIdx < 0) retIdx = source.indexOf('return (');
  if (retIdx < 0) return;
  var jsxSource = source.slice(retIdx);

  var blocks = [
    // <if>, <else>, <during>, <For> are now compiled — see parse/children/conditional_blocks.js
    { tag: '<while ',  id: 'F18', desc: '<while> in JSX — loop block not yet compiled' },
  ];

  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    var count = 0;
    var idx = 0;
    while ((idx = jsxSource.indexOf(b.tag, idx)) !== -1) {
      count++;
      idx += b.tag.length;
    }
    if (count > 0) {
      errors.push(b.id + ': ' + count + ' ' + b.desc);
    }
  }
}
