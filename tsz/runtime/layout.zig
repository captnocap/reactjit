//! ReactJIT Layout Engine
//!
//! Flexbox layout solver ported from lua/layout.lua.
//! Computes {x, y, w, h} for every node in the tree.
//!
//! Supports:
//!   - flexDirection: row, column
//!   - flexGrow, flexShrink, flexBasis
//!   - flexWrap: nowrap, wrap (multi-line flex)
//!   - justifyContent: start, center, end, space-between, space-around, space-evenly
//!   - alignItems: start, center, end, stretch
//!   - alignSelf: auto, start, center, end, stretch (per-child override)
//!   - padding (all sides + per-side)
//!   - margin (all sides + per-side)
//!   - gap (between items and between lines)
//!   - width, height (pixel values)
//!   - minWidth, maxWidth, minHeight, maxHeight
//!   - aspectRatio (derive missing dimension)
//!   - position: relative, absolute (out-of-flow via top/left/right/bottom)
//!   - display: none
//!   - overflow: visible, hidden, scroll
//!   - textAlign: left, center, right (inherited)
//!   - Auto-sizing from children
//!   - Text re-measurement after flex distribution
//!   - Layout budget guard (100k nodes max)
//!
//! Arena-allocated: one frame = one arena = one bulk free.

const std = @import("std");
const events = @import("events.zig");

// ── Style ───────────────────────────────────────────────────────────────────

pub const FlexDirection = enum { row, column };

pub const JustifyContent = enum {
    start,
    center,
    end_,
    space_between,
    space_around,
    space_evenly,
};

pub const AlignItems = enum {
    start,
    center,
    end_,
    stretch,
};

pub const AlignSelf = enum {
    auto,
    start,
    center,
    end_,
    stretch,
};

pub const FlexWrap = enum { nowrap, wrap };

pub const Position = enum { relative, absolute };

pub const Display = enum { flex, none };

pub const Overflow = enum { visible, hidden, scroll };

pub const TextAlign = enum { left, center, right };

/// Style properties for a node. Mirrors the CSS-like style object from React.
/// All dimensions are in pixels (Phase 1 — no percentages/vw/vh yet).
pub const Style = struct {
    // Dimensions
    width: ?f32 = null,
    height: ?f32 = null,
    min_width: ?f32 = null,
    max_width: ?f32 = null,
    min_height: ?f32 = null,
    max_height: ?f32 = null,

    // Flex
    flex_direction: FlexDirection = .column,
    flex_grow: f32 = 0,
    flex_shrink: ?f32 = null, // null = CSS default (1)
    flex_basis: ?f32 = null, // null = auto (use width/height)
    flex_wrap: FlexWrap = .nowrap,
    justify_content: JustifyContent = .start,
    align_items: AlignItems = .stretch,
    align_self: AlignSelf = .auto,
    gap: f32 = 0,

    // Positioning
    position: Position = .relative,
    top: ?f32 = null,
    left: ?f32 = null,
    right: ?f32 = null,
    bottom: ?f32 = null,

    // Aspect ratio
    aspect_ratio: ?f32 = null,

    // Padding
    padding: f32 = 0,
    padding_left: ?f32 = null,
    padding_right: ?f32 = null,
    padding_top: ?f32 = null,
    padding_bottom: ?f32 = null,

    // Margin
    margin: f32 = 0,
    margin_left: ?f32 = null,
    margin_right: ?f32 = null,
    margin_top: ?f32 = null,
    margin_bottom: ?f32 = null,

    // Display
    display: Display = .flex,

    // Overflow
    overflow: Overflow = .visible,

    // Text
    text_align: TextAlign = .left,

    // Visual
    background_color: ?Color = null,
    border_radius: f32 = 0,
    opacity: f32 = 1.0,

    // Border
    border_width: f32 = 0,
    border_color: ?Color = null,

    // Stacking
    z_index: i16 = 0,

    // Box shadow
    shadow_offset_x: f32 = 0,
    shadow_offset_y: f32 = 0,
    shadow_blur: f32 = 0,
    shadow_color: ?Color = null,

    pub fn padLeft(self: Style) f32 {
        return self.padding_left orelse self.padding;
    }
    pub fn padRight(self: Style) f32 {
        return self.padding_right orelse self.padding;
    }
    pub fn padTop(self: Style) f32 {
        return self.padding_top orelse self.padding;
    }
    pub fn padBottom(self: Style) f32 {
        return self.padding_bottom orelse self.padding;
    }
    pub fn marLeft(self: Style) f32 {
        return self.margin_left orelse self.margin;
    }
    pub fn marRight(self: Style) f32 {
        return self.margin_right orelse self.margin;
    }
    pub fn marTop(self: Style) f32 {
        return self.margin_top orelse self.margin;
    }
    pub fn marBottom(self: Style) f32 {
        return self.margin_bottom orelse self.margin;
    }
};

