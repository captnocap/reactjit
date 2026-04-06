// ── WGSL effect transpiler (JS → WGSL compute shaders) ──
// Extracted from emit_split.js per FUNCTIONS_MANIFEST.
// _effectMathWGSL, transpileEffectToWGSL, transpileExprWGSL

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
  // Mod helper (WGSL has no mod() builtin for floats — use % or this)
  'fn _mod(a: f32, b: f32) -> f32 { return a - b * floor(a / b); }\n' +
  // Distance / interpolation
  'fn _dist(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 { return length(vec2f(x1 - x2, y1 - y2)); }\n' +
  'fn _lerp(a: f32, b: f32, t: f32) -> f32 { return a + (b - a) * t; }\n' +
  'fn _remap(value: f32, in_min: f32, in_max: f32, out_min: f32, out_max: f32) -> f32 { return out_min + (out_max - out_min) * ((value - in_min) / (in_max - in_min)); }\n' +
  '\n';
}

// ── WGSL transpiler for GPU effects ──────────────────────────────────
// Converts JS onRender body to a complete WGSL shader string.
// The fragment shader runs per-pixel. Pixel-iteration loops (for x/y over width/height)
// are stripped since the GPU handles per-pixel dispatch. All other loops become WGSL loops.
//
// setPixel(x, computedY, r,g,b,a) in a loop becomes a proximity test:
//   if the fragment's y is within 0.5 of computedY, set the color.
//
// e.clearColor(r,g,b,a) sets the initial out_color.
// e.fade(factor) sets a flag for the runtime to preserve the previous frame.
//
// Returns an object { wgsl, fade } or null if truly impossible to GPU-ify.

