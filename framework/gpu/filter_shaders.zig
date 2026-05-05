//! filter_shaders.zig — WGSL post-process filter library.
//!
//! Each filter is a fullscreen-quad fragment shader that samples a captured
//! subtree texture (the "input") and writes a transformed color. They all
//! share one vertex shader (passthrough quad over the filter's screen-space
//! bounds) and one bind-group layout: globals + input texture + sampler +
//! filter-uniforms (time, intensity, bounds).
//!
//! The vertex shader is concatenated with each fragment to produce a
//! complete WGSL module per filter. The registry in filters.zig owns the
//! pipeline objects.

// Shared header: bindings, vertex I/O, vertex shader, filter uniforms.
// One fullscreen quad covers the filter's pixel bounds.
pub const header_wgsl =
    \\struct Globals {
    \\    screen_size: vec2f,
    \\};
    \\struct FilterUniforms {
    \\    bounds_pos: vec2f,   // top-left pixel of filter region
    \\    bounds_size: vec2f,  // pixel size of filter region
    \\    time: f32,           // seconds since cart start, wrapped at 1e6
    \\    intensity: f32,      // 0..1 user-controlled strength
    \\    _pad0: f32,
    \\    _pad1: f32,
    \\};
    \\@group(0) @binding(0) var<uniform> globals: Globals;
    \\@group(0) @binding(1) var input_tex: texture_2d<f32>;
    \\@group(0) @binding(2) var input_sampler: sampler;
    \\@group(0) @binding(3) var<uniform> filter_u: FilterUniforms;
    \\
    \\struct VertexOutput {
    \\    @builtin(position) clip_pos: vec4f,
    \\    @location(0) uv: vec2f,
    \\};
    \\
    \\@vertex
    \\fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
    \\    var qx = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
    \\    var qy = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
    \\    let corner = vec2f(qx[vi], qy[vi]);
    \\    let pixel_pos = filter_u.bounds_pos + corner * filter_u.bounds_size;
    \\    let ndc = vec2f(
    \\        pixel_pos.x / globals.screen_size.x * 2.0 - 1.0,
    \\        1.0 - pixel_pos.y / globals.screen_size.y * 2.0,
    \\    );
    \\    var out: VertexOutput;
    \\    out.clip_pos = vec4f(ndc, 0.0, 1.0);
    \\    out.uv = corner;
    \\    return out;
    \\}
    \\
    \\fn _hash(p: vec2f) -> f32 {
    \\    let h = dot(p, vec2f(127.1, 311.7));
    \\    return fract(sin(h) * 43758.5453123);
    \\}
    \\fn _luma(c: vec3f) -> f32 {
    \\    return dot(c, vec3f(0.2126, 0.7152, 0.0722));
    \\}
    \\fn _rgb2hsv(c: vec3f) -> vec3f {
    \\    let K = vec4f(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    \\    let p = mix(vec4f(c.bg, K.wz), vec4f(c.gb, K.xy), step(c.b, c.g));
    \\    let q = mix(vec4f(p.xyw, c.r), vec4f(c.r, p.yzx), step(p.x, c.r));
    \\    let d = q.x - min(q.w, q.y);
    \\    let e = 1.0e-10;
    \\    return vec3f(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    \\}
    \\fn _hsv2rgb(c: vec3f) -> vec3f {
    \\    let K = vec4f(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    \\    let p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    \\    return c.z * mix(K.xxx, clamp(p - K.xxx, vec3f(0.0), vec3f(1.0)), c.y);
    \\}
    \\
;

// ── deepfry ────────────────────────────────────────────────────
// Crank saturation, posterize, sharpen, JPEG-block noise.
pub const deepfry_wgsl = header_wgsl ++
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let k = filter_u.intensity;
    \\    let texel = vec2f(1.0) / filter_u.bounds_size;
    \\    let c = textureSample(input_tex, input_sampler, in.uv).rgb;
    \\    // 3x3 sharpen kernel
    \\    let n = textureSample(input_tex, input_sampler, in.uv + vec2f(0.0, -texel.y)).rgb;
    \\    let s = textureSample(input_tex, input_sampler, in.uv + vec2f(0.0, texel.y)).rgb;
    \\    let e = textureSample(input_tex, input_sampler, in.uv + vec2f(texel.x, 0.0)).rgb;
    \\    let w = textureSample(input_tex, input_sampler, in.uv + vec2f(-texel.x, 0.0)).rgb;
    \\    let sharp = c * 5.0 - n - s - e - w;
    \\    var col = mix(c, sharp, 0.6 * k);
    \\    // Saturation crank
    \\    var hsv = _rgb2hsv(col);
    \\    hsv.y = clamp(hsv.y * (1.0 + 2.5 * k), 0.0, 1.0);
    \\    hsv.z = clamp(hsv.z * (1.0 + 0.4 * k), 0.0, 1.0);
    \\    col = _hsv2rgb(hsv);
    \\    // Posterize to ~6-level per channel
    \\    let levels = mix(64.0, 6.0, k);
    \\    col = floor(col * levels) / levels;
    \\    // JPEG-style 8x8 block noise
    \\    let blk = floor(in.uv * filter_u.bounds_size / 8.0);
    \\    let nz = (_hash(blk + filter_u.time * 0.01) - 0.5) * 0.25 * k;
    \\    col = clamp(col + nz, vec3f(0.0), vec3f(1.0));
    \\    let a = textureSample(input_tex, input_sampler, in.uv).a;
    \\    return vec4f(col * a, a);
    \\}
;

// ── crt ────────────────────────────────────────────────────────
// Barrel distortion + scanlines + chromatic aberration + vignette.
pub const crt_wgsl = header_wgsl ++
    \\fn _barrel(uv: vec2f, k: f32) -> vec2f {
    \\    let p = uv * 2.0 - 1.0;
    \\    let r2 = dot(p, p);
    \\    let pp = p * (1.0 + k * r2);
    \\    return pp * 0.5 + 0.5;
    \\}
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let k = filter_u.intensity;
    \\    let uv = _barrel(in.uv, 0.15 * k);
    \\    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    \\        return vec4f(0.0);
    \\    }
    \\    let off = 0.0025 * k;
    \\    let r = textureSample(input_tex, input_sampler, uv + vec2f(off, 0.0)).r;
    \\    let g = textureSample(input_tex, input_sampler, uv).g;
    \\    let b = textureSample(input_tex, input_sampler, uv - vec2f(off, 0.0)).b;
    \\    var col = vec3f(r, g, b);
    \\    // Scanlines — fixed pitch (240 lines), independent of viewport size.
    \\    let line = sin(uv.y * 240.0 * 3.14159) * 0.5 + 0.5;
    \\    col = col * mix(1.0, 0.75 + 0.25 * line, k);
    \\    // Vignette
    \\    let p = uv * 2.0 - 1.0;
    \\    let vig = 1.0 - dot(p, p) * 0.35 * k;
    \\    col = col * vig;
    \\    let a = textureSample(input_tex, input_sampler, uv).a;
    \\    return vec4f(col * a, a);
    \\}