// ── Color ───────────────────────────────────────────────────────────────────

pub const Color = struct {
    r: u8,
    g: u8,
    b: u8,
    a: u8 = 255,

    pub fn rgb(r: u8, g: u8, b: u8) Color {
        return .{ .r = r, .g = g, .b = b, .a = 255 };
    }

    pub fn rgba(r: u8, g: u8, b: u8, a: u8) Color {
        return .{ .r = r, .g = g, .b = b, .a = a };
    }
};

// ── Text Metrics ────────────────────────────────────────────────────────────

pub const TextMetrics = struct {
    width: f32 = 0,
    height: f32 = 0,
    ascent: f32 = 0,
};

/// Function pointer type for text measurement callback.
/// The layout engine calls this to measure text nodes.
/// max_width: wrapping constraint in pixels (0 = unconstrained single line).
/// letter_spacing: extra pixels between glyphs (0 = none).
/// line_height: override line height in pixels (0 = use font default).
/// max_lines: max number of lines to measure (0 = unlimited).
pub const MeasureTextFn = *const fn (text: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16) TextMetrics;

/// Image dimensions returned by the image measurement callback.
pub const ImageDims = struct {
    width: f32 = 0,
    height: f32 = 0,
};

/// Function pointer type for image measurement callback.
/// The layout engine calls this to get natural image dimensions.
pub const MeasureImageFn = *const fn (path: []const u8) ImageDims;

// ── Layout Result ───────────────────────────────────────────────────────────

pub const LayoutRect = struct {
    x: f32 = 0,
    y: f32 = 0,
    w: f32 = 0,
    h: f32 = 0,
};

// ── Node ────────────────────────────────────────────────────────────────────

pub const Node = struct {
    style: Style = .{},
    children: []Node = &.{},
    computed: LayoutRect = .{},

    /// Text content for text nodes (null for containers)
    text: ?[]const u8 = null,
    /// Font size in pixels (for text nodes)
    font_size: u16 = 16,
    /// Text color (separate from background_color)
    text_color: ?Color = null,
    /// Extra pixels between glyphs (0 = none)
    letter_spacing: f32 = 0,
    /// Override line height in pixels (0 = use font default)
    line_height: f32 = 0,
    /// Max visible lines (0 = unlimited)
    number_of_lines: u16 = 0,

    /// Image source path (null for non-image nodes)
    image_src: ?[]const u8 = null,

    /// TextInput: input slot ID (null for non-input nodes)
    input_id: ?u8 = null,
    /// TextInput: placeholder text
    placeholder: ?[]const u8 = null,

    /// Event handlers (onPress, onHover, onKey). Set at compile time.
    handlers: events.EventHandler = .{},

    /// Scroll state — per-node, mutated by mouse wheel events
    scroll_x: f32 = 0,
    scroll_y: f32 = 0,
    /// Total content height (set by layout for scroll extent)
    content_height: f32 = 0,

    // Internal: set by parent's flex pass, consumed by layoutNode
    _flex_w: ?f32 = null,
    _stretch_h: ?f32 = null,
    _parent_inner_w: ?f32 = null,
    _parent_inner_h: ?f32 = null,
};

// ── Clamp ───────────────────────────────────────────────────────────────────

fn clamp(val: f32, min_val: ?f32, max_val: ?f32) f32 {
    var v = val;
    if (min_val) |mn| {
        if (v < mn) v = mn;
    }
    if (max_val) |mx| {
        if (v > mx) v = mx;
    }
    return v;
}

// ── Intrinsic Size Estimation ───────────────────────────────────────────────
// Recursively estimate a node's content size bottom-up.
// For containers: sum children on main axis, max on cross axis.
// Text measurement will be added in Phase 2.

// Thread-local (frame-local) measure function — set before each layout pass
var _measure_fn: ?MeasureTextFn = null;
var _measure_image_fn: ?MeasureImageFn = null;

// Layout budget: cap node visits per pass to detect infinite loops
const LAYOUT_BUDGET: u32 = 100_000;
var _layout_count: u32 = 0;

pub fn setMeasureFn(f: ?MeasureTextFn) void {
    _measure_fn = f;
}

pub fn setMeasureImageFn(f: ?MeasureImageFn) void {
    _measure_image_fn = f;
}

fn measureNodeImage(node: *Node) ImageDims {
    if (node.image_src) |src| {
        if (_measure_image_fn) |measure| {
            return measure(src);
        }
    }
    return .{};
}

fn measureNodeText(node: *Node) TextMetrics {
    return measureNodeTextW(node, 0);
}

/// Measure text with a width constraint for word wrapping.
/// max_width = 0 means unconstrained (single line).
fn measureNodeTextW(node: *Node, max_width: f32) TextMetrics {
    if (node.text) |text| {
        if (_measure_fn) |measure| {
            return measure(text, node.font_size, max_width, node.letter_spacing, node.line_height, node.number_of_lines);
        }
    }
    return .{};
}

