//! effect_shadergen.zig — Compile shader-safe Effect onRender bodies to WGSL.
//!
//! This keeps the public Effect API unchanged:
//!   <Effect onRender={(e) => { ... }} />
//!
//! The compiler opportunistically emits a GPU shader for a narrow subset:
//!   - optional top-level const/let bindings
//!   - exactly two nested for-loops over e.width/e.height
//!   - inner body is local const/let bindings + one e.setPixel(x, y, ...)
//!
//! Anything outside that subset falls back to the existing CPU render callback.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const TokenKind = @import("lexer.zig").TokenKind;

pub const Result = struct {
    wgsl: []const u8,
};

const MAX_LOCALS = 96;

const WGSL_PREFIX =
    \\struct EffectUniforms {
    \\    size: vec2f,
    \\    time: f32,
    \\    dt: f32,
    \\    frame: f32,
    \\    mouse_x: f32,
    \\    mouse_y: f32,
    \\    mouse_inside: f32,
    \\    _pad0: f32,
    \\};
    \\@group(0) @binding(0) var<uniform> u: EffectUniforms;
    \\
    \\fn hash21(p: vec2f) -> f32 {
    \\    return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453123);
    \\}
    \\
    \\fn hash31(p: vec3f) -> f32 {
    \\    return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453123);
    \\}
    \\
    \\fn noise2d(p: vec2f) -> f32 {
    \\    let i = floor(p);
    \\    let f = fract(p);
    \\    let u2 = f * f * (3.0 - 2.0 * f);
    \\    let a = hash21(i);
    \\    let b = hash21(i + vec2f(1.0, 0.0));
    \\    let c = hash21(i + vec2f(0.0, 1.0));
    \\    let d = hash21(i + vec2f(1.0, 1.0));
    \\    return (mix(mix(a, b, u2.x), mix(c, d, u2.x), u2.y) * 2.0) - 1.0;
    \\}
    \\
    \\fn noise3d(p: vec3f) -> f32 {
    \\    let i = floor(p);
    \\    let f = fract(p);
    \\    let u3 = f * f * (3.0 - 2.0 * f);
    \\    let n000 = hash31(i + vec3f(0.0, 0.0, 0.0));
    \\    let n100 = hash31(i + vec3f(1.0, 0.0, 0.0));
    \\    let n010 = hash31(i + vec3f(0.0, 1.0, 0.0));
    \\    let n110 = hash31(i + vec3f(1.0, 1.0, 0.0));
    \\    let n001 = hash31(i + vec3f(0.0, 0.0, 1.0));
    \\    let n101 = hash31(i + vec3f(1.0, 0.0, 1.0));
    \\    let n011 = hash31(i + vec3f(0.0, 1.0, 1.0));
    \\    let n111 = hash31(i + vec3f(1.0, 1.0, 1.0));
    \\    let x00 = mix(n000, n100, u3.x);
    \\    let x10 = mix(n010, n110, u3.x);
    \\    let x01 = mix(n001, n101, u3.x);
    \\    let x11 = mix(n011, n111, u3.x);
    \\    let y0 = mix(x00, x10, u3.y);
    \\    let y1 = mix(x01, x11, u3.y);
    \\    return (mix(y0, y1, u3.z) * 2.0) - 1.0;
    \\}
    \\
    \\fn fbm2d(p: vec2f, octaves: i32) -> f32 {
    \\    var total = 0.0;
    \\    var amplitude = 0.5;
    \\    var frequency = 1.0;
    \\    var i = 0;
    \\    loop {
    \\        if (i >= octaves) { break; }
    \\        total += noise2d(p * frequency) * amplitude;
    \\        frequency *= 2.0;
    \\        amplitude *= 0.5;
    \\        i += 1;
    \\    }
    \\    return total;
    \\}
    \\
    \\fn remap(value: f32, in_min: f32, in_max: f32, out_min: f32, out_max: f32) -> f32 {
    \\    return out_min + (value - in_min) * (out_max - out_min) / (in_max - in_min);
    \\}
    \\
    \\fn hsv_to_rgb(h_in: f32, s: f32, v: f32) -> vec3f {
    \\    if (s <= 0.0) {
    \\        return vec3f(v, v, v);
    \\    }
    \\    let h = fract(h_in) * 6.0;
    \\    let sector = i32(floor(h));
    \\    let f = h - f32(sector);
    \\    let p = v * (1.0 - s);
    \\    let q = v * (1.0 - s * f);
    \\    let t = v * (1.0 - s * (1.0 - f));
    \\    switch (sector % 6) {
    \\        case 0: { return vec3f(v, t, p); }
    \\        case 1: { return vec3f(q, v, p); }
    \\        case 2: { return vec3f(p, v, t); }
    \\        case 3: { return vec3f(p, q, v); }
    \\        case 4: { return vec3f(t, p, v); }
    \\        default: { return vec3f(v, p, q); }
    \\    }
    \\}
    \\
    \\fn hue2rgb(p: f32, q: f32, t_in: f32) -> f32 {
    \\    var t = t_in;
    \\    if (t < 0.0) { t += 1.0; }
    \\    if (t > 1.0) { t -= 1.0; }
    \\    if (t < (1.0 / 6.0)) { return p + (q - p) * 6.0 * t; }
    \\    if (t < 0.5) { return q; }
    \\    if (t < (2.0 / 3.0)) { return p + (q - p) * (2.0 / 3.0 - t) * 6.0; }
    \\    return p;
    \\}
    \\
    \\fn hsl_to_rgb(h_in: f32, s: f32, l: f32) -> vec3f {
    \\    if (s <= 0.0) {
    \\        return vec3f(l, l, l);
    \\    }
    \\    let h = fract(h_in);
    \\    let q = select(l + s - l * s, l * (1.0 + s), l < 0.5);
    \\    let p = 2.0 * l - q;
    \\    return vec3f(
    \\        hue2rgb(p, q, h + 1.0 / 3.0),
    \\        hue2rgb(p, q, h),
    \\        hue2rgb(p, q, h - 1.0 / 3.0),
    \\    );
    \\}
    \\
    \\struct VSOut {
    \\    @builtin(position) clip_pos: vec4f,
    \\};
    \\
    \\@vertex
    \\fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VSOut {
    \\    var quad_x = array<f32, 6>(-1.0, 1.0, -1.0, -1.0, 1.0, 1.0);
    \\    var quad_y = array<f32, 6>(-1.0, -1.0, 1.0, 1.0, -1.0, 1.0);
    \\    var out: VSOut;
    \\    out.clip_pos = vec4f(quad_x[vertex_index], quad_y[vertex_index], 0.0, 1.0);
    \\    return out;
    \\}
    \\
    \\@fragment
    \\fn fs_main(@builtin(position) frag_pos: vec4f) -> @location(0) vec4f {
    \\    let _pixel = vec2f(floor(frag_pos.x), floor(frag_pos.y));
;

const WGSL_SUFFIX =
    \\}
