//! WGSL shader source for the tsz wgpu renderer.
//!
//! SDF-based rounded rectangles with borders, anti-aliasing,
//! gradients, and shadows — all in the fragment shader.
//! Glyph atlas text rendering with per-glyph color tinting.

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