fn estimateIntrinsicWidth(node: *Node) f32 {
    const s = node.style;
    if (s.width) |w| return w;

    const pad_l = s.padLeft();
    const pad_r = s.padRight();
    const gap = s.gap;
    const is_row = s.flex_direction == .row;

    // Text nodes: measure text width
    if (node.text != null) {
        const m = measureNodeText(node);
        return m.width + pad_l + pad_r;
    }

    // Image nodes: use natural width
    if (node.image_src != null) {
        const dims = measureNodeImage(node);
        return dims.width + pad_l + pad_r;
    }


    if (node.children.len == 0) return pad_l + pad_r;

    var total: f32 = 0;
    var max_cross: f32 = 0;
    var visible_count: usize = 0;

    for (node.children) |*child| {
        if (child.style.display == .none) continue;
        const cw = estimateIntrinsicWidth(child);
        const cm_l = child.style.marLeft();
        const cm_r = child.style.marRight();

        if (is_row) {
            total += cw + cm_l + cm_r;
            visible_count += 1;
        } else {
            const cross = cw + cm_l + cm_r;
            if (cross > max_cross) max_cross = cross;
        }
    }

    if (is_row) {
        const gaps = if (visible_count > 1) gap * @as(f32, @floatFromInt(visible_count - 1)) else 0;
        return total + gaps + pad_l + pad_r;
    }
    return max_cross + pad_l + pad_r;
}

/// Estimate intrinsic height of a node.
/// available_width: known parent width for text wrapping (0 = unknown).
/// When a container has explicit width, that propagates down so text
/// children can report wrapped height instead of single-line height.
fn estimateIntrinsicHeight(node: *Node, available_width: f32) f32 {
    const s = node.style;
    if (s.height) |h| return h;

    const pad_t = s.padTop();
    const pad_b = s.padBottom();
    const pad_l = s.padLeft();
    const pad_r = s.padRight();
    const gap = s.gap;
    const is_row = s.flex_direction == .row;

    // Resolve the inner width available for children:
    // explicit width on this node > available_width from parent > 0 (unknown)
    const inner_w: f32 = if (s.width) |w| w - pad_l - pad_r
        else if (available_width > 0) available_width - pad_l - pad_r
        else 0;

    // Text nodes: measure with wrapping if width is known
    if (node.text != null) {
        const m = measureNodeTextW(node, inner_w);
        return m.height + pad_t + pad_b;
    }

    // Image nodes: use natural height
    if (node.image_src != null) {
        const dims = measureNodeImage(node);
        return dims.height + pad_t + pad_b;
    }

    // TextInput nodes: height = font_size + padding
    if (node.input_id != null) {
        return @as(f32, @floatFromInt(node.font_size)) + pad_t + pad_b;
    }

    if (node.children.len == 0) return pad_t + pad_b;

    var total: f32 = 0;
    var max_cross: f32 = 0;
    var visible_count: usize = 0;

    for (node.children) |*child| {
        if (child.style.display == .none) continue;
        const ch = estimateIntrinsicHeight(child, inner_w);
        const cm_t = child.style.marTop();
        const cm_b = child.style.marBottom();

        if (!is_row) {
            total += ch + cm_t + cm_b;
            visible_count += 1;
        } else {
            const cross = ch + cm_t + cm_b;
            if (cross > max_cross) max_cross = cross;
        }
    }

    if (!is_row) {
        const gaps = if (visible_count > 1) gap * @as(f32, @floatFromInt(visible_count - 1)) else 0;
        return total + gaps + pad_t + pad_b;
    }
    return max_cross + pad_t + pad_b;
}

// ── Min-Content Width ────────────────────────────────────────────────────────
// CSS min-width: auto floor for flex items. Prevents flex-shrink from
// crushing a node below its content's natural minimum width.
// For text: width of the longest word. For containers: recursive.
// Ported from layout.lua computeMinContentW.

