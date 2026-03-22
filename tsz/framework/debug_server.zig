//! Debug server — thin encrypted IPC server embedded in dev builds.
//!
//! Compiled in only when HAS_DEBUG_SERVER=true (dev builds). Dead-code
//! eliminated in dist builds — no TCP listener in the binary at all.
//!
//! Security:
//!   - X25519 key exchange → HKDF-SHA256 → XChaCha20-Poly1305 encrypted channel
//!   - Session file at ~/.tsz/sessions/<pid>.json (pubkey discovery)
//!   - Terminal/PTY nodes are read-only — simulate commands are rejected
//!   - debug.script() cannot spawn shells or touch PTY file descriptors
//!
//! Spec: tsz/docs/TSZ_TOOLS_SPEC.md

const std = @import("std");
const ipc = @import("net/ipc.zig");
const telemetry = @import("telemetry.zig");
const app_crypto = @import("crypto.zig");

const X25519 = std.crypto.dh.X25519;
const XChaCha = std.crypto.aead.chacha_poly.XChaCha20Poly1305;

// POSIX externs (same pattern as process.zig)
extern fn getpid() c_int;
extern fn mkdir(path: [*:0]const u8, mode: c_uint) c_int;
extern fn unlink(path: [*:0]const u8) c_int;

// ── State ──────────────────────────────────────────────────────────

var server: ?ipc.Server = null;
var enabled: bool = false;
var authenticated: bool = false;
var streaming_telemetry: bool = false;
var selected_node_id: i32 = -1;

var our_keypair: X25519.KeyPair = undefined;
var shared_key: [32]u8 = undefined;
var tx_nonce_counter: u64 = 0;

var session_path_buf: [256]u8 = undefined;
var session_path_len: usize = 0;

const RESP_SIZE = 65536;
var resp_buf: [RESP_SIZE]u8 = undefined;

// ── Public API ─────────────────────────────────────────────────────

pub fn init() void {
    const env = std.posix.getenv("TSZ_DEBUG") orelse return;
    if (env.len == 0 or env[0] != '1') return;
    startServer();
}

pub fn poll() void {
    var srv = &(server orelse return);
    _ = srv.acceptClient();
    if (!srv.connected()) {
        authenticated = false;
        return;
    }
    const msgs = srv.poll();
    for (msgs) |msg| {
        if (!authenticated) {
            handleHandshake(srv, msg.data);
        } else {
            handleEncrypted(srv, msg.data);
        }
    }
    if (streaming_telemetry and authenticated) {
        pushTelemetryFrame(srv);
    }
}

pub fn getSelectedNode() i32 {
    return selected_node_id;
}

pub fn deinit() void {
    if (server) |*s| s.close();
    server = null;
    enabled = false;
    authenticated = false;
    removeSessionFile();
}

// ── Server startup ─────────────────────────────────────────────────

fn startServer() void {
    if (server != null) return;
    server = ipc.Server.bind(0) catch return;
    enabled = true;
    our_keypair = X25519.KeyPair.generate();
    const port = server.?.getPort();
    writeSessionFile(port);
    var port_buf: [64]u8 = undefined;
    const msg = std.fmt.bufPrint(&port_buf, "[debug_server] port {d}\n", .{port}) catch return;
    _ = std.posix.write(2, msg) catch {};
}

// ── Session file ───────────────────────────────────────────────────

fn writeSessionFile(port: u16) void {
    const home = std.posix.getenv("HOME") orelse return;
    const pid: c_int = getpid();

    // mkdir -p ~/.tsz/sessions/ (ignore errors if exists)
    var parent_buf: [256:0]u8 = [_:0]u8{0} ** 256;
    _ = std.fmt.bufPrint(parent_buf[0..255], "{s}/.tsz", .{home}) catch return;
    _ = mkdir(&parent_buf, 0o755);
    var dir_buf: [256:0]u8 = [_:0]u8{0} ** 256;
    _ = std.fmt.bufPrint(dir_buf[0..255], "{s}/.tsz/sessions", .{home}) catch return;
    _ = mkdir(&dir_buf, 0o755);

    // Session file path
    const path_slice = std.fmt.bufPrint(&session_path_buf, "{s}/.tsz/sessions/{d}.json", .{ home, pid }) catch return;
    session_path_len = path_slice.len;

    // Hex-encode pubkey
    var pubkey_hex: [64]u8 = undefined;
    app_crypto.bytesToHex(&our_keypair.public_key, &pubkey_hex);

    // Write JSON
    var json_buf: [512]u8 = undefined;
    const json = std.fmt.bufPrint(&json_buf,
        "{{\"pid\":{d},\"port\":{d},\"pubkey\":\"{s}\",\"app\":\"zigos\"}}\n",
        .{ pid, port, pubkey_hex[0..64] },
    ) catch return;

    // Use std.fs for file I/O (handles null-termination correctly)
    const cwd = std.fs.cwd();
    const file = cwd.createFile(session_path_buf[0..session_path_len], .{}) catch return;
    defer file.close();
    file.writeAll(json) catch {};
}

