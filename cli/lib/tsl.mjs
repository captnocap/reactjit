/**
 * tsl.mjs — TypeScript-to-Lua syntax translator
 *
 * Parses .tsl files using the TypeScript compiler API (syntax only, no type checker)
 * and emits idiomatic Lua. This is a 1:1 syntax translator — if Lua can't do it
 * natively, TSL can't either. No runtime helpers, no class emulation.
 *
 * Arrays are 1-indexed. Types are stripped. The output should look like Lua
 * a human would have written.
 */

import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
let ts;
try {
  ts = _require('typescript');
} catch {
  console.error('  typescript not found — install it: npm install -D typescript');
  process.exit(1);
}

// ── Error class ─────────────────────────────────────────────

export class TSLError extends Error {
  constructor(message, node, sourceFile) {
    const pos = sourceFile
      ? sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      : null;
    const loc = pos ? ` (line ${pos.line + 1}, col ${pos.character + 1})` : '';
    super(`${message}${loc}`);
    this.name = 'TSLError';
  }
}

// ── Main entry point ────────────────────────────────────────

/**
 * Transpile a TSL source string to Lua.
 * @param {string} source - TypeScript source code
 * @param {string} [fileName] - file name for error messages
 * @returns {string} Lua source code
 */
export function transpile(source, fileName = 'input.tsl') {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  const ctx = {
    sourceFile,
    indent: 0,
    exports: [],          // collected export names for module return
    usesStdlib: false,    // whether we need to require tsl_stdlib
    errors: [],
  };

  const lines = [];
  for (const stmt of sourceFile.statements) {
    const result = emitStatement(stmt, ctx);
    if (result !== null && result !== undefined) {
      lines.push(result);
    }
  }

  // Module return for exports
  if (ctx.exports.length > 0) {
    lines.push('');
    const pairs = ctx.exports.map(name => `  ${name} = ${name},`);
    lines.push(`return {\n${pairs.join('\n')}\n}`);
  }

  // Prepend stdlib require if any helpers were used
  let output = lines.join('\n');
  if (ctx.usesStdlib) {
    output = 'local __tsl = require("lua.tsl_stdlib")\n\n' + output;
  }

  if (ctx.errors.length > 0) {
    throw new TSLError(
      `${ctx.errors.length} error(s):\n  ${ctx.errors.join('\n  ')}`,
      sourceFile,
      null,
    );
  }

  return output.replace(/\n{3,}/g, '\n\n') + '\n';
}

// ── Indentation ─────────────────────────────────────────────

function indent(ctx) {
  return '  '.repeat(ctx.indent);
}

// ── Statement emitters ──────────────────────────────────────

function emitStatement(node, ctx) {
  // Extract and prepend leading comments
  const comments = getLeadingComments(node, ctx);
  const commentPrefix = comments.length > 0 ? comments.join('\n') + '\n' : '';

  const SK = ts.SyntaxKind;
  const body = emitStatementBody(node, ctx);
  if (body === null || body === undefined) {
    // For stripped nodes (types, interfaces), still emit their comments
    return commentPrefix ? commentPrefix.trimEnd() : null;
  }
  return commentPrefix + body;
}

function emitStatementBody(node, ctx) {
  const SK = ts.SyntaxKind;
  switch (node.kind) {
    case SK.VariableStatement:
      return emitVariableStatement(node, ctx);
    case SK.FunctionDeclaration:
      return emitFunctionDeclaration(node, ctx);
    case SK.ReturnStatement:
      return emitReturnStatement(node, ctx);
    case SK.IfStatement:
      return emitIfStatement(node, ctx);
    case SK.ForOfStatement:
      return emitForOfStatement(node, ctx);
    case SK.ForInStatement:
      return emitForInStatement(node, ctx);
    case SK.ForStatement:
      return emitForStatement(node, ctx);
    case SK.WhileStatement:
      return emitWhileStatement(node, ctx);
    case SK.DoStatement:
      return emitDoStatement(node, ctx);
    case SK.ExpressionStatement:
      return `${indent(ctx)}${emitExpression(node.expression, ctx)}`;
    case SK.Block:
      return emitBlock(node, ctx);
    case SK.BreakStatement:
      return `${indent(ctx)}break`;
    case SK.ContinueStatement:
      // LuaJIT supports goto — use it for continue
      if (!ctx._continueLabel) ctx._continueLabel = 0;
      return `${indent(ctx)}goto __continue__`;
    case SK.SwitchStatement:
      return emitSwitchStatement(node, ctx);
    case SK.TypeAliasDeclaration:
    case SK.InterfaceDeclaration:
    case SK.EnumDeclaration:
    case SK.ModuleDeclaration:
      // Type-only — strip
      return null;
    case SK.ImportDeclaration:
      return emitImportDeclaration(node, ctx);
    case SK.ExportDeclaration:
      return emitExportDeclaration(node, ctx);
    case SK.ClassDeclaration:
      return emitClassDeclaration(node, ctx);
    case SK.ThrowStatement:
      return `${indent(ctx)}error(${emitExpression(node.expression, ctx)})`;
    case SK.TryStatement:
      return emitTryStatement(node, ctx);
    case SK.EmptyStatement:
      return null;
    default:
      error(ctx, node, `Unsupported statement: ${SK[node.kind]}`);
      return `${indent(ctx)}-- unsupported: ${SK[node.kind]}`;
  }
}

function emitVariableStatement(node, ctx) {
  const isExport = hasModifier(node, ts.SyntaxKind.ExportKeyword);
  const lines = [];
  for (const decl of node.declarationList.declarations) {
    const result = emitVariableDeclaration(decl, ctx, isExport);
    if (result) lines.push(result);
  }
  return lines.join('\n');
}

function emitVariableDeclaration(decl, ctx, isExport) {
  const name = emitBindingName(decl.name, ctx);

  // Destructuring
  if (ts.isObjectBindingPattern(decl.name)) {
    return emitObjectDestructuring(decl, ctx, isExport);
  }
  if (ts.isArrayBindingPattern(decl.name)) {
    return emitArrayDestructuring(decl, ctx, isExport);
  }

  const init = decl.initializer ? emitExpression(decl.initializer, ctx) : 'nil';

  // Arrow function or function expression → local function
  if (decl.initializer && (
    ts.isArrowFunction(decl.initializer) ||
    ts.isFunctionExpression(decl.initializer)
  )) {
    const fn = decl.initializer;
    const params = fn.parameters.map(p => emitParameter(p, ctx)).join(', ');
    const body = emitFunctionBody(fn.body, ctx);
    if (isExport) ctx.exports.push(name);
    return `${indent(ctx)}local function ${name}(${params})\n${body}\n${indent(ctx)}end`;
  }

  if (isExport) ctx.exports.push(name);
  return `${indent(ctx)}local ${name} = ${init}`;
}

function emitObjectDestructuring(decl, ctx, isExport) {
  const init = decl.initializer ? emitExpression(decl.initializer, ctx) : 'nil';
  const tmpVar = `_tsl_tmp`;
  const lines = [`${indent(ctx)}local ${tmpVar} = ${init}`];
  for (const el of decl.name.elements) {
    if (ts.isOmittedExpression(el)) continue;
    const propName = el.propertyName
      ? el.propertyName.text
      : el.name.text;
    const localName = el.name.text;
    let line = `${indent(ctx)}local ${localName} = ${tmpVar}.${propName}`;
    if (el.initializer) {
      line = `${indent(ctx)}local ${localName} = ${tmpVar}.${propName}; if ${localName} == nil then ${localName} = ${emitExpression(el.initializer, ctx)} end`;
    }
    lines.push(line);
    if (isExport) ctx.exports.push(localName);
  }
  return lines.join('\n');
}