;

const Dim = enum { width, height };

const LoopInfo = struct {
    name: []const u8,
    dim: Dim,
};

const Builder = struct {
    gen: *Generator,
    saved_pos: u32,
    effect_param: []const u8 = "",
    locals: [MAX_LOCALS][]const u8 = undefined,
    local_count: u32 = 0,

    fn curKind(self: *Builder) TokenKind {
        return self.gen.curKind();
    }

    fn curText(self: *Builder) []const u8 {
        return self.gen.curText();
    }

    fn advance(self: *Builder) void {
        self.gen.advance_token();
    }

    fn isKeyword(self: *Builder, word: []const u8) bool {
        return self.curKind() == .identifier and std.mem.eql(u8, self.curText(), word);
    }

    fn skipTrivia(self: *Builder) void {
        while (self.curKind() == .semicolon or self.curKind() == .comment) self.advance();
    }

    fn addLocal(self: *Builder, name: []const u8) bool {
        if (self.hasLocal(name)) return false;
        if (self.local_count >= MAX_LOCALS) return false;
        self.locals[self.local_count] = name;
        self.local_count += 1;
        return true;
    }

    fn hasLocal(self: *Builder, name: []const u8) bool {
        for (self.locals[0..self.local_count]) |local_name| {
            if (std.mem.eql(u8, local_name, name)) return true;
        }
        return false;
    }

    fn parsePreamble(self: *Builder) bool {
        if (self.curKind() != .lbrace) return false;
        self.advance();
        if (self.curKind() != .lparen) return false;
        self.advance();
        if (self.curKind() != .identifier) return false;
        self.effect_param = self.curText();
        self.advance();
        while (self.curKind() == .comma or self.curKind() == .identifier) self.advance();
        if (self.curKind() != .rparen) return false;
        self.advance();
        if (self.curKind() != .arrow) return false;
        self.advance();
        if (self.curKind() != .lbrace) return false;
        self.advance();
        return true;
    }

    fn parseLocalDecl(self: *Builder) anyerror!?[]const u8 {
        if (!self.isKeyword("const") and !self.isKeyword("let") and !self.isKeyword("var")) return null;
        self.advance();
        if (self.curKind() != .identifier) return null;
        const name = self.curText();
        self.advance();
        if (self.curKind() == .colon) {
            self.advance();
            if (self.curKind() == .identifier) self.advance();
        }
        if (self.curKind() != .equals) return null;
        self.advance();
        const expr = (try self.emitExpr()) orelse return null;
        if (!self.addLocal(name)) return null;
        self.skipTrivia();
        return try std.fmt.allocPrint(self.gen.alloc, "    let {s} = {s};\n", .{ name, expr });
    }

    fn parseLoopDim(self: *Builder) ?Dim {
        if (self.curKind() != .identifier or !std.mem.eql(u8, self.curText(), self.effect_param)) return null;
        self.advance();
        if (self.curKind() != .dot) return null;
        self.advance();
        if (self.curKind() != .identifier) return null;
        const member = self.curText();
        self.advance();
        if (std.mem.eql(u8, member, "width")) return .width;
        if (std.mem.eql(u8, member, "height")) return .height;
        return null;
    }

    fn parseForLoopHeader(self: *Builder) anyerror!?LoopInfo {
        if (!self.isKeyword("for")) return null;
        self.advance();
        if (self.curKind() != .lparen) return null;
        self.advance();
        if (!self.isKeyword("let") and !self.isKeyword("const") and !self.isKeyword("var")) return null;
        self.advance();
        if (self.curKind() != .identifier) return null;
        const loop_name = self.curText();
        self.advance();
        if (self.curKind() != .equals) return null;
        self.advance();
        const init_expr = (try self.emitExpr()) orelse return null;
        if (!std.mem.eql(u8, init_expr, "0") and !std.mem.eql(u8, init_expr, "0.0")) return null;
        if (self.curKind() != .semicolon) return null;
        self.advance();
        if (self.curKind() != .identifier or !std.mem.eql(u8, self.curText(), loop_name)) return null;
        self.advance();
        if (self.curKind() != .lt) return null;
        self.advance();
        const dim = self.parseLoopDim() orelse return null;
        if (self.curKind() != .semicolon) return null;
        self.advance();
        if (self.curKind() != .identifier or !std.mem.eql(u8, self.curText(), loop_name)) return null;
        self.advance();
        if (self.curKind() != .plus) return null;
        self.advance();
        if (self.curKind() != .plus) return null;
        self.advance();
        if (self.curKind() != .rparen) return null;
        self.advance();
        return .{ .name = loop_name, .dim = dim };
    }

    fn parseSetPixel(self: *Builder, x_name: []const u8, y_name: []const u8) anyerror!?[]const u8 {
        if (self.curKind() != .identifier or !std.mem.eql(u8, self.curText(), self.effect_param)) return null;
        self.advance();
        if (self.curKind() != .dot) return null;
        self.advance();
        if (!self.isKeyword("setPixel")) return null;
        self.advance();
        if (self.curKind() != .lparen) return null;
        self.advance();

        const px = (try self.emitExpr()) orelse return null;
        if (self.curKind() != .comma) return null;
        self.advance();
        const py = (try self.emitExpr()) orelse return null;
        if (self.curKind() != .comma) return null;
        self.advance();
        const r = (try self.emitExpr()) orelse return null;
        if (self.curKind() != .comma) return null;
        self.advance();
        const g = (try self.emitExpr()) orelse return null;
        if (self.curKind() != .comma) return null;
        self.advance();
        const b = (try self.emitExpr()) orelse return null;
        if (self.curKind() != .comma) return null;
        self.advance();
        const a = (try self.emitExpr()) orelse return null;
        if (self.curKind() != .rparen) return null;
        self.advance();
        if (!std.mem.eql(u8, px, x_name) or !std.mem.eql(u8, py, y_name)) return null;
        return try std.fmt.allocPrint(self.gen.alloc, "    return vec4f({s}, {s}, {s}, {s});\n", .{ r, g, b, a });
    }

    fn emitExpr(self: *Builder) anyerror!?[]const u8 {
        return try self.emitTernary();
    }

    fn emitTernary(self: *Builder) anyerror!?[]const u8 {
        const cond = (try self.emitLogicalOr()) orelse return null;
        if (self.curKind() == .question_question) return null;
        if (self.curKind() == .question) {
            self.advance();
            const then_expr = (try self.emitTernary()) orelse return null;
            if (self.curKind() != .colon) return null;
            self.advance();
            const else_expr = (try self.emitTernary()) orelse return null;
            return try std.fmt.allocPrint(self.gen.alloc, "select({s}, {s}, {s})", .{ else_expr, then_expr, cond });
        }
        return cond;
    }

    fn emitLogicalOr(self: *Builder) anyerror!?[]const u8 {
        var left = (try self.emitLogicalAnd()) orelse return null;
        while (self.curKind() == .pipe_pipe) {
            self.advance();
            const right = (try self.emitLogicalAnd()) orelse return null;
            left = try std.fmt.allocPrint(self.gen.alloc, "({s} || {s})", .{ left, right });
        }
        return left;
    }

    fn emitLogicalAnd(self: *Builder) anyerror!?[]const u8 {
        var left = (try self.emitEquality()) orelse return null;
        while (self.curKind() == .amp_amp) {
            self.advance();
            const right = (try self.emitEquality()) orelse return null;
            left = try std.fmt.allocPrint(self.gen.alloc, "({s} && {s})", .{ left, right });
        }
        return left;
    }

    fn emitEquality(self: *Builder) anyerror!?[]const u8 {
        var left = (try self.emitComparison()) orelse return null;
        while (self.curKind() == .eq_eq or self.curKind() == .not_eq) {
            const op = if (self.curKind() == .eq_eq) "==" else "!=";
            self.advance();
            const right = (try self.emitComparison()) orelse return null;
            left = try std.fmt.allocPrint(self.gen.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    fn emitComparison(self: *Builder) anyerror!?[]const u8 {
        var left = (try self.emitAdditive()) orelse return null;
        while (self.curKind() == .lt or self.curKind() == .gt or self.curKind() == .lt_eq or self.curKind() == .gt_eq) {
            const op = switch (self.curKind()) {
                .lt => "<",
                .gt => ">",
                .lt_eq => "<=",
                .gt_eq => ">=",
                else => unreachable,
            };
            self.advance();
            const right = (try self.emitAdditive()) orelse return null;
            left = try std.fmt.allocPrint(self.gen.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    fn emitAdditive(self: *Builder) anyerror!?[]const u8 {
        var left = (try self.emitMultiplicative()) orelse return null;
        while (self.curKind() == .plus or self.curKind() == .minus) {
            const op = if (self.curKind() == .plus) "+" else "-";
            self.advance();
            const right = (try self.emitMultiplicative()) orelse return null;
            left = try std.fmt.allocPrint(self.gen.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    fn emitMultiplicative(self: *Builder) anyerror!?[]const u8 {
        var left = (try self.emitUnary()) orelse return null;
        while (self.curKind() == .star or self.curKind() == .slash or self.curKind() == .percent) {
            const op = switch (self.curKind()) {
                .star => "*",
                .slash => "/",
                .percent => "%",
                else => unreachable,
            };
            self.advance();
            const right = (try self.emitUnary()) orelse return null;
            left = try std.fmt.allocPrint(self.gen.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    fn emitUnary(self: *Builder) anyerror!?[]const u8 {
        if (self.curKind() == .bang) {
            self.advance();
            const operand = (try self.emitUnary()) orelse return null;
            return try std.fmt.allocPrint(self.gen.alloc, "(!{s})", .{operand});
        }
        if (self.curKind() == .minus) {
            self.advance();
            const operand = (try self.emitUnary()) orelse return null;
            return try std.fmt.allocPrint(self.gen.alloc, "(-{s})", .{operand});
        }
        if (self.curKind() == .tilde) return null;
        return try self.emitPostfix();
    }

    fn emitPostfix(self: *Builder) anyerror!?[]const u8 {
        var expr = (try self.emitAtom()) orelse return null;
        while (self.curKind() == .lbracket) {
            self.advance();
            const idx = (try self.emitExpr()) orelse return null;
            if (self.curKind() != .rbracket) return null;
            self.advance();
            expr = try std.fmt.allocPrint(self.gen.alloc, "{s}[{s}]", .{ expr, idx });
        }
        return expr;
    }

    fn emitEffectCall(self: *Builder, member: []const u8) anyerror!?[]const u8 {
        if (self.curKind() != .lparen) return null;
        self.advance();
        var args: [8][]const u8 = undefined;
        var arg_count: u32 = 0;
        while (self.curKind() != .rparen and self.curKind() != .eof) {
            if (arg_count >= args.len) return null;
            args[arg_count] = (try self.emitExpr()) orelse return null;
            arg_count += 1;
            if (self.curKind() == .comma) {
                self.advance();
            } else {
                break;
            }
        }
        if (self.curKind() != .rparen) return null;
        self.advance();

        if (std.mem.eql(u8, member, "sin") or std.mem.eql(u8, member, "cos") or
            std.mem.eql(u8, member, "sqrt") or std.mem.eql(u8, member, "abs") or
            std.mem.eql(u8, member, "floor") or std.mem.eql(u8, member, "ceil"))
        {
            if (arg_count != 1) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "{s}({s})", .{ member, args[0] });
        }
        if (std.mem.eql(u8, member, "mod")) {
            if (arg_count != 2) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "mod({s}, {s})", .{ args[0], args[1] });
        }
        if (std.mem.eql(u8, member, "atan2")) {
            if (arg_count != 2) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "atan2({s}, {s})", .{ args[0], args[1] });
        }
        if (std.mem.eql(u8, member, "noise")) {
            if (arg_count != 2) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "noise2d(vec2f({s}, {s}))", .{ args[0], args[1] });
        }
        if (std.mem.eql(u8, member, "noise3")) {
            if (arg_count != 3) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "noise3d(vec3f({s}, {s}, {s}))", .{ args[0], args[1], args[2] });
        }
        if (std.mem.eql(u8, member, "fbm")) {
            if (arg_count != 3) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "fbm2d(vec2f({s}, {s}), i32({s}))", .{ args[0], args[1], args[2] });
        }
        if (std.mem.eql(u8, member, "lerp")) {
            if (arg_count != 3) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "mix({s}, {s}, {s})", .{ args[0], args[1], args[2] });
        }
        if (std.mem.eql(u8, member, "remap")) {
            if (arg_count != 5) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "remap({s}, {s}, {s}, {s}, {s})", .{ args[0], args[1], args[2], args[3], args[4] });
        }
        if (std.mem.eql(u8, member, "smoothstep")) {
            if (arg_count != 3) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "smoothstep({s}, {s}, {s})", .{ args[0], args[1], args[2] });
        }
        if (std.mem.eql(u8, member, "clamp")) {
            if (arg_count != 3) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "clamp({s}, {s}, {s})", .{ args[0], args[1], args[2] });
        }
        if (std.mem.eql(u8, member, "dist")) {
            if (arg_count != 4) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "distance(vec2f({s}, {s}), vec2f({s}, {s}))", .{ args[0], args[1], args[2], args[3] });
        }
        if (std.mem.eql(u8, member, "hsv")) {
            if (arg_count != 3) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "hsv_to_rgb({s}, {s}, {s})", .{ args[0], args[1], args[2] });
        }
        if (std.mem.eql(u8, member, "hsl")) {
            if (arg_count != 3) return null;
            return try std.fmt.allocPrint(self.gen.alloc, "hsl_to_rgb({s}, {s}, {s})", .{ args[0], args[1], args[2] });
        }
        return null;
    }

    fn emitEffectMember(self: *Builder) anyerror!?[]const u8 {
        self.advance(); // effect param
        if (self.curKind() != .dot) return null;
        self.advance();
        if (self.curKind() != .identifier) return null;
        const member = self.curText();
        self.advance();
        if (self.curKind() == .lparen) {
            return try self.emitEffectCall(member);
        }
        if (std.mem.eql(u8, member, "width")) return "u.size.x";
        if (std.mem.eql(u8, member, "height")) return "u.size.y";
        if (std.mem.eql(u8, member, "time")) return "u.time";
        if (std.mem.eql(u8, member, "dt")) return "u.dt";
        if (std.mem.eql(u8, member, "frame")) return "u.frame";
        if (std.mem.eql(u8, member, "mouse_x")) return "u.mouse_x";
        if (std.mem.eql(u8, member, "mouse_y")) return "u.mouse_y";
        if (std.mem.eql(u8, member, "mouse_inside")) return "(u.mouse_inside > 0.5)";
        return null;
    }

    fn emitAtom(self: *Builder) anyerror!?[]const u8 {
        if (self.curKind() == .lparen) {
            self.advance();
            const inner = (try self.emitExpr()) orelse return null;
            if (self.curKind() != .rparen) return null;
            self.advance();
            return try std.fmt.allocPrint(self.gen.alloc, "({s})", .{inner});
        }
        if (self.curKind() == .number) {
            const value = self.curText();
            self.advance();
            return try self.gen.alloc.dupe(u8, value);
        }
        if (self.curKind() == .identifier) {
            const name = self.curText();
            if (std.mem.eql(u8, name, self.effect_param)) {
                return try self.emitEffectMember();
            }
            self.advance();
            if (std.mem.eql(u8, name, "true") or std.mem.eql(u8, name, "false")) {
                return try self.gen.alloc.dupe(u8, name);
            }
            if (self.hasLocal(name)) {
                return try self.gen.alloc.dupe(u8, name);
            }
            return null;
        }
        return null;
    }
};

