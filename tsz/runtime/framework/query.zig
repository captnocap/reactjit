//! Node Query Engine for tsz testing
//!
//! Walk the node tree and find nodes by debug_name, test_id,
//! text content, or node type. Used by the test runner to
//! locate elements for assertions and input simulation.
//!
//! No allocations — results are written to caller-provided slices.

const std = @import("std");
const layout = @import("layout.zig");
const Node = layout.Node;

// ── Query Result ──────────────────────────────────────────────────────────

pub const QueryResult = struct {
    node: *Node,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    cx: f32, // center x
    cy: f32, // center y
};

fn resultFromNode(node: *Node) QueryResult {
    return .{
        .node = node,
        .x = node.computed.x,
        .y = node.computed.y,
        .w = node.computed.w,
        .h = node.computed.h,
        .cx = node.computed.x + node.computed.w / 2.0,
        .cy = node.computed.y + node.computed.h / 2.0,
    };
}

// ── Query Options ─────────────────────────────────────────────────────────

pub const QueryOpts = struct {
    debug_name: ?[]const u8 = null, // match by debugName
    test_id: ?[]const u8 = null, // match by testId
    text: ?[]const u8 = null, // match by exact text content
    text_contains: ?[]const u8 = null, // match by text substring
    has_handler: bool = false, // match nodes with any event handler
};

// ── Matching ──────────────────────────────────────────────────────────────

fn matches(node: *const Node, opts: QueryOpts) bool {
    if (opts.debug_name) |name| {
        if (node.debug_name) |dn| {
            if (!std.mem.eql(u8, dn, name)) return false;
        } else return false;
    }

    if (opts.test_id) |id| {
        if (node.test_id) |tid| {
            if (!std.mem.eql(u8, tid, id)) return false;
        } else return false;
    }

    if (opts.text) |txt| {
        if (node.text) |nt| {
            if (!std.mem.eql(u8, nt, txt)) return false;
        } else return false;
    }

    if (opts.text_contains) |sub| {
        if (node.text) |nt| {
            if (std.mem.indexOf(u8, nt, sub) == null) return false;
        } else return false;
    }

    if (opts.has_handler) {
        const h = &node.handlers;
        if (h.on_press == null and h.on_hover_enter == null and
            h.on_hover_exit == null and h.on_key == null and
            h.on_change_text == null and h.on_scroll == null) return false;
    }

    return true;
}

// ── Find (first match, depth-first) ───────────────────────────────────────

pub fn find(root: *Node, opts: QueryOpts) ?QueryResult {
    if (root.style.display == .none) return null;

    // Check self first (pre-order)
    if (matches(root, opts)) return resultFromNode(root);

    // Then children
    for (root.children) |*child| {
        if (find(child, opts)) |result| return result;
    }

    return null;
}

// ── Find All (all matches, depth-first) ───────────────────────────────────

pub fn findAll(root: *Node, opts: QueryOpts, out: []QueryResult) usize {
    var found: usize = 0;
    findAllRecurse(root, opts, out, &found);
    return found;
}

fn findAllRecurse(node: *Node, opts: QueryOpts, out: []QueryResult, found: *usize) void {
    if (node.style.display == .none) return;
    if (found.* >= out.len) return;

    if (matches(node, opts)) {
        out[found.*] = resultFromNode(node);
        found.* += 1;
    }

    for (node.children) |*child| {
        if (found.* >= out.len) return;
        findAllRecurse(child, opts, out, found);
    }
}

// ── Count ─────────────────────────────────────────────────────────────────

pub fn countMatches(root: *Node, opts: QueryOpts) usize {
    var n: usize = 0;
    countRecurse(root, opts, &n);
    return n;
}

fn countRecurse(node: *Node, opts: QueryOpts, n: *usize) void {
    if (node.style.display == .none) return;

    if (matches(node, opts)) n.* += 1;

    for (node.children) |*child| {
        countRecurse(child, opts, n);
    }
}

// ── Find by Text (convenience) ────────────────────────────────────────────

pub fn findByText(root: *Node, text: []const u8) ?QueryResult {
    return find(root, .{ .text = text });
}

pub fn findByName(root: *Node, name: []const u8) ?QueryResult {
    return find(root, .{ .debug_name = name });
}

pub fn findById(root: *Node, id: []const u8) ?QueryResult {
    return find(root, .{ .test_id = id });
}

// ── Tests ─────────────────────────────────────────────────────────────────

test "find by debug_name" {
    var children = [_]Node{
        .{ .text = "Hello", .debug_name = "greeting" },
        .{ .text = "World", .debug_name = "target" },
    };
    var root = Node{ .children = &children, .computed = .{ .w = 100, .h = 100 } };
    children[0].computed = .{ .x = 0, .y = 0, .w = 50, .h = 20 };
    children[1].computed = .{ .x = 0, .y = 20, .w = 50, .h = 20 };

    const result = find(&root, .{ .debug_name = "target" });
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("World", result.?.node.text.?);
}

test "find by test_id" {
    var children = [_]Node{
        .{ .text = "A", .test_id = "first" },
        .{ .text = "B", .test_id = "second" },
    };
    var root = Node{ .children = &children, .computed = .{ .w = 100, .h = 100 } };
    children[0].computed = .{ .x = 0, .y = 0, .w = 50, .h = 20 };
    children[1].computed = .{ .x = 0, .y = 20, .w = 50, .h = 20 };

    const result = findById(&root, "second");
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("B", result.?.node.text.?);
}

test "find by text_contains" {
    var children = [_]Node{
        .{ .text = "Count: 42" },
        .{ .text = "Other text" },
    };
    var root = Node{ .children = &children, .computed = .{ .w = 100, .h = 100 } };
    children[0].computed = .{ .x = 0, .y = 0, .w = 50, .h = 20 };
    children[1].computed = .{ .x = 0, .y = 20, .w = 50, .h = 20 };

    const result = find(&root, .{ .text_contains = "Count" });
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("Count: 42", result.?.node.text.?);
}

test "findAll returns multiple" {
    var children = [_]Node{
        .{ .text = "A", .debug_name = "item" },
        .{ .text = "B", .debug_name = "item" },
        .{ .text = "C", .debug_name = "other" },
    };
    var root = Node{ .children = &children, .computed = .{ .w = 100, .h = 100 } };
    for (&children, 0..) |*child, i| {
        child.computed = .{ .x = 0, .y = @as(f32, @floatFromInt(i)) * 20, .w = 50, .h = 20 };
    }

    var results: [8]QueryResult = undefined;
    const n = findAll(&root, .{ .debug_name = "item" }, &results);
    try std.testing.expectEqual(@as(usize, 2), n);
}

test "count matches" {
    var children = [_]Node{
        .{ .text = "A", .debug_name = "x" },
        .{ .text = "B", .debug_name = "x" },
        .{ .text = "C" },
    };
    var root = Node{ .children = &children, .computed = .{ .w = 100, .h = 100 } };

    try std.testing.expectEqual(@as(usize, 2), countMatches(&root, .{ .debug_name = "x" }));
}

test "find skips display:none" {
    var children = [_]Node{
        .{ .text = "Hidden", .debug_name = "target", .style = .{ .display = .none } },
        .{ .text = "Visible", .debug_name = "target" },
    };
    var root = Node{ .children = &children, .computed = .{ .w = 100, .h = 100 } };
    children[1].computed = .{ .x = 0, .y = 0, .w = 50, .h = 20 };

    const result = find(&root, .{ .debug_name = "target" });
    try std.testing.expect(result != null);
    try std.testing.expectEqualStrings("Visible", result.?.node.text.?);
}
