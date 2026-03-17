//! Tests for components.zig — component inlining helpers
const h = @import("test_helpers.zig");
const testing = h.testing;
const components = @import("../components.zig");

test "countNodeElements single" { try testing.expectEqual(@as(u32, 1), components.countNodeElements("var _arr_0 = [_]Node{ .{} };")); }
test "countNodeElements multiple" { try testing.expectEqual(@as(u32, 3), components.countNodeElements("var _arr_0 = [_]Node{ .{.tag = .box}, .{.tag = .text}, .{.tag = .box} };")); }
test "countNodeElements no marker" { try testing.expectEqual(@as(u32, 1), components.countNodeElements("some random string")); }
test "extractArrayInit" { try testing.expectEqualStrings(".{.tag = .box} ", components.extractArrayInit("var _arr_0 = [_]Node{ .{.tag = .box} };")); }
test "extractArrayInit no marker" { try testing.expectEqualStrings("", components.extractArrayInit("some random string")); }
