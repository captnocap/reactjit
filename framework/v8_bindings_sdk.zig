const std = @import("std");
const v8 = @import("v8");
const v8rt = @import("v8_runtime.zig");

const net_http = @import("net/http.zig");
const page_fetch = @import("net/page_fetch.zig");
const debug_client = @import("debug_client.zig");
const player_mod = @import("player.zig");
const vterm_mod = @import("vterm.zig");
const semantic = @import("semantic.zig");
const classifier = @import("classifier.zig");
const claude_sdk = @import("claude_sdk/mod.zig");
const kimi_wire_sdk = @import("kimi_wire_sdk.zig");
const local_ai_runtime = @import("local_ai_runtime.zig");

const HTTP_MAX_HEADERS: usize = 16;

var g_http_init_done: bool = false;
var g_page_fetch_init_done: bool = false;
var g_http_pending: ?std.AutoHashMap(u32, []u8) = null;
var g_page_pending: ?std.AutoHashMap(u32, []u8) = null;

var g_claude_session: ?claude_sdk.Session = null;
var g_kimi_session: ?kimi_wire_sdk.Session = null;
var g_kimi_turn_text: std.ArrayList(u8) = .{};
var g_kimi_turn_thinking: std.ArrayList(u8) = .{};
var g_local_ai_session: ?*local_ai_runtime.Session = null;

fn callbackCtx(info: v8.FunctionCallbackInfo) struct { iso: v8.Isolate, ctx: v8.Context } {
    const iso = info.getIsolate();
    return .{ .iso = iso, .ctx = iso.getCurrentContext() };
}

fn setReturnUndefined(info: v8.FunctionCallbackInfo, iso: v8.Isolate) void {
    info.getReturnValue().set(v8.initUndefined(iso));
}

fn setReturnBool(info: v8.FunctionCallbackInfo, iso: v8.Isolate, val: bool) void {
    info.getReturnValue().set(v8.Boolean.init(iso, val));
}

fn setReturnNum(info: v8.FunctionCallbackInfo, iso: v8.Isolate, val: f64) void {
    info.getReturnValue().set(v8.Number.init(iso, val));
}

fn setReturnInt(info: v8.FunctionCallbackInfo, iso: v8.Isolate, val: i64) void {
    info.getReturnValue().set(v8.Number.init(iso, @floatFromInt(val)));
}

fn setReturnString(info: v8.FunctionCallbackInfo, iso: v8.Isolate, text: []const u8) void {
    info.getReturnValue().set(v8.String.initUtf8(iso, text));
}

fn jsStringArg(alloc: std.mem.Allocator, info: v8.FunctionCallbackInfo, idx: u32) ?[]u8 {
    if (idx >= info.length()) return null;
    const cx = callbackCtx(info);
    const s = info.getArg(idx).toString(cx.ctx) catch return null;
    const len = s.lenUtf8(cx.iso);
    const buf = alloc.alloc(u8, len) catch return null;
    _ = s.writeUtf8(cx.iso, buf);
    return buf;
}

fn jsI32Arg(info: v8.FunctionCallbackInfo, idx: u32) ?i32 {
    if (idx >= info.length()) return null;
    const cx = callbackCtx(info);
    return info.getArg(idx).toI32(cx.ctx) catch null;
}

fn jsF64Arg(info: v8.FunctionCallbackInfo, idx: u32) ?f64 {
    if (idx >= info.length()) return null;
    const cx = callbackCtx(info);
    return info.getArg(idx).toF64(cx.ctx) catch null;
}

fn setStrProp(iso: v8.Isolate, ctx: v8.Context, obj: v8.Object, key: []const u8, val: []const u8) void {
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, key), v8.String.initUtf8(iso, val));
}

fn setBoolProp(iso: v8.Isolate, ctx: v8.Context, obj: v8.Object, key: []const u8, val: bool) void {
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, key), v8.Boolean.init(iso, val));
}

fn setNumProp(iso: v8.Isolate, ctx: v8.Context, obj: v8.Object, key: []const u8, val: f64) void {
    _ = obj.setValue(ctx, v8.String.initUtf8(iso, key), v8.Number.init(iso, val));
}

fn setIntProp(iso: v8.Isolate, ctx: v8.Context, obj: v8.Object, key: []const u8, val: i64) void {
    setNumProp(iso, ctx, obj, key, @floatFromInt(val));
}

fn jsonEscape(out: *std.ArrayList(u8), alloc: std.mem.Allocator, s: []const u8) !void {
    try out.append(alloc, '"');
    for (s) |ch| switch (ch) {
        '"' => try out.appendSlice(alloc, "\\\""),
        '\\' => try out.appendSlice(alloc, "\\\\"),
        '\n' => try out.appendSlice(alloc, "\\n"),
        '\r' => try out.appendSlice(alloc, "\\r"),
        '\t' => try out.appendSlice(alloc, "\\t"),
        0...8, 11, 12, 14...31 => try out.writer(alloc).print("\\u{x:0>4}", .{ch}),
        else => try out.append(alloc, ch),
    };
    try out.append(alloc, '"');
}

const HttpReq = struct {
    method: []const u8,
    url: []const u8,
    headers: ?std.json.ObjectMap,
    body: ?[]const u8,
    timeout_sec: u32,
};

fn parseHttpReq(parsed: *const std.json.Parsed(std.json.Value)) ?HttpReq {
    const root = parsed.value;
    if (root != .object) return null;
    const url_v = root.object.get("url") orelse return null;
    if (url_v != .string) return null;
    const method: []const u8 = if (root.object.get("method")) |mv|
        (if (mv == .string) mv.string else "GET")
    else
        "GET";
    const headers = if (root.object.get("headers")) |hv|
        (if (hv == .object) hv.object else null)
    else
        null;
    const body: ?[]const u8 = if (root.object.get("body")) |bv|
        (if (bv == .string) bv.string else null)
    else
        null;
    const timeout_ms: u32 = if (root.object.get("timeoutMs")) |tv|
        switch (tv) {
            .integer => |i| @intCast(@max(0, i)),
            .float => |f| @intFromFloat(@max(0.0, f)),
            else => 30_000,
        }
    else
        30_000;
    return .{
        .method = method,
        .url = url_v.string,
        .headers = headers,
        .body = body,
        .timeout_sec = @max(1, timeout_ms / 1000),
    };
}

fn httpSyncViaCurl(req: HttpReq) ![]u8 {
    const alloc = std.heap.page_allocator;

    var argv = std.ArrayList([]const u8){};
    defer argv.deinit(alloc);
    try argv.appendSlice(alloc, &.{ "curl", "-sSi", "-X", req.method });

    var tbuf: [16]u8 = undefined;
    const tstr = try std.fmt.bufPrint(&tbuf, "{d}", .{req.timeout_sec});
    try argv.appendSlice(alloc, &.{ "--max-time", tstr });

    if (req.headers) |hdrs| {
        var it = hdrs.iterator();
        while (it.next()) |entry| {
            if (entry.value_ptr.* != .string) continue;
            const hdr_line = try std.fmt.allocPrint(alloc, "{s}: {s}", .{ entry.key_ptr.*, entry.value_ptr.string });
            try argv.appendSlice(alloc, &.{ "-H", hdr_line });
        }
    }

    if (req.body) |b| try argv.appendSlice(alloc, &.{ "--data-binary", b });
    try argv.append(alloc, req.url);

    const result = try std.process.Child.run(.{
        .allocator = alloc,
        .argv = argv.items,
        .max_output_bytes = 8 * 1024 * 1024,
    });
    defer alloc.free(result.stderr);

    const raw = result.stdout;
    const sep_crlf = std.mem.indexOf(u8, raw, "\r\n\r\n");
    const sep_lf = std.mem.indexOf(u8, raw, "\n\n");
    const header_end: usize = if (sep_crlf) |v| v else (if (sep_lf) |v| v else raw.len);
    const body_start: usize = if (sep_crlf != null) header_end + 4 else (if (sep_lf != null) header_end + 2 else raw.len);
    const header_block = raw[0..header_end];
    const body = raw[body_start..];

    var status: u16 = 0;
    if (std.mem.indexOfScalar(u8, header_block, '\n')) |nl| {
        const first_line = std.mem.trim(u8, header_block[0..nl], " \r\t");
        if (std.mem.indexOfScalar(u8, first_line, ' ')) |sp1| {
            const after = first_line[sp1 + 1 ..];
            const sp2 = std.mem.indexOfScalar(u8, after, ' ') orelse after.len;
            status = std.fmt.parseInt(u16, after[0..sp2], 10) catch 0;
        }
    }

    var out = std.ArrayList(u8){};
    errdefer out.deinit(alloc);
    try out.writer(alloc).print("{{\"status\":{d},\"headers\":{{", .{status});
    var first_hdr = true;
    var it = std.mem.splitScalar(u8, header_block, '\n');
    _ = it.next();
    while (it.next()) |line| {
        const trimmed = std.mem.trim(u8, line, " \r\t");
        if (trimmed.len == 0) continue;
        const colon = std.mem.indexOfScalar(u8, trimmed, ':') orelse continue;
        const k = std.mem.trim(u8, trimmed[0..colon], " \t");
        const v = std.mem.trim(u8, trimmed[colon + 1 ..], " \t");
        if (!first_hdr) try out.append(alloc, ',');
        first_hdr = false;
        try jsonEscape(&out, alloc, k);
        try out.append(alloc, ':');
        try jsonEscape(&out, alloc, v);
    }
    try out.appendSlice(alloc, "},\"body\":");
    try jsonEscape(&out, alloc, body);
    try out.append(alloc, '}');

    alloc.free(result.stdout);
    return out.toOwnedSlice(alloc);
}

