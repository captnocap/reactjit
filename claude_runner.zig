//! claude_runner — standalone CLI driver around `framework/claude_sdk`.
//!
//! One spawn = one Session = one user turn. Reads the user prompt from
//! stdin (or `--prompt-file`), spawns a Session via the Zig SDK,
//! sends the prompt, prints every received event as one NDJSON line on
//! stdout, exits when a `result` event arrives (or the subprocess EOFs).
//!
//! Built the same way as bench/zig_layout_runner: source at the repo
//! root so it can `@import("framework/claude_sdk/mod.zig")`, build script
//! in bench/, binary emitted to bench/claude_runner.
//!
//! Build:
//!   zig build-exe claude_runner.zig -O ReleaseFast \
//!       -femit-bin=bench/claude_runner
//!
//! Output event shapes (NDJSON, one per line):
//!   {"type":"system","session_id":"...","model":"...","cwd":"...","tools":[...]}
//!   {"type":"assistant","content":[{"type":"text","text":"..."},
//!                                  {"type":"tool_use","name":"Edit","input":{...}},
//!                                  {"type":"thinking","thinking":"..."}]}
//!   {"type":"user_tool_result","content_json":"..."}
//!   {"type":"result","subtype":"success","num_turns":3,"total_cost_usd":0.01,"duration_ms":1234,"is_error":false}

const std = @import("std");
const claude_sdk = @import("framework/claude_sdk/mod.zig");

const usage =
    \\claude_runner — drive framework/claude_sdk over stdin/stdout
    \\
    \\Reads ONE user prompt (stdin or --prompt-file), spawns a Session,
    \\sends it, prints every received event as NDJSON on stdout, exits on
    \\the first `result` event.
    \\
    \\Flags:
    \\  --cwd <abs-path>            (required) working dir for the claude subprocess
    \\  --system-prompt <text>      override the default system prompt
    \\  --system-prompt-file <path> read system prompt from a file
    \\  --model <id>                e.g. claude-opus-4-7
    \\  --max-turns <n>             cap agentic turns
    \\  --prompt-file <path>        read user prompt from a file (default: stdin)
    \\  --inherit-stderr            forward subprocess stderr (debug aid)
    \\  -h, --help                  this help
    \\
;

const ArgError = error{
    BadArg,
    MissingCwd,
};

const ParsedArgs = struct {
    cwd: []const u8,
    system_prompt: ?[]const u8 = null,
    system_prompt_path: ?[]const u8 = null,
    model: ?[]const u8 = null,
    max_turns: ?u32 = null,
    prompt_path: ?[]const u8 = null,
    inherit_stderr: bool = false,
};

fn parseArgs(allocator: std.mem.Allocator) !ParsedArgs {
    var argv_iter = try std.process.argsWithAllocator(allocator);
    defer argv_iter.deinit();
    _ = argv_iter.next();

    var out = ParsedArgs{ .cwd = "" };
    var saw_cwd = false;

    while (argv_iter.next()) |arg| {
        if (std.mem.eql(u8, arg, "-h") or std.mem.eql(u8, arg, "--help")) {
            try std.fs.File.stdout().writeAll(usage);
            std.process.exit(0);
        } else if (std.mem.eql(u8, arg, "--cwd")) {
            const v = argv_iter.next() orelse return errMsg("--cwd needs a value");
            out.cwd = try allocator.dupe(u8, v);
            saw_cwd = true;
        } else if (std.mem.eql(u8, arg, "--system-prompt")) {
            const v = argv_iter.next() orelse return errMsg("--system-prompt needs a value");
            out.system_prompt = try allocator.dupe(u8, v);
        } else if (std.mem.eql(u8, arg, "--system-prompt-file")) {
            const v = argv_iter.next() orelse return errMsg("--system-prompt-file needs a value");
            out.system_prompt_path = try allocator.dupe(u8, v);
        } else if (std.mem.eql(u8, arg, "--model")) {
            const v = argv_iter.next() orelse return errMsg("--model needs a value");
            out.model = try allocator.dupe(u8, v);
        } else if (std.mem.eql(u8, arg, "--max-turns")) {
            const v = argv_iter.next() orelse return errMsg("--max-turns needs a value");
            out.max_turns = std.fmt.parseInt(u32, v, 10) catch return errMsg("--max-turns must be a u32");
        } else if (std.mem.eql(u8, arg, "--prompt-file")) {
            const v = argv_iter.next() orelse return errMsg("--prompt-file needs a value");
            out.prompt_path = try allocator.dupe(u8, v);
        } else if (std.mem.eql(u8, arg, "--inherit-stderr")) {
            out.inherit_stderr = true;
        } else {
            const stderr = std.fs.File.stderr();
            try stderr.writeAll("claude_runner: unknown arg: ");
            try stderr.writeAll(arg);
            try stderr.writeAll("\n");
            return ArgError.BadArg;
        }
    }

    if (!saw_cwd) {
        try std.fs.File.stderr().writeAll("claude_runner: --cwd is required\n");
        return ArgError.MissingCwd;
    }

    return out;
}

