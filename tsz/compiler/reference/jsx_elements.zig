//! Element field emission — extracted from jsx.zig for 3D and Physics elements.
//!
//! Handles the field generation for Scene3D, 3D.*, Physics.World/Body/Collider.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;

/// 3D element props parsed from JSX attributes.
pub const Scene3DProps = struct {
    is_scene3d: bool = false,
    is_3d: bool = false,
    is_3d_mesh: bool = false,
    is_3d_camera: bool = false,
    is_3d_light: bool = false,
    is_3d_group: bool = false,
    geometry: []const u8 = "",
    light_type: []const u8 = "",
    color: []const u8 = "",
    fov: []const u8 = "",
    intensity: []const u8 = "",
    radius: []const u8 = "",
    tube_radius: []const u8 = "",
    show_grid: bool = false,
    show_axes: bool = false,
    pos: [3][]const u8 = .{ "", "", "" },
    rot: [3][]const u8 = .{ "", "", "" },
    lookat: [3][]const u8 = .{ "", "", "" },
    dir: [3][]const u8 = .{ "", "", "" },
    size: [3][]const u8 = .{ "", "", "" },
    scale: [3][]const u8 = .{ "", "", "" },
};

/// Physics element props parsed from JSX attributes.
pub const PhysicsProps = struct {
    is_physics_world: bool = false,
    is_physics_body: bool = false,
    is_physics_collider: bool = false,
    body_type: []const u8 = "dynamic",
    x: []const u8 = "0",
    y: []const u8 = "0",
    angle: []const u8 = "0",
    gravity_x: []const u8 = "0",
    gravity_y: []const u8 = "980",
    shape: []const u8 = "rectangle",
    radius: []const u8 = "0",
    width: []const u8 = "0",
    height: []const u8 = "0",
    density: []const u8 = "1.0",
    friction: []const u8 = "0.3",
    restitution: []const u8 = "0.1",
    fixed_rotation: bool = false,
    bullet: bool = false,
    gravity_scale: []const u8 = "1.0",
};

/// Emit 3D element fields into the node field string.
pub fn emit3DFields(self: *Generator, fields: *std.ArrayListUnmanaged(u8), props: Scene3DProps) !void {
    if (props.is_scene3d) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".scene3d = true");
        if (props.show_grid) try fields.appendSlice(self.alloc, ", .scene3d_show_grid = true");
        if (props.show_axes) try fields.appendSlice(self.alloc, ", .scene3d_show_axes = true");
    }
    if (!props.is_3d) return;

    if (props.is_3d_mesh) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".scene3d_mesh = true");
    }
    if (props.is_3d_camera) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".scene3d_camera = true");
    }
    if (props.is_3d_light) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".scene3d_light = true");
    }
    if (props.is_3d_group) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".scene3d_group = true");
    }

    if (props.geometry.len > 0) try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_geometry = \"{s}\"", .{props.geometry}));
    if (props.light_type.len > 0) try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_light_type = \"{s}\"", .{props.light_type}));

    if (props.color.len > 0) {
        const hex = if (props.color.len > 0 and props.color[0] == '#') props.color[1..] else props.color;
        if (hex.len == 6) {
            const r_val = std.fmt.parseInt(u8, hex[0..2], 16) catch 200;
            const g_val = std.fmt.parseInt(u8, hex[2..4], 16) catch 200;
            const b_val = std.fmt.parseInt(u8, hex[4..6], 16) catch 200;
            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_color_r = {d:.3}, .scene3d_color_g = {d:.3}, .scene3d_color_b = {d:.3}", .{ @as(f32, @floatFromInt(r_val)) / 255.0, @as(f32, @floatFromInt(g_val)) / 255.0, @as(f32, @floatFromInt(b_val)) / 255.0 }));
        }
    }

    if (props.pos[0].len > 0) {
        const px = if (std.mem.startsWith(u8, props.pos[0], "state.get")) "0" else props.pos[0];
        const py = if (std.mem.startsWith(u8, props.pos[1], "state.get")) "0" else props.pos[1];
        const pz = if (std.mem.startsWith(u8, props.pos[2], "state.get")) "0" else props.pos[2];
        try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_pos_x = {s}, .scene3d_pos_y = {s}, .scene3d_pos_z = {s}", .{ px, py, pz }));
    }
    if (props.rot[0].len > 0) {
        const rx = if (std.mem.startsWith(u8, props.rot[0], "state.get")) "0" else props.rot[0];
        const ry = if (std.mem.startsWith(u8, props.rot[1], "state.get")) "0" else props.rot[1];
        const rz = if (std.mem.startsWith(u8, props.rot[2], "state.get")) "0" else props.rot[2];
        try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_rot_x = {s}, .scene3d_rot_y = {s}, .scene3d_rot_z = {s}", .{ rx, ry, rz }));
    }
    if (props.lookat[0].len > 0) {
        const lx = if (std.mem.startsWith(u8, props.lookat[0], "state.get")) "0" else props.lookat[0];
        const ly = if (std.mem.startsWith(u8, props.lookat[1], "state.get")) "0" else props.lookat[1];
        const lz = if (std.mem.startsWith(u8, props.lookat[2], "state.get")) "0" else props.lookat[2];
        try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_look_x = {s}, .scene3d_look_y = {s}, .scene3d_look_z = {s}", .{ lx, ly, lz }));
    }
    if (props.dir[0].len > 0) try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_dir_x = {s}, .scene3d_dir_y = {s}, .scene3d_dir_z = {s}", .{ props.dir[0], props.dir[1], props.dir[2] }));
    if (props.size[0].len > 0) try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_size_x = {s}, .scene3d_size_y = {s}, .scene3d_size_z = {s}", .{ props.size[0], props.size[1], props.size[2] }));
    if (props.scale[0].len > 0) try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_scale_x = {s}, .scene3d_scale_y = {s}, .scene3d_scale_z = {s}", .{ props.scale[0], props.scale[1], props.scale[2] }));
    if (props.fov.len > 0) try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_fov = {s}", .{props.fov}));
    if (props.intensity.len > 0) try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_intensity = {s}", .{props.intensity}));
    if (props.radius.len > 0) try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_radius = {s}", .{props.radius}));
    if (props.tube_radius.len > 0) try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .scene3d_tube_radius = {s}", .{props.tube_radius}));
}

