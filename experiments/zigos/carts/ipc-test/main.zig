//! IPC Test Cart — verify independent window pipeline end-to-end.
//!
//! Acts as the parent side: binds IPC server, spawns zigos-child,
//! sends tree commands (blue box with white text), waits 3 seconds
//! to visually confirm the child window renders, then sends quit.
//!
//! Build & run:
//!   cd experiments/zigos
//!   zig build child-window   # build the child binary first
//!   zig run carts/ipc-test/main.zig \
//!       -I framework -I . \
//!       -- framework/process.zig framework/net/ipc.zig framework/log.zig
//!
//! Or more practically, just build as a test step (see below).

const std = @import("std");
const process = @import("process");
const ipc = @import("ipc");

pub fn main() !void {
    std.debug.print("\n=== IPC Test Cart ===\n\n", .{});

    // 1. Bind TCP server on random port
    std.debug.print("[parent] Binding IPC server...\n", .{});
    var server = try ipc.Server.bind(0);
    defer server.close();
    const port = server.getPort();
    std.debug.print("[parent] Listening on port {d}\n", .{port});

    // 2. Format port as null-terminated string for env var
    var port_buf: [8:0]u8 = undefined;
    const port_str = std.fmt.bufPrint(&port_buf, "{d}", .{port}) catch "0";
    port_buf[port_str.len] = 0;

    // Window dimensions
    var w_buf: [8:0]u8 = undefined;
    var h_buf: [8:0]u8 = undefined;
    const w_str = std.fmt.bufPrint(&w_buf, "500", .{}) catch "500";
    const h_str = std.fmt.bufPrint(&h_buf, "400", .{}) catch "400";
    w_buf[w_str.len] = 0;
    h_buf[h_str.len] = 0;

    // 3. Spawn child process
    std.debug.print("[parent] Spawning zigos-child...\n", .{});
    var child = try process.spawn(.{
        .exe = "zig-out/bin/zigos-child",
        .env = &.{
            .{ .key = "ZIGOS_IPC_PORT", .value = @ptrCast(port_buf[0..port_str.len]) },
            .{ .key = "ZIGOS_CHILD_WINDOW", .value = "1" },
            .{ .key = "ZIGOS_WINDOW_W", .value = @ptrCast(w_buf[0..w_str.len]) },
            .{ .key = "ZIGOS_WINDOW_H", .value = @ptrCast(h_buf[0..h_str.len]) },
        },
    });
    defer child.closeProccess();
    std.debug.print("[parent] Child PID: {d}\n", .{child.pid});

    // 4. Wait for child to connect and send "ready"
    std.debug.print("[parent] Waiting for child to connect...\n", .{});
    var connected = false;
    for (0..300) |_| {
        if (server.acceptClient()) {
            const msgs = server.poll();
            for (msgs) |msg| {
                std.debug.print("[parent] Received: {s}\n", .{msg.data});
                if (std.mem.indexOf(u8, msg.data, "\"ready\"") != null) {
                    connected = true;
                    break;
                }
            }
            if (connected) break;
        }
        if (!child.alive()) {
            std.debug.print("[parent] ERROR: child died before connecting\n", .{});
            return error.ChildDied;
        }
        std.Thread.sleep(10 * std.time.ns_per_ms);
    }

    if (!connected) {
        std.debug.print("[parent] ERROR: child did not send ready within 3 seconds\n", .{});
        return error.Timeout;
    }
    std.debug.print("[parent] Child connected and ready!\n", .{});

    // 5. Send tree commands — build a simple UI in the child:
    //    Root box (dark blue bg, padding 20, column layout)
    //    ├── Title text (white, 24px)
    //    ├── Subtitle text (gray, 16px)
    //    └── Green box with text
    std.debug.print("[parent] Sending tree commands...\n", .{});

    const commands = [_][]const u8{
        // Create nodes
        "{\"type\":\"init\",\"commands\":[" ++
            "{\"op\":\"CREATE\",\"id\":1,\"bg\":\"#1a1a2e\",\"padding\":20,\"gap\":12}," ++
            "{\"op\":\"CREATE\",\"id\":2,\"text\":\"Independent Window\",\"fontSize\":24,\"color\":\"#ffffff\"}," ++
            "{\"op\":\"CREATE\",\"id\":3,\"text\":\"Connected via TCP/NDJSON IPC\",\"fontSize\":14,\"color\":\"#888899\"}," ++
            "{\"op\":\"CREATE\",\"id\":4,\"bg\":\"#16a34a\",\"padding\":12}," ++
            "{\"op\":\"CREATE\",\"id\":5,\"text\":\"Pipeline working!\",\"fontSize\":18,\"color\":\"#ffffff\"}," ++
            // Wire tree structure
            "{\"op\":\"APPEND\",\"parentId\":4,\"childId\":5}," ++
            "{\"op\":\"APPEND\",\"parentId\":1,\"childId\":2}," ++
            "{\"op\":\"APPEND\",\"parentId\":1,\"childId\":3}," ++
            "{\"op\":\"APPEND\",\"parentId\":1,\"childId\":4}," ++
            "{\"op\":\"APPEND_TO_ROOT\",\"childId\":1}" ++
            "]}",
    };

    for (commands) |cmd| {
        if (!server.sendLine(cmd)) {
            std.debug.print("[parent] ERROR: failed to send command\n", .{});
            return error.SendFailed;
        }
    }
    std.debug.print("[parent] Tree commands sent!\n", .{});

    // 6. Let the child render for 3 seconds (visual confirmation)
    std.debug.print("[parent] Child window should be visible for 3 seconds...\n", .{});
    for (0..300) |_| {
        // Poll for any events from child
        const msgs = server.poll();
        for (msgs) |msg| {
            std.debug.print("[parent] Child event: {s}\n", .{msg.data});
        }
        if (server.dead or !child.alive()) {
            std.debug.print("[parent] Child disconnected/died early\n", .{});
            break;
        }
        std.Thread.sleep(10 * std.time.ns_per_ms);
    }

    // 7. Send quit
    std.debug.print("[parent] Sending quit...\n", .{});
    _ = server.sendLine("{\"type\":\"quit\"}");
    std.Thread.sleep(200 * std.time.ns_per_ms);

    // 8. Verify child exited
    if (child.alive()) {
        std.debug.print("[parent] Child still alive, force closing...\n", .{});
    } else {
        std.debug.print("[parent] Child exited cleanly (code {d})\n", .{child.exitCode()});
    }

    std.debug.print("\n=== IPC Test Complete ===\n", .{});
}
