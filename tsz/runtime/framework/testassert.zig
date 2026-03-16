//! Test Assertions + Layout Audit for tsz testing
//!
//! Assertion functions for verifying node visibility, text content,
//! and layout geometry. Plus a layout auditor that detects common
//! violations: child overflow, sibling overlap, off-viewport nodes.
//!
//! Reference: love2d/cli/lib/test-shim.js (Matchers) and
//!            love2d/lua/testrunner.lua (audit section)

const std = @import("std");
const layout = @import("layout.zig");
const query = @import("query.zig");
const Node = layout.Node;
const QueryResult = query.QueryResult;

// ── Assertion Errors ──────────────────────────────────────────────────────

pub const AssertError = error{
    NotVisible,
    TextMismatch,
    NoText,
    TextNotFound,
    RectMismatch,
    NotFound,
    CountMismatch,
    Visible,
};

// ── Assertions ────────────────────────────────────────────────────────────

/// Assert node is visible (has non-zero dimensions).
pub fn expectVisible(result: QueryResult) AssertError!void {
    if (result.w <= 0 or result.h <= 0) return AssertError.NotVisible;
}

/// Assert node is NOT visible (zero dimensions or display:none).
pub fn expectHidden(result: QueryResult) AssertError!void {
    if (result.w > 0 and result.h > 0 and result.node.style.display != .none) {
        return AssertError.Visible;
    }
}

/// Assert node's text matches exactly.
pub fn expectText(node: *Node, expected: []const u8) AssertError!void {
    if (node.text) |text| {
        if (!std.mem.eql(u8, text, expected)) return AssertError.TextMismatch;
    } else return AssertError.NoText;
}

/// Assert node's text contains a substring.
pub fn expectContainsText(node: *Node, substring: []const u8) AssertError!void {
    if (node.text) |text| {
        if (std.mem.indexOf(u8, text, substring) == null) return AssertError.TextNotFound;
    } else return AssertError.NoText;
}

/// Assert node's computed rect matches expected values (with tolerance).
pub fn expectRect(result: QueryResult, expected: struct { x: f32, y: f32, w: f32, h: f32 }) AssertError!void {
    const tol: f32 = 1.0; // 1px tolerance
    if (@abs(result.x - expected.x) > tol or
        @abs(result.y - expected.y) > tol or
        @abs(result.w - expected.w) > tol or
        @abs(result.h - expected.h) > tol)
    {
        return AssertError.RectMismatch;
    }
}

/// Assert node's width matches expected (with tolerance).
pub fn expectWidth(result: QueryResult, expected: f32) AssertError!void {
    if (@abs(result.w - expected) > 1.0) return AssertError.RectMismatch;
}

/// Assert node's height matches expected (with tolerance).
pub fn expectHeight(result: QueryResult, expected: f32) AssertError!void {
    if (@abs(result.h - expected) > 1.0) return AssertError.RectMismatch;
}

/// Assert a query finds at least one result.
pub fn expectExists(root: *Node, opts: query.QueryOpts) AssertError!QueryResult {
    return query.find(root, opts) orelse AssertError.NotFound;
}

/// Assert a query finds exactly N results.
pub fn expectCount(root: *Node, opts: query.QueryOpts, expected: usize) AssertError!void {
    const actual = query.countMatches(root, opts);
    if (actual != expected) return AssertError.CountMismatch;
}

// ── Layout Audit ──────────────────────────────────────────────────────────
// Detect layout violations automatically. Reference: love2d/lua/testrunner.lua

pub const ViolationKind = enum {
    child_overflow, // child extends beyond parent bounds
    sibling_overlap, // siblings overlap by >2px
    off_viewport, // node completely off-screen
};

pub const Violation = struct {
    kind: ViolationKind,
    node: *Node,
    // Inline message buffer to avoid allocations
    message: [256]u8 = [_]u8{0} ** 256,
    msg_len: u8 = 0,

    pub fn getMessage(self: *const Violation) []const u8 {
        return self.message[0..self.msg_len];
    }
};

fn writeViolation(out: []Violation, count: *usize, kind: ViolationKind, node: *Node, comptime fmt: []const u8, args: anytype) void {
    if (count.* >= out.len) return;
    var v = &out[count.*];
    v.kind = kind;
    v.node = node;
    const result = std.fmt.bufPrint(&v.message, fmt, args) catch {
        v.msg_len = 0;
        count.* += 1;
        return;
    };
    v.msg_len = @intCast(result.len);
    count.* += 1;
}

/// Run layout audit on a tree. Returns number of violations found.
pub fn audit(root: *Node, viewport_w: f32, viewport_h: f32, out: []Violation) usize {
    var count: usize = 0;
    auditRecurse(root, viewport_w, viewport_h, out, &count);
    return count;
}

