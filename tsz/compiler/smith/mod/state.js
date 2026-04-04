// Mod state/const blocks — extracted from mod.js

function emitStateBlock(content, typeNames) {
  let out = '';
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    // name: Type[N] = default  OR  name: Type = default  OR  name: Type
    const m = line.match(/^(\w+):\s*([^=]+?)(?:\s*=\s*(.+))?$/);
    if (!m) continue;
    const vname = m[1];
    _modStateVars.push(vname);
    const rawType = m[2].trim();
    const vdefault = m[3] ? m[3].trim() : null;
    const zigType = modTranspileType(rawType);

    out += 'var ' + vname + ': ' + zigType;
    // Array types get zero-init
    const arrM = rawType.match(/^(\w+)\[([A-Za-z_]\w*|\d+)\]$/);
    if (arrM) {
      if (typeNames.indexOf(arrM[1]) !== -1) {
        out += ' = [_]' + modTranspileType(arrM[1]) + '{.{}} ** ' + arrM[2];
      } else {
        out += ' = undefined';
      }
    } else if (zigType.startsWith('?')) {
      out += ' = null';
    } else if (vdefault !== null) {
      out += ' = ' + modTranspileDefault(vdefault, zigType, typeNames);
    } else if (rawType.endsWith('[]')) {
      out += ' = &.{}';
    } else if (_modImportedNames.indexOf(rawType) !== -1) {
      out += ' = .{}';
    } else {
      out += ' = .{}';
    }
    out += ';\n';
  }
  return out;
}

function emitConstBlock(content, typeNames) {
  let out = '';
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    const m = line.match(/^(\w+):\s*([^=]+?)\s*=\s*(.+)$/);
    if (!m) continue;
    out += 'const ' + m[1] + ': ' + modTranspileType(m[2].trim()) + ' = ' + modTranspileDefault(m[3].trim(), modTranspileType(m[2].trim()), typeNames) + ';\n';
  }
  return out;
}
