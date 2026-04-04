// ── Soup State Extraction ───────────────────────────────────────────────────
// Migrated from soup.js — useState parser, object field parser,
// handler collector, return JSX extractor.

function soupParseState(source, warns) {
  var re = /const\s+\[(\w+)\s*,\s*(\w+)\]\s*=\s*(?:React\.)?useState\(([\s\S]*?)\)\s*;/g;
  var m;
  while ((m = re.exec(source)) !== null) {
    var g = m[1], setter = m[2], raw = m[3].trim();
    // NOTE: emitOutput expects 'int' not 'number' for integer state
    var type = 'int', init = '0';
    if (raw === 'true' || raw === 'false') {
      type = 'boolean'; init = raw;
    } else if (/^['"`]/.test(raw)) {
      type = 'string'; init = raw.replace(/^['"`]|['"`]$/g, '');
    } else if (/^-?\d+$/.test(raw)) {
      type = 'int'; init = raw;
    } else if (/^-?\d+\.\d+$/.test(raw)) {
      type = 'float'; init = raw;
    } else if (raw === 'null' || raw === 'undefined') {
      type = 'string'; init = '';
    } else if (raw.charAt(0) === '[') {
      type = 'int'; init = '0';
      // Store raw array init — will be emitted in scriptBlock (not slot.initial,
      // because multiline array literals break the Zig string prefix alignment)
      if (!ctx._soupArrayInits) ctx._soupArrayInits = [];
      ctx._soupArrayInits.push({ getter: g, setter: setter, rawInit: raw, slotIdx: ctx.stateSlots.length });
    } else if (raw.charAt(0) === '{') {
      type = 'int'; init = '0';
      // Parse object fields and create synthetic slots for property access
      var fields = _soupParseObjectFields(raw);
      if (!ctx._soupObjectInits) ctx._soupObjectInits = [];
      if (!ctx._soupObjFieldSlots) ctx._soupObjFieldSlots = {};
      var parentSlotIdx = ctx.stateSlots.length;
      ctx._soupObjectInits.push({ getter: g, setter: setter, rawInit: raw, slotIdx: parentSlotIdx, fields: fields });
      // After pushing the parent slot, create field slots
      // (deferred to after the parent push below)
      ctx._soupObjFieldsPending = { getter: g, fields: fields };
    } else {
      warns.push('[W] unrecognized useState init for "' + g + '" → int 0');
      type = 'int'; init = '0';
    }
    ctx.stateSlots.push({ getter: g, setter: setter, initial: init, type: type });
    // Create field slots for object state (after parent slot is pushed)
    if (ctx._soupObjFieldsPending) {
      var pending = ctx._soupObjFieldsPending;
      for (var fi = 0; fi < pending.fields.length; fi++) {
        var field = pending.fields[fi];
        var fieldSlotIdx = ctx.stateSlots.length;
        ctx._soupObjFieldSlots[pending.getter + '.' + field.name] = fieldSlotIdx;
        ctx.stateSlots.push({ getter: pending.getter + '_' + field.name, setter: null, initial: field.value, type: field.type });
      }
      ctx._soupObjFieldsPending = null;
    }
  }
}

function _soupParseObjectFields(raw) {
  var fields = [];
  var re = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|([\d.]+)|(true|false))/g;
  var m;
  while ((m = re.exec(raw)) !== null) {
    var name = m[1], value, type;
    if (m[2] !== undefined) { value = m[2]; type = 'string'; }
    else if (m[3] !== undefined) { value = m[3]; type = 'string'; }
    else if (m[4] !== undefined) { value = m[4]; type = m[4].indexOf('.') >= 0 ? 'float' : 'int'; }
    else if (m[5] !== undefined) { value = m[5]; type = 'boolean'; }
    else continue;
    fields.push({ name: name, value: value, type: type });
  }
  return fields;
}

function soupCollectHandlers(source, warns) {
  var handlers = [];
  var re = /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g;
  var m;
  while ((m = re.exec(source)) !== null) {
    var name = m[1];
    if (name.charAt(0) >= 'A' && name.charAt(0) <= 'Z') continue;
    var openBrace = m.index + m[0].length - 1;
    var body = soupBlock(source, openBrace);
    handlers.push({ name: name, params: m[2].trim(), jsBody: body.trim() });
  }
  return handlers;
}

function soupExtractReturn(source) {
  var idx = source.lastIndexOf('return (');
  if (idx >= 0) {
    var start = idx + 8, depth = 1, i = start;
    while (i < source.length && depth > 0) {
      if (source.charAt(i) === '(') depth++;
      else if (source.charAt(i) === ')') depth--;
      if (depth > 0) i++; else break;
    }
    return source.slice(start, i).trim();
  }
  var idx2 = source.search(/return\s+</);
  if (idx2 >= 0) return source.slice(source.indexOf('<', idx2)).trim();
  return null;
}
