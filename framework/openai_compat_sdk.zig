//! OpenAI Chat-Completions compatible SDK for Zig.
//!
//! Speaks `POST {base_url}/chat/completions` with `stream: true`,
//! parses the SSE response, and emits per-token delta events plus a
//! terminal completion event. Same shape covers OpenAI proper, OpenRouter,
//! LMStudio, Ollama (the openai-compat endpoint), and any provider that
//! mirrors the chat completions wire format.
//!
//! HTTP transport is the framework's net_http worker pool — same path
//! the JS-facing __http_stream_open hook uses. Streaming chunks fire on
//! the main thread via v8_bindings_sdk.tickDrain → our HttpZigCallbacks.
//!
//! There is no SDK-side worker thread. Session.enqueue records a pending
//! input; if no request is in flight, it kicks one off immediately;
//! otherwise it queues until the current turn completes.

const std = @import("std");
const net_http = @import("net/http.zig");
const v8_bindings_sdk = @import("v8_bindings_sdk.zig");

pub const SessionOptions = struct {
    /// Base URL minus the path — e.g. "http://localhost:1234/v1" or
    /// "https://api.openai.com/v1". The SDK appends "/chat/completions".
    base_url: []const u8,
    /// Bearer token. Set null for unauthenticated local endpoints.
    api_key: ?[]const u8 = null,
    /// Model id passed in the request body.
    model: []const u8,
    /// Optional initial system prompt.
    system_prompt: ?[]const u8 = null,
};

pub const EventKind = enum { delta, completion, error_ };

pub const Event = struct {
    allocator: std.mem.Allocator,
    kind: EventKind,
    text: ?[]u8 = null,
    is_error: bool = false,

    pub fn deinit(self: *Event) void {
        if (self.text) |t| self.allocator.free(t);
        self.text = null;
    }
};

const Message = struct {
    role: []u8,
    content: []u8,

    fn deinitBoth(self: *Message, allocator: std.mem.Allocator) void {
        allocator.free(self.role);
        allocator.free(self.content);
    }
};