fn auditRecurse(node: *Node, viewport_w: f32, viewport_h: f32, out: []Violation, count: *usize) void {
    if (node.style.display == .none) return;
    if (count.* >= out.len) return;

    const r = node.computed;

    // ── Off-viewport check ──────────────────────────────────────────
    // Skip root node (it defines the viewport)
    if (r.w > 0 and r.h > 0) {
        if (r.x + r.w < 0 or r.y + r.h < 0 or r.x > viewport_w or r.y > viewport_h) {
            const name = node.debug_name orelse node.text orelse "unnamed";
            writeViolation(out, count, .off_viewport, node,
                "off_viewport: '{s}' at ({d:.0},{d:.0} {d:.0}x{d:.0}) outside ({d:.0}x{d:.0})", .{ name, r.x, r.y, r.w, r.h, viewport_w, viewport_h });
        }
    }

    // ── Child overflow + sibling overlap checks ─────────────────────
    // Only check if this node clips (overflow != visible means children should fit)
    const check_overflow = node.style.overflow != .visible;

    for (node.children, 0..) |*child, i| {
        if (child.style.display == .none) continue;
        if (child.style.position == .absolute) continue;

        const cr = child.computed;

        // Child overflow: child extends beyond parent (only for clipping containers)
        if (check_overflow and cr.w > 0 and cr.h > 0) {
            const parent_right = r.x + r.w;
            const parent_bottom = r.y + r.h;
            const child_right = cr.x + cr.w;
            const child_bottom = cr.y + cr.h;

            if (child_right > parent_right + 2 or child_bottom > parent_bottom + 2 or
                cr.x < r.x - 2 or cr.y < r.y - 2)
            {
                const name = child.debug_name orelse child.text orelse "unnamed";
                writeViolation(out, count, .child_overflow, child,
                    "child_overflow: '{s}' ({d:.0}x{d:.0}) overflows parent ({d:.0}x{d:.0})", .{ name, cr.w, cr.h, r.w, r.h });
            }
        }

        // Sibling overlap: check against subsequent siblings
        if (cr.w <= 0 or cr.h <= 0) continue;
        for (node.children[i + 1 ..]) |*sibling| {
            if (sibling.style.display == .none) continue;
            if (sibling.style.position == .absolute) continue;
            const sr = sibling.computed;
            if (sr.w <= 0 or sr.h <= 0) continue;

            // AABB overlap test with 2px tolerance
            const overlap_x = @min(cr.x + cr.w, sr.x + sr.w) - @max(cr.x, sr.x);
            const overlap_y = @min(cr.y + cr.h, sr.y + sr.h) - @max(cr.y, sr.y);

            if (overlap_x > 2 and overlap_y > 2) {
                const name_a = child.debug_name orelse child.text orelse "unnamed";
                const name_b = sibling.debug_name orelse sibling.text orelse "unnamed";
                writeViolation(out, count, .sibling_overlap, child,
                    "sibling_overlap: '{s}' and '{s}' overlap by {d:.0}x{d:.0}px", .{ name_a, name_b, overlap_x, overlap_y });
            }
        }
    }

    // Recurse into children
    for (node.children) |*child| {
        auditRecurse(child, viewport_w, viewport_h, out, count);
    }
}

// ── Test Result Reporting ─────────────────────────────────────────────────

pub const TestStatus = enum { pass, fail, skip };

pub const TestResult = struct {
    name: []const u8,
    status: TestStatus,
    error_msg: ?[]const u8 = null,
};

/// Print a test result in TAP-like format.
pub fn printResult(result: TestResult) void {
    const status_str: []const u8 = switch (result.status) {
        .pass => "PASS",
        .fail => "FAIL",
        .skip => "SKIP",
    };
    std.debug.print("TEST {s} ... {s}", .{ result.name, status_str });
    if (result.error_msg) |msg| {
        std.debug.print(" ({s})", .{msg});
    }
    std.debug.print("\n", .{});
}

/// Print a summary line: "N/M tests passed"
pub fn printSummary(results: []const TestResult) void {
    var passed: usize = 0;
    var failed: usize = 0;
    var skipped: usize = 0;
    for (results) |r| {
        switch (r.status) {
            .pass => passed += 1,
            .fail => failed += 1,
            .skip => skipped += 1,
        }
    }
    const total = passed + failed;
    std.debug.print("\n{d}/{d} tests passed", .{ passed, total });
    if (skipped > 0) std.debug.print(" ({d} skipped)", .{skipped});
    std.debug.print("\n", .{});
}

// ── Tests ─────────────────────────────────────────────────────────────────

test "expectVisible passes for visible node" {
    var node = Node{ .computed = .{ .x = 10, .y = 10, .w = 50, .h = 30 } };
    const result = query.QueryResult{
        .node = &node,
        .x = 10,
        .y = 10,
        .w = 50,
        .h = 30,
        .cx = 35,
        .cy = 25,
    };
    try expectVisible(result);
}

test "expectVisible fails for zero-size node" {
    var node = Node{ .computed = .{ .x = 10, .y = 10, .w = 0, .h = 0 } };
    const result = query.QueryResult{
        .node = &node,
        .x = 10,
        .y = 10,
        .w = 0,
        .h = 0,
        .cx = 10,
        .cy = 10,
    };
    try std.testing.expectError(AssertError.NotVisible, expectVisible(result));
}

test "expectText matches exact text" {
    var node = Node{ .text = "Hello World" };
    try expectText(&node, "Hello World");
}

test "expectText fails on mismatch" {
    var node = Node{ .text = "Hello World" };
    try std.testing.expectError(AssertError.TextMismatch, expectText(&node, "Goodbye"));
}

test "expectContainsText finds substring" {
    var node = Node{ .text = "Count: 42" };
    try expectContainsText(&node, "Count");
    try expectContainsText(&node, "42");
}

test "expectContainsText fails when not found" {
    var node = Node{ .text = "Count: 42" };
    try std.testing.expectError(AssertError.TextNotFound, expectContainsText(&node, "missing"));
}

test "audit detects off-viewport" {
    var children = [_]Node{
        .{ .computed = .{ .x = -200, .y = -200, .w = 50, .h = 50 }, .debug_name = "offscreen" },
    };
    var root = Node{ .children = &children, .computed = .{ .x = 0, .y = 0, .w = 800, .h = 600 } };

    var violations: [16]Violation = undefined;
    const n = audit(&root, 800, 600, &violations);
    try std.testing.expect(n > 0);
    try std.testing.expectEqual(ViolationKind.off_viewport, violations[0].kind);
}
