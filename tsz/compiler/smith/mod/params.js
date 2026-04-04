// Mod params — extracted from mod.js

function modTranspileParams(params) {
  return emitModParams(parseModParams(params), null);
}

function parseModParams(params) {
  if (!params.trim()) return [];
  return params.split(',').map(function(p) {
    const m = p.trim().match(/^(\w+):\s*(.+)$/);
    if (!m) return null;
    const rawType = m[2].trim();
    return {
      name: m[1],
      rawType: rawType,
      isPtr: isModPointerParamType(rawType),
    };
  }).filter(Boolean);
}

function emitModParams(paramInfo, fnName) {
  return paramInfo.map(function(p, idx) {
    let zigType = modTranspileType(p.rawType);
    if (p.isPtr) {
      if (fnName) registerModPtrParam(fnName, idx);
      zigType = '*' + zigType;
    }
    return p.name + ': ' + zigType;
  }).join(', ');
}

function isModPointerParamType(rawType) {
  return rawType.trim() === 'Node';
}

function registerModPtrParam(fnName, idx) {
  if (!_modFnPtrParams[fnName]) _modFnPtrParams[fnName] = {};
  _modFnPtrParams[fnName][idx] = true;
}
