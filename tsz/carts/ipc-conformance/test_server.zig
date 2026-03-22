// IPC echo server for conformance testing.
// Starts an NDJSON-over-TCP server, accepts one client, echoes messages back.
// Prints the assigned port on stdout so the test runner knows where to connect.
//
// Build: cd tsz && zig build-exe --dep ipc -Mroot=carts/ipc-conformance/test_server.zig -Mipc=framework/net/ipc.zig -femit-bin=carts/ipc-conformance/test_server

const std = @import("std");
const ipc = @import("ipc");

var server: ipc.Server = undefined;

pub fn main() !void {
    server = try ipc.Server.bind(0);
    const port = server.getPort();

    // Print port for test runner to read
    var buf: [16]u8 = undefined;
    const port_str = std.fmt.bufPrint(&buf, "{d}\n", .{port}) catch return;
    _ = std.posix.write(std.posix.STDOUT_FILENO, port_str) catch {};

    // Main loop: accept client, poll messages, echo them back
    var running = true;
    while (running) {
        _ = server.acceptClient();

        const msgs = server.poll();
        for (msgs) |msg| {
            const data = msg.data;
            // Special commands
            if (std.mem.eql(u8, data, "{\"type\":\"quit\"}")) {
                _ = server.sendLine(data);
                running = false;
                break;
            }
            // Echo back
            _ = server.sendLine(data);
        }

        if (server.dead) {
            running = false;
        }

        std.Thread.sleep(1_000_000); // 1ms
    }

    server.close();
}
