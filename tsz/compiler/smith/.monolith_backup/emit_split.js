// ── Emit ──
// Debug flags — set to true to enable (output goes to generated .zig comments)
// globalThis.__SMITH_DEBUG_MAP_TEXT = true;
// globalThis.__SMITH_DEBUG_MAP_DETECT = true;
// globalThis.__SMITH_DEBUG_MAP_PTRS = true;

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

// ── Shared WGSL math library for GPU effects ────────────────────────
// Mirrors framework/gpu/effect_math.wgsl. Keep in sync.
function _effectMathWGSL() {
  return '' +
  // Hash functions
  'fn _hash(p: vec2f) -> f32 {\n  var h = dot(p, vec2f(127.1, 311.7));\n  return fract(sin(h) * 43758.5453123);\n}\n' +
  'fn _hash2(p: vec2f) -> vec2f {\n  let h = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));\n  return fract(sin(h) * 43758.5453123);\n}\n' +
  'fn _hash3(p: vec3f) -> f32 {\n  var h = dot(p, vec3f(127.1, 311.7, 74.7));\n  return fract(sin(h) * 43758.5453123);\n}\n' +
  // Noise 2D
  'fn snoise(px: f32, py: f32) -> f32 {\n' +
  '  let p = vec2f(px, py); let i = floor(p); let f = fract(p);\n' +
  '  let u = f * f * (3.0 - 2.0 * f);\n' +
  '  return mix(mix(_hash(i), _hash(i + vec2f(1.0, 0.0)), u.x), mix(_hash(i + vec2f(0.0, 1.0)), _hash(i + vec2f(1.0, 1.0)), u.x), u.y) * 2.0 - 1.0;\n}\n' +
  // Noise 3D
  'fn snoise3(px: f32, py: f32, pz: f32) -> f32 {\n' +
  '  let p = vec3f(px, py, pz); let i = floor(p); let f = fract(p);\n' +
  '  let u = f * f * (3.0 - 2.0 * f);\n' +
  '  let a00 = mix(_hash3(i), _hash3(i + vec3f(1.0, 0.0, 0.0)), u.x);\n' +
  '  let a10 = mix(_hash3(i + vec3f(0.0, 1.0, 0.0)), _hash3(i + vec3f(1.0, 1.0, 0.0)), u.x);\n' +
  '  let a01 = mix(_hash3(i + vec3f(0.0, 0.0, 1.0)), _hash3(i + vec3f(1.0, 0.0, 1.0)), u.x);\n' +
  '  let a11 = mix(_hash3(i + vec3f(0.0, 1.0, 1.0)), _hash3(i + vec3f(1.0, 1.0, 1.0)), u.x);\n' +
  '  return mix(mix(a00, a10, u.y), mix(a01, a11, u.y), u.z) * 2.0 - 1.0;\n}\n' +
  // FBM
  'fn fbm(px: f32, py: f32, octaves: f32) -> f32 {\n' +
  '  var val = 0.0; var amp = 0.5; var freq = 1.0; var x = px; var y = py;\n' +
  '  let oct = i32(clamp(octaves, 1.0, 8.0));\n' +
  '  for (var i = 0; i < oct; i = i + 1) {\n' +
  '    val = val + amp * snoise(x * freq, y * freq); freq = freq * 2.0; amp = amp * 0.5;\n' +
  '    x = x * 1.02 + 1.7; y = y * 1.02 + 3.1;\n  }\n  return val;\n}\n' +
  // Voronoi
  'fn voronoi(px: f32, py: f32) -> vec2f {\n' +
  '  let p = vec2f(px, py); let n = floor(p); let f = fract(p);\n' +
  '  var md = 8.0; var md2 = 8.0;\n' +
  '  for (var j = -1; j <= 1; j = j + 1) { for (var i = -1; i <= 1; i = i + 1) {\n' +
  '    let g = vec2f(f32(i), f32(j)); let o = _hash2(n + g); let r = g + o - f; let d = dot(r, r);\n' +
  '    if (d < md) { md2 = md; md = d; } else if (d < md2) { md2 = d; }\n' +
  '  } }\n  return vec2f(sqrt(md), sqrt(md2));\n}\n' +
  // HSV
  'fn hsv2rgb(h_in: f32, s: f32, v: f32) -> vec3f {\n' +
  '  if (s <= 0.0) { return vec3f(v, v, v); }\n' +
  '  let h = fract(h_in) * 6.0; let sector = u32(floor(h)); let f = h - floor(h);\n' +
  '  let p = v * (1.0 - s); let q = v * (1.0 - s * f); let t = v * (1.0 - s * (1.0 - f));\n' +
  '  switch (sector) {\n' +
  '    case 0u: { return vec3f(v, t, p); } case 1u: { return vec3f(q, v, p); }\n' +
  '    case 2u: { return vec3f(p, v, t); } case 3u: { return vec3f(p, q, v); }\n' +
  '    case 4u: { return vec3f(t, p, v); } default: { return vec3f(v, p, q); }\n  }\n}\n' +
  // HSL
  'fn _hue2rgb(p: f32, q: f32, t_in: f32) -> f32 {\n' +
  '  var t = fract(t_in);\n' +
  '  if (t < 1.0/6.0) { return p + (q - p) * 6.0 * t; }\n' +
  '  if (t < 0.5) { return q; }\n' +
  '  if (t < 2.0/3.0) { return p + (q - p) * (2.0/3.0 - t) * 6.0; }\n' +
  '  return p;\n}\n' +
  'fn hsl2rgb(h_in: f32, s: f32, l: f32) -> vec3f {\n' +
  '  if (s <= 0.0) { return vec3f(l, l, l); }\n' +
  '  let h = fract(h_in); let q = select(l + s - l * s, l * (1.0 + s), l < 0.5); let p = 2.0 * l - q;\n' +
  '  return vec3f(_hue2rgb(p, q, h + 1.0/3.0), _hue2rgb(p, q, h), _hue2rgb(p, q, h - 1.0/3.0));\n}\n' +
  // Distance / interpolation
  'fn _dist(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 { return length(vec2f(x1 - x2, y1 - y2)); }\n' +
  'fn _lerp(a: f32, b: f32, t: f32) -> f32 { return a + (b - a) * t; }\n' +
  'fn _remap(value: f32, in_min: f32, in_max: f32, out_min: f32, out_max: f32) -> f32 { return out_min + (out_max - out_min) * ((value - in_min) / (in_max - in_min)); }\n' +
  '\n';
}

// ── WGSL transpiler for GPU effects ──────────────────────────────────
// Converts JS onRender body to a complete WGSL shader string.
// The fragment shader runs per-pixel — no loops needed (global_invocation = pixel coord).
// Uses a render pipeline: vs_main outputs a fullscreen triangle, fs_main does the math.