pub fn tryGenerate(self: *Generator, start: u32) anyerror!?Result {
    var builder = Builder{
        .gen = self,
        .saved_pos = self.pos,
    };
    defer self.pos = builder.saved_pos;
    self.pos = start;

    if (!builder.parsePreamble()) return null;
    builder.skipTrivia();

    var prelude: std.ArrayListUnmanaged(u8) = .{};
    while (builder.isKeyword("const") or builder.isKeyword("let") or builder.isKeyword("var")) {
        const stmt = (try builder.parseLocalDecl()) orelse return null;
        try prelude.appendSlice(self.alloc, stmt);
        builder.skipTrivia();
    }

    const outer = (try builder.parseForLoopHeader()) orelse return null;
    if (builder.curKind() != .lbrace) return null;
    builder.advance();
    builder.skipTrivia();

    const inner = (try builder.parseForLoopHeader()) orelse return null;
    if (outer.dim == inner.dim) return null;
    const x_name = if (outer.dim == .width) outer.name else inner.name;
    const y_name = if (outer.dim == .height) outer.name else inner.name;
    if (std.mem.eql(u8, x_name, y_name)) return null;
    if (!builder.addLocal(x_name) or !builder.addLocal(y_name)) return null;

    if (builder.curKind() != .lbrace) return null;
    builder.advance();
    builder.skipTrivia();

    var inner_body: std.ArrayListUnmanaged(u8) = .{};
    try inner_body.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    let {s} = _pixel.x;\n", .{x_name}));
    try inner_body.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    let {s} = _pixel.y;\n", .{y_name}));

    while (builder.isKeyword("const") or builder.isKeyword("let") or builder.isKeyword("var")) {
        const stmt = (try builder.parseLocalDecl()) orelse return null;
        try inner_body.appendSlice(self.alloc, stmt);
        builder.skipTrivia();
    }

    const color_stmt = (try builder.parseSetPixel(x_name, y_name)) orelse return null;
    try inner_body.appendSlice(self.alloc, color_stmt);
    builder.skipTrivia();

    if (builder.curKind() != .rbrace) return null;
    builder.advance();
    builder.skipTrivia();
    if (builder.curKind() != .rbrace) return null;
    builder.advance();
    builder.skipTrivia();
    if (builder.curKind() != .rbrace) return null;

    var full_source: std.ArrayListUnmanaged(u8) = .{};
    try full_source.appendSlice(self.alloc, WGSL_PREFIX);
    try full_source.appendSlice(self.alloc, prelude.items);
    try full_source.appendSlice(self.alloc, inner_body.items);
    try full_source.appendSlice(self.alloc, WGSL_SUFFIX);
    return .{ .wgsl = try self.alloc.dupe(u8, full_source.items) };
}