;

// ── chromatic ──────────────────────────────────────────────────
// Pure RGB-shift aberration.
pub const chromatic_wgsl = header_wgsl ++
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let k = filter_u.intensity;
    \\    let off = 0.006 * k;
    \\    let r = textureSample(input_tex, input_sampler, in.uv + vec2f(off, 0.0)).r;
    \\    let g = textureSample(input_tex, input_sampler, in.uv).g;
    \\    let b = textureSample(input_tex, input_sampler, in.uv - vec2f(off, 0.0)).b;
    \\    let a = textureSample(input_tex, input_sampler, in.uv).a;
    \\    return vec4f(vec3f(r, g, b) * a, a);
    \\}
;

// ── posterize ──────────────────────────────────────────────────
pub const posterize_wgsl = header_wgsl ++
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let s = textureSample(input_tex, input_sampler, in.uv);
    \\    let levels = mix(32.0, 4.0, filter_u.intensity);
    \\    let col = floor(s.rgb * levels) / levels;
    \\    return vec4f(col * s.a, s.a);
    \\}
;

// ── vhs ────────────────────────────────────────────────────────
// Horizontal wobble, color bleed, scanlines, noise tape grain.
pub const vhs_wgsl = header_wgsl ++
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let k = filter_u.intensity;
    \\    let t = filter_u.time;
    \\    // Horizontal wobble that varies per scanline
    \\    let wob = sin(in.uv.y * 90.0 + t * 8.0) * 0.004 * k
    \\            + sin(in.uv.y * 7.0 + t * 1.3) * 0.012 * k;
    \\    let uv = vec2f(in.uv.x + wob, in.uv.y);
    \\    // Color bleed (Y-shifted chroma)
    \\    let off = 0.008 * k;
    \\    let r = textureSample(input_tex, input_sampler, uv + vec2f(off, 0.0)).r;
    \\    let g = textureSample(input_tex, input_sampler, uv).g;
    \\    let b = textureSample(input_tex, input_sampler, uv - vec2f(off, 0.0)).b;
    \\    var col = vec3f(r, g, b);
    \\    // Scanlines — fixed pitch.
    \\    let line = sin(uv.y * 320.0 * 3.14159) * 0.5 + 0.5;
    \\    col = col * mix(1.0, 0.7 + 0.3 * line, k);
    \\    // Tape grain — quantized horizontally for streak character (not
    \\    // per-pixel white noise).
    \\    let grain_scale = vec2f(filter_u.bounds_size.x, filter_u.bounds_size.y * 0.5);
    \\    let nz = (_hash(floor(uv * grain_scale) + t * 60.0) - 0.5) * 0.2 * k;
    \\    col = clamp(col + nz, vec3f(0.0), vec3f(1.0));
    \\    let a = textureSample(input_tex, input_sampler, uv).a;
    \\    return vec4f(col * a, a);
    \\}