fn computeMinContentW(node: *Node) f32 {
    const s = node.style;
    const pad_l = s.padLeft();
    const pad_r = s.padRight();

    // Explicit width = min-content is that width
    if (s.width) |w| return w;

    // Text nodes: measure each word, return widest
    if (node.text) |text| {
        if (_measure_fn) |measure| {
            var max_word_w: f32 = 0;
            var i: usize = 0;
            while (i < text.len) {
                // Skip whitespace
                while (i < text.len and (text[i] == ' ' or text[i] == '\n')) : (i += 1) {}
                if (i >= text.len) break;
                // Find word end
                const word_start = i;
                while (i < text.len and text[i] != ' ' and text[i] != '\n') : (i += 1) {}
                const word = text[word_start..i];
                const m = measure(word, node.font_size, 0, node.letter_spacing, node.line_height, node.number_of_lines);
                if (m.width > max_word_w) max_word_w = m.width;
            }
            return max_word_w + pad_l + pad_r;
        }
        return pad_l + pad_r;
    }

    if (node.children.len == 0) return pad_l + pad_r;

    const is_row = s.flex_direction == .row;
    const gap = s.gap;
    var min_w: f32 = 0;
    var vis_count: usize = 0;

    for (node.children) |*child| {
        if (child.style.display == .none) continue;
        if (child.style.position == .absolute) continue;
        const child_min = computeMinContentW(child);
        if (is_row) {
            min_w += child_min;
            vis_count += 1;
        } else {
            if (child_min > min_w) min_w = child_min;
        }
    }

    if (is_row and vis_count > 1) {
        min_w += @as(f32, @floatFromInt(vis_count - 1)) * gap;
    }

    return min_w + pad_l + pad_r;
}

// ── Layout ──────────────────────────────────────────────────────────────────

