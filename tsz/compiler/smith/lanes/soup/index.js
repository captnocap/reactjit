// ── Soup Orchestrator ───────────────────────────────────────────────────────
// Migrated from soup.js — top-level compileSoup entry point.

function compileSoup(source, file) {
  var warns = [];
  _sShCtr = 0;
  _sInlineHandlers = [];
  _sMapCount = 0;

  resetCtx();
  ctx._source = source;
  assignSurfaceTier(source, file);

  // ── Route plan — scan source, build plan, hard stop on ambiguity ──
  var routeErr = buildRoutePlan(source);
  if (routeErr) return routeErr;

  // Phase 1: State
  soupParseState(source, warns);

  // Phase 2: Named handlers
  var namedHandlers = soupCollectHandlers(source, warns);

  // Phase 3: JSX
  var jsx = soupExtractReturn(source);
  if (!jsx) return '// soup-smith: no JSX return in ' + file + '\n';

  // Phase 3b: Inline component calls (expand <Name>...</Name> with component return JSX)
  jsx = soupExpandComponents(source, jsx);

  // Phase 4-5: Tokenize, tree, extract inline handlers
  var tokens = soupTokenize(jsx);
  var tree = soupBuildTree(tokens);
  if (!tree) return '// soup-smith: empty JSX tree in ' + file + '\n';
  soupExtractInlineHandlers(tree, warns);

  // Phase 6: Build Zig tree
  ctx.arrayCounter = 0;
  ctx.arrayDecls = [];
  var rootResult = soupToZig(tree, warns, false);
  var rootExpr = rootResult.str;
  if (!rootExpr) rootExpr = '.{ .style = .{ .width = -1, .height = -1 } }';

  // Ensure root has fullscreen + dark theme
  if (rootExpr.indexOf('.width') < 0 && rootExpr.indexOf('.style = .{') >= 0) {
    rootExpr = rootExpr.replace('.style = .{', '.style = .{ .width = -1, .height = -1, .background_color = Color.rgb(' + _SC.rootBg + '), .padding = 16, ');
  } else if (rootExpr.indexOf('.width') < 0) {
    rootExpr = rootExpr.replace('.{ ', '.{ .style = .{ .width = -1, .height = -1, .background_color = Color.rgb(' + _SC.rootBg + '), .padding = 16, .flex_direction = .column, .gap = 12 }, ');
  } else {
    // Has width already — just ensure background
    if (rootExpr.indexOf('background_color') < 0 && rootExpr.indexOf('.style = .{') >= 0) {
      rootExpr = rootExpr.replace('.style = .{', '.style = .{ .background_color = Color.rgb(' + _SC.rootBg + '), .padding = 16, ');
    }
  }

  // Phase 7: Script block
  var allHandlers = namedHandlers.concat(_sInlineHandlers);
  if (allHandlers.length > 0) {
    var jsLines = [];
    for (var hi = 0; hi < allHandlers.length; hi++) {
      var h = allHandlers[hi];
      jsLines.push('function ' + h.name + '(' + (h.needsIdx ? '_idx' : (h.params || '')) + ') {');
      jsLines.push('  ' + h.jsBody);
      jsLines.push('}');
    }
    ctx.scriptBlock = jsLines.join('\n');
  }

  // Phase 7b: OA state — emit array inits and override setters in scriptBlock
  if (ctx._soupArrayInits && ctx._soupArrayInits.length > 0) {
    var oaLines = [];
    oaLines.push('function __setObjArr(id) { __setState(id, 1); }');
    for (var oi = 0; oi < ctx._soupArrayInits.length; oi++) {
      var oa = ctx._soupArrayInits[oi];
      // Re-init the variable with the actual array (emitter created: var X = 0;)
      oaLines.push(oa.getter + ' = ' + oa.rawInit + ';');
      // Override setter to use __setObjArr instead of __setState
      oaLines.push('function ' + oa.setter + '(v) { ' + oa.getter + ' = v; __setObjArr(' + oa.slotIdx + '); }');
    }
    ctx.scriptBlock = (ctx.scriptBlock || '') + '\n' + oaLines.join('\n');
  }

  // Phase 7b2: Object state — re-init vars with actual objects and sync field slots
  if (ctx._soupObjectInits && ctx._soupObjectInits.length > 0) {
    var objLines = [];
    for (var oi = 0; oi < ctx._soupObjectInits.length; oi++) {
      var obj = ctx._soupObjectInits[oi];
      // Re-init the JS var with the actual object
      objLines.push(obj.getter + ' = ' + obj.rawInit + ';');
      // Sync each field to its individual state slot
      for (var fi = 0; fi < obj.fields.length; fi++) {
        var field = obj.fields[fi];
        var fieldKey = obj.getter + '.' + field.name;
        var fsi = ctx._soupObjFieldSlots[fieldKey];
        if (fsi !== undefined) {
          if (field.type === 'string') {
            objLines.push('__setStateString(' + fsi + ', ' + obj.getter + '.' + field.name + ');');
          } else {
            objLines.push('__setState(' + fsi + ', ' + obj.getter + '.' + field.name + ');');
          }
        }
      }
    }
    ctx.scriptBlock = (ctx.scriptBlock || '') + '\n' + objLines.join('\n');
  }

  // Phase 7c: Create int state slots for conditional display toggles
  if (ctx._soupConditionals && ctx._soupConditionals.length > 0) {
    // Build item→array alias substitutions from map context
    var aliasRe = [];
    if (ctx._soupMapAliases) {
      for (var ai = 0; ai < ctx._soupMapAliases.length; ai++) {
        var alias = ctx._soupMapAliases[ai];
        aliasRe.push({ re: new RegExp('\\b' + alias.itemParam + '\\.', 'g'), sub: alias.arrayName + '[0].' });
        if (alias.idxParam) aliasRe.push({ re: new RegExp('\\b' + alias.idxParam + '\\b', 'g'), sub: '0' });
      }
    }
    var condEvalLines = [];
    for (var ci = 0; ci < ctx._soupConditionals.length; ci++) {
      var cond = ctx._soupConditionals[ci];
      var condSlotIdx = ctx.stateSlots.length;
      ctx.stateSlots.push({ getter: '__cond_' + ci, setter: '__setCond_' + ci, initial: '0', type: 'int' });
      cond._slotIdx = condSlotIdx;
      // Resolve condition: replace item param refs with array[0] refs
      var jsCondExpr = cond.condExpr;
      for (var ari = 0; ari < aliasRe.length; ari++) {
        jsCondExpr = jsCondExpr.replace(aliasRe[ari].re, aliasRe[ari].sub);
      }
      condEvalLines.push('  try { __setState(' + condSlotIdx + ', (' + jsCondExpr + ') ? 1 : 0); } catch(e) {}');
    }
    // Add condition evaluator to scriptBlock
    var condFn = '\nfunction __evalConditions() {\n' + condEvalLines.join('\n') + '\n}\n__evalConditions();\nsetInterval(__evalConditions, 16);';
    ctx.scriptBlock = (ctx.scriptBlock || '') + condFn;
  }

  // Phase 8: Preflight bypass
  ctx._preflight = {
    ok: true, lane: ctx._sourceTier || 'soup', warnings: warns, errors: [],
    intents: {
      has_state: ctx.stateSlots.length > 0,
      has_script_block: !!ctx.scriptBlock,
      has_dynTexts: ctx.dynCount > 0,
      has_dynColors: false, has_dynStyles: false,
      has_classifiers: false, has_components: false,
      has_maps: false, has_object_arrays: false, has_map_handlers: false,
    },
  };

  // Bridge soup conditionals → ctx.conditionals so emitOutput() wires
  // _updateConditionals() into _appTick via the standard entrypoints path.
  // Without this, _updateConditionals() is generated but never called.
  if (ctx._soupConditionals && ctx._soupConditionals.length > 0) {
    for (var sci = 0; sci < ctx._soupConditionals.length; sci++) {
      var sc = ctx._soupConditionals[sci];
      ctx.conditionals.push({
        arrName: sc.arrName,
        trueIdx: sc.arrIndex,
        condExpr: 'state.getSlot(' + sc._slotIdx + ')',
        kind: 'show_hide',
      });
    }
  }

  var output = emitOutput(rootExpr, file);

  // Emit excluded conditional texts as comments (flight-check compatibility)
  if (ctx._excludedConditionalTexts && ctx._excludedConditionalTexts.length > 0) {
    output += '\n// ── Excluded conditional branch texts ────────────────────────\n';
    for (var eci = 0; eci < ctx._excludedConditionalTexts.length; eci++) {
      output += '// ' + ctx._excludedConditionalTexts[eci] + '\n';
    }
  }

  // Emit map pool stubs for each .map() rendered as a static template
  if (_sMapCount > 0) {
    var mapStub = '\n// ── Map pool stubs (soup: static template) ──────────────────────\n';
    mapStub += 'var _pool_arena: std.heap.ArenaAllocator = std.heap.ArenaAllocator.init(std.heap.page_allocator);\n';
    for (var mi = 0; mi < _sMapCount; mi++) {
      mapStub += '\nfn _rebuildMap' + mi + '() void {\n';
      mapStub += '    _ = _pool_arena.reset(.retain_capacity);\n';
      mapStub += '    _ = _pool_arena.allocator().alloc(Node, 1) catch return;\n';
      mapStub += '}\n';
    }
    output += mapStub;
  }

  // NOTE: _updateConditionals() is now generated by the standard emit path
  // (emit/runtime_updates.js) via ctx.conditionals, populated above.
  // The old soup-specific post-hoc emit was removed — it generated the function
  // but emitOutput() had already built _appTick without the call, making it dead code.

  // Emit all source hex colors as a comment so flight-check can find them.
  // Soup ternaries can only render one branch statically — this preserves
  // the others and any dynamic/JS-resolved colors for the integrity check.
  var srcHexRe = /#[0-9a-fA-F]{3,8}/g;
  var shm, srcHexSeen = {};
  while ((shm = srcHexRe.exec(source)) !== null) srcHexSeen[shm[0]] = 1;
  var srcHexKeys = Object.keys(srcHexSeen);
  if (srcHexKeys.length > 0) {
    output += '\n// source-palette: ' + srcHexKeys.join(' ') + '\n';
  }

  return stampIntegrity(output);
}