fn errMsg(msg: []const u8) ArgError {
    std.fs.File.stderr().writeAll(msg) catch {};
    std.fs.File.stderr().writeAll("\n") catch {};
    return ArgError.BadArg;
}

fn logErr(allocator: std.mem.Allocator, label: []const u8, err: anyerror) !void {
    const line = try std.fmt.allocPrint(
        allocator,
        "claude_runner: {s} failed: {s}\n",
        .{ label, @errorName(err) },
    );
    defer allocator.free(line);
    try std.fs.File.stderr().writeAll(line);
}

fn slurpFile(allocator: std.mem.Allocator, path: []const u8) ![]u8 {
    const f = try std.fs.cwd().openFile(path, .{});
    defer f.close();
    const stat = try f.stat();
    const buf = try allocator.alloc(u8, stat.size);
    _ = try f.readAll(buf);
    return buf;
}

fn slurpStdin(allocator: std.mem.Allocator) ![]u8 {
    var stdin_buffer: [4096]u8 = undefined;
    var stdin_reader = std.fs.File.stdin().reader(&stdin_buffer);
    return try stdin_reader.interface.allocRemaining(allocator, .unlimited);
}

// ── JSON emission helpers ─────────────────────────────────────────────────

fn writeJsonString(w: *std.io.Writer, s: []const u8) !void {
    try w.writeByte('"');
    for (s) |c| {
        switch (c) {
            '"' => try w.writeAll("\\\""),
            '\\' => try w.writeAll("\\\\"),
            '\n' => try w.writeAll("\\n"),
            '\r' => try w.writeAll("\\r"),
            '\t' => try w.writeAll("\\t"),
            0x00...0x08, 0x0b...0x0c, 0x0e...0x1f => {
                try w.print("\\u{x:0>4}", .{c});
            },
            else => try w.writeByte(c),
        }
    }
    try w.writeByte('"');
}

fn emitSystem(w: *std.io.Writer, m: claude_sdk.SystemMsg) !void {
    try w.writeAll("{\"type\":\"system\",\"session_id\":");
    try writeJsonString(w, m.session_id);
    if (m.model) |mod| {
        try w.writeAll(",\"model\":");
        try writeJsonString(w, mod);
    }
    if (m.cwd) |c| {
        try w.writeAll(",\"cwd\":");
        try writeJsonString(w, c);
    }
    try w.writeAll(",\"tools\":[");
    for (m.tools, 0..) |t, i| {
        if (i > 0) try w.writeAll(",");
        try writeJsonString(w, t);
    }
    try w.writeAll("]}\n");
}

fn emitAssistant(w: *std.io.Writer, m: claude_sdk.AssistantMsg) !void {
    try w.writeAll("{\"type\":\"assistant\",\"content\":[");
    for (m.content, 0..) |blk, i| {
        if (i > 0) try w.writeAll(",");
        switch (blk) {
            .text => |t| {
                try w.writeAll("{\"type\":\"text\",\"text\":");
                try writeJsonString(w, t.text);
                try w.writeAll("}");
            },
            .thinking => |t| {
                try w.writeAll("{\"type\":\"thinking\",\"thinking\":");
                try writeJsonString(w, t.thinking);
                try w.writeAll("}");
            },
            .tool_use => |t| {
                try w.writeAll("{\"type\":\"tool_use\",\"id\":");
                try writeJsonString(w, t.id);
                try w.writeAll(",\"name\":");
                try writeJsonString(w, t.name);
                // input_json is already a JSON-encoded object/value; pass it
                // through verbatim so the Python harness can json.loads it.
                try w.writeAll(",\"input\":");
                try w.writeAll(t.input_json);
                try w.writeAll("}");
            },
        }
    }
    if (m.stop_reason) |sr| {
        try w.writeAll("],\"stop_reason\":");
        try writeJsonString(w, sr);
        try w.writeAll("}\n");
    } else {
        try w.writeAll("]}\n");
    }
}