fn removeSessionFile() void {
    if (session_path_len == 0) return;
    const cwd = std.fs.cwd();
    cwd.deleteFile(session_path_buf[0..session_path_len]) catch {};
    session_path_len = 0;
}

// ── Handshake ──────────────────────────────────────────────────────

fn handleHandshake(srv: *ipc.Server, raw: []const u8) void {
    const hex = jsonStr(raw, "pubkey") orelse {
        dropClient(srv);
        return;
    };
    if (hex.len != 64) { dropClient(srv); return; }

    var client_pubkey: [32]u8 = undefined;
    _ = app_crypto.hexToBytes(hex, &client_pubkey) catch { dropClient(srv); return; };

    const dh_shared = X25519.scalarmult(our_keypair.secret_key, client_pubkey) catch {
        dropClient(srv);
        return;
    };

    const prk = app_crypto.hkdfExtract("tsz-debug-v1", &dh_shared);
    app_crypto.hkdfExpand(&prk, "debug-channel", &shared_key) catch { dropClient(srv); return; };

    tx_nonce_counter = 0;
    authenticated = true;
    sendEncrypted(srv, "{\"method\":\"debug.handshake\",\"ok\":true}");
}

fn dropClient(srv: *ipc.Server) void {
    if (srv.client_fd) |fd| {
        std.posix.close(fd);
        srv.client_fd = null;
    }
    authenticated = false;
}

// ── Encrypted message I/O ──────────────────────────────────────────

fn nextTxNonce() [XChaCha.nonce_length]u8 {
    var nonce: [XChaCha.nonce_length]u8 = [_]u8{0} ** XChaCha.nonce_length;
    nonce[0] = 'T';
    const bytes = std.mem.asBytes(&tx_nonce_counter);
    @memcpy(nonce[16..24], bytes);
    tx_nonce_counter += 1;
    return nonce;
}

fn sendEncrypted(srv: *ipc.Server, plaintext: []const u8) void {
    if (plaintext.len > RESP_SIZE / 2 - 128) return;
    const nonce = nextTxNonce();
    var ct_buf: [RESP_SIZE / 2]u8 = undefined;
    var tag: [XChaCha.tag_length]u8 = undefined;
    XChaCha.encrypt(ct_buf[0..plaintext.len], &tag, plaintext, "", nonce, shared_key);

    var pos: usize = 0;
    hexEncode(&resp_buf, &pos, &nonce);
    hexEncode(&resp_buf, &pos, ct_buf[0..plaintext.len]);
    hexEncode(&resp_buf, &pos, &tag);
    if (pos < RESP_SIZE) { resp_buf[pos] = '\n'; pos += 1; }
    _ = srv.send(resp_buf[0..pos]);
}

fn handleEncrypted(srv: *ipc.Server, raw: []const u8) void {
    const min_hex = (XChaCha.nonce_length + XChaCha.tag_length) * 2;
    if (raw.len < min_hex) return;

    var wire_buf: [RESP_SIZE / 2]u8 = undefined;
    const wire_len = app_crypto.hexToBytes(raw, &wire_buf) catch return;
    if (wire_len < XChaCha.nonce_length + XChaCha.tag_length) return;

    const nonce = wire_buf[0..XChaCha.nonce_length].*;
    const ct_len = wire_len - XChaCha.nonce_length - XChaCha.tag_length;
    const ct = wire_buf[XChaCha.nonce_length .. XChaCha.nonce_length + ct_len];
    const tag = wire_buf[XChaCha.nonce_length + ct_len ..][0..XChaCha.tag_length].*;

    var pt_buf: [RESP_SIZE / 2]u8 = undefined;
    XChaCha.decrypt(pt_buf[0..ct_len], ct, tag, "", nonce, shared_key) catch {
        dropClient(srv);
        return;
    };
    handleRequest(srv, pt_buf[0..ct_len]);
}

