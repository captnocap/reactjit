// ── Effect body transpiler (JS → Zig) ──
// Extracted from emit_split.js per FUNCTIONS_MANIFEST.
// transpileEffectBody, transpileExpr, splitArgs

// Transpile JS effect onRender body to Zig
// Handles: for loops, const/let/var decls, e.method() calls, arithmetic, nested expressions
function transpileEffectBody(jsBody, param) {
  let out = '';
  const lines = jsBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const p = param || 'e'; // effect context param name
  const indent = (n) => '    '.repeat(n);
  let depth = 1; // start at 1 for function body indent
  const arrayVars = new Set(); // vars that hold [2]f32 or [3]f32 (voronoi, hsv, hsl results)

  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    // Skip pure braces
    if (line === '{') { depth++; continue; }
    if (line === '}') { depth--; out += indent(depth) + '}\n'; continue; }
    if (line === '};') { depth--; out += indent(depth) + '}\n'; continue; }
    // } else if (...) { — handle BEFORE generic } stripping
    const bElseIf = line.match(/^}\s*else\s+if\s*\((.+)\)\s*\{?\s*$/);
    if (bElseIf) {
      depth--;
      out += indent(depth) + `} else if (${transpileExpr(bElseIf[1], p, arrayVars)}) {\n`;
      depth++;
      continue;
    }
    // } else { — handle BEFORE generic } stripping
    if (/^}\s*else\s*\{?\s*$/.test(line)) {
      depth--;
      out += indent(depth) + '} else {\n';
      depth++;
      continue;
    }
    // Close brace with content after
    if (line.startsWith('}')) { depth--; out += indent(depth) + '}\n'; line = line.slice(1).trim(); if (!line) continue; }

    // for (let v = start; v < end; v++) → var v: i32 = start; while (v < end) : (v += 1) {
    const forMatch = line.match(/^for\s*\(\s*(?:let|var|const)\s+(\w+)\s*=\s*([^;]+);\s*(\w+)\s*(<|<=|>|>=)\s*([^;]+);\s*(\w+)\+\+\s*\)\s*\{?\s*$/);
    if (forMatch) {
      const [, vname, init, , op, bound] = forMatch;
      const zigInit = /^\d+$/.test(init.trim()) ? init.trim() + '.0' : transpileExpr(init, p, arrayVars);
      const zigBound = transpileExpr(bound, p, arrayVars);
      out += indent(depth) + `{\n`;
      depth++;
      out += indent(depth) + `var ${vname}: f32 = ${zigInit};\n`;
      out += indent(depth) + `while (${vname} ${op} ${zigBound}) : (${vname} += 1.0) {\n`;
      depth++;
      continue;
    }

    // const/let/var declaration
    const declMatch = line.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(.+?);?\s*$/);
    if (declMatch) {
      const [, vname, expr] = declMatch;
      const zigExpr = transpileExpr(expr, p, arrayVars);
      // Detect return types: hsv/hsl → [3]f32, voronoi → [2]f32
      const isColorArray = new RegExp(`\\b${p}\\.(hsv|hsl)\\(`).test(expr);
      const isVoronoi = new RegExp(`\\b${p}\\.voronoi\\(`).test(expr);
      const zigType = isColorArray ? '[3]f32' : isVoronoi ? '[2]f32' : 'f32';
      if (isColorArray || isVoronoi) arrayVars.add(vname);
      out += indent(depth) + `const ${vname}: ${zigType} = ${zigExpr};\n`;
      continue;
    }

    // if statement (standalone — } else if/else handled above before } stripping)
    const ifMatch = line.match(/^if\s*\((.+)\)\s*\{?\s*$/);
    if (ifMatch) {
      const zigCond = transpileExpr(ifMatch[1], p, arrayVars);
      out += indent(depth) + `if (${zigCond}) {\n`;
      depth++;
      continue;
    }

    // e.setPixel(x, y, r, g, b, a); → ctx_e.setPixel(x, y, r, g, b, a);
    const callMatch = line.match(new RegExp(`^${p}\\.(\\w+)\\((.*)\\);?\\s*$`));
    if (callMatch) {
      const [, method, argsStr] = callMatch;
      const args = splitArgs(argsStr).map(a => transpileExpr(a.trim(), p, arrayVars));
      if (method === 'setPixel') {
        // setPixel(x, y, r, g, b, a) — all f32 (loop vars are f32)
        out += indent(depth) + `ctx_e.setPixel(${args[0]}, ${args[1]}, ${args[2]}, ${args[3]}, ${args[4]}, ${args[5]});\n`;
      } else if (method === 'clear') {
        out += indent(depth) + `ctx_e.clear();\n`;
      } else if (method === 'fade') {
        out += indent(depth) + `ctx_e.fade(${args[0]});\n`;
      } else {
        out += indent(depth) + `ctx_e.${method}(${args.join(', ')});\n`;
      }
      continue;
    }

    // Fallback — emit as comment
    out += indent(depth) + `// TODO: ${line}\n`;
  }
  // Close any remaining open blocks
  while (depth > 1) { depth--; out += indent(depth) + '}\n'; }
  return out;
}

