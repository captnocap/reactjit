//! Test Harness for tsz
//!
//! Compiled-in test runner. When the app is built in test mode,
//! the harness runs registered test functions after the first frame,
//! prints results, and exits.
//!
//! Usage from generated_app.zig:
//!   const harness = @import("testharness.zig");
//!   // Register tests:
//!   harness.register("counter increments", testCounterIncrements);
//!   // After first frame:
//!   if (harness.shouldRun()) harness.runAll(&root, renderer);

const std = @import("std");
const layout = @import("layout.zig");
const query = @import("query.zig");
const testdriver = @import("testdriver.zig");
const testassert = @import("testassert.zig");
const Node = layout.Node;

// Re-export test modules for convenience
pub const find = query.find;
pub const findAll = query.findAll;
pub const findByText = query.findByText;
pub const findByName = query.findByName;
pub const findById = query.findById;
pub const countMatches = query.countMatches;
pub const QueryOpts = query.QueryOpts;
pub const QueryResult = query.QueryResult;

pub const click = testdriver.click;
pub const clickNode = testdriver.clickNode;
pub const moveMouse = testdriver.moveMouse;
pub const key = testdriver.key;
pub const typeText = testdriver.typeText;
pub const scroll = testdriver.scroll;
pub const resize = testdriver.resize;

pub const expectVisible = testassert.expectVisible;
pub const expectHidden = testassert.expectHidden;
pub const expectText = testassert.expectText;
pub const expectContainsText = testassert.expectContainsText;
pub const expectRect = testassert.expectRect;
pub const expectWidth = testassert.expectWidth;
pub const expectHeight = testassert.expectHeight;
pub const expectExists = testassert.expectExists;
pub const expectCount = testassert.expectCount;
pub const audit = testassert.audit;
pub const Violation = testassert.Violation;

// ── Test Registry ─────────────────────────────────────────────────────────

const MAX_TESTS = 64;

const TestFn = *const fn (*Node) TestOutcome;

const TestOutcome = enum { pass, fail };

const TestEntry = struct {
    name: []const u8,
    func: TestFn,
};

var tests: [MAX_TESTS]TestEntry = undefined;
var test_count: usize = 0;
var enabled: bool = false;
var frame_count: u32 = 0;
var run_after_frame: u32 = 1; // run tests after this many frames

/// Register a test function. Called at comptime or init.
pub fn register(name: []const u8, func: TestFn) void {
    if (test_count >= MAX_TESTS) return;
    tests[test_count] = .{ .name = name, .func = func };
    test_count += 1;
}

/// Enable test mode.
pub fn enable() void {
    enabled = true;
}

/// Set how many frames to wait before running tests (default: 1).
pub fn setRunAfterFrame(n: u32) void {
    run_after_frame = n;
}

/// Check if test mode is enabled.
pub fn isEnabled() bool {
    return enabled;
}

/// Call once per frame. Returns true when tests should run this frame.
pub fn tick() bool {
    if (!enabled) return false;
    frame_count += 1;
    return frame_count == run_after_frame;
}

/// Run all registered tests against the root node tree.
/// Prints results and returns exit code (0 = all passed).
pub fn runAll(root: *Node, renderer: anytype) u8 {
    _ = renderer; // reserved for screenshot support

    std.debug.print("\n", .{});

    var results: [MAX_TESTS]testassert.TestResult = undefined;
    var result_count: usize = 0;

    for (0..test_count) |i| {
        const entry = tests[i];
        const outcome = entry.func(root);
        results[result_count] = .{
            .name = entry.name,
            .status = if (outcome == .pass) .pass else .fail,
        };
        testassert.printResult(results[result_count]);
        result_count += 1;
    }

    testassert.printSummary(results[0..result_count]);

    // Return exit code
    for (results[0..result_count]) |r| {
        if (r.status == .fail) return 1;
    }
    return 0;
}

// ── Environment Detection ─────────────────────────────────────────────────

/// Check if TSZ_TEST=1 environment variable is set.
/// Used by generated apps to auto-enable test mode.
pub fn envEnabled() bool {
    const val = std.posix.getenv("TSZ_TEST") orelse return false;
    return std.mem.eql(u8, val, "1");
}
