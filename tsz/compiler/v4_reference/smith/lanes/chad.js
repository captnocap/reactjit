// ── Chad lane compiler ──────────────────────────────────────────────
// Handles <name widget|page|app|component> block syntax.
//
// This is the chad on-ramp to the highway. Strict dictionary syntax:
// if it doesn't match exact form, it should have fallen through to
// mixed or soup in the dispatcher. Hard stop — no fuzzy matching.
//
// Chad blocks:
//   <counter widget>    → widget (standalone UI)
//   <home page>         → page (routable view)
//   <myapp app>         → app (entry point)
//   <button component>  → component (reusable, takes props)
//   <utils lib>         → lib (no UI, composes modules) [future]
//
// Block syntax inside:
//   <var>       → state slots + ambient reads
//   <state>     → setter name declarations
//   <functions> → JS_LOGIC script block
//   <timer>     → setInterval
//   return(...) → JSX tree (classifier components, dictionary props)
//
// Merges onto the highway at finishParsedLane().

// ── Chad block detection ──

function detectChadBlock(source) {
  // Find the LAST matching block — forge prepends imports, main source is last.
  // We want the main entry block (app/page/widget/component), not an imported lib.
  var re = /<(\w+)\s+(widget|page|app|component|lib|effect|glyph)\s*>/g;
  var match;
  var last = null;
  while ((match = re.exec(source)) !== null) {
    last = match;
  }
  if (!last) return null;
  return {
    name: last[1],
    type: last[2],
    tag: last[0],
    closeTag: '</' + last[1] + '>',
  };
}

// ── Chad source preflight ──
// Validates the source is actually chad BEFORE we try to compile it.
// Hard stop: if this fails, the source is not chad. Period.