;

// ── scanlines ──────────────────────────────────────────────────
pub const scanlines_wgsl = header_wgsl ++
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let s = textureSample(input_tex, input_sampler, in.uv);
    \\    // Fixed line pitch (240 lines) — independent of viewport size.
    \\    let line = sin(in.uv.y * 240.0 * 3.14159) * 0.5 + 0.5;
    \\    let col = s.rgb * mix(1.0, 0.7 + 0.3 * line, filter_u.intensity);
    \\    return vec4f(col * s.a, s.a);
    \\}
;

// ── invert ─────────────────────────────────────────────────────
pub const invert_wgsl = header_wgsl ++
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let s = textureSample(input_tex, input_sampler, in.uv);
    \\    let col = mix(s.rgb, vec3f(s.a) - s.rgb, filter_u.intensity);
    \\    return vec4f(col, s.a);
    \\}
;

// ── grayscale ──────────────────────────────────────────────────
pub const grayscale_wgsl = header_wgsl ++
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let s = textureSample(input_tex, input_sampler, in.uv);
    \\    let l = _luma(s.rgb);
    \\    let col = mix(s.rgb, vec3f(l), filter_u.intensity);
    \\    return vec4f(col, s.a);
    \\}
;

// ── pixelate ───────────────────────────────────────────────────
pub const pixelate_wgsl = header_wgsl ++
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    // Crisp pass-through at intensity~0 (avoid linear-sampler half-pixel
    \\    // shift on the snap path).
    \\    if (filter_u.intensity < 0.001) {
    \\        return textureSample(input_tex, input_sampler, in.uv);
    \\    }
    \\    let block = mix(1.0, 16.0, filter_u.intensity);
    \\    let pixel = in.uv * filter_u.bounds_size;
    \\    let block_origin = floor(pixel / block) * block;
    \\    let center_px = vec2i(block_origin + vec2f(block * 0.5));
    \\    return textureLoad(input_tex, center_px, 0);
    \\}
;

// ── ascii-ish dither ───────────────────────────────────────────
// Bayer 4x4 ordered dither — gives that "old terminal" feel.
pub const dither_wgsl = header_wgsl ++
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let s = textureSample(input_tex, input_sampler, in.uv);
    \\    let bayer = array<f32, 16>(
    \\        0.0/16.0, 8.0/16.0, 2.0/16.0, 10.0/16.0,
    \\        12.0/16.0, 4.0/16.0, 14.0/16.0, 6.0/16.0,
    \\        3.0/16.0, 11.0/16.0, 1.0/16.0, 9.0/16.0,
    \\        15.0/16.0, 7.0/16.0, 13.0/16.0, 5.0/16.0,
    \\    );
    \\    let p = vec2u(in.uv * filter_u.bounds_size);
    \\    let bi = (p.y % 4u) * 4u + (p.x % 4u);
    \\    let threshold = bayer[bi] - 0.5;
    \\    let l = _luma(s.rgb) + threshold * 0.5 * filter_u.intensity;
    \\    let bit = step(0.5, l);
    \\    let col = mix(s.rgb, vec3f(bit), filter_u.intensity);
    \\    return vec4f(col * s.a, s.a);
    \\}
;

