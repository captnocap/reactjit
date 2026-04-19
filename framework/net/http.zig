//! HTTP/HTTPS client — libcurl worker pool with ring buffer communication.
//!
//! Port of love2d/lua/http.lua. Same architecture: worker threads block on
//! curl_easy_perform(), main thread polls responses each frame.
//!
//! Usage from generated code:
//!   const http = @import("net/http.zig");
//!   http.init();
//!   http.request(1, .{ .url = "https://example.com" });
//!   // each frame:
//!   var responses: [16]http.Response = undefined;
//!   const n = http.poll(&responses);
//!   for (responses[0..n]) |resp| { ... }
//!   // on shutdown:
//!   http.destroy();

const std = @import("std");
const RingBuffer = @import("ring_buffer.zig").RingBuffer;
const c = @cImport({ @cInclude("curl/curl.h"); });

// ── Configuration ────────────────────────────────────────────────────────

const MAX_WORKERS = 4;
const MAX_URL = 2048;
const MAX_HEADERS = 16;
const MAX_HEADER_LEN = 512;
const MAX_REQ_BODY = 16384; // 16KB request body
const MAX_BODY = 65536; // 64KB response body limit
const MAX_ERROR = 256;
const QUEUE_SIZE = 16;

// ── Public types ─────────────────────────────────────────────────────────

pub const Method = enum { GET, POST, PUT, DELETE, PATCH, HEAD };

pub const RequestOpts = struct {
    url: []const u8,
    method: Method = .GET,
    headers: ?[]const [2][]const u8 = null, // key-value pairs
    body: ?[]const u8 = null,
    proxy: ?[]const u8 = null,
};

pub const ResponseType = enum { complete, chunk, progress, err };

pub const Response = struct {
    id: u32 = 0,
    status: u16 = 0,
    body: [MAX_BODY]u8 = undefined,
    body_len: usize = 0,
    truncated: bool = false, // true if response body exceeded MAX_BODY
    response_type: ResponseType = .complete,
    error_msg: [MAX_ERROR]u8 = undefined,
    error_len: usize = 0,

    pub fn bodySlice(self: *const Response) []const u8 {
        return self.body[0..self.body_len];
    }

    pub fn errorSlice(self: *const Response) []const u8 {
        return self.error_msg[0..self.error_len];
    }
};

// Internal request struct (fixed-size, goes through ring buffer)
const Request = struct {
    id: u32 = 0,
    url: [MAX_URL]u8 = undefined,
    url_len: usize = 0,
    method: Method = .GET,
    header_keys: [MAX_HEADERS][MAX_HEADER_LEN]u8 = undefined,
    header_vals: [MAX_HEADERS][MAX_HEADER_LEN]u8 = undefined,
    header_key_lens: [MAX_HEADERS]usize = undefined,
    header_val_lens: [MAX_HEADERS]usize = undefined,
    header_count: usize = 0,
    body: [MAX_REQ_BODY]u8 = undefined,
    body_len: usize = 0,
    proxy: [MAX_URL]u8 = undefined,
    proxy_len: usize = 0,
    shutdown: bool = false, // sentinel to tell worker to exit
};

// ── Module state ─────────────────────────────────────────────────────────

var request_queue: RingBuffer(Request, QUEUE_SIZE) = .{};
var response_queue: RingBuffer(Response, QUEUE_SIZE) = .{};
var workers: [MAX_WORKERS]?std.Thread = .{ null, null, null, null };
var initialized = false;

// ── Public API ───────────────────────────────────────────────────────────

/// Initialize the HTTP client. Spawns worker threads.
pub fn init() void {
    if (initialized) return;
    _ = c.curl_global_init(c.CURL_GLOBAL_ALL);
    for (0..MAX_WORKERS) |i| {
        workers[i] = std.Thread.spawn(.{}, workerMain, .{}) catch null;
    }
    initialized = true;
}

/// Queue an HTTP request. Non-blocking. Returns false if queue is full.
pub fn request(id: u32, opts: RequestOpts) bool {
    var req = Request{};
    req.id = id;

    // Copy URL
    const url_len = @min(opts.url.len, MAX_URL);
    @memcpy(req.url[0..url_len], opts.url[0..url_len]);
    req.url_len = url_len;

    req.method = opts.method;

    // Copy headers
    if (opts.headers) |hdrs| {
        for (hdrs, 0..) |kv, i| {
            if (i >= MAX_HEADERS) break;
            const klen = @min(kv[0].len, MAX_HEADER_LEN);
            const vlen = @min(kv[1].len, MAX_HEADER_LEN);
            @memcpy(req.header_keys[i][0..klen], kv[0][0..klen]);
            @memcpy(req.header_vals[i][0..vlen], kv[1][0..vlen]);
            req.header_key_lens[i] = klen;
            req.header_val_lens[i] = vlen;
            req.header_count += 1;
        }
    }

    // Copy body
    if (opts.body) |body| {
        const blen = @min(body.len, MAX_REQ_BODY);
        @memcpy(req.body[0..blen], body[0..blen]);
        req.body_len = blen;
    }

    // Copy proxy (explicit or resolved from env)
    if (opts.proxy) |proxy| {
        const plen = @min(proxy.len, MAX_URL);
        @memcpy(req.proxy[0..plen], proxy[0..plen]);
        req.proxy_len = plen;
    } else {
        // Try environment proxy
        const env_proxy = resolveProxy(opts.url[0..url_len]);
        if (env_proxy) |ep| {
            const plen = @min(ep.len, MAX_URL);
            @memcpy(req.proxy[0..plen], ep[0..plen]);
            req.proxy_len = plen;
        }
    }

    return request_queue.push(req);
}