function transpileEffectToWGSL(jsBody, param) {
  const p = param || 'e';
  const lines = jsBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Track state
  const bodyLines = [];
  let clearColor = null;      // initial out_color from e.clearColor()
  let fadeAmount = null;       // e.fade() amount for runtime blending
  let setPixelCount = 0;       // how many setPixel calls we've seen
  let depth = 0;               // brace depth for indentation
  const colorVars = new Set(); // vars holding vec3f (hsv/hsl results)

  // Indent helper
  const ind = () => '  ' + '  '.repeat(depth);

  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];

    // Skip pure braces — but track depth
    if (line === '{') { depth++; continue; }
    if (line === '}' || line === '};') {
      if (depth > 0) { depth--; bodyLines.push(ind() + '}'); }
      continue;
    }

    // e.clearColor(r, g, b, a) → initial out_color
    const clearMatch = line.match(new RegExp(`^${p}\\.clearColor\\((.*)\\);?\\s*$`));
    if (clearMatch) {
      const args = splitArgs(clearMatch[1]).map(a => a.trim());
      clearColor = args;
      continue;
    }

    // e.clear() → black initial color
    if (new RegExp(`^${p}\\.clear\\(\\)\\s*;?\\s*$`).test(line)) {
      clearColor = ['0.0', '0.0', '0.0', '0.0'];
      continue;
    }

    // e.fade(amount) → flag for runtime, skip in shader
    const fadeMatch = line.match(new RegExp(`^${p}\\.fade\\((.*)\\);?\\s*$`));
    if (fadeMatch) {
      fadeAmount = fadeMatch[1].trim();
      continue;
    }

    // for (let v = start; v < end; v++) { ... }
    const forMatch = line.match(/^for\s*\(\s*(?:let|var|const)\s+(\w+)\s*=\s*([^;]+);\s*(\w+)\s*(<|<=|>|>=)\s*([^;]+);\s*(\w+)\+\+\s*\)\s*\{?\s*$/);
    if (forMatch) {
      const [, vname, init, , op, bound] = forMatch;
      const wgslBound = transpileExprWGSL(bound.trim(), p);
      // Check if this is a pixel-iteration loop:
      // 1. Direct: for (let x = 0; x < e.width; x++) or for (let y = 0; y < e.height; y++)
      const isPixelX = (vname === 'x' && new RegExp(`\\b${p}\\.width\\b`).test(bound));
      const isPixelY = (vname === 'y' && new RegExp(`\\b${p}\\.height\\b`).test(bound));
      if (isPixelX || isPixelY) {
        // Strip pixel loops — GPU handles per-pixel dispatch
        continue;
      }
      // 2. Disguised: for (let column = 0; column < fieldWidth; column++) followed by
      //    const x = column - offset; → the loop iterates x-pixels, just with an offset.
      //    Strip the loop and compute the loop var from the fragment's known x.
      //    Same for y-axis variants.
      let isDisguisedPixelLoop = false;
      if (li + 1 < lines.length) {
        const nextLine = lines[li + 1].trim();
        // Pattern: const x = loopVar - expr  OR  const x = loopVar + expr  OR  const x = loopVar
        const xyFromLoop = nextLine.match(/^(?:const|let|var)\s+(x|y)\s*=\s*(\w+)\s*([+\-])\s*(.+?)\s*;?\s*$/);
        if (xyFromLoop && xyFromLoop[2] === vname) {
          // This loop var maps to x or y. Compute loop var from fragment coordinate.
          const coord = xyFromLoop[1]; // 'x' or 'y'
          const oper = xyFromLoop[3];  // '+' or '-'
          const offset = xyFromLoop[4];
          const wgslOffset = transpileExprWGSL(offset, p);
          // If x = column - bleedX, then column = x + bleedX
          const inverseOp = oper === '-' ? '+' : '-';
          bodyLines.push(ind() + `let ${vname} = ${coord} ${inverseOp} ${wgslOffset};`);
          // Skip the next line (the const x = ... declaration) since x is already defined
          li++;
          isDisguisedPixelLoop = true;
          // Don't increment depth — we're not opening a block
          // But the source has a { after the for, so we need to consume braces
          // The closing } will be consumed by the brace tracking above
        }
        // Also handle: const x = loopVar (no offset)
        if (!isDisguisedPixelLoop) {
          const xyDirect = nextLine.match(/^(?:const|let|var)\s+(x|y)\s*=\s*(\w+)\s*;?\s*$/);
          if (xyDirect && xyDirect[2] === vname) {
            bodyLines.push(ind() + `let ${vname} = ${xyDirect[1]};`);
            li++;
            isDisguisedPixelLoop = true;
          }
        }
      }
      if (isDisguisedPixelLoop) continue;
      // Algorithmic loop — emit as WGSL for loop
      const wgslInit = transpileExprWGSL(init.trim(), p);
      bodyLines.push(ind() + `for (var ${vname}: f32 = ${wgslInit}; ${vname} ${op} ${wgslBound}; ${vname} = ${vname} + 1.0) {`);
      depth++;
      continue;
    }

    // } else if (...) {
    const bElseIf = line.match(/^}\s*else\s+if\s*\((.+)\)\s*\{?\s*$/);
    if (bElseIf) {
      if (depth > 0) depth--;
      bodyLines.push(ind() + `} else if (${transpileExprWGSL(bElseIf[1], p)}) {`);
      depth++;
      continue;
    }

    // } else {
    if (/^}\s*else\s*\{?\s*$/.test(line)) {
      if (depth > 0) depth--;
      bodyLines.push(ind() + '} else {');
      depth++;
      continue;
    }

    // const/let/var declaration
    const declMatch = line.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(.+?);?\s*$/);
    if (declMatch) {
      const [, vname, expr] = declMatch;
      const wgslExpr = transpileExprWGSL(expr, p);
      // Detect hsv/hsl → vec3f return type
      const isColor = new RegExp(`\\b${p}\\.(hsv|hsl)\\(`).test(expr);
      if (isColor) colorVars.add(vname);
      bodyLines.push(ind() + `let ${vname} = ${wgslExpr};`);
      continue;
    }

    // e.setPixel(x, y, r, g, b, a)
    const spMatch = line.match(new RegExp(`^${p}\\.setPixel\\((.*)\\);?\\s*$`));
    if (spMatch) {
      const rawArgs = splitArgs(spMatch[1]);
      const args = rawArgs.map(a => transpileExprWGSL(a.trim(), p));
      setPixelCount++;

      // Check if setPixel targets a computed y (not the loop variable y)
      // If the y argument is not just 'y', it's a scatter-write to a computed position.
      // In a fragment shader, we check if our pixel y is close to the target y.
      const yArg = rawArgs[1].trim();
      const isDirectY = (yArg === 'y');
      const xArg = rawArgs[0].trim();
      const isDirectX = (xArg === 'x');

      if (isDirectX && isDirectY) {
        // Direct pixel write — just set out_color
        bodyLines.push(ind() + `out_color = vec4f(${args[2]}, ${args[3]}, ${args[4]}, ${args[5]});`);
      } else if (isDirectX && !isDirectY) {
        // x is direct, y is computed — only test y proximity
        bodyLines.push(ind() + `if (abs(y - (${args[1]})) < 0.5) { out_color = vec4f(${args[2]}, ${args[3]}, ${args[4]}, ${args[5]}); }`);
      } else if (!isDirectX && isDirectY) {
        // y is direct, x is computed — only test x proximity
        bodyLines.push(ind() + `if (abs(x - (${args[0]})) < 0.5) { out_color = vec4f(${args[2]}, ${args[3]}, ${args[4]}, ${args[5]}); }`);
      } else {
        // Both computed — test both x and y proximity
        bodyLines.push(ind() + `if (abs(x - (${args[0]})) < 0.5 && abs(y - (${args[1]})) < 0.5) { out_color = vec4f(${args[2]}, ${args[3]}, ${args[4]}, ${args[5]}); }`);
      }
      continue;
    }

    // if statement
    const ifMatch = line.match(/^if\s*\((.+)\)\s*\{?\s*$/);
    if (ifMatch) {
      bodyLines.push(ind() + `if (${transpileExprWGSL(ifMatch[1], p)}) {`);
      depth++;
      continue;
    }

    // Fallback: skip unknown lines (comments etc.)
  }

  // Close any remaining open blocks
  while (depth > 0) { depth--; bodyLines.push(ind() + '}'); }

  // Build the full WGSL shader
  let wgsl = '';
  wgsl += 'struct Uniforms {\n';
  wgsl += '  size_w: f32,\n  size_h: f32,\n  time: f32,\n  dt: f32,\n';
  wgsl += '  frame: f32,\n  mouse_x: f32,\n  mouse_y: f32,\n  mouse_inside: f32,\n';
  wgsl += '};\n\n';
  wgsl += '@group(0) @binding(0) var<uniform> u: Uniforms;\n\n';

  // Vertex shader — fullscreen quad (6 vertices = 2 triangles)
  wgsl += 'struct VsOut {\n  @builtin(position) pos: vec4f,\n  @location(0) uv: vec2f,\n};\n\n';
  wgsl += '@vertex fn vs_main(@builtin(vertex_index) vi: u32) -> VsOut {\n';
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

  // Include shared math library
  wgsl += _effectMathWGSL();

  // Fragment shader
  wgsl += '@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {\n';
  wgsl += '  let x = in.uv.x * u.size_w;\n';
  wgsl += '  let y = (1.0 - in.uv.y) * u.size_h;\n';

  // Initial color from clearColor or default black
  if (clearColor) {
    wgsl += `  var out_color = vec4f(${clearColor[0]}, ${clearColor[1]}, ${clearColor[2]}, ${clearColor[3]});\n`;
  } else {
    wgsl += '  var out_color = vec4f(0.0, 0.0, 0.0, 1.0);\n';
  }

  for (const bl of bodyLines) {
    wgsl += bl + '\n';
  }

  wgsl += '  return out_color;\n';
  wgsl += '}\n';

  // Return object with wgsl and metadata
  return { wgsl: wgsl, fade: fadeAmount };
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
  // Color helpers — return vec3f
  e = e.replace(new RegExp(`\\b${p}\\.hsv\\(`, 'g'), 'hsv2rgb(');
  e = e.replace(new RegExp(`\\b${p}\\.hsl\\(`, 'g'), 'hsl2rgb(');
  // Array indexing on vec3f: rgb[0] → rgb.x, rgb[1] → rgb.y, rgb[2] → rgb.z
  e = e.replace(/\[0\]/g, '.x');
  e = e.replace(/\[1\]/g, '.y');
  e = e.replace(/\[2\]/g, '.z');
  e = e.replace(/\[3\]/g, '.w');
  // Math builtins — direct WGSL equivalents
  e = e.replace(new RegExp(`\\b${p}\\.(sin|cos|sqrt|abs|floor|ceil|exp|exp2|log|log2)\\(`, 'g'), '$1(');
  e = e.replace(new RegExp(`\\b${p}\\.pow\\(`, 'g'), 'pow(');
  e = e.replace(new RegExp(`\\b${p}\\.mod\\(`, 'g'), '_mod(');
  e = e.replace(new RegExp(`\\b${p}\\.fmod\\(`, 'g'), '_mod(');
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
