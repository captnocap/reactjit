function findAppStart(c) {
  var exactAppStart = -1;
  var appStart = -1;
  for (var i = 0; i < c.count - 2; i++) {
    // Match: function Name(
    if (c.kindAt(i) === TK.identifier && c.textAt(i) === 'function' &&
        c.kindAt(i + 1) === TK.identifier && c.kindAt(i + 2) === TK.lparen) {
      var name = c.textAt(i + 1);
      if (name === 'App') {
        exactAppStart = i;
        break;
      }
      if (name[0] >= 'A' && name[0] <= 'Z') appStart = i;
    }
    // Match: const Name = (...) => {  OR  const Name = () => {
    if (c.kindAt(i) === TK.identifier && c.textAt(i) === 'const' &&
        c.kindAt(i + 1) === TK.identifier && c.kindAt(i + 2) === TK.equals) {
      var aName = c.textAt(i + 1);
      if (aName[0] >= 'A' && aName[0] <= 'Z') {
        // Scan ahead to check for => before the next { body
        for (var j = i + 3; j < c.count && j < i + 20; j++) {
          if (c.kindAt(j) === TK.arrow) {
            if (aName === 'App') { exactAppStart = i; break; }
            appStart = i;
            break;
          }
          if (c.kindAt(j) === TK.lbrace) break;
        }
        if (exactAppStart >= 0) break;
      }
    }
  }
  return exactAppStart >= 0 ? exactAppStart : appStart;
}

function moveToAppReturn(c, appStart) {
  c.pos = appStart;
  var bodyDepth = 0;
  var inBody = false;
  while (c.pos < c.count) {
    if (!inBody) {
      if (c.kind() === TK.lbrace) {
        inBody = true;
        bodyDepth = 1;
      }
      c.advance();
      continue;
    }

    if (bodyDepth === 1 && c.isIdent('return')) {
      c.advance();
      if (c.kind() === TK.lparen) c.advance();
      break;
    }

    if (c.kind() === TK.lbrace) {
      bodyDepth++;
    } else if (c.kind() === TK.rbrace) {
      bodyDepth--;
      if (bodyDepth <= 0) break;
    }
    c.advance();
  }
}

function flushInlineDebugLogs() {
  if (!globalThis.__SMITH_DEBUG_INLINE || !globalThis.__dbg || globalThis.__dbg.length === 0) {
    return;
  }
  for (var di = 0; di < globalThis.__dbg.length; di++) ctx._debugLines.push(globalThis.__dbg[di]);
}

function compileAppLane(source, tokens, file) {
  var c = mkCursor(tokens, source);

  resetCtx();
  ctx._source = source;
  smithTraceSetCursor(c);
  smithTraceSetPhase('collect');
  if (source.indexOf('// @borderless') !== -1) ctx.borderless = true;
  assignSurfaceTier(source, file);
  collectCompilerInputs(c);

  var appStart = findAppStart(c);
  if (appStart < 0) return '// Smith error: no App function found\n';

  collectRenderLocals(c, appStart);

  // ── Route plan — scan source, build plan, hard stop on ambiguity ──
  var routeErr = buildRoutePlan(source);
  if (routeErr) return routeErr;

  smithTraceSetPhase('parse');
  moveToAppReturn(c, appStart);

  var root = parseJSXElement(c);
  ctx._traceRootNode = root;
  if (root.luaNode) ctx._luaRootNode = root.luaNode;
  smithTraceSetCursor(null);

  flushInlineDebugLogs();

  LOG_EMIT('L002', { count: ctx.components.length, maps: ctx.maps.length });
  return finishParsedLane(root.nodeExpr, file, {
    logPreflight: true,
    debugPreflight: true,
    logEmit: true,
  });
}
