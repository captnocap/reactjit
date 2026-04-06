// ── Page block compiler ─────────────────────────────────────────
// Handles <page route=name> with <var>, <state>, <functions>, <timer> blocks.
//
// Pre-processes page syntax into ctx fields, then delegates JSX parsing
// to the existing parseJSXElement machinery. This is a source-level
// pre-processor — it reads raw source text for block extraction, then
// uses the token cursor for JSX.
//
// Manifest target: manifest/s00c_manifest.tsz
//
// Block types:
//   <var>       → state slots + ambient reads
//   <state>     → setter name validation
//   <functions> → JS_LOGIC script block
//   <timer>     → setInterval appended to script block
//   return(...) → JSX (handled by existing parse.js)

// ── Block extraction (source-level) ──

function extractPageBlock(source, tag) {
  const openRe = new RegExp('<' + tag + '(?:\\s[^>]*)?>');
  const closeStr = '</' + tag + '>';
  const openMatch = source.match(openRe);
  if (!openMatch) return '';
  const startIdx = openMatch.index + openMatch[0].length;
  const endIdx = source.indexOf(closeStr, startIdx);
  if (endIdx < 0) return '';
  return source.slice(startIdx, endIdx).trim();
}

function extractPageBlocks(source, tag) {
  const results = [];
  const openRe = new RegExp('<' + tag + '(?:\\s([^>]*))?>', 'g');
  const closeStr = '</' + tag + '>';
  var match;
  while ((match = openRe.exec(source)) !== null) {
    var attrs = match[1] || '';
    var startIdx = match.index + match[0].length;
    var endIdx = source.indexOf(closeStr, startIdx);
    if (endIdx < 0) break;
    results.push({ attrs: attrs, body: source.slice(startIdx, endIdx).trim() });
  }
  return results;
}

// ── <var> block parser ──
//
// Syntax:
//   name is 'string'         → string state
//   name is 0                → int state
//   name is 3.14             → float state
//   name is true/false       → boolean state
//   name is sys.user         → ambient read (runtime-provided)
//   name is input.mouse.x    → ambient read (deep path)
//   name                     → uninitialized (empty array)
//   name is [...]            → array value (may span multiple lines)