fn httpPending() *std.AutoHashMap(u32, []u8) {
    if (g_http_pending == null) g_http_pending = std.AutoHashMap(u32, []u8).init(std.heap.page_allocator);
    return &g_http_pending.?;
}

fn pagePending() *std.AutoHashMap(u32, []u8) {
    if (g_page_pending == null) g_page_pending = std.AutoHashMap(u32, []u8).init(std.heap.page_allocator);
    return &g_page_pending.?;
}

fn hashReqId(s: []const u8) u32 {
    var h = std.hash.Wyhash.init(0xE1_FE_1D);
    h.update(s);
    return @truncate(h.final());
}

fn parsePageReq(parsed: *const std.json.Parsed(std.json.Value)) ?[]const u8 {
    const root = parsed.value;
    if (root != .object) return null;
    const url_v = root.object.get("url") orelse return null;
    return if (url_v == .string) url_v.string else null;
}

fn buildPageRespJson(resp: *const page_fetch.Response, alloc: std.mem.Allocator) ![]u8 {
    var out = std.ArrayList(u8){};
    errdefer out.deinit(alloc);
    try out.writer(alloc).print("{{\"status\":{d},\"finalUrl\":", .{resp.status});
    try jsonEscape(&out, alloc, resp.finalUrlSlice());
    try out.appendSlice(alloc, ",\"contentType\":");
    try jsonEscape(&out, alloc, resp.contentTypeSlice());
    try out.appendSlice(alloc, ",\"body\":");
    try jsonEscape(&out, alloc, resp.bodySlice());
    try out.writer(alloc).print(",\"truncated\":{s}", .{if (resp.truncated) "true" else "false"});
    if (resp.response_type == .err) {
        try out.appendSlice(alloc, ",\"error\":");
        try jsonEscape(&out, alloc, resp.errorSlice());
    }
    try out.append(alloc, '}');
    return out.toOwnedSlice(alloc);
}

fn buildHttpRespJson(resp: *const net_http.Response, alloc: std.mem.Allocator) ![]u8 {
    var out = std.ArrayList(u8){};
    errdefer out.deinit(alloc);
    try out.writer(alloc).print("{{\"status\":{d},\"headers\":{{}},\"body\":", .{resp.status});
    try jsonEscape(&out, alloc, resp.bodySlice());
    if (resp.response_type == .err) {
        try out.appendSlice(alloc, ",\"error\":");
        try jsonEscape(&out, alloc, resp.errorSlice());
    }
    try out.append(alloc, '}');
    return out.toOwnedSlice(alloc);
}

fn claudeMessageToJs(iso: v8.Isolate, ctx: v8.Context, msg: claude_sdk.Message) v8.Object {
    const obj = v8.Object.init(iso);
    switch (msg) {
        .system => |s| {
            setStrProp(iso, ctx, obj, "type", "system");
            setStrProp(iso, ctx, obj, "session_id", s.session_id);
            if (s.model) |m| setStrProp(iso, ctx, obj, "model", m);
            if (s.cwd) |cwd| setStrProp(iso, ctx, obj, "cwd", cwd);
            const tools = v8.Array.init(iso, @intCast(s.tools.len));
            for (s.tools, 0..) |tname, i| {
                _ = tools.castTo(v8.Object).setValueAtIndex(ctx, @intCast(i), v8.String.initUtf8(iso, tname));
            }
            _ = obj.setValue(ctx, v8.String.initUtf8(iso, "tools"), tools.toValue());
        },
        .assistant => |a| {
            setStrProp(iso, ctx, obj, "type", "assistant");
            if (a.id) |id| setStrProp(iso, ctx, obj, "id", id);
            if (a.session_id) |sid| setStrProp(iso, ctx, obj, "session_id", sid);
            if (a.stop_reason) |sr| setStrProp(iso, ctx, obj, "stop_reason", sr);
            setNumProp(iso, ctx, obj, "input_tokens", @floatFromInt(a.usage.input_tokens));
            setNumProp(iso, ctx, obj, "output_tokens", @floatFromInt(a.usage.output_tokens));

            const blocks = v8.Array.init(iso, @intCast(a.content.len));
            var text_join: std.ArrayList(u8) = .{};
            defer text_join.deinit(std.heap.c_allocator);
            var thinking_join: std.ArrayList(u8) = .{};
            defer thinking_join.deinit(std.heap.c_allocator);
            for (a.content, 0..) |blk, i| {
                const b_obj = v8.Object.init(iso);
                switch (blk) {
                    .text => |t| {
                        setStrProp(iso, ctx, b_obj, "type", "text");
                        setStrProp(iso, ctx, b_obj, "text", t.text);
                        text_join.appendSlice(std.heap.c_allocator, t.text) catch {};
                    },
                    .thinking => |th| {
                        setStrProp(iso, ctx, b_obj, "type", "thinking");
                        setStrProp(iso, ctx, b_obj, "thinking", th.thinking);
                        thinking_join.appendSlice(std.heap.c_allocator, th.thinking) catch {};
                    },
                    .tool_use => |tu| {
                        setStrProp(iso, ctx, b_obj, "type", "tool_use");
                        setStrProp(iso, ctx, b_obj, "id", tu.id);
                        setStrProp(iso, ctx, b_obj, "name", tu.name);
                        setStrProp(iso, ctx, b_obj, "input_json", tu.input_json);
                    },
                }
                _ = blocks.castTo(v8.Object).setValueAtIndex(ctx, @intCast(i), b_obj.toValue());
            }
            _ = obj.setValue(ctx, v8.String.initUtf8(iso, "content"), blocks.toValue());
            if (text_join.items.len > 0) setStrProp(iso, ctx, obj, "text", text_join.items);
            if (thinking_join.items.len > 0) setStrProp(iso, ctx, obj, "thinking", thinking_join.items);
        },
        .user => |u| {
            setStrProp(iso, ctx, obj, "type", "user");
            if (u.session_id) |sid| setStrProp(iso, ctx, obj, "session_id", sid);
            setStrProp(iso, ctx, obj, "content_json", u.content_json);
        },
        .result => |r| {
            setStrProp(iso, ctx, obj, "type", "result");
            setStrProp(iso, ctx, obj, "subtype", @tagName(r.subtype));
            setStrProp(iso, ctx, obj, "session_id", r.session_id);
            if (r.result) |rt| setStrProp(iso, ctx, obj, "result", rt);
            setNumProp(iso, ctx, obj, "total_cost_usd", r.total_cost_usd);
            setNumProp(iso, ctx, obj, "duration_ms", @floatFromInt(r.duration_ms));
            setNumProp(iso, ctx, obj, "num_turns", @floatFromInt(r.num_turns));
            setBoolProp(iso, ctx, obj, "is_error", r.is_error);
        },
    }
    return obj;
}

fn kimiResetTurnBuffers() void {
    g_kimi_turn_text.clearRetainingCapacity();
    g_kimi_turn_thinking.clearRetainingCapacity();
}

fn kimiAppendTurnText(kind: enum { assistant, thinking }, chunk: []const u8) void {
    if (chunk.len == 0) return;
    switch (kind) {
        .assistant => g_kimi_turn_text.appendSlice(std.heap.c_allocator, chunk) catch {},
        .thinking => g_kimi_turn_thinking.appendSlice(std.heap.c_allocator, chunk) catch {},
    }
}

fn kimiDeinitTurnBuffers() void {
    g_kimi_turn_text.deinit(std.heap.c_allocator);
    g_kimi_turn_thinking.deinit(std.heap.c_allocator);
    g_kimi_turn_text = .{};
    g_kimi_turn_thinking = .{};
}