function chadSourcePreflight(source, block) {
  if (!block) return { ok: false, reason: 'no chad block detected' };

  if (source.indexOf(block.closeTag) < 0) {
    return { ok: false, reason: 'missing closing tag ' + block.closeTag };
  }

  // Lib/effect/glyph blocks have no return() — they define data, not UI
  if (block.type !== 'lib' && block.type !== 'effect' && block.type !== 'glyph') {
    if (source.indexOf('return(') < 0 && source.indexOf('return (') < 0) {
      return { ok: false, reason: 'no return() found in ' + block.type + ' block' };
    }
  }

  // Mixed-lane patterns are a hard stop — you're in the wrong lane
  if (/\bfunction\s+App\s*\(/.test(source)) {
    return { ok: false, reason: 'function App() is mixed lane — not chad' };
  }
  if (/\buseState\s*\(/.test(source)) {
    return { ok: false, reason: 'useState() is mixed lane — not chad' };
  }
  if (/\buseEffect\s*\(/.test(source)) {
    return { ok: false, reason: 'useEffect() is mixed lane — not chad' };
  }

  return { ok: true };
}

// ── Extract inner content from chad block ──

function extractChadInner(source, block) {
  var openRe = new RegExp('<' + block.name + '\\s+' + block.type + '\\s*>');
  var openMatch = source.match(openRe);
  if (!openMatch) return source;
  var startIdx = openMatch.index + openMatch[0].length;
  var endIdx = source.indexOf(block.closeTag, startIdx);
  if (endIdx < 0) return source;
  return source.slice(startIdx, endIdx);
}

// ── Chad lane entry point ──

function compileChadLane(source, tokens, file) {
  var c = mkCursor(tokens, source);
  resetCtx();
  assignSurfaceTier(source, file);

  // ── Detect chad block ──
  var block = detectChadBlock(source);

  // ── Source preflight — hard stop ──
  var spf = chadSourcePreflight(source, block);
  if (!spf.ok) {
    return '// Smith error: chad source preflight failed — ' + spf.reason + '\n' +
           'comptime { @compileError("Chad source preflight: ' + spf.reason + '"); }\n';
  }

  // ── Extract inner content ──
  var inner = extractChadInner(source, block);

  // ── Extract declarative blocks from inner source ──
  var varBlock = extractPageBlock(inner, 'var');
  var stateBlock = extractPageBlock(inner, 'state');
  var functionsBlock = extractPageBlock(inner, 'functions');
  var timerBlocks = extractPageBlocks(inner, 'timer');

  // ── Parse <types> block → type variant values ──
  // These are string enums: <types><mode>time\ndate\nsystem</mode></types>
  // The transpiler needs to quote bare words that match type variants.
  var typesBlock = extractPageBlock(inner, 'types');
  ctx._typeVariants = {};
  if (typesBlock) {
    var typeBlockRe = /<(\w+)>([\s\S]*?)<\/\1>/g;
    var tbMatch;
    while ((tbMatch = typeBlockRe.exec(typesBlock)) !== null) {
      var typeName = tbMatch[1];
      var typeBody = tbMatch[2];
      var variants = typeBody.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l && !l.startsWith('//'); });
      for (var tvi = 0; tvi < variants.length; tvi++) {
        ctx._typeVariants[variants[tvi]] = typeName;
      }
    }
  }

  // Track <module> blocks as ignored (not yet compiled)
  var moduleMatches = inner.match(/<module\s+(\w+)\s*>/g);
  if (moduleMatches) {
    for (var mi = 0; mi < moduleMatches.length; mi++) {
      var modName = moduleMatches[mi].match(/<module\s+(\w+)/);
      if (modName) ctx._ignoredModuleBlocks.push({ name: modName[1] });
    }
  }

  // ── Parse <var> block → state vars + ambient reads ──
  var allVars = parsePageVarBlock(varBlock);
  var ambients = [];
  var stateVars = [];
  for (var vi = 0; vi < allVars.length; vi++) {
    if (allVars[vi].ambient) {
      ambients.push(allVars[vi]);
    } else {
      stateVars.push(allVars[vi]);
    }
  }

  // ── Parse data blocks: <name> for vars declared as array/objects ──
  // Dictionary: cards is objects → <cards> id: 1, title: Auth flow, col: todo</cards>
  //             pages is page array → <pages> overview\n users\n analytics </pages>
  for (var dbi = 0; dbi < stateVars.length; dbi++) {
    var dbVar = stateVars[dbi];
    if (dbVar.type !== 'array' && dbVar.type !== 'object_array') continue;
    if (dbVar.dataKind !== 'objects' && dbVar.dataKind !== 'array' && !/\w+\s+array$/.test(dbVar.dataKind || '')) continue;

    var dataBlock = extractPageBlock(inner, dbVar.name);
    if (!dataBlock) continue;

    if (dbVar.dataKind === 'objects') {
      // Parse objects: each line is comma-separated key: value pairs
      var dataLines = dataBlock.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l && !l.startsWith('//'); });
      if (dataLines.length === 0) continue;

      // Discover fields from first row
      var oaFields = [];
      var firstPairs = dataLines[0].split(',');
      for (var fpi = 0; fpi < firstPairs.length; fpi++) {
        var fpair = firstPairs[fpi].trim();
        var fcolon = fpair.indexOf(':');
        if (fcolon < 0) continue;
        var fname = fpair.slice(0, fcolon).trim();
        var fval = fpair.slice(fcolon + 1).trim();
        var ftype = 'string';
        if (fval === 'true' || fval === 'false') ftype = 'boolean';
        else if (/^-?\d+(\.\d+)?$/.test(fval)) ftype = fval.indexOf('.') >= 0 ? 'float' : 'int';
        oaFields.push({ name: fname, type: ftype });
      }

      // Parse all rows into data
      var constData = [];
      for (var dli = 0; dli < dataLines.length; dli++) {
        var row = {};
        var pairs = dataLines[dli].split(',');
        for (var pi2 = 0; pi2 < pairs.length; pi2++) {
          var pair = pairs[pi2].trim();
          var cidx = pair.indexOf(':');
          if (cidx < 0) continue;
          var pname = pair.slice(0, cidx).trim();
          var pval = pair.slice(cidx + 1).trim();
          if (pval === 'true') pval = true;
          else if (pval === 'false') pval = false;
          else if (/^-?\d+(\.\d+)?$/.test(pval)) pval = parseFloat(pval);
          row[pname] = pval;
        }
        constData.push(row);
      }

      var oaIdx = ctx.objectArrays.length;
      ctx.objectArrays.push({
        fields: oaFields,
        getter: dbVar.name,
        setter: 'set_' + dbVar.name,
        oaIdx: oaIdx,
        constData: constData,
      });

      // Build JS initial value: [{id: 1, title: 'Auth flow', ...}, ...]
      var jsRows = [];
      for (var jri = 0; jri < constData.length; jri++) {
        var jParts = [];
        for (var jfi = 0; jfi < oaFields.length; jfi++) {
          var jf = oaFields[jfi];
          var jv = constData[jri][jf.name];
          if (jf.type === 'string') jv = "'" + jv + "'";
          else if (typeof jv === 'boolean') jv = jv ? 'true' : 'false';
          jParts.push(jf.name + ': ' + jv);
        }
        jsRows.push('{' + jParts.join(', ') + '}');
      }
      dbVar.initial = '[' + jsRows.join(', ') + ']';
      dbVar.type = 'object_array';
    } else {
      // Simple array or typed array: one item per line
      var items = dataBlock.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l && !l.startsWith('//'); });
      if (items.length === 0) continue;

      // Register as simple OA
      var saOaIdx = ctx.objectArrays.length;
      ctx.objectArrays.push({
        fields: [{ name: '_v', type: 'string' }],
        getter: dbVar.name,
        setter: 'set_' + dbVar.name,
        oaIdx: saOaIdx,
        isSimpleArray: true,
        constData: items.map(function(item) { return { _v: item }; }),
      });

      // Build JS initial value: ['overview', 'users', 'analytics']
      dbVar.initial = "['" + items.join("', '") + "']";
      dbVar.type = 'object_array';
    }
  }

  // ── Parse <state> block → setter names ──
  var declaredSetters = parsePageStateBlock(stateBlock);

  // ── Populate ctx.stateSlots from primitive state vars ──
  for (var si = 0; si < stateVars.length; si++) {
    var sv = stateVars[si];
    if (sv.type === 'int' || sv.type === 'float' || sv.type === 'boolean' || sv.type === 'string') {
      ctx.stateSlots.push({
        getter: sv.name,
        setter: 'set_' + sv.name,
        initial: sv.initial,
        type: sv.type,
      });
    }
  }

  // ── Build JS_LOGIC from <functions>, <timer>, state declarations ──
  var jsLogic = buildPageJSLogic(stateVars, ambients, functionsBlock, timerBlocks);
  ctx.scriptBlock = jsLogic.scriptBlock;
  ctx.scriptFuncs = jsLogic.funcNames;

  // Register declared setters as script funcs (handler resolution)
  for (var di = 0; di < declaredSetters.length; di++) {
    if (ctx.scriptFuncs.indexOf(declaredSetters[di]) < 0) {
      ctx.scriptFuncs.push(declaredSetters[di]);
    }
  }

  // ── Register OAs for object_array state vars (skip if data block already registered) ──
  for (var oai = 0; oai < stateVars.length; oai++) {
    var oav = stateVars[oai];
    if (oav.type !== 'object_array' || !oav.initial) continue;
    // Skip if data block parser already registered this OA
    var alreadyRegistered = false;
    for (var ari = 0; ari < ctx.objectArrays.length; ari++) {
      if (ctx.objectArrays[ari].getter === oav.name) { alreadyRegistered = true; break; }
    }
    if (alreadyRegistered) continue;
    var oaFieldMatch = oav.initial.match(/\[\s*\{([^}]+)\}/);
    if (!oaFieldMatch) continue;
    var oaFieldPairs = oaFieldMatch[1].split(',');
    var oaFields = [];
    for (var ofi = 0; ofi < oaFieldPairs.length; ofi++) {
      var pair = oaFieldPairs[ofi].trim();
      var colonIdx = pair.indexOf(':');
      if (colonIdx < 0) continue;
      var fname = pair.slice(0, colonIdx).trim();
      var fval = pair.slice(colonIdx + 1).trim();
      var ftype = 'int';
      if (fval[0] === "'" || fval[0] === '"') ftype = 'string';
      else if (fval === 'true' || fval === 'false') ftype = 'boolean';
      else if (fval.indexOf('.') >= 0) ftype = 'float';
      oaFields.push({ name: fname, type: ftype });
    }
    if (oaFields.length > 0) {
      var oaIdx = ctx.objectArrays.length;
      ctx.objectArrays.push({
        fields: oaFields,
        getter: oav.name,
        setter: 'set_' + oav.name,
        oaIdx: oaIdx,
      });
    }
  }

  // ── Collection passes ──
  collectComponents(c);
  collectConstArrays(c);
  collectClassifiers();

  // ── Chad always dispatches handlers through JS ──
  ctx.handlerDispatch = 'js';

  // ── Find the LAST return() in tokens → parse JSX ──
  // Imports are prepended to the token stream. The main chad block's
  // return() is the last one. Scanning forward finds component returns first.
  c.pos = 0;
  var foundReturn = false;
  var lastReturnPos = -1;
  while (c.pos < c.count) {
    if (c.isIdent('return') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
      lastReturnPos = c.pos;
    }
    c.advance();
  }
  if (lastReturnPos >= 0) {
    c.pos = lastReturnPos;
    c.advance(); // skip 'return'
    c.advance(); // skip '('
    foundReturn = true;
  }

  if (!foundReturn) {
    if (block.type === 'lib' || block.type === 'effect' || block.type === 'glyph') {
      // Non-UI blocks — generate a minimal root with a label identifying the artifact
      var label = block.name + '.' + block.type;
      var stubRoot = '.{ .text = "' + label + '", .font_size = 12, .text_color = Color.rgb(0x80, 0x80, 0x80) }';
      return finishParsedLane(stubRoot, file);
    }
    return '// Smith error: no return() found in chad block <' + block.name + ' ' + block.type + '>\n' +
           'comptime { @compileError("No return() in <' + block.name + ' ' + block.type + '>"); }\n';
  }

  // ── Parse JSX tree ──
  var root = parseJSXElement(c);

  // NOTE: __evalDynTexts is generated by emit_split.js from ctx._jsDynTexts.
  // Do NOT append it here — the emit layer handles it on the highway.

  // ── Merge onto the highway ──
  return finishParsedLane(root.nodeExpr, file);
}
