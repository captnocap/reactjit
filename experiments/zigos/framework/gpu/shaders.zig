//! WGSL shader source for the tsz wgpu renderer.
//!
//! SDF-based rounded rectangles with borders, anti-aliasing,
//! gradients, and shadows — all in the fragment shader.
//! Glyph atlas text rendering with per-glyph color tinting.
//! SDF quadratic bezier curves with anti-aliased strokes.

/// Rect pipeline: instanced fullscreen quads with SDF rounded-rect fragment shader.
/// Each instance is one rectangle with position, size, colors, border-radius, border.
pub const rect_wgsl =
    \\// ── Uniforms ───────────────────────────────────────────────────
    \\struct Globals {
    \\    screen_size: vec2f,
    \\};
    \\@group(0) @binding(0) var<uniform> globals: Globals;
    \\
    \\// ── Per-instance data ─────────────────────────────────────────
    \\struct RectInstance {
    \\    @location(0) pos: vec2f,         // top-left in screen pixels
    \\    @location(1) size: vec2f,        // width, height in pixels
    \\    @location(2) color: vec4f,       // background RGBA [0..1]
    \\    @location(3) border_color: vec4f,// border RGBA [0..1]
    \\    @location(4) radii: vec4f,       // border-radius: tl, tr, br, bl
    \\    @location(5) border_width: f32,  // border thickness in pixels
    \\    @location(6) _pad0: f32,
    \\    @location(7) _pad1: f32,
    \\    @location(8) _pad2: f32,
    \\};
    \\
    \\// ── Vertex output ────────────────────────────────────────────
    \\struct VertexOutput {
    \\    @builtin(position) clip_pos: vec4f,
    \\    @location(0) local_pos: vec2f,   // position within rect [0..size]
    \\    @location(1) size: vec2f,
    \\    @location(2) color: vec4f,
    \\    @location(3) border_color: vec4f,
    \\    @location(4) radii: vec4f,
    \\    @location(5) border_width: f32,
    \\};
    \\
    \\// ── Vertex shader ────────────────────────────────────────────
    \\// 6 vertices per instance (2 triangles = 1 quad), no vertex buffer.
    \\@vertex
    \\fn vs_main(
    \\    @builtin(vertex_index) vertex_index: u32,
    \\    inst: RectInstance,
    \\) -> VertexOutput {
    \\    // Two triangles forming a quad:
    \\    // 0:(0,0) 1:(1,0) 2:(0,1) | 3:(0,1) 4:(1,0) 5:(1,1)
    \\    var quad_x = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
    \\    var quad_y = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
    \\    let uv = vec2f(quad_x[vertex_index], quad_y[vertex_index]);
    \\
    \\    let pixel_pos = inst.pos + uv * inst.size;
    \\    let ndc = vec2f(
    \\        pixel_pos.x / globals.screen_size.x * 2.0 - 1.0,
    \\        1.0 - pixel_pos.y / globals.screen_size.y * 2.0,
    \\    );
    \\
    \\    var out: VertexOutput;
    \\    out.clip_pos = vec4f(ndc, 0.0, 1.0);
    \\    out.local_pos = uv * inst.size;
    \\    out.size = inst.size;
    \\    out.color = inst.color;
    \\    out.border_color = inst.border_color;
    \\    out.radii = inst.radii;
    \\    out.border_width = inst.border_width;
    \\    return out;
    \\}
    \\
    \\// ── SDF rounded rectangle ────────────────────────────────────
    \\fn sdf_rounded_rect(p: vec2f, half_size: vec2f, radii: vec4f) -> f32 {
    \\    // radii: tl, tr, br, bl
    \\    // Select corner radius based on quadrant
    \\    let r_top = select(radii.x, radii.y, p.x > 0.0);
    \\    let r_bot = select(radii.w, radii.z, p.x > 0.0);
    \\    let r = select(r_top, r_bot, p.y > 0.0);
    \\    let q = abs(p) - half_size + r;
    \\    return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
    \\}
    \\
    \\// ── Fragment shader ───────────────────────────────────────────
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let half_size = in.size * 0.5;
    \\    let p = in.local_pos - half_size; // center-relative coords
    \\
    \\    let dist = sdf_rounded_rect(p, half_size, in.radii);
    \\
    \\    // Anti-aliased edge (1px smooth falloff)
    \\    let aa = 1.0 - smoothstep(-1.0, 0.5, dist);
    \\
    \\    if aa <= 0.0 {
    \\        discard;
    \\    }
    \\
    \\    // Border: if border_width > 0, inner region is fill, outer ring is border
    \\    var final_color: vec4f;
    \\    if in.border_width > 0.0 {
    \\        let inner_dist = sdf_rounded_rect(p, half_size - in.border_width, in.radii);
    \\        let inner_aa = smoothstep(-1.0, 0.5, inner_dist);
    \\        // mix: inner_aa=0 means inside fill, inner_aa=1 means in border zone
    \\        final_color = mix(in.color, in.border_color, inner_aa);
    \\    } else {
    \\        final_color = in.color;
    \\    }
    \\
    \\    // Apply edge anti-aliasing
    \\    final_color.a *= aa;
    \\
    \\    // Premultiply alpha for correct blending
    \\    return vec4f(final_color.rgb * final_color.a, final_color.a);
    \\}
