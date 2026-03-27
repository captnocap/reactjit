//! Tests for components.zig — component inlining helpers
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const components = @import("../components.zig");

test "countNodeElements single" {
    try testing.expectEqual(@as(u32, 1), components.countNodeElements("var _arr_0 = [_]Node{ .{} };"));
}
test "countNodeElements multiple" {
    try testing.expectEqual(@as(u32, 3), components.countNodeElements("var _arr_0 = [_]Node{ .{.tag = .box}, .{.tag = .text}, .{.tag = .box} };"));
}
test "countNodeElements no marker" {
    try testing.expectEqual(@as(u32, 1), components.countNodeElements("some random string"));
}
test "extractArrayInit" {
    try testing.expectEqualStrings(".{.tag = .box} ", components.extractArrayInit("var _arr_0 = [_]Node{ .{.tag = .box} };"));
}
test "extractArrayInit no marker" {
    try testing.expectEqualStrings("", components.extractArrayInit("some random string"));
}

test "countNodeElements ignores nested struct fields" {
    try testing.expectEqual(@as(u32, 2), components.countNodeElements(
        "var _arr_0 = [_]Node{ .{ .style = .{ .padding = 8 } }, .{ .text = \"ok\" } };",
    ));
}

test "extractArrayInit preserves nested struct content" {
    const init = components.extractArrayInit(
        "var _arr_0 = [_]Node{ .{ .style = .{ .padding = 8 } }, .{ .text = \"ok\" } };",
    );
    try testing.expect(std.mem.indexOf(u8, init, ".style = .{ .padding = 8 }") != null);
    try testing.expect(std.mem.indexOf(u8, init, ".text = \"ok\"") != null);
}
