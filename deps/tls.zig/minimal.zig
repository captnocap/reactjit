const std = @import("std");
const tls = @import("tls");

pub fn main() !void {
    _ = tls.Timestamp.now();
    var roots: tls.config.cert.Bundle = .{};
    defer roots.deinit(std.heap.page_allocator);
    try roots.rescan(std.heap.page_allocator);
}