function emitArrayDestructuring(decl, ctx, isExport) {
  const init = decl.initializer ? emitExpression(decl.initializer, ctx) : 'nil';
  const tmpVar = `_tsl_tmp`;
  const lines = [`${indent(ctx)}local ${tmpVar} = ${init}`];
  for (let i = 0; i < decl.name.elements.length; i++) {
    const el = decl.name.elements[i];
    if (ts.isOmittedExpression(el)) continue;
    const localName = el.name.text;
    // 1-indexed
    lines.push(`${indent(ctx)}local ${localName} = ${tmpVar}[${i + 1}]`);
    if (isExport) ctx.exports.push(localName);
  }
  return lines.join('\n');
}

function emitFunctionDeclaration(node, ctx) {
  const isExport = hasModifier(node, ts.SyntaxKind.ExportKeyword);
  const isAsync = hasModifier(node, ts.SyntaxKind.AsyncKeyword);

  const name = node.name ? node.name.text : '_anonymous';
  const params = node.parameters.map(p => emitParameter(p, ctx)).join(', ');
  const body = emitFunctionBody(node.body, ctx);

  if (isExport) ctx.exports.push(name);

  if (isAsync) {
    // async function → wraps body in coroutine.wrap
    return `${indent(ctx)}local function ${name}(${params})\n${indent(ctx)}  return coroutine.wrap(function()\n${body}\n${indent(ctx)}  end)\n${indent(ctx)}end`;
  }

  return `${indent(ctx)}local function ${name}(${params})\n${body}\n${indent(ctx)}end`;
}

function emitParameter(param, ctx) {
  if (param.dotDotDotToken) {
    return '...';
  }
  return param.name.text || emitBindingName(param.name, ctx);
}

function emitFunctionBody(body, ctx) {
  if (!body) return '';

  // Expression body (arrow function): (x) => x + 1
  if (!ts.isBlock(body)) {
    ctx.indent++;
    const result = `${indent(ctx)}return ${emitExpression(body, ctx)}`;
    ctx.indent--;
    return result;
  }

  ctx.indent++;
  const lines = [];
  for (const stmt of body.statements) {
    const result = emitStatement(stmt, ctx);
    if (result !== null && result !== undefined) lines.push(result);
  }
  ctx.indent--;
  return lines.join('\n');
}

function emitReturnStatement(node, ctx) {
  if (!node.expression) return `${indent(ctx)}return`;
  return `${indent(ctx)}return ${emitExpression(node.expression, ctx)}`;
}

function emitIfStatement(node, ctx, isElseIf = false) {
  const keyword = isElseIf ? 'elseif' : 'if';
  const cond = emitExpression(node.expression, ctx);
  let result = `${indent(ctx)}${keyword} ${cond} then\n`;

  ctx.indent++;
  result += emitBlockBody(node.thenStatement, ctx);
  ctx.indent--;

  if (node.elseStatement) {
    if (ts.isIfStatement(node.elseStatement)) {
      result += '\n' + emitIfStatement(node.elseStatement, ctx, true);
    } else {
      result += `\n${indent(ctx)}else\n`;
      ctx.indent++;
      result += emitBlockBody(node.elseStatement, ctx);
      ctx.indent--;
    }
  }

  if (!isElseIf) {
    result += `\n${indent(ctx)}end`;
  }
  return result;
}

function emitForOfStatement(node, ctx) {
  const varName = node.initializer.declarations
    ? node.initializer.declarations[0].name.text
    : '_';
  const iterable = emitExpression(node.expression, ctx);
  let result = `${indent(ctx)}for _, ${varName} in ipairs(${iterable}) do\n`;
  ctx.indent++;
  result += emitBlockBody(node.statement, ctx);
  if (bodyUsesContinue(node.statement)) {
    result += `\n${indent(ctx)}::__continue__::`;
  }
  ctx.indent--;
  result += `\n${indent(ctx)}end`;
  return result;
}

function emitForInStatement(node, ctx) {
  const varName = node.initializer.declarations
    ? node.initializer.declarations[0].name.text
    : '_';
  const obj = emitExpression(node.expression, ctx);
  let result = `${indent(ctx)}for ${varName}, _ in pairs(${obj}) do\n`;
  ctx.indent++;
  result += emitBlockBody(node.statement, ctx);
  if (bodyUsesContinue(node.statement)) {
    result += `\n${indent(ctx)}::__continue__::`;
  }
  ctx.indent--;
  result += `\n${indent(ctx)}end`;
  return result;
}

function emitForStatement(node, ctx) {
  // Try to detect simple numeric for: for (let i = X; i < Y; i++) or i += step
  const numeric = tryNumericFor(node, ctx);
  if (numeric) return numeric;

  // General for → while loop
  let result = '';
  if (node.initializer) {
    if (ts.isVariableDeclarationList(node.initializer)) {
      for (const decl of node.initializer.declarations) {
        result += emitVariableDeclaration(decl, ctx, false) + '\n';
      }
    } else {
      result += `${indent(ctx)}${emitExpression(node.initializer, ctx)}\n`;
    }
  }
  const cond = node.condition ? emitExpression(node.condition, ctx) : 'true';
  result += `${indent(ctx)}while ${cond} do\n`;
  ctx.indent++;
  result += emitBlockBody(node.statement, ctx);
  if (bodyUsesContinue(node.statement)) {
    result += `\n${indent(ctx)}::__continue__::`;
  }
  if (node.incrementor) {
    result += `\n${indent(ctx)}${emitExpression(node.incrementor, ctx)}`;
  }
  ctx.indent--;
  result += `\n${indent(ctx)}end`;
  return result;
}

/** Check if a loop variable is used as an array index (e.g. arr[i]) in the subtree. */
function bodyUsesVarAsArrayIndex(node, varName) {
  if (!node) return false;
  if (ts.isElementAccessExpression(node)) {
    if (ts.isIdentifier(node.argumentExpression) && node.argumentExpression.text === varName) {
      return true;
    }
  }
  let found = false;
  ts.forEachChild(node, child => {
    if (bodyUsesVarAsArrayIndex(child, varName)) found = true;
  });
  return found;
}