// ── bytecode ───────────────────────────────────────────────────
// "Decode the bytes" — each TILE_PX × TILE_PX tile of the source becomes a
// SUB×SUB bit-grid keyed by a 32-bit hash of that tile's center pixel
// color. Same source color → same glyph, different colors → different
// glyphs (collision rate ~1/2^32). Visually it reads like a memory dump:
// rows of distinct fingerprint-glyphs, one per region of the rendered UI.
// At intensity=0 it passes through unchanged.
pub const bytecode_wgsl = header_wgsl ++
    \\fn _bc_h(p: u32) -> u32 {
    \\    var h = p;
    \\    h = h ^ (h >> 16u);
    \\    h = h * 0x85ebca6bu;
    \\    h = h ^ (h >> 13u);
    \\    h = h * 0xc2b2ae35u;
    \\    h = h ^ (h >> 16u);
    \\    return h;
    \\}
    \\// RGB-only key, properly rounded. Alpha is excluded so anti-aliased
    \\// edge pixels don't fingerprint differently from interior pixels of
    \\// the same color.
    \\fn _bc_pack(c: vec3f) -> u32 {
    \\    let r = u32(clamp(c.r, 0.0, 1.0) * 255.0 + 0.5);
    \\    let g = u32(clamp(c.g, 0.0, 1.0) * 255.0 + 0.5);
    \\    let b = u32(clamp(c.b, 0.0, 1.0) * 255.0 + 0.5);
    \\    return r | (g << 8u) | (b << 16u);
    \\}
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let TILE_PX: f32 = 12.0;
    \\    let SUB: u32 = 6u;
    \\    let pixel = in.uv * filter_u.bounds_size;
    \\    let tile_origin = floor(pixel / TILE_PX) * TILE_PX;
    \\    // Single integer-addressed center sample. textureLoad bypasses the
    \\    // linear sampler so the key is the EXACT pixel value, not a blend.
    \\    // Same source color → same key → same glyph everywhere.
    \\    let center_px = vec2i(tile_origin + vec2f(TILE_PX * 0.5));
    \\    let src = textureLoad(input_tex, center_px, 0);
    \\    let passthrough = textureSample(input_tex, input_sampler, in.uv);
    \\    if (src.a < 0.01) { return passthrough; }
    \\    // Unpremultiply before hashing so the key is straight RGB, not
    \\    // src.rgb * src.a.
    \\    let rgb = select(src.rgb / max(src.a, 1e-4), src.rgb, src.a < 0.001);
    \\    // Two 32-bit hash words = 64 bits of glyph (covers 36 sub-cells).
    \\    let h1 = _bc_h(_bc_pack(rgb));
    \\    let h2 = _bc_h(h1 ^ 0x9e3779b9u);
    \\    // Sub-cell within the tile.
    \\    let cell_size = TILE_PX / f32(SUB);
    \\    let sub = vec2u(floor((pixel - tile_origin) / cell_size));
    \\    let idx = sub.y * SUB + sub.x;
    \\    var bit: u32;
    \\    if (idx < 32u) { bit = (h1 >> idx) & 1u; }
    \\    else           { bit = (h2 >> (idx - 32u)) & 1u; }
    \\    // Ink color from h2 (kept independent from h1's bit positions),
    \\    // then luma-modulated by the source so palette zones survive.
    \\    let ink_raw = vec3f(
    \\        f32( h2        & 0xFFu),
    \\        f32((h2 >>  8u) & 0xFFu),
    \\        f32((h2 >> 16u) & 0xFFu),
    \\    ) / 255.0;
    \\    let luma = _luma(rgb);
    \\    let ink = mix(ink_raw, ink_raw * (0.4 + 0.9 * luma), 0.5);
    \\    let bg = rgb * 0.25;
    \\    let decoded = select(bg, ink, bit == 1u);
    \\    // Scan-band reveal — intensity=1 means fully encoded, intensity=0
    \\    // means fully revealed. As intensity decreases, the scan line moves
    \\    // top-to-bottom revealing the UI tile by tile, with a bright glowing
    \\    // band at the boundary so you SEE the decode happen.
    \\    let tile_y_norm = (tile_origin.y + TILE_PX * 0.5) / filter_u.bounds_size.y;
    \\    let scan_y = 1.0 - filter_u.intensity;
    \\    // cleared = 1 above the scan (passthrough/UI revealed),
    \\    //         = 0 below the scan (still encoded as bytecode glyphs).
    \\    let cleared = smoothstep(scan_y - 0.015, scan_y + 0.015, tile_y_norm);
    \\    var col = mix(decoded, passthrough.rgb, cleared);
    \\    // Gaussian highlight band centered on the scan line. Falls off
    \\    // over ~6% of the height — about 4 tile rows on a 700px viewport.
    \\    let band_dist = (tile_y_norm - scan_y) / 0.06;
    \\    let band = exp(-band_dist * band_dist)
    \\             * step(0.001, filter_u.intensity)
    \\             * step(filter_u.intensity, 0.999);
    \\    col = col + ink_raw * band * 1.1;
    \\    return vec4f(col * passthrough.a, passthrough.a);
    \\}
;
