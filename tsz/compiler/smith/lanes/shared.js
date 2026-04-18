function detectSurfaceTier(source, file) {
  if (!source) return 'mixed';
  if (typeof isSoupSource === 'function' && isSoupSource(source, file)) return 'soup';

  var intentScan = null;
  if (typeof scanIntentInputPatterns === 'function') {
    intentScan = scanIntentInputPatterns(source);
    ctx._inputPatterns = intentScan;
  }
  var strongIntentIds = {
    c001: 1, c002: 1, c005: 1, c006: 1, c007: 1, c008: 1, c009: 1,
    c013: 1, c014: 1, c015: 1, c016: 1, c017: 1, c018: 1,
    c020: 1, c023: 1, c024: 1, c025: 1, c026: 1, c027: 1, c028: 1, c029: 1,
  };
  var hasIntentBlocks = false;
  if (intentScan && intentScan.matchedIds) {
    for (var ii = 0; ii < intentScan.matchedIds.length; ii++) {
      if (strongIntentIds[intentScan.matchedIds[ii]]) {
        hasIntentBlocks = true;
        break;
      }
    }
  }
  const hasClassifierTags = /<C\.[A-Za-z]/.test(source);
  const hasClassifierImport = /(?:^|\n)\s*from\s+['"][^'"]*(?:manifest|_cls|\.cls(?:\.tsz)?|\.tcls(?:\.tsz)?|\.vcls(?:\.tsz)?|\.effects(?:\.tsz)?|\.glyphs(?:\.tsz)?)[^'"]*['"]/.test(source);
  if (hasIntentBlocks || hasClassifierTags || hasClassifierImport) return 'chad';

  const hasPrimitiveTags = /<(Box|Text|Image|Video|Render|Pressable|ScrollView|TextInput|TextArea|Glyph|Cartridge|ascript|Canvas|Graph|Physics|Scene3d|Scene3D|ThreeD|Effect|Terminal|Audio)\b/.test(source);
  const hasInlineStyles = source.indexOf('style={{') !== -1;
  const hasStateHooks = /\b(?:React\.)?useState\s*\(/.test(source);
  const hasAppShell = /\bfunction\s+App\s*\(/.test(source);
  if (hasPrimitiveTags || hasInlineStyles || hasStateHooks || hasAppShell) return 'mixed';

  return 'mixed';
}

function assignSurfaceTier(source, file) {
  const tier = detectSurfaceTier(source, file);
  ctx._sourceTier = tier;
  return tier;
}

// ── Build route plan ──
// Called by lane compilers AFTER collect, BEFORE parse.
// Scans source + partially-populated ctx to build the immutable route plan.
// If ambiguity is found, returns an error string (compileError Zig).
// Otherwise stores plan on ctx._routePlan and returns null (continue).
function buildRoutePlan(source) {
  if (typeof routeScan !== 'function') return null;
  var plan = routeScan(ctx, source);
  ctx._routePlan = plan;
  if (plan.ambiguous.length > 0) {
    var msg = 'ROUTE STOP: ' + plan.ambiguous.length + ' ambiguous construct(s):\n';
    for (var i = 0; i < plan.ambiguous.length; i++) {
      msg += '  ' + plan.ambiguous[i] + '\n';
    }
    print('[route-scan] ' + msg);
    return '// Smith error: route scan found ambiguous constructs\n' +
           'comptime { @compileError("Route scan: ' + plan.ambiguous.length + ' ambiguous construct(s)"); }\n';
  }
  if (globalThis.__SMITH_DEBUG) {
    print('[route-plan] ' + plan.summary);
  }
  return null;
}

function buildSourceContractSnapshot(nodeExpr, file, extra) {
  extra = extra || {};
  var inputPatterns = ctx._inputPatterns;
  if (!inputPatterns && typeof scanIntentInputPatterns === 'function') {
    inputPatterns = scanIntentInputPatterns(ctx._source || '');
    ctx._inputPatterns = inputPatterns;
  }
  var snapshot = {
    version: 'source-contract-v1',
    file: file,
    sourceTier: ctx._sourceTier || null,
    inputPatterns: inputPatterns || null,
    routePlan: ctx._routePlan || null,
    preflight: ctx._preflight || null,
    rootExpr: nodeExpr || null,
    luaRootNode: ctx._luaRootNode || null,
    luaMapRebuilders: ctx._luaMapRebuilders || [],
    stateSlots: ctx.stateSlots || [],
    objectArrays: ctx.objectArrays || [],
    handlers: ctx.handlers || [],
    conditionals: ctx.conditionals || [],
    dynTexts: ctx.dynTexts || [],
    dynColors: ctx.dynColors || [],
    dynStyles: ctx.dynStyles || [],
    maps: ctx.maps || [],
    components: ctx.components || [],
    classifiers: ctx.classifiers || {},
    scriptBlock: ctx.scriptBlock || null,
    luaBlock: ctx.luaBlock || null,
    functionEntries: ctx.functionEntries || [],
    functionBackends: ctx.functionBackends || null,
    nativeFunctions: ctx.nativePlan ? (ctx.nativePlan.contractFunctions || []) : [],
    nativeErrors: ctx.nativePlan ? (ctx.nativePlan.errors || []) : [],
    renderLocals: ctx.renderLocals || {},
    debug: {
      droppedExpressions: ctx._droppedExpressions || [],
      unknownSubsystemTags: ctx._unknownSubsystemTags || [],
      undefinedJSCalls: ctx._undefinedJSCalls || [],
      duplicateJSVars: ctx._duplicateJSVars || [],
    },
  };
  var extraKeys = Object.keys(extra);
  for (var i = 0; i < extraKeys.length; i++) snapshot[extraKeys[i]] = extra[extraKeys[i]];
  // Strip emit artifacts from maps — _topArrayDecls/_topArrayComments are
  // the entire Zig node pool duplicated per map (100s of KB each).
  // Also strip mapArrayDecls/mapArrayComments (same pattern, per-map scope).
  return JSON.stringify(snapshot, function(key, val) {
    if (key === '_topArrayDecls' || key === '_topArrayComments' ||
        key === 'mapArrayDecls' || key === 'mapArrayComments') return undefined;
    return val;
  }, 2);
}

function finishParsedLane(nodeExpr, file, opts) {
  opts = opts || {};

  smithTraceSetPhase('preflight');
  var pf = validate(ctx);
  if (opts.logPreflight) {
    LOG_EMIT('L092', { lane: pf.lane, summary: Object.keys(pf.intents).filter(function(k) { return pf.intents[k]; }).join(',') });
    for (var wi = 0; wi < pf.warnings.length; wi++) LOG_EMIT('L091', { id: 'WARN', msg: pf.warnings[wi] });
    for (var ei = 0; ei < pf.errors.length; ei++) LOG_EMIT('L090', { id: 'FATAL', msg: pf.errors[ei] });
  }
  if (opts.debugPreflight && globalThis.__SMITH_DEBUG) {
    for (var i = 0; i < pf.warnings.length; i++) print('[preflight] WARN: ' + pf.warnings[i]);
    for (var j = 0; j < pf.errors.length; j++) print('[preflight] FATAL: ' + pf.errors[j]);
    print('[preflight] lane=' + pf.lane + ' ok=' + pf.ok);
  }
  if (!pf.ok) {
    return stampIntegrity(validateErrorZig(pf, file));
  }

  ctx._preflight = pf;

  if (globalThis.__SOURCE_CONTRACT_MODE === 1) {
    return buildSourceContractSnapshot(nodeExpr, file);
  }

  // Emit glyph resolution report
  if (ctx._glyphLog && ctx._glyphLog.length > 0) {
    var hasResolved = false;
    for (var gi = 0; gi < ctx._glyphLog.length; gi++) {
      print(ctx._glyphLog[gi]);
      if (ctx._glyphLog[gi].indexOf('resolved') >= 0) hasResolved = true;
    }
    if (hasResolved) {
      var glyphNames = Object.keys(ctx._glyphRegistry || {});
      print("hint: to use as literal text, add 'l' prop: <C.Body l>");
      if (glyphNames.length > 0) {
        print('hint: registered glyphs: ' + glyphNames.join(', '));
      }
    }
  }

  smithTraceSetPhase('emit');
  var zigOut = emitOutput(nodeExpr, file);
  smithTraceFinalizeEmit(nodeExpr, zigOut);

  // ── Routing check — verify output matches route plan ──
  if (ctx._routePlan && typeof routingCheck === 'function') {
    var fc = routingCheck(ctx, zigOut);
    if (!fc.ok) {
      for (var fci = 0; fci < fc.mismatches.length; fci++) {
        print('[routing-check] ' + fc.mismatches[fci]);
      }
    }
    if (ctx._routePlan && globalThis.__SMITH_DEBUG) {
      print('[route-plan] ' + ctx._routePlan.summary);
      print('[route-plan] atoms: ' + ctx._routePlan.predictedAtoms.join(','));
      if (fc.mismatches.length > 0) {
        print('[routing-check] MISMATCHES: ' + fc.mismatches.length);
      } else {
        print('[routing-check] OK — output matches plan');
      }
    }
  }

  if (opts.logEmit) {
    LOG_EMIT('L003', { bytes: zigOut.length });
    LOG_EMIT('L004', { file: file });
  }
  if (typeof zigOut === 'string' && zigOut.indexOf('__SPLIT_OUTPUT__') === 0) {
    return zigOut;
  }
  return stampIntegrity(zigOut);
}