function tryNumericFor(node, ctx) {
  if (!node.initializer || !ts.isVariableDeclarationList(node.initializer)) return null;
  const decls = node.initializer.declarations;
  if (decls.length !== 1) return null;
  const decl = decls[0];
  if (!ts.isIdentifier(decl.name) || !decl.initializer) return null;

  const varName = decl.name.text;
  const start = emitExpression(decl.initializer, ctx);

  // Condition: i < N, i <= N, i > N, i >= N
  if (!node.condition || !ts.isBinaryExpression(node.condition)) return null;
  const condLeft = node.condition.left;
  const condRight = node.condition.right;
  if (!ts.isIdentifier(condLeft) || condLeft.text !== varName) return null;

  const op = node.condition.operatorToken.kind;
  // Detect if loop variable is used as an array index (arr[i]) — if so,
  // adjust start +1 and limit +1 to convert from JS 0-based to Lua 1-based.
  const isArrayIndex = bodyUsesVarAsArrayIndex(node.statement, varName);
  let limit;
  if (op === ts.SyntaxKind.LessThanToken) {
    // JS: i < N  →  Lua: i <= N-1  (or i <= N when +1 adjustment cancels the -1)
    limit = isArrayIndex ? emitExpression(condRight, ctx) : `${emitExpression(condRight, ctx)} - 1`;
  } else if (op === ts.SyntaxKind.LessThanEqualsToken) {
    limit = isArrayIndex ? `${emitExpression(condRight, ctx)} + 1` : emitExpression(condRight, ctx);
  } else if (op === ts.SyntaxKind.GreaterThanToken) {
    limit = isArrayIndex ? `${emitExpression(condRight, ctx)}` : `${emitExpression(condRight, ctx)} + 1`;
  } else if (op === ts.SyntaxKind.GreaterThanEqualsToken) {
    limit = isArrayIndex ? `${emitExpression(condRight, ctx)} + 1` : emitExpression(condRight, ctx);
  } else {
    return null;
  }

  // Incrementor: i++, i--, i += step, i -= step
  let step = null;
  const isCountDown = op === ts.SyntaxKind.GreaterThanToken || op === ts.SyntaxKind.GreaterThanEqualsToken;
  if (node.incrementor) {
    const inc = node.incrementor;
    if (ts.isPostfixUnaryExpression(inc) || ts.isPrefixUnaryExpression(inc)) {
      const incOp = inc.operator;
      if (incOp === ts.SyntaxKind.PlusPlusToken) {
        step = null; // default step 1
      } else if (incOp === ts.SyntaxKind.MinusMinusToken) {
        step = '-1';
      } else {
        return null;
      }
    } else if (ts.isBinaryExpression(inc)) {
      if (inc.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) {
        step = emitExpression(inc.right, ctx);
        if (step === '1') step = null;
      } else if (inc.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken) {
        step = `-${emitExpression(inc.right, ctx)}`;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  // If counting down with default step, add -1
  if (isCountDown && !step) step = '-1';

  // Adjust start for 0→1 indexing when loop var is used as array index
  const adjustedStart = isArrayIndex ? (start === '0' ? '1' : `${start} + 1`) : start;

  const stepStr = step ? `, ${step}` : '';
  let result = `${indent(ctx)}for ${varName} = ${adjustedStart}, ${limit}${stepStr} do\n`;
  ctx.indent++;
  result += emitBlockBody(node.statement, ctx);
  if (bodyUsesContinue(node.statement)) {
    result += `\n${indent(ctx)}::__continue__::`;
  }
  ctx.indent--;
  result += `\n${indent(ctx)}end`;
  return result;
}

function emitWhileStatement(node, ctx) {
  const SK = ts.SyntaxKind;
  const expr = node.expression;

  // Detect while (x = expr) pattern — JS assigns in condition, Lua can't
  // Also handles while (x = expr) !== null patterns via ParenthesizedExpression
  const innerExpr = expr.kind === SK.ParenthesizedExpression ? expr.expression : expr;
  if (innerExpr.kind === SK.BinaryExpression &&
      innerExpr.operatorToken.kind === SK.EqualsToken) {
    const varName = emitExpression(innerExpr.left, ctx);
    const value = emitExpression(innerExpr.right, ctx);
    let result = `${indent(ctx)}${varName} = ${value}\n`;
    result += `${indent(ctx)}while ${varName} do\n`;
    ctx.indent++;
    result += emitBlockBody(node.statement, ctx);
    // Re-assign at end of loop body for next iteration
    result += `\n${indent(ctx)}${varName} = ${value}`;
    if (bodyUsesContinue(node.statement)) {
      result += `\n${indent(ctx)}::__continue__::`;
    }
    ctx.indent--;
    result += `\n${indent(ctx)}end`;
    return result;
  }

  const cond = emitExpression(expr, ctx);
  let result = `${indent(ctx)}while ${cond} do\n`;
  ctx.indent++;
  result += emitBlockBody(node.statement, ctx);
  if (bodyUsesContinue(node.statement)) {
    result += `\n${indent(ctx)}::__continue__::`;
  }
  ctx.indent--;
  result += `\n${indent(ctx)}end`;
  return result;
}

function emitDoStatement(node, ctx) {
  let result = `${indent(ctx)}repeat\n`;
  ctx.indent++;
  result += emitBlockBody(node.statement, ctx);
  ctx.indent--;
  const cond = emitExpression(node.expression, ctx);
  result += `\n${indent(ctx)}until not (${cond})`;
  return result;
}

function emitSwitchStatement(node, ctx) {
  const SK = ts.SyntaxKind;
  const expr = emitExpression(node.expression, ctx);
  const lines = [];
  const tempVar = `_sw`;
  lines.push(`${indent(ctx)}local ${tempVar} = ${expr}`);

  let first = true;
  for (const clause of node.caseBlock.clauses) {
    if (clause.kind === SK.DefaultClause) {
      lines.push(`${indent(ctx)}else`);
    } else {
      const test = emitExpression(clause.expression, ctx);
      lines.push(`${indent(ctx)}${first ? 'if' : 'elseif'} ${tempVar} == ${test} then`);
      first = false;
    }
    ctx.indent++;
    for (const stmt of clause.statements) {
      // Skip break statements in switch cases — they don't translate to Lua if/elseif
      if (stmt.kind === SK.BreakStatement) continue;
      const result = emitStatement(stmt, ctx);
      if (result !== null && result !== undefined) lines.push(result);
    }
    ctx.indent--;
  }
  lines.push(`${indent(ctx)}end`);
  return lines.join('\n');
}

function emitClassDeclaration(node, ctx) {
  const SK = ts.SyntaxKind;
  const name = node.name ? node.name.text : '_AnonymousClass';
  const isExport = hasModifier(node, SK.ExportKeyword);
  const lines = [];

  // Create the class table and metatable
  lines.push(`${indent(ctx)}local ${name} = {}`);
  lines.push(`${indent(ctx)}${name}.__index = ${name}`);

  // Handle extends
  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      if (clause.token === SK.ExtendsKeyword && clause.types.length > 0) {
        const base = emitExpression(clause.types[0].expression, ctx);
        lines.push(`${indent(ctx)}setmetatable(${name}, { __index = ${base} })`);
      }
    }
  }

  // Process members
  for (const member of node.members) {
    if (member.kind === SK.Constructor) {
      // Constructor → ClassName.new(...)
      lines.push('');
      const params = member.parameters
        .filter(p => !isTypeOnlyParam(p))
        .map(p => emitBindingName(p.name, ctx));
      lines.push(`${indent(ctx)}function ${name}.new(${params.join(', ')})`);
      ctx.indent++;
      lines.push(`${indent(ctx)}local self = setmetatable({}, ${name})`);

      // Handle parameter properties (public/private/protected params that auto-assign)
      for (const p of member.parameters) {
        if (hasModifier(p, SK.PublicKeyword) || hasModifier(p, SK.PrivateKeyword) || hasModifier(p, SK.ProtectedKeyword) || hasModifier(p, SK.ReadonlyKeyword)) {
          const pName = emitBindingName(p.name, ctx);
          lines.push(`${indent(ctx)}self.${pName} = ${pName}`);
        }
      }

      if (member.body) {
        // Emit constructor body, replacing 'this' references
        const bodyCtx = { ...ctx, classThis: 'self' };
        for (const stmt of member.body.statements) {
          const result = emitStatement(stmt, bodyCtx);
          if (result !== null && result !== undefined) lines.push(result);
        }
      }
      lines.push(`${indent(ctx)}return self`);
      ctx.indent--;
      lines.push(`${indent(ctx)}end`);
    } else if (member.kind === SK.MethodDeclaration) {
      lines.push('');
      const methodName = member.name.text || emitExpression(member.name, ctx);
      const params = member.parameters
        .filter(p => !isTypeOnlyParam(p))
        .map(p => emitBindingName(p.name, ctx));
      const isStatic = hasModifier(member, SK.StaticKeyword);
      const sep = isStatic ? '.' : ':';
      lines.push(`${indent(ctx)}function ${name}${sep}${methodName}(${params.join(', ')})`);
      ctx.indent++;
      if (member.body) {
        const bodyCtx = { ...ctx, classThis: isStatic ? name : 'self' };
        for (const stmt of member.body.statements) {
          const result = emitStatement(stmt, bodyCtx);
          if (result !== null && result !== undefined) lines.push(result);
        }
      }
      ctx.indent--;
      lines.push(`${indent(ctx)}end`);
    } else if (member.kind === SK.PropertyDeclaration) {
      // Static properties get assigned directly, instance properties handled in constructor
      if (hasModifier(member, SK.StaticKeyword) && member.initializer) {
        const propName = member.name.text || emitExpression(member.name, ctx);
        lines.push(`${indent(ctx)}${name}.${propName} = ${emitExpression(member.initializer, ctx)}`);
      }
      // Instance properties with initializers should ideally be in constructor
      // but we skip them here — they'll be set via this.x = ... in the constructor body
    } else if (member.kind === SK.GetAccessor) {
      // Getter — emit as a regular method (Lua doesn't have native getters)
      const propName = member.name.text || emitExpression(member.name, ctx);
      lines.push('');
      lines.push(`${indent(ctx)}function ${name}:get_${propName}()`);
      ctx.indent++;
      if (member.body) {
        const bodyCtx = { ...ctx, classThis: 'self' };
        for (const stmt of member.body.statements) {
          const result = emitStatement(stmt, bodyCtx);
          if (result !== null && result !== undefined) lines.push(result);
        }
      }
      ctx.indent--;
      lines.push(`${indent(ctx)}end`);
    } else if (member.kind === SK.SetAccessor) {
      const propName = member.name.text || emitExpression(member.name, ctx);
      const params = member.parameters.map(p => emitBindingName(p.name, ctx));
      lines.push('');
      lines.push(`${indent(ctx)}function ${name}:set_${propName}(${params.join(', ')})`);
      ctx.indent++;
      if (member.body) {
        const bodyCtx = { ...ctx, classThis: 'self' };
        for (const stmt of member.body.statements) {
          const result = emitStatement(stmt, bodyCtx);
          if (result !== null && result !== undefined) lines.push(result);
        }
      }
      ctx.indent--;
      lines.push(`${indent(ctx)}end`);
    }
    // Skip other member types (index signatures, etc.)
  }

  if (isExport) {
    ctx.exports.push(name);
  }

  return lines.join('\n');
}

function isTypeOnlyParam(param) {
  // Parameters that are purely type annotations (this: Type)
  return param.name && param.name.text === 'this';
}

function emitBlock(node, ctx) {
  const lines = [];
  for (const stmt of node.statements) {
    const result = emitStatement(stmt, ctx);
    if (result !== null && result !== undefined) lines.push(result);
  }
  return lines.join('\n');
}

function emitBlockBody(node, ctx) {
  if (ts.isBlock(node)) {
    const lines = [];
    for (const stmt of node.statements) {
      const result = emitStatement(stmt, ctx);
      if (result !== null && result !== undefined) lines.push(result);
    }
    return lines.join('\n');
  }
  // Single statement (no braces)
  return emitStatement(node, ctx);
}

function emitImportDeclaration(node, ctx) {
  const moduleSpec = node.moduleSpecifier.text;
  const clause = node.importClause;

  // Resolve relative imports (./foo, ../foo) to Lua module paths
  let luaModule = moduleSpec;
  if (moduleSpec.startsWith('./') || moduleSpec.startsWith('../')) {
    // Resolve relative to the source file's directory
    const sourceDir = ctx.sourceFile.fileName.replace(/\/[^/]+$/, '');
    const parts = sourceDir.split('/').filter(Boolean);
    const relParts = moduleSpec.split('/');
    for (const p of relParts) {
      if (p === '.') continue;
      if (p === '..') { parts.pop(); continue; }
      parts.push(p);
    }
    luaModule = parts.join('.');
  } else {
    // Convert / to . for non-relative paths
    luaModule = moduleSpec.replace(/\//g, '.');
  }

  if (!clause) {
    // Side-effect import: import "foo" → require("foo")
    return `${indent(ctx)}require("${luaModule}")`;
  }

  const lines = [];
  const moduleName = sanitizeModuleName(moduleSpec);

  if (clause.namedBindings) {
    if (ts.isNamedImports(clause.namedBindings)) {
      // import { a, b } from "foo"
      lines.push(`${indent(ctx)}local ${moduleName} = require("${luaModule}")`);
      for (const el of clause.namedBindings.elements) {
        const imported = (el.propertyName || el.name).text;
        const local = el.name.text;
        lines.push(`${indent(ctx)}local ${local} = ${moduleName}.${imported}`);
      }
    } else if (ts.isNamespaceImport(clause.namedBindings)) {
      // import * as foo from "bar"
      const name = clause.namedBindings.name.text;
      lines.push(`${indent(ctx)}local ${name} = require("${luaModule}")`);
    }
  }

  if (clause.name) {
    // import foo from "bar" (default import)
    lines.push(`${indent(ctx)}local ${clause.name.text} = require("${luaModule}")`);
  }

  return lines.join('\n');
}

function emitExportDeclaration(node, ctx) {
  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    for (const el of node.exportClause.elements) {
      ctx.exports.push(el.name.text);
    }
  }
  return null;
}

// ── Expression emitters ─────────────────────────────────────

function emitExpression(node, ctx) {
  const SK = ts.SyntaxKind;
  switch (node.kind) {
    case SK.Identifier:
      return emitIdentifier(node, ctx);
    case SK.NumericLiteral:
      return node.text;
    case SK.StringLiteral:
      return `"${escapeString(node.text)}"`;
    case SK.NoSubstitutionTemplateLiteral:
      return `"${escapeString(node.text)}"`;
    case SK.TemplateExpression:
      return emitTemplateLiteral(node, ctx);
    case SK.TrueKeyword:
      return 'true';
    case SK.FalseKeyword:
      return 'false';
    case SK.NullKeyword:
    case SK.UndefinedKeyword:
      return 'nil';
    case SK.ThisKeyword:
      return ctx.classThis || 'self';
    case SK.SuperKeyword:
      // super → call parent class method via metatable
      return ctx.classThis ? `getmetatable(${ctx.classThis}).__index` : 'self.__super';
    case SK.ImportKeyword:
      // Dynamic import() — emit as require() (best-effort)
      return 'require';
    case SK.BinaryExpression:
      return emitBinaryExpression(node, ctx);
    case SK.PrefixUnaryExpression:
      return emitPrefixUnary(node, ctx);
    case SK.PostfixUnaryExpression:
      return emitPostfixUnary(node, ctx);
    case SK.CallExpression:
      return emitCallExpression(node, ctx);
    case SK.PropertyAccessExpression:
      return emitPropertyAccess(node, ctx);
    case SK.ElementAccessExpression:
      return emitElementAccess(node, ctx);
    case SK.ObjectLiteralExpression:
      return emitObjectLiteral(node, ctx);
    case SK.ArrayLiteralExpression:
      return emitArrayLiteral(node, ctx);
    case SK.ArrowFunction:
    case SK.FunctionExpression:
      return emitFunctionExpression(node, ctx);
    case SK.ParenthesizedExpression:
      return `(${emitExpression(node.expression, ctx)})`;
    case SK.ConditionalExpression:
      return emitConditionalExpression(node, ctx);
    case SK.TypeOfExpression:
      return `type(${emitExpression(node.expression, ctx)})`;
    case SK.SpreadElement:
      return `unpack(${emitExpression(node.expression, ctx)})`;
    case SK.AsExpression:
    case SK.TypeAssertionExpression:
    case SK.SatisfiesExpression:
      // Type assertion / satisfies — strip, emit inner expression
      return emitExpression(node.expression, ctx);
    case SK.NonNullExpression:
      // x! — strip, emit inner
      return emitExpression(node.expression, ctx);
    case SK.VoidExpression:
      return 'nil';
    case SK.DeleteExpression:
      return `${emitExpression(node.expression, ctx)} = nil`;
    case SK.AwaitExpression:
      // await expr → coroutine.yield(expr)
      return `coroutine.yield(${emitExpression(node.expression, ctx)})`;
    case SK.YieldExpression:
      error(ctx, node, 'TSL does not support yield/generators.');
      return 'nil';
    case SK.NewExpression:
      return emitNewExpression(node, ctx);
    case SK.RegularExpressionLiteral:
      return emitRegExpLiteral(node, ctx);
    case SK.CommaToken:
      return ', ';
    default:
      error(ctx, node, `Unsupported expression: ${SK[node.kind]}`);
      return `nil --[[ unsupported: ${SK[node.kind]} ]]`;
  }
}

function emitIdentifier(node, ctx) {
  const name = node.text;
  // Map JS globals to Lua equivalents
  switch (name) {
    case 'undefined': return 'nil';
    case 'Infinity': return 'math.huge';
    case 'NaN': return '0/0';
    case 'parseInt': return 'tonumber';
    case 'parseFloat': return 'tonumber';
    case 'Number': return 'tonumber';
    case 'String': return 'tostring';
    // isNaN/isFinite handled in call expression emitter
    default: return name;
  }
}

function looksLikeString(node) {
  const SK = ts.SyntaxKind;
  if (!node) return false;
  // String literal: "hello", 'world'
  if (node.kind === SK.StringLiteral) return true;
  // Template literal: `hello ${x}`
  if (node.kind === SK.TemplateExpression || node.kind === SK.NoSubstitutionTemplateLiteral) return true;
  // String method calls: x.toLowerCase(), x.trim(), etc.
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const method = node.expression.name.text;
    const stringMethods = ['toLowerCase', 'toUpperCase', 'trim', 'trimStart', 'trimEnd',
      'replace', 'replaceAll', 'slice', 'substring', 'substr', 'charAt', 'repeat',
      'padStart', 'padEnd', 'split', 'join', 'toString', 'toFixed'];
    if (stringMethods.includes(method)) return true;
  }
  // Property access on known string-returning props
  if (ts.isPropertyAccessExpression(node)) {
    const prop = node.name.text;
    if (['name', 'title', 'description', 'text', 'label', 'message', 'type',
         'id', 'url', 'href', 'src', 'className', 'tag', 'key', 'value'].includes(prop)) return true;
  }
  // Element access on a string-like variable: formula[i], str[0], name[idx]
  if (ts.isElementAccessExpression(node)) {
    return looksLikeString(node.expression);
  }
  // Identifier with string-like names: str, formula, sym, char, text, etc.
  if (ts.isIdentifier(node)) {
    const name = node.text.toLowerCase();
    const stringNames = ['str', 'string', 'formula', 'sym', 'symbol', 'char', 'c',
      'text', 'line', 'word', 'name', 'prefix', 'suffix', 'input', 'output',
      'result', 'buf', 'buffer', 'countstr', 'numstr'];
    if (stringNames.includes(name)) return true;
  }
  // Recursive: if either side of another + looks like string, this chain is string
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === SK.PlusToken) {
    return looksLikeString(node.left) || looksLikeString(node.right);
  }
  // Comparison with string literal: c >= "A" implies c is a string
  if (ts.isBinaryExpression(node)) {
    const cmpOps = [SK.GreaterThanEqualsToken, SK.LessThanEqualsToken,
      SK.GreaterThanToken, SK.LessThanToken, SK.EqualsEqualsEqualsToken,
      SK.EqualsEqualsToken, SK.ExclamationEqualsEqualsToken, SK.ExclamationEqualsToken];
    if (cmpOps.includes(node.operatorToken.kind)) {
      if (looksLikeString(node.left) || looksLikeString(node.right)) return true;
    }
  }
  return false;
}