pub const Session = struct {
    allocator: std.mem.Allocator,
    base_url_owned: []u8,
    api_key_owned: ?[]u8 = null,
    model_owned: []u8,
    auth_header: ?[]u8 = null,
    url_owned: []u8,

    messages: std.ArrayList(Message) = .{},

    /// Pending user texts queued behind in-flight requests.
    pending: std.ArrayList([]u8) = .{},
    /// True between request kickoff and the terminal complete/err event.
    in_flight: bool = false,
    /// SSE line-accumulating buffer used by the chunk callback.
    sse_buffer: std.ArrayList(u8) = .{},
    sse_offset: usize = 0,
    /// Accumulated assistant text for the current turn — appended to
    /// messages history when the turn completes.
    pending_assistant: std.ArrayList(u8) = .{},
    /// Outbound event queue drained by the host after each tick.
    inbox: std.ArrayList(Event) = .{},
    /// Body buffer for the in-flight request — must outlive the request.
    body_owned: ?[]u8 = null,

    pub fn init(allocator: std.mem.Allocator, options: SessionOptions) !*Session {
        const self = try allocator.create(Session);
        self.* = .{
            .allocator = allocator,
            .base_url_owned = try allocator.dupe(u8, options.base_url),
            .api_key_owned = if (options.api_key) |k| try allocator.dupe(u8, k) else null,
            .model_owned = try allocator.dupe(u8, options.model),
            .auth_header = blk: {
                if (options.api_key) |k| {
                    break :blk try std.fmt.allocPrint(allocator, "Bearer {s}", .{k});
                }
                break :blk null;
            },
            .url_owned = try std.fmt.allocPrint(allocator, "{s}/chat/completions", .{options.base_url}),
        };
        if (options.system_prompt) |sys| {
            try self.messages.append(allocator, .{
                .role = try allocator.dupe(u8, "system"),
                .content = try allocator.dupe(u8, sys),
            });
        }
        return self;
    }

    pub fn deinit(self: *Session) void {
        for (self.messages.items) |*m| m.deinitBoth(self.allocator);
        self.messages.deinit(self.allocator);
        for (self.pending.items) |p| self.allocator.free(p);
        self.pending.deinit(self.allocator);
        self.sse_buffer.deinit(self.allocator);
        self.pending_assistant.deinit(self.allocator);
        for (self.inbox.items) |*e| e.deinit();
        self.inbox.deinit(self.allocator);
        if (self.body_owned) |b| self.allocator.free(b);
        self.allocator.free(self.base_url_owned);
        if (self.api_key_owned) |k| self.allocator.free(k);
        self.allocator.free(self.model_owned);
        if (self.auth_header) |a| self.allocator.free(a);
        self.allocator.free(self.url_owned);
        self.allocator.destroy(self);
    }

    pub fn enqueue(self: *Session, text: []const u8) !void {
        const dup = try self.allocator.dupe(u8, text);
        errdefer self.allocator.free(dup);
        if (self.in_flight) {
            try self.pending.append(self.allocator, dup);
            return;
        }
        try self.startRequest(dup);
    }

    pub fn drainInbox(self: *Session) ![]Event {
        return self.inbox.toOwnedSlice(self.allocator);
    }

    fn startRequest(self: *Session, text: []u8) !void {
        // Append user message to history (transferring ownership of text).
        try self.messages.append(self.allocator, .{
            .role = try self.allocator.dupe(u8, "user"),
            .content = text,
        });

        self.pending_assistant.clearRetainingCapacity();
        self.sse_buffer.clearRetainingCapacity();
        self.sse_offset = 0;

        if (self.body_owned) |old| {
            self.allocator.free(old);
            self.body_owned = null;
        }
        const body = try buildRequestBodyJson(self.allocator, self.model_owned, self.messages.items);
        self.body_owned = body;

        var headers: [3][2][]const u8 = undefined;
        var nh: usize = 0;
        headers[nh] = .{ "Content-Type", "application/json" };
        nh += 1;
        headers[nh] = .{ "Accept", "text/event-stream" };
        nh += 1;
        if (self.auth_header) |auth| {
            headers[nh] = .{ "Authorization", auth };
            nh += 1;
        }

        const opts = net_http.RequestOpts{
            .url = self.url_owned,
            .method = .POST,
            .headers = headers[0..nh],
            .body = body,
            .stream = true,
        };

        const callbacks = v8_bindings_sdk.HttpZigCallbacks{
            .onChunk = onChunkCb,
            .onEnd = onEndCb,
            .ctx = @ptrCast(self),
        };

        if (v8_bindings_sdk.httpStartZigStream(opts, callbacks) == null) {
            // Roll back the user message — request never started.
            self.popLastMessage();
            self.allocator.free(body);
            self.body_owned = null;
            try self.emitErrorString("net_http.request failed to start");
            return;
        }
        self.in_flight = true;
    }

    fn handleChunk(self: *Session, data: []const u8) void {
        self.sse_buffer.appendSlice(self.allocator, data) catch return;
        while (true) {
            const newline_idx = std.mem.indexOfScalarPos(u8, self.sse_buffer.items, self.sse_offset, '\n') orelse return;
            const raw = self.sse_buffer.items[self.sse_offset..newline_idx];
            const line = std.mem.trimRight(u8, raw, "\r");
            self.sse_offset = newline_idx + 1;

            if (!std.mem.startsWith(u8, line, "data: ")) continue;
            const payload = line[6..];
            if (std.mem.eql(u8, payload, "[DONE]")) continue;

            const content = parseDeltaContentAlloc(self.allocator, payload) catch continue;
            self.pending_assistant.appendSlice(self.allocator, content) catch {
                self.allocator.free(content);
                continue;
            };
            self.pushEvent(.{
                .allocator = self.allocator,
                .kind = .delta,
                .text = content,
            }) catch {
                self.allocator.free(content);
            };
        }
    }

    fn handleEnd(self: *Session, status: u16, err: ?[]const u8) void {
        // Free the body buffer; net_http no longer needs it.
        if (self.body_owned) |b| {
            self.allocator.free(b);
            self.body_owned = null;
        }

        if (err) |msg| {
            self.popLastMessage();
            self.emitErrorString(msg) catch {};
        } else if (status >= 400) {
            self.popLastMessage();
            const summary = std.fmt.allocPrint(self.allocator, "http {d}", .{status}) catch null;
            if (summary) |s| {
                self.emitErrorString(s) catch {};
                self.allocator.free(s);
            }
        } else {
            // Capture the assistant's reply into history.
            if (self.pending_assistant.items.len > 0) {
                const owned = self.pending_assistant.toOwnedSlice(self.allocator) catch null;
                if (owned) |c| {
                    self.messages.append(self.allocator, .{
                        .role = self.allocator.dupe(u8, "assistant") catch "",
                        .content = c,
                    }) catch {
                        self.allocator.free(c);
                    };
                }
            }
            self.pushEvent(.{ .allocator = self.allocator, .kind = .completion }) catch {};
        }

        self.in_flight = false;

        // Kick off the next queued message, if any.
        if (self.pending.items.len > 0) {
            const next = self.pending.orderedRemove(0);
            self.startRequest(next) catch |e| {
                self.allocator.free(next);
                const ename = @errorName(e);
                self.emitErrorString(ename) catch {};
            };
        }
    }

    fn popLastMessage(self: *Session) void {
        if (self.messages.items.len == 0) return;
        var last = self.messages.pop() orelse return;
        last.deinitBoth(self.allocator);
    }

    fn pushEvent(self: *Session, ev: Event) !void {
        try self.inbox.append(self.allocator, ev);
    }

    fn emitErrorString(self: *Session, msg: []const u8) !void {
        const dup = try self.allocator.dupe(u8, msg);
        try self.pushEvent(.{
            .allocator = self.allocator,
            .kind = .error_,
            .text = dup,
            .is_error = true,
        });
    }
};