;

/// Text pipeline: instanced textured quads sampling from a glyph atlas.
/// Each instance is one glyph with screen position, atlas UV, and color.
pub const text_wgsl =
    \\// ── Uniforms ───────────────────────────────────────────────────
    \\struct Globals {
    \\    screen_size: vec2f,
    \\};
    \\@group(0) @binding(0) var<uniform> globals: Globals;
    \\@group(0) @binding(1) var atlas_tex: texture_2d<f32>;
    \\@group(0) @binding(2) var atlas_sampler: sampler;
    \\
    \\// ── Per-instance data ─────────────────────────────────────────
    \\struct GlyphInstance {
    \\    @location(0) pos: vec2f,     // screen position (top-left)
    \\    @location(1) size: vec2f,    // glyph size on screen
    \\    @location(2) uv_pos: vec2f,  // atlas UV offset [0..1]
    \\    @location(3) uv_size: vec2f, // atlas UV extent [0..1]
    \\    @location(4) color: vec4f,   // text color RGBA
    \\};
    \\
    \\struct VertexOutput {
    \\    @builtin(position) clip_pos: vec4f,
    \\    @location(0) uv: vec2f,
    \\    @location(1) color: vec4f,
    \\};
    \\
    \\@vertex
    \\fn vs_main(
    \\    @builtin(vertex_index) vertex_index: u32,
    \\    inst: GlyphInstance,
    \\) -> VertexOutput {
    \\    var quad_x = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
    \\    var quad_y = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
    \\    let corner = vec2f(quad_x[vertex_index], quad_y[vertex_index]);
    \\
    \\    let pixel_pos = inst.pos + corner * inst.size;
    \\    let ndc = vec2f(
    \\        pixel_pos.x / globals.screen_size.x * 2.0 - 1.0,
    \\        1.0 - pixel_pos.y / globals.screen_size.y * 2.0,
    \\    );
    \\
    \\    var out: VertexOutput;
    \\    out.clip_pos = vec4f(ndc, 0.0, 1.0);
    \\    out.uv = inst.uv_pos + corner * inst.uv_size;
    \\    out.color = inst.color;
    \\    return out;
    \\}
    \\
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let atlas_sample = textureSample(atlas_tex, atlas_sampler, in.uv);
    \\    // Atlas stores white glyphs with alpha — tint with text color
    \\    let alpha = atlas_sample.a * in.color.a;
    \\    if alpha <= 0.0 {
    \\        discard;
    \\    }
    \\    let rgb = in.color.rgb * alpha;
    \\    return vec4f(rgb, alpha);
    \\}
;