function emitBinaryExpression(node, ctx) {
  const SK = ts.SyntaxKind;
  const op = node.operatorToken.kind;

  // String concatenation: + with string operand
  if (op === SK.PlusToken) {
    // Heuristic: if either operand is a string literal, template literal,
    // or a call that likely returns a string, use .. for concatenation
    if (looksLikeString(node.left) || looksLikeString(node.right)) {
      const left = emitExpression(node.left, ctx);
      const right = emitExpression(node.right, ctx);
      return `${left} .. ${right}`;
    }
  }

  // Assignment operators
  if (op === SK.EqualsToken) {
    ctx._isAssignmentTarget = true;
    const left = emitExpression(node.left, ctx);
    delete ctx._isAssignmentTarget;
    const right = emitExpression(node.right, ctx);
    return `${left} = ${right}`;
  }

  // instanceof → type check (best-effort: checks metatable or type string)
  if (op === SK.InstanceOfKeyword) {
    const lhs = emitExpression(node.left, ctx);
    return `(type(${lhs}) == "table")`;
  }

  // String += → ..
  if (op === SK.PlusEqualsToken && (looksLikeString(node.left) || looksLikeString(node.right))) {
    ctx._isAssignmentTarget = true;
    const left = emitExpression(node.left, ctx);
    delete ctx._isAssignmentTarget;
    const right = emitExpression(node.right, ctx);
    return `${left} = ${left} .. ${right}`;
  }

  // Compound assignments
  const compoundOps = {
    [SK.PlusEqualsToken]: '+',
    [SK.MinusEqualsToken]: '-',
    [SK.AsteriskEqualsToken]: '*',
    [SK.SlashEqualsToken]: '/',
    [SK.PercentEqualsToken]: '%',
    [SK.AsteriskAsteriskEqualsToken]: '^',
  };

  // Bitwise compound assignments → bit library
  const bitwiseCompoundOps = {
    [SK.BarEqualsToken]: 'bit.bor',
    [SK.AmpersandEqualsToken]: 'bit.band',
    [SK.CaretEqualsToken]: 'bit.bxor',
  };
  if (bitwiseCompoundOps[op]) {
    ctx._isAssignmentTarget = true;
    const left = emitExpression(node.left, ctx);
    delete ctx._isAssignmentTarget;
    const right = emitExpression(node.right, ctx);
    return `${left} = ${bitwiseCompoundOps[op]}(${left}, ${right})`;
  }

  if (compoundOps[op]) {
    ctx._isAssignmentTarget = true;
    const left = emitExpression(node.left, ctx);
    delete ctx._isAssignmentTarget;
    const right = emitExpression(node.right, ctx);
    return `${left} = ${left} ${compoundOps[op]} ${right}`;
  }

  // Nullish coalescing: x ?? y → (function() local _v = x; if _v ~= nil then return _v end; return y end)()
  // Simpler: use inline form when possible
  if (op === SK.QuestionQuestionToken) {
    const left = emitExpression(node.left, ctx);
    const right = emitExpression(node.right, ctx);
    // Simple case: if left is a simple expression, use inline
    if (isSimpleExpression(node.left)) {
      return `(${left} ~= nil and ${left} or ${right})`;
    }
    // Complex: use do-end block with temp
    return `(function() local _v = ${left}; if _v ~= nil then return _v end; return ${right} end)()`;
  }

  const left = emitExpression(node.left, ctx);
  const right = emitExpression(node.right, ctx);

  const opMap = {
    [SK.EqualsEqualsToken]: '==',
    [SK.EqualsEqualsEqualsToken]: '==',
    [SK.ExclamationEqualsToken]: '~=',
    [SK.ExclamationEqualsEqualsToken]: '~=',
    [SK.AmpersandAmpersandToken]: 'and',
    [SK.BarBarToken]: 'or',
    [SK.LessThanToken]: '<',
    [SK.LessThanEqualsToken]: '<=',
    [SK.GreaterThanToken]: '>',
    [SK.GreaterThanEqualsToken]: '>=',
    [SK.PlusToken]: '+',
    [SK.MinusToken]: '-',
    [SK.AsteriskToken]: '*',
    [SK.SlashToken]: '/',
    [SK.PercentToken]: '%',
    [SK.AsteriskAsteriskToken]: '^',
  };

  // "key in obj" → obj[key] ~= nil
  if (op === SK.InKeyword) {
    return `${right}[${left}] ~= nil`;
  }

  const luaOp = opMap[op];
  if (luaOp) {
    return `${left} ${luaOp} ${right}`;
  }

  // Bitwise operators (Lua 5.1/LuaJIT: use bit module)
  const bitOps = {
    [SK.AmpersandToken]: 'bit.band',
    [SK.BarToken]: 'bit.bor',
    [SK.CaretToken]: 'bit.bxor',
    [SK.LessThanLessThanToken]: 'bit.lshift',
    [SK.GreaterThanGreaterThanToken]: 'bit.arshift',
    [SK.GreaterThanGreaterThanGreaterThanToken]: 'bit.rshift',
  };
  if (bitOps[op]) {
    return `${bitOps[op]}(${left}, ${right})`;
  }

  error(ctx, node, `Unsupported operator: ${SK[op]}`);
  return `${left} --[[??]] ${right}`;
}