/// Poll for completed responses. Non-blocking — returns count.
pub fn poll(out: []Response) usize {
    return response_queue.drain(out);
}

/// Shutdown all workers and cleanup.
pub fn destroy() void {
    if (!initialized) return;
    // Send shutdown sentinels — retry until all are queued
    var sent: usize = 0;
    while (sent < MAX_WORKERS) {
        var sentinel = Request{};
        sentinel.shutdown = true;
        if (request_queue.push(sentinel)) {
            sent += 1;
        } else {
            // Queue full — drain responses to make room
            var discard: [16]Response = undefined;
            _ = response_queue.drain(&discard);
            std.Thread.sleep(1_000_000); // 1ms
        }
    }
    // Join all threads
    for (0..MAX_WORKERS) |i| {
        if (workers[i]) |t| t.join();
        workers[i] = null;
    }
    c.curl_global_cleanup();
    initialized = false;
}

// ── Worker thread ────────────────────────────────────────────────────────

fn workerMain() void {
    const handle = c.curl_easy_init() orelse return;
    defer c.curl_easy_cleanup(handle);

    while (true) {
        // Spin-wait for a request (workers are cheap — they sleep most of the time)
        const req = blk: {
            while (true) {
                if (request_queue.pop()) |r| break :blk r;
                std.Thread.sleep(1_000_000); // 1ms
            }
        };

        if (req.shutdown) return;

        // Execute the request
        var resp = Response{};
        resp.id = req.id;
        executeRequest(handle, &req, &resp);
        // Retry push until response is queued (don't drop responses)
        while (!response_queue.push(resp)) {
            std.Thread.sleep(1_000_000); // 1ms backoff
        }
    }
}