/// Emit Physics element fields into the node field string.
pub fn emitPhysicsFields(self: *Generator, fields: *std.ArrayListUnmanaged(u8), props: PhysicsProps) !void {
    if (props.is_physics_world) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".physics_world = true");
        try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .physics_gravity_x = {s}, .physics_gravity_y = {s}", .{ props.gravity_x, props.gravity_y }));
    }
    if (props.is_physics_body) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".physics_body = true");
        const bt: u8 = if (std.mem.eql(u8, props.body_type, "static")) 0 else if (std.mem.eql(u8, props.body_type, "kinematic")) 1 else 2;
        try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .physics_body_type = {d}, .physics_x = {s}, .physics_y = {s}, .physics_angle = {s}", .{ bt, props.x, props.y, props.angle }));
        if (props.fixed_rotation) try fields.appendSlice(self.alloc, ", .physics_fixed_rotation = true");
        if (props.bullet) try fields.appendSlice(self.alloc, ", .physics_bullet = true");
        if (!std.mem.eql(u8, props.gravity_scale, "1.0")) {
            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .physics_gravity_scale = {s}", .{props.gravity_scale}));
        }
        // If body has inline restitution/density/friction, set them for convenience
        if (!std.mem.eql(u8, props.restitution, "0.1")) {
            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .physics_restitution = {s}", .{props.restitution}));
        }
    }
    if (props.is_physics_collider) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".physics_collider = true");
        const shape_val: u8 = if (std.mem.eql(u8, props.shape, "circle")) 1 else 0;
        try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .physics_shape = {d}, .physics_density = {s}, .physics_friction = {s}, .physics_restitution = {s}", .{ shape_val, props.density, props.friction, props.restitution }));
        if (shape_val == 1) {
            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .physics_radius = {s}", .{props.radius}));
        }
        // Display none — colliders have no visual
        try fields.appendSlice(self.alloc, ", .style = .{ .display = .none }");
    }
}

/// Parse a 2-element numeric array: {[x, y]} → [2][]const u8
/// Handles gravity={[0, 980]} — skips braces, brackets, commas, negatives.
pub fn parse2DVector(self: *Generator) ![2][]const u8 {
    var result: [2][]const u8 = .{ "0", "0" };
    // Skip { [ or just [
    if (self.curKind() == .lbrace) self.advance_token();
    if (self.curKind() == .lbracket) self.advance_token();
    // First value (may have leading -)
    var idx: usize = 0;
    while (idx < 2) : (idx += 1) {
        if (self.curKind() == .minus) {
            self.advance_token();
            if (self.curKind() == .number) {
                result[idx] = try std.fmt.allocPrint(self.alloc, "-{s}", .{self.curText()});
                self.advance_token();
            }
        } else if (self.curKind() == .number) {
            result[idx] = self.curText();
            self.advance_token();
        }
        if (self.curKind() == .comma) self.advance_token();
    }
    if (self.curKind() == .rbracket) self.advance_token();
    if (self.curKind() == .rbrace) self.advance_token();
    return result;
}