function parsePageVarBlock(block) {
  if (!block) return [];
  var vars = [];
  var lines = block.split('\n');
  var i = 0;

  while (i < lines.length) {
    var line = lines[i].trim();
    i++;
    if (!line || line.startsWith('//')) continue;

    // name exact type/value — immutable, constrained
    var exactMatch = line.match(/^(\w+)\s+exact\s+(.+)$/);
    if (exactMatch) {
      var ename = exactMatch[1];
      var econstraint = exactMatch[2].trim();
      // Quoted string
      if ((econstraint[0] === "'" && econstraint[econstraint.length - 1] === "'") ||
          (econstraint[0] === '"' && econstraint[econstraint.length - 1] === '"')) {
        vars.push({ name: ename, initial: econstraint.slice(1, -1), type: 'string' });
      }
      // Number
      else if (/^-?\d+(\.\d+)?$/.test(econstraint)) {
        vars.push({ name: ename, initial: parseFloat(econstraint), type: econstraint.indexOf('.') >= 0 ? 'float' : 'int' });
      }
      // Boolean
      else if (econstraint === 'true' || econstraint === 'false') {
        vars.push({ name: ename, initial: econstraint === 'true', type: 'boolean' });
      }
      // Type reference (e.g., "type") → default empty string for enum-like types
      else {
        vars.push({ name: ename, initial: '', type: 'string' });
      }
      continue;
    }

    // name is value
    var isMatch = line.match(/^(\w+)\s+is\s+(.+)$/);
    if (isMatch) {
      var name = isMatch[1];
      var value = isMatch[2].trim();

      // Multi-line value: track bracket depth
      var depth = 0;
      for (var ci = 0; ci < value.length; ci++) {
        var ch = value[ci];
        if (ch === '[' || ch === '{' || ch === '(') depth++;
        if (ch === ']' || ch === '}' || ch === ')') depth--;
      }
      while (depth > 0 && i < lines.length) {
        value += '\n' + lines[i];
        var addLine = lines[i];
        for (var cj = 0; cj < addLine.length; cj++) {
          var ch2 = addLine[cj];
          if (ch2 === '[' || ch2 === '{' || ch2 === '(') depth++;
          if (ch2 === ']' || ch2 === '}' || ch2 === ')') depth--;
        }
        i++;
      }

      // Classify value type

      // Ambient read: ns.field or ns.sub.field
      var ambientNs = ['sys', 'time', 'device', 'locale', 'privacy', 'input'];
      var dotIdx = value.indexOf('.');
      if (dotIdx > 0) {
        var ns = value.slice(0, dotIdx);
        if (ambientNs.indexOf(ns) >= 0) {
          vars.push({ name: name, ambient: true, namespace: ns, field: value.slice(dotIdx + 1), type: 'ambient' });
          continue;
        }
      }

      // String literal
      if ((value[0] === "'" && value[value.length - 1] === "'") ||
          (value[0] === '"' && value[value.length - 1] === '"')) {
        vars.push({ name: name, initial: value.slice(1, -1), type: 'string' });
        continue;
      }

      // Boolean
      if (value === 'true') { vars.push({ name: name, initial: true, type: 'boolean' }); continue; }
      if (value === 'false') { vars.push({ name: name, initial: false, type: 'boolean' }); continue; }

      // Number
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        var isFloat = value.indexOf('.') >= 0;
        vars.push({ name: name, initial: isFloat ? parseFloat(value) : parseInt(value), type: isFloat ? 'float' : 'int' });
        continue;
      }

      // Array/object literal
      if (value[0] === '[') {
        vars.push({ name: name, initial: value, type: 'object_array' });
        continue;
      }

      // Dictionary data types: array, TYPE array, object, objects
      if (value === 'array' || /^\w+\s+array$/.test(value)) {
        vars.push({ name: name, initial: null, type: 'array', dataKind: value });
        continue;
      }
      if (value === 'object') {
        vars.push({ name: name, initial: null, type: 'expression', dataKind: 'object' });
        continue;
      }
      if (value === 'objects') {
        vars.push({ name: name, initial: null, type: 'object_array', dataKind: 'objects' });
        continue;
      }

      // Fallback: expression
      vars.push({ name: name, initial: value, type: 'expression' });
      continue;
    }

    // Bare name — uninitialized (empty array by convention)
    var bareMatch = line.match(/^(\w+)$/);
    if (bareMatch) {
      vars.push({ name: bareMatch[1], initial: null, type: 'array' });
    }
  }
  return vars;
}

// ── <state> block parser ──
// Returns list of setter names for validation.

function parsePageStateBlock(block) {
  if (!block) return [];
  return block.split('\n')
    .map(function(l) { return l.trim(); })
    .filter(function(l) { return l && !l.startsWith('//'); })
    .map(function(l) {
      // Extract just the setter name, ignoring constraints (exact mode, etc.)
      return l.split(/\s+/)[0];
    });
}

// ── <functions> block parser ──
//
// Syntax:
//   funcName:             → function with no params
//     body line
//   funcName(a, b):       → function with params
//     body line
//   computed:             → computed property (single expression)
//     expr
//   composition:          → function composition
//     funcA + funcB