fn kimiMessageToJs(iso: v8.Isolate, ctx: v8.Context, msg: kimi_wire_sdk.InboundMessage) v8.Object {
    const obj = v8.Object.init(iso);
    switch (msg) {
        .event => |event| {
            const event_name = event.event_type;
            if (std.mem.eql(u8, event_name, "TurnBegin")) {
                kimiResetTurnBuffers();
                setStrProp(iso, ctx, obj, "type", "turn_begin");
                if (jsonGetStringPath(event.payload, &.{"user_input"})) |value| setStrProp(iso, ctx, obj, "text", value);
                return obj;
            }
            if (std.mem.eql(u8, event_name, "TurnEnd")) {
                setStrProp(iso, ctx, obj, "type", "status");
                setStrProp(iso, ctx, obj, "status", "turn_end");
                return obj;
            }
            if (std.mem.eql(u8, event_name, "StatusUpdate")) {
                setStrProp(iso, ctx, obj, "type", "usage");
                setNumProp(iso, ctx, obj, "input_tokens", @floatFromInt(jsonGetUIntPath(event.payload, &.{ "token_usage", "input_other" }) orelse 0));
                setNumProp(iso, ctx, obj, "output_tokens", @floatFromInt(jsonGetUIntPath(event.payload, &.{ "token_usage", "output" }) orelse 0));
                setNumProp(iso, ctx, obj, "cache_creation_input_tokens", @floatFromInt(jsonGetUIntPath(event.payload, &.{ "token_usage", "input_cache_creation" }) orelse 0));
                setNumProp(iso, ctx, obj, "cache_read_input_tokens", @floatFromInt(jsonGetUIntPath(event.payload, &.{ "token_usage", "input_cache_read" }) orelse 0));
                return obj;
            }
            if (std.mem.eql(u8, event_name, "ContentPart")) {
                const part_type = jsonGetStringPath(event.payload, &.{"type"}) orelse "unknown";
                const maybe_text = extractKimiDisplayTextAlloc(std.heap.c_allocator, event.payload) catch null;
                defer if (maybe_text) |value| std.heap.c_allocator.free(value);
                setStrProp(iso, ctx, obj, "type", "assistant_part");
                if (std.mem.eql(u8, part_type, "text")) {
                    setStrProp(iso, ctx, obj, "part_type", "text");
                    if (maybe_text) |value| {
                        kimiAppendTurnText(.assistant, value);
                        setStrProp(iso, ctx, obj, "text", value);
                    }
                    return obj;
                }
                if (std.mem.eql(u8, part_type, "think") or std.mem.eql(u8, part_type, "thinking")) {
                    setStrProp(iso, ctx, obj, "part_type", "thinking");
                    if (maybe_text) |value| {
                        kimiAppendTurnText(.thinking, value);
                        setStrProp(iso, ctx, obj, "text", value);
                    }
                    return obj;
                }
                if (maybe_text) |value| {
                    kimiAppendTurnText(.assistant, value);
                    setStrProp(iso, ctx, obj, "part_type", "text");
                    setStrProp(iso, ctx, obj, "text", value);
                    return obj;
                }
                setStrProp(iso, ctx, obj, "part_type", part_type);
                return obj;
            }
            if (std.mem.eql(u8, event_name, "ToolCall")) {
                setStrProp(iso, ctx, obj, "type", "tool_call");
                if (jsonGetStringPath(event.payload, &.{ "function", "name" })) |value| setStrProp(iso, ctx, obj, "name", value);
                const maybe_input_json = jsonValueTextAlloc(std.heap.c_allocator, jsonGetPath(event.payload, &.{ "function", "arguments" })) catch null;
                defer if (maybe_input_json) |value| std.heap.c_allocator.free(value);
                if (maybe_input_json) |value| setStrProp(iso, ctx, obj, "input_json", value);
                return obj;
            }
            if (std.mem.eql(u8, event_name, "ToolCallPart")) {
                setStrProp(iso, ctx, obj, "type", "tool_call");
                setStrProp(iso, ctx, obj, "name", "tool_delta");
                if (jsonGetStringPath(event.payload, &.{"arguments_part"})) |value| setStrProp(iso, ctx, obj, "input_json", value);
                return obj;
            }
            if (std.mem.eql(u8, event_name, "ToolResult")) {
                setStrProp(iso, ctx, obj, "type", "tool_result");
                setBoolProp(iso, ctx, obj, "is_error", jsonGetBoolPath(event.payload, &.{ "return_value", "is_error" }) orelse false);
                const maybe_text = extractKimiToolResultTextAlloc(std.heap.c_allocator, event.payload) catch null;
                defer if (maybe_text) |value| std.heap.c_allocator.free(value);
                if (maybe_text) |value| setStrProp(iso, ctx, obj, "text", value);
                return obj;
            }
            if (std.mem.eql(u8, event_name, "PlanDisplay")) {
                setStrProp(iso, ctx, obj, "type", "assistant_part");
                setStrProp(iso, ctx, obj, "part_type", "text");
                const maybe_text = extractKimiDisplayTextAlloc(std.heap.c_allocator, event.payload) catch null;
                defer if (maybe_text) |value| std.heap.c_allocator.free(value);
                if (maybe_text) |value| setStrProp(iso, ctx, obj, "text", value);
                return obj;
            }
            if (std.mem.endsWith(u8, event_name, "Display")) {
                const maybe_text = extractKimiDisplayTextAlloc(std.heap.c_allocator, event.payload) catch null;
                defer if (maybe_text) |value| std.heap.c_allocator.free(value);
                if (maybe_text) |value| {
                    setStrProp(iso, ctx, obj, "type", "assistant_part");
                    setStrProp(iso, ctx, obj, "part_type", "text");
                    setStrProp(iso, ctx, obj, "text", value);
                    return obj;
                }
            }
            if (std.mem.eql(u8, event_name, "BtwBegin")) {
                setStrProp(iso, ctx, obj, "type", "status");
                if (jsonGetStringPath(event.payload, &.{"question"})) |value| setStrProp(iso, ctx, obj, "text", value);
                return obj;
            }
            if (std.mem.eql(u8, event_name, "BtwEnd")) {
                setStrProp(iso, ctx, obj, "type", "status");
                if (jsonGetStringPath(event.payload, &.{"response"})) |value| setStrProp(iso, ctx, obj, "text", value);
                if (jsonGetStringPath(event.payload, &.{"error"})) |value| {
                    setStrProp(iso, ctx, obj, "text", value);
                    setBoolProp(iso, ctx, obj, "is_error", true);
                }
                return obj;
            }
            setStrProp(iso, ctx, obj, "type", "status");
            setStrProp(iso, ctx, obj, "status", event_name);
            const payload_json = jsonStringifyAlloc(std.heap.c_allocator, event.payload) catch null;
            defer if (payload_json) |value| std.heap.c_allocator.free(value);
            if (payload_json) |value| setStrProp(iso, ctx, obj, "payload_json", value);
            return obj;
        },
        .request => |request| {
            if (std.mem.eql(u8, request.request_type, "ToolCallRequest")) {
                setStrProp(iso, ctx, obj, "type", "tool_call");
                if (jsonGetStringPath(request.payload, &.{"name"})) |value| setStrProp(iso, ctx, obj, "name", value);
                if (jsonGetStringPath(request.payload, &.{"arguments"})) |value| setStrProp(iso, ctx, obj, "input_json", value);
                return obj;
            }
            setStrProp(iso, ctx, obj, "type", "status");
            if (std.mem.eql(u8, request.request_type, "ApprovalRequest")) {
                if (jsonGetStringPath(request.payload, &.{"description"})) |value| {
                    setStrProp(iso, ctx, obj, "text", value);
                } else if (jsonGetStringPath(request.payload, &.{"action"})) |value| {
                    setStrProp(iso, ctx, obj, "text", value);
                }
            } else if (std.mem.eql(u8, request.request_type, "QuestionRequest")) {
                const maybe_text = extractKimiQuestionTextAlloc(std.heap.c_allocator, request.payload) catch null;
                defer if (maybe_text) |value| std.heap.c_allocator.free(value);
                if (maybe_text) |value| setStrProp(iso, ctx, obj, "text", value);
            } else if (std.mem.eql(u8, request.request_type, "HookRequest")) {
                if (jsonGetStringPath(request.payload, &.{"target"})) |value| setStrProp(iso, ctx, obj, "text", value);
            }
            setStrProp(iso, ctx, obj, "status", request.request_type);
            return obj;
        },
        .response => |response| {
            setStrProp(iso, ctx, obj, "type", "result");
            if (response.status()) |value| setStrProp(iso, ctx, obj, "status", value);
            setBoolProp(iso, ctx, obj, "is_error", response.isError());
            if (response.error_message) |value| setStrProp(iso, ctx, obj, "result", value);
            const maybe_json = response.resultJsonAlloc(std.heap.c_allocator) catch null;
            defer if (maybe_json) |value| std.heap.c_allocator.free(value);
            if (!response.isError() and g_kimi_turn_text.items.len > 0) {
                setStrProp(iso, ctx, obj, "result", g_kimi_turn_text.items);
            } else if (maybe_json) |value| {
                setStrProp(iso, ctx, obj, "result", value);
            }
            if (g_kimi_turn_thinking.items.len > 0) setStrProp(iso, ctx, obj, "thinking", g_kimi_turn_thinking.items);
            return obj;
        },
    }
}

fn jsonStringifyAlloc(allocator: std.mem.Allocator, value: std.json.Value) ![]u8 {
    return std.json.Stringify.valueAlloc(allocator, value, .{});
}

fn jsonValueTextAlloc(allocator: std.mem.Allocator, maybe_value: ?std.json.Value) !?[]u8 {
    const value = maybe_value orelse return null;
    if (jsonAsString(value)) |text| return try allocator.dupe(u8, text);
    return try jsonStringifyAlloc(allocator, value);
}

fn extractKimiToolResultTextAlloc(allocator: std.mem.Allocator, payload: std.json.Value) !?[]u8 {
    if (jsonGetStringPath(payload, &.{ "return_value", "message" })) |message| return try allocator.dupe(u8, message);
    return extractKimiContentTextAlloc(allocator, jsonGetPath(payload, &.{ "return_value", "output" }));
}

