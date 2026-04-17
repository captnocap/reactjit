// ── Collection: module-scope declarations ───────────────────────
// Hoist top-level JS decls from imported .c.tsz/.mod.tsz files into JS_LOGIC
// so QJS eval (evalLuaMapData, __eval, js_on_press) can resolve them.
//
// What this collects (at brace depth 0 only):
//   - function foo(...) { ... }        (non-PascalCase, or PascalCase not in ctx.components)
//   - var/const/let foo = <expr>;      (when not already a stateSlot/objectArray)
//
// What this skips:
//   - Component bodies (already tracked in ctx.components)
//   - useState declarations (tracked in ctx.stateSlots)
//   - Const object arrays with pre-parsed data (tracked in ctx.objectArrays)
//   - imports/exports keywords (stripped)
//
// The collected text is emitted verbatim into JS_LOGIC. Identifier collisions
// across files are resolved last-wins (later files override earlier), which
// matches JS module-evaluation order.

function collectModuleScope(c) {
  if (!ctx.moduleScopeDecls) ctx.moduleScopeDecls = [];
  if (!ctx.moduleScopeSeen) ctx.moduleScopeSeen = {};

  const saved = c.save();
  c.pos = 0;
  let depth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  while (c.pos < c.count) {
    const k = c.kind();

    if (k === TK.lbrace) { depth++; c.advance(); continue; }
    if (k === TK.rbrace) { if (depth > 0) depth--; c.advance(); continue; }
    if (k === TK.lparen) { parenDepth++; c.advance(); continue; }
    if (k === TK.rparen) { if (parenDepth > 0) parenDepth--; c.advance(); continue; }
    if (k === TK.lbracket) { bracketDepth++; c.advance(); continue; }
    if (k === TK.rbracket) { if (bracketDepth > 0) bracketDepth--; c.advance(); continue; }

    if (depth !== 0 || parenDepth !== 0 || bracketDepth !== 0) { c.advance(); continue; }

    // function NAME (args) { body }
    if (c.isIdent('function') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
      const funcStart = c.pos;
      const name = c.textAt(c.pos + 1);
      const isComponent = ctx.components && ctx.components.some(cp => cp.name === name);
      // Walk past args and consume the body
      let p = c.pos + 2;
      if (c.kindAt(p) === TK.lparen) {
        let pd = 1; p++;
        while (p < c.count && pd > 0) {
          if (c.kindAt(p) === TK.lparen) pd++;
          else if (c.kindAt(p) === TK.rparen) pd--;
          p++;
        }
      }
      // Skip optional return-type annotation between ) and {
      while (p < c.count && c.kindAt(p) !== TK.lbrace && c.kindAt(p) !== TK.eof) p++;
      if (p < c.count && c.kindAt(p) === TK.lbrace) {
        let bd = 1; p++;
        while (p < c.count && bd > 0) {
          if (c.kindAt(p) === TK.lbrace) bd++;
          else if (c.kindAt(p) === TK.rbrace) bd--;
          p++;
        }
      }
      // MixedCase function names are components or JSX factories — `collectComponents`
      // already skips `App` and lowercase helpers, so any MixedCase here is a React
      // component whose body has JSX. Hoisting it into JS_LOGIC would embed literal
      // `<Tag>` chars that QJS can't parse. UPPER_SNAKE_CASE functions are rare
      // but valid JS (constants as callables) — let them through.
      const isMixedPascal = name.length > 1 && name[0] >= 'A' && name[0] <= 'Z' &&
                            /[a-z]/.test(name);
      // Entrypoint `App` is explicitly skipped.
      const isAppFn = (name === 'App');
      // Defensive: any body containing a JSX open/close token would also break JS.
      let hasJsxInBody = false;
      for (let i = funcStart; i < p; i++) {
        const kk = c.kindAt(i);
        if (kk === TK.lt_slash || kk === TK.slash_gt) { hasJsxInBody = true; break; }
      }
      if (!isComponent && !isMixedPascal && !isAppFn && !hasJsxInBody) {
        const text = _moduleScopeJoinRange(c, funcStart, p);
        if (text && text.length > 0) {
          ctx.moduleScopeDecls.push({ kind: 'function', name: name, text: text });
          ctx.moduleScopeSeen[name] = true;
        }
      }
      c.pos = p;
      continue;
    }

    // var/const/let NAME = ...;
    if ((c.isIdent('var') || c.isIdent('const') || c.isIdent('let')) &&
        c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
      const declStart = c.pos;
      const declKind = c.text();
      const name = c.textAt(c.pos + 1);
      // Skip array-destructuring (useState pattern already handled elsewhere)
      // e.g. const [x, setX] = useState(...)
      // handled by the lbracket check below — fall through if next is equals/semicolon
      let p = c.pos + 2;
      if (c.kindAt(p) === TK.colon) {
        // Skip TS type annotation: var NAME: Type = ...
        while (p < c.count &&
               c.kindAt(p) !== TK.equals &&
               c.kindAt(p) !== TK.semicolon &&
               c.kindAt(p) !== TK.eof) p++;
      }
      if (c.kindAt(p) !== TK.equals) { c.advance(); continue; }
      p++;
      // Walk to end of statement (semicolon or newline-ish end) respecting nesting
      let pd = 0, bd = 0, brd = 0;
      while (p < c.count) {
        const kk = c.kindAt(p);
        if (kk === TK.lparen) pd++;
        else if (kk === TK.rparen) { if (pd === 0) break; pd--; }
        else if (kk === TK.lbrace) bd++;
        else if (kk === TK.rbrace) { if (bd === 0) break; bd--; }
        else if (kk === TK.lbracket) brd++;
        else if (kk === TK.rbracket) { if (brd === 0) break; brd--; }
        else if (kk === TK.semicolon && pd === 0 && bd === 0 && brd === 0) { p++; break; }
        else if (kk === TK.comma && pd === 0 && bd === 0 && brd === 0) { break; }
        p++;
      }
      // Skip if already tracked elsewhere (state slots, object arrays)
      const isStateSlot = ctx.stateSlots && ctx.stateSlots.some(s => s.getter === name);
      const isOa = ctx.objectArrays && ctx.objectArrays.some(o => o.getter === name);
      // MixedCase (`Foo`, `WorkerTile`) is likely a component alias from an
      // import. UPPER_SNAKE (`SUPERVISOR_DB_PREFIX`, `DB_OPEN_QUERY`) is a
      // constant — we need those. The distinguishing test: a MixedCase name
      // has at least one lowercase letter.
      const isMixedPascal = name.length > 1 && name[0] >= 'A' && name[0] <= 'Z' &&
                            /[a-z]/.test(name);
      const isComponent = ctx.components && ctx.components.some(cp => cp.name === name);
      // Bail if the initializer slice contains JSX (function callbacks with
      // JSX returns are module-scope data that QJS can't parse).
      let hasJsxInInit = false;
      for (let i2 = declStart; i2 < p; i2++) {
        const k2 = c.kindAt(i2);
        if (k2 === TK.lt_slash || k2 === TK.slash_gt) { hasJsxInInit = true; break; }
      }
      if (!isStateSlot && !isOa && !isComponent && !isMixedPascal && !hasJsxInInit) {
        const text = _moduleScopeJoinRange(c, declStart, p);
        if (text && text.length > 0) {
          ctx.moduleScopeDecls.push({ kind: declKind, name: name, text: text });
          ctx.moduleScopeSeen[name] = true;
        }
      }
      c.pos = p;
      continue;
    }

    c.advance();
  }
  c.restore(saved);
}