// ── Request dispatch ───────────────────────────────────────────────

fn handleRequest(srv: *ipc.Server, raw: []const u8) void {
    const method = jsonStr(raw, "method") orelse return;

    if (eql(method, "debug.tree")) {
        respondTree(srv);
    } else if (eql(method, "debug.node")) {
        respondNode(srv, jsonInt(raw, "id") orelse return);
    } else if (eql(method, "debug.select")) {
        selected_node_id = jsonInt(raw, "id") orelse return;
        sendEncrypted(srv, "{\"method\":\"debug.select\",\"ok\":true}");
    } else if (eql(method, "debug.state")) {
        respondState(srv);
    } else if (eql(method, "debug.perf")) {
        respondPerf(srv);
    } else if (eql(method, "debug.telemetry.stream")) {
        streaming_telemetry = !streaming_telemetry;
        sendEncrypted(srv, if (streaming_telemetry)
            "{\"method\":\"debug.telemetry.stream\",\"streaming\":true}"
        else
            "{\"method\":\"debug.telemetry.stream\",\"streaming\":false}");
    } else if (eql(method, "debug.telemetry.history")) {
        respondTelemetryHistory(srv);
    } else if (eql(method, "debug.simulate.press") or
        eql(method, "debug.simulate.type") or
        eql(method, "debug.simulate.scroll"))
    {
        // SECURITY: reject if target is a terminal/PTY node
        sendEncrypted(srv, "{\"error\":\"simulate commands not yet implemented; terminal nodes are always read-only\"}");
    } else if (eql(method, "debug.script")) {
        // SECURITY: script execution blocked from PTY/shell access
        sendEncrypted(srv, "{\"error\":\"debug.script not yet implemented\"}");
    } else if (eql(method, "debug.snapshot")) {
        sendEncrypted(srv, "{\"error\":\"debug.snapshot not yet implemented\"}");
    } else {
        sendEncrypted(srv, "{\"error\":\"unknown method\"}");
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
        if (pos > RESP_SIZE / 2 - 256) break;
    }
    ap(&resp_buf, &pos, "]}");
    sendEncrypted(srv, resp_buf[0..pos]);
}

fn respondNode(srv: *ipc.Server, id: i32) void {
    if (id < 0) return;
    const node = telemetry.getNode(@intCast(id)) orelse {
        sendEncrypted(srv, "{\"method\":\"debug.node\",\"error\":\"not found\"}");
        return;
    };
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.node\",\"id\":");
    apInt(&resp_buf, &pos, id);
    ap(&resp_buf, &pos, ",\"type\":\"");
    ap(&resp_buf, &pos, telemetry.nodeTypeName(node));
    ap(&resp_buf, &pos, "\",\"depth\":");
    apInt(&resp_buf, &pos, telemetry.getNodeDepth(@intCast(id)));
    ap(&resp_buf, &pos, "}");
    sendEncrypted(srv, resp_buf[0..pos]);
}

fn respondState(srv: *ipc.Server) void {
    const snap = telemetry.current;
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.state\"");
    ap(&resp_buf, &pos, ",\"total_nodes\":"); apInt(&resp_buf, &pos, @intCast(snap.total_nodes));
    ap(&resp_buf, &pos, ",\"visible_nodes\":"); apInt(&resp_buf, &pos, @intCast(snap.visible_nodes));
    ap(&resp_buf, &pos, ",\"state_slots\":"); apInt(&resp_buf, &pos, @intCast(snap.state_slot_count));
    ap(&resp_buf, &pos, "}");
    sendEncrypted(srv, resp_buf[0..pos]);
}

fn respondPerf(srv: *ipc.Server) void {
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.perf\"");
    appendPerfFields(&resp_buf, &pos, telemetry.current);
    ap(&resp_buf, &pos, "}");
    sendEncrypted(srv, resp_buf[0..pos]);
}

fn respondTelemetryHistory(srv: *ipc.Server) void {
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.telemetry.history\",\"frames\":[");
    const max_frames: usize = @min(telemetry.historyCount(), 120);
    for (0..max_frames) |i| {
        const snap = telemetry.getHistory(i) orelse continue;
        if (i > 0) ap(&resp_buf, &pos, ",");
        ap(&resp_buf, &pos, "{");
        appendPerfFields(&resp_buf, &pos, snap.*);
        ap(&resp_buf, &pos, "}");
        if (pos > RESP_SIZE / 2 - 512) break;
    }
    ap(&resp_buf, &pos, "]}");
    sendEncrypted(srv, resp_buf[0..pos]);
}

