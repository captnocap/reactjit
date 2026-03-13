#!/usr/bin/env node
/**
 * tsz compiler — Phase 3 proof of concept
 *
 * Takes a .tsz file (TypeScript + JSX targeting Zig) and produces
 * a native binary via the ReactJIT Zig engine.
 *
 * Pipeline: .tsz → TypeScript parser → AST → Zig codegen → zig build → binary
 *
 * Usage:
 *   node compiler.mjs build input.tsz
 *   node compiler.mjs run input.tsz
 */

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ── Color helper ────────────────────────────────────────────────────────────

function parseColor(value) {
  if (typeof value === 'string') {
    // Hex color: #RRGGBB or #RGB
    const hex = value.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `Color.rgb(${r}, ${g}, ${b})`;
    }
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `Color.rgb(${r}, ${g}, ${b})`;
    }
  }
  return null;
}

// ── Style prop → Zig field mapping ──────────────────────────────────────────

const STYLE_MAP = {
  width: 'width',
  height: 'height',
  minWidth: 'min_width',
  maxWidth: 'max_width',
  minHeight: 'min_height',
  maxHeight: 'max_height',
  flexGrow: 'flex_grow',
  flexShrink: 'flex_shrink',
  flexBasis: 'flex_basis',
  gap: 'gap',
  padding: 'padding',
  paddingLeft: 'padding_left',
  paddingRight: 'padding_right',
  paddingTop: 'padding_top',
  paddingBottom: 'padding_bottom',
  margin: 'margin',
  marginLeft: 'margin_left',
  marginRight: 'margin_right',
  marginTop: 'margin_top',
  marginBottom: 'margin_bottom',
  borderRadius: 'border_radius',
};

const ENUM_MAP = {
  flexDirection: { field: 'flex_direction', values: { row: '.row', column: '.column' } },
  justifyContent: {
    field: 'justify_content',
    values: { start: '.start', center: '.center', end: '.end_', 'space-between': '.space_between', 'space-around': '.space_around', 'space-evenly': '.space_evenly' },
  },
  alignItems: {
    field: 'align_items',
    values: { start: '.start', center: '.center', end: '.end_', stretch: '.stretch' },
  },
  display: { field: 'display', values: { flex: '.flex', none: '.none' } },
};

// ── Primitives — these are native Zig nodes, not user components ─────────

const PRIMITIVES = new Set(['Box', 'Text', 'Image', 'Pressable', 'ScrollView', 'TextInput']);

// ── AST → Zig codegen ──────────────────────────────────────────────────────

class TszCompiler {
  constructor(sourceFile, inputFilePath) {
    this.sf = sourceFile;
    this.inputFilePath = inputFilePath;
    this.nodeArrays = []; // collected var arrays for the generated main()
    this.arrayCounter = 0;
    this.handlerCounter = 0; // for generating unique handler function names
    this.handlerFunctions = []; // collected Zig fn declarations for event handlers
    this.components = new Map(); // name → { node, sf } for all known components
    // ── State tracking ───────────────────────────────────────────────
    this.stateSlots = [];        // [{ getter: 'count', setter: 'setCount', initial: 0, slotId: 0 }]
    this.stateBindings = new Map(); // getter name → slot ID
    this.setterBindings = new Map(); // setter name → slot ID
    this.hasState = false;
    this.dynamicTextCounter = 0; // for unique buf names in template literals
    // ── FFI tracking ─────────────────────────────────────────────────
    this.ffiHeaders = [];         // ['time.h', 'sqlite3.h']
    this.ffiLibs = [];            // ['sqlite3']
    this.ffiFunctions = new Map(); // name → { params: [{name, type}], returnType }
  }