// Reconstruct the raw source text for a token range. The cursor exposes byte
// offsets on each token (`starts[i]`/`ends[i]`) so we can slice the original
// merged source instead of re-joining tokens. This preserves multi-char
// operators (`++`, `--`, `===`, `||`, etc.) that the lexer splits into
// separate single-char tokens, and avoids the identifier-corruption traps
// of keyword-aware whitespace rules.
function _moduleScopeJoinRange(c, startPos, endPos) {
  if (endPos <= startPos) return '';
  const sliceStart = c.starts[startPos];
  const sliceEnd = c.ends[endPos - 1];
  if (typeof sliceStart !== 'number' || typeof sliceEnd !== 'number') return '';
  let s = c._byteSlice ? c._byteSlice(sliceStart, sliceEnd) : c.source.slice(sliceStart, sliceEnd);
  // Strip leading `export `/`export default `/`declare ` — JS_LOGIC is one scope.
  s = s.replace(/^\s*export\s+default\s+/, '');
  s = s.replace(/^\s*export\s+/, '');
  s = s.replace(/^\s*declare\s+/, '');
  // Strip TS generic parameters on function declarations: `function foo<T>(` → `function foo(`
  // and `function foo<T extends U>(` similarly. Only fire on `function NAME<...>(`.
  s = s.replace(/(\bfunction\s+[A-Za-z_]\w*)\s*<[^<>]*(?:<[^<>]*>[^<>]*)*>\s*\(/g, '$1(');
  // Strip TS return-type annotations on function signatures: `) : T {` → `) {`
  // Keep this conservative — only between `)` and `{`.
  s = s.replace(/\)\s*:\s*[A-Za-z_][\w.<>\[\]\|\s,]*?\s*\{/g, ') {');
  // Strip TS parameter annotations: `(a: T, b: U)` → `(a, b)`. Safe because we
  // only look inside a single paren-group; `?.` and ternaries are not at that
  // position.
  s = _stripTsParamTypes(s);
  return s.trim();
}

// Remove `: Type` inside parameter lists only (not ternary `a ? b : c` tails).
// Walks character-by-character tracking paren depth; inside top-level function
// parens, drops `: ...` segments up to the next `,` or matching `)`.
function _stripTsParamTypes(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    // Only strip inside parens that follow `function <name>` or `function (`.
    if (ch === 'f' && src.slice(i, i + 8) === 'function') {
      // Emit `function` keyword, then scan for `(`
      out += src.slice(i, i + 8);
      i += 8;
      while (i < n && src[i] !== '(' && src[i] !== '{' && src[i] !== ';') {
        out += src[i]; i++;
      }
      if (i < n && src[i] === '(') {
        out += '(';
        i++;
        let paramDepth = 1;
        while (i < n && paramDepth > 0) {
          const c2 = src[i];
          if (c2 === '(') { paramDepth++; out += c2; i++; continue; }
          if (c2 === ')') { paramDepth--; out += c2; i++; continue; }
          if (c2 === ':' && paramDepth === 1) {
            // Skip through the type — stops at `,` or matching `)` at depth 1
            i++;
            let typeDepth = 0;
            while (i < n) {
              const c3 = src[i];
              if (c3 === '(' || c3 === '[' || c3 === '<' || c3 === '{') { typeDepth++; i++; continue; }
              if (c3 === ')' || c3 === ']' || c3 === '>' || c3 === '}') {
                if (typeDepth === 0) break;
                typeDepth--; i++; continue;
              }
              if (c3 === ',' && typeDepth === 0) break;
              if (c3 === '=' && typeDepth === 0) break; // default-value assignment — keep `=`
              i++;
            }
            continue;
          }
          out += c2; i++;
        }
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}