fn pushTelemetryFrame(srv: *ipc.Server) void {
    var pos: usize = 0;
    ap(&resp_buf, &pos, "{\"method\":\"debug.telemetry.frame\"");
    appendPerfFields(&resp_buf, &pos, telemetry.current);
    ap(&resp_buf, &pos, "}");
    sendEncrypted(srv, resp_buf[0..pos]);
}

fn appendPerfFields(buf: []u8, pos: *usize, snap: telemetry.Snapshot) void {
    ap(buf, pos, ",\"fps\":"); apInt(buf, pos, @intCast(snap.fps));
    ap(buf, pos, ",\"frame\":"); apInt(buf, pos, @intCast(snap.frame_number));
    ap(buf, pos, ",\"layout_us\":"); apInt(buf, pos, @intCast(snap.layout_us));
    ap(buf, pos, ",\"paint_us\":"); apInt(buf, pos, @intCast(snap.paint_us));
    ap(buf, pos, ",\"tick_us\":"); apInt(buf, pos, @intCast(snap.tick_us));
    ap(buf, pos, ",\"rects\":"); apInt(buf, pos, @intCast(snap.rect_count));
    ap(buf, pos, ",\"glyphs\":"); apInt(buf, pos, @intCast(snap.glyph_count));
    ap(buf, pos, ",\"visible\":"); apInt(buf, pos, @intCast(snap.visible_nodes));
    ap(buf, pos, ",\"total\":"); apInt(buf, pos, @intCast(snap.total_nodes));
}

// ── Helpers ────────────────────────────────────────────────────────

fn hexEncode(buf: []u8, pos: *usize, data: []const u8) void {
    const hc = "0123456789abcdef";
    for (data) |b| {
        if (pos.* + 2 > buf.len) return;
        buf[pos.*] = hc[b >> 4];
        buf[pos.* + 1] = hc[b & 0x0f];
        pos.* += 2;
    }
}

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

fn jsonStr(json: []const u8, key: []const u8) ?[]const u8 {
    var i: usize = 0;
    while (i + key.len + 4 < json.len) : (i += 1) {
        if (json[i] == '"' and i + 1 + key.len < json.len and
            std.mem.eql(u8, json[i + 1 .. i + 1 + key.len], key) and
            json[i + 1 + key.len] == '"')
        {
            var j = i + 2 + key.len;
            while (j < json.len and (json[j] == ':' or json[j] == ' ')) j += 1;
            if (j < json.len and json[j] == '"') {
                j += 1;
                const vs = j;
                while (j < json.len and json[j] != '"') j += 1;
                return json[vs..j];
            }
        }
    }
    return null;
}

fn jsonInt(json: []const u8, key: []const u8) ?i32 {
    var i: usize = 0;
    while (i + key.len + 4 < json.len) : (i += 1) {
        if (json[i] == '"' and i + 1 + key.len < json.len and
            std.mem.eql(u8, json[i + 1 .. i + 1 + key.len], key) and
            json[i + 1 + key.len] == '"')
        {
            var j = i + 2 + key.len;
            while (j < json.len and (json[j] == ':' or json[j] == ' ')) j += 1;
            const ns = j;
            if (j < json.len and (json[j] == '-' or (json[j] >= '0' and json[j] <= '9'))) {
                j += 1;
                while (j < json.len and json[j] >= '0' and json[j] <= '9') j += 1;
                return std.fmt.parseInt(i32, json[ns..j], 10) catch null;
            }
        }
    }
    return null;
}

// ── Tests ──────────────────────────────────────────────────────────

test "jsonStr extracts values" {
    try std.testing.expectEqualStrings("debug.tree", jsonStr("{\"method\":\"debug.tree\"}", "method").?);
    try std.testing.expectEqual(@as(?[]const u8, null), jsonStr("{\"a\":1}", "missing"));
}

test "jsonInt extracts values" {
    try std.testing.expectEqual(@as(?i32, 42), jsonInt("{\"id\":42}", "id"));
    try std.testing.expectEqual(@as(?i32, null), jsonInt("{\"a\":1}", "missing"));
}