/// Lay out a node and all its descendants.
/// px, py: position allocated by parent
/// pw, ph: available width/height from parent
pub fn layoutNode(node: *Node, px: f32, py: f32, pw: f32, ph: f32) void {
    _ = ph; // Used in future for percentage resolution

    // Budget guard: prevent infinite layout loops
    _layout_count += 1;
    if (_layout_count > LAYOUT_BUDGET) return;

    const s = node.style;

    // display:none — zero size, skip children
    if (s.display == .none) {
        node.computed = .{ .x = px, .y = py, .w = 0, .h = 0 };
        return;
    }

    // ── Resolve own dimensions ──────────────────────────────────────
    var w: f32 = undefined;
    var h: ?f32 = null;

    // Width
    if (node._flex_w) |fw| {
        w = fw;
        node._flex_w = null;
    } else if (s.width) |ew| {
        w = ew;
    } else {
        w = pw; // fill parent
    }
    w = clamp(w, s.min_width, s.max_width);

    // Height
    if (node._stretch_h) |sh| {
        h = sh;
        node._stretch_h = null;
    } else if (s.height) |eh| {
        h = eh;
    }
    if (h) |*hh| {
        hh.* = clamp(hh.*, s.min_height, s.max_height);
    }

    // ── Aspect ratio ───────────────────────────────────────────────
    if (s.aspect_ratio) |ar| {
        if (ar > 0) {
            if (s.width != null and s.height == null and h == null) {
                h = w / ar;
            } else if (s.height != null and s.width == null and node._flex_w == null) {
                if (h) |hh| {
                    w = hh * ar;
                    w = clamp(w, s.min_width, s.max_width);
                }
            }
        }
    }

    // ── Padding & margins ───────────────────────────────────────────
    const pad_l = s.padLeft();
    const pad_r = s.padRight();
    const pad_t = s.padTop();
    const pad_b = s.padBottom();
    const mar_l = s.marLeft();
    const mar_t = s.marTop();

    const x = px + mar_l;
    const y = py + mar_t;
    const inner_w = w - pad_l - pad_r;
    const inner_h = if (h) |hh| hh - pad_t - pad_b else @as(f32, 9999);

    // ── Flex properties ─────────────────────────────────────────────
    const is_row = s.flex_direction == .row;
    const gap = s.gap;
    const justify = s.justify_content;
    const align_items = s.align_items;
    const main_size: f32 = if (is_row) inner_w else inner_h;

    // ── Collect visible children and compute their info ─────────────
    const max_children = 512;
    var child_basis: [max_children]f32 = undefined;
    var child_grow: [max_children]f32 = undefined;
    var child_shrink: [max_children]f32 = undefined;
    var child_main_size: [max_children]f32 = undefined;
    var child_cross_size: [max_children]f32 = undefined;
    var child_main_margin_start: [max_children]f32 = undefined;
    var child_main_margin_end: [max_children]f32 = undefined;
    var child_cross_margin_start: [max_children]f32 = undefined;
    var child_cross_margin_end: [max_children]f32 = undefined;
    var visible_indices: [max_children]usize = undefined;
    var visible_count: usize = 0;
    var absolute_indices: [max_children]usize = undefined;
    var absolute_count: usize = 0;

    for (node.children, 0..) |*child, i| {
        if (child.style.display == .none) {
            child.computed = .{ .x = 0, .y = 0, .w = 0, .h = 0 };
            continue;
        }
        // Absolute children are removed from flex flow
        if (child.style.position == .absolute) {
            if (absolute_count < max_children) {
                absolute_indices[absolute_count] = i;
                absolute_count += 1;
            }
            continue;
        }
        if (visible_count >= max_children) break;

        const cs = child.style;
        const cw = cs.width orelse estimateIntrinsicWidth(child);
        const ch_val = cs.height orelse estimateIntrinsicHeight(child, inner_w);
        const cw_clamped = clamp(cw, cs.min_width, cs.max_width);
        const ch_clamped = clamp(ch_val, cs.min_height, cs.max_height);

        const grow = cs.flex_grow;
        const shrink = cs.flex_shrink orelse 1.0; // CSS default

        // Basis: flexBasis > width/height > intrinsic
        const basis = cs.flex_basis orelse if (is_row) cw_clamped else ch_clamped;

        const cm_l = cs.marLeft();
        const cm_r = cs.marRight();
        const cm_t = cs.marTop();
        const cm_b = cs.marBottom();

        const idx = visible_count;
        visible_indices[idx] = i;
        child_basis[idx] = basis;
        child_grow[idx] = grow;
        child_shrink[idx] = shrink;
        child_main_size[idx] = if (is_row) cw_clamped else ch_clamped;
        child_cross_size[idx] = if (is_row) ch_clamped else cw_clamped;
        child_main_margin_start[idx] = if (is_row) cm_l else cm_t;
        child_main_margin_end[idx] = if (is_row) cm_r else cm_b;
        child_cross_margin_start[idx] = if (is_row) cm_t else cm_l;
        child_cross_margin_end[idx] = if (is_row) cm_b else cm_r;

        visible_count += 1;
    }

    // ── Split into flex lines ──────────────────────────────────────
    const max_lines = 64;
    var line_starts: [max_lines]usize = undefined;
    var line_counts: [max_lines]usize = undefined;
    var num_lines: usize = 0;

    if (s.flex_wrap == .wrap and visible_count > 0) {
        var line_main: f32 = 0;
        var line_start_idx: usize = 0;
        var items_on_line: usize = 0;

        for (0..visible_count) |i| {
            const item_main = child_basis[i] + child_main_margin_start[i] + child_main_margin_end[i];
            const gap_before: f32 = if (items_on_line > 0) gap else 0;

            if (items_on_line > 0 and (line_main + gap_before + item_main) > main_size) {
                if (num_lines < max_lines) {
                    line_starts[num_lines] = line_start_idx;
                    line_counts[num_lines] = items_on_line;
                    num_lines += 1;
                }
                line_start_idx = i;
                line_main = item_main;
                items_on_line = 1;
            } else {
                line_main += gap_before + item_main;
                items_on_line += 1;
            }
        }
        if (items_on_line > 0 and num_lines < max_lines) {
            line_starts[num_lines] = line_start_idx;
            line_counts[num_lines] = items_on_line;
            num_lines += 1;
        }
    } else {
        // Single line (nowrap)
        line_starts[0] = 0;
        line_counts[0] = visible_count;
        num_lines = if (visible_count > 0) 1 else 0;
    }

    // ── Process each flex line ──────────────────────────────────────
    var cross_cursor: f32 = 0;
    var content_main_end: f32 = 0;
    var content_cross_end: f32 = 0;

    for (0..num_lines) |line_idx| {
        const ls = line_starts[line_idx];
        const lc = line_counts[line_idx];

        // ── Flex distribution for this line ─────────────────────────
        var total_basis: f32 = 0;
        var total_flex: f32 = 0;
        var total_main_margin: f32 = 0;

        for (ls..ls + lc) |i| {
            total_basis += child_basis[i];
            total_main_margin += child_main_margin_start[i] + child_main_margin_end[i];
            if (child_grow[i] > 0) {
                total_flex += child_grow[i];
            }
        }

        const line_gaps: f32 = if (lc > 1)
            gap * @as(f32, @floatFromInt(lc - 1))
        else
            0;

        const free_space = main_size - total_basis - line_gaps - total_main_margin;

        if (free_space > 0 and total_flex > 0) {
            for (ls..ls + lc) |i| {
                if (child_grow[i] > 0) {
                    child_basis[i] += (child_grow[i] / total_flex) * free_space;
                }
            }
        } else if (free_space < 0) {
            var total_shrink_scaled: f32 = 0;
            for (ls..ls + lc) |i| {
                total_shrink_scaled += child_shrink[i] * child_basis[i];
            }
            if (total_shrink_scaled > 0) {
                const shrink_overflow = -free_space;
                for (ls..ls + lc) |i| {
                    const amount = (child_shrink[i] * child_basis[i] / total_shrink_scaled) * shrink_overflow;
                    child_basis[i] -= amount;
                }
            }

            // Min-content floor: in row layout, prevent items from shrinking
            // below their minimum content width (CSS min-width: auto).
            // Only applies when child has no explicit minWidth set.
            if (is_row) {
                for (ls..ls + lc) |i| {
                    const child_idx_mc = visible_indices[i];
                    const child_mc = &node.children[child_idx_mc];
                    if (child_mc.style.min_width != null) continue;
                    const mcw = computeMinContentW(child_mc);
                    if (child_basis[i] < mcw) {
                        child_basis[i] = mcw;
                    }
                }
            }
        }

        // ── Re-measure text nodes after flex distribution ───────────
        for (ls..ls + lc) |i| {
            const child_idx_rm = visible_indices[i];
            const child_rm = &node.children[child_idx_rm];
            if (child_rm.text == null) continue;
            if (is_row) {
                if (child_rm.style.height != null) continue;
                const final_w = clamp(child_basis[i], child_rm.style.min_width, child_rm.style.max_width);
                const prev_w = child_main_size[i];
                if (@abs(final_w - prev_w) > 0.5) {
                    const cpad_l = child_rm.style.padLeft();
                    const cpad_r = child_rm.style.padRight();
                    const cpad_t = child_rm.style.padTop();
                    const cpad_b = child_rm.style.padBottom();
                    const constrain_w = final_w - cpad_l - cpad_r;
                    const m_rm = measureNodeTextW(child_rm, if (constrain_w > 0) constrain_w else 0);
                    child_cross_size[i] = clamp(m_rm.height + cpad_t + cpad_b, child_rm.style.min_height, child_rm.style.max_height);
                }
            } else {
                const final_w = child_rm.style.width orelse inner_w;
                const cpad_l = child_rm.style.padLeft();
                const cpad_r = child_rm.style.padRight();
                const cpad_t = child_rm.style.padTop();
                const cpad_b = child_rm.style.padBottom();
                const constrain_w = final_w - cpad_l - cpad_r;
                const m_rm = measureNodeTextW(child_rm, if (constrain_w > 0) constrain_w else 0);
                const new_h = clamp(m_rm.height + cpad_t + cpad_b, child_rm.style.min_height, child_rm.style.max_height);
                if (child_rm.style.height == null) {
                    child_basis[i] = new_h;
                    child_main_size[i] = new_h;
                }
                child_cross_size[i] = final_w;
            }
        }

        // ── Line cross size ────────────────────────────────────────
        var line_cross: f32 = 0;
        for (ls..ls + lc) |i| {
            const child_cross = child_cross_size[i] + child_cross_margin_start[i] + child_cross_margin_end[i];
            if (child_cross > line_cross) line_cross = child_cross;
        }
        if (num_lines == 1) {
            if (is_row and h != null) {
                line_cross = inner_h;
            } else if (!is_row) {
                line_cross = inner_w;
            }
        }

        // ── Justify content ────────────────────────────────────────
        var used_main: f32 = 0;
        for (ls..ls + lc) |i| {
            used_main += child_basis[i] + child_main_margin_start[i] + child_main_margin_end[i];
        }
        const free_main = main_size - used_main - line_gaps;
        var main_offset: f32 = 0;
        var extra_gap: f32 = 0;
        const lc_f: f32 = @floatFromInt(lc);

        switch (justify) {
            .center => main_offset = free_main / 2.0,
            .end_ => main_offset = free_main,
            .space_between => {
                if (lc > 1) extra_gap = free_main / @as(f32, @floatFromInt(lc - 1));
            },
            .space_around => {
                if (lc > 0) {
                    extra_gap = free_main / lc_f;
                    main_offset = extra_gap / 2.0;
                }
            },
            .space_evenly => {
                if (lc > 0) {
                    extra_gap = free_main / (lc_f + 1.0);
                    main_offset = extra_gap;
                }
            },
            .start => {},
        }

        // ── Position children on this line ─────────────────────────
        var cursor = main_offset;

        for (ls..ls + lc) |i| {
            const child_idx = visible_indices[i];
            const child = &node.children[child_idx];

            var cx: f32 = undefined;
            var cy: f32 = undefined;
            var cw_final: f32 = undefined;
            var ch_final: f32 = undefined;

            const eff_align: AlignItems = switch (child.style.align_self) {
                .auto => align_items,
                .start => .start,
                .center => .center,
                .end_ => .end_,
                .stretch => .stretch,
            };

            if (is_row) {
                cx = x + pad_l + cursor + child_main_margin_start[i];
                cw_final = clamp(child_basis[i], child.style.min_width, child.style.max_width);
                ch_final = child_cross_size[i];

                const cross_avail = line_cross - child_cross_margin_start[i] - child_cross_margin_end[i];

                switch (eff_align) {
                    .center => cy = y + pad_t + cross_cursor + child_cross_margin_start[i] + (cross_avail - ch_final) / 2.0,
                    .end_ => cy = y + pad_t + cross_cursor + child_cross_margin_start[i] + cross_avail - ch_final,
                    .stretch => {
                        cy = y + pad_t + cross_cursor + child_cross_margin_start[i];
                        if (child.style.height == null) {
                            ch_final = clamp(cross_avail, child.style.min_height, child.style.max_height);
                        }
                    },
                    .start => cy = y + pad_t + cross_cursor + child_cross_margin_start[i],
                }
            } else {
                cy = y + pad_t + cursor + child_main_margin_start[i];
                ch_final = clamp(child_basis[i], child.style.min_height, child.style.max_height);
                cw_final = child_cross_size[i];

                const cross_avail = line_cross - child_cross_margin_start[i] - child_cross_margin_end[i];

                switch (eff_align) {
                    .center => cx = x + pad_l + cross_cursor + child_cross_margin_start[i] + (cross_avail - cw_final) / 2.0,
                    .end_ => cx = x + pad_l + cross_cursor + child_cross_margin_start[i] + cross_avail - cw_final,
                    .stretch => {
                        cx = x + pad_l + cross_cursor + child_cross_margin_start[i];
                        if (child.style.width == null) {
                            cw_final = clamp(cross_avail, child.style.min_width, child.style.max_width);
                        }
                    },
                    .start => cx = x + pad_l + cross_cursor + child_cross_margin_start[i],
                }
            }

            // Signal flex-adjusted sizes to child
            if (is_row) {
                if (child.style.width == null or cw_final != (child.style.width orelse 0)) {
                    child._flex_w = cw_final;
                }
                if (child.style.height == null and eff_align == .stretch) {
                    child._stretch_h = ch_final;
                }
            } else {
                if (child.style.height == null and child.style.flex_grow > 0) {
                    child._stretch_h = ch_final;
                }
                if (child.style.width == null and eff_align == .stretch) {
                    child._flex_w = cw_final;
                }
            }

            if (child.style.text_align == .left and s.text_align != .left) {
                child.style.text_align = s.text_align;
            }

            child._parent_inner_w = inner_w;
            child._parent_inner_h = inner_h;
            layoutNode(child, cx, cy, cw_final, ch_final);

            const actual_main = if (is_row) child.computed.w else child.computed.h;
            cursor += child_main_margin_start[i] + actual_main + child_main_margin_end[i] + gap + extra_gap;

            // Track content extents
            if (is_row) {
                const me = (child.computed.x - x) + child.computed.w + child_main_margin_end[i];
                const ce = (child.computed.y - y) + child.computed.h + child_cross_margin_end[i];
                if (me > content_main_end) content_main_end = me;
                if (ce > content_cross_end) content_cross_end = ce;
            } else {
                const me = (child.computed.y - y) + child.computed.h + child_main_margin_end[i];
                const ce = (child.computed.x - x) + child.computed.w + child_cross_margin_end[i];
                if (me > content_main_end) content_main_end = me;
                if (ce > content_cross_end) content_cross_end = ce;
            }
        }

        // Advance cross cursor for next line (gap between lines)
        cross_cursor += line_cross + if (line_idx + 1 < num_lines) gap else @as(f32, 0);
    }

    // ── Auto-height: shrink-wrap to content ─────────────────────────
    if (h == null) {
        if (node.input_id != null) {
            // TextInput: height = font_size + padding
            h = @as(f32, @floatFromInt(node.font_size)) + pad_t + pad_b;
        } else if (node.text != null) {
            // Text nodes: measure with wrapping constraint from allocated width
            const text_max_w = inner_w;
            const m = measureNodeTextW(node, text_max_w);
            h = m.height + pad_t + pad_b;
        } else if (is_row) {
            h = content_cross_end + pad_t + pad_b;
        } else {
            h = content_main_end + pad_b;
        }
        if (h) |*hh| {
            hh.* = clamp(hh.*, s.min_height, s.max_height);
        }
    }

    // ── Scroll: record content extent for scroll containers ──────────
    if (s.overflow == .scroll or s.overflow == .hidden) {
        // content_height = full content extent (may exceed node height)
        const full_content = if (is_row) content_cross_end + pad_t + pad_b else content_main_end + pad_b;
        node.content_height = full_content;
    }

    // ── Position absolute children ────────────────────────────────
    // Absolute children are out of flex flow. They are positioned relative
    // to the parent's padding box using top/left/right/bottom.
    const resolved_h = h orelse 0;
    for (0..absolute_count) |ai| {
        const abs_idx = absolute_indices[ai];
        const abs_child = &node.children[abs_idx];
        const acs = abs_child.style;

        // Resolve width: explicit > (left+right constraint) > intrinsic
        var abs_w: f32 = undefined;
        if (acs.width) |ew| {
            abs_w = ew;
        } else if (acs.left != null and acs.right != null) {
            abs_w = inner_w - (acs.left orelse 0) - (acs.right orelse 0);
        } else {
            abs_w = estimateIntrinsicWidth(abs_child);
        }
        abs_w = clamp(abs_w, acs.min_width, acs.max_width);

        // Resolve height: explicit > (top+bottom constraint) > intrinsic
        const abs_inner_h = resolved_h - pad_t - pad_b;
        var abs_h: f32 = undefined;
        if (acs.height) |eh| {
            abs_h = eh;
        } else if (acs.top != null and acs.bottom != null) {
            abs_h = abs_inner_h - (acs.top orelse 0) - (acs.bottom orelse 0);
        } else {
            abs_h = estimateIntrinsicHeight(abs_child, abs_w);
        }
        abs_h = clamp(abs_h, acs.min_height, acs.max_height);

        // Position: top/left/right/bottom relative to parent padding box
        var abs_x: f32 = x + pad_l;
        var abs_y: f32 = y + pad_t;

        if (acs.left) |l| {
            abs_x = x + pad_l + l;
        } else if (acs.right) |r| {
            abs_x = x + pad_l + inner_w - abs_w - r;
        }

        if (acs.top) |t| {
            abs_y = y + pad_t + t;
        } else if (acs.bottom) |b| {
            abs_y = y + pad_t + abs_inner_h - abs_h - b;
        }

        abs_child._flex_w = abs_w;
        abs_child._stretch_h = abs_h;
        layoutNode(abs_child, abs_x, abs_y, abs_w, abs_h);
    }

    // ── Write computed rect ─────────────────────────────────────────
    node.computed = .{
        .x = x,
        .y = y,
        .w = w,
        .h = resolved_h,
    };
}

