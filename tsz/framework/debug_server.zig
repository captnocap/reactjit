//! Debug server — thin IPC server embedded in every app.
//!
//! Auto-starts when TSZ_DEBUG=1. Serves the debug protocol over NDJSON/TCP
//! so the standalone inspector (tsz tools inspect) can attach remotely.
//!
//! Protocol: client sends `{"method":"debug.tree"}\n`, server responds with
//! `{"method":"debug.tree","data":{...}}\n`. For telemetry streaming, the
//! server pushes a line every frame while streaming is enabled.
//!
//! Spec: tsz/docs/TSZ_TOOLS_SPEC.md

const std = @import("std");
const ipc = @import("net/ipc.zig");
const telemetry = @import("telemetry.zig");
const layout = @import("layout.zig");

// ── State ──────────────────────────────────────────────────────────

var server: ?ipc.Server = null;
var enabled: bool = false;
var streaming_telemetry: bool = false;
var selected_node_id: i32 = -1;

// Response buffer (64KB — large enough for tree dumps)
const RESP_SIZE = 65536;
var resp_buf: [RESP_SIZE]u8 = undefined;

// ── Public API ─────────────────────────────────────────────────────

/// Check TSZ_DEBUG env and start server if set. Called once at engine init.
pub fn init() void {
    const env = std.posix.getenv("TSZ_DEBUG") orelse return;
    if (env.len == 0 or env[0] != '1') return;
    start();
}

/// Start the debug server on an OS-assigned port.
pub fn start() void {
    if (server != null) return;
    server = ipc.Server.bind(0) catch return;
    enabled = true;
    // Write port to stderr so tools can discover it
    const port = server.?.getPort();
    var port_buf: [64]u8 = undefined;
    const port_msg = std.fmt.bufPrint(&port_buf, "[debug_server] listening on port {d}\n", .{port}) catch return;
    _ = std.posix.write(2, port_msg) catch {};
}

/// Per-frame poll: accept connections, handle requests, push telemetry.
pub fn poll() void {
    var srv = &(server orelse return);
    _ = srv.acceptClient();
    if (!srv.connected()) return;

    // Handle incoming requests
    const msgs = srv.poll();
    for (msgs) |msg| {
        handleRequest(srv, msg.data);
    }

    // Push telemetry if streaming
    if (streaming_telemetry) {
        pushTelemetryFrame(srv);
    }
}

/// Returns the selected node ID (-1 if none).
pub fn getSelectedNode() i32 {
    return selected_node_id;
}

/// Shut down the debug server.
pub fn deinit() void {
    if (server) |*s| {
        s.close();
    }
    server = null;
    enabled = false;
}

// ── Request dispatch ───────────────────────────────────────────────

fn handleRequest(srv: *ipc.Server, raw: []const u8) void {
    // Minimal JSON parse: extract "method" and optional "id"/"code"/"text"/"delta" values
    const method = jsonStr(raw, "method") orelse return;

    if (eql(method, "debug.tree")) {
        respondTree(srv);
    } else if (eql(method, "debug.node")) {
        const id = jsonInt(raw, "id") orelse return;
        respondNode(srv, id);
    } else if (eql(method, "debug.select")) {
        const id = jsonInt(raw, "id") orelse return;
        selected_node_id = id;
        _ = srv.sendLine("{\"method\":\"debug.select\",\"ok\":true}");
    } else if (eql(method, "debug.state")) {
        respondState(srv);
    } else if (eql(method, "debug.perf")) {
        respondPerf(srv);
    } else if (eql(method, "debug.telemetry.stream")) {
        streaming_telemetry = !streaming_telemetry;
        const msg = if (streaming_telemetry)
            "{\"method\":\"debug.telemetry.stream\",\"streaming\":true}"
        else
            "{\"method\":\"debug.telemetry.stream\",\"streaming\":false}";
        _ = srv.sendLine(msg);
    } else if (eql(method, "debug.telemetry.history")) {
        respondTelemetryHistory(srv);
    } else if (eql(method, "debug.snapshot")) {
        _ = srv.sendLine("{\"method\":\"debug.snapshot\",\"ok\":false,\"reason\":\"not yet implemented\"}");
    } else if (eql(method, "debug.simulate.press")) {
        _ = srv.sendLine("{\"method\":\"debug.simulate.press\",\"ok\":false,\"reason\":\"not yet implemented\"}");
    } else if (eql(method, "debug.simulate.type")) {
        _ = srv.sendLine("{\"method\":\"debug.simulate.type\",\"ok\":false,\"reason\":\"not yet implemented\"}");
    } else if (eql(method, "debug.simulate.scroll")) {
        _ = srv.sendLine("{\"method\":\"debug.simulate.scroll\",\"ok\":false,\"reason\":\"not yet implemented\"}");
    } else if (eql(method, "debug.script")) {
        _ = srv.sendLine("{\"method\":\"debug.script\",\"ok\":false,\"reason\":\"not yet implemented\"}");
    } else {
        _ = srv.sendLine("{\"error\":\"unknown method\"}");
    }
}