function emitPrefixUnary(node, ctx) {
  const SK = ts.SyntaxKind;
  const operand = emitExpression(node.operand, ctx);
  switch (node.operator) {
    case SK.ExclamationToken:
      return `not ${operand}`;
    case SK.MinusToken:
      return `-${operand}`;
    case SK.PlusToken:
      return `tonumber(${operand})`;
    case SK.TildeToken:
      return `bit.bnot(${operand})`;
    case SK.PlusPlusToken:
      return `${operand} = ${operand} + 1`;
    case SK.MinusMinusToken:
      return `${operand} = ${operand} - 1`;
    default:
      return operand;
  }
}

function emitPostfixUnary(node, ctx) {
  const SK = ts.SyntaxKind;
  const operand = emitExpression(node.operand, ctx);
  switch (node.operator) {
    case SK.PlusPlusToken:
      return `${operand} = ${operand} + 1`;
    case SK.MinusMinusToken:
      return `${operand} = ${operand} - 1`;
    default:
      return operand;
  }
}

function emitCallExpression(node, ctx) {
  // Check for known method transforms first
  if (ts.isPropertyAccessExpression(node.expression)) {
    const methodResult = emitMethodCall(node, ctx);
    if (methodResult !== null) return methodResult;
  }

  // Standalone global function mappings
  if (ts.isIdentifier(node.expression)) {
    const name = node.expression.text;
    const fnArgs = node.arguments.map(a => emitExpression(a, ctx));
    if (name === 'isNaN') return `(${fnArgs[0]} ~= ${fnArgs[0]})`;
    if (name === 'isFinite') return `(${fnArgs[0]} == ${fnArgs[0]} and ${fnArgs[0]} ~= math.huge and ${fnArgs[0]} ~= -math.huge)`;
    if (name === 'setTimeout' || name === 'setInterval') {
      // Best-effort: emit as a comment + the callback
      return `--[[ ${name} ]] ${fnArgs[0]}`;
    }
  }

  const callee = emitExpression(node.expression, ctx);
  const args = node.arguments.map(a => emitExpression(a, ctx)).join(', ');
  return `${callee}(${args})`;
}

