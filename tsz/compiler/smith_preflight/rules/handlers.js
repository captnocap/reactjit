// ── Preflight handler rules ──────────────────────────────────────

function checkEmptyHandlers(ctx, warnings) {
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var h = ctx.handlers[hi];
    var bodyEmpty = !h.body || h.body.trim() === '' || h.body.trim() === '// undefined';
    var luaEmpty = !h.luaBody || h.luaBody.trim() === '';
    if (bodyEmpty && luaEmpty) {
      warnings.push('F1: handler ' + h.name + ' has empty body and empty luaBody');
    }
  }
}

function checkMapHandlerDispatch(ctx, warnings) {
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var h = ctx.handlers[hi];
    if (!h.inMap) continue;
    var luaEmpty = !h.luaBody || h.luaBody.trim() === '' || h.luaBody.trim() === '-- noop';
    if (luaEmpty) {
      h.luaBody = '-- noop';
      if (!h.body || h.body.trim() === '' || h.body.trim() === '// undefined') h.body = '    // noop\n';
      warnings.push('F3: map handler ' + h.name + ' (map ' + h.mapIdx + ') has no lua dispatch — noop stub assigned');
    }
  }
}

function checkDuplicateHandlerNames(ctx, errors) {
  var handlerNames = {};
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var name = ctx.handlers[hi].name;
    if (handlerNames[name]) errors.push('F7: duplicate handler name ' + name);
    handlerNames[name] = true;
  }
}

function checkScriptHandlerCalls(ctx, scan, errors) {
  if (!scan.intents.has_script_block) return;
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var h = ctx.handlers[hi];
    if (!h.body) continue;
    var callMatch = h.body.match(/callGlobal\("(\w+)"\)/g);
    if (!callMatch) continue;
    for (var ci = 0; ci < callMatch.length; ci++) {
      var funcMatch = callMatch[ci].match(/callGlobal\("(\w+)"\)/);
      if (funcMatch) {
        var fname = funcMatch[1];
        if (ctx.scriptFuncs.indexOf(fname) < 0) {
          errors.push('F9: handler ' + h.name + ' calls script function "' + fname + '" but it is not defined in <script> or imports');
        }
      }
    }
  }
}

function checkLuaSyntaxLeaks(ctx, scan, errors) {
  if (scan.intents.has_script_block) return;
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    var h = ctx.handlers[hi];
    if (!h.luaBody) continue;
    var lb = h.luaBody;
    if (lb.indexOf('const ') >= 0 || lb.indexOf('let ') >= 0 || lb.indexOf('var ') >= 0 ||
        lb.indexOf('===') >= 0 || lb.indexOf('!==') >= 0 || lb.indexOf('&&') >= 0 || lb.indexOf('||') >= 0) {
      errors.push('F10: handler ' + h.name + ' has JS syntax in luaBody: "' + lb.substring(0, 80) + '"');
    }
  }
}

function checkHandlerReferences(scan, errors) {
  for (var di = 0; di < scan.allDecls.length; di++) {
    var onPressMatch = scan.allDecls[di].match(/\.on_press = (\w+)/g);
    if (!onPressMatch) continue;
    for (var pi = 0; pi < onPressMatch.length; pi++) {
      var ref = onPressMatch[pi].replace('.on_press = ', '');
      if (ref !== 'null' && !scan.handlerNameSet[ref]) {
        errors.push('F2: .on_press references handler "' + ref + '" but no such handler exists');
      }
    }
  }
}

function warnOnUnusedMapLuaPtrs(ctx, warnings) {
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var emptyMapHandlers = 0;
    var totalMapHandlers = 0;
    for (var hi = 0; hi < ctx.handlers.length; hi++) {
      if (ctx.handlers[hi].inMap && ctx.handlers[hi].mapIdx === mi) {
        totalMapHandlers++;
        if (!ctx.handlers[hi].luaBody || ctx.handlers[hi].luaBody.trim() === '') emptyMapHandlers++;
      }
    }
    if (totalMapHandlers > 0 && emptyMapHandlers === totalMapHandlers) {
      warnings.push('W2: map ' + mi + ' has ' + totalMapHandlers + ' handler(s) but all have empty luaBody — lua_ptrs will be unused');
    }
  }
}
