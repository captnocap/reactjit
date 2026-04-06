// ── Collection pipeline ──────────────────────────────────────────

function collectCompilerInputs(c) {
  globalThis.__cursor = c; // save for emit-time token access
  collectScript(c);
  collectLScript(c);
  // Canonical dispatch flag — set once, read everywhere
  // <script> or .script.tsz import → 'js', <lscript> → 'lua', neither → 'zig'
  if (ctx.scriptBlock || globalThis.__scriptContent) {
    ctx.handlerDispatch = 'js';
  } else if (ctx.luaBlock) {
    ctx.handlerDispatch = 'lua';
  } else {
    ctx.handlerDispatch = 'zig';
  }
  collectComponents(c);
  collectState(c);
  collectConstArrays(c);
  collectClassifiers();
  collectVariantNames();
}

function collectVariantNames() {
  for (var clsKey in ctx.classifiers) {
    var def = ctx.classifiers[clsKey];
    if (def.variants) {
      for (var vn of Object.keys(def.variants)) {
        if (ctx.variantNames.indexOf(vn) === -1) ctx.variantNames.push(vn);
      }
    }
  }
}