/**
 * Handle known method call transformations.
 * Returns null if the method is not a known transform (caller falls through to generic call).
 */
function emitMethodCall(node, ctx) {
  const prop = node.expression;
  const methodName = prop.name.text;
  const obj = emitExpression(prop.expression, ctx);
  const args = node.arguments.map(a => emitExpression(a, ctx));

  // console.log → print
  if (ts.isIdentifier(prop.expression) && prop.expression.text === 'console') {
    if (methodName === 'log' || methodName === 'warn' || methodName === 'error') {
      return `print(${args.join(', ')})`;
    }
  }

  // Math methods
  if (ts.isIdentifier(prop.expression) && prop.expression.text === 'Math') {
    const mathMap = {
      floor: 'math.floor', ceil: 'math.ceil', round: 'math.floor', // round needs +0.5
      abs: 'math.abs', sqrt: 'math.sqrt', pow: 'math.pow',
      min: 'math.min', max: 'math.max',
      sin: 'math.sin', cos: 'math.cos', tan: 'math.tan',
      asin: 'math.asin', acos: 'math.acos', atan: 'math.atan',
      atan2: 'math.atan2', log: 'math.log', exp: 'math.exp',
      random: 'math.random',
    };
    if (mathMap[methodName]) {
      if (methodName === 'round') {
        return `math.floor(${args[0]} + 0.5)`;
      }
      return `${mathMap[methodName]}(${args.join(', ')})`;
    }
  }

  // Array methods
  switch (methodName) {
    case 'push':
      return `table.insert(${obj}, ${args[0]})`;
    case 'pop':
      return `table.remove(${obj})`;
    case 'unshift':
      return `table.insert(${obj}, 1, ${args[0]})`;
    case 'shift':
      return `table.remove(${obj}, 1)`;
    case 'concat':
      // table concat: simple merge
      ctx.usesStdlib = true;
      return `__tsl.merge(${obj}, ${args.join(', ')})`;
    case 'indexOf':
      ctx.usesStdlib = true;
      return `__tsl.indexOf(${obj}, ${args[0]})`;
    case 'includes':
      return `(string.find(${obj}, ${args[0]}, 1, true) ~= nil)`;
    case 'slice':
      if (args.length === 0) return `{unpack(${obj})}`;
      if (args.length === 1) return `{unpack(${obj}, ${args[0]})}`;
      return `{unpack(${obj}, ${args[0]}, ${args[1]})}`;
    case 'join':
      return `table.concat(${obj}, ${args[0] || '","'})`;
    case 'sort':
      if (args.length > 0) return `table.sort(${obj}, ${args[0]})`;
      return `table.sort(${obj})`;
    case 'reverse':
      ctx.usesStdlib = true;
      return `__tsl.reverse(${obj})`;
    case 'forEach':
      ctx.usesStdlib = true;
      return `__tsl.forEach(${obj}, ${args[0]})`;
    case 'map':
      ctx.usesStdlib = true;
      return `__tsl.map(${obj}, ${args[0]})`;
    case 'filter':
      ctx.usesStdlib = true;
      return `__tsl.filter(${obj}, ${args[0]})`;
    case 'find':
      ctx.usesStdlib = true;
      return `__tsl.find(${obj}, ${args[0]})`;
    case 'findIndex':
      ctx.usesStdlib = true;
      return `__tsl.findIndex(${obj}, ${args[0]})`;
    case 'some':
      ctx.usesStdlib = true;
      return `__tsl.some(${obj}, ${args[0]})`;
    case 'every':
      ctx.usesStdlib = true;
      return `__tsl.every(${obj}, ${args[0]})`;
    case 'reduce':
      ctx.usesStdlib = true;
      if (args.length > 1) return `__tsl.reduce(${obj}, ${args[0]}, ${args[1]})`;
      return `__tsl.reduce(${obj}, ${args[0]})`;
    case 'flat':
      ctx.usesStdlib = true;
      return `__tsl.flat(${obj})`;
    case 'flatMap':
      ctx.usesStdlib = true;
      return `__tsl.flatMap(${obj}, ${args[0]})`;
    case 'fill':
      ctx.usesStdlib = true;
      // Detect new Array(n).fill(v) → __tsl.arrayFill(n, v)
      if (ts.isNewExpression(prop.expression) &&
          ts.isIdentifier(prop.expression.expression) &&
          prop.expression.expression.text === 'Array' &&
          prop.expression.arguments && prop.expression.arguments.length === 1) {
        const size = emitExpression(prop.expression.arguments[0], ctx);
        return `__tsl.arrayFill(${size}, ${args.join(', ')})`;
      }
      return `__tsl.fill(${obj}, ${args.join(', ')})`;
    case 'keys':
      // Array.keys() → numeric iterator, but for table use __tsl.keys
      ctx.usesStdlib = true;
      return `__tsl.keys(${obj})`;
    case 'entries':
      ctx.usesStdlib = true;
      return `__tsl.entries(${obj})`;
    case 'splice':
      return `table.remove(${obj}, ${args[0]} + 1)`;
  }

  // String methods
  switch (methodName) {
    case 'toUpperCase':
      return `string.upper(${obj})`;
    case 'toLowerCase':
      return `string.lower(${obj})`;
    case 'trim':
      return `${obj}:match("^%s*(.-)%s*$")`;
    case 'trimStart':
      return `${obj}:match("^%s*(.*)")`;
    case 'trimEnd':
      return `${obj}:match("(.-)%s*$")`;
    case 'startsWith':
      return `(string.sub(${obj}, 1, #${args[0]}) == ${args[0]})`;
    case 'endsWith':
      return `(string.sub(${obj}, -#${args[0]}) == ${args[0]})`;
    case 'repeat':
      return `string.rep(${obj}, ${args[0]})`;
    case 'charAt':
      return `string.sub(${obj}, ${args[0]} + 1, ${args[0]} + 1)`;
    case 'charCodeAt':
      return `string.byte(${obj}, ${args[0]} + 1)`;
    case 'split':
      ctx.usesStdlib = true;
      return `__tsl.split(${obj}, ${args[0]})`;
    case 'replace':
      return `string.gsub(${obj}, ${args[0]}, ${args[1]})`;
    case 'substring':
    case 'slice':
      if (args.length === 1) return `string.sub(${obj}, ${args[0]} + 1)`;
      return `string.sub(${obj}, ${args[0]} + 1, ${args[1]})`;
    case 'toString':
      return `tostring(${obj})`;
  }

  // Number.parseInt / Number.parseFloat / Number.isNaN / Number.isFinite
  if (ts.isIdentifier(prop.expression) && prop.expression.text === 'Number') {
    switch (methodName) {
      case 'parseInt': return `tonumber(${args[0]})`;
      case 'parseFloat': return `tonumber(${args[0]})`;
      case 'isNaN': return `(${args[0]} ~= ${args[0]})`;
      case 'isFinite': return `(${args[0]} == ${args[0]} and ${args[0]} ~= math.huge and ${args[0]} ~= -math.huge)`;
    }
  }

  // JSON.stringify / JSON.parse
  if (ts.isIdentifier(prop.expression) && prop.expression.text === 'JSON') {
    switch (methodName) {
      case 'stringify': {
        ctx.usesStdlib = true;
        return `__tsl.jsonEncode(${args.join(', ')})`;
      }
      case 'parse': {
        ctx.usesStdlib = true;
        return `__tsl.jsonDecode(${args[0]})`;
      }
    }
  }

  // .exec() on regex → string.match (single match, not iterator)
  if (methodName === 'exec') {
    return `{string.match(${args[0]}, ${obj})}`;
  }

  // .test() on regex → string.find
  if (methodName === 'test') {
    return `(string.find(${args[0]}, ${obj}) ~= nil)`;
  }

  // .match() → string.match
  if (methodName === 'match') {
    return `string.match(${obj}, ${args[0]})`;
  }

  // .padStart / .padEnd
  if (methodName === 'padStart') {
    ctx.usesStdlib = true;
    return `__tsl.padStart(${obj}, ${args.join(', ')})`;
  }
  if (methodName === 'padEnd') {
    ctx.usesStdlib = true;
    return `__tsl.padEnd(${obj}, ${args.join(', ')})`;
  }

  // .toFixed
  if (methodName === 'toFixed') {
    return `string.format("%." .. ${args[0]} .. "f", ${obj})`;
  }

  // .toString with radix
  if (methodName === 'toString' && args.length === 1) {
    // n.toString(16) → string.format("%x", n)
    if (args[0] === '16') return `string.format("%x", ${obj})`;
    return `tostring(${obj})`;
  }

  // String.fromCharCode → string.char
  if (ts.isIdentifier(prop.expression) && prop.expression.text === 'String') {
    if (methodName === 'fromCharCode') return `string.char(${args.join(', ')})`;
  }

  // Array.from / Array.isArray
  if (ts.isIdentifier(prop.expression) && prop.expression.text === 'Array') {
    if (methodName === 'isArray') return `(type(${args[0]}) == "table")`;
    if (methodName === 'from') {
      ctx.usesStdlib = true;
      return `__tsl.arrayFrom(${args.join(', ')})`;
    }
  }

  // .replaceAll → string.gsub (gsub replaces all by default)
  if (methodName === 'replaceAll') {
    return `string.gsub(${obj}, ${args[0]}, ${args[1]})`;
  }

  // Object.keys / Object.values / Object.entries
  if (ts.isIdentifier(prop.expression) && prop.expression.text === 'Object') {
    switch (methodName) {
      case 'keys':
        ctx.usesStdlib = true;
        return `__tsl.keys(${args[0]})`;
      case 'values':
        ctx.usesStdlib = true;
        return `__tsl.values(${args[0]})`;
      case 'entries':
        ctx.usesStdlib = true;
        return `__tsl.entries(${args[0]})`;
      case 'assign':
        ctx.usesStdlib = true;
        return `__tsl.merge(${args.join(', ')})`;
    }
  }

  // Not a known method — fall through
  return null;
}