  /** Compile a .tsz source file to a complete Zig source string. */
  compile() {
    // Phase 1: Resolve imports from other .tsz files
    this.resolveImports(this.sf, this.inputFilePath);

    // Phase 2: Collect all function components in this file
    this.collectComponents(this.sf);

    // Phase 3: Find root component — named "App", or the last function
    let rootComponent = null;
    ts.forEachChild(this.sf, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        if (node.name.text === 'App') rootComponent = node;
      }
    });
    // Fallback: last function declaration
    if (!rootComponent) {
      ts.forEachChild(this.sf, (node) => {
        if (ts.isFunctionDeclaration(node) && node.name) {
          rootComponent = node;
        }
      });
    }

    if (!rootComponent) {
      throw new Error('No component function found in .tsz file');
    }

    // Phase 4: Collect useState() calls from root component
    this.collectStateHooks(rootComponent);

    // Phase 5: Collect FFI pragmas and declare function statements
    this.collectFFI(this.sf);

    // Find the return statement with JSX
    const returnStmt = this.findReturn(rootComponent.body);
    if (!returnStmt || !returnStmt.expression) {
      throw new Error('Component must return JSX');
    }

    // Generate the node tree from JSX (no prop scope for root)
    const { zigExpr, arrays } = this.emitJSX(returnStmt.expression, null, null);

    // Build complete Zig source
    return this.buildZigSource(arrays, zigExpr);
  }

  /** Collect all function declarations as components from a source file. */
  collectComponents(sourceFile) {
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = node.name.text;
        // Only collect uppercase (component) names
        if (name[0] === name[0].toUpperCase()) {
          this.components.set(name, { node, sf: sourceFile });
        }
      }
    });
  }

  /**
   * Scan a component function body for useState() calls.
   * Pattern: const [getter, setter] = useState(initialValue)
   * Allocates compile-time slot IDs and records bindings.
   */
  collectStateHooks(funcNode) {
    if (!funcNode.body || !funcNode.body.statements) return;

    for (const stmt of funcNode.body.statements) {
      if (!ts.isVariableStatement(stmt)) continue;

      for (const decl of stmt.declarationList.declarations) {
        // Check for: const [x, setX] = useState(N)
        if (!decl.initializer || !ts.isCallExpression(decl.initializer)) continue;
        const callee = decl.initializer.expression;
        if (!ts.isIdentifier(callee) || callee.text !== 'useState') continue;

        // Must be array destructuring: [getter, setter]
        if (!decl.name || !ts.isArrayBindingPattern(decl.name)) continue;
        const elements = decl.name.elements;
        if (elements.length < 2) continue;

        const getter = elements[0].name.text;
        const setter = elements[1].name.text;

        // Extract initial value
        let initial = 0;
        if (decl.initializer.arguments.length > 0) {
          const arg = decl.initializer.arguments[0];
          if (ts.isNumericLiteral(arg)) {
            initial = parseFloat(arg.text);
          } else if (ts.isPrefixUnaryExpression(arg) && arg.operator === ts.SyntaxKind.MinusToken) {
            if (ts.isNumericLiteral(arg.operand)) {
              initial = -parseFloat(arg.operand.text);
            }
          } else if (arg.kind === ts.SyntaxKind.TrueKeyword) {
            initial = 1; // bool true
          } else if (arg.kind === ts.SyntaxKind.FalseKeyword) {
            initial = 0; // bool false
          }
        }

        const slotId = this.stateSlots.length;
        this.stateSlots.push({ getter, setter, initial, slotId });
        this.stateBindings.set(getter, slotId);
        this.setterBindings.set(setter, slotId);
        this.hasState = true;
      }
    }
  }

  /**
   * Collect FFI declarations from the source file.
   * Two mechanisms:
   *   1. Comment pragmas: // @ffi <time.h>  or  // @ffi <sqlite3.h> -lsqlite3
   *   2. TypeScript `declare function` statements for function signatures
   *
   * The TS type annotations map to Zig/C types:
   *   number → c_long (large enough for time_t, size_t, etc.)
   *   string → [*:0]const u8 (null-terminated C string)
   *   pointer → ?*anyopaque (void*)
   *   void → void
   *   boolean → c_int (0/1)
   */
  collectFFI(sourceFile) {
    // 1. Scan source text for // @ffi pragmas
    const sourceText = sourceFile.getFullText();
    const ffiPragmaRe = /\/\/\s*@ffi\s+<([^>]+)>(?:\s+(-l\S+))?/g;
    let match;
    while ((match = ffiPragmaRe.exec(sourceText)) !== null) {
      const header = match[1];
      const lib = match[2]; // e.g. "-lsqlite3"
      if (!this.ffiHeaders.includes(header)) {
        this.ffiHeaders.push(header);
      }
      if (lib) {
        const libName = lib.replace(/^-l/, '');
        if (!this.ffiLibs.includes(libName)) {
          this.ffiLibs.push(libName);
        }
      }
    }

    // 2. Scan for `declare function` statements
    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isFunctionDeclaration(node)) return;
      // `declare function` has no body and the Declare modifier
      if (node.body) return; // has a body — it's a real function, not a declaration
      const isDeclare = node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword);
      if (!isDeclare) return;
      if (!node.name) return;

      const name = node.name.text;
      const params = (node.parameters || []).map(p => {
        const pName = p.name.getText(sourceFile);
        const pType = p.type ? p.type.getText(sourceFile) : 'number';
        return { name: pName, type: pType };
      });
      const returnType = node.type ? node.type.getText(sourceFile) : 'void';

      this.ffiFunctions.set(name, { params, returnType });
    });
  }

  /** Map a TypeScript type annotation to a Zig type for FFI. */
  tsTypeToZig(tsType) {
    switch (tsType) {
      case 'number': return 'c_long';
      case 'string': return '[*:0]const u8';
      case 'pointer': return '?*anyopaque';
      case 'void': return 'void';
      case 'boolean': return 'c_int';
      default: return 'c_long'; // fallback
    }
  }

  /** Parse import declarations and load components from .tsz files. */
  resolveImports(sourceFile, filePath) {
    ts.forEachChild(sourceFile, (node) => {
      if (!ts.isImportDeclaration(node)) return;
      const specifier = node.moduleSpecifier;
      if (!ts.isStringLiteral(specifier)) return;

      const importPath = specifier.text;
      // Only handle .tsz imports
      if (!importPath.endsWith('.tsz')) return;

      // Resolve relative to the importing file
      const baseDir = path.dirname(filePath);
      const resolvedPath = path.resolve(baseDir, importPath);

      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Imported .tsz file not found: ${resolvedPath}`);
      }

      const importSource = fs.readFileSync(resolvedPath, 'utf-8');
      const importSf = ts.createSourceFile(
        resolvedPath, importSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
      );

      // Recursively resolve imports in the imported file first
      this.resolveImports(importSf, resolvedPath);

      // Collect components from the imported file
      this.collectComponents(importSf);
    });
  }

  findReturn(block) {
    if (!block) return null;
    for (const stmt of block.statements) {
      if (ts.isReturnStatement(stmt)) return stmt;
      // Check inside if/else blocks
      if (ts.isIfStatement(stmt)) {
        const r = this.findReturn(stmt.thenStatement);
        if (r) return r;
      }
    }
    return null;
  }

  /**
   * Emit a JSX element as a Zig Node literal. Returns { zigExpr, arrays }.
   * @param {object} node - The JSX AST node
   * @param {Map|null} propScope - compile-time prop bindings (name → value string)
   * @param {object} callerSf - the source file for prop resolution (may differ from this.sf for imported components)
   * @param {Array|null} callerChildren - JSX children passed by the caller (for {children} forwarding)
   */
  emitJSX(node, propScope, callerSf, callerChildren) {
    const sf = callerSf || this.sf;

    if (ts.isParenthesizedExpression(node)) {
      return this.emitJSX(node.expression, propScope, sf, callerChildren);
    }

    if (ts.isJsxElement(node)) {
      return this.emitJSXElement(node.openingElement, node.children, propScope, sf, callerChildren);
    }

    if (ts.isJsxSelfClosingElement(node)) {
      return this.emitJSXElement(node, [], propScope, sf, callerChildren);
    }

    if (ts.isJsxFragment(node)) {
      // Fragment — emit children as an array
      return this.emitJSXChildren(node.children, propScope, sf, callerChildren);
    }

    // String literal in JSX
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (!text) return null;
      return {
        zigExpr: `.{ .text = "${this.escapeZigString(text)}" }`,
        arrays: [],
      };
    }

    // JSX expression — might be {children} or {props.children}
    if (ts.isJsxExpression(node) && node.expression) {
      const exprText = node.expression.getText(sf);
      // Check for children forwarding — callerChildren is { nodes, sf } packed by inlineComponent
      if (exprText === 'children' || exprText === 'props.children') {
        if (callerChildren && callerChildren.nodes && callerChildren.nodes.length > 0) {
          // Use the CALLER's source file for processing the forwarded children
          return this.emitJSXChildren(callerChildren.nodes, propScope, callerChildren.sf, null);
        }
        return null;
      }
      // Check for prop reference that resolves to a string
      if (propScope) {
        const resolved = this.resolveExpression(node.expression, propScope, sf);
        if (resolved !== null) {
          return {
            zigExpr: `.{ .text = "${this.escapeZigString(resolved)}" }`,
            arrays: [],
          };
        }
      }
    }

    throw new Error(`Unsupported JSX node: ${ts.SyntaxKind[node.kind]}`);
  }

  /** Emit an array of JSX children, returning a single wrapper node or combined result. */
  emitJSXChildren(children, propScope, sf, callerChildren) {
    const arrays = [];
    const childExprs = [];
    for (const child of children) {
      const result = this.emitJSX(child, propScope, sf, callerChildren);
      if (result) {
        childExprs.push(result.zigExpr);
        arrays.push(...result.arrays);
      }
    }
    if (childExprs.length === 0) return null;
    if (childExprs.length === 1) return { zigExpr: childExprs[0], arrays };
    // Wrap multiple children in a transparent container
    const arrName = `_arr_${this.arrayCounter++}`;
    arrays.push(`    var ${arrName} = [_]Node{ ${childExprs.join(', ')} };`);
    return {
      zigExpr: `.{ .children = &${arrName} }`,
      arrays,
    };
  }

  emitJSXElement(opening, children, propScope, callerSf, callerChildren) {
    const sf = callerSf || this.sf;
    const tagName = opening.tagName.getText(sf);

    // ── User component? Inline it. ──────────────────────────────────
    if (!PRIMITIVES.has(tagName) && tagName[0] === tagName[0].toUpperCase()) {
      return this.inlineComponent(tagName, opening, children, propScope, sf);
    }

    // ── Primitive element (Box, Text, etc.) ─────────────────────────
    const attrs = this.parseAttributes(opening.attributes, sf);
    const arrays = [];

    // Resolve prop references in attributes
    if (propScope) {
      this.resolveAttrs(attrs, propScope, sf);
    }

    // Build style struct
    let styleFields = [];
    if (attrs.style) {
      styleFields = this.emitStyleObject(attrs.style, sf);
    }

    // ScrollView → overflow: scroll
    if (tagName === 'ScrollView') {
      styleFields.push(`.overflow = .scroll`);
    }

    // Handle backgroundColor in style
    if (attrs.style?.backgroundColor) {
      const colorStr = this.extractStringLiteral(attrs.style.backgroundColor, sf);
      if (colorStr) {
        const zigColor = parseColor(colorStr);
        if (zigColor) {
          styleFields.push(`.background_color = ${zigColor}`);
        }
      }
    }

    // Build node fields
    const fields = [];

    // Style
    if (styleFields.length > 0) {
      fields.push(`.style = .{ ${styleFields.join(', ')} }`);
    }

    // Text content — from children or text prop
    const textContent = this.extractTextContent(children, propScope, sf);
    if (textContent) {
      if (textContent.__dynamic) {
        // Dynamic text from state — placeholder, updated by updateDynamicTexts()
        const bufId = this.dynamicTextCounter++;
        if (!this._dynamicTexts) this._dynamicTexts = [];
        this._dynamicTexts.push({
          bufId,
          fmtString: textContent.fmtString,
          fmtArgs: textContent.fmtArgs,
          nodeRef: null, // filled in when this node is placed in a parent array
        });
        // Use empty string placeholder — updateDynamicTexts() will set the real value
        fields.push(`.text = ""`);
        // Tag this expression so we can track it when placed into a parent array
        this._lastDynamicBufId = bufId;
      } else {
        fields.push(`.text = "${this.escapeZigString(textContent)}"`);
      }
    }

    // fontSize prop
    if (attrs.fontSize !== undefined) {
      fields.push(`.font_size = ${this.evalNumeric(attrs.fontSize, sf)}`);
    }

    // color prop → text_color
    if (attrs.color !== undefined) {
      const colorStr = this.extractStringLiteral(attrs.color, sf);
      if (colorStr) {
        const zigColor = parseColor(colorStr);
        if (zigColor) {
          fields.push(`.text_color = ${zigColor}`);
        }
      }
    }

    // src prop → image_src (for <Image> elements)
    // Resolve path relative to the .tsz source file, then make absolute
    if (attrs.src !== undefined) {
      const srcStr = this.extractStringLiteral(attrs.src, sf);
      if (srcStr) {
        const absPath = path.resolve(path.dirname(this.sf.fileName), srcStr);
        fields.push(`.image_src = "${this.escapeZigString(absPath)}"`);
      }
    }

    // onPress handler — generates a Zig function and wires it to .handlers.on_press
    if (attrs.onPress !== undefined) {
      const handlerName = `_handler_press_${this.handlerCounter++}`;
      const body = this.emitHandlerBody(attrs.onPress, sf);
      this.handlerFunctions.push(`fn ${handlerName}() void {\n    ${body}\n}`);
      fields.push(`.handlers = .{ .on_press = ${handlerName} }`);
    }

    // Children (non-text JSX children)
    const jsxChildren = this.getJSXChildren(children);
    if (jsxChildren.length > 0) {
      const childExprs = [];
      const childDynIds = []; // track which children are dynamic text nodes
      for (const child of jsxChildren) {
        this._lastDynamicBufId = null;
        const result = this.emitJSX(child, propScope, sf, callerChildren);
        if (result) {
          childExprs.push(result.zigExpr);
          arrays.push(...result.arrays);
          childDynIds.push(this._lastDynamicBufId);
        } else {
          childDynIds.push(null);
        }
      }

      if (childExprs.length > 0) {
        const arrName = `_arr_${this.arrayCounter++}`;
        arrays.push(`    var ${arrName} = [_]Node{ ${childExprs.join(', ')} };`);
        fields.push(`.children = &${arrName}`);

        // Record node references for dynamic text nodes
        if (this._dynamicTexts) {
          for (let ci = 0; ci < childDynIds.length; ci++) {
            const dynId = childDynIds[ci];
            if (dynId !== null && dynId !== undefined) {
              const dt = this._dynamicTexts.find(d => d.bufId === dynId);
              if (dt) dt.nodeRef = { arrName, index: ci };
            }
          }
        }
      }
    }

    return {
      zigExpr: `.{ ${fields.join(', ')} }`,
      arrays,
    };
  }

  /**
   * Extract the body of an event handler callback and emit Zig code.
   * Supports:
   *   - Arrow function: onPress={() => console.log("clicked")}
   *   - Arrow with block: onPress={() => { console.log("clicked"); }}
   * For now, callbacks emit std.debug.print statements.
   * Future: call state functions (setState, etc.)
   */
  emitHandlerBody(node, sf) {
    sf = sf || this.sf;

    // Handle JSX expression wrapper
    if (ts.isJsxExpression(node) && node.expression) {
      return this.emitHandlerBody(node.expression, sf);
    }

    // Arrow function: () => expr  or  () => { stmts }
    if (ts.isArrowFunction(node)) {
      const body = node.body;
      if (ts.isBlock(body)) {
        // Block body — emit each statement
        return body.statements.map(s => this.emitStatement(s, sf)).join('\n    ');
      }
      // Expression body — emit as a single statement
      return this.emitExpression(body, sf);
    }

    // Function expression: function() { ... }
    if (ts.isFunctionExpression(node)) {
      if (node.body) {
        return node.body.statements.map(s => this.emitStatement(s, sf)).join('\n    ');
      }
    }

    // Fallback: just print what was there
    const text = node.getText ? node.getText(sf) : 'unknown handler';
    return `std.debug.print("[onPress] ${this.escapeZigString(text)}\\n", .{});`;
  }

  /** Emit a TS statement as Zig code. */
  emitStatement(stmt, sf) {
    if (ts.isExpressionStatement(stmt)) {
      return this.emitExpression(stmt.expression, sf);
    }
    // Fallback
    const text = stmt.getText ? stmt.getText(sf) : '';
    return `std.debug.print("[stmt] ${this.escapeZigString(text)}\\n", .{});`;
  }

  /** Emit a TS expression as Zig code (for handler bodies). */
  emitExpression(expr, sf) {
    // console.log("text") → std.debug.print
    if (ts.isCallExpression(expr)) {
      const callee = expr.expression.getText(sf);

      // State setter: setCount(count + 1) → state.setSlot(N, state.getSlot(N) + 1)
      if (ts.isIdentifier(expr.expression) && this.setterBindings.has(callee)) {
        const slotId = this.setterBindings.get(callee);
        if (expr.arguments.length > 0) {
          const argZig = this.emitStateExpression(expr.arguments[0], sf);
          return `state.setSlot(${slotId}, ${argZig});`;
        }
        return `state.setSlot(${slotId}, 0);`;
      }

      // FFI function call: time(0) → ffi.time(0)
      if (ts.isIdentifier(expr.expression) && this.ffiFunctions.has(callee)) {
        const ffiArgs = expr.arguments.map(a => this.emitFFIArg(a, sf));
        return `_ = ffi.${callee}(${ffiArgs.join(', ')});`;
      }

      // Built-in engine functions
      if (callee === 'playVideo' && expr.arguments.length > 0) {
        const arg = this.extractStringLiteral(expr.arguments[0], sf);
        if (arg) return `mpv_mod.play("${this.escapeZigString(arg)}");`;
      }
      if (callee === 'stopVideo') return 'mpv_mod.stop();';
      if (callee === 'pauseVideo') return 'mpv_mod.setPaused(true);';
      if (callee === 'resumeVideo') return 'mpv_mod.setPaused(false);';

      if (callee === 'console.log' || callee === 'console.info') {
        const args = expr.arguments.map(a => {
          const s = this.extractStringLiteral(a, sf);
          return s !== null ? s : (a.getText ? a.getText(sf) : '?');
        });
        return `std.debug.print("${this.escapeZigString(args.join(' '))}\\n", .{});`;
      }
    }

    // Fallback: print the raw expression text
    const text = expr.getText ? expr.getText(sf) : 'expr';
    return `std.debug.print("[event] ${this.escapeZigString(text)}\\n", .{});`;
  }

  /**
   * Emit a TS expression as a Zig value expression (for state setter arguments).
   * Handles: count + 1, count - 1, numeric literals, state getters, etc.
   */
  emitStateExpression(node, sf) {
    // Numeric literal
    if (ts.isNumericLiteral(node)) return node.text;

    // FFI function call in expression position: time(0) → ffi.time(0)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text;
      if (this.ffiFunctions.has(callee)) {
        const ffiArgs = node.arguments.map(a => this.emitFFIArg(a, sf));
        return `ffi.${callee}(${ffiArgs.join(', ')})`;
      }
    }

    // Identifier — state getter or literal
    if (ts.isIdentifier(node)) {
      if (this.stateBindings.has(node.text)) {
        return `state.getSlot(${this.stateBindings.get(node.text)})`;
      }
      // true/false
      if (node.text === 'true') return '1';
      if (node.text === 'false') return '0';
      return node.text;
    }

    // true/false keywords
    if (node.kind === ts.SyntaxKind.TrueKeyword) return '1';
    if (node.kind === ts.SyntaxKind.FalseKeyword) return '0';

    // Binary expression: count + 1, count - 1, count * 2
    if (ts.isBinaryExpression(node)) {
      const left = this.emitStateExpression(node.left, sf);
      const right = this.emitStateExpression(node.right, sf);
      const op = node.operatorToken.getText(sf);
      // Map JS operators to Zig
      const zigOp = { '+': '+', '-': '-', '*': '*', '/': '@divTrunc', '%': '@mod' }[op];
      if (zigOp === '@divTrunc') return `@divTrunc(${left}, ${right})`;
      if (zigOp === '@mod') return `@mod(${left}, ${right})`;
      if (zigOp) return `${left} ${zigOp} ${right}`;
      return `${left} ${op} ${right}`;
    }

    // Prefix unary: -count, !flag
    if (ts.isPrefixUnaryExpression(node)) {
      const operand = this.emitStateExpression(node.operand, sf);
      if (node.operator === ts.SyntaxKind.MinusToken) return `-${operand}`;
      if (node.operator === ts.SyntaxKind.ExclamationToken) {
        return `if (${operand} != 0) @as(i64, 0) else @as(i64, 1)`;
      }
    }

    // Parenthesized
    if (ts.isParenthesizedExpression(node)) {
      return `(${this.emitStateExpression(node.expression, sf)})`;
    }

    // Arrow function as setter arg: setCount(prev => prev + 1)
    // Treat the parameter as the current slot value
    if (ts.isArrowFunction(node) && node.parameters.length > 0) {
      // Find which setter this is inside (look up call stack — not easy from here)
      // For now, fallback to the expression text
      const text = node.getText ? node.getText(sf) : '0';
      return `/* TODO: functional updater: ${this.escapeZigString(text)} */ 0`;
    }

    // Fallback
    const text = node.getText ? node.getText(sf) : '0';
    return `/* ${this.escapeZigString(text)} */ 0`;
  }

  /**
   * Emit an argument to an FFI function call as a Zig expression.
   * Handles: numeric literals, string literals, state getters, null/0 → null.
   */
  emitFFIArg(node, sf) {
    // Numeric literal — common for things like time(0)
    if (ts.isNumericLiteral(node)) {
      const val = parseInt(node.text);
      if (val === 0) return 'null'; // time(0) → ffi.time(null) since the param is ?*anyopaque or similar
      return node.text;
    }

    // String literal → pass as C string
    if (ts.isStringLiteral(node)) {
      return `"${this.escapeZigString(node.text)}"`;
    }

    // State getter
    if (ts.isIdentifier(node) && this.stateBindings.has(node.text)) {
      return `state.getSlot(${this.stateBindings.get(node.text)})`;
    }

    // null keyword
    if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';

    // Fallback — try to emit as state expression
    return this.emitStateExpression(node, sf);
  }

  /**
   * Inline a user-defined component at the call site.
   * Looks up the component, builds a prop scope from the passed attributes,
   * then emits the component's return JSX with prop substitution.
   */
  inlineComponent(tagName, opening, callerChildren, outerPropScope, callerSf) {
    const sf = callerSf || this.sf;
    const compEntry = this.components.get(tagName);
    if (!compEntry) {
      throw new Error(`Unknown component: <${tagName}>. Not a primitive and not found in any .tsz file.`);
    }

    const { node: compNode, sf: compSf } = compEntry;

    // Build prop scope: map param names → compile-time values from the caller
    const propScope = new Map();
    const attrs = this.parseAttributes(opening.attributes, sf);

    // Resolve outer prop references in the attributes we're passing
    if (outerPropScope) {
      this.resolveAttrs(attrs, outerPropScope, sf);
    }

    // Extract the component's parameter names (from destructuring or props param)
    const paramNames = this.extractParamNames(compNode);

    // Map each passed attribute to a resolved string/number value
    for (const [attrName, attrNode] of Object.entries(attrs)) {
      if (attrName === 'style') continue; // style is an object, handled differently
      const strVal = this.extractStringLiteral(attrNode, sf);
      if (strVal !== null) {
        propScope.set(attrName, strVal);
        continue;
      }
      const numVal = this.evalNumeric(attrNode, sf);
      if (numVal !== null) {
        propScope.set(attrName, String(numVal));
        continue;
      }
      // Fall through — prop not resolvable at compile time
    }

    // Style prop — pass through as-is if present
    if (attrs.style) {
      propScope.set('__style__', attrs.style);
    }

    // Find the component's return JSX
    const returnStmt = this.findReturn(compNode.body);
    if (!returnStmt || !returnStmt.expression) {
      throw new Error(`Component <${tagName}> must return JSX`);
    }

    // Emit with the component's source file and prop scope.
    // Pack callerChildren with the CALLER's source file so children forwarding
    // uses the correct sf for getText() on the forwarded AST nodes.
    const packedChildren = callerChildren && callerChildren.length > 0
      ? { nodes: callerChildren, sf }
      : null;
    return this.emitJSX(returnStmt.expression, propScope, compSf, packedChildren);
  }

  /** Extract destructured parameter names from a component function. */
  extractParamNames(funcNode) {
    const names = [];
    if (!funcNode.parameters || funcNode.parameters.length === 0) return names;
    const firstParam = funcNode.parameters[0];
    if (firstParam.name && ts.isObjectBindingPattern(firstParam.name)) {
      for (const element of firstParam.name.elements) {
        if (element.name && ts.isIdentifier(element.name)) {
          names.push(element.name.text);
        }
      }
    } else if (firstParam.name && ts.isIdentifier(firstParam.name)) {
      names.push(firstParam.name.text);
    }
    return names;
  }

  /**
   * Resolve a TS expression to a compile-time string value using the prop scope.
   * Handles: `title`, `props.title`, string literals, numeric literals.
   */
  resolveExpression(node, propScope, sf) {
    if (!propScope) return null;

    // Direct identifier: `title`
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (propScope.has(name)) return propScope.get(name);
      return null;
    }

    // Property access: `props.title`
    if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'props') {
        const propName = node.name.text;
        if (propScope.has(propName)) return propScope.get(propName);
      }
      return null;
    }

    // String literal
    if (ts.isStringLiteral(node)) return node.text;

    // Numeric literal
    if (ts.isNumericLiteral(node)) return node.text;

    return null;
  }

  /**
   * Resolve prop references in parsed attributes.
   * Mutates attrs in-place, replacing AST nodes with synthetic string literal nodes
   * when a prop reference resolves to a compile-time value.
   */
  resolveAttrs(attrs, propScope, sf) {
    for (const [key, valueNode] of Object.entries(attrs)) {
      if (key === 'style' && typeof valueNode === 'object' && !valueNode.kind) {
        // Style object — resolve prop refs inside it
        for (const [sk, sv] of Object.entries(valueNode)) {
          const resolved = this.resolveExpression(sv, propScope, sf);
          if (resolved !== null) {
            // Replace with a synthetic literal node
            attrs.style[sk] = { __resolved: true, value: resolved };
          }
        }
        continue;
      }
      const resolved = this.resolveExpression(valueNode, propScope, sf);
      if (resolved !== null) {
        attrs[key] = { __resolved: true, value: resolved };
      }
    }
  }

  parseAttributes(attrs, sf) {
    sf = sf || this.sf;
    const result = {};
    if (!attrs || !attrs.properties) return result;

    for (const prop of attrs.properties) {
      if (ts.isJsxAttribute(prop) && prop.name) {
        const name = prop.name.getText(sf);

        if (prop.initializer) {
          if (ts.isStringLiteral(prop.initializer)) {
            result[name] = prop.initializer;
          } else if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
            const expr = prop.initializer.expression;
            if (ts.isObjectLiteralExpression(expr) && name === 'style') {
              result.style = this.parseObjectLiteral(expr, sf);
            } else {
              result[name] = expr;
            }
          }
        }
      }
    }
    return result;
  }

  parseObjectLiteral(node, sf) {
    sf = sf || this.sf;
    const obj = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const key = prop.name.getText(sf);
        obj[key] = prop.initializer;
      }
    }
    return obj;
  }

  emitStyleObject(styleObj, sf) {
    sf = sf || this.sf;
    const fields = [];

    for (const [key, valueNode] of Object.entries(styleObj)) {
      if (key === 'backgroundColor') continue; // handled separately

      // Check enum mappings
      if (ENUM_MAP[key]) {
        const mapping = ENUM_MAP[key];
        const strVal = this.extractStringLiteral(valueNode, sf);
        if (strVal && mapping.values[strVal]) {
          fields.push(`.${mapping.field} = ${mapping.values[strVal]}`);
        }
        continue;
      }

      // Check numeric style props
      if (STYLE_MAP[key]) {
        const num = this.evalNumeric(valueNode, sf);
        if (num !== null) {
          fields.push(`.${STYLE_MAP[key]} = ${num}`);
        }
        continue;
      }
    }

    return fields;
  }

  evalNumeric(node, sf) {
    // Handle resolved prop values
    if (node && node.__resolved) {
      const n = parseFloat(node.value);
      return isNaN(n) ? null : n;
    }
    if (ts.isNumericLiteral(node)) return parseFloat(node.text);
    if (ts.isStringLiteral(node)) return parseFloat(node.text) || null;
    // Expression: try to extract the text
    sf = sf || this.sf;
    const text = node.getText ? node.getText(sf) : null;
    if (text && !isNaN(Number(text))) return Number(text);
    return null;
  }

  extractStringLiteral(node, sf) {
    // Handle resolved prop values
    if (node && node.__resolved) return node.value;
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isJsxExpression(node) && node.expression) {
      return this.extractStringLiteral(node.expression, sf);
    }
    return null;
  }

  /**
   * Check if a template expression contains state variable references.
   * Returns { isDynamic, fmtString, fmtArgs } or null.
   * Example: `Count: ${count}` → { fmtString: "Count: {d}", fmtArgs: ["state.getSlot(0)"] }
   */
  analyzeTemplateLiteral(node, sf) {
    if (!ts.isTemplateExpression(node)) return null;
    if (!this.hasState) return null;

    let hasDynamic = false;
    let fmtString = this.escapeZigString(node.head.text);
    const fmtArgs = [];

    for (const span of node.templateSpans) {
      const expr = span.expression;
      const exprText = expr.getText(sf);

      // Check if this expression is a state getter
      if (ts.isIdentifier(expr) && this.stateBindings.has(expr.text)) {
        hasDynamic = true;
        fmtString += '{d}';
        fmtArgs.push(`state.getSlot(${this.stateBindings.get(expr.text)})`);
      } else {
        // Not a state var — try to evaluate statically
        fmtString += exprText;
      }

      // Add the literal text after the expression
      fmtString += this.escapeZigString(span.literal.text);
    }

    if (!hasDynamic) return null;
    return { fmtString, fmtArgs };
  }

  extractTextContent(children, propScope, sf) {
    sf = sf || this.sf;
    if (!children || children.length === 0) return null;
    const texts = [];
    for (const child of children) {
      if (ts.isJsxText(child)) {
        const t = child.text.trim();
        if (t) texts.push(t);
      } else if (ts.isJsxExpression(child) && child.expression) {
        // Check for prop reference: {title} or {props.title}
        if (propScope) {
          const resolved = this.resolveExpression(child.expression, propScope, sf);
          if (resolved !== null) {
            texts.push(resolved);
            continue;
          }
        }
        if (ts.isStringLiteral(child.expression)) {
          texts.push(child.expression.text);
        } else if (ts.isTemplateExpression(child.expression)) {
          // Check for state variable references in the template
          const analysis = this.analyzeTemplateLiteral(child.expression, sf);
          if (analysis) {
            // Mark as dynamic — return a special marker
            return { __dynamic: true, ...analysis };
          }
          // Static template literal — extract the static parts
          texts.push(child.expression.getText(sf));
        } else if (ts.isIdentifier(child.expression) && this.stateBindings.has(child.expression.text)) {
          // Bare state variable reference: {count}
          return { __dynamic: true, fmtString: '{d}', fmtArgs: [`state.getSlot(${this.stateBindings.get(child.expression.text)})`] };
        }
      }
    }
    return texts.length > 0 ? texts.join(' ') : null;
  }

  getJSXChildren(children) {
    if (!children) return [];
    return children.filter((c) => {
      if (ts.isJsxText(c)) return false; // text handled by extractTextContent
      // Filter out simple text-bearing expressions — captured by extractTextContent.
      // Keep {children}/{props.children} and JSX elements.
      if (ts.isJsxExpression(c) && c.expression) {
        if (ts.isStringLiteral(c.expression)) return false;
        if (ts.isNumericLiteral(c.expression)) return false;
        if (ts.isTemplateExpression(c.expression)) return false;
        // Simple identifiers like {title} → text, except {children}
        if (ts.isIdentifier(c.expression)) {
          return c.expression.text === 'children';
        }
        // props.X → text, except props.children
        if (ts.isPropertyAccessExpression(c.expression)) {
          if (ts.isIdentifier(c.expression.expression) &&
              c.expression.expression.text === 'props') {
            return c.expression.name.text === 'children';
          }
          return false;
        }
      }
      return true;
    });
  }

  escapeZigString(s) {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  buildZigSource(arrays, rootExpr) {
    const handlerDecls = this.handlerFunctions.length > 0
      ? '\n// ── Generated event handlers ────────────────────────────────────\n' +
        this.handlerFunctions.join('\n\n') + '\n'
      : '';

    // Generate state-related code
    const stateImport = this.hasState ? '\nconst state = @import("state.zig");' : '';

    // Generate FFI @cImport block
    let ffiImport = '';
    if (this.ffiHeaders.length > 0) {
      const includes = this.ffiHeaders.map(h => `    @cInclude("${h}");`).join('\n');
      ffiImport = `\nconst ffi = @cImport({\n${includes}\n});\n`;
    }

    // Dynamic text buffers (module-level so they persist across frames)
    let dynBufDecls = '';
    let updateDynTextsFn = '';
    if (this._dynamicTexts && this._dynamicTexts.length > 0) {
      const bufLines = [];
      const updateLines = [];
      for (const dt of this._dynamicTexts) {
        bufLines.push(`var _dyn_buf_${dt.bufId}: [256]u8 = undefined;`);
        bufLines.push(`var _dyn_text_${dt.bufId}: []const u8 = "";`);
        if (dt.nodeRef) {
          const args = dt.fmtArgs.join(', ');
          updateLines.push(`    _dyn_text_${dt.bufId} = std.fmt.bufPrint(&_dyn_buf_${dt.bufId}, "${dt.fmtString}", .{ ${args} }) catch "";`);
          updateLines.push(`    ${dt.nodeRef.arrName}[${dt.nodeRef.index}].text = _dyn_text_${dt.bufId};`);
        }
      }
      dynBufDecls = '\n// ── Dynamic text buffers ─────────────────────────────────────────\n' +
        bufLines.join('\n') + '\n';
      updateDynTextsFn = '\nfn updateDynamicTexts() void {\n' + updateLines.join('\n') + '\n}\n';
    }

    // State initialization code
    let stateInitCode = '';
    if (this.hasState) {
      const initLines = this.stateSlots.map(s =>
        `    _ = state.createSlot(${Math.floor(s.initial)});`
      );
      stateInitCode = '\n    // ── Initialize state slots ─────────────────────────────────────\n' +
        initLines.join('\n') + '\n';
    }

    // Main loop state check
    const hasDynTexts = this._dynamicTexts && this._dynamicTexts.length > 0;
    const stateCheck = this.hasState && hasDynTexts
      ? `
        // ── State reactivity ──────────────────────────────────────────
        if (state.isDirty()) {
            updateDynamicTexts();
            state.clearDirty();
        }`
      : '';

    // Initial dynamic text update (run once after tree is built)
    const initialDynUpdate = hasDynTexts ? '\n    updateDynamicTexts();' : '';

    return `//! Generated by tsz compiler — do not edit
//!
//! Source: ${path.basename(this.sf.fileName)}

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const Node = layout.Node;
const Style = layout.Style;
const Color = layout.Color;
const LayoutRect = layout.LayoutRect;
const TextEngine = text_mod.TextEngine;
const image_mod = @import("image.zig");
const ImageCache = image_mod.ImageCache;
const events = @import("events.zig");
const mpv_mod = @import("mpv.zig");${stateImport}${ffiImport}

var g_text_engine: ?*TextEngine = null;
var g_image_cache: ?*ImageCache = null;

fn measureCallback(t: []const u8, font_size: u16) layout.TextMetrics {
    if (g_text_engine) |te| {
        return te.measureText(t, font_size);
    }
    return .{};
}

fn measureImageCallback(img_path: []const u8) layout.ImageDims {
    if (g_image_cache) |cache| {
        if (cache.load(img_path)) |img| {
            return .{
                .width = @floatFromInt(img.width),
                .height = @floatFromInt(img.height),
            };
        }
    }
    return .{};
}

// ── Generated node tree (module-level for state reactivity) ─────────
${arrays.map(a => a.replace(/^    /, '')).join('\n')}
var root = Node{ ${rootExpr.slice(2)} ;
${dynBufDecls}${handlerDecls}${updateDynTextsFn}
// ── Hover state ────────────────────────────────────────────────────
var hovered_node: ?*Node = null;

fn brighten(color: Color) Color {
    return .{
        .r = @min(255, @as(u16, color.r) + 30),
        .g = @min(255, @as(u16, color.g) + 30),
        .b = @min(255, @as(u16, color.b) + 30),
        .a = color.a,
    };
}

const Painter = struct {
    renderer: *c.SDL_Renderer,
    text_engine: *TextEngine,
    image_cache: *ImageCache,

    pub fn clear(self: *Painter, color: Color) void {
        _ = c.SDL_SetRenderDrawColor(self.renderer, color.r, color.g, color.b, color.a);
        _ = c.SDL_RenderClear(self.renderer);
    }

    pub fn present(self: *Painter) void {
        c.SDL_RenderPresent(self.renderer);
    }

    pub fn paintTree(self: *Painter, node: *Node, scroll_offset_x: f32, scroll_offset_y: f32) void {
        if (node.style.display == .none) return;
        const screen_x = node.computed.x - scroll_offset_x;
        const screen_y = node.computed.y - scroll_offset_y;

        if (node.style.background_color) |col| {
            const is_hovered = (hovered_node != null and hovered_node.? == node);
            const paint_col = if (is_hovered) brighten(col) else col;
            _ = c.SDL_SetRenderDrawColor(self.renderer, paint_col.r, paint_col.g, paint_col.b, paint_col.a);
            var r = c.SDL_Rect{
                .x = @intFromFloat(screen_x),
                .y = @intFromFloat(screen_y),
                .w = @intFromFloat(node.computed.w),
                .h = @intFromFloat(node.computed.h),
            };
            _ = c.SDL_RenderFillRect(self.renderer, &r);
        }
        if (node.image_src) |src| {
            if (self.image_cache.load(src)) |img| {
                var dst = c.SDL_Rect{
                    .x = @intFromFloat(screen_x),
                    .y = @intFromFloat(screen_y),
                    .w = @intFromFloat(node.computed.w),
                    .h = @intFromFloat(node.computed.h),
                };
                _ = c.SDL_RenderCopy(self.renderer, img.texture, null, &dst);
            }
        }
        if (node.text) |txt| {
            const pad_l = node.style.padLeft();
            const pad_t = node.style.padTop();
            const col = node.text_color orelse Color.rgb(255, 255, 255);
            self.text_engine.drawText(txt, screen_x + pad_l, screen_y + pad_t, node.font_size, col);
        }

        var prev_clip: c.SDL_Rect = undefined;
        var had_prev_clip = false;
        const needs_clip = node.style.overflow != .visible;
        if (needs_clip) {
            c.SDL_RenderGetClipRect(self.renderer, &prev_clip);
            had_prev_clip = (prev_clip.w > 0 and prev_clip.h > 0);
            var clip = c.SDL_Rect{
                .x = @intFromFloat(screen_x), .y = @intFromFloat(screen_y),
                .w = @intFromFloat(node.computed.w), .h = @intFromFloat(node.computed.h),
            };
            if (had_prev_clip) {
                const ix1 = @max(clip.x, prev_clip.x); const iy1 = @max(clip.y, prev_clip.y);
                const ix2 = @min(clip.x + clip.w, prev_clip.x + prev_clip.w);
                const iy2 = @min(clip.y + clip.h, prev_clip.y + prev_clip.h);
                clip.x = ix1; clip.y = iy1;
                clip.w = @max(0, ix2 - ix1); clip.h = @max(0, iy2 - iy1);
            }
            _ = c.SDL_RenderSetClipRect(self.renderer, &clip);
        }
        const child_sx = scroll_offset_x + if (needs_clip) node.scroll_x else @as(f32, 0);
        const child_sy = scroll_offset_y + if (needs_clip) node.scroll_y else @as(f32, 0);
        for (node.children) |*child| {
            self.paintTree(child, child_sx, child_sy);
        }
        if (needs_clip) {
            if (had_prev_clip) { _ = c.SDL_RenderSetClipRect(self.renderer, &prev_clip); }
            else { _ = c.SDL_RenderSetClipRect(self.renderer, null); }
        }
    }
};

pub fn main() !void {
    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();

    const window = c.SDL_CreateWindow("tsz app", c.SDL_WINDOWPOS_CENTERED, c.SDL_WINDOWPOS_CENTERED, 800, 600, c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);

    const renderer = c.SDL_CreateRenderer(window, -1, c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC) orelse return error.RendererFailed;
    defer c.SDL_DestroyRenderer(renderer);
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    var text_engine = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch return error.FontNotFound;
    defer text_engine.deinit();

    var image_cache = ImageCache.init(renderer);
    defer image_cache.deinit();
    defer mpv_mod.deinit();

    g_text_engine = &text_engine;
    g_image_cache = &image_cache;
    layout.setMeasureFn(measureCallback);
    layout.setMeasureImageFn(measureImageCallback);
    var painter = Painter{ .renderer = renderer, .text_engine = &text_engine, .image_cache = &image_cache };

${stateInitCode}${initialDynUpdate}
    var running = true;
    var win_w: f32 = 800;
    var win_h: f32 = 600;

    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            switch (event.type) {
                c.SDL_QUIT => running = false,
                c.SDL_WINDOWEVENT => {
                    if (event.window.event == c.SDL_WINDOWEVENT_SIZE_CHANGED) {
                        win_w = @floatFromInt(event.window.data1);
                        win_h = @floatFromInt(event.window.data2);
                    }
                },
                c.SDL_KEYDOWN => {
                    if (event.key.keysym.sym == c.SDLK_ESCAPE) {
                        running = false;
                    } else {
                        if (hovered_node) |node| {
                            if (node.handlers.on_key) |handler| handler(event.key.keysym.sym);
                        }
                    }
                },
                c.SDL_MOUSEMOTION => {
                    const mx: f32 = @floatFromInt(event.motion.x);
                    const my: f32 = @floatFromInt(event.motion.y);
                    const prev = hovered_node;
                    hovered_node = events.hitTest(&root, mx, my);
                    if (prev != hovered_node) {
                        if (prev) |p| { if (p.handlers.on_hover_exit) |h| h(); }
                        if (hovered_node) |n| { if (n.handlers.on_hover_enter) |h| h(); }
                    }
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    const mx: f32 = @floatFromInt(event.button.x);
                    const my: f32 = @floatFromInt(event.button.y);
                    if (events.hitTest(&root, mx, my)) |node| {
                        if (node.handlers.on_press) |handler| handler();
                    }
                },
                c.SDL_MOUSEWHEEL => {
                    var mx_i: c_int = undefined;
                    var my_i: c_int = undefined;
                    _ = c.SDL_GetMouseState(&mx_i, &my_i);
                    const mx: f32 = @floatFromInt(mx_i);
                    const my: f32 = @floatFromInt(my_i);
                    if (events.findScrollContainer(&root, mx, my)) |scroll_node| {
                        scroll_node.scroll_y -= @as(f32, @floatFromInt(event.wheel.y)) * 30.0;
                        const max_scroll = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
                        scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
                    }
                },
                else => {},
            }
        }

${stateCheck}
        mpv_mod.poll();
        layout.layout(&root, 0, 0, win_w, win_h);
        painter.clear(Color.rgb(24, 24, 32));
        painter.paintTree(&root, 0, 0);
        painter.present();
    }
}
`;
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];
const inputFile = args[1];

if (!command || !inputFile) {
  console.log('Usage: tsz build <file.tsz>');
  console.log('       tsz run <file.tsz>');
  process.exit(1);
}

// Parse the .tsz file using TypeScript's parser
const source = fs.readFileSync(inputFile, 'utf-8');
const sf = ts.createSourceFile(inputFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const compiler = new TszCompiler(sf, path.resolve(inputFile));
const zigSource = compiler.compile();

// Write generated Zig to the engine directory
const engineDir = path.resolve(import.meta.dirname, '..');
const outPath = path.join(engineDir, 'generated_app.zig');
fs.writeFileSync(outPath, zigSource);

console.log(`[tsz] Compiled ${path.basename(inputFile)} → generated_app.zig`);

// Write FFI libs config for build.zig (one lib per line, or empty file)
const ffiLibsPath = path.join(engineDir, 'ffi_libs.txt');
fs.writeFileSync(ffiLibsPath, compiler.ffiLibs.join('\n'));
if (compiler.ffiLibs.length > 0) {
  console.log(`[tsz] FFI libs: ${compiler.ffiLibs.join(', ')}`);
}

// Build with Zig
const repoRoot = path.resolve(engineDir, '../..');
try {
  execSync(`zig build engine-app 2>&1`, { cwd: repoRoot, stdio: 'pipe' });
  console.log(`[tsz] Built → zig-out/bin/tsz-app`);
} catch (e) {
  console.error(`[tsz] Build failed:\n${e.stdout?.toString() || e.stderr?.toString() || e.message}`);
  process.exit(1);
}

if (command === 'run') {
  console.log('[tsz] Running...\n');
  execSync(`./zig-out/bin/tsz-app`, { cwd: repoRoot, stdio: 'inherit' });
}
