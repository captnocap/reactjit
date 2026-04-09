// ── Handler parser (from attrs.js) ──

function _condPropValue(pv) {
  if (typeof pv !== 'string') return '1'; // JSX slot objects are always truthy
  if (/^-?\d+(\.\d+)?$/.test(pv)) return pv; // numeric literal
  if (pv.startsWith('if (')) return '(' + pv + ')'; // Zig if-else needs parens for correct precedence
  if (pv.startsWith('state.') || pv.startsWith('_oa') || pv.startsWith('@as(') || pv.startsWith('@intCast(')) return pv; // Zig expression
  if (pv.startsWith('_handler_press_')) return '1'; // handler ref = truthy
  // String literal — non-empty means truthy (1), empty means falsy (0)
  return pv.length > 0 ? '1' : '0';
}

function slotSet(slotIdx) {
  const s = ctx.stateSlots[slotIdx];
  if (s.type === 'float') return `state.setSlotFloat`;
  if (s.type === 'boolean') return `state.setSlotBool`;
  if (s.type === 'string') return `state.setSlotString`;
  return `state.setSlot`;
}

function parseHandler(c) {
  // Skip (params) =>
  if (c.kind() === TK.lparen) {
    c.advance();
    while (c.kind() !== TK.rparen && c.kind() !== TK.eof) c.advance();
    if (c.kind() === TK.rparen) c.advance();
  }
  if (c.kind() === TK.arrow) c.advance();

  // Parse body — could be { stmts } or single expression
  let body = '';
  if (c.kind() === TK.lbrace) {
    // Block body: { stmt; stmt; stmt; }
    c.advance();
    let body = '';
    while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier && isSetter(c.text())) {
        // Delegate setter calls to JS so the JS variable AND Zig slot both update.
        // Direct Zig slot writes (state.setSlot) bypass the JS variable, causing
        // desync when JS logic later reads the variable (e.g. goNext checks `name`).
        const setter = c.text();
        c.advance();
        let args = '';
        if (c.kind() === TK.lparen) {
          c.advance();
          let depth = 1;
          while (c.kind() !== TK.eof && depth > 0) {
            if (c.kind() === TK.lparen) depth++;
            else if (c.kind() === TK.rparen) { depth--; if (depth === 0) { c.advance(); break; } }
            args += c.text();
            c.advance();
          }
        }
        args = args.trim();
        if (args.length === 0) {
          body += `    qjs_runtime.callGlobal("${setter}");\n`;
        } else {
          const strMatch = args.match(/^'([^']*)'$/) || args.match(/^"([^"]*)"$/);
          if (strMatch) {
            var _strVal = strMatch[1].replace(/"/g, '\\"');
            body += `    qjs_runtime.callGlobalStr("${setter}", "${_strVal}");\n`;
          } else if (/^-?\d+$/.test(args)) {
            body += `    qjs_runtime.callGlobalInt("${setter}", ${args});\n`;
          } else {
            const jsCall = `${setter}(${args.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, '\\"')})`;
            body += `    qjs_runtime.evalExpr("${jsCall}");\n`;
          }
        }
      } else if (c.kind() === TK.identifier && c.text() === 'setVariant') {
        c.advance();
        if (c.kind() === TK.lparen) {
          c.advance();
          const val = c.text(); c.advance();
          if (c.kind() === TK.rparen) c.advance();
          body += globalThis.__fastBuild === 1
            ? `    api.theme.rjit_theme_set_variant(${val});\n`
            : `    @import("framework/theme.zig").setVariant(${val});\n`;
        }
      } else if (c.kind() === TK.identifier && isScriptFunc(c.text())) {
        const fname = c.text();
        c.advance();
        let args = '';
        if (c.kind() === TK.lparen) {
          c.advance();
          let depth = 1;
          while (c.kind() !== TK.eof && depth > 0) {
            if (c.kind() === TK.lparen) depth++;
            else if (c.kind() === TK.rparen) { depth--; if (depth === 0) { c.advance(); break; } }
            args += c.text();
            c.advance();
          }
        }
        args = args.trim();
        if (args.length === 0) {
          body += `    qjs_runtime.callGlobal("${fname}");\n`;
        } else {
          // Single string arg: 'value' → callGlobalStr (avoids single-quote lint)
          const strMatch = args.match(/^'([^']*)'$/) || args.match(/^"([^"]*)"$/);
          if (strMatch) {
            var _strVal = strMatch[1].replace(/"/g, '\\"');
            body += `    qjs_runtime.callGlobalStr("${fname}", "${_strVal}");\n`;
          } else if (/^-?\d+$/.test(args)) {
            body += `    qjs_runtime.callGlobalInt("${fname}", ${args});\n`;
          } else {
            const jsCall = `${fname}(${args.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, '\\"')})`;
            body += `    qjs_runtime.evalExpr("${jsCall}");\n`;
          }
        }
      }
      if (c.kind() === TK.semicolon) c.advance();
      else if (c.kind() !== TK.rbrace) c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    return body;
  }

  // Single expression: setVariant(N)
  if (c.kind() === TK.identifier && c.text() === 'setVariant') {
    c.advance();
    if (c.kind() === TK.lparen) {
      c.advance();
      const val = c.text(); c.advance();
      if (c.kind() === TK.rparen) c.advance();
      body = `    @import("framework/theme.zig").setVariant(${val});\n`;
    }
    return body;
  }
  // Single expression: setCount(expr) — delegate to JS (same reason as block body)
  if (c.kind() === TK.identifier && isSetter(c.text())) {
    const setter = c.text();
    c.advance();
    let args = '';
    if (c.kind() === TK.lparen) {
      c.advance();
      let depth = 1;
      while (c.kind() !== TK.eof && depth > 0) {
        if (c.kind() === TK.lparen) depth++;
        else if (c.kind() === TK.rparen) { depth--; if (depth === 0) { c.advance(); break; } }
        args += c.text();
        c.advance();
      }
    }
    args = args.trim();
    if (args.length === 0) {
      body = `    qjs_runtime.callGlobal("${setter}");\n`;
    } else {
      const strMatch = args.match(/^'([^']*)'$/) || args.match(/^"([^"]*)"$/);
      if (strMatch) {
        var _strVal2 = strMatch[1].replace(/"/g, '\\"');
        body = `    qjs_runtime.callGlobalStr("${setter}", "${_strVal2}");\n`;
      } else if (/^-?\d+$/.test(args)) {
        body = `    qjs_runtime.callGlobalInt("${setter}", ${args});\n`;
      } else {
        const jsCall = `${setter}(${args.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, '\\"')})`;
        body = `    qjs_runtime.evalExpr("${jsCall}");\n`;
      }
    }
  }
  return body;
}
