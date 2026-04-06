// Atom 25: Style assignment emission — styleAssignments
// Extracted from emit/runtime_updates.js line 119
// Inner function used by variant patch logic (atom 24)

function styleAssignments(target, styleStr, indent) {
  if (!styleStr) return '';
  return styleStr.split(/,\s*(?=\.)/).map(function(field) {
    field = field.trim();
    if (!field.startsWith('.')) return '';
    var eqIdx = field.indexOf('=');
    if (eqIdx < 0) return '';
    var styleField = field.slice(1, eqIdx).trim();
    var value = field.slice(eqIdx + 1).trim();
    return indent + target + '.style.' + styleField + ' = ' + value + ';\n';
  }).join('');
}