function transpileEffectToWGSL(jsBody, param) {
  const p = param || 'e';
  const lines = jsBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Collect variable declarations and the setPixel call
  const vars = [];
  let setPixelArgs = null;
  const bodyLines = [];

  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    // Skip pure braces, for loops (x/y iteration handled by GPU dispatch)
    if (line === '{' || line === '}' || line === '};') continue;
    if (/^for\s*\(/.test(line)) continue;

    // const/let/var declaration
    const declMatch = line.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(.+?);?\s*$/);
    if (declMatch) {
      const [, vname, expr] = declMatch;
      // Skip x/y/fx/fy if they're just scaled coords — we compute those from frag coord
      if (vname === 'x' || vname === 'y') continue;
      const wgslExpr = transpileExprWGSL(expr, p);
      // Detect hsv/hsl → vec3f
      const isColor = new RegExp(`\\b${p}\\.(hsv|hsl)\\(`).test(expr);
      bodyLines.push(`  let ${vname} = ${wgslExpr};`);
      continue;
    }

    // e.setPixel(x, y, r, g, b, a)
    const spMatch = line.match(new RegExp(`^${p}\\.setPixel\\((.*)\\);?\\s*$`));
    if (spMatch) {
      const args = splitArgs(spMatch[1]).map(a => transpileExprWGSL(a.trim(), p));
      // In fragment shader, we don't need x,y — we return the color
      setPixelArgs = { r: args[2], g: args[3], b: args[4], a: args[5] };
      continue;
    }

    // if/else if/else
    const ifMatch = line.match(/^if\s*\((.+)\)\s*\{?\s*$/);
    if (ifMatch) {
      bodyLines.push(`  if (${transpileExprWGSL(ifMatch[1], p)}) {`);
      continue;
    }
    const elseIfMatch = line.match(/^}\s*else\s+if\s*\((.+)\)\s*\{?\s*$/);
    if (elseIfMatch) {
      bodyLines.push(`  } else if (${transpileExprWGSL(elseIfMatch[1], p)}) {`);
      continue;
    }
    if (/^}\s*else\s*\{?\s*$/.test(line)) {
      bodyLines.push('  } else {');
      continue;
    }
    if (line === '}' || line === '};') {
      bodyLines.push('  }');
      continue;
    }

    // Another setPixel inside a branch
    const spMatch2 = line.match(new RegExp(`^${p}\\.setPixel\\((.*)\\);?\\s*$`));
    if (spMatch2) {
      const args = splitArgs(spMatch2[1]).map(a => transpileExprWGSL(a.trim(), p));
      bodyLines.push(`    out_color = vec4f(${args[2]}, ${args[3]}, ${args[4]}, ${args[5]});`);
      continue;
    }
  }

  // Build the full WGSL shader
  let wgsl = '';
  wgsl += 'struct Uniforms {\n';
  wgsl += '  size_w: f32,\n  size_h: f32,\n  time: f32,\n  dt: f32,\n';
  wgsl += '  frame: f32,\n  mouse_x: f32,\n  mouse_y: f32,\n  mouse_inside: f32,\n';
  wgsl += '};\n\n';
  wgsl += '@group(0) @binding(0) var<uniform> u: Uniforms;\n\n';

  // Vertex shader — fullscreen triangle (3 vertices cover the screen)
  wgsl += 'struct VsOut {\n  @builtin(position) pos: vec4f,\n  @location(0) uv: vec2f,\n};\n\n';
  wgsl += '@vertex fn vs_main(@builtin(vertex_index) vi: u32) -> VsOut {\n';
  wgsl += '  // 6 vertices = 2 triangles covering [0,0]-[1,1]\n';
  wgsl += '  var pos = array<vec2f, 6>(\n';
  wgsl += '    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),\n';
  wgsl += '    vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0),\n';
  wgsl += '  );\n';
  wgsl += '  let p = pos[vi];\n';
  wgsl += '  var out: VsOut;\n';
  wgsl += '  out.pos = vec4f(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);\n';
  wgsl += '  out.uv = p;\n';
  wgsl += '  return out;\n';
  wgsl += '}\n\n';

  // Include shared math library — all effect helper functions
  // Source of truth: framework/gpu/effect_math.wgsl
  // Any new math functions go there + here simultaneously
  wgsl += _effectMathWGSL();

  // Fragment shader
  wgsl += '@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {\n';
  wgsl += '  let x = in.uv.x * u.size_w;\n';
  wgsl += '  let y = in.uv.y * u.size_h;\n';
  wgsl += '  var out_color = vec4f(0.0, 0.0, 0.0, 1.0);\n';
  for (const bl of bodyLines) {
    wgsl += bl + '\n';
  }
  if (setPixelArgs) {
    wgsl += `  out_color = vec4f(${setPixelArgs.r}, ${setPixelArgs.g}, ${setPixelArgs.b}, ${setPixelArgs.a});\n`;
  }
  wgsl += '  return out_color;\n';
  wgsl += '}\n';

  return wgsl;
}