fn executeRequest(handle: *c.CURL, req: *const Request, resp: *Response) void {
    // URL (needs null terminator)
    var url_buf: [MAX_URL + 1]u8 = undefined;
    @memcpy(url_buf[0..req.url_len], req.url[0..req.url_len]);
    url_buf[req.url_len] = 0;
    _ = c.curl_easy_setopt(handle, c.CURLOPT_URL, @as([*c]const u8, &url_buf));

    // Method
    switch (req.method) {
        .GET => _ = c.curl_easy_setopt(handle, c.CURLOPT_HTTPGET, @as(c_long, 1)),
        .POST => _ = c.curl_easy_setopt(handle, c.CURLOPT_POST, @as(c_long, 1)),
        .PUT => _ = c.curl_easy_setopt(handle, c.CURLOPT_CUSTOMREQUEST, @as([*c]const u8, "PUT")),
        .DELETE => _ = c.curl_easy_setopt(handle, c.CURLOPT_CUSTOMREQUEST, @as([*c]const u8, "DELETE")),
        .PATCH => _ = c.curl_easy_setopt(handle, c.CURLOPT_CUSTOMREQUEST, @as([*c]const u8, "PATCH")),
        .HEAD => {
            _ = c.curl_easy_setopt(handle, c.CURLOPT_NOBODY, @as(c_long, 1));
            _ = c.curl_easy_setopt(handle, c.CURLOPT_CUSTOMREQUEST, @as([*c]const u8, "HEAD"));
        },
    }

    // Request body
    if (req.body_len > 0) {
        _ = c.curl_easy_setopt(handle, c.CURLOPT_POSTFIELDSIZE, @as(c_long, @intCast(req.body_len)));
        _ = c.curl_easy_setopt(handle, c.CURLOPT_POSTFIELDS, @as([*c]const u8, &req.body));
    }

    // Headers
    var header_list: ?*c.curl_slist = null;
    if (req.header_count > 0) {
        for (0..req.header_count) |i| {
            var hdr_buf: [MAX_HEADER_LEN * 2 + 4]u8 = undefined;
            const klen = req.header_key_lens[i];
            const vlen = req.header_val_lens[i];
            @memcpy(hdr_buf[0..klen], req.header_keys[i][0..klen]);
            hdr_buf[klen] = ':';
            hdr_buf[klen + 1] = ' ';
            @memcpy(hdr_buf[klen + 2 .. klen + 2 + vlen], req.header_vals[i][0..vlen]);
            hdr_buf[klen + 2 + vlen] = 0;
            header_list = c.curl_slist_append(header_list, @as([*c]const u8, &hdr_buf));
        }
        _ = c.curl_easy_setopt(handle, c.CURLOPT_HTTPHEADER, header_list);
    }

    // Proxy
    if (req.proxy_len > 0) {
        var proxy_buf: [MAX_URL + 1]u8 = undefined;
        @memcpy(proxy_buf[0..req.proxy_len], req.proxy[0..req.proxy_len]);
        proxy_buf[req.proxy_len] = 0;
        _ = c.curl_easy_setopt(handle, c.CURLOPT_PROXY, @as([*c]const u8, &proxy_buf));
    }

    // Follow redirects
    _ = c.curl_easy_setopt(handle, c.CURLOPT_FOLLOWLOCATION, @as(c_long, 1));
    _ = c.curl_easy_setopt(handle, c.CURLOPT_MAXREDIRS, @as(c_long, 10));

    // Timeout
    _ = c.curl_easy_setopt(handle, c.CURLOPT_TIMEOUT, @as(c_long, 30));

    // Write callback — accumulate response body, flag truncation
    const WriteCtx = struct {
        body: [*]u8,
        len: *usize,
        truncated: *bool,
    };
    var write_ctx = WriteCtx{ .body = &resp.body, .len = &resp.body_len, .truncated = &resp.truncated };

    const write_cb = struct {
        fn cb(data: [*c]u8, size: usize, nmemb: usize, userdata: *anyopaque) callconv(.c) usize {
            const ctx: *WriteCtx = @ptrCast(@alignCast(userdata));
            const total = size * nmemb;
            const space = MAX_BODY - ctx.len.*;
            const to_copy = @min(total, space);
            if (to_copy < total) ctx.truncated.* = true;
            if (to_copy > 0) {
                @memcpy(ctx.body[ctx.len.*..][0..to_copy], data[0..to_copy]);
                ctx.len.* += to_copy;
            }
            return total; // return total to not signal error to curl
        }
    }.cb;

    _ = c.curl_easy_setopt(handle, c.CURLOPT_WRITEFUNCTION, write_cb);
    _ = c.curl_easy_setopt(handle, c.CURLOPT_WRITEDATA, @as(*anyopaque, @ptrCast(&write_ctx)));

    // Execute
    const result = c.curl_easy_perform(handle);

    if (result != c.CURLE_OK) {
        resp.response_type = .err;
        const err_str = c.curl_easy_strerror(result);
        if (err_str) |es| {
            const es_slice = std.mem.span(es);
            const elen = @min(es_slice.len, MAX_ERROR);
            @memcpy(resp.error_msg[0..elen], es_slice[0..elen]);
            resp.error_len = elen;
        }
    } else {
        resp.response_type = .complete;
        var status_code: c_long = 0;
        _ = c.curl_easy_getinfo(handle, c.CURLINFO_RESPONSE_CODE, &status_code);
        resp.status = if (status_code >= 0 and status_code <= 999) @intCast(status_code) else 0;
    }

    // Cleanup
    if (header_list) |hl| c.curl_slist_free_all(hl);

    // Reset handle for reuse
    c.curl_easy_reset(handle);
}

// ── Proxy resolution ─────────────────────────────────────────────────────
// Reference: love2d/lua/http.lua:126-160

fn resolveProxy(url: []const u8) ?[]const u8 {
    // Check NO_PROXY first
    if (std.posix.getenv("NO_PROXY") orelse std.posix.getenv("no_proxy")) |no_proxy| {
        if (no_proxy.len > 0 and !std.mem.eql(u8, no_proxy, "")) {
            // Simplified: if NO_PROXY is "*", skip all proxies
            if (std.mem.eql(u8, no_proxy, "*")) return null;
        }
    }

    // HTTPS
    if (url.len > 8 and std.mem.eql(u8, url[0..8], "https://")) {
        if (std.posix.getenv("HTTPS_PROXY") orelse std.posix.getenv("https_proxy")) |p| {
            if (p.len > 0) return p;
        }
    }

    // HTTP
    if (url.len > 7 and std.mem.eql(u8, url[0..7], "http://")) {
        if (std.posix.getenv("HTTP_PROXY") orelse std.posix.getenv("http_proxy")) |p| {
            if (p.len > 0) return p;
        }
    }

    // Fallback
    if (std.posix.getenv("ALL_PROXY") orelse std.posix.getenv("all_proxy")) |p| {
        if (p.len > 0) return p;
    }

    return null;
}