fn extractKimiDisplayTextAlloc(allocator: std.mem.Allocator, payload: std.json.Value) !?[]u8 {
    if (jsonGetStringPath(payload, &.{"text"})) |text| return try allocator.dupe(u8, text);
    if (jsonGetStringPath(payload, &.{"content"})) |text| return try allocator.dupe(u8, text);
    if (jsonGetStringPath(payload, &.{"message"})) |text| return try allocator.dupe(u8, text);
    if (jsonGetStringPath(payload, &.{"response"})) |text| return try allocator.dupe(u8, text);
    if (jsonGetStringPath(payload, &.{"delta"})) |text| return try allocator.dupe(u8, text);
    if (jsonGetStringPath(payload, &.{"markdown"})) |text| return try allocator.dupe(u8, text);
    if (jsonGetStringPath(payload, &.{"think"})) |text| return try allocator.dupe(u8, text);
    if (try extractKimiContentTextAlloc(allocator, jsonGetPath(payload, &.{"content"}))) |text| return text;
    if (try extractKimiContentTextAlloc(allocator, jsonGetPath(payload, &.{"output"}))) |text| return text;
    if (try extractKimiContentTextAlloc(allocator, jsonGetPath(payload, &.{"parts"}))) |text| return text;
    if (try extractKimiContentTextAlloc(allocator, jsonGetPath(payload, &.{"delta"}))) |text| return text;
    return null;
}

fn extractKimiQuestionTextAlloc(allocator: std.mem.Allocator, payload: std.json.Value) !?[]u8 {
    const questions_value = jsonGetPath(payload, &.{"questions"}) orelse return null;
    const questions = jsonAsArray(questions_value) orelse return null;
    if (questions.items.len == 0) return null;
    const first = jsonAsObject(questions.items[0]) orelse return null;
    const question_value = first.get("question") orelse return null;
    if (jsonAsString(question_value)) |text| return try allocator.dupe(u8, text);
    return try jsonStringifyAlloc(allocator, question_value);
}

fn extractKimiContentTextAlloc(allocator: std.mem.Allocator, maybe_value: ?std.json.Value) !?[]u8 {
    const value = maybe_value orelse return null;
    if (jsonAsString(value)) |text| return try allocator.dupe(u8, text);

    const arr = jsonAsArray(value) orelse return null;
    var buf: std.ArrayList(u8) = .{};
    defer buf.deinit(allocator);

    for (arr.items) |entry| {
        const obj = jsonAsObject(entry) orelse continue;
        const item_type = if (obj.get("type")) |type_value| jsonAsString(type_value) else null;
        if (item_type != null and !std.mem.eql(u8, item_type.?, "text")) continue;
        const text_value = obj.get("text") orelse continue;
        const text = jsonAsString(text_value) orelse continue;
        if (buf.items.len > 0) try buf.append(allocator, '\n');
        try buf.appendSlice(allocator, text);
    }

    if (buf.items.len == 0) return null;
    return try buf.toOwnedSlice(allocator);
}

fn jsonGetPath(root: std.json.Value, path: []const []const u8) ?std.json.Value {
    var current = root;
    for (path) |segment| {
        const obj = jsonAsObject(current) orelse return null;
        current = obj.get(segment) orelse return null;
    }
    return current;
}

fn jsonGetStringPath(root: std.json.Value, path: []const []const u8) ?[]const u8 {
    const value = jsonGetPath(root, path) orelse return null;
    return jsonAsString(value);
}

fn jsonGetUIntPath(root: std.json.Value, path: []const []const u8) ?u64 {
    const value = jsonGetPath(root, path) orelse return null;
    return switch (value) {
        .integer => |number| @intCast(@max(number, 0)),
        else => null,
    };
}

fn jsonGetBoolPath(root: std.json.Value, path: []const []const u8) ?bool {
    const value = jsonGetPath(root, path) orelse return null;
    return switch (value) {
        .bool => |flag| flag,
        else => null,
    };
}

fn jsonAsObject(value: std.json.Value) ?std.json.ObjectMap {
    return switch (value) {
        .object => |object| object,
        else => null,
    };
}

fn jsonAsArray(value: std.json.Value) ?std.json.Array {
    return switch (value) {
        .array => |array| array,
        else => null,
    };
}

fn jsonAsString(value: std.json.Value) ?[]const u8 {
    return switch (value) {
        .string => |text| text,
        else => null,
    };
}

fn localAiEventToJs(iso: v8.Isolate, ctx: v8.Context, evt: local_ai_runtime.OwnedEvent) v8.Object {
    const obj = v8.Object.init(iso);
    switch (evt.kind) {
        .system => {
            setStrProp(iso, ctx, obj, "type", "system");
            if (evt.model) |value| setStrProp(iso, ctx, obj, "model", value);
            if (evt.session_id) |value| setStrProp(iso, ctx, obj, "session_id", value);
        },
        .assistant_part => {
            setStrProp(iso, ctx, obj, "type", "assistant_part");
            setStrProp(iso, ctx, obj, "part_type", evt.part_type orelse "text");
            if (evt.text) |value| setStrProp(iso, ctx, obj, "text", value);
        },
        .status => {
            setStrProp(iso, ctx, obj, "type", "status");
            if (evt.text) |value| setStrProp(iso, ctx, obj, "text", value);
            setBoolProp(iso, ctx, obj, "is_error", evt.is_error);
        },
        .result => {
            setStrProp(iso, ctx, obj, "type", "result");
            if (evt.text) |value| setStrProp(iso, ctx, obj, "result", value);
            setBoolProp(iso, ctx, obj, "is_error", evt.is_error);
        },
    }
    return obj;
}

fn hostFetch(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnUndefined(info, cx.iso);
    const url = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnUndefined(info, cx.iso);
    defer std.heap.page_allocator.free(url);

    const result = std.process.Child.run(.{
        .allocator = std.heap.page_allocator,
        .max_output_bytes = 2 * 1024 * 1024,
        .argv = &[_][]const u8{
            "curl", "-sL",                                                            "--max-time", "10", "--compressed",
            "-H",   "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36", url,
        },
    }) catch return setReturnUndefined(info, cx.iso);
    defer std.heap.page_allocator.free(result.stdout);
    defer std.heap.page_allocator.free(result.stderr);
    if (result.stdout.len == 0) return setReturnUndefined(info, cx.iso);
    setReturnString(info, cx.iso, result.stdout);
}

fn hostHttpRequestSync(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const json = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnString(info, cx.iso, "{\"status\":0,\"headers\":{},\"body\":\"\",\"error\":\"bad request json\"}");
    defer std.heap.page_allocator.free(json);

    const parsed = std.json.parseFromSlice(std.json.Value, std.heap.page_allocator, json, .{}) catch {
        return setReturnString(info, cx.iso, "{\"status\":0,\"headers\":{},\"body\":\"\",\"error\":\"bad request json\"}");
    };
    defer parsed.deinit();
    const req = parseHttpReq(&parsed) orelse return setReturnString(info, cx.iso, "{\"status\":0,\"headers\":{},\"body\":\"\",\"error\":\"bad request\"}");
    const resp_json = httpSyncViaCurl(req) catch |err| {
        var buf: [256]u8 = undefined;
        const s = std.fmt.bufPrint(&buf, "{{\"status\":0,\"headers\":{{}},\"body\":\"\",\"error\":\"{s}\"}}", .{@errorName(err)}) catch
            return setReturnString(info, cx.iso, "{\"status\":0,\"headers\":{},\"body\":\"\",\"error\":\"curl failed\"}");
        return setReturnString(info, cx.iso, s);
    };
    defer std.heap.page_allocator.free(resp_json);
    setReturnString(info, cx.iso, resp_json);
}

fn hostHttpRequestAsync(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 2) return setReturnUndefined(info, cx.iso);
    const spec = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnUndefined(info, cx.iso);
    defer std.heap.page_allocator.free(spec);
    const rid = jsStringArg(std.heap.page_allocator, info, 1) orelse return setReturnUndefined(info, cx.iso);
    defer std.heap.page_allocator.free(rid);

    if (!g_http_init_done) {
        net_http.init();
        g_http_init_done = true;
    }

    const parsed = std.json.parseFromSlice(std.json.Value, std.heap.page_allocator, spec, .{}) catch return setReturnUndefined(info, cx.iso);
    defer parsed.deinit();
    const req = parseHttpReq(&parsed) orelse return setReturnUndefined(info, cx.iso);
    const id = hashReqId(rid);
    const rid_copy = std.heap.page_allocator.dupe(u8, rid) catch return setReturnUndefined(info, cx.iso);
    httpPending().put(id, rid_copy) catch {
        std.heap.page_allocator.free(rid_copy);
        return setReturnUndefined(info, cx.iso);
    };

    var hdrs_buf: [HTTP_MAX_HEADERS][2][]const u8 = undefined;
    var opts = net_http.RequestOpts{ .url = req.url, .body = req.body };
    opts.method = if (std.ascii.eqlIgnoreCase(req.method, "POST")) .POST else if (std.ascii.eqlIgnoreCase(req.method, "PUT")) .PUT else if (std.ascii.eqlIgnoreCase(req.method, "DELETE")) .DELETE else if (std.ascii.eqlIgnoreCase(req.method, "PATCH")) .PATCH else if (std.ascii.eqlIgnoreCase(req.method, "HEAD")) .HEAD else .GET;
    if (req.headers) |hdrs| {
        var it = hdrs.iterator();
        var n: usize = 0;
        while (it.next()) |entry| {
            if (n >= HTTP_MAX_HEADERS) break;
            if (entry.value_ptr.* != .string) continue;
            hdrs_buf[n] = .{ entry.key_ptr.*, entry.value_ptr.string };
            n += 1;
        }
        opts.headers = hdrs_buf[0..n];
    }
    _ = net_http.request(id, opts);
    setReturnUndefined(info, cx.iso);
}

