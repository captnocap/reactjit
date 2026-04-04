// Mod types block — extracted from mod.js

function emitTypesBlock(content, typeNames, enumVariants, allVariants) {
  if (!enumVariants) enumVariants = {};
  if (!allVariants) allVariants = [];
  let out = '\n';
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('//')) { i++; continue; }

    // Type declaration: Name: ...
    const declMatch = line.match(/^([A-Z]\w*):\s*(.*)$/);
    if (!declMatch) { i++; continue; }

    const name = declMatch[1];
    const rest = declMatch[2].trim();
    typeNames.push(name);

    // Tagged union: Name: union { ... }
    if (rest.startsWith('union')) {
      const bodyLines = [];
      const hasOpenBrace = rest.includes('{');
      if (hasOpenBrace) {
        const after = rest.replace(/^union\s*\{\s*/, '').trim();
        if (after && after !== '}') bodyLines.push(after);
      }
      i++;
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l === '}' || l === '};') break;
        if (l) bodyLines.push(l);
        i++;
      }
      i++; // skip closing }
      out += emitUnionDecl(name, bodyLines, typeNames);
      continue;
    }

    // Struct: Name: { ... }
    if (rest.startsWith('{')) {
      const bodyLines = [];
      const after = rest.slice(1).trim();
      if (after && after !== '}') bodyLines.push(after);
      i++;
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l === '}' || l === '};') break;
        if (l) bodyLines.push(l);
        i++;
      }
      i++; // skip closing }
      out += emitStructDecl(name, bodyLines, typeNames);
      continue;
    }

    // Enum: Name: val1 | val2 | val3
    if (rest.includes('|')) {
      out += emitEnumDecl(name, rest, allVariants);
      i++;
      continue;
    }

    // Type alias: Name: fn(...) -> Ret  OR  Name: SomeOtherType
    out += emitTypeAliasDecl(name, rest);
    i++;
    continue;

  }

  return out;
}

function emitTypeAliasDecl(name, rest) {
  return 'pub const ' + name + ' = ' + modTranspileType(rest) + ';\n\n';
}

function emitEnumDecl(name, rest, allVariants) {
  const variants = rest.split('|').map(function(v) { return v.trim(); }).filter(Boolean);
  if (allVariants) { for (let v = 0; v < variants.length; v++) allVariants.push(variants[v]); }
  let out = 'pub const ' + name + ' = enum {\n';
  for (let v = 0; v < variants.length; v++) {
    out += '    ' + zigEscape(variants[v]) + ',\n';
  }
  out += '};\n\n';
  return out;
}

function emitStructDecl(name, bodyLines, typeNames) {
  let out = 'pub const ' + name + ' = struct {\n';
  for (let b = 0; b < bodyLines.length; b++) {
    const field = bodyLines[b].replace(/,\s*$/, '').trim();
    const fm = field.match(/^(\w+):\s*([^=]+?)(?:\s*=\s*(.+))?$/);
    if (!fm) continue;
    const fname = fm[1];
    const rawType = fm[2].trim();
    const ftype = modTranspileType(rawType);
    let fdefault = fm[3] ? fm[3].trim() : null;

    if (fdefault !== null) {
      fdefault = modTranspileDefault(fdefault, ftype, typeNames);
    } else {
      // Infer defaults for fields without explicit default
      fdefault = inferDefault(rawType, ftype, typeNames);
    }

    out += '    ' + fname + ': ' + ftype;
    if (fdefault !== null) out += ' = ' + fdefault;
    out += ',\n';
  }
  out += '};\n\n';
  return out;
}

function inferDefault(rawType, zigType, typeNames) {
  // string → ""
  if (rawType === 'string') return '""';
  // Type? → null
  if (rawType.endsWith('?')) return 'null';
  // ?Type → null
  if (rawType.startsWith('?')) return 'null';
  // Type[] → empty slice
  if (rawType.endsWith('[]')) return '&.{}';
  // Type[N] where Type is a known struct → [_]Type{.{}} ** N
  const arrMatch = rawType.match(/^(\w+)\[([A-Za-z_]\w*|\d+)\]$/);
  if (arrMatch) {
    const elemType = arrMatch[1];
    const count = arrMatch[2];
    if (typeNames.indexOf(elemType) !== -1) return '[_]' + modTranspileType(elemType) + '{.{}} ** ' + count;
    // Primitive array like u8[65536] → undefined
    return 'undefined';
  }
  // Known struct type → .{}
  if (typeNames.indexOf(rawType) !== -1) return '.{}';
  if (_modImportedNames.indexOf(rawType) !== -1) return '.{}';
  return null;
}

function emitUnionDecl(name, bodyLines, typeNames) {
  let out = 'pub const ' + name + ' = union(enum) {\n';
  for (let b = 0; b < bodyLines.length; b++) {
    const field = bodyLines[b].replace(/,\s*$/, '').trim();
    const fm = field.match(/^(\w+):\s*(.+)$/);
    if (!fm) continue;
    out += '    ' + zigEscape(fm[1]) + ': ' + modTranspileType(fm[2].trim()) + ',\n';
  }
  out += '};\n\n';
  return out;
}