function emitPropertyAccess(node, ctx) {
  const obj = emitExpression(node.expression, ctx);
  const prop = node.name.text;

  // Math constants
  if (ts.isIdentifier(node.expression) && node.expression.text === 'Math') {
    const mathConsts = {
      PI: 'math.pi', E: 'math.exp(1)', SQRT2: 'math.sqrt(2)',
      LN2: 'math.log(2)', LN10: 'math.log(10)',
      LOG2E: '1/math.log(2)', LOG10E: '1/math.log(10)',
    };
    if (mathConsts[prop]) return mathConsts[prop];
  }

  // .length → #obj
  if (prop === 'length') {
    return `#${obj}`;
  }

  // .lastIndex — RegExp state, no-op in Lua (patterns are stateless)
  // When assigned (re.lastIndex = 0), the statement emitter handles it
  if (prop === 'lastIndex') {
    return `0 --[[ ${obj}.lastIndex ]]`;
  }

  // .prototype — strip
  if (prop === 'prototype') {
    return obj;
  }

  // Optional chaining is handled by the parent node type check
  if (node.questionDotToken) {
    return `(${obj} and ${obj}.${prop})`;
  }

  return `${obj}.${prop}`;
}

function emitElementAccess(node, ctx) {
  const obj = emitExpression(node.expression, ctx);
  const index = emitExpression(node.argumentExpression, ctx);

  // String character access: str[i] → string.sub(str, i+1, i+1)
  // But NEVER when this is an assignment target (LHS of =), since string.sub() can't be assigned to
  if (looksLikeString(node.expression) && !ctx._isAssignmentTarget) {
    if (ts.isNumericLiteral(node.argumentExpression)) {
      const num = parseInt(node.argumentExpression.text, 10);
      return `string.sub(${obj}, ${num + 1}, ${num + 1})`;
    }
    return `string.sub(${obj}, ${index} + 1, ${index} + 1)`;
  }

  // Auto-adjust 0-indexed access to 1-indexed
  if (ts.isNumericLiteral(node.argumentExpression)) {
    const num = parseInt(node.argumentExpression.text, 10);
    if (!isNaN(num)) {
      // Optional chaining
      if (node.questionDotToken) {
        return `(${obj} and ${obj}[${num + 1}])`;
      }
      return `${obj}[${num + 1}]`;
    }
  }

  // Optional chaining
  if (node.questionDotToken) {
    return `(${obj} and ${obj}[${index}])`;
  }

  return `${obj}[${index}]`;
}

function emitObjectLiteral(node, ctx) {
  if (node.properties.length === 0) return '{}';

  // Check for spread properties
  const hasSpread = node.properties.some(p => ts.isSpreadAssignment(p));
  if (hasSpread) {
    ctx.usesStdlib = true;
    const parts = [];
    for (const prop of node.properties) {
      if (ts.isSpreadAssignment(prop)) {
        parts.push(emitExpression(prop.expression, ctx));
      } else {
        // Wrap non-spread properties in an inline table
        parts.push(`{ ${emitObjectProperty(prop, ctx)} }`);
      }
    }
    return `__tsl.merge(${parts.join(', ')})`;
  }

  const props = node.properties.map(p => emitObjectProperty(p, ctx));
  if (props.length <= 3 && props.every(p => p.length < 30)) {
    return `{ ${props.join(', ')} }`;
  }
  ctx.indent++;
  const inner = props.map(p => `${indent(ctx)}${p},`).join('\n');
  ctx.indent--;
  return `{\n${inner}\n${indent(ctx)}}`;
}

function emitObjectProperty(prop, ctx) {
  if (ts.isShorthandPropertyAssignment(prop)) {
    return `${prop.name.text} = ${prop.name.text}`;
  }
  if (ts.isPropertyAssignment(prop)) {
    const key = ts.isComputedPropertyName(prop.name)
      ? `[${emitExpression(prop.name.expression, ctx)}]`
      : ts.isStringLiteral(prop.name)
        ? `["${escapeString(prop.name.text)}"]`
        : prop.name.text;
    const val = emitExpression(prop.initializer, ctx);
    return `${key} = ${val}`;
  }
  if (ts.isMethodDeclaration(prop)) {
    const name = prop.name.text;
    const params = prop.parameters.map(p => emitParameter(p, ctx)).join(', ');
    const body = emitFunctionBody(prop.body, ctx);
    return `${name} = function(${params})\n${body}\n${indent(ctx)}end`;
  }
  if (ts.isSpreadAssignment(prop)) {
    // Handled by parent
    return '';
  }
  return `--[[ unsupported property ]]`;
}