/// Entry point: lay out a tree from the root.
pub fn layout(root: *Node, x: f32, y: f32, w: f32, h_val: f32) void {
    // Reset layout budget for this pass
    _layout_count = 0;
    // Root always gets full viewport dimensions
    root._flex_w = w;
    root._stretch_h = h_val;
    layoutNode(root, x, y, w, h_val);
}

// ── Tests ───────────────────────────────────────────────────────────────────

test "basic column layout" {
    var children = [_]Node{
        .{ .style = .{ .height = 50, .background_color = Color.rgb(255, 0, 0) } },
        .{ .style = .{ .height = 50, .background_color = Color.rgb(0, 255, 0) } },
        .{ .style = .{ .height = 50, .background_color = Color.rgb(0, 0, 255) } },
    };

    var root = Node{
        .style = .{
            .width = 400,
            .height = 300,
            .flex_direction = .column,
            .padding = 10,
        },
        .children = &children,
    };

    layout(&root, 0, 0, 400, 300);

    // Root
    try std.testing.expectEqual(@as(f32, 400), root.computed.w);
    try std.testing.expectEqual(@as(f32, 300), root.computed.h);

    // Children should stack vertically with stretch width
    try std.testing.expectEqual(@as(f32, 10), children[0].computed.y);
    try std.testing.expectEqual(@as(f32, 60), children[1].computed.y);
    try std.testing.expectEqual(@as(f32, 110), children[2].computed.y);

    // Width should stretch to fill (400 - 20 padding = 380)
    try std.testing.expectEqual(@as(f32, 380), children[0].computed.w);
}