// ── Responders ─────────────────────────────────────────────────────

fn respondTree(srv: *ipc.Server) void {
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.tree\",\"nodes\":[");
    const count = telemetry.nodeCount();
    for (0..count) |i| {
        const node = telemetry.getNode(i) orelse continue;
        if (i > 0) ap(&resp_buf, &pos, ",");
        ap(&resp_buf, &pos, "{\"i\":");
        apInt(&resp_buf, &pos, @intCast(i));
        ap(&resp_buf, &pos, ",\"t\":\"");
        ap(&resp_buf, &pos, telemetry.nodeTypeName(node));
        ap(&resp_buf, &pos, "\",\"d\":");
        apInt(&resp_buf, &pos, telemetry.getNodeDepth(i));
        ap(&resp_buf, &pos, "}");
        if (pos > RESP_SIZE - 256) break; // safety margin
    }
    ap(&resp_buf, &pos, "]}\n");
    _ = srv.send(resp_buf[0..pos]);
}

fn respondNode(srv: *ipc.Server, id: i32) void {
    if (id < 0) return;
    const node = telemetry.getNode(@intCast(id)) orelse {
        _ = srv.sendLine("{\"method\":\"debug.node\",\"error\":\"not found\"}");
        return;
    };
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.node\",\"id\":");
    apInt(&resp_buf, &pos, id);
    ap(&resp_buf, &pos, ",\"type\":\"");
    ap(&resp_buf, &pos, telemetry.nodeTypeName(node));
    ap(&resp_buf, &pos, "\",\"depth\":");
    apInt(&resp_buf, &pos, telemetry.getNodeDepth(@intCast(id)));
    ap(&resp_buf, &pos, "}\n");
    _ = srv.send(resp_buf[0..pos]);
}

fn respondState(srv: *ipc.Server) void {
    const snap = telemetry.current;
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.state\"");
    ap(&resp_buf, &pos, ",\"total_nodes\":");
    apInt(&resp_buf, &pos, @intCast(snap.total_nodes));
    ap(&resp_buf, &pos, ",\"visible_nodes\":");
    apInt(&resp_buf, &pos, @intCast(snap.visible_nodes));
    ap(&resp_buf, &pos, ",\"state_slots\":");
    apInt(&resp_buf, &pos, @intCast(snap.state_slot_count));
    ap(&resp_buf, &pos, "}\n");
    _ = srv.send(resp_buf[0..pos]);
}

fn respondPerf(srv: *ipc.Server) void {
    const snap = telemetry.current;
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.perf\"");
    appendPerfFields(&resp_buf, &pos, snap);
    ap(&resp_buf, &pos, "}\n");
    _ = srv.send(resp_buf[0..pos]);
}

fn respondTelemetryHistory(srv: *ipc.Server) void {
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.telemetry.history\",\"frames\":[");
    const count = telemetry.historyCount();
    const max_frames: usize = @min(count, 120); // ~2s at 60fps
    for (0..max_frames) |i| {
        const snap = telemetry.getHistory(i) orelse continue;
        if (i > 0) ap(&resp_buf, &pos, ",");
        ap(&resp_buf, &pos, "{");
        appendPerfFields(&resp_buf, &pos, snap.*);
        ap(&resp_buf, &pos, "}");
        if (pos > RESP_SIZE - 512) break;
    }
    ap(&resp_buf, &pos, "]}\n");
    _ = srv.send(resp_buf[0..pos]);
}

fn pushTelemetryFrame(srv: *ipc.Server) void {
    const snap = telemetry.current;
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.telemetry.frame\"");
    appendPerfFields(&resp_buf, &pos, snap);
    ap(&resp_buf, &pos, "}\n");
    _ = srv.send(resp_buf[0..pos]);
}