// Transpile a JS expression to WGSL
function transpileExprWGSL(expr, p) {
  if (!expr) return '0.0';
  let e = expr.trim();
  // e.time → u.time, e.dt → u.dt, e.frame → u.frame
  e = e.replace(new RegExp(`\\b${p}\\.time\\b`, 'g'), 'u.time');
  e = e.replace(new RegExp(`\\b${p}\\.dt\\b`, 'g'), 'u.dt');
  e = e.replace(new RegExp(`\\b${p}\\.frame\\b`, 'g'), 'u.frame');
  // e.width / e.height → u.size_w / u.size_h
  e = e.replace(new RegExp(`\\b${p}\\.width\\b`, 'g'), 'u.size_w');
  e = e.replace(new RegExp(`\\b${p}\\.height\\b`, 'g'), 'u.size_h');
  // Mouse — already in uniforms
  e = e.replace(new RegExp(`\\b${p}\\.mouseX\\b`, 'g'), 'u.mouse_x');
  e = e.replace(new RegExp(`\\b${p}\\.mouseY\\b`, 'g'), 'u.mouse_y');
  e = e.replace(new RegExp(`\\b${p}\\.mouseInside\\b`, 'g'), 'u.mouse_inside');
  // Color helpers
  e = e.replace(new RegExp(`\\b${p}\\.hsv\\(`, 'g'), 'hsv2rgb(');
  e = e.replace(new RegExp(`\\b${p}\\.hsl\\(`, 'g'), 'hsl2rgb(');
  // Math builtins — direct WGSL equivalents
  e = e.replace(new RegExp(`\\b${p}\\.(sin|cos|sqrt|abs|floor|ceil|exp|exp2|log|log2)\\(`, 'g'), '$1(');
  e = e.replace(new RegExp(`\\b${p}\\.pow\\(`, 'g'), 'pow(');
  e = e.replace(new RegExp(`\\b${p}\\.fmod\\(`, 'g'), 'fract(');
  e = e.replace(new RegExp(`\\b${p}\\.fract\\(`, 'g'), 'fract(');
  e = e.replace(new RegExp(`\\b${p}\\.mix\\(`, 'g'), 'mix(');
  e = e.replace(new RegExp(`\\b${p}\\.clamp\\(`, 'g'), 'clamp(');
  e = e.replace(new RegExp(`\\b${p}\\.min\\(`, 'g'), 'min(');
  e = e.replace(new RegExp(`\\b${p}\\.max\\(`, 'g'), 'max(');
  e = e.replace(new RegExp(`\\b${p}\\.step\\(`, 'g'), 'step(');
  e = e.replace(new RegExp(`\\b${p}\\.smoothstep\\(`, 'g'), 'smoothstep(');
  e = e.replace(new RegExp(`\\b${p}\\.atan2\\(`, 'g'), 'atan2(');
  e = e.replace(new RegExp(`\\b${p}\\.atan\\(`, 'g'), 'atan(');
  e = e.replace(new RegExp(`\\b${p}\\.tan\\(`, 'g'), 'tan(');
  // Distance / vector ops
  e = e.replace(new RegExp(`\\b${p}\\.length\\(`, 'g'), 'length(vec2f(');
  e = e.replace(new RegExp(`\\b${p}\\.distance\\(`, 'g'), '_dist(');
  // Noise functions → WGSL helper calls
  e = e.replace(new RegExp(`\\b${p}\\.noise\\(`, 'g'), 'snoise(');
  e = e.replace(new RegExp(`\\b${p}\\.noise3\\(`, 'g'), 'snoise3(');
  e = e.replace(new RegExp(`\\b${p}\\.fbm\\(`, 'g'), 'fbm(');
  e = e.replace(new RegExp(`\\b${p}\\.voronoi\\(`, 'g'), 'voronoi(');
  // Interpolation → prefixed helpers (avoid WGSL keyword conflicts)
  e = e.replace(new RegExp(`\\b${p}\\.lerp\\(`, 'g'), '_lerp(');
  e = e.replace(new RegExp(`\\b${p}\\.remap\\(`, 'g'), '_remap(');
  e = e.replace(new RegExp(`\\b${p}\\.dist\\(`, 'g'), '_dist(');
  // Math.PI
  e = e.replace(/\bMath\.PI\b/g, '3.14159265');
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


// ── Split monolithic .zig output into per-concern files ──────────────
// Takes the monolith from emitOutput() and splits it into:
//   nodes.zig, handlers.zig, state.zig, maps.zig, logic.zig, app.zig
// Returns encoded multi-file string: __SPLIT_OUTPUT__\n__FILE:name__\ncontent...
function splitOutput(monolith, file) {
  var basename = file.split('/').pop();
  var appName = basename.replace(/\.tsz$/, '');
  var fastBuild = globalThis.__fastBuild === 1;
  var fwPrefix = 'framework/';

  // ── 1. Find section boundaries via existing markers + fn signatures ──
  var B = [];
  var patterns = [
    ['state_manifest', /^\/\/ ── State manifest/m],
    ['nodes',          /^\/\/ ── Generated node tree/m],
    ['dyntxt',         /^\/\/ ── Dynamic text buffers/m],
    ['handlers',       /^\/\/ ── Event handlers/m],
    ['effects',        /^\/\/ ── Effect render functions/m],
    ['oa',             /^const qjs = /m],
    ['maps',           /^\/\/ ── Map pools/m],
    ['jslogic',        /^\/\/ ── Embedded JS logic/m],
    ['lualogic',       /^\/\/ ── Embedded Lua logic/m],
    ['initstate',      /^fn _initState\(/m],
    ['updatedyn',      /^fn _updateDynamicTexts\(/m],
    ['updatecond',     /^fn _updateConditionals\(/m],
    ['updatevariants', /^fn _updateVariants\(/m],
    ['appinit',        /^fn _appInit\(/m],
    ['apptick',        /^fn _appTick\(/m],
    ['exports',        /^export fn app_get_root\(/m],
    ['stateexports',   /^export fn app_state_count\(/m],
    ['mainfn',         /^(?:pub fn main|export fn main_cart)\(/m],
    ['debug',          /^\/\/ ── SMITH DEBUG/m],
  ];
  for (var pi = 0; pi < patterns.length; pi++) {
    var pname = patterns[pi][0], pre = patterns[pi][1];
    var pm = pre.exec(monolith);
    if (pm) B.push({ name: pname, pos: pm.index });
  }
  B.sort(function(a, b) { return a.pos - b.pos; });

  // ── 2. Extract text between consecutive boundaries ──
  var sec = {};
  for (var i = 0; i < B.length; i++) {
    var end = i + 1 < B.length ? B[i + 1].pos : monolith.length;
    sec[B[i].name] = monolith.substring(B[i].pos, end);
  }

  // ── 3. Group sections into target files ──
  var F = {};
  F['nodes.zig']    = sec.nodes || '';
  F['handlers.zig'] = (sec.handlers || '') + (sec.effects || '');
  F['state.zig']    = (sec.state_manifest || '') + (sec.dyntxt || '') +
                      (sec.oa || '') + (sec.initstate || '');
  F['maps.zig']     = sec.maps || '';
  F['logic.zig']    = (sec.jslogic || '') + (sec.lualogic || '');
  F['app.zig']      = (sec.updatedyn || '') + (sec.updatecond || '') +
                      (sec.updatevariants || '') +
                      (sec.appinit || '') + (sec.apptick || '') +
                      (sec.exports || '') + (sec.stateexports || '') +
                      (sec.mainfn || '') + (sec.debug || '');

  // ── 4. Add pub to declarations so other files can @import them ──
  var pubFiles = ['nodes.zig', 'handlers.zig', 'state.zig', 'maps.zig', 'logic.zig'];
  for (var pfi = 0; pfi < pubFiles.length; pfi++) {
    var pfn = pubFiles[pfi];
    var c = F[pfn];
    if (!c) continue;
    c = c.replace(/^(var _)/gm, 'pub $1');
    c = c.replace(/^(const _)/gm, 'pub $1');
    c = c.replace(/^(const MAX_)/gm, 'pub $1');
    c = c.replace(/^(const QJS_)/gm, 'pub $1');
    c = c.replace(/^(const qjs )/gm, 'pub $1');
    c = c.replace(/^(const JS_LOGIC)/gm, 'pub $1');
    c = c.replace(/^(const LUA_LOGIC)/gm, 'pub $1');
    c = c.replace(/^(fn _)/gm, 'pub $1');
    // Dedup duplicate var declarations in state.zig (component inlining can re-register OAs)
    if (pfn === 'state.zig') {
      var seenVars = {};
      c = c.split('\n').filter(function(line) {
        var m = line.match(/^pub (var|const) (_oa\d+_\w+)\b/);
        if (m) {
          if (seenVars[m[2]]) return false;
          seenVars[m[2]] = true;
        }
        return true;
      }).join('\n');
    }
    F[pfn] = c;
  }

  // ── 5. Framework import paths stay as "framework/" ──
  // Forge creates a framework → ../framework symlink in the output directory.
  var allFnames = ['nodes.zig', 'handlers.zig', 'state.zig', 'maps.zig', 'logic.zig', 'app.zig'];

  // ── 6. Cross-reference namespace prefixes ──
  // Helper: collect locally declared _arr_ names in a file's content
  function localArrs(content) {
    var s = new Set();
    var re = /(?:pub )?var (_arr_\d+)\b/g, dm;
    while ((dm = re.exec(content)) !== null) s.add(dm[1]);
    return s;
  }
  // Helper: replace _arr_ refs that are NOT locally declared
  function prefixArrRefs(content, prefix) {
    var local = localArrs(content);
    return content.replace(/\b(_arr_\d+)\b/g, function(m, name) {
      return local.has(name) ? name : prefix + name;
    });
  }

  // nodes.zig: handler function refs → handlers.X
  if (F['nodes.zig']) {
    F['nodes.zig'] = F['nodes.zig'].replace(/= (_handler_\w+)/g, '= handlers.$1');
    F['nodes.zig'] = F['nodes.zig'].replace(/= (_effect_render_\w+)/g, '= handlers.$1');
    F['nodes.zig'] = F['nodes.zig'].replace(/= (_effect_shader_\w+)/g, '= handlers.$1');
  }

  // maps.zig: node refs → nodes.X, OA refs → st.X
  if (F['maps.zig']) {
    var mc = F['maps.zig'];
    mc = prefixArrRefs(mc, 'nodes.');
    mc = mc.replace(/\b(_root)\b/g, 'nodes.$1');
    mc = mc.replace(/\b(_oa\d+_\w+)\b/g, 'st.$1');
    mc = mc.replace(/\b(_dyn_(?:buf|text)_\d+)\b/g, 'st.$1');
    mc = mc.replace(/\b(_eval_buf_\d+)\b/g, 'st.$1');
    F['maps.zig'] = mc;
  }

  // app.zig: all cross-module refs
  if (F['app.zig']) {
    var ac = F['app.zig'];
    ac = prefixArrRefs(ac, 'nodes.');
    ac = ac.replace(/\b(_root)\b/g, 'nodes.$1');
    ac = ac.replace(/\b(_dyn_(?:buf|text)_\d+)\b/g, 'st.$1');
    ac = ac.replace(/\b(_eval_buf_\d+)\b/g, 'st.$1');
    ac = ac.replace(/\b(_oa\d+_\w+)\b/g, 'st.$1');
    ac = ac.replace(/\b(_setVariantHost)\b/g, 'st.$1');
    ac = ac.replace(/\b_initState\b/g, 'st._initState');
    ac = ac.replace(/\b(_pool_arena)\b/g, 'maps.$1');
    ac = ac.replace(/\b(_rebuildMap\d+)\b/g, 'maps.$1');
    ac = ac.replace(/\b(_map_count_\d+)\b/g, 'maps.$1');
    ac = ac.replace(/\b(_map_pool_\d+)\b/g, 'maps.$1');
    ac = ac.replace(/\b(_initMapLuaPtrs\d+_\d+)\b/g, 'maps.$1');
    ac = ac.replace(/\bJS_LOGIC\b/g, 'logic.JS_LOGIC');
    ac = ac.replace(/\bLUA_LOGIC\b/g, 'logic.LUA_LOGIC');
    F['app.zig'] = ac;
  }

  // ── 7. Build per-file import headers ──
  function mkHeader(fname) {
    var h = '//! Generated by tsz compiler \u2014 ' + appName + ' [' + fname + ']\n';
    h += '//! Source: ' + basename + '\n\n';

    if (fname !== 'logic.zig') h += 'const std = @import("std");\n';

    if (!fastBuild && fname !== 'logic.zig') {
      h += 'const build_options = @import("build_options");\n';
      h += 'const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;\n\n';
    }

    // Layout types
    if (fname === 'nodes.zig' || fname === 'maps.zig' || fname === 'app.zig') {
      if (fastBuild) {
        h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        h += 'const layout = api;\n';
        h += 'const Node = api.Node;\nconst Style = api.Style;\nconst Color = api.Color;\n';
      } else {
        h += 'const layout = @import("' + fwPrefix + 'layout.zig");\n';
        h += 'const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n';
      }
    }

    // Framework state module
    var needsState = F[fname] && F[fname].indexOf('state.') >= 0;
    if (needsState || fname === 'state.zig' || fname === 'app.zig') {
      if (fastBuild) {
        if (h.indexOf('const api =') < 0) h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        if (h.indexOf('const state =') < 0) h += 'const state = api.state;\n';
      } else {
        if (h.indexOf('const state =') < 0) h += 'const state = @import("' + fwPrefix + 'state.zig");\n';
      }
    }

    // Engine (app.zig only)
    if (fname === 'app.zig') {
      if (fastBuild) {
        if (h.indexOf('const api =') < 0) h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        h += 'const engine = api.engine;\n';
      } else {
        h += 'const engine = if (IS_LIB) struct {} else @import("' + fwPrefix + 'engine.zig");\n';
        // Ensure core.zig export symbols are in the link unit for monolithic builds
        h += 'comptime { if (!IS_LIB) _ = @import("' + fwPrefix + 'core.zig"); }\n';
      }
    }

    // qjs_runtime
    if (F[fname] && F[fname].indexOf('qjs_runtime.') >= 0) {
      if (fastBuild) {
        if (h.indexOf('const api =') < 0) h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        h += 'const qjs_runtime = api.qjs_runtime;\n';
      } else {
        h += 'const qjs_runtime = if (IS_LIB) struct {\n';
        h += '    pub fn callGlobal(_: []const u8) void {}\n';
        h += '    pub fn callGlobalStr(_: []const u8, _: []const u8) void {}\n';
        h += '    pub fn callGlobalInt(_: []const u8, _: i64) void {}\n';
        h += '    pub fn registerHostFn(_: []const u8, _: ?*const anyopaque, _: u8) void {}\n';
        h += '    pub fn evalExpr(_: []const u8) void {}\n';
        h += '} else @import("' + fwPrefix + 'qjs_runtime.zig");\n';
      }
    }

    // luajit_runtime
    if (F[fname] && F[fname].indexOf('luajit_runtime.') >= 0) {
      if (fastBuild) {
        if (h.indexOf('const api =') < 0) h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        h += 'const luajit_runtime = api.luajit_runtime;\n';
      } else {
        h += 'const luajit_runtime = if (IS_LIB) struct {\n';
        h += '    pub fn callGlobal(_: [*:0]const u8) void {}\n';
        h += '    pub fn setMapWrapper(_: usize, _: *anyopaque) void {}\n';
        h += '} else @import("' + fwPrefix + 'luajit_runtime.zig");\n';
      }
    }

    // Cross-module imports
    if (fname === 'nodes.zig' && F['nodes.zig'] && F['nodes.zig'].indexOf('handlers.') >= 0) {
      h += 'const handlers = @import("handlers.zig");\n';
    }
    if (fname === 'maps.zig') {
      if (F['maps.zig'] && F['maps.zig'].indexOf('nodes.') >= 0)
        h += 'const nodes = @import("nodes.zig");\n';
      if (F['maps.zig'] && F['maps.zig'].indexOf('st.') >= 0)
        h += 'const st = @import("state.zig");\n';
      if (F['maps.zig'] && F['maps.zig'].indexOf('handlers.') >= 0)
        h += 'const handlers = @import("handlers.zig");\n';
    }
    if (fname === 'app.zig') {
      h += 'const nodes = @import("nodes.zig");\n';
      h += 'const st = @import("state.zig");\n';
      if (F['maps.zig'] && F['maps.zig'].trim())
        h += 'const maps = @import("maps.zig");\n';
      if (F['handlers.zig'] && F['handlers.zig'].trim())
        h += 'const handlers = @import("handlers.zig");\n';
      h += 'const logic = @import("logic.zig");\n';
    }

    h += '\n';
    return h;
  }

  // ── 8. Add origin tags ──
  for (var oi = 0; oi < allFnames.length; oi++) {
    var ofn = allFnames[oi];
    if (!F[ofn]) continue;
    var oc = F[ofn];
    // Tag section headers
    oc = oc.replace(
      /^(\/\/ ── [^\n]+ ──[─]+)$/gm,
      '// [origin:' + appName + ':' + ofn.replace('.zig', '') + ']\n$1'
    );
    // Tag handler functions
    oc = oc.replace(
      /^((?:pub )?fn (_handler_\w+)\()/gm,
      '// [origin:' + appName + ':handler:$2]\n$1'
    );
    // Tag rebuild functions
    oc = oc.replace(
      /^((?:pub )?fn (_rebuildMap\d+)\()/gm,
      '// [origin:' + appName + ':map:$2]\n$1'
    );
    // Tag OA unpack
    oc = oc.replace(
      /^((?:pub )?fn (_oa\d+_unpack)\()/gm,
      '// [origin:' + appName + ':oa:$2]\n$1'
    );
    // Tag root node
    oc = oc.replace(
      /^((?:pub )?var _root )/gm,
      '// [origin:' + appName + ':root]\n$1'
    );
    F[ofn] = oc;
  }

  // ── 9. Assemble final files ──
  var result = {};
  for (var ri = 0; ri < allFnames.length; ri++) {
    var rfn = allFnames[ri];
    if (!F[rfn] || !F[rfn].trim()) {
      result[rfn] = '//! Generated by tsz compiler \u2014 ' + appName + ' [' + rfn + ']\n//! (no content for this cart)\n';
      continue;
    }
    result[rfn] = mkHeader(rfn) + F[rfn];
  }

  // ── 10. Encode as multi-file output ──
  var encoded = '__SPLIT_OUTPUT__\n';
  for (var ei = 0; ei < allFnames.length; ei++) {
    encoded += '__FILE:' + allFnames[ei] + '__\n';
    encoded += result[allFnames[ei]];
  }
  return encoded;
}


// ── JS_LOGIC + LUA_LOGIC generation ──
function emitLogicBlocks(ctx) {
  var out = '';
    // JS/Lua logic — with section dividers matching reference
    out += `\n// \u2500\u2500 Embedded JS logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    out += `const JS_LOGIC =\n`;
    // Generate JS logic: ambient namespaces + object array setters + script block
    const jsLines = [];

    // ── Ambient namespace objects ──
    // Provides time.*, sys.*, device.*, input.* as JS globals with live getters.
    // Uses existing host functions where available, JS Date for time values.
    jsLines.push('// Ambient namespaces');
    jsLines.push('var time = {');
    jsLines.push('  get hour() { return new Date().getHours(); },');
    jsLines.push('  get minute() { return String(new Date().getMinutes()).padStart(2, "0"); },');
    jsLines.push('  get second() { return String(new Date().getSeconds()).padStart(2, "0"); },');
    jsLines.push('  get year() { return new Date().getFullYear(); },');
    jsLines.push('  get month() { return new Date().getMonth() + 1; },');
    jsLines.push('  get day() { return new Date().getDate(); },');
    jsLines.push('  get fps() { return typeof getFps === "function" ? getFps() : 0; },');
    jsLines.push('  get delta() { return 16; },');
    jsLines.push('  get elapsed() { return Date.now(); },');
    jsLines.push('  get timestamp() { return Date.now(); },');
    jsLines.push('};');
    jsLines.push('var sys = {');
    jsLines.push('  get user() { return typeof __os_user !== "undefined" ? __os_user : "user"; },');
    jsLines.push('  get uptime() { return Math.floor(Date.now() / 1000); },');
    jsLines.push('  get os() { return "linux"; },');
    jsLines.push('  get host() { return "localhost"; },');
    jsLines.push('  get kernel() { return "unknown"; },');
    jsLines.push('};');
    jsLines.push('var device = {');
    jsLines.push('  get width() { return 1280; },');
    jsLines.push('  get height() { return 800; },');
    jsLines.push('  get battery() { return 100; },');
    jsLines.push('  get online() { return true; },');
    jsLines.push('  get dpi() { return 96; },');
    jsLines.push('};');
    jsLines.push('var input = {');
    jsLines.push('  mouse: {');
    jsLines.push('    get x() { return typeof getMouseX === "function" ? getMouseX() : 0; },');
    jsLines.push('    get y() { return typeof getMouseY === "function" ? getMouseY() : 0; },');
    jsLines.push('  },');
    jsLines.push('  keys: { shift: false, ctrl: false, alt: false },');
    jsLines.push('  touch: { count: 0 },');
    jsLines.push('};');
    jsLines.push('');

    // Object array JS var declarations + setters
    // For page mode (scriptBlock): var declarations here, setter functions AFTER scriptBlock
    //   so they override page.js setters that lack __setObjArr calls.
    // For non-page mode: both var + setter here (no conflict).
    var oaInitCalls = [];
    for (const oa of ctx.objectArrays) {
      if (oa.isNested || oa.isConst) continue; // nested OAs unpacked by parent, const OAs are static
      jsLines.push(`var ${oa.getter} = [];`);
      if (!ctx.scriptBlock && !globalThis.__scriptContent) {
        jsLines.push(`function ${oa.setter}(v) { ${oa.getter} = v; __setObjArr${oa.oaIdx}(v); }`);
      }
      // Reconstruct initial data from tokens and schedule setter call
      if (oa.initDataStartPos !== undefined && oa.initDataEndPos !== undefined && oa.setter) {
        var initParts = [];
        for (var ti = oa.initDataStartPos; ti < oa.initDataEndPos; ti++) {
          var tk = globalThis.__cursor.textAt(ti);
          // Convert single-quoted strings to double-quoted for consistent JS
          if (tk.length >= 2 && tk[0] === "'" && tk[tk.length - 1] === "'") {
            var inner = tk.slice(1, -1).replace(/"/g, '\\"');
            tk = '"' + inner + '"';
          }
          initParts.push(tk);
        }
        var initText = initParts.join(' ');
        // Strip outer () from useState( [...] )
        initText = initText.replace(/^\(\s*/, '').replace(/\s*\)\s*$/, '');
        if (initText.length > 2 && initText[0] === '[') {
          oaInitCalls.push(`${oa.setter}(${initText});`);
        }
      }
    }
    // Emit OA init calls after setter definitions are available
    if (oaInitCalls.length > 0) {
      jsLines.push('// OA initial data');
      for (var ii = 0; ii < oaInitCalls.length; ii++) jsLines.push(oaInitCalls[ii]);
    }
    // Script file imports — content passed via __scriptContent
    if (globalThis.__scriptContent) {
      // Emit state variable declarations (same as inline <script> path)
      for (const s of ctx.stateSlots) {
        const idx = ctx.stateSlots.indexOf(s);
        jsLines.push(`var ${s.getter} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
        const jsSetter = s.type === 'string' ? '__setStateString' : '__setState';
        jsLines.push(`function ${s.setter}(v) { ${s.getter} = v; ${jsSetter}(${idx}, v); }`);
        if (s._opaqueFor && s._opaqueSetter) {
          jsLines.push(`var ${s._opaqueFor} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
          jsLines.push(`function ${s._opaqueSetter}(v) { ${s._opaqueFor} = v; ${s.setter}(v); }`);
        }
      }
      // No setter rewriting needed — declared setter functions handle state updates
      // Strip <script>/<\/script> tags and 'export' keywords — file imports include them raw
      // QuickJS eval doesn't support ES module syntax, so 'export' must be removed
      // Strip tags, TS declarations, export keywords, and export { ... } blocks
      var _scriptRaw = globalThis.__scriptContent
        .replace(/export\s*\{[^}]*\}\s*;?/g, '')  // remove export { ... }; blocks entirely
        .split('\n')
        .filter(l => !/^\s*<\/?script>\s*$/.test(l))
        .filter(l => !/^\s*declare\s+/.test(l))
        .map(l => l.replace(/^export\s+/, ''))
        .map(l => l.replace(/:\s*(any|void|string|number|boolean)\b/g, ''));
      const scriptLines = _scriptRaw;
      for (const line of scriptLines) jsLines.push(line);
      jsLines.push('');  // trailing blank line
    }
    // Script block (inline <script>) or script file import — also emit state var declarations
    if (ctx.scriptBlock || globalThis.__scriptContent) {
      if (ctx.scriptBlock) {
        // Only emit state declarations if __scriptContent didn't already emit them
        if (!globalThis.__scriptContent) {
          for (const s of ctx.stateSlots) {
            const idx = ctx.stateSlots.indexOf(s);
            jsLines.push(`var ${s.getter} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
            const jsSetter = s.type === 'string' ? '__setStateString' : '__setState';
            jsLines.push(`function ${s.setter}(v) { ${s.getter} = v; ${jsSetter}(${idx}, v); }`);
            if (s._opaqueFor && s._opaqueSetter) {
              jsLines.push(`var ${s._opaqueFor} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
              jsLines.push(`function ${s._opaqueSetter}(v) { ${s._opaqueFor} = v; ${s.setter}(v); }`);
            }
          }
        }
        for (const line of ctx.scriptBlock.split('\n')) jsLines.push(line);
      }
      // OA setter functions — AFTER scriptBlock so they override any page.js setters
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue;
        jsLines.push(`function ${oa.setter}(v) { ${oa.getter} = v; __setObjArr${oa.oaIdx}(v); }`);
      }
      // Auto-call init(stateProxy) if script exports an init function
      // Convention: export function init(state) { state.arrayName = [...]; state.slotName = val; }
      // The proxy routes state.X = val to setX(val) for both OA setters and state setters.
      if (globalThis.__scriptContent && globalThis.__scriptContent.indexOf('function init(') >= 0) {
        var proxyProps = [];
        for (const oa of ctx.objectArrays) {
          if (oa.isNested || oa.isConst) continue;
          proxyProps.push(`set ${oa.getter}(v) { ${oa.setter}(v); }`);
        }
        for (const s of ctx.stateSlots) {
          proxyProps.push(`set ${s.getter}(v) { ${s.setter}(v); }`);
          if (s._opaqueFor && s._opaqueSetter) proxyProps.push(`set ${s._opaqueFor}(v) { ${s._opaqueSetter}(v); }`);
        }
        if (proxyProps.length > 0) {
          jsLines.push(`if (typeof init === 'function') init({ ${proxyProps.join(', ')} });`);
        }
      }
      // Computed OAs derived from render-local expressions need to be materialized
      // after script/state declarations exist, before the initial Zig-side OA push.
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue;
        if (!oa._computedExpr) continue;
        jsLines.push(`${oa.getter} = ${oa._computedExpr};`);
      }
      // Auto-push initial OA data to Zig side — script block may have set initial values
      // that need to flow through __setObjArr to be visible in the node tree.
      // Without this, data defined in <script> stays in JS-land and maps render empty.
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue;
        jsLines.push(`if (${oa.getter} && ${oa.getter}.length > 0) ${oa.setter}(${oa.getter});`);
      }
      // useEffect bodies — mount-time init code from App body
      if (ctx._useEffectBodies && ctx._useEffectBodies.length > 0) {
        for (const body of ctx._useEffectBodies) {
          jsLines.push(body);
        }
      }
      // setVariant JS wrapper — bridges JS handler calls to Zig theme.setVariant
      if (ctx.variantBindings && ctx.variantBindings.length > 0) {
        jsLines.push(`function setVariant(v) { __setVariant(v); }`);
      }
      // Emit JS wrapper functions for prop-forwarded handler closures
      // These are handlers created from closure props (e.g., onSelect={(next) => { selectTab(next) }})
      // that get called with arguments from inside inlined components (e.g., onSelect(0))
      for (const h of ctx.handlers) {
        if (h.inMap) continue; // map handlers have their own __mapPress wrappers
        if (!h.luaBody) continue;
        if (!h.closureParams || h.closureParams.length === 0) continue;
        // Check if this handler name is referenced in any other handler's luaBody or in node js_on_press strings
        const hName = h.name;
        const isReferenced = ctx.handlers.some(function(h2) { return h2 !== h && h2.luaBody && h2.luaBody.indexOf(hName + '(') >= 0; });
        if (!isReferenced) continue;
        const params = h.closureParams.join(', ');
        let jsBody = h.luaBody || '';
        if (jsBody) jsBody = jsTransform(jsBody);
        jsLines.push(`function ${hName}(${params}) { ${jsBody}; }`);
      }
      // Add __mapPress_N handlers to JS_LOGIC so map handlers dispatch through QuickJS
      for (let mi = 0; mi < ctx.maps.length; mi++) {
        const m = ctx.maps[mi];
        const mapHandlers = ctx.handlers.filter(h => h.inMap && h.mapIdx === mi);
        for (let hi = 0; hi < mapHandlers.length; hi++) {
          const mh = mapHandlers[hi];
          // Build JS handler body from luaBody or Zig body
          let jsHandlerBody = mh.luaBody || '';
          // Convert Lua operators to JS in map handler bodies
          if (jsHandlerBody) jsHandlerBody = jsTransform(jsHandlerBody);
          if (!jsHandlerBody) {
            // Extract callGlobal("func") → func()
            const calls = (mh.body || '').match(/qjs_runtime\.callGlobal\("(\w+)"\)/g);
            if (calls) jsHandlerBody = calls.map(c => { const m2 = c.match(/"(\w+)"/); return m2 ? m2[1] + '()' : ''; }).filter(Boolean).join('; ');
            // Extract setSlot(N, expr) → setterName(expr)
            const sets = (mh.body || '').match(/state\.setSlot\((\d+),\s*([^)]+)\)/g);
            if (sets) {
              const setParts = sets.map(s => { const m2 = s.match(/state\.setSlot\((\d+),\s*([^)]+)\)/); if (!m2) return ''; const ss = ctx.stateSlots[parseInt(m2[1])]; return ss ? ss.setter + '(' + m2[2].replace(/state\.getSlot\((\d+)\)/g, (_, si) => { const s2 = ctx.stateSlots[parseInt(si)]; return s2 ? s2.getter : '__getState(' + si + ')'; }) + ')' : ''; }).filter(Boolean);
              jsHandlerBody = (jsHandlerBody ? jsHandlerBody + '; ' : '') + setParts.join('; ');
            }
          }
          if (jsHandlerBody) {
            if ((m.isNested || m.isInline) && m.parentMap) {
              // Nested/inline map handler receives (parent_idx, item_idx)
              const outerIdxParam = m.parentMap.indexParam || 'gi';
              const innerIdxParam = m.indexParam || 'ii';
              jsLines.push(`function __mapPress_${mi}_${hi}(${outerIdxParam}, ${innerIdxParam}) {`);
              // Declare item variables for parent and inner maps so handler body can access fields
              if (m.parentMap.oa) {
                jsLines.push(`  var ${m.parentMap.itemParam} = ${m.parentMap.oa.getter}[${outerIdxParam}];`);
              }
              if (m.oa) {
                jsLines.push(`  var ${m.itemParam} = ${m.oa.getter}[${innerIdxParam}];`);
              }
              jsLines.push(`  ${jsHandlerBody};`);
              jsLines.push(`}`);
              mh._emittedInJS = true;
              continue;
            }
            jsLines.push(`function __mapPress_${mi}_${hi}(idx) {`);
            if (m.oa) {
              jsLines.push(`  var ${m.itemParam} = ${m.oa.getter}[idx];`);
              jsLines.push(`  var ${m.indexParam} = idx;`);
              // Extract component props that map to item fields (e.g., label → item.label)
              for (const f of m.oa.fields) {
                if (f.type === 'nested_array') continue;
                const pat = new RegExp(`\\b${f.name}\\b`);
                if (pat.test(jsHandlerBody) && f.name !== m.itemParam && f.name !== m.indexParam) {
                  jsLines.push(`  var ${f.name} = ${m.itemParam}.${f.name};`);
                }
              }
            }
            // Declare JS variables for component props that were Zig expressions
            // (luaParseHandler emitted the prop name; now we need to bind it to a JS value)
            if (mh.zigProps) {
              for (const [propName, zigVal] of Object.entries(mh.zigProps)) {
                const propPat = new RegExp(`\\b${propName}\\b`);
                if (!propPat.test(jsHandlerBody)) continue;
                // Already declared as OA field or map param — skip
                if (m.oa && m.oa.fields.some(f => f.name === propName)) continue;
                if (propName === (m && m.itemParam) || propName === (m && m.indexParam)) continue;
                // Convert Zig expression to JS equivalent
                let jsVal = zigVal;
                // @as(i64, @intCast(_i)) or @as(i64, @intCast(_j)) → idx (map index)
                if (/^@as\(i64,\s*@intCast\(_[ij]\)\)$/.test(zigVal)) {
                  jsVal = 'idx';
                }
                // _oaN_field[_i] → item.field (OA field access from current or parent map)
                else if (/^_oa(\d+)_(\w+)\[_i\]$/.test(zigVal)) {
                  const oaMatch = zigVal.match(/^_oa(\d+)_(\w+)\[_i\]$/);
                  if (oaMatch) {
                    const oaIdx = parseInt(oaMatch[1]);
                    const field = oaMatch[2];
                    // Find which OA this belongs to and use its getter
                    const srcOa = ctx.objectArrays.find(o => o.oaIdx === oaIdx);
                    if (srcOa) jsVal = `${srcOa.getter}[idx].${field}`;
                    else jsVal = `idx`;
                  }
                }
                // _oaN_field[_i][0.._oaN_field_lens[_i]] → item.field (string OA field)
                else if (/^_oa(\d+)_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]$/.test(zigVal)) {
                  const oaMatch = zigVal.match(/^_oa(\d+)_(\w+)\[_i\]/);
                  if (oaMatch) {
                    const oaIdx = parseInt(oaMatch[1]);
                    const field = oaMatch[2];
                    const srcOa = ctx.objectArrays.find(o => o.oaIdx === oaIdx);
                    if (srcOa) jsVal = `${srcOa.getter}[idx].${field}`;
                    else jsVal = `idx`;
                  }
                }
                // state.getSlot(N) → getter name
                else if (/^state\.getSlot\((\d+)\)$/.test(zigVal)) {
                  const slotMatch = zigVal.match(/^state\.getSlot\((\d+)\)$/);
                  if (slotMatch) {
                    const ss = ctx.stateSlots[parseInt(slotMatch[1])];
                    jsVal = ss ? ss.getter : zigVal;
                  }
                }
                jsLines.push(`  var ${propName} = ${jsVal};`);
              }
            }
            jsLines.push(`  ${jsHandlerBody};`);
            jsLines.push(`}`);
            mh._emittedInJS = true;
          }
        }
      }
    }
    // Emit JS wrappers for handlers delegated from Zig (string concat, etc.)
    // This runs outside the scriptBlock conditional since delegated handlers
    // can occur in non-script tests (e.g., component prop string concat).
    var _hasDelegated = ctx.handlers.some(function(h) { return !h.inMap && h._delegateToJs; });
    if (_hasDelegated) {
      // Ensure state var declarations exist in JS_LOGIC for delegated handlers
      if (!ctx.scriptBlock && !globalThis.__scriptContent) {
        for (var _di = 0; _di < ctx.stateSlots.length; _di++) {
          var _ds = ctx.stateSlots[_di];
          var _djsSetter = _ds.type === 'string' ? '__setStateString' : '__setState';
          jsLines.push('var ' + _ds.getter + ' = ' + (_ds.type === 'string' ? "'" + _ds.initial + "'" : _ds.initial) + ';');
          jsLines.push('function ' + _ds.setter + '(v) { ' + _ds.getter + ' = v; ' + _djsSetter + '(' + _di + ', v); }');
        }
      }
      for (var _dhi = 0; _dhi < ctx.handlers.length; _dhi++) {
        var _dh = ctx.handlers[_dhi];
        if (_dh.inMap) continue;
        if (!_dh._delegateToJs) continue;
        var _djsBody = _dh.luaBody || '';
        if (_djsBody) _djsBody = jsTransform(_djsBody);
        if (_djsBody) jsLines.push('function ' + _dh.name + '() { ' + _djsBody + '; }');
      }
    }
    // Append __evalDynTexts for JS-evaluated dynamic text expressions (e.g., {fmtTime()})
    // __computeRenderBody: emit the full render body as a JS function when there are
    // imperative render locals (for loops, Map.set, etc.) that can't be captured as expressions.
    // This replaces the broken individual OA init expressions with one function that runs the
    // full computation and pushes results via OA setters.
    // __computeRenderBody: emit the full render body as a JS function when there are
    // imperative patterns (for loops, new Map, etc.) that individual OA inits can't capture.
    var _rbCompact = ctx._renderBodyRaw ? ctx._renderBodyRaw.replace(/\s+/g, '') : '';
    var _hasImperativeBody = _rbCompact.indexOf('newMap') >= 0 || _rbCompact.indexOf('newSet') >= 0 ||
      _rbCompact.indexOf('.set(') >= 0 || _rbCompact.indexOf('.add(') >= 0 ||
      _rbCompact.indexOf('for(') >= 0 || _rbCompact.indexOf('Array.from') >= 0;
    if (ctx._renderBodyRaw && _hasImperativeBody && ctx.objectArrays.length > 0) {
      jsLines.push('function __computeRenderBody() {');
      jsLines.push('  try {');
      for (var _rbLine of ctx._renderBodyRaw.split(';')) {
        // Replace const/let with var so variables persist in QJS global scope
        // (evalToString calls need to see treeNodes, sortedTags, etc.)
        var _rbl = _rbLine.trim().replace(/^const\s+/, 'var ').replace(/^let\s+/, 'var ');
        if (_rbl.length > 0) jsLines.push('    ' + _rbl + ';');
      }
      // Push all non-const, non-nested OAs — use base name (render body var) not suffixed getter
      for (var _oai = 0; _oai < ctx.objectArrays.length; _oai++) {
        var _oa = ctx.objectArrays[_oai];
        if (_oa.isConst || _oa.isNested) continue;
        var _oaName = _oa._computedGetter || _oa.getter;
        var _oaBaseName = _oaName ? _oaName.replace(/_\d+$/, '') : _oaName;
        jsLines.push('    if (typeof ' + _oaBaseName + ' !== "undefined" && ' + _oaBaseName + ' && ' + _oaBaseName + '.length > 0) ' + _oa.setter + '(' + _oaBaseName + ');');
      }
      jsLines.push('  } catch(e) {}');
      jsLines.push('}');
      jsLines.push('__computeRenderBody();');
      jsLines.push('setInterval(__computeRenderBody, 16);');
    }
    if (ctx._jsDynTexts && ctx._jsDynTexts.length > 0) {
      jsLines.push('function __evalDynTexts() {');
      for (var jdi = 0; jdi < ctx._jsDynTexts.length; jdi++) {
        var jdt = ctx._jsDynTexts[jdi];
        jsLines.push('  try { __setStateString(' + jdt.slotIdx + ', String(' + jdt.jsExpr + ')); } catch(e) {}');
      }
      jsLines.push('}');
      jsLines.push('__evalDynTexts();');
      jsLines.push('setInterval(__evalDynTexts, 16);');
    }
    for (const line of jsLines) {
      out += `    \\\\${line}\n`;
    }
    out += `    \\\\\n;\n`;
    out += `\n// \u2500\u2500 Embedded Lua logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    out += `const LUA_LOGIC =\n`;
    // Generate Lua state variable declarations + setter functions
    const luaLines = [];
    const hasLuaHandlers = ctx.handlers.some(h => h.luaBody);
    // Only emit Lua state setters when there's an <lscript> block
    if (ctx.luaBlock && (hasLuaHandlers || ctx.stateSlots.length > 0)) {
      luaLines.push('-- State variables (mirroring Zig state slots)');
      for (let si = 0; si < ctx.stateSlots.length; si++) {
        const s = ctx.stateSlots[si];
        const luaInit = s.type === 'string' ? `'${s.initial}'` : (s.type === 'boolean' ? (s.initial ? 'true' : 'false') : s.initial);
        luaLines.push(`${s.getter} = ${luaInit}`);
      }
      luaLines.push('');
      // Setter functions: update local + push to Zig state slot
      for (let si = 0; si < ctx.stateSlots.length; si++) {
        const s = ctx.stateSlots[si];
        if (s.type === 'string') {
          luaLines.push(`function ${s.setter}(v) ${s.getter} = v; __setStateString(${si}, v) end`);
        } else {
          luaLines.push(`function ${s.setter}(v) ${s.getter} = v; __setState(${si}, v) end`);
        }
      }
      luaLines.push('');
    }
    // Object array data loading via Lua (only when <lscript> block exists)
    if (ctx.luaBlock) {
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue; // nested OAs unpacked by parent, const OAs are static
        luaLines.push(`local ${oa.getter} = {}`);
        luaLines.push(`function ${oa.setter}(v) ${oa.getter} = v; __setObjArr${oa.oaIdx}(v) end`);
      }
    }
    // Map handler functions in Lua — MUST come before script content
    // (script may call OA setters that fail in Lua, aborting the rest of the script)
    // (script may call OA setters that fail in Lua, aborting the rest of the script)
    for (let mi = 0; mi < ctx.maps.length; mi++) {
      const mapHandlers = ctx.handlers.filter(h => h.inMap && h.mapIdx === mi);
      for (let hi = 0; hi < mapHandlers.length; hi++) {
        const mh = mapHandlers[hi];
        if (mh.luaBody && !mh._emittedInJS) {
          const m = ctx.maps[mi];
          if (m.isNested && m.parentMap) {
            // Nested map handler receives (parent_idx, item_idx)
            const outerIdxParam = m.parentMap.indexParam || 'gi';
            const innerIdxParam = m.indexParam || 'ii';
            luaLines.push(`function __mapPress_${mi}_${hi}(${outerIdxParam}, ${innerIdxParam})`);
            luaLines.push(`  ${luaTransform(mh.luaBody)}`);
            luaLines.push(`end`);
          } else {
            // Top-level map handler — scan for item.field refs and pass as args
            const oa = m.oa;
            const ip = m.itemParam;
            const fieldRefs = [];
            if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
              ctx._debugLines.push('[MAP_HANDLER_SCAN] mi=' + mi + ' hi=' + hi + ' ip=' + ip + ' luaBody=' + (mh.luaBody || '').substring(0, 120) + ' oa=' + (oa ? 'yes fields=' + oa.fields.map(f => f.name).join(',') : 'null'));
            }
            if (oa) {
              for (const f of oa.fields) {
                if (f.type === 'nested_array') continue;
                const pat = new RegExp(`\\b${ip}\\.${f.name}\\b`);
                const matched = pat.test(mh.luaBody);
                if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
                  ctx._debugLines.push('[MAP_HANDLER_SCAN]   field=' + f.name + ' pat=' + pat + ' match=' + matched);
                }
                if (matched) fieldRefs.push(f);
              }
            }
            const params = ['idx', ...fieldRefs.map(f => `_f_${f.name}`)];
            luaLines.push(`function __mapPress_${mi}_${hi}(${params.join(', ')})`);
            if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
              const printArgs = params.map(p => `tostring(${p})`).join(' .. "," .. ');
              luaLines.push(`  print("[MAP_PRESS_DEBUG] __mapPress_${mi}_${hi} args=" .. ${printArgs})`);
            }
            luaLines.push(`  local ${m.indexParam} = idx`);
            let body = luaTransform(mh.luaBody);
            for (const f of fieldRefs) {
              body = body.replace(new RegExp(`\\b${ip}\\.${f.name}\\b`, 'g'), `_f_${f.name}`);
            }
            luaLines.push(`  ${body}`);
            luaLines.push(`end`);
            // Store field refs for Zig ptr building (per-handler)
            if (!m._handlerFieldRefsMap) m._handlerFieldRefsMap = {};
            m._handlerFieldRefsMap[hi] = fieldRefs;
            m._handlerFieldRefs = fieldRefs; // keep for backward compat
          }
          luaLines.push('');
        }
      }
    }
    // Inline <lscript> block content — emitted raw as Lua
    if (ctx.luaBlock) {
      luaLines.push('-- <lscript> block');
      for (const line of ctx.luaBlock.split('\n')) {
        luaLines.push(line);
      }
      luaLines.push('');
    }
    // Lua-side dynamic text evaluation (mirrors JS __evalDynTexts)
    if (ctx._luaDynTexts && ctx._luaDynTexts.length > 0) {
      luaLines.push('-- Dynamic text expressions');
      luaLines.push('local __evalInterval = nil');
      luaLines.push('function __evalDynTexts()');
      for (const ldt of ctx._luaDynTexts) {
        luaLines.push(`  pcall(function() ${ctx.stateSlots[ldt.slotIdx].setter}(tostring(${ldt.luaExpr})) end)`);
      }
      luaLines.push('end');
      luaLines.push('__evalDynTexts()');
      luaLines.push('if __evalInterval then __evalInterval:stop() end');
      luaLines.push('__evalInterval = __setInterval(__evalDynTexts, 16)');
      luaLines.push('');
    }
    // Script file imports — NOT included in LUA_LOGIC.
    // QuickJS runs the script content via JS_LOGIC. Including it in Lua
    // causes syntax errors (JS for loops, .push(), etc.) that abort the
    // entire Lua chunk, killing setter/handler definitions above it.
    // Inline script block — NOT included in LUA_LOGIC.
    // Script content goes into JS_LOGIC only. Including it in Lua causes syntax errors
    // (JS arrays, for loops, ===, etc.) that abort the entire Lua chunk.
    // Lua map rebuilders — emitted when .map() sources aren't registered OAs
    if (ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0) {
      luaLines.push('-- Lua map rebuilders (detour from Zig OA path)');
      for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
        var lmr = ctx._luaMapRebuilders[lmi];
        for (var ll of lmr.luaCode.split('\n')) luaLines.push(ll);
      }
      // Master rebuild function called on state change
      luaLines.push('function __rebuildLuaMaps()');
      luaLines.push('  __clearLuaNodes()');
      for (var lmi2 = 0; lmi2 < ctx._luaMapRebuilders.length; lmi2++) {
        luaLines.push('  __rebuildLuaMap' + lmi2 + '()');
      }
      luaLines.push('end');
      luaLines.push('');
    }
    // Emit Lua lines as Zig multiline string
    if (luaLines.length > 0) {
      for (const line of luaLines) {
        out += `    \\\\${line}\n`;
      }
    }
    out += `    \\\\\n;\n\n`;
  return out;
}

// ── JS→Lua method/syntax transforms ──
// Applied to handler luaBody and LUA_LOGIC script content.
// Ported from love2d/cli/lib/tsl.mjs method call transforms.
function luaTransform(code) {
  if (!code) return code;
  let s = code;
  // Operators: !== → ~=, === → ==, != → ~=, || → or, && → and, ! → not
  s = s.replace(/!==/g, '~=');
  s = s.replace(/===/g, '==');
  s = s.replace(/!=/g, '~=');
  s = s.replace(/\|\|/g, ' or ');
  s = s.replace(/&&/g, ' and ');
  // !expr → not expr (but not != which is already handled)
  s = s.replace(/!(?!=|=)/g, 'not ');
  // Control flow: if/else/elseif/while/for → Lua equivalents
  // } else if (cond) { → elseif cond then (must come before } else {)
  s = s.replace(/\}\s*else\s+if\s*\(([^)]+)\)\s*\{/g, ' elseif $1 then ');
  // } else { → else
  s = s.replace(/\}\s*else\s*\{/g, ' else ');
  // if (cond) { → if cond then
  s = s.replace(/\bif\s*\(([^)]+)\)\s*\{/g, 'if $1 then ');
  // while (cond) { → while cond do
  s = s.replace(/\bwhile\s*\(([^)]+)\)\s*\{/g, 'while $1 do ');
  // for (const/let x of arr) { → for _, x in ipairs(arr) do
  s = s.replace(/\bfor\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+(\w+)\)\s*\{/g, 'for _, $1 in ipairs($2) do ');
  // for (const/let x in obj) { → for x, _ in pairs(obj) do
  s = s.replace(/\bfor\s*\(\s*(?:const|let|var)\s+(\w+)\s+in\s+(\w+)\)\s*\{/g, 'for $1, _ in pairs($2) do ');
  // Standalone } → end (block closers)
  s = s.replace(/;\s*\}/g, '; end ');
  s = s.replace(/\}\s*$/g, ' end');
  s = s.replace(/\bthen\s+end\b/g, 'then'); // undo false "end" after empty then
  // const/let/var → local
  s = s.replace(/\b(const|let|var)\s+/g, 'local ');
  // null/undefined → nil
  s = s.replace(/\bnull\b/g, 'nil');
  s = s.replace(/\bundefined\b/g, 'nil');
  // .length → #
  s = s.replace(/(\w+)\.length\b/g, '#$1');
  // console.log(...) → print(...)
  s = s.replace(/console\.(log|warn|error)\(/g, 'print(');
  // Math methods
  s = s.replace(/Math\.floor\(/g, 'math.floor(');
  s = s.replace(/Math\.ceil\(/g, 'math.ceil(');
  s = s.replace(/Math\.round\(([^)]+)\)/g, 'math.floor($1 + 0.5)');
  s = s.replace(/Math\.abs\(/g, 'math.abs(');
  s = s.replace(/Math\.sqrt\(/g, 'math.sqrt(');
  s = s.replace(/Math\.min\(/g, 'math.min(');
  s = s.replace(/Math\.max\(/g, 'math.max(');
  s = s.replace(/Math\.sin\(/g, 'math.sin(');
  s = s.replace(/Math\.cos\(/g, 'math.cos(');
  s = s.replace(/Math\.pow\(/g, 'math.pow(');
  s = s.replace(/Math\.random\(\)/g, 'math.random()');
  s = s.replace(/Math\.PI\b/g, 'math.pi');
  // parseInt/parseFloat → tonumber
  s = s.replace(/parseInt\(/g, 'tonumber(');
  s = s.replace(/parseFloat\(/g, 'tonumber(');
  s = s.replace(/Number\(/g, 'tonumber(');
  // String methods
  s = s.replace(/(\w+)\.toUpperCase\(\)/g, 'string.upper($1)');
  s = s.replace(/(\w+)\.toLowerCase\(\)/g, 'string.lower($1)');
  s = s.replace(/(\w+)\.trim\(\)/g, '$1:match("^%s*(.-)%s*$")');
  s = s.replace(/(\w+)\.startsWith\(([^)]+)\)/g, '(string.sub($1, 1, #$2) == $2)');
  s = s.replace(/(\w+)\.endsWith\(([^)]+)\)/g, '(string.sub($1, -#$2) == $2)');
  s = s.replace(/(\w+)\.includes\(([^)]+)\)/g, '(string.find($1, $2, 1, true) ~= nil)');
  s = s.replace(/(\w+)\.indexOf\(([^)]+)\)/g, '(string.find($1, $2, 1, true) or 0)');
  s = s.replace(/(\w+)\.replace\(([^,]+),\s*([^)]+)\)/g, 'string.gsub($1, $2, $3)');
  s = s.replace(/(\w+)\.split\(([^)]+)\)/g, '__split($1, $2)');
  s = s.replace(/(\w+)\.join\(([^)]*)\)/g, 'table.concat($1, $2)');
  s = s.replace(/(\w+)\.toString\(\)/g, 'tostring($1)');
  // Array methods
  s = s.replace(/(\w+)\.push\(([^)]+)\)/g, 'table.insert($1, $2)');
  s = s.replace(/(\w+)\.pop\(\)/g, 'table.remove($1)');
  s = s.replace(/(\w+)\.shift\(\)/g, 'table.remove($1, 1)');
  s = s.replace(/(\w+)\.unshift\(([^)]+)\)/g, 'table.insert($1, 1, $2)');
  s = s.replace(/(\w+)\.sort\(\)/g, 'table.sort($1)');
  s = s.replace(/(\w+)\.reverse\(\)/g, '__reverse($1)');
  // JSON
  s = s.replace(/JSON\.stringify\(/g, '__jsonEncode(');
  s = s.replace(/JSON\.parse\(/g, '__jsonDecode(');
  // typeof → type()
  s = s.replace(/typeof\s+(\w+)/g, 'type($1)');
  // Template literals `...${expr}...` → "..." .. expr .. "..."
  s = s.replace(/`([^`]*)`/g, function(_, content) {
    var parts = [];
    var last = 0;
    var re = /\$\{([^}]+)\}/g;
    var m;
    while ((m = re.exec(content)) !== null) {
      if (m.index > last) parts.push('"' + content.slice(last, m.index) + '"');
      parts.push(m[1]);
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push('"' + content.slice(last) + '"');
    return parts.join(' .. ') || '""';
  });
  return s;
}

// Transform JS handler/script code for QuickJS (lighter — just fix operators)
function jsTransform(code) {
  if (!code) return code;
  var s = code;
  // Lua operators that leaked into JS bodies → convert back
  s = s.replace(/\band\b/g, '&&');
  s = s.replace(/\bor\b/g, '||');
  s = s.replace(/~=/g, '!=');
  s = s.replace(/\bnot\b/g, '!');
  s = s.replace(/ \.\. /g, ' + ');
  return s;
}