/// Parse {[x, y, z]} — a 3-element numeric array. Handles negatives, state refs.
pub fn parse3DVector(self: *Generator) ![3][]const u8 {
    var result: [3][]const u8 = .{ "0", "0", "0" };
    if (self.curKind() == .lbrace) self.advance_token();
    if (self.curKind() == .lbracket) self.advance_token();
    var i: usize = 0;
    while (i < 3 and self.curKind() != .rbracket and self.curKind() != .rbrace and self.curKind() != .eof) {
        var neg = false;
        if (self.curKind() == .minus) { neg = true; self.advance_token(); }
        if (self.curKind() == .number) {
            const val = self.curText();
            self.advance_token();
            result[i] = if (neg) try std.fmt.allocPrint(self.alloc, "-{s}", .{val}) else val;
        } else if (self.curKind() == .identifier) {
            const ident = self.curText();
            self.advance_token();
            if (self.isState(ident)) |slot_id| {
                const rid = self.regularSlotId(slot_id);
                const st = self.stateTypeById(slot_id);
                result[i] = switch (st) {
                    .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                    else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                };
            }
        }
        i += 1;
        if (self.curKind() == .comma) self.advance_token();
    }
    if (self.curKind() == .rbracket) self.advance_token();
    if (self.curKind() == .rbrace) self.advance_token();
    return result;
}

/// Parse a possibly-negative number from {-123} or {123}.
pub fn parseSignedNum(self: *Generator) ![]const u8 {
    if (self.curKind() == .lbrace) self.advance_token();
    var neg = false;
    if (self.curKind() == .minus) { neg = true; self.advance_token(); }
    const val = self.curText();
    self.advance_token();
    if (self.curKind() == .rbrace) self.advance_token();
    if (neg) return try std.fmt.allocPrint(self.alloc, "-{s}", .{val});
    return val;
}

const attrs = @import("attrs.zig");

/// Emit escaped text content into a field buffer (handles \", \\, \n, \x01).
pub fn emitEscapedText(fields: *std.ArrayListUnmanaged(u8), alloc: std.mem.Allocator, text: []const u8) !void {
    for (text) |ch| {
        if (ch == 0x01) try fields.appendSlice(alloc, "\\x01")
        else if (ch == '"') try fields.appendSlice(alloc, "\\\"")
        else if (ch == '\\') try fields.appendSlice(alloc, "\\\\")
        else if (ch == '\n') try fields.appendSlice(alloc, "\\n")
        else try fields.append(alloc, ch);
    }
}

/// Parse a <Glyph d="..." fill="#color" /> element inside <Text>.
/// Appends \x01 sentinel to text_builder, returns glyph expression string.
pub fn parseInlineGlyph(self: *Generator, text_builder: *std.ArrayListUnmanaged(u8)) ![]const u8 {
    self.advance_token(); // skip <
    self.advance_token(); // skip Glyph
    var gd: []const u8 = "";
    var gfill: []const u8 = "#ffffff";
    var gstroke: []const u8 = "";
    var gstroke_w: []const u8 = "0";
    var gscale: []const u8 = "1.0";
    var gfill_effect: []const u8 = "";
    while (self.curKind() == .identifier) {
        const aname = self.curText();
        self.advance_token();
        if (self.curKind() != .equals) continue;
        self.advance_token(); // skip =
        const aval = if (self.curKind() == .string) blk: {
            const raw = self.cur().text(self.source);
            self.advance_token();
            break :blk raw[1 .. raw.len - 1];
        } else if (self.curKind() == .lbrace) blk: {
            self.advance_token();
            const v = self.curText();
            self.advance_token();
            if (self.curKind() == .rbrace) self.advance_token();
            break :blk v;
        } else blk: {
            const v = self.curText();
            self.advance_token();
            break :blk v;
        };
        if (std.mem.eql(u8, aname, "d")) gd = aval
        else if (std.mem.eql(u8, aname, "fill")) gfill = aval
        else if (std.mem.eql(u8, aname, "stroke")) gstroke = aval
        else if (std.mem.eql(u8, aname, "strokeWidth")) gstroke_w = aval
        else if (std.mem.eql(u8, aname, "scale")) gscale = aval
        else if (std.mem.eql(u8, aname, "fillEffect")) gfill_effect = aval;
    }
    if (self.curKind() == .slash_gt) self.advance_token()
    else if (self.curKind() == .gt) self.advance_token();
    try text_builder.append(self.alloc, 0x01);
    const fill_color = try attrs.parseColorValue(self, gfill);
    const stroke_color = if (gstroke.len > 0) try attrs.parseColorValue(self, gstroke) else "Color.rgba(0, 0, 0, 0)";
    return try std.fmt.allocPrint(self.alloc,
        ".{{ .d = \"{s}\", .fill = {s}, .stroke = {s}, .stroke_width = {s}, .scale = {s}{s} }}",
        .{ gd, fill_color, stroke_color, gstroke_w, gscale,
           if (gfill_effect.len > 0) try std.fmt.allocPrint(self.alloc, ", .fill_effect = \"{s}\"", .{gfill_effect}) else "" },
    );
}