function parsePageFunctionsBlock(block) {
  if (!block) return [];
  var funcs = [];
  var lines = block.split('\n');
  var current = null;

  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].trim();
    if (!trimmed) continue;
    // Skip section comment headers
    if (trimmed.startsWith('// ──') || trimmed.startsWith('// ══')) continue;
    // Skip regular comments
    if (trimmed.startsWith('//')) continue;

    // Function header: name: or name(params): or name every N: or name requires X, Y:
    var funcMatch = trimmed.match(/^(\w+)(?:\s+every\s+(\d+))?(?:\s+requires\s+[\w\s,]+)?(\(([^)]*)\))?\s*:$/);
    if (funcMatch) {
      if (current) funcs.push(current);
      var params = funcMatch[4] ? funcMatch[4].split(',').map(function(p) { return p.trim(); }) : [];
      current = { name: funcMatch[1], params: params, bodyLines: [], interval: funcMatch[2] ? parseInt(funcMatch[2]) : 0 };
      continue;
    }

    // Body line
    if (current) {
      current.bodyLines.push(trimmed);
    }
  }
  if (current) funcs.push(current);
  return funcs;
}

// ── Line transpiler: page function body → JS ──

function transpilePageExpr(expr) {
  // Multi-word operators first (order matters)
  expr = expr.replace(/\bexact or above\b/g, '>=');
  expr = expr.replace(/\bexact or below\b/g, '<=');
  expr = expr.replace(/\bnot exact\b/g, '!==');
  // Single-word operators
  expr = expr.replace(/\babove\b/g, '>');
  expr = expr.replace(/\bbelow\b/g, '<');
  expr = expr.replace(/\bexact\b/g, '===');
  // Boolean negation (must be after 'not exact')
  expr = expr.replace(/\bnot\s+/g, '!');
  return expr;
}

// Quote bare words that are known type variants.
// e.g., set_mode('time') instead of set_mode(time)
function _quoteTypeVariant(expr) {
  if (!ctx._typeVariants) return expr;
  var trimmed = expr.trim();
  // Only quote single bare identifiers that are type variants
  if (/^\w+$/.test(trimmed) && ctx._typeVariants[trimmed]) {
    return "'" + trimmed + "'";
  }
  return expr;
}

function transpilePageLine(line, setterNames, isComputed) {
  // Guard: expr ? stop : go → early return
  if (/\?\s*stop\s*:\s*go\s*$/.test(line)) {
    var guardExpr = line.replace(/\s*\?\s*stop\s*:\s*go\s*$/, '').trim();
    return 'if (' + transpilePageExpr(guardExpr) + ') return;';
  }

  // Inverse guard: expr ? go : stop
  if (/\?\s*go\s*:\s*stop\s*$/.test(line)) {
    var guardExpr2 = line.replace(/\s*\?\s*go\s*:\s*stop\s*$/, '').trim();
    return 'if (!(' + transpilePageExpr(guardExpr2) + ')) return;';
  }

  // Setter: set_X to expression
  var setterMatch = line.match(/^(set_\w+)\s+to\s+(.+)$/);
  if (setterMatch) {
    return setterMatch[1] + '(' + _quoteTypeVariant(transpilePageExpr(setterMatch[2])) + ');';
  }

  // Setter: set_X is expression (dictionary/chad syntax)
  var setterIsMatch = line.match(/^(set_\w+)\s+is\s+(.+)$/);
  if (setterIsMatch) {
    return setterIsMatch[1] + '(' + _quoteTypeVariant(transpilePageExpr(setterIsMatch[2])) + ');';
  }

  // Local variable assignment: name is expr (not a setter, not a state var)
  var localIsMatch = line.match(/^(\w+)\s+is\s+(.+)$/);
  if (localIsMatch && !localIsMatch[1].startsWith('set_')) {
    return 'var ' + localIsMatch[1] + ' = ' + transpilePageExpr(localIsMatch[2]) + ';';
  }

  // stop → return
  if (line === 'stop') return 'return;';

  // Bare string literal → return value
  if (/^'[^']*'$/.test(line) || /^"[^"]*"$/.test(line)) {
    return 'return ' + line + ';';
  }

  // Computed function: bare expressions are return values
  if (isComputed) {
    return 'return ' + transpilePageExpr(line) + ';';
  }

  // Everything else: passthrough as JS expression/statement
  return transpilePageExpr(line) + ';';
}

// ── Block-level body transpiler ──
// Handles <if>/<else if>/<else> blocks inside <functions> bodies.