function emitArrayLiteral(node, ctx) {
  if (node.elements.length === 0) return '{}';
  const elements = node.elements.map(e => emitExpression(e, ctx));
  if (elements.length <= 5 && elements.every(e => e.length < 20)) {
    return `{${elements.join(', ')}}`;
  }
  ctx.indent++;
  const inner = elements.map(e => `${indent(ctx)}${e},`).join('\n');
  ctx.indent--;
  return `{\n${inner}\n${indent(ctx)}}`;
}

function emitFunctionExpression(node, ctx) {
  const params = node.parameters.map(p => emitParameter(p, ctx)).join(', ');

  if (node.body && !ts.isBlock(node.body)) {
    // Expression body: (x) => x + 1
    const expr = emitExpression(node.body, ctx);
    return `function(${params}) return ${expr} end`;
  }

  const body = emitFunctionBody(node.body, ctx);
  return `function(${params})\n${body}\n${indent(ctx)}end`;
}

function emitConditionalExpression(node, ctx) {
  const cond = emitExpression(node.condition, ctx);
  const whenTrue = emitExpression(node.whenTrue, ctx);
  const whenFalse = emitExpression(node.whenFalse, ctx);
  // Lua ternary idiom (safe when whenTrue is never false/nil)
  return `(${cond} and ${whenTrue} or ${whenFalse})`;
}

function emitTemplateLiteral(node, ctx) {
  const parts = [];
  // head
  if (node.head.text) {
    parts.push(`"${escapeString(node.head.text)}"`);
  }
  for (const span of node.templateSpans) {
    const expr = emitExpression(span.expression, ctx);
    // Wrap non-string expressions in tostring
    parts.push(`tostring(${expr})`);
    if (span.literal.text) {
      parts.push(`"${escapeString(span.literal.text)}"`);
    }
  }
  return parts.join(' .. ');
}

// ── Helpers ─────────────────────────────────────────────────

/** Check if a loop body contains a continue statement (direct children only, not nested loops). */
function bodyUsesContinue(node) {
  if (!node) return false;
  function walk(n) {
    if (n.kind === ts.SyntaxKind.ContinueStatement) return true;
    // Don't recurse into nested loops — their continues are their own
    if (n.kind === ts.SyntaxKind.ForStatement ||
        n.kind === ts.SyntaxKind.ForOfStatement ||
        n.kind === ts.SyntaxKind.ForInStatement ||
        n.kind === ts.SyntaxKind.WhileStatement ||
        n.kind === ts.SyntaxKind.DoStatement) return false;
    return ts.forEachChild(n, walk) || false;
  }
  return walk(node);
}

function emitBindingName(name, ctx) {
  if (ts.isIdentifier(name)) return name.text;
  return '_destructured';
}

function hasModifier(node, kind) {
  if (!node.modifiers) return false;
  return node.modifiers.some(m => m.kind === kind);
}

function isSimpleExpression(node) {
  return ts.isIdentifier(node) ||
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    node.kind === ts.SyntaxKind.UndefinedKeyword ||
    ts.isNumericLiteral(node) ||
    ts.isStringLiteral(node);
}

let _moduleCounter = 0;
function sanitizeModuleName(spec) {
  // "lua.effects" → "lua_effects", "foo/bar-baz" → "foo_bar_baz"
  // Use the full path to avoid collisions
  const sanitized = spec.replace(/[^a-zA-Z0-9_]/g, '_');
  return `_mod_${sanitized}`;
}

function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function error(ctx, node, message) {
  const pos = ctx.sourceFile.getLineAndCharacterOfPosition(node.getStart(ctx.sourceFile));
  ctx.errors.push(`line ${pos.line + 1}: ${message}`);
}

// ── try/catch → pcall ───────────────────────────────────────

function emitTryStatement(node, ctx) {
  const tryBody = emitFunctionBody(node.tryBlock, ctx);
  let result = '';

  if (node.catchClause) {
    const errVar = node.catchClause.variableDeclaration
      ? node.catchClause.variableDeclaration.name.text
      : '_err';
    const catchBody = emitFunctionBody(node.catchClause.block, ctx);
    result += `${indent(ctx)}local _ok, ${errVar} = pcall(function()\n${tryBody}\n${indent(ctx)}end)\n`;
    result += `${indent(ctx)}if not _ok then\n${catchBody}\n${indent(ctx)}end`;
  } else {
    result += `${indent(ctx)}pcall(function()\n${tryBody}\n${indent(ctx)}end)`;
  }

  if (node.finallyBlock) {
    const finallyBody = emitFunctionBody(node.finallyBlock, ctx);
    result += `\n${indent(ctx)}-- finally\n${finallyBody}`;
  }

  return result;
}

// ── new X(...) → X.new(...) or X(...) ──────────────────────

function emitNewExpression(node, ctx) {
  const callee = emitExpression(node.expression, ctx);
  const args = node.arguments ? node.arguments.map(a => emitExpression(a, ctx)).join(', ') : '';

  // Known JS built-ins that map to Lua equivalents
  const knownBuiltins = {
    'Map': '{}',
    'Set': '{}',
    'Object': '{}',
    'Array': '{}',
    'Error': null,   // new Error("msg") → error("msg")
    'Date': null,     // new Date() → os.time()
    'Uint8Array': null,
    'TextEncoder': null,
    'TextDecoder': null,
  };

  if (callee in knownBuiltins) {
    if (callee === 'Error') return `error(${args})`;
    if (callee === 'Date') return args ? `os.time()` : `os.time()`;
    if (callee === 'Uint8Array') return `{${args}}`;
    if (callee === 'TextEncoder' || callee === 'TextDecoder') {
      // TextEncoder/TextDecoder don't exist in Lua — return a stub table
      return '{}';
    }
    const val = knownBuiltins[callee];
    if (val) return val;
  }

  // General case: new Foo(args) → Foo.new(args) (matches our class emitter)
  return `${callee}.new(${args})`;
}

// ── RegExp literal → Lua pattern string ─────────────────────

function emitRegExpLiteral(node, ctx) {
  // /pattern/flags → "pattern" (best-effort conversion to Lua pattern)
  const text = node.text; // e.g. /^[0-9a-fA-F]{6}$/
  const match = text.match(/^\/(.*?)\/([gimsuy]*)$/);
  if (!match) return `"${escapeString(text)}"`;

  let pattern = match[1];
  // Convert common regex features to Lua patterns (best-effort)
  // \d → %d, \s → %s, \w → %w, \b → %%b (word boundary doesn't exist but %b is close enough)
  pattern = pattern.replace(/\\d/g, '%d');
  pattern = pattern.replace(/\\s/g, '%s');
  pattern = pattern.replace(/\\w/g, '%w');
  pattern = pattern.replace(/\\D/g, '%D');
  pattern = pattern.replace(/\\S/g, '%S');
  pattern = pattern.replace(/\\W/g, '%W');
  // [a-z] style classes pass through (Lua supports them)
  // ^ and $ anchors work the same in Lua patterns
  // {6} quantifiers don't exist in Lua — leave as-is for now (user can fix)

  return `"${escapeString(pattern)}"`;
}

// ── Comment extraction ──────────────────────────────────────

function getLeadingComments(node, ctx) {
  const fullText = ctx.sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!ranges) return [];

  return ranges.map(r => {
    const text = fullText.slice(r.pos, r.end);
    if (text.startsWith('//')) {
      const content = text.slice(2);
      return `${indent(ctx)}--${content}`;
    }
    if (text.startsWith('/*')) {
      const inner = text.slice(2, -2).trim();
      return `${indent(ctx)}--[[ ${inner} ]]`;
    }
    return '';
  });
}
