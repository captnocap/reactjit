// Mod imports block — extracted from mod.js

function emitImportsBlock(content) {
  let out = '';
  _modImportedNames = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    const m = line.match(/^(\w+)\s+from\s+"([^"]+)"$/);
    if (!m) continue;
    const name = m[1];
    const path = m[2];
    _modImportedNames.push(name);
    out += 'const ' + name + ' = @import("' + path + '").' + name + ';\n';
  }
  return out;
}
