//! Tests for bootstrap.zig — Bootstrap CSS class parser
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const arena = h.arena;
const bootstrap = @import("../bootstrap.zig");

test "d-flex" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".display = .flex", try bootstrap.parse(a.allocator(), "d-flex")); }
test "d-none" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".display = .none", try bootstrap.parse(a.allocator(), "d-none")); }
test "flex-row" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".flex_direction = .row", try bootstrap.parse(a.allocator(), "flex-row")); }
test "flex-column" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".flex_direction = .column", try bootstrap.parse(a.allocator(), "flex-column")); }
test "justify-content-center" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".justify_content = .center", try bootstrap.parse(a.allocator(), "justify-content-center")); }
test "justify-content-between" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".justify_content = .space_between", try bootstrap.parse(a.allocator(), "justify-content-between")); }
test "align-items-center" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".align_items = .center", try bootstrap.parse(a.allocator(), "align-items-center")); }

test "padding scale" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(al, "p-0"), "0") != null);
    try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(al, "p-1"), "4") != null);
    try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(al, "p-3"), "16") != null);
    try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(al, "p-5"), "48") != null);
}

test "px and py" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(al, "px-3"), ".padding_left") != null);
    try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(al, "py-2"), ".padding_top") != null);
}

test "sizing" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(al, "w-100"), "100") != null);
    try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(al, "h-50"), "50") != null);
}

test "text alignment" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    try testing.expectEqualStrings(".text_align = .center", try bootstrap.parse(al, "text-center"));
    try testing.expectEqualStrings(".text_align = .left", try bootstrap.parse(al, "text-start"));
}

test "rounded" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    try testing.expectEqualStrings(".border_radius = 4", try bootstrap.parse(al, "rounded"));
    try testing.expectEqualStrings(".border_radius = 9999", try bootstrap.parse(al, "rounded-circle"));
    try testing.expectEqualStrings(".border_radius = 9999", try bootstrap.parse(al, "rounded-pill"));
}

test "bg-primary" { var a = arena(); defer a.deinit(); try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(a.allocator(), "bg-primary"), "13, 110, 253") != null); }
test "bg-danger" { var a = arena(); defer a.deinit(); try testing.expect(std.mem.indexOf(u8, try bootstrap.parse(a.allocator(), "bg-danger"), "220, 53, 69") != null); }

test "text-white" {
    var a = arena(); defer a.deinit();
    const r = try bootstrap.parse(a.allocator(), "text-white");
    try testing.expect(std.mem.indexOf(u8, r, ".text_color") != null);
    try testing.expect(std.mem.indexOf(u8, r, "255, 255, 255") != null);
}

test "multiple classes" {
    var a = arena(); defer a.deinit();
    const r = try bootstrap.parse(a.allocator(), "d-flex justify-content-center p-3 bg-dark rounded");
    try testing.expect(std.mem.indexOf(u8, r, ".display = .flex") != null);
    try testing.expect(std.mem.indexOf(u8, r, ".justify_content = .center") != null);
}

test "empty string" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings("", try bootstrap.parse(a.allocator(), "")); }
test "unknown class" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings("", try bootstrap.parse(a.allocator(), "banana")); }
