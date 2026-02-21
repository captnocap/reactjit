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
    usesSpread: false,    // whether we need the table merge helper
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

  // Prepend spread helper if needed
  let output = lines.join('\n');
  if (ctx.usesSpread) {
    const helper = [
      'local function __tsl_merge(...)',
      '  local result = {}',
      '  for i = 1, select("#", ...) do',
      '    local t = select(i, ...)',
      '    if t then',
      '      for k, v in pairs(t) do',
      '        result[k] = v',
      '      end',
      '    end',
      '  end',
      '  return result',
      'end',
      '',
    ].join('\n');
    output = helper + output;
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
      // Lua has no continue — this is a known limitation
      error(ctx, node, 'TSL does not support "continue". Restructure your loop or use a guard condition.');
      return `${indent(ctx)}-- continue (unsupported)`;
    case SK.TypeAliasDeclaration:
    case SK.InterfaceDeclaration:
    case SK.EnumDeclaration:
      // Type-only — strip
      return null;
    case SK.ImportDeclaration:
      return emitImportDeclaration(node, ctx);
    case SK.ExportDeclaration:
      return emitExportDeclaration(node, ctx);
    case SK.ClassDeclaration:
      error(ctx, node, 'TSL does not support classes. Use tables and functions.');
      return null;
    case SK.ThrowStatement:
      return `${indent(ctx)}error(${emitExpression(node.expression, ctx)})`;
    case SK.TryStatement:
      error(ctx, node, 'TSL does not support try/catch. Use pcall() directly in Lua if needed.');
      return null;
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
  if (isAsync) {
    error(ctx, node, 'TSL does not support async functions.');
    return null;
  }

  const name = node.name ? node.name.text : '_anonymous';
  const params = node.parameters.map(p => emitParameter(p, ctx)).join(', ');
  const body = emitFunctionBody(node.body, ctx);

  if (isExport) ctx.exports.push(name);
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
  if (node.incrementor) {
    result += `\n${indent(ctx)}${emitExpression(node.incrementor, ctx)}`;
  }
  ctx.indent--;
  result += `\n${indent(ctx)}end`;
  return result;
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
  let limit;
  if (op === ts.SyntaxKind.LessThanToken) {
    limit = `${emitExpression(condRight, ctx)} - 1`;
  } else if (op === ts.SyntaxKind.LessThanEqualsToken) {
    limit = emitExpression(condRight, ctx);
  } else if (op === ts.SyntaxKind.GreaterThanToken) {
    limit = `${emitExpression(condRight, ctx)} + 1`;
  } else if (op === ts.SyntaxKind.GreaterThanEqualsToken) {
    limit = emitExpression(condRight, ctx);
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

  const stepStr = step ? `, ${step}` : '';
  let result = `${indent(ctx)}for ${varName} = ${start}, ${limit}${stepStr} do\n`;
  ctx.indent++;
  result += emitBlockBody(node.statement, ctx);
  ctx.indent--;
  result += `\n${indent(ctx)}end`;
  return result;
}

function emitWhileStatement(node, ctx) {
  const cond = emitExpression(node.expression, ctx);
  let result = `${indent(ctx)}while ${cond} do\n`;
  ctx.indent++;
  result += emitBlockBody(node.statement, ctx);
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
  if (!clause) {
    // Side-effect import: import "foo" → require("foo")
    return `${indent(ctx)}require("${moduleSpec}")`;
  }

  const lines = [];
  const moduleName = sanitizeModuleName(moduleSpec);

  if (clause.namedBindings) {
    if (ts.isNamedImports(clause.namedBindings)) {
      // import { a, b } from "foo"
      lines.push(`${indent(ctx)}local ${moduleName} = require("${moduleSpec}")`);
      for (const el of clause.namedBindings.elements) {
        const imported = (el.propertyName || el.name).text;
        const local = el.name.text;
        lines.push(`${indent(ctx)}local ${local} = ${moduleName}.${imported}`);
      }
    } else if (ts.isNamespaceImport(clause.namedBindings)) {
      // import * as foo from "bar"
      const name = clause.namedBindings.name.text;
      lines.push(`${indent(ctx)}local ${name} = require("${moduleSpec}")`);
    }
  }

  if (clause.name) {
    // import foo from "bar" (default import)
    lines.push(`${indent(ctx)}local ${clause.name.text} = require("${moduleSpec}")`);
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
      // Type assertion — strip, emit inner expression
      return emitExpression(node.expression, ctx);
    case SK.NonNullExpression:
      // x! — strip, emit inner
      return emitExpression(node.expression, ctx);
    case SK.VoidExpression:
      return 'nil';
    case SK.DeleteExpression:
      return `${emitExpression(node.expression, ctx)} = nil`;
    case SK.AwaitExpression:
      error(ctx, node, 'TSL does not support await.');
      return emitExpression(node.expression, ctx);
    case SK.YieldExpression:
      error(ctx, node, 'TSL does not support yield/generators.');
      return 'nil';
    case SK.NewExpression:
      error(ctx, node, 'TSL does not support "new". Use table constructors.');
      return 'nil';
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
    default: return name;
  }
}

function emitBinaryExpression(node, ctx) {
  const SK = ts.SyntaxKind;
  const op = node.operatorToken.kind;

  // String concatenation: + with string operand
  if (op === SK.PlusToken) {
    // We can't reliably detect string concat without type info,
    // but we can handle template-driven cases. Regular + stays as +.
  }

  // Assignment operators
  if (op === SK.EqualsToken) {
    const left = emitExpression(node.left, ctx);
    const right = emitExpression(node.right, ctx);
    return `${left} = ${right}`;
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
  if (compoundOps[op]) {
    const left = emitExpression(node.left, ctx);
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
      ctx.usesSpread = true;
      return `__tsl_merge(${obj}, ${args.join(', ')})`;
    case 'indexOf': {
      // Could be string or array — check context, default to generic search
      // For strings: string.find; for arrays: linear scan
      // Without type info, emit a helper comment
      return `__tsl_indexOf(${obj}, ${args[0]})`;
    }
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
    case 'reverse': {
      // In-place reverse — no direct Lua equivalent, but common enough
      return `__tsl_reverse(${obj})`;
    }
    case 'forEach':
      // arr.forEach(fn) → for _, v in ipairs(arr) do fn(v) end
      // This is an expression context, so we can't easily emit a for loop.
      // Return a helper call.
      return `__tsl_forEach(${obj}, ${args[0]})`;
    case 'map':
      return `__tsl_map(${obj}, ${args[0]})`;
    case 'filter':
      return `__tsl_filter(${obj}, ${args[0]})`;
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
      return `__tsl_split(${obj}, ${args[0]})`;
    case 'replace':
      return `string.gsub(${obj}, ${args[0]}, ${args[1]})`;
    case 'substring':
    case 'slice':
      if (args.length === 1) return `string.sub(${obj}, ${args[0]} + 1)`;
      return `string.sub(${obj}, ${args[0]} + 1, ${args[1]})`;
    case 'toString':
      return `tostring(${obj})`;
  }

  // Object.keys / Object.values / Object.entries
  if (ts.isIdentifier(prop.expression) && prop.expression.text === 'Object') {
    switch (methodName) {
      case 'keys':
        return `__tsl_keys(${args[0]})`;
      case 'values':
        return `__tsl_values(${args[0]})`;
      case 'entries':
        return `__tsl_entries(${args[0]})`;
      case 'assign':
        ctx.usesSpread = true;
        return `__tsl_merge(${args.join(', ')})`;
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

  // Optional chaining is handled by the parent node type check
  if (node.questionDotToken) {
    return `(${obj} and ${obj}.${prop})`;
  }

  return `${obj}.${prop}`;
}

function emitElementAccess(node, ctx) {
  const obj = emitExpression(node.expression, ctx);
  const index = emitExpression(node.argumentExpression, ctx);

  // Check for literal 0 index — error
  if (ts.isNumericLiteral(node.argumentExpression) && node.argumentExpression.text === '0') {
    error(ctx, node, 'TSL arrays are 1-indexed. Use arr[1] for the first element.');
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
    ctx.usesSpread = true;
    const parts = [];
    for (const prop of node.properties) {
      if (ts.isSpreadAssignment(prop)) {
        parts.push(emitExpression(prop.expression, ctx));
      } else {
        // Wrap non-spread properties in an inline table
        parts.push(`{ ${emitObjectProperty(prop, ctx)} }`);
      }
    }
    return `__tsl_merge(${parts.join(', ')})`;
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