test "flex-grow distribution" {
    var children = [_]Node{
        .{ .style = .{ .height = 50, .flex_grow = 1 } },
        .{ .style = .{ .height = 50, .flex_grow = 2 } },
    };

    var root = Node{
        .style = .{
            .width = 300,
            .height = 300,
            .flex_direction = .row,
        },
        .children = &children,
    };

    layout(&root, 0, 0, 300, 300);

    // Child 0 gets 1/3 of 300 = 100, child 1 gets 2/3 = 200
    try std.testing.expectEqual(@as(f32, 100), children[0].computed.w);
    try std.testing.expectEqual(@as(f32, 200), children[1].computed.w);
}

test "justify-content center" {
    var children = [_]Node{
        .{ .style = .{ .width = 50, .height = 50 } },
    };

    var root = Node{
        .style = .{
            .width = 200,
            .height = 100,
            .flex_direction = .row,
            .justify_content = .center,
        },
        .children = &children,
    };

    layout(&root, 0, 0, 200, 100);

    // 50px child centered in 200px = offset 75
    try std.testing.expectEqual(@as(f32, 75), children[0].computed.x);
}

test "gap between items" {
    var children = [_]Node{
        .{ .style = .{ .width = 50, .height = 50 } },
        .{ .style = .{ .width = 50, .height = 50 } },
        .{ .style = .{ .width = 50, .height = 50 } },
    };

    var root = Node{
        .style = .{
            .width = 300,
            .height = 100,
            .flex_direction = .row,
            .gap = 10,
        },
        .children = &children,
    };

    layout(&root, 0, 0, 300, 100);

    try std.testing.expectEqual(@as(f32, 0), children[0].computed.x);
    try std.testing.expectEqual(@as(f32, 60), children[1].computed.x); // 50 + 10 gap
    try std.testing.expectEqual(@as(f32, 120), children[2].computed.x); // 50 + 10 + 50 + 10
}