fn appendPerfFields(buf: []u8, pos: *usize, snap: telemetry.Snapshot) void {
    ap(buf, pos, ",\"fps\":");
    apInt(buf, pos, @intCast(snap.fps));
    ap(buf, pos, ",\"frame\":");
    apInt(buf, pos, @intCast(snap.frame_number));
    ap(buf, pos, ",\"layout_us\":");
    apInt(buf, pos, @intCast(snap.layout_us));
    ap(buf, pos, ",\"paint_us\":");
    apInt(buf, pos, @intCast(snap.paint_us));
    ap(buf, pos, ",\"tick_us\":");
    apInt(buf, pos, @intCast(snap.tick_us));
    ap(buf, pos, ",\"rects\":");
    apInt(buf, pos, @intCast(snap.rect_count));
    ap(buf, pos, ",\"glyphs\":");
    apInt(buf, pos, @intCast(snap.glyph_count));
    ap(buf, pos, ",\"visible\":");
    apInt(buf, pos, @intCast(snap.visible_nodes));
    ap(buf, pos, ",\"total\":");
    apInt(buf, pos, @intCast(snap.total_nodes));
}

// ── Minimal JSON helpers ───────────────────────────────────────────

fn ap(buf: []u8, pos: *usize, s: []const u8) void {
    const n = @min(s.len, buf.len - pos.*);
    @memcpy(buf[pos.* .. pos.* + n], s[0..n]);
    pos.* += n;
}

fn apInt(buf: []u8, pos: *usize, val: i64) void {
    var tmp: [20]u8 = undefined;
    const s = std.fmt.bufPrint(&tmp, "{d}", .{val}) catch return;
    ap(buf, pos, s);
}

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

/// Extract a string value for a key from a JSON object (minimal, no nesting).
fn jsonStr(json: []const u8, key: []const u8) ?[]const u8 {
    // Search for "key":"value"
    var i: usize = 0;
    while (i + key.len + 4 < json.len) : (i += 1) {
        if (json[i] == '"' and i + 1 + key.len < json.len and
            std.mem.eql(u8, json[i + 1 .. i + 1 + key.len], key) and
            json[i + 1 + key.len] == '"')
        {
            // Found key, skip to value
            var j = i + 2 + key.len;
            while (j < json.len and (json[j] == ':' or json[j] == ' ')) j += 1;
            if (j < json.len and json[j] == '"') {
                j += 1;
                const val_start = j;
                while (j < json.len and json[j] != '"') j += 1;
                return json[val_start..j];
            }
        }
    }
    return null;
}

/// Extract an integer value for a key from a JSON object.
fn jsonInt(json: []const u8, key: []const u8) ?i32 {
    var i: usize = 0;
    while (i + key.len + 4 < json.len) : (i += 1) {
        if (json[i] == '"' and i + 1 + key.len < json.len and
            std.mem.eql(u8, json[i + 1 .. i + 1 + key.len], key) and
            json[i + 1 + key.len] == '"')
        {
            var j = i + 2 + key.len;
            while (j < json.len and (json[j] == ':' or json[j] == ' ')) j += 1;
            const num_start = j;
            if (j < json.len and (json[j] == '-' or (json[j] >= '0' and json[j] <= '9'))) {
                j += 1;
                while (j < json.len and json[j] >= '0' and json[j] <= '9') j += 1;
                return std.fmt.parseInt(i32, json[num_start..j], 10) catch null;
            }
        }
    }
    return null;
}

// ── Tests ──────────────────────────────────────────────────────────

test "jsonStr extracts values" {
    const testing = std.testing;
    const json = "{\"method\":\"debug.tree\",\"id\":\"foo\"}";
    try testing.expectEqualStrings("debug.tree", jsonStr(json, "method").?);
    try testing.expectEqualStrings("foo", jsonStr(json, "id").?);
    try testing.expectEqual(@as(?[]const u8, null), jsonStr(json, "missing"));
}

test "jsonInt extracts values" {
    const testing = std.testing;
    const json = "{\"method\":\"debug.node\",\"id\":42}";
    try testing.expectEqual(@as(?i32, 42), jsonInt(json, "id"));
    try testing.expectEqual(@as(?i32, null), jsonInt(json, "missing"));
}