test "e2e: X25519 handshake + encrypted debug.select" {
    // Start server
    startServer();
    defer deinit();
    const port = server.?.getPort();
    try std.testing.expect(port > 0);

    // Client connects
    var client = try ipc.Client.connect(port);
    defer client.close();
    try std.testing.expect(server.?.acceptClient());

    // Client generates keypair, sends pubkey
    const client_kp = X25519.KeyPair.generate();
    var pubkey_hex: [64]u8 = undefined;
    app_crypto.bytesToHex(&client_kp.public_key, &pubkey_hex);
    var msg_buf: [128]u8 = undefined;
    const hs_msg = std.fmt.bufPrint(&msg_buf, "{{\"pubkey\":\"{s}\"}}", .{pubkey_hex[0..64]}) catch unreachable;
    try std.testing.expect(client.sendLine(hs_msg));

    std.Thread.sleep(20 * std.time.ns_per_ms);
    poll();
    try std.testing.expect(authenticated);

    // Client derives same shared key
    const client_dh = X25519.scalarmult(client_kp.secret_key, our_keypair.public_key) catch unreachable;
    const client_prk = app_crypto.hkdfExtract("tsz-debug-v1", &client_dh);
    var client_shared: [32]u8 = undefined;
    app_crypto.hkdfExpand(&client_prk, "debug-channel", &client_shared) catch unreachable;

    // Read + decrypt handshake OK
    std.Thread.sleep(20 * std.time.ns_per_ms);
    const resp_msgs = client.poll();
    try std.testing.expect(resp_msgs.len > 0);
    const pt = try decryptWire(resp_msgs[0].data, client_shared);
    try std.testing.expect(std.mem.indexOf(u8, pt, "debug.handshake") != null);

    // Send encrypted debug.select
    const select_json = "{\"method\":\"debug.select\",\"id\":42}";
    var enc_buf: [2048]u8 = undefined;
    const enc_msg = encryptForSend(select_json, client_shared, &enc_buf);
    try std.testing.expect(client.sendLine(enc_msg));

    std.Thread.sleep(20 * std.time.ns_per_ms);
    poll();
    try std.testing.expectEqual(@as(i32, 42), getSelectedNode());
}

test "unauthenticated client is dropped" {
    startServer();
    defer deinit();
    var client = try ipc.Client.connect(server.?.getPort());
    defer client.close();
    _ = server.?.acceptClient();
    _ = client.sendLine("{\"method\":\"debug.tree\"}");
    std.Thread.sleep(10 * std.time.ns_per_ms);
    poll();
    try std.testing.expect(!authenticated);
}

// ── Test helpers ───────────────────────────────────────────────────

fn decryptWire(wire_hex: []const u8, key: [32]u8) ![]const u8 {
    const S = struct { var pt: [RESP_SIZE / 2]u8 = undefined; var wb: [RESP_SIZE / 2]u8 = undefined; };
    const wl = try app_crypto.hexToBytes(wire_hex, &S.wb);
    if (wl < XChaCha.nonce_length + XChaCha.tag_length) return error.TooShort;
    const nonce = S.wb[0..XChaCha.nonce_length].*;
    const ctl = wl - XChaCha.nonce_length - XChaCha.tag_length;
    const ct = S.wb[XChaCha.nonce_length .. XChaCha.nonce_length + ctl];
    const tag = S.wb[XChaCha.nonce_length + ctl ..][0..XChaCha.tag_length].*;
    try XChaCha.decrypt(S.pt[0..ctl], ct, tag, "", nonce, key);
    return S.pt[0..ctl];
}

fn encryptForSend(plaintext: []const u8, key: [32]u8, out: []u8) []const u8 {
    const S = struct { var ct: [512]u8 = undefined; var nc: u64 = 0; };
    var nonce: [XChaCha.nonce_length]u8 = [_]u8{0} ** XChaCha.nonce_length;
    nonce[0] = 'C';
    const nb = std.mem.asBytes(&S.nc);
    @memcpy(nonce[16..24], nb);
    S.nc += 1;
    var tag: [XChaCha.tag_length]u8 = undefined;
    XChaCha.encrypt(S.ct[0..plaintext.len], &tag, plaintext, "", nonce, key);
    var pos: usize = 0;
    hexEncode(out, &pos, &nonce);
    hexEncode(out, &pos, S.ct[0..plaintext.len]);
    hexEncode(out, &pos, &tag);
    return out[0..pos];
}