fn hostBrowserPageSync(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const spec = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnString(info, cx.iso, "{\"status\":0,\"finalUrl\":\"\",\"contentType\":\"\",\"body\":\"\",\"error\":\"missing request\"}");
    defer std.heap.page_allocator.free(spec);

    const parsed = std.json.parseFromSlice(std.json.Value, std.heap.page_allocator, spec, .{}) catch {
        return setReturnString(info, cx.iso, "{\"status\":0,\"finalUrl\":\"\",\"contentType\":\"\",\"body\":\"\",\"error\":\"bad request json\"}");
    };
    defer parsed.deinit();
    const url = parsePageReq(&parsed) orelse return setReturnString(info, cx.iso, "{\"status\":0,\"finalUrl\":\"\",\"contentType\":\"\",\"body\":\"\",\"error\":\"bad request\"}");
    const resp = page_fetch.fetchSync(url);
    const payload = buildPageRespJson(&resp, std.heap.page_allocator) catch return setReturnString(info, cx.iso, "{\"status\":0,\"finalUrl\":\"\",\"contentType\":\"\",\"body\":\"\",\"error\":\"serialize failed\"}");
    defer std.heap.page_allocator.free(payload);
    setReturnString(info, cx.iso, payload);
}

fn hostBrowserPageAsync(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 2) return setReturnUndefined(info, cx.iso);
    const spec = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnUndefined(info, cx.iso);
    defer std.heap.page_allocator.free(spec);
    const rid = jsStringArg(std.heap.page_allocator, info, 1) orelse return setReturnUndefined(info, cx.iso);
    defer std.heap.page_allocator.free(rid);

    if (!g_page_fetch_init_done) {
        page_fetch.init();
        g_page_fetch_init_done = true;
    }

    const parsed = std.json.parseFromSlice(std.json.Value, std.heap.page_allocator, spec, .{}) catch return setReturnUndefined(info, cx.iso);
    defer parsed.deinit();
    const url = parsePageReq(&parsed) orelse return setReturnUndefined(info, cx.iso);
    const id = hashReqId(rid);
    const rid_copy = std.heap.page_allocator.dupe(u8, rid) catch return setReturnUndefined(info, cx.iso);
    pagePending().put(id, rid_copy) catch {
        std.heap.page_allocator.free(rid_copy);
        return setReturnUndefined(info, cx.iso);
    };
    _ = page_fetch.request(id, url);
    setReturnUndefined(info, cx.iso);
}

fn hostPlayLoad(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const rec = vterm_mod.getRecorder();
    if (rec.frame_count == 0) return setReturnNum(info, cx.iso, 0);
    player_mod.load(rec);
    setReturnNum(info, cx.iso, 1);
}

