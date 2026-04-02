function detectSurfaceTier(source, file) {
  if (!source) return 'mixed';
  if (typeof isSoupSource === 'function' && isSoupSource(source, file)) return 'soup';

  const hasIntentBlocks = /<(page|widget|var|state|functions|timer)\b/.test(source);
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

function finishParsedLane(nodeExpr, file, opts) {
  opts = opts || {};

  var pf = preflight(ctx);
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
    return stampIntegrity(preflightErrorZig(pf, file));
  }

  ctx._preflight = pf;

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

  var zigOut = emitOutput(nodeExpr, file);
  if (opts.logEmit) {
    LOG_EMIT('L003', { bytes: zigOut.length });
    LOG_EMIT('L004', { file: file });
  }
  if (typeof zigOut === 'string' && zigOut.indexOf('__SPLIT_OUTPUT__') === 0) {
    return zigOut;
  }
  return stampIntegrity(zigOut);
}