function transpilePageBody(bodyLines, setterNames, jsLines, indent, isComputed) {
  for (var i = 0; i < bodyLines.length; i++) {
    var line = bodyLines[i].trim();
    if (!line || line.startsWith('//')) continue;

    // <if expr>
    var ifMatch = line.match(/^<if\s+(.+)>$/);
    if (ifMatch) {
      jsLines.push(indent + 'if (' + transpilePageExpr(ifMatch[1]) + ') {');
      continue;
    }

    // </if> — check if followed by <else, merge into } else
    if (line === '</if>') {
      var nextNonEmpty = '';
      for (var j = i + 1; j < bodyLines.length; j++) {
        nextNonEmpty = bodyLines[j].trim();
        if (nextNonEmpty) break;
      }
      if (nextNonEmpty.indexOf('<else') === 0) {
        continue;
      }
      jsLines.push(indent + '}');
      continue;
    }

    // <else if expr>
    var elseIfMatch = line.match(/^<else\s+if\s+(.+)>$/);
    if (elseIfMatch) {
      jsLines.push(indent + '} else if (' + transpilePageExpr(elseIfMatch[1]) + ') {');
      continue;
    }

    // <else>
    if (line === '<else>') {
      jsLines.push(indent + '} else {');
      continue;
    }

    // </else> — check if followed by another <else, merge into } else
    if (line === '</else>') {
      var nextAfterElse = '';
      for (var je = i + 1; je < bodyLines.length; je++) {
        nextAfterElse = bodyLines[je].trim();
        if (nextAfterElse) break;
      }
      if (nextAfterElse.indexOf('<else') === 0) {
        continue;
      }
      jsLines.push(indent + '}');
      continue;
    }

    // <during condition> — in function bodies, acts as <if> (conditional exec)
    var duringMatch = line.match(/^<during\s+(.+)>$/);
    if (duringMatch) {
      jsLines.push(indent + 'if (' + transpilePageExpr(duringMatch[1]) + ') {');
      continue;
    }

    // </during>
    if (line === '</during>') {
      jsLines.push(indent + '}');
      continue;
    }

    // <switch expr>
    var switchMatch = line.match(/^<switch\s+(.+)>$/);
    if (switchMatch) {
      jsLines.push(indent + 'switch (' + transpilePageExpr(switchMatch[1]) + ') {');
      continue;
    }

    // </switch>
    if (line === '</switch>') {
      jsLines.push(indent + '}');
      continue;
    }

    // <case value> or <case else>
    var caseMatch = line.match(/^<case\s+(.+)>$/);
    if (caseMatch) {
      var caseVal = caseMatch[1].trim();
      if (caseVal === 'else') {
        jsLines.push(indent + "default: {");
      } else {
        jsLines.push(indent + "case '" + caseVal + "': {");
      }
      continue;
    }

    // </case>
    if (line === '</case>') {
      jsLines.push(indent + '  break; }');
      continue;
    }

    // Regular line
    jsLines.push(indent + transpilePageLine(line, setterNames, isComputed));
  }
}

// ── JS_LOGIC builder ──
// Assembles the complete JS logic block from parsed page blocks.

