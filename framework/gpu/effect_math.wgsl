// effect_math.wgsl — Shared GPU math library for effects
// Mirror of framework/math.zig noise/interpolation functions.
// Included by the effect shader pipeline when needed.

// ── Hash functions (building blocks for noise) ──────────────────
fn _hash(p: vec2f) -> f32 {
  var h = dot(p, vec2f(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}
fn _hash2(p: vec2f) -> vec2f {
  let h = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return fract(sin(h) * 43758.5453123);
}
fn _hash3(p: vec3f) -> f32 {
  var h = dot(p, vec3f(127.1, 311.7, 74.7));
  return fract(sin(h) * 43758.5453123);
}

// ── Value noise 2D ──────────────────────────────────────────────
// Matches math.zig:noise2d output range [-1, 1]
fn snoise(px: f32, py: f32) -> f32 {
  let p = vec2f(px, py);
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = _hash(i);
  let b = _hash(i + vec2f(1.0, 0.0));
  let c = _hash(i + vec2f(0.0, 1.0));
  let d = _hash(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

// ── Value noise 3D ──────────────────────────────────────────────
fn snoise3(px: f32, py: f32, pz: f32) -> f32 {
  let p = vec3f(px, py, pz);
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a00 = mix(_hash3(i), _hash3(i + vec3f(1.0, 0.0, 0.0)), u.x);
  let a10 = mix(_hash3(i + vec3f(0.0, 1.0, 0.0)), _hash3(i + vec3f(1.0, 1.0, 0.0)), u.x);
  let a01 = mix(_hash3(i + vec3f(0.0, 0.0, 1.0)), _hash3(i + vec3f(1.0, 0.0, 1.0)), u.x);
  let a11 = mix(_hash3(i + vec3f(0.0, 1.0, 1.0)), _hash3(i + vec3f(1.0, 1.0, 1.0)), u.x);
  let b0 = mix(a00, a10, u.y);
  let b1 = mix(a01, a11, u.y);
  return mix(b0, b1, u.z) * 2.0 - 1.0;
}

// ── Fractal Brownian Motion 2D ──────────────────────────────────
// Matches math.zig:fbm2d — layered noise with lacunarity=2, persistence=0.5
fn fbm(px: f32, py: f32, octaves: f32) -> f32 {
  var val = 0.0;
  var amp = 0.5;
  var freq = 1.0;
  var x = px; var y = py;
  let oct = i32(clamp(octaves, 1.0, 8.0));
  for (var i = 0; i < oct; i = i + 1) {
    val = val + amp * snoise(x * freq, y * freq);
    freq = freq * 2.0;
    amp = amp * 0.5;
    x = x * 1.02 + 1.7; y = y * 1.02 + 3.1;
  }
  return val;
}

// ── Voronoi / cellular noise ────────────────────────────────────
// Returns vec2f(nearest_distance, second_nearest_distance)
fn voronoi(px: f32, py: f32) -> vec2f {
  let p = vec2f(px, py);
  let n = floor(p);
  let f = fract(p);
  var md = 8.0;
  var md2 = 8.0;
  for (var j = -1; j <= 1; j = j + 1) {
    for (var i = -1; i <= 1; i = i + 1) {
      let g = vec2f(f32(i), f32(j));
      let o = _hash2(n + g);
      let r = g + o - f;
      let d = dot(r, r);
      if (d < md) { md2 = md; md = d; } else if (d < md2) { md2 = d; }
    }
  }
  return vec2f(sqrt(md), sqrt(md2));
}

// ── Color helpers ───────────────────────────────────────────────
fn hsv2rgb(h_in: f32, s: f32, v: f32) -> vec3f {
  if (s <= 0.0) { return vec3f(v, v, v); }
  let h = fract(h_in) * 6.0;
  let sector = u32(floor(h));
  let f = h - floor(h);
  let p = v * (1.0 - s);
  let q = v * (1.0 - s * f);
  let t = v * (1.0 - s * (1.0 - f));
  switch (sector) {
    case 0u: { return vec3f(v, t, p); }
    case 1u: { return vec3f(q, v, p); }
    case 2u: { return vec3f(p, v, t); }
    case 3u: { return vec3f(p, q, v); }
    case 4u: { return vec3f(t, p, v); }
    default: { return vec3f(v, p, q); }
  }
}

fn _hue2rgb(p: f32, q: f32, t_in: f32) -> f32 {
  var t = fract(t_in);
  if (t < 1.0/6.0) { return p + (q - p) * 6.0 * t; }
  if (t < 0.5) { return q; }
  if (t < 2.0/3.0) { return p + (q - p) * (2.0/3.0 - t) * 6.0; }
  return p;
}

fn hsl2rgb(h_in: f32, s: f32, l: f32) -> vec3f {
  if (s <= 0.0) { return vec3f(l, l, l); }
  let h = fract(h_in);
  let q = select(l + s - l * s, l * (1.0 + s), l < 0.5);
  let p = 2.0 * l - q;
  return vec3f(
    _hue2rgb(p, q, h + 1.0/3.0),
    _hue2rgb(p, q, h),
    _hue2rgb(p, q, h - 1.0/3.0),
  );
}

// ── Interpolation ───────────────────────────────────────────────
fn _lerp(a: f32, b: f32, t: f32) -> f32 {
  return a + (b - a) * t;
}

fn _remap(value: f32, in_min: f32, in_max: f32, out_min: f32, out_max: f32) -> f32 {
  return out_min + (out_max - out_min) * ((value - in_min) / (in_max - in_min));
}

// ── Distance ────────────────────────────────────────────────────
fn _dist(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
  return length(vec2f(x1 - x2, y1 - y2));
}