/// Curve pipeline: SDF quadratic bezier strokes.
/// Each instance is one quadratic bezier segment (3 control points).
/// Cubics are split into 2-3 quadratics on the CPU side.
/// The fragment shader computes exact signed distance to the curve.
pub const curve_wgsl =
    \\// ── Uniforms ───────────────────────────────────────────────────
    \\struct Globals {
    \\    screen_size: vec2f,
    \\};
    \\@group(0) @binding(0) var<uniform> globals: Globals;
    \\
    \\// ── Per-instance data ─────────────────────────────────────────
    \\struct CurveInstance {
    \\    @location(0) p0: vec2f,           // start point (screen pixels)
    \\    @location(1) p1: vec2f,           // control point
    \\    @location(2) p2: vec2f,           // end point
    \\    @location(3) color: vec4f,        // stroke RGBA [0..1]
    \\    @location(4) stroke_width: f32,   // stroke thickness in pixels
    \\    @location(5) _pad0: f32,
    \\    @location(6) _pad1: f32,
    \\    @location(7) _pad2: f32,
    \\};
    \\
    \\struct VertexOutput {
    \\    @builtin(position) clip_pos: vec4f,
    \\    @location(0) pixel_pos: vec2f,    // screen-space pixel position
    \\    @location(1) p0: vec2f,
    \\    @location(2) p1: vec2f,
    \\    @location(3) p2: vec2f,
    \\    @location(4) color: vec4f,
    \\    @location(5) stroke_width: f32,
    \\};
    \\
    \\// ── Vertex shader ────────────────────────────────────────────
    \\// Emit a bounding quad that encloses the curve + stroke padding.
    \\@vertex
    \\fn vs_main(
    \\    @builtin(vertex_index) vertex_index: u32,
    \\    inst: CurveInstance,
    \\) -> VertexOutput {
    \\    // Bounding box of all 3 control points
    \\    let bbox_min = min(min(inst.p0, inst.p1), inst.p2);
    \\    let bbox_max = max(max(inst.p0, inst.p1), inst.p2);
    \\
    \\    // Expand by stroke width + 2px for anti-aliasing
    \\    let pad = inst.stroke_width * 0.5 + 2.0;
    \\    let box_min = bbox_min - pad;
    \\    let box_max = bbox_max + pad;
    \\    let box_size = box_max - box_min;
    \\
    \\    var quad_x = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 1.0, 1.0);
    \\    var quad_y = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
    \\    let uv = vec2f(quad_x[vertex_index], quad_y[vertex_index]);
    \\
    \\    let pixel_pos = box_min + uv * box_size;
    \\    let ndc = vec2f(
    \\        pixel_pos.x / globals.screen_size.x * 2.0 - 1.0,
    \\        1.0 - pixel_pos.y / globals.screen_size.y * 2.0,
    \\    );
    \\
    \\    var out: VertexOutput;
    \\    out.clip_pos = vec4f(ndc, 0.0, 1.0);
    \\    out.pixel_pos = pixel_pos;
    \\    out.p0 = inst.p0;
    \\    out.p1 = inst.p1;
    \\    out.p2 = inst.p2;
    \\    out.color = inst.color;
    \\    out.stroke_width = inst.stroke_width;
    \\    return out;
    \\}
    \\
    \\// ── SDF distance to quadratic bezier ─────────────────────────
    \\// Exact minimum distance from point p to quadratic bezier (a, b, c).
    \\// Based on Inigo Quilez's approach: solve the cubic for closest t,
    \\// then evaluate distance at candidate t values.
    \\fn sdf_bezier(pos: vec2f, a: vec2f, b: vec2f, c: vec2f) -> f32 {
    \\    let A = b - a;
    \\    let B = c - 2.0 * b + a;
    \\    let C = a - pos;
    \\
    \\    // Coefficients of the derivative dot product polynomial:
    \\    // d/dt |B*t^2 + 2*A*t + C|^2 = 0
    \\    // => cubic: k3*t^3 + k2*t^2 + k1*t + k0 = 0
    \\    let k3 = dot(B, B);
    \\    let k2 = 3.0 * dot(A, B);
    \\    let k1 = 2.0 * dot(A, A) + dot(C, B);
    \\    let k0 = dot(C, A);
    \\
    \\    var min_dist = 1e10;
    \\
    \\    // Check endpoints (t=0, t=1) — always valid candidates
    \\    min_dist = min(min_dist, dot(C, C));
    \\    let end = a + 2.0 * A + B - pos;
    \\    min_dist = min(min_dist, dot(end, end));
    \\
    \\    // Solve cubic for interior critical points
    \\    if abs(k3) > 1e-6 {
    \\        // Depressed cubic: t^3 + pt + q = 0
    \\        let ik3 = 1.0 / k3;
    \\        let p_coeff = (3.0 * k1 * k3 - k2 * k2) / (3.0 * k3 * k3);
    \\        let q_coeff = (2.0 * k2 * k2 * k2 - 9.0 * k1 * k2 * k3 + 27.0 * k0 * k3 * k3) / (27.0 * k3 * k3 * k3);
    \\        let disc = q_coeff * q_coeff / 4.0 + p_coeff * p_coeff * p_coeff / 27.0;
    \\        let shift = -k2 * ik3 / 3.0;
    \\
    \\        if disc >= 0.0 {
    \\            // One real root
    \\            let sq = sqrt(disc);
    \\            let u = sign(-q_coeff * 0.5 + sq) * pow(abs(-q_coeff * 0.5 + sq), 1.0 / 3.0);
    \\            let v = sign(-q_coeff * 0.5 - sq) * pow(abs(-q_coeff * 0.5 - sq), 1.0 / 3.0);
    \\            let t0 = clamp(u + v + shift, 0.0, 1.0);
    \\            let pt0 = a + 2.0 * A * t0 + B * t0 * t0 - pos;
    \\            min_dist = min(min_dist, dot(pt0, pt0));
    \\        } else {
    \\            // Three real roots (casus irreducibilis)
    \\            let mp3 = -p_coeff / 3.0;
    \\            let r = sqrt(mp3 * mp3 * mp3);
    \\            let cos_phi = clamp(-q_coeff / (2.0 * r), -1.0, 1.0);
    \\            let phi = acos(cos_phi) / 3.0;
    \\            let cube_r = pow(r, 1.0 / 3.0) * 2.0;
    \\            let t0 = clamp(cube_r * cos(phi) + shift, 0.0, 1.0);
    \\            let t1 = clamp(cube_r * cos(phi - 2.094395) + shift, 0.0, 1.0);
    \\            let t2 = clamp(cube_r * cos(phi - 4.188790) + shift, 0.0, 1.0);
    \\            let pt0 = a + 2.0 * A * t0 + B * t0 * t0 - pos;
    \\            let pt1 = a + 2.0 * A * t1 + B * t1 * t1 - pos;
    \\            let pt2 = a + 2.0 * A * t2 + B * t2 * t2 - pos;
    \\            min_dist = min(min_dist, min(dot(pt0, pt0), min(dot(pt1, pt1), dot(pt2, pt2))));
    \\        }
    \\    } else if abs(k2) > 1e-6 {
    \\        // Degenerate to quadratic: k2*t^2 + k1*t + k0 = 0
    \\        let det = k1 * k1 - 4.0 * k0 * k2;
    \\        if det >= 0.0 {
    \\            let sq = sqrt(det);
    \\            let ta = clamp((-k1 + sq) / (2.0 * k2), 0.0, 1.0);
    \\            let tb = clamp((-k1 - sq) / (2.0 * k2), 0.0, 1.0);
    \\            let pa = a + 2.0 * A * ta + B * ta * ta - pos;
    \\            let pb = a + 2.0 * A * tb + B * tb * tb - pos;
    \\            min_dist = min(min_dist, min(dot(pa, pa), dot(pb, pb)));
    \\        }
    \\    } else if abs(k1) > 1e-6 {
    \\        // Linear: k1*t + k0 = 0
    \\        let t0 = clamp(-k0 / k1, 0.0, 1.0);
    \\        let pt0 = a + 2.0 * A * t0 + B * t0 * t0 - pos;
    \\        min_dist = min(min_dist, dot(pt0, pt0));
    \\    }
    \\
    \\    return sqrt(min_dist);
    \\}
    \\
    \\// ── Fragment shader ───────────────────────────────────────────
    \\@fragment
    \\fn fs_main(in: VertexOutput) -> @location(0) vec4f {
    \\    let dist = sdf_bezier(in.pixel_pos, in.p0, in.p1, in.p2);
    \\    let half_w = in.stroke_width * 0.5;
    \\
    \\    // Anti-aliased stroke: smooth falloff over 1px at the edge
    \\    let alpha = 1.0 - smoothstep(half_w - 1.0, half_w + 0.5, dist);
    \\
    \\    if alpha <= 0.0 {
    \\        discard;
    \\    }
    \\
    \\    let final_alpha = in.color.a * alpha;
    \\    return vec4f(in.color.rgb * final_alpha, final_alpha);
    \\}
;