fn emitUser(w: *std.io.Writer, m: claude_sdk.UserMsg) !void {
    try w.writeAll("{\"type\":\"user_tool_result\",\"content_json\":");
    try writeJsonString(w, m.content_json);
    try w.writeAll("}\n");
}

fn emitResult(w: *std.io.Writer, m: claude_sdk.ResultMsg) !void {
    const sub = switch (m.subtype) {
        .success => "success",
        .error_result => "error",
    };
    try w.writeAll("{\"type\":\"result\",\"subtype\":\"");
    try w.writeAll(sub);
    try w.writeAll("\",\"session_id\":");
    try writeJsonString(w, m.session_id);
    try w.writeAll(",\"num_turns\":");
    try w.print("{d}", .{m.num_turns});
    try w.writeAll(",\"total_cost_usd\":");
    try w.print("{d}", .{m.total_cost_usd});
    try w.writeAll(",\"duration_ms\":");
    try w.print("{d}", .{m.duration_ms});
    try w.writeAll(",\"duration_api_ms\":");
    try w.print("{d}", .{m.duration_api_ms});
    try w.writeAll(",\"is_error\":");
    try w.writeAll(if (m.is_error) "true" else "false");
    if (m.result) |r| {
        try w.writeAll(",\"result\":");
        try writeJsonString(w, r);
    }
    try w.writeAll("}\n");
}

// ── main ──────────────────────────────────────────────────────────────────

pub fn main() !u8 {
    var gpa: std.heap.GeneralPurposeAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = parseArgs(allocator) catch |err| switch (err) {
        ArgError.BadArg, ArgError.MissingCwd => return 2,
        else => return err,
    };

    // Resolve system prompt source.
    var system_prompt_owned: ?[]u8 = null;
    defer if (system_prompt_owned) |b| allocator.free(b);
    var system_prompt_final: ?[]const u8 = args.system_prompt;
    if (args.system_prompt_path) |p| {
        const buf = try slurpFile(allocator, p);
        system_prompt_owned = buf;
        system_prompt_final = std.mem.trim(u8, buf, &std.ascii.whitespace);
    }

    // Resolve user prompt source.
    const user_prompt_buf = if (args.prompt_path) |p|
        try slurpFile(allocator, p)
    else
        try slurpStdin(allocator);
    defer allocator.free(user_prompt_buf);
    const user_prompt = std.mem.trim(u8, user_prompt_buf, &std.ascii.whitespace);
    if (user_prompt.len == 0) {
        try std.fs.File.stderr().writeAll("claude_runner: user prompt is empty\n");
        return 2;
    }

    var stdout_buffer: [8192]u8 = undefined;
    var stdout_writer = std.fs.File.stdout().writer(&stdout_buffer);
    const w = &stdout_writer.interface;

    var sess = claude_sdk.Session.init(allocator, .{
        .cwd = args.cwd,
        .model = args.model,
        .system_prompt = system_prompt_final,
        .max_turns = args.max_turns,
        .inherit_stderr = args.inherit_stderr,
    }) catch |err| {
        try logErr(allocator, "Session.init", err);
        return 1;
    };
    defer sess.deinit();

    sess.send(user_prompt) catch |err| {
        try logErr(allocator, "send", err);
        return 1;
    };

    var saw_result = false;
    var idle_iters: u32 = 0;
    const max_idle_iters: u32 = 60_000; // ~5 minutes at 5ms sleep

    while (!saw_result) {
        const maybe = sess.poll() catch |err| {
            try logErr(allocator, "poll", err);
            return 1;
        };
        if (maybe) |owned| {
            var m = owned;
            defer m.deinit();
            idle_iters = 0;
            switch (m.msg) {
                .system => |sm| try emitSystem(w, sm),
                .assistant => |am| try emitAssistant(w, am),
                .user => |um| try emitUser(w, um),
                .result => |rm| {
                    try emitResult(w, rm);
                    saw_result = true;
                },
            }
            try w.flush();
        } else {
            idle_iters += 1;
            if (idle_iters >= max_idle_iters) {
                try std.fs.File.stderr().writeAll("claude_runner: idle timeout (no result event)\n");
                return 1;
            }
            std.Thread.sleep(5 * std.time.ns_per_ms);
        }
    }

    sess.close() catch {};
    return 0;
}
