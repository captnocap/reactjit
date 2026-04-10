// ── Smith Debug ──────────────────────────────────────────────────────
//
// Activated by build flags. Don't edit this file to debug — just pass
// flags to the build script:
//
//   ./scripts/build carts/app.tsz -n     # node tree: debug_names + layout dump
//   ./scripts/build carts/app.tsz -s     # state: print slot changes
//   ./scripts/build carts/app.tsz -c     # compiler: dump what Smith sees
//   ./scripts/build carts/app.tsz -ns    # combine flags
//   ./scripts/build carts/app.tsz -nsc   # all three
//
// -n  NODES: Every node gets a debug_name ("Box@L12", "Text@L15").
//     On frame 5, dumps the full tree with computed x/y/w/h to stderr.
//     Tells you: what rendered, where, how big, and what didn't show.
//
// -s  STATE: Wraps every state.setSlot with a print showing the slot
//     name and old→new value. Tells you: what state changed and when.
//
// -c  COMPILER: Dumps the compiler ctx after the parse phase — all
//     state slots, maps, handlers, components, etc. Prints to stderr
//     via forge. Tells you: what Smith understood.

// ════════════════════════════════════════════════════════════════════
// ── Implementation ──
// ════════════════════════════════════════════════════════════════════

(function() {
  var DBG_NODES    = globalThis.__DBG_NODES === 1;
  var DBG_STATE    = globalThis.__DBG_STATE === 1;
  var DBG_COMPILER = globalThis.__DBG_COMPILER === 1;

  if (!DBG_NODES && !DBG_STATE && !DBG_COMPILER) return;

  var __dgb = function(msg) {
    if (!globalThis.__dbg) globalThis.__dbg = [];
    globalThis.__dbg.push(msg);
    // Also accumulate to __dbgStderr — __dbg gets cleared by finalizeEmitOutput
    // but forge needs to read the debug output after compilation finishes.
    if (!globalThis.__dbgStderr) globalThis.__dbgStderr = [];
    globalThis.__dbgStderr.push(msg);
  };

  // ── Value summarizer ──
  var __summarize = function(val, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 3) return '{...}';
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'string') {
      if (val.length > 80) return '"' + val.substring(0, 77) + '..."';
      return '"' + val + '"';
    }
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'function') return 'fn:' + (val.name || 'anon');
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      if (val.length > 5) return '[' + __summarize(val[0], depth + 1) + ', ...(' + val.length + ')]';
      return '[' + val.map(function(v) { return __summarize(v, depth + 1); }).join(', ') + ']';
    }
    if (typeof val === 'object') {
      var keys = Object.keys(val);
      if (keys.length === 0) return '{}';
      if (keys.length > 6) return '{' + keys.slice(0, 4).join(', ') + ', ...(' + keys.length + ' keys)}';
      var parts = [];
      for (var i = 0; i < keys.length; i++) {
        parts.push(keys[i] + ':' + __summarize(val[keys[i]], depth + 1));
      }
      return '{' + parts.join(', ') + '}';
    }
    return String(val);
  };

  // ── Deep dump for ctx fields ──
  var __dumpField = function(name, val) {
    if (val === null || val === undefined) {
      __dgb('[CTX] ' + name + ' = ' + String(val));
      return;
    }
    if (Array.isArray(val)) {
      __dgb('[CTX] ' + name + ' (' + val.length + ' items)');
      for (var i = 0; i < val.length && i < 30; i++) {
        __dgb('[CTX]   [' + i + '] ' + __summarize(val[i], 0));
      }
      if (val.length > 30) __dgb('[CTX]   ... +' + (val.length - 30) + ' more');
      return;
    }
    if (typeof val === 'object') {
      var keys = Object.keys(val);
      __dgb('[CTX] ' + name + ' (' + keys.length + ' keys)');
      for (var i = 0; i < keys.length && i < 30; i++) {
        __dgb('[CTX]   .' + keys[i] + ' = ' + __summarize(val[keys[i]], 0));
      }
      return;
    }
    __dgb('[CTX] ' + name + ' = ' + __summarize(val, 0));
  };

  var __dumpCtx = function(phase) {
    __dgb('');
    __dgb('==== CTX DUMP: ' + phase + ' ====');
    var fields = [
      'stateSlots', 'components', 'maps', 'handlers', 'objectArrays',
      'dynTexts', 'conditionals', 'classifiers', 'scriptBlock',
      'renderLocals', 'variantNames', '_sourceTier',
    ];
    for (var i = 0; i < fields.length; i++) {
      if (ctx && ctx[fields[i]] !== undefined) {
        __dumpField(fields[i], ctx[fields[i]]);
      }
    }
    __dgb('==== END CTX DUMP ====');
    __dgb('');
  };

  // ================================================================
  // -n  NODE DEBUG: auto debug_name + tree dump
  // ================================================================
  if (DBG_NODES) {
    // Hook buildNode to auto-generate debug_name on every node.
    // Format: "Tag@L{line}" e.g. "Box@L12", "Text@L45"
    var _origBuildNode = globalThis.buildNode;
    globalThis.buildNode = function(tag, styleFields, children, handlerRef, nodeFields, srcTag, srcOffset) {
      // Add debug_name to nodeFields
      if (!nodeFields) nodeFields = [];
      var label = tag || 'Node';
      if (srcOffset !== undefined && globalThis.__source) {
        var line = offsetToLine(globalThis.__source, srcOffset);
        label = tag + '@L' + line;
      }
      nodeFields.push('.debug_name = "' + label + '"');

      return _origBuildNode.call(this, tag, styleFields, children, handlerRef, nodeFields, srcTag, srcOffset);
    };

    // Hook emitOutput to inject the tree dump function AND the call site.
    // The old code split this across emitRuntimeEntrypoints (function def)
    // and emitOutput (call site), but emitRuntimeEntrypoints was removed
    // in the atom-based emit refactor. Now we do both in emitOutput.
    var _origEmitOutput = globalThis.emitOutput;
    globalThis.emitOutput = function(rootExpr, file) {
      var out = _origEmitOutput.call(this, rootExpr, file);

      // Build the _dbgDumpTree function
      var treeDumper = '\n// ── Debug: node tree dump (-n flag) ────────────────────────\n';
      treeDumper += 'fn _dbgDumpTree(node: *const Node, depth: u16) void {\n';
      treeDumper += '    const r = node.computed;\n';
      treeDumper += '    const name = node.debug_name orelse "?";\n';
      treeDumper += '    var pad: [64]u8 = undefined;\n';
      treeDumper += '    const pad_len = @min(depth * 2, 62);\n';
      treeDumper += '    for (0..pad_len) |pi| pad[pi] = \' \';\n';
      treeDumper += '    pad[pad_len] = 0;\n';
      treeDumper += '    const vis: []const u8 = if (r.w <= 0 or r.h <= 0) " !! ZERO-SIZE" else if (node.style.display == .none) " !! HIDDEN" else "";\n';
      treeDumper += '    std.debug.print("{s}{s}  x={d:.0} y={d:.0} w={d:.0} h={d:.0}{s}\\n", .{ pad[0..pad_len], name, r.x, r.y, r.w, r.h, vis });\n';
      treeDumper += '    for (node.children) |*child| _dbgDumpTree(child, depth + 1);\n';
      treeDumper += '}\n\n';

      // Detect split output: look for nodes._root or just _root
      var isSplit = out.indexOf('nodes._root') !== -1;
      var rootRef = isSplit ? 'nodes._root' : '_root';

      // Insert the tree dump function before _appTick
      var tickIdx = out.indexOf('fn _appTick(');
      if (tickIdx !== -1) {
        out = out.substring(0, tickIdx) + treeDumper + 'var _dbg_frame: u32 = 0;\n' + out.substring(tickIdx);
      }

      // Inject dump call at start of _appTick body, after "_ = now;"
      var nowLine = out.indexOf('_ = now;');
      if (nowLine !== -1) {
        var afterNow = out.indexOf('\n', nowLine);
        if (afterNow !== -1) {
          var dumpCall = '\n    _dbg_frame += 1;\n';
          dumpCall += '    if (_dbg_frame == 5) {\n';
          dumpCall += '        std.debug.print("\\n\\xe2\\x95\\x90\\xe2\\x95\\x90 NODE TREE (frame 5) \\xe2\\x95\\x90\\xe2\\x95\\x90\\n", .{});\n';
          dumpCall += '        _dbgDumpTree(&' + rootRef + ', 0);\n';
          dumpCall += '        std.debug.print("\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\xe2\\x95\\x90\\n\\n", .{});\n';
          dumpCall += '    }\n';
          out = out.substring(0, afterNow) + dumpCall + out.substring(afterNow);
        }
      }

      return out;
    };

    __dgb('[DEBUG -n] Node debug: debug_name on all nodes + tree dump on frame 5');
  }

  // ================================================================
  // -s  STATE DEBUG: print slot changes
  // ================================================================
  if (DBG_STATE) {
    // Hook finalizeEmitOutput to wrap state.setSlot calls with prints.
    var _origFinalizeState = globalThis.finalizeEmitOutput;
    globalThis.finalizeEmitOutput = function(out, file) {
      // Build slot name table from ctx
      var slotNames = [];
      if (ctx && ctx.stateSlots) {
        for (var i = 0; i < ctx.stateSlots.length; i++) {
          slotNames.push(ctx.stateSlots[i].getter || ('slot' + i));
        }
      }

      if (slotNames.length > 0) {
        // Insert slot name array before _appInit
        var initIdx = out.indexOf('fn _appInit()');
        if (initIdx !== -1) {
          var nameArray = '// ── Debug: state slot names (-s flag) ──\n';
          nameArray += 'const _dbg_slot_names = [_][]const u8{ ';
          nameArray += slotNames.map(function(n) { return '"' + n + '"'; }).join(', ');
          nameArray += ' };\n\n';
          out = out.substring(0, initIdx) + nameArray + out.substring(initIdx);
        }

        // Wrap state.setSlot(N, val) → print + set
        var setters = [
          { pat: 'state.setSlot(', getter: 'state.getSlot(', type: 'int', fmt: '{d}', cast: '' },
          { pat: 'state.setSlotFloat(', getter: 'state.getSlotFloat(', type: 'float', fmt: '{d:.2}', cast: '' },
          { pat: 'state.setSlotBool(', getter: 'state.getSlotBool(', type: 'bool', fmt: '{}', cast: '' },
        ];

        var lines = out.split('\n');
        var result = [];
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          var replaced = false;
          for (var si = 0; si < setters.length; si++) {
            var s = setters[si];
            var setIdx = line.indexOf(s.pat);
            if (setIdx === -1) continue;
            // Extract slot number: state.setSlot(N, ...)
            var afterParen = line.substring(setIdx + s.pat.length);
            var commaIdx = afterParen.indexOf(',');
            if (commaIdx === -1) continue;
            var slotStr = afterParen.substring(0, commaIdx).trim();
            var slotNum = parseInt(slotStr);
            if (isNaN(slotNum) || slotNum >= slotNames.length) continue;
            var indent = line.match(/^(\s*)/)[1];
            // Print before the set: "slot_name: old_val → new_val"
            result.push(indent + '{');
            result.push(indent + '    const _dbg_old = ' + s.getter + slotStr + ');');
            result.push(line); // the actual setSlot call
            result.push(indent + '    const _dbg_new = ' + s.getter + slotStr + ');');
            result.push(indent + '    std.debug.print("[state] {s}: ' + s.fmt + ' -> ' + s.fmt + '\\n", .{ _dbg_slot_names[' + slotStr + '], _dbg_old, _dbg_new });');
            result.push(indent + '}');
            replaced = true;
            break;
          }
          if (!replaced) result.push(line);
        }
        out = result.join('\n');
      }

      return _origFinalizeState(out, file);
    };

    __dgb('[DEBUG -s] State debug: print slot name + old/new on every state change');
  }

  // ================================================================
  // -c  COMPILER DEBUG: dump ctx after parse
  // ================================================================
  if (DBG_COMPILER) {
    // Hook finishParsedLane to dump ctx after the root parse completes.
    var _origFinishParsedLane = globalThis.finishParsedLane;
    if (typeof _origFinishParsedLane === 'function') {
      globalThis.finishParsedLane = function(nodeExpr, file, opts) {
        __dumpCtx('parse (before preflight)');
        return _origFinishParsedLane.call(this, nodeExpr, file, opts);
      };
    }

    __dgb('[DEBUG -c] Compiler debug: ctx dump after parse phase');
  }

})();