fn onChunkCb(ctx: *anyopaque, data: []const u8) void {
    const sess: *Session = @ptrCast(@alignCast(ctx));
    sess.handleChunk(data);
}

fn onEndCb(ctx: *anyopaque, status: u16, err: ?[]const u8) void {
    const sess: *Session = @ptrCast(@alignCast(ctx));
    sess.handleEnd(status, err);
}

fn parseDeltaContentAlloc(allocator: std.mem.Allocator, json_str: []const u8) ![]u8 {
    var parsed = try std.json.parseFromSlice(std.json.Value, allocator, json_str, .{});
    defer parsed.deinit();

    const root = parsed.value;
    if (root != .object) return error.NoChoices;
    const choices_val = root.object.get("choices") orelse return error.NoChoices;
    if (choices_val != .array or choices_val.array.items.len == 0) return error.NoChoices;
    const choice = choices_val.array.items[0];
    if (choice != .object) return error.NoChoices;
    const delta_val = choice.object.get("delta") orelse return error.NoDelta;
    if (delta_val != .object) return error.NoDelta;
    const content_val = delta_val.object.get("content") orelse return error.NoContent;
    if (content_val != .string) return error.NoContent;
    return try allocator.dupe(u8, content_val.string);
}

fn buildRequestBodyJson(
    allocator: std.mem.Allocator,
    model: []const u8,
    messages: []const Message,
) ![]u8 {
    var buf: std.ArrayList(u8) = .{};
    errdefer buf.deinit(allocator);
    try buf.appendSlice(allocator, "{\"model\":");
    try jsonEscape(allocator, &buf, model);
    try buf.appendSlice(allocator, ",\"stream\":true,\"messages\":[");
    for (messages, 0..) |msg, i| {
        if (i > 0) try buf.append(allocator, ',');
        try buf.appendSlice(allocator, "{\"role\":");
        try jsonEscape(allocator, &buf, msg.role);
        try buf.appendSlice(allocator, ",\"content\":");
        try jsonEscape(allocator, &buf, msg.content);
        try buf.append(allocator, '}');
    }
    try buf.appendSlice(allocator, "]}");
    return try buf.toOwnedSlice(allocator);
}

fn jsonEscape(allocator: std.mem.Allocator, buf: *std.ArrayList(u8), s: []const u8) !void {
    try buf.append(allocator, '"');
    for (s) |ch| switch (ch) {
        '"' => try buf.appendSlice(allocator, "\\\""),
        '\\' => try buf.appendSlice(allocator, "\\\\"),
        '\n' => try buf.appendSlice(allocator, "\\n"),
        '\r' => try buf.appendSlice(allocator, "\\r"),
        '\t' => try buf.appendSlice(allocator, "\\t"),
        0x00...0x08, 0x0b...0x0c, 0x0e...0x1f => {
            var enc: [6]u8 = undefined;
            const slice = try std.fmt.bufPrint(&enc, "\\u{x:0>4}", .{ch});
            try buf.appendSlice(allocator, slice);
        },
        else => try buf.append(allocator, ch),
    };
    try buf.append(allocator, '"');
}