fn hostPlayPlay(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    player_mod.play();
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostPlayPause(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    player_mod.pause();
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostPlayToggle(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    player_mod.togglePlay();
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostPlayStep(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    player_mod.step();
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostPlaySeek(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (jsF64Arg(info, 0)) |frac| player_mod.seekFraction(@floatCast(frac));
    setReturnUndefined(info, cx.iso);
}

fn hostPlaySpeed(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (jsF64Arg(info, 0)) |spd| player_mod.setSpeed(@floatCast(spd));
    setReturnUndefined(info, cx.iso);
}

fn hostPlayState(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (!player_mod.isLoaded()) return setReturnUndefined(info, cx.iso);
    const s = player_mod.getState();
    const obj = v8.Object.init(cx.iso);
    setBoolProp(cx.iso, cx.ctx, obj, "playing", s.playing);
    setNumProp(cx.iso, cx.ctx, obj, "time_us", @floatFromInt(s.time_us));
    setNumProp(cx.iso, cx.ctx, obj, "duration_us", @floatFromInt(s.duration_us));
    setNumProp(cx.iso, cx.ctx, obj, "frame", @floatFromInt(s.frame));
    setNumProp(cx.iso, cx.ctx, obj, "total_frames", @floatFromInt(s.total_frames));
    setNumProp(cx.iso, cx.ctx, obj, "speed", s.speed);
    setBoolProp(cx.iso, cx.ctx, obj, "at_end", s.at_end);
    setBoolProp(cx.iso, cx.ctx, obj, "at_start", s.at_start);
    info.getReturnValue().set(obj.toValue());
}

fn hostRecStart(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const rows = vterm_mod.getRows();
    const cols = vterm_mod.getCols();
    vterm_mod.startRecording(rows, cols);
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostRecStop(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    vterm_mod.stopRecording();
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostRecToggle(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (vterm_mod.isRecording()) {
        vterm_mod.stopRecording();
    } else {
        vterm_mod.startRecording(vterm_mod.getRows(), vterm_mod.getCols());
    }
    setReturnNum(info, callbackCtx(info).iso, if (vterm_mod.isRecording()) 1 else 0);
}

fn hostRecSave(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const path = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnNum(info, cx.iso, 0);
    defer std.heap.page_allocator.free(path);
    const ok = vterm_mod.saveRecording(path);
    setReturnNum(info, cx.iso, if (ok) 1 else 0);
}

fn hostRecIsRecording(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNum(info, callbackCtx(info).iso, if (vterm_mod.isRecording()) 1 else 0);
}

fn hostRecFrameCount(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNum(info, callbackCtx(info).iso, @floatFromInt(vterm_mod.getRecorder().frame_count));
}

fn hostClaudeInit(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnBool(info, cx.iso, false);
    if (g_claude_session != null) return setReturnBool(info, cx.iso, true);

    const cwd = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(cwd);
    var model: ?[]const u8 = null;
    var resume_session: ?[]const u8 = null;
    if (info.length() >= 2) model = jsStringArg(std.heap.page_allocator, info, 1) orelse null;
    defer if (model) |m| std.heap.page_allocator.free(m);
    if (info.length() >= 3) {
        resume_session = jsStringArg(std.heap.page_allocator, info, 2) orelse null;
        if (resume_session) |sid| {
            if (sid.len == 0) {
                std.heap.page_allocator.free(sid);
                resume_session = null;
            }
        }
    }
    defer if (resume_session) |sid| std.heap.page_allocator.free(sid);

    const opts = claude_sdk.SessionOptions{
        .cwd = cwd,
        .model = model,
        .resume_session = resume_session,
        .verbose = true,
        .permission_mode = .bypass_permissions,
        .inherit_stderr = true,
    };
    const sess = claude_sdk.Session.init(std.heap.c_allocator, opts) catch return setReturnBool(info, cx.iso, false);
    g_claude_session = sess;
    setReturnBool(info, cx.iso, true);
}

fn hostClaudeSend(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1 or g_claude_session == null) return setReturnBool(info, cx.iso, false);
    const text = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(text);
    g_claude_session.?.send(text) catch return setReturnBool(info, cx.iso, false);
    setReturnBool(info, cx.iso, true);
}

fn hostClaudePoll(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (g_claude_session == null) return setReturnUndefined(info, cx.iso);
    var owned = (g_claude_session.?.poll() catch return setReturnUndefined(info, cx.iso)) orelse {
        if (g_claude_session.?.closed) {
            g_claude_session.?.deinit();
            g_claude_session = null;
        }
        return setReturnUndefined(info, cx.iso);
    };
    defer owned.deinit();
    const obj = claudeMessageToJs(cx.iso, cx.ctx, owned.msg);
    info.getReturnValue().set(obj.toValue());
}

fn hostClaudeClose(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (g_claude_session) |*sess| {
        sess.close() catch {};
        sess.deinit();
        g_claude_session = null;
    }
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostKimiInit(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnBool(info, cx.iso, false);
    if (g_kimi_session != null) return setReturnBool(info, cx.iso, true);

    const cwd = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(cwd);
    var model: ?[]const u8 = null;
    var session_id: ?[]const u8 = null;
    if (info.length() >= 2) model = jsStringArg(std.heap.page_allocator, info, 1) orelse null;
    defer if (model) |m| std.heap.page_allocator.free(m);
    if (info.length() >= 3) {
        session_id = jsStringArg(std.heap.page_allocator, info, 2) orelse null;
        if (session_id) |sid| {
            if (sid.len == 0) {
                std.heap.page_allocator.free(sid);
                session_id = null;
            }
        }
    }
    defer if (session_id) |sid| std.heap.page_allocator.free(sid);

    const opts = kimi_wire_sdk.SessionOptions{
        .cwd = cwd,
        .model = model,
        .session_id = session_id,
        .yolo = true,
        .inherit_stderr = true,
    };
    var sess = kimi_wire_sdk.Session.init(std.heap.c_allocator, opts) catch return setReturnBool(info, cx.iso, false);
    var init_result = sess.initialize(.{}) catch {
        sess.deinit();
        return setReturnBool(info, cx.iso, false);
    };
    defer init_result.deinit();
    kimiResetTurnBuffers();
    g_kimi_session = sess;
    setReturnBool(info, cx.iso, true);
}

fn hostKimiSend(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1 or g_kimi_session == null) return setReturnBool(info, cx.iso, false);
    const text = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(text);
    kimiResetTurnBuffers();
    var token = g_kimi_session.?.prompt(.{ .text = text }) catch {
        if (g_kimi_session) |*sess| {
            sess.deinit();
            g_kimi_session = null;
        }
        kimiDeinitTurnBuffers();
        return setReturnBool(info, cx.iso, false);
    };
    token.deinit();
    setReturnBool(info, cx.iso, true);
}

fn hostKimiPoll(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (g_kimi_session == null) return setReturnUndefined(info, cx.iso);
    var owned = (g_kimi_session.?.poll() catch return setReturnUndefined(info, cx.iso)) orelse {
        if (g_kimi_session.?.closed) {
            g_kimi_session.?.deinit();
            g_kimi_session = null;
            kimiDeinitTurnBuffers();
        }
        return setReturnUndefined(info, cx.iso);
    };
    defer owned.deinit();
    const obj = kimiMessageToJs(cx.iso, cx.ctx, owned.msg);
    info.getReturnValue().set(obj.toValue());
}

fn hostKimiClose(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (g_kimi_session) |*sess| {
        sess.close() catch {};
        sess.deinit();
        g_kimi_session = null;
    }
    kimiDeinitTurnBuffers();
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostLocalAiInit(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 2) return setReturnBool(info, cx.iso, false);
    if (g_local_ai_session != null) return setReturnBool(info, cx.iso, true);

    const cwd = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(cwd);
    const model = jsStringArg(std.heap.page_allocator, info, 1) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(model);
    if (model.len == 0) return setReturnBool(info, cx.iso, false);
    var session_id: ?[]const u8 = null;
    if (info.length() >= 3) {
        session_id = jsStringArg(std.heap.page_allocator, info, 2) orelse null;
        if (session_id) |sid| {
            if (sid.len == 0) {
                std.heap.page_allocator.free(sid);
                session_id = null;
            }
        }
    }
    defer if (session_id) |sid| std.heap.page_allocator.free(sid);

    const opts = local_ai_runtime.SessionOptions{
        .cwd = cwd,
        .model_path = model,
        .session_id = session_id,
        .verbose = false,
    };
    const sess = local_ai_runtime.Session.create(std.heap.c_allocator, opts) catch return setReturnBool(info, cx.iso, false);
    g_local_ai_session = sess;
    setReturnBool(info, cx.iso, true);
}

fn hostLocalAiSend(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1 or g_local_ai_session == null) return setReturnBool(info, cx.iso, false);
    const text = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnBool(info, cx.iso, false);
    defer std.heap.page_allocator.free(text);
    g_local_ai_session.?.submit(.{ .text = text }) catch return setReturnBool(info, cx.iso, false);
    setReturnBool(info, cx.iso, true);
}

fn hostLocalAiPoll(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const sess = g_local_ai_session orelse return setReturnUndefined(info, cx.iso);
    var evt = sess.poll() orelse return setReturnUndefined(info, cx.iso);
    defer evt.deinit();
    const obj = localAiEventToJs(cx.iso, cx.ctx, evt);
    info.getReturnValue().set(obj.toValue());
}

fn hostLocalAiClose(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (g_local_ai_session) |sess| {
        sess.destroy();
        g_local_ai_session = null;
    }
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostIpcConnect(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 2) return setReturnNum(info, cx.iso, 0);
    const port_i = jsI32Arg(info, 0) orelse return setReturnNum(info, cx.iso, 0);
    if (port_i <= 0 or port_i > 65535) return setReturnNum(info, cx.iso, 0);
    const key = jsStringArg(std.heap.page_allocator, info, 1) orelse return setReturnNum(info, cx.iso, 0);
    defer std.heap.page_allocator.free(key);
    const ok = debug_client.connect(@intCast(port_i), key);
    setReturnNum(info, cx.iso, if (ok) 1 else 0);
}

fn hostIpcDisconnect(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    debug_client.disconnect();
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostIpcPoll(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNum(info, callbackCtx(info).iso, if (debug_client.poll()) 1 else 0);
}

fn hostIpcStatus(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const obj = v8.Object.init(cx.iso);
    setNumProp(cx.iso, cx.ctx, obj, "connected", if (debug_client.isConnected()) 1 else 0);
    setNumProp(cx.iso, cx.ctx, obj, "authenticated", if (debug_client.isAuthenticated()) 1 else 0);
    setNumProp(cx.iso, cx.ctx, obj, "awaiting_code", if (debug_client.isAwaitingCode()) 1 else 0);
    info.getReturnValue().set(obj.toValue());
}

fn hostIpcSubmitCode(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnNum(info, cx.iso, 0);
    const code = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnNum(info, cx.iso, 0);
    defer std.heap.page_allocator.free(code);
    const ok = debug_client.submitCode(code);
    setReturnNum(info, cx.iso, if (ok) 1 else 0);
}

fn hostIpcRequest(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return setReturnUndefined(info, callbackCtx(info).iso);
    const method = jsStringArg(std.heap.page_allocator, info, 0) orelse return setReturnUndefined(info, callbackCtx(info).iso);
    defer std.heap.page_allocator.free(method);
    debug_client.request(method);
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostIpcRequestNode(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return setReturnUndefined(info, callbackCtx(info).iso);
    const id = jsI32Arg(info, 0) orelse return setReturnUndefined(info, callbackCtx(info).iso);
    debug_client.requestWithId("debug.node", id);
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostIpcTreeCount(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNum(info, callbackCtx(info).iso, @floatFromInt(debug_client.getTreeNodeCount()));
}

fn hostIpcTreeNode(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnUndefined(info, cx.iso);
    const idx = jsI32Arg(info, 0) orelse return setReturnUndefined(info, cx.iso);
    if (idx < 0) return setReturnUndefined(info, cx.iso);
    const node = debug_client.getTreeNode(@intCast(idx)) orelse return setReturnUndefined(info, cx.iso);
    const obj = v8.Object.init(cx.iso);
    setNumProp(cx.iso, cx.ctx, obj, "index", @floatFromInt(node.index));
    setNumProp(cx.iso, cx.ctx, obj, "depth", @floatFromInt(node.depth));
    setStrProp(cx.iso, cx.ctx, obj, "tag", node.tag[0..node.tag_len]);
    info.getReturnValue().set(obj.toValue());
}

fn hostIpcResponse(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const resp = debug_client.getLastResponse() orelse return setReturnUndefined(info, cx.iso);
    setReturnString(info, cx.iso, resp);
}

fn hostIpcPerf(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const p = debug_client.getPerf();
    if (!p.valid) return setReturnUndefined(info, cx.iso);
    const obj = v8.Object.init(cx.iso);
    setNumProp(cx.iso, cx.ctx, obj, "fps", @floatFromInt(p.fps));
    setNumProp(cx.iso, cx.ctx, obj, "layout_us", @floatFromInt(p.layout_us));
    setNumProp(cx.iso, cx.ctx, obj, "paint_us", @floatFromInt(p.paint_us));
    setNumProp(cx.iso, cx.ctx, obj, "rects", @floatFromInt(p.rects));
    setNumProp(cx.iso, cx.ctx, obj, "glyphs", @floatFromInt(p.glyphs));
    setNumProp(cx.iso, cx.ctx, obj, "total_nodes", @floatFromInt(p.total_nodes));
    setNumProp(cx.iso, cx.ctx, obj, "visible_nodes", @floatFromInt(p.visible_nodes));
    setNumProp(cx.iso, cx.ctx, obj, "window_w", @floatFromInt(p.window_w));
    setNumProp(cx.iso, cx.ctx, obj, "window_h", @floatFromInt(p.window_h));
    info.getReturnValue().set(obj.toValue());
}

fn hostIpcEnableTelemetry(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    debug_client.enableTelemetryStream();
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostSemState(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const s = semantic.getState();
    const obj = v8.Object.init(cx.iso);
    setNumProp(cx.iso, cx.ctx, obj, "mode", @floatFromInt(@intFromEnum(s.mode)));
    setBoolProp(cx.iso, cx.ctx, obj, "streaming", s.streaming);
    setNumProp(cx.iso, cx.ctx, obj, "streaming_kind", @floatFromInt(@intFromEnum(s.streaming_kind)));
    setBoolProp(cx.iso, cx.ctx, obj, "awaiting_input", s.awaiting_input);
    setBoolProp(cx.iso, cx.ctx, obj, "awaiting_decision", s.awaiting_decision);
    setBoolProp(cx.iso, cx.ctx, obj, "modal_open", s.modal_open);
    setBoolProp(cx.iso, cx.ctx, obj, "interrupt_pending", s.interrupt_pending);
    setNumProp(cx.iso, cx.ctx, obj, "turn_count", @floatFromInt(s.turn_count));
    setNumProp(cx.iso, cx.ctx, obj, "current_turn_id", @floatFromInt(s.current_turn_id));
    setNumProp(cx.iso, cx.ctx, obj, "node_count", @floatFromInt(s.node_count));
    setNumProp(cx.iso, cx.ctx, obj, "group_count", @floatFromInt(s.group_count));
    setStrProp(cx.iso, cx.ctx, obj, "mode_name", @tagName(s.mode));
    setStrProp(cx.iso, cx.ctx, obj, "streaming_kind_name", @tagName(s.streaming_kind));
    info.getReturnValue().set(obj.toValue());
}

fn hostSemNodeCount(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNum(info, callbackCtx(info).iso, @floatFromInt(semantic.nodeCount()));
}

fn hostSemNode(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnUndefined(info, cx.iso);
    const idx = jsI32Arg(info, 0) orelse return setReturnUndefined(info, cx.iso);
    if (idx < 0) return setReturnUndefined(info, cx.iso);
    const node = semantic.getNode(@intCast(idx)) orelse return setReturnUndefined(info, cx.iso);
    const obj = v8.Object.init(cx.iso);
    setStrProp(cx.iso, cx.ctx, obj, "kind", @tagName(node.kind));
    setStrProp(cx.iso, cx.ctx, obj, "role", @tagName(node.role));
    setStrProp(cx.iso, cx.ctx, obj, "lane", @tagName(node.lane));
    setStrProp(cx.iso, cx.ctx, obj, "scope", @tagName(node.scope));
    setNumProp(cx.iso, cx.ctx, obj, "turn_id", @floatFromInt(node.turn_id));
    setNumProp(cx.iso, cx.ctx, obj, "group_id", @floatFromInt(node.group_id));
    setNumProp(cx.iso, cx.ctx, obj, "row_start", @floatFromInt(node.row_start));
    setNumProp(cx.iso, cx.ctx, obj, "row_end", @floatFromInt(node.row_end));
    setNumProp(cx.iso, cx.ctx, obj, "row_count", @floatFromInt(node.row_count));
    setNumProp(cx.iso, cx.ctx, obj, "children_count", @floatFromInt(node.children_count));
    setBoolProp(cx.iso, cx.ctx, obj, "active", node.active);
    if (node.row_count > 0) {
        const text = vterm_mod.getRowText(node.row_start);
        setStrProp(cx.iso, cx.ctx, obj, "text", text);
    }
    info.getReturnValue().set(obj.toValue());
}

fn hostSemCacheCount(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNum(info, callbackCtx(info).iso, @floatFromInt(semantic.cacheCount()));
}

fn hostSemCacheEntry(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnUndefined(info, cx.iso);
    const idx = jsI32Arg(info, 0) orelse return setReturnUndefined(info, cx.iso);
    if (idx < 0) return setReturnUndefined(info, cx.iso);
    const entry = semantic.getCacheEntry(@intCast(idx)) orelse return setReturnUndefined(info, cx.iso);
    const obj = v8.Object.init(cx.iso);
    setNumProp(cx.iso, cx.ctx, obj, "row", @floatFromInt(entry.row));
    setStrProp(cx.iso, cx.ctx, obj, "kind", @tagName(entry.kind));
    setNumProp(cx.iso, cx.ctx, obj, "turn_id", @floatFromInt(entry.turn_id));
    setNumProp(cx.iso, cx.ctx, obj, "group_id", @floatFromInt(entry.group_id));
    setStrProp(cx.iso, cx.ctx, obj, "text", vterm_mod.getRowText(entry.row));
    info.getReturnValue().set(obj.toValue());
}

fn hostSemRowToken(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnUndefined(info, cx.iso);
    const row = jsI32Arg(info, 0) orelse return setReturnUndefined(info, cx.iso);
    if (row < 0) return setReturnUndefined(info, cx.iso);
    setReturnString(info, cx.iso, @tagName(classifier.getRowToken(@intCast(row))));
}

fn hostSemRowText(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    if (info.length() < 1) return setReturnUndefined(info, cx.iso);
    const row = jsI32Arg(info, 0) orelse return setReturnUndefined(info, cx.iso);
    if (row < 0) return setReturnUndefined(info, cx.iso);
    setReturnString(info, cx.iso, vterm_mod.getRowText(@intCast(row)));
}

fn hostSemTree(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    var buf: [4096]u8 = undefined;
    const tree = semantic.formatTree(&buf);
    setReturnString(info, callbackCtx(info).iso, tree);
}

fn hostSemSetMode(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 1) return setReturnUndefined(info, callbackCtx(info).iso);
    const mode = jsI32Arg(info, 0) orelse return setReturnUndefined(info, callbackCtx(info).iso);
    classifier.setMode(switch (mode) {
        1 => .basic,
        2 => .claude_code,
        3 => .json,
        else => .none,
    });
    classifier.markDirty();
    setReturnUndefined(info, callbackCtx(info).iso);
}

fn hostSemHasDiff(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNum(info, callbackCtx(info).iso, if (semantic.hasDiff()) 1 else 0);
}

fn hostSemFrame(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNum(info, callbackCtx(info).iso, @floatFromInt(semantic.getFrame()));
}

fn hostSemExport(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const count = semantic.cacheCount();
    const arr = v8.Array.init(cx.iso, @intCast(count));
    var i: u16 = 0;
    while (i < count) : (i += 1) {
        const entry = semantic.getCacheEntry(i) orelse continue;
        const obj = v8.Object.init(cx.iso);
        setNumProp(cx.iso, cx.ctx, obj, "row", @floatFromInt(entry.row));
        setStrProp(cx.iso, cx.ctx, obj, "kind", @tagName(entry.kind));
        setNumProp(cx.iso, cx.ctx, obj, "turn_id", @floatFromInt(entry.turn_id));
        setNumProp(cx.iso, cx.ctx, obj, "group_id", @floatFromInt(entry.group_id));
        setStrProp(cx.iso, cx.ctx, obj, "text", vterm_mod.getRowText(entry.row));
        const tc = classifier.tokenColor(entry.kind);
        var hex_buf: [8]u8 = undefined;
        const hex = std.fmt.bufPrint(&hex_buf, "#{x:0>2}{x:0>2}{x:0>2}", .{ tc.r, tc.g, tc.b }) catch "#e2e8f0";
        setStrProp(cx.iso, cx.ctx, obj, "color", hex);
        _ = arr.castTo(v8.Object).setValueAtIndex(cx.ctx, @intCast(i), obj.toValue());
    }
    info.getReturnValue().set(arr.toValue());
}

fn hostSemSnapshot(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    const root = v8.Object.init(cx.iso);
    setNumProp(cx.iso, cx.ctx, root, "version", 1.0);
    const cls_name = switch (classifier.getMode()) {
        .none => "none",
        .basic => "basic",
        .claude_code => "claude_code",
        .json => "json",
    };
    setStrProp(cx.iso, cx.ctx, root, "classifier", cls_name);
    setNumProp(cx.iso, cx.ctx, root, "frame", @floatFromInt(semantic.getFrame()));

    const s = semantic.getState();
    const st = v8.Object.init(cx.iso);
    setStrProp(cx.iso, cx.ctx, st, "mode", @tagName(s.mode));
    setBoolProp(cx.iso, cx.ctx, st, "streaming", s.streaming);
    setStrProp(cx.iso, cx.ctx, st, "streaming_kind", @tagName(s.streaming_kind));
    setBoolProp(cx.iso, cx.ctx, st, "awaiting_input", s.awaiting_input);
    setBoolProp(cx.iso, cx.ctx, st, "awaiting_decision", s.awaiting_decision);
    setBoolProp(cx.iso, cx.ctx, st, "modal_open", s.modal_open);
    setBoolProp(cx.iso, cx.ctx, st, "interrupt_pending", s.interrupt_pending);
    setNumProp(cx.iso, cx.ctx, st, "turn_count", @floatFromInt(s.turn_count));
    setNumProp(cx.iso, cx.ctx, st, "current_turn_id", @floatFromInt(s.current_turn_id));
    setNumProp(cx.iso, cx.ctx, st, "node_count", @floatFromInt(s.node_count));
    setNumProp(cx.iso, cx.ctx, st, "group_count", @floatFromInt(s.group_count));
    _ = root.setValue(cx.ctx, v8.String.initUtf8(cx.iso, "state"), st.toValue());

    const count = semantic.cacheCount();
    const rows = v8.Array.init(cx.iso, @intCast(count));
    var i: u16 = 0;
    while (i < count) : (i += 1) {
        const entry = semantic.getCacheEntry(i) orelse continue;
        const obj = v8.Object.init(cx.iso);
        setNumProp(cx.iso, cx.ctx, obj, "row", @floatFromInt(entry.row));
        setStrProp(cx.iso, cx.ctx, obj, "kind", @tagName(entry.kind));
        setStrProp(cx.iso, cx.ctx, obj, "role", @tagName(semantic.roleOf(entry.kind)));
        setStrProp(cx.iso, cx.ctx, obj, "lane", @tagName(semantic.laneOf(entry.kind)));
        setNumProp(cx.iso, cx.ctx, obj, "turn_id", @floatFromInt(entry.turn_id));
        setNumProp(cx.iso, cx.ctx, obj, "group_id", @floatFromInt(entry.group_id));
        setStrProp(cx.iso, cx.ctx, obj, "text", vterm_mod.getRowText(entry.row));
        const tc = classifier.tokenColor(entry.kind);
        var hb: [8]u8 = undefined;
        const hx = std.fmt.bufPrint(&hb, "#{x:0>2}{x:0>2}{x:0>2}", .{ tc.r, tc.g, tc.b }) catch "#e2e8f0";
        setStrProp(cx.iso, cx.ctx, obj, "color", hx);
        _ = rows.castTo(v8.Object).setValueAtIndex(cx.ctx, @intCast(i), obj.toValue());
    }
    _ = root.setValue(cx.ctx, v8.String.initUtf8(cx.iso, "rows"), rows.toValue());

    const g = v8.Object.init(cx.iso);
    setNumProp(cx.iso, cx.ctx, g, "node_count", @floatFromInt(semantic.nodeCount()));
    setNumProp(cx.iso, cx.ctx, g, "turn_count", @floatFromInt(s.turn_count));
    var tree_buf: [4096]u8 = undefined;
    setStrProp(cx.iso, cx.ctx, g, "tree", semantic.formatTree(&tree_buf));
    _ = root.setValue(cx.ctx, v8.String.initUtf8(cx.iso, "graph"), g.toValue());

    info.getReturnValue().set(root.toValue());
}

fn hostSemSetRowToken(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    if (info.length() < 2) return setReturnUndefined(info, callbackCtx(info).iso);
    const cx = callbackCtx(info);
    const row = jsI32Arg(info, 0) orelse return setReturnUndefined(info, cx.iso);
    if (row < 0) return setReturnUndefined(info, cx.iso);
    const name = jsStringArg(std.heap.page_allocator, info, 1) orelse return setReturnUndefined(info, cx.iso);
    defer std.heap.page_allocator.free(name);
    classifier.setRowToken(@intCast(row), classifier.tokenFromName(name));
    setReturnUndefined(info, cx.iso);
}

fn hostSemVtermRows(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    setReturnNum(info, callbackCtx(info).iso, @floatFromInt(vterm_mod.getRows()));
}

fn hostSemBuildGraph(info_c: ?*const v8.c.FunctionCallbackInfo) callconv(.c) void {
    const info = v8.FunctionCallbackInfo.initFromV8(info_c);
    const cx = callbackCtx(info);
    var rows: i32 = 0;
    if (info.length() >= 1) rows = jsI32Arg(info, 0) orelse 0;
    if (rows <= 0) rows = @intCast(vterm_mod.getRows());
    semantic.tick(@intCast(rows));
    setReturnUndefined(info, cx.iso);
}

fn emitChannelPayload(channel: []const u8, payload: []const u8) void {
    const alloc = std.heap.page_allocator;
    var out = std.ArrayList(u8){};
    defer out.deinit(alloc);
    out.appendSlice(alloc, "if (globalThis.__ffiEmit) __ffiEmit(") catch return;
    jsonEscape(&out, alloc, channel) catch return;
    out.append(alloc, ',') catch return;
    jsonEscape(&out, alloc, payload) catch return;
    out.appendSlice(alloc, ");") catch return;
    v8rt.evalScript(out.items);
}

// Call this from the V8 app's main loop per tick.
pub fn tickDrain() void {
    if (g_http_init_done) {
        var buf: [8]net_http.Response = undefined;
        const n = net_http.poll(&buf);
        const alloc = std.heap.page_allocator;
        for (buf[0..n]) |resp| {
            const rid = httpPending().fetchRemove(resp.id) orelse continue;
            defer alloc.free(rid.value);
            const payload = buildHttpRespJson(&resp, alloc) catch continue;
            defer alloc.free(payload);

            var ch_buf: [256]u8 = undefined;
            const ch = std.fmt.bufPrint(&ch_buf, "http:{s}", .{rid.value}) catch continue;
            emitChannelPayload(ch, payload);
        }
    }

    if (g_page_fetch_init_done) {
        var buf: [8]page_fetch.Response = undefined;
        const n = page_fetch.poll(&buf);
        const alloc = std.heap.page_allocator;
        for (buf[0..n]) |resp| {
            const rid = pagePending().fetchRemove(resp.id) orelse continue;
            defer alloc.free(rid.value);
            const payload = buildPageRespJson(&resp, alloc) catch continue;
            defer alloc.free(payload);

            var ch_buf: [256]u8 = undefined;
            const ch = std.fmt.bufPrint(&ch_buf, "browser-page:{s}", .{rid.value}) catch continue;
            emitChannelPayload(ch, payload);
        }
    }
}

pub fn registerSdk(vm: anytype) void {
    _ = vm;
    v8rt.registerHostFn("__fetch", hostFetch);
    v8rt.registerHostFn("__http_request_sync", hostHttpRequestSync);
    v8rt.registerHostFn("__http_request_async", hostHttpRequestAsync);
    v8rt.registerHostFn("__browser_page_sync", hostBrowserPageSync);
    v8rt.registerHostFn("__browser_page_async", hostBrowserPageAsync);
    v8rt.registerHostFn("__play_load", hostPlayLoad);
    v8rt.registerHostFn("__play_play", hostPlayPlay);
    v8rt.registerHostFn("__play_pause", hostPlayPause);
    v8rt.registerHostFn("__play_toggle", hostPlayToggle);
    v8rt.registerHostFn("__play_seek", hostPlaySeek);
    v8rt.registerHostFn("__play_step", hostPlayStep);
    v8rt.registerHostFn("__play_speed", hostPlaySpeed);
    v8rt.registerHostFn("__play_state", hostPlayState);
    v8rt.registerHostFn("__rec_start", hostRecStart);
    v8rt.registerHostFn("__rec_stop", hostRecStop);
    v8rt.registerHostFn("__rec_toggle", hostRecToggle);
    v8rt.registerHostFn("__rec_save", hostRecSave);
    v8rt.registerHostFn("__rec_is_recording", hostRecIsRecording);
    v8rt.registerHostFn("__rec_frame_count", hostRecFrameCount);
    v8rt.registerHostFn("__claude_init", hostClaudeInit);
    v8rt.registerHostFn("__claude_send", hostClaudeSend);
    v8rt.registerHostFn("__claude_poll", hostClaudePoll);
    v8rt.registerHostFn("__claude_close", hostClaudeClose);
    v8rt.registerHostFn("__kimi_init", hostKimiInit);
    v8rt.registerHostFn("__kimi_send", hostKimiSend);
    v8rt.registerHostFn("__kimi_poll", hostKimiPoll);
    v8rt.registerHostFn("__kimi_close", hostKimiClose);
    v8rt.registerHostFn("__localai_init", hostLocalAiInit);
    v8rt.registerHostFn("__localai_send", hostLocalAiSend);
    v8rt.registerHostFn("__localai_poll", hostLocalAiPoll);
    v8rt.registerHostFn("__localai_close", hostLocalAiClose);
    v8rt.registerHostFn("__ipc_connect", hostIpcConnect);
    v8rt.registerHostFn("__ipc_disconnect", hostIpcDisconnect);
    v8rt.registerHostFn("__ipc_status", hostIpcStatus);
    v8rt.registerHostFn("__ipc_perf", hostIpcPerf);
    v8rt.registerHostFn("__ipc_poll", hostIpcPoll);
    v8rt.registerHostFn("__ipc_enable_telemetry", hostIpcEnableTelemetry);
    v8rt.registerHostFn("__ipc_request", hostIpcRequest);
    v8rt.registerHostFn("__ipc_request_node", hostIpcRequestNode);
    v8rt.registerHostFn("__ipc_response", hostIpcResponse);
    v8rt.registerHostFn("__ipc_submit_code", hostIpcSubmitCode);
    v8rt.registerHostFn("__ipc_tree_count", hostIpcTreeCount);
    v8rt.registerHostFn("__ipc_tree_node", hostIpcTreeNode);
    v8rt.registerHostFn("__sem_build_graph", hostSemBuildGraph);
    v8rt.registerHostFn("__sem_cache_count", hostSemCacheCount);
    v8rt.registerHostFn("__sem_cache_entry", hostSemCacheEntry);
    v8rt.registerHostFn("__sem_export", hostSemExport);
    v8rt.registerHostFn("__sem_frame", hostSemFrame);
    v8rt.registerHostFn("__sem_has_diff", hostSemHasDiff);
    v8rt.registerHostFn("__sem_node_count", hostSemNodeCount);
    v8rt.registerHostFn("__sem_node", hostSemNode);
    v8rt.registerHostFn("__sem_row_text", hostSemRowText);
    v8rt.registerHostFn("__sem_row_token", hostSemRowToken);
    v8rt.registerHostFn("__sem_set_mode", hostSemSetMode);
    v8rt.registerHostFn("__sem_set_row_token", hostSemSetRowToken);
    v8rt.registerHostFn("__sem_snapshot", hostSemSnapshot);
    v8rt.registerHostFn("__sem_state", hostSemState);
    v8rt.registerHostFn("__sem_tree", hostSemTree);
    v8rt.registerHostFn("__sem_vterm_rows", hostSemVtermRows);
}
