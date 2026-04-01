function isModuleLaneBuild() {
  return globalThis.__modBuild === 1;
}

function compileModuleLane(source, file) {
  var target = globalThis.__modTarget || 'zig';
  if (target === 'lua') return compileModLua(source, file);
  if (target === 'js') return compileModJS(source, file);
  return stampIntegrity(compileMod(source, file));
}
