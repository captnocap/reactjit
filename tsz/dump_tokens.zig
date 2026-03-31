const std = @import("std");
const lexer_mod = @import("compiler/lexer.zig");

pub fn main() !void {
    var component_buf: std.ArrayListUnmanaged(u8) = .{};
    
    const files = [_][]const u8{
        "carts/cursor-ide/Sidebar.c.tsz",
        "carts/cursor-ide/Editor.c.tsz",
        "carts/cursor-ide/ChatPanel.c.tsz",
        "carts/cursor-ide/StatusBar.c.tsz",
        "carts/cursor-ide/TopBar.c.tsz",
        "carts/cursor-ide/TabBar.c.tsz",
        "carts/cursor-ide/cursor-ide.app.tsz",
    };
    
    for (files) |f| {
        const s = std.fs.cwd().readFileAlloc(std.heap.page_allocator, f, 1024 * 1024) catch continue;
        component_buf.appendSlice(std.heap.page_allocator, s) catch {};
        component_buf.append(std.heap.page_allocator, '\n') catch {};
    }
    
    var lexer = lexer_mod.Lexer.init(component_buf.items);
    lexer.tokenize();
    
    var i: u32 = 0;
    while (i < lexer.count) : (i += 1) {
        const tok = lexer.get(i);
        const text = component_buf.items[tok.start..tok.end];
        if (std.mem.eql(u8, text, "TopBar")) {
            std.debug.print("Found TopBar at token {d}\n", .{i});
            var j: u32 = if (i > 5) i - 5 else 0;
            const end = @min(i + 40, lexer.count);
            while (j < end) : (j += 1) {
                const t = lexer.get(j);
                const txt = component_buf.items[t.start..t.end];
                std.debug.print("  [{d}] {s} ({any})\n", .{j, txt, t.kind});
            }
            break;
        }
    }
}
