// ── Collection pipeline ──────────────────────────────────────────

function collectCompilerInputs(c) {
  globalThis.__cursor = c; // save for emit-time token access
  collectScript(c);
  collectLScript(c);
  collectFfiDecls(c);
  // Canonical dispatch flag — handlers always go through LuaJIT
  ctx.handlerDispatch = 'lua';
  collectComponents(c);
  collectState(c);
  collectConstArrays(c);
  collectModuleScope(c);
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