function buildPageJSLogic(stateVars, ambients, functionsBlock, timerBlocks) {
  var jsLines = [];
  var funcNames = [];

  // ── State variable declarations + setters ──
  // NOTE: Primitive state vars (int, float, boolean, string) are in ctx.stateSlots.
  // emit_split.js auto-generates their JS var + setter declarations from stateSlots.
  // We only emit JS vars here for types NOT in stateSlots (array, object_array, expression).
  for (var i = 0; i < stateVars.length; i++) {
    var sv = stateVars[i];

    // Primitives handled by emit — skip
    if (sv.type === 'int' || sv.type === 'float' || sv.type === 'boolean' || sv.type === 'string') {
      funcNames.push('set_' + sv.name);
      continue;
    }

    // Non-primitive: emit JS-managed state (not in Zig state slots)
    if (sv.type === 'array') {
      jsLines.push('var ' + sv.name + ' = [];');
    } else if (sv.type === 'object_array') {
      jsLines.push('var ' + sv.name + ' = ' + sv.initial + ';');
    } else {
      jsLines.push('var ' + sv.name + ' = ' + (sv.initial || '0') + ';');
    }

    var setterName = 'set_' + sv.name;
    jsLines.push('function ' + setterName + '(v) { ' + sv.name + ' = v; }');
    funcNames.push(setterName);
  }

  // ── Ambient variable declarations ──
  // Runtime provides __ambient(namespace, field) → value
  for (var ai = 0; ai < ambients.length; ai++) {
    var amb = ambients[ai];
    jsLines.push('var ' + amb.name + " = __ambient('" + amb.namespace + "', '" + amb.field + "');");
  }

  // ── Parse and transpile <functions> ──
  var funcs = parsePageFunctionsBlock(functionsBlock);
  var setterNames = funcNames.slice(); // setters known so far

  for (var fi = 0; fi < funcs.length; fi++) {
    var func = funcs[fi];
    funcNames.push(func.name);

    // Composition: single line "funcA + funcB + funcC"
    if (func.bodyLines.length === 1 && /^\w+(\s*\+\s*\w+)+$/.test(func.bodyLines[0].replace(/\(.*?\)/g, ''))) {
      // Split on + and call each
      var rawParts = func.bodyLines[0].split('+');
      var callParts = [];
      for (var pi = 0; pi < rawParts.length; pi++) {
        var part = rawParts[pi].trim();
        // If part already has parens, keep; otherwise add ()
        if (part.indexOf('(') >= 0) {
          callParts.push(part);
        } else {
          callParts.push(part + '()');
        }
      }
      var params = func.params.length ? func.params.join(', ') : '';
      jsLines.push('function ' + func.name + '(' + params + ') { ' + callParts.join('; ') + '; }');
      continue;
    }

    // Computed property: single expression, no side effects
    // (Returns the expression value — emitted as a getter function)
    if (func.bodyLines.length === 1 && !func.bodyLines[0].match(/^(set_|db\.|net\.|fs\.|media\.|crypto\.|audio\.)/)) {
      var exprLine = func.bodyLines[0];
      // Check if it's a pure expression (ternary, string concat, etc.)
      if (!exprLine.match(/^(set_\w+)\s+to\s+/) && !/\?\s*(stop|go)\s*:\s*(stop|go)/.test(exprLine)) {
        var params2 = func.params.length ? func.params.join(', ') : '';
        jsLines.push('function ' + func.name + '(' + params2 + ') { return ' + transpilePageExpr(exprLine) + '; }');
        continue;
      }
    }

    // Detect computed function: no setter calls in body → expressions are returns
    var isComputed = true;
    for (var ci = 0; ci < func.bodyLines.length; ci++) {
      var cl = func.bodyLines[ci].trim();
      if (/^set_\w+\s+/.test(cl)) { isComputed = false; break; }
    }

    // Regular multi-line function
    var fparams = func.params.length ? func.params.join(', ') : '';
    jsLines.push('function ' + func.name + '(' + fparams + ') {');
    transpilePageBody(func.bodyLines, setterNames, jsLines, '  ', isComputed);
    jsLines.push('}');

    // Timer function: name every N: → setInterval(name, N)
    if (func.interval) {
      jsLines.push('setInterval(' + func.name + ', ' + func.interval + ');');
    }
  }

  // ── Timer blocks → setInterval ──
  for (var ti = 0; ti < timerBlocks.length; ti++) {
    var timer = timerBlocks[ti];
    var intervalMatch = timer.attrs.match(/interval=(\d+)/);
    if (intervalMatch) {
      var body = timer.body.trim();
      // If body is a single function name, wrap in call
      if (/^\w+$/.test(body)) {
        jsLines.push('setInterval(' + body + ', ' + intervalMatch[1] + ');');
      } else {
        jsLines.push('setInterval(function() { ' + body + '; }, ' + intervalMatch[1] + ');');
      }
    }
  }

  // ── JS_LOGIC validation: duplicate vars ──
  var seenVars = {};
  for (var vi2 = 0; vi2 < jsLines.length; vi2++) {
    var varMatch2 = jsLines[vi2].match(/^var\s+(\w+)\s*=/);
    if (varMatch2) {
      var vname = varMatch2[1];
      if (seenVars[vname]) {
        ctx._duplicateJSVars.push({ name: vname });
      }
      seenVars[vname] = true;
    }
  }

  // ── JS_LOGIC validation: undefined function calls ──
  // All funcNames + setter names that were emitted
  var definedFuncs = {};
  for (var df = 0; df < funcNames.length; df++) definedFuncs[funcNames[df]] = true;
  // Also count functions parsed from <functions> block
  var parsedFuncs = parsePageFunctionsBlock(functionsBlock);
  for (var pf2 = 0; pf2 < parsedFuncs.length; pf2++) definedFuncs[parsedFuncs[pf2].name] = true;
  // Scan JS lines for function calls: word( pattern
  var allJS = jsLines.join('\n');
  var callRe = /\b(\w+)\s*\(/g;
  var callMatch;
  // Built-in JS / runtime functions to ignore
  var jsBuiltins = { 'function': 1, 'if': 1, 'for': 1, 'while': 1, 'switch': 1, 'case': 1, 'return': 1, 'setInterval': 1, 'setTimeout': 1, 'Math': 1, 'parseInt': 1, 'parseFloat': 1, 'String': 1, 'Number': 1, 'Array': 1, 'Object': 1, 'JSON': 1, 'console': 1, '__ambient': 1, '__setStateString': 1, '__setState': 1, '__setObjArr0': 1, '__setObjArr1': 1, '__setObjArr2': 1, '__setObjArr3': 1 };
  while ((callMatch = callRe.exec(allJS)) !== null) {
    var callee = callMatch[1];
    // Skip method calls preceded by '.' (net.get, items.where, etc.)
    if (callMatch.index > 0 && allJS[callMatch.index - 1] === '.') continue;
    if (!jsBuiltins[callee] && !definedFuncs[callee] && !seenVars[callee]) {
      // Skip module-namespaced calls (db.init, net.get, etc.) — those are tracked as ignored modules
      // Also skip concat, map, find, filter, slice, push, etc.
      var jsArrayMethods = { 'concat': 1, 'map': 1, 'find': 1, 'filter': 1, 'slice': 1, 'push': 1, 'pop': 1, 'shift': 1, 'join': 1, 'indexOf': 1, 'includes': 1, 'toString': 1, 'trim': 1, 'reduce': 1, 'from': 1, 'floor': 1, 'ceil': 1, 'round': 1, 'abs': 1, 'min': 1, 'max': 1, 'sqrt': 1, 'pow': 1, 'random': 1, 'toLowerCase': 1, 'toUpperCase': 1, 'split': 1, 'replace': 1, 'match': 1, 'startsWith': 1, 'endsWith': 1, 'charAt': 1, 'substring': 1, 'splice': 1, 'sort': 1, 'reverse': 1, 'forEach': 1, 'some': 1, 'every': 1, 'keys': 1, 'values': 1, 'entries': 1, 'assign': 1, 'stringify': 1, 'parse': 1, 'log': 1, 'warn': 1, 'error': 1, 'clamp': 1 };
      if (!jsArrayMethods[callee]) {
        ctx._undefinedJSCalls.push({ caller: 'JS_LOGIC', callee: callee });
      }
    }
  }

  return { scriptBlock: jsLines.join('\n'), funcNames: funcNames };
}

// ── Page compilation entry point ──
// Called from compile() when <page is detected in source.
// Populates ctx with state/script from declarative blocks,
// then delegates JSX parsing to existing machinery.

function compilePage(source, c, file) {
  // Extract route name
  var pageMatch = source.match(/<page\s+route=(\w+)\s*>/);
  var routeName = pageMatch ? pageMatch[1] : 'Page';

  // Detect <module> blocks — not yet compiled, track as ignored
  var moduleMatches = source.match(/<module\s+(\w+)\s*>/g);
  if (moduleMatches) {
    for (var mi = 0; mi < moduleMatches.length; mi++) {
      var modName = moduleMatches[mi].match(/<module\s+(\w+)/);
      if (modName) ctx._ignoredModuleBlocks.push({ name: modName[1] });
    }
  }

  // Extract declarative blocks from source text
  var varBlock = extractPageBlock(source, 'var');
  var stateBlock = extractPageBlock(source, 'state');
  var functionsBlock = extractPageBlock(source, 'functions');
  var timerBlocks = extractPageBlocks(source, 'timer');

  // Parse <var> block → separate state vars from ambient reads
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

  // Parse <state> block → setter names (for validation)
  var declaredSetters = parsePageStateBlock(stateBlock);

  // Populate ctx.stateSlots from state vars
  for (var si = 0; si < stateVars.length; si++) {
    var sv = stateVars[si];
    // Only primitive types get Zig-side state slots
    // Complex types (object_array, array, expression) stay in JS
    if (sv.type === 'int' || sv.type === 'float' || sv.type === 'boolean' || sv.type === 'string') {
      ctx.stateSlots.push({
        getter: sv.name,
        setter: 'set_' + sv.name,
        initial: sv.initial,
        type: sv.type
      });
    }
  }

  // Build JS_LOGIC from <functions>, <timer>, and state declarations
  var jsLogic = buildPageJSLogic(stateVars, ambients, functionsBlock, timerBlocks);
  ctx.scriptBlock = jsLogic.scriptBlock;
  ctx.scriptFuncs = jsLogic.funcNames;

  // Also register setter names as script funcs (so handler resolution works)
  for (var di = 0; di < declaredSetters.length; di++) {
    if (ctx.scriptFuncs.indexOf(declaredSetters[di]) < 0) {
      ctx.scriptFuncs.push(declaredSetters[di]);
    }
  }

  // ── Register OAs for object_array state vars ──
  // Page mode doesn't call collectState(), so we register OAs here by parsing initial values
  for (var oai = 0; oai < stateVars.length; oai++) {
    var oav = stateVars[oai];
    if (oav.type !== 'object_array' || !oav.initial) continue;
    // Parse first element to discover fields: [{id: 1, text: 'foo', done: true}, ...]
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

  // ── Collect components and classifiers (needed for C.* and imported components) ──
  collectComponents(c);
  collectConstArrays(c);
  collectClassifiers();

  // ── Find return( in tokens → start JSX parse ──
  c.pos = 0;
  var foundReturn = false;
  while (c.pos < c.count) {
    if (c.isIdent('return') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
      c.advance(); // skip 'return'
      c.advance(); // skip '('
      foundReturn = true;
      break;
    }
    c.advance();
  }

  if (!foundReturn) {
    return '// Smith error: no return() found in <page> block\n';
  }

  // Parse JSX tree
  var root = parseJSXElement(c);

  // ── Append __evalDynTexts to JS_LOGIC for JS-evaluated expressions ──
  if (ctx._jsDynTexts.length > 0) {
    var evalLines = ['function __evalDynTexts() {'];
    for (var jdi = 0; jdi < ctx._jsDynTexts.length; jdi++) {
      var jdt = ctx._jsDynTexts[jdi];
      evalLines.push('  try { __setStateString(' + jdt.slotIdx + ', String(' + jdt.jsExpr + ')); } catch(e) {}');
    }
    evalLines.push('}');
    // Call once at init, then on a 16ms interval for live updates
    evalLines.push('__evalDynTexts();');
    evalLines.push('setInterval(__evalDynTexts, 16);');
    ctx.scriptBlock += '\n' + evalLines.join('\n');
  }

  return finishParsedLane(root.nodeExpr, file);
}
