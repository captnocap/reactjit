// Mod FFI block — extracted from mod.js

function emitFfiBlock(content) {
  let out = '';
  _modFfiSymbols = {};
  const lines = content.split('\n');
  const imports = {}; // lib → prefix
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    const m = line.match(/^(\w+)\s+@\("([^"]+)"(?:\s*,\s*"([^"]+)")?\)/);
    if (m) {
      const symbol = m[1];
      const lib = m[2];
      const actualFn = m[3] || symbol;
      // Determine prefix from lib
      var prefix;
      if (lib.startsWith('std.')) {
        const parts = lib.split('.');
        prefix = parts[parts.length - 1];
      } else {
        prefix = lib.replace(/[^a-zA-Z0-9]/g, '_');
      }
      if (!imports[lib]) imports[lib] = prefix;
      _modFfiSymbols[symbol] = { prefix: prefix, fn: actualFn };
    }
  }
  for (const lib in imports) {
    if (lib.startsWith('std.')) {
      const parts = lib.split('.');
      out += 'const ' + parts[parts.length - 1] + ' = std.' + parts.slice(1).join('.') + ';\n';
    } else {
      out += 'const ' + imports[lib] + ' = @cImport({ @cInclude("' + lib + '"); });\n';
    }
  }
  return out;
}
