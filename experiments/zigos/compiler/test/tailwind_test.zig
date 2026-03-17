//! Tests for tailwind.zig — Tailwind CSS class parser
const h = @import("test_helpers.zig");
const std = h.std;
const testing = h.testing;
const arena = h.arena;
const tailwind = @import("../tailwind.zig");

test "flex-row" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".flex_direction = .row", try tailwind.parse(a.allocator(), "flex-row")); }
test "flex-col" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".flex_direction = .column", try tailwind.parse(a.allocator(), "flex-col")); }
test "flex-1" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".flex_grow = 1", try tailwind.parse(a.allocator(), "flex-1")); }
test "justify-center" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".justify_content = .center", try tailwind.parse(a.allocator(), "justify-center")); }
test "justify-between" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".justify_content = .space_between", try tailwind.parse(a.allocator(), "justify-between")); }
test "items-center" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".align_items = .center", try tailwind.parse(a.allocator(), "items-center")); }
test "items-stretch" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".align_items = .stretch", try tailwind.parse(a.allocator(), "items-stretch")); }
test "hidden" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".display = .none", try tailwind.parse(a.allocator(), "hidden")); }
test "overflow-hidden" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".overflow = .hidden", try tailwind.parse(a.allocator(), "overflow-hidden")); }
test "w-full" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings(".width = @as(f32, 100.0)", try tailwind.parse(a.allocator(), "w-full")); }

test "p-4" { var a = arena(); defer a.deinit(); const r = try tailwind.parse(a.allocator(), "p-4"); try testing.expect(std.mem.indexOf(u8, r, ".padding") != null); try testing.expect(std.mem.indexOf(u8, r, "16") != null); }
test "px-2" { var a = arena(); defer a.deinit(); const r = try tailwind.parse(a.allocator(), "px-2"); try testing.expect(std.mem.indexOf(u8, r, ".padding_left") != null); try testing.expect(std.mem.indexOf(u8, r, ".padding_right") != null); }
test "py-3" { var a = arena(); defer a.deinit(); const r = try tailwind.parse(a.allocator(), "py-3"); try testing.expect(std.mem.indexOf(u8, r, ".padding_top") != null); try testing.expect(std.mem.indexOf(u8, r, ".padding_bottom") != null); }
test "gap-4" { var a = arena(); defer a.deinit(); const r = try tailwind.parse(a.allocator(), "gap-4"); try testing.expect(std.mem.indexOf(u8, r, ".gap") != null); try testing.expect(std.mem.indexOf(u8, r, "16") != null); }

test "rounded variants" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    try testing.expectEqualStrings(".border_radius = 4", try tailwind.parse(al, "rounded"));
    try testing.expectEqualStrings(".border_radius = 9999", try tailwind.parse(al, "rounded-full"));
    try testing.expectEqualStrings(".border_radius = 8", try tailwind.parse(al, "rounded-lg"));
    try testing.expectEqualStrings(".border_radius = 0", try tailwind.parse(al, "rounded-none"));
}

test "bg-white" { var a = arena(); defer a.deinit(); try testing.expect(std.mem.indexOf(u8, try tailwind.parse(a.allocator(), "bg-white"), "255, 255, 255") != null); }
test "bg-blue-500" { var a = arena(); defer a.deinit(); try testing.expect(std.mem.indexOf(u8, try tailwind.parse(a.allocator(), "bg-blue-500"), "59, 130, 246") != null); }
test "bg-slate-900" { var a = arena(); defer a.deinit(); try testing.expect(std.mem.indexOf(u8, try tailwind.parse(a.allocator(), "bg-slate-900"), "15, 23, 42") != null); }
test "arbitrary hex" { var a = arena(); defer a.deinit(); try testing.expect(std.mem.indexOf(u8, try tailwind.parse(a.allocator(), "bg-[#ff6600]"), "255, 102, 0") != null); }
test "arbitrary spacing" { var a = arena(); defer a.deinit(); try testing.expect(std.mem.indexOf(u8, try tailwind.parse(a.allocator(), "w-[20]"), ".width") != null); }

test "multiple classes" {
    var a = arena(); defer a.deinit();
    const r = try tailwind.parse(a.allocator(), "flex-row items-center p-4 bg-white rounded-lg");
    try testing.expect(std.mem.indexOf(u8, r, ".flex_direction = .row") != null);
    try testing.expect(std.mem.indexOf(u8, r, ".align_items = .center") != null);
    try testing.expect(std.mem.indexOf(u8, r, ".border_radius = 8") != null);
}

test "empty string" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings("", try tailwind.parse(a.allocator(), "")); }
test "unknown class" { var a = arena(); defer a.deinit(); try testing.expectEqualStrings("", try tailwind.parse(a.allocator(), "banana")); }
test "pseudo-variant stripped" { var a = arena(); defer a.deinit(); try testing.expect(std.mem.indexOf(u8, try tailwind.parse(a.allocator(), "hover:bg-blue-500"), ".background_color") != null); }

test "spacing scale" {
    var a = arena(); defer a.deinit(); const al = a.allocator();
    try testing.expect(std.mem.indexOf(u8, try tailwind.parse(al, "p-0"), "0") != null);
    try testing.expect(std.mem.indexOf(u8, try tailwind.parse(al, "p-1"), "4") != null);
    try testing.expect(std.mem.indexOf(u8, try tailwind.parse(al, "p-8"), "32") != null);
    try testing.expect(std.mem.indexOf(u8, try tailwind.parse(al, "p-96"), "384") != null);
}