// Transpile a JS expression to Zig, replacing e.method() calls with ctx_e equivalents
function transpileExpr(expr, p, arrayVars) {
  if (!expr) return '0';
  let e = expr.trim();
  // e.time → ctx_e.time
  e = e.replace(new RegExp(`\\b${p}\\.time\\b`, 'g'), 'ctx_e.time');
  // e.width / e.height → ctx_e.width / ctx_e.height (as f32)
  e = e.replace(new RegExp(`\\b${p}\\.width\\b`, 'g'), '@as(f32, @floatFromInt(ctx_e.width))');
  e = e.replace(new RegExp(`\\b${p}\\.height\\b`, 'g'), '@as(f32, @floatFromInt(ctx_e.height))');
  // e.hsv(h, s, v) → effect_ctx.EffectContext.hsvToRgb(h, s, v) — returns [3]f32
  e = e.replace(new RegExp(`\\b${p}\\.hsv\\(`, 'g'), 'effect_ctx.EffectContext.hsvToRgb(');
  // e.hsl(h, s, l) → effect_ctx.EffectContext.hslToRgb(h, s, l) — returns [3]f32
  e = e.replace(new RegExp(`\\b${p}\\.hsl\\(`, 'g'), 'effect_ctx.EffectContext.hslToRgb(');
  // e.dt → ctx_e.dt, e.frame → ctx_e.frame_count
  e = e.replace(new RegExp(`\\b${p}\\.dt\\b`, 'g'), 'ctx_e.dt');
  e = e.replace(new RegExp(`\\b${p}\\.frame\\b`, 'g'), '@as(f32, @floatFromInt(ctx_e.frame))');
  // Mouse
  e = e.replace(new RegExp(`\\b${p}\\.mouseX\\b`, 'g'), 'ctx_e.mouse_x');
  e = e.replace(new RegExp(`\\b${p}\\.mouseY\\b`, 'g'), 'ctx_e.mouse_y');
  e = e.replace(new RegExp(`\\b${p}\\.mouseInside\\b`, 'g'), '(if (ctx_e.mouse_inside) @as(f32, 1.0) else @as(f32, 0.0))');
  // e.sin(x) → @sin(x), e.sqrt(x) → @sqrt(x) — Zig builtins, not methods
  e = e.replace(new RegExp(`\\b${p}\\.(sin|cos|sqrt|abs|floor|ceil)\\(`, 'g'), '@$1(');
  e = e.replace(new RegExp(`\\b${p}\\.pow\\(`, 'g'), 'std.math.pow(f32, ');
  e = e.replace(new RegExp(`\\b${p}\\.fmod\\(`, 'g'), '@mod(');
  e = e.replace(new RegExp(`\\b${p}\\.mod\\(`, 'g'), '@mod(');
  e = e.replace(new RegExp(`\\b${p}\\.fract\\(`, 'g'), '@mod(1.0, ');  // fract(x) ≈ @mod(x, 1.0) — approximate
  e = e.replace(new RegExp(`\\b${p}\\.atan2\\(`, 'g'), 'std.math.atan2(');
  e = e.replace(new RegExp(`\\b${p}\\.atan\\(`, 'g'), 'std.math.atan(');
  e = e.replace(new RegExp(`\\b${p}\\.tan\\(`, 'g'), '@tan(');
  e = e.replace(new RegExp(`\\b${p}\\.exp\\(`, 'g'), '@exp(');
  e = e.replace(new RegExp(`\\b${p}\\.log\\(`, 'g'), '@log(');
  // Interpolation — ctx_e method calls
  e = e.replace(new RegExp(`\\b${p}\\.mix\\(`, 'g'), 'ctx_e.lerp(');
  e = e.replace(new RegExp(`\\b${p}\\.lerp\\(`, 'g'), 'ctx_e.lerp(');
  e = e.replace(new RegExp(`\\b${p}\\.clamp\\(`, 'g'), 'ctx_e.clampVal(');
  e = e.replace(new RegExp(`\\b${p}\\.smoothstep\\(`, 'g'), 'ctx_e.smoothstep(');
  e = e.replace(new RegExp(`\\b${p}\\.remap\\(`, 'g'), 'ctx_e.remap(');
  e = e.replace(new RegExp(`\\b${p}\\.dist\\(`, 'g'), 'ctx_e.dist(');
  e = e.replace(new RegExp(`\\b${p}\\.min\\(`, 'g'), '@min(');
  e = e.replace(new RegExp(`\\b${p}\\.max\\(`, 'g'), '@max(');
  e = e.replace(new RegExp(`\\b${p}\\.step\\(`, 'g'), 'ctx_e.step(');
  // Noise — ctx_e method calls
  e = e.replace(new RegExp(`\\b${p}\\.noise\\(`, 'g'), 'ctx_e.noise(');
  e = e.replace(new RegExp(`\\b${p}\\.noise3\\(`, 'g'), 'ctx_e.noise3(');
  e = e.replace(new RegExp(`\\b${p}\\.fbm\\(`, 'g'), 'ctx_e.fbm(');
  e = e.replace(new RegExp(`\\b${p}\\.voronoi\\(`, 'g'), 'ctx_e.voronoi(');
  // Math.PI
  e = e.replace(/\bMath\.PI\b/g, '3.14159265');
  // Convert .x/.y/.z to [0]/[1]/[2] for array-typed vars (voronoi, hsv, hsl results)
  if (arrayVars && arrayVars.size > 0) {
    for (const av of arrayVars) {
      e = e.replace(new RegExp(`\\b${av}\\.x\\b`, 'g'), `${av}[0]`);
      e = e.replace(new RegExp(`\\b${av}\\.y\\b`, 'g'), `${av}[1]`);
      e = e.replace(new RegExp(`\\b${av}\\.z\\b`, 'g'), `${av}[2]`);
    }
  }
  return e;
}

// Split function arguments respecting nested parens
function splitArgs(s) {
  const args = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') depth--;
    if (s[i] === ',' && depth === 0) { args.push(s.slice(start, i)); start = i + 1; }
  }
  args.push(s.slice(start));
  return args;
}
