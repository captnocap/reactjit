//! Agent Session — Model-agnostic AI agent orchestration
//!
//! Provides the core execution loop: LLM streaming → tool dispatch → result collection.
//! Works with any provider (Anthropic, OpenAI, local) via the provider interface.
//!
//! Usage from .tsz (via FFI):
//!   const session = AgentSession.create({
//!     .provider = "openai",
//!     .model = "gpt-4o",
//!     .api_key = env.OPENAI_API_KEY,
//!     .tools = &.{ bashTool, fileReadTool },
//!     .work_dir = "/home/user/project",
//!   });
//!   try session.sendMessage("Fix the bug in src/main.zig");

const std = @import("std");
const log = @import("log.zig");
const Tool = @import("tool_framework.zig").Tool;
const ToolExecutor = @import("tool_framework.zig").ToolExecutor;
const Process = @import("process.zig").Process;
const PTY = @import("pty.zig");
const LuaJIT = @import("luajit_worker.zig");

// ═════════════════════════════════════════════════════════════════════════════
// Provider Interface (model-agnostic LLM abstraction)
// ═════════════════════════════════════════════════════════════════════════════

pub const MessageRole = enum { system, user, assistant, tool };

pub const ToolCall = struct {
    id: []const u8,
    name: []const u8,
    arguments: []const u8, // JSON string
};

pub const Message = struct {
    role: MessageRole,
    content: []const u8,
    tool_calls: ?[]const ToolCall = null,
    tool_call_id: ?[]const u8 = null,
    allocator: std.mem.Allocator,

    pub fn deinit(self: *Message) void {
        self.allocator.free(self.content);
        if (self.tool_calls) |tcs| {
            for (tcs) |tc| {
                self.allocator.free(tc.id);
                self.allocator.free(tc.name);
                self.allocator.free(tc.arguments);
            }
            self.allocator.free(tcs);
        }
        if (self.tool_call_id) |id| self.allocator.free(id);
    }
};

pub const StreamDelta = struct {
    content: ?[]const u8 = null,
    tool_calls: ?[]const ToolCall = null,
    done: bool = false,
};

/// Provider interface - implement for Anthropic, OpenAI, local models, etc
pub const Provider = struct {
    ctx: *anyopaque,
    vtable: *const VTable,

    pub const VTable = struct {
        /// Format request for streaming chat completion
        formatRequest: *const fn (ctx: *anyopaque, messages: []const Message, tools: ?[]const Tool) anyerror!HTTPRequest,
        /// Parse a streaming SSE chunk
        parseStreamChunk: *const fn (ctx: *anyopaque, chunk: []const u8, delta: *StreamDelta) anyerror!void,
        /// Clean up provider state
        deinit: *const fn (ctx: *anyopaque) void,
    },

    pub fn formatRequest(self: Provider, messages: []const Message, tools: ?[]const Tool) !HTTPRequest {
        return self.vtable.formatRequest(self.ctx, messages, tools);
    }

    pub fn parseStreamChunk(self: Provider, chunk: []const u8, delta: *StreamDelta) !void {
        return self.vtable.parseStreamChunk(self.ctx, chunk, delta);
    }

    pub fn deinit(self: Provider) void {
        return self.vtable.deinit(self.ctx);
    }
};

pub const HTTPRequest = struct {
    url: []const u8,
    method: []const u8,
    headers: []const Header,
    body: ?[]const u8,

    pub const Header = struct { name: []const u8, value: []const u8 };
};

// ═════════════════════════════════════════════════════════════════════════════
// Agent Session
// ═════════════════════════════════════════════════════════════════════════════

pub const SessionConfig = struct {
    provider: Provider,
    model: []const u8,
    system_prompt: ?[]const u8 = null,
    tools: ?[]const Tool = null,
    work_dir: ?[]const u8 = null,
    max_tool_rounds: u32 = 10,
    temperature: f32 = 0.7,
    max_tokens: u32 = 4096,
};

pub const SessionState = enum {
    idle,
    streaming,
    executing_tools,
    error_,
};

pub const ToolExecution = struct {
    id: []const u8,
    tool_name: []const u8,
    status: enum { pending, running, completed, error_ },
    result: ?[]const u8,
    start_time: i64,
    end_time: ?i64,
};

pub const AgentSession = struct {
    allocator: std.mem.Allocator,
    config: SessionConfig,
    
    // State
    state: SessionState = .idle,
    messages: std.ArrayList(Message),
    current_streaming_content: std.ArrayList(u8),
    pending_tool_calls: std.ArrayList(ToolCall),
    
    // Tool execution
    tool_executor: ToolExecutor,
    active_executions: std.ArrayList(ToolExecution),
    
    // Callbacks (set by .tsz via FFI)
    on_stream_chunk: ?*const fn (ctx: ?*anyopaque, text: []const u8) void = null,
    on_stream_chunk_ctx: ?*anyopaque = null,
    on_tool_start: ?*const fn (ctx: ?*anyopaque, exec: *const ToolExecution) void = null,
    on_tool_start_ctx: ?*anyopaque = null,
    on_tool_end: ?*const fn (ctx: ?*anyopaque, exec: *const ToolExecution) void = null,
    on_tool_end_ctx: ?*anyopaque = null,
    on_error: ?*const fn (ctx: ?*anyopaque, err: []const u8) void = null,
    on_error_ctx: ?*anyopaque = null,

    // HTTP client state (simplified - real impl would use your http.zig)
    http_client: ?*anyopaque = null,

    pub fn create(allocator: std.mem.Allocator, config: SessionConfig) !*AgentSession {
        const session = try allocator.create(AgentSession);
        errdefer allocator.destroy(session);

        session.* = .{
            .allocator = allocator,
            .config = config,
            .messages = std.ArrayList(Message).init(allocator),
            .current_streaming_content = std.ArrayList(u8).init(allocator),
            .pending_tool_calls = std.ArrayList(ToolCall).init(allocator),
            .tool_executor = ToolExecutor.init(allocator),
            .active_executions = std.ArrayList(ToolExecution).init(allocator),
        };

        // Add system message if provided
        if (config.system_prompt) |sp| {
            try session.messages.append(.{
                .role = .system,
                .content = try allocator.dupe(u8, sp),
                .allocator = allocator,
            });
        }

        return session;
    }

    pub fn destroy(self: *AgentSession) void {
        // Clean up messages
        for (self.messages.items) |*msg| msg.deinit();
        self.messages.deinit();
        
        self.current_streaming_content.deinit();
        
        for (self.pending_tool_calls.items) |*tc| {
            self.allocator.free(tc.id);
            self.allocator.free(tc.name);
            self.allocator.free(tc.arguments);
        }
        self.pending_tool_calls.deinit();
        
        self.tool_executor.deinit();
        
        for (self.active_executions.items) |*exec| {
            self.allocator.free(exec.id);
            self.allocator.free(exec.tool_name);
            if (exec.result) |r| self.allocator.free(r);
        }
        self.active_executions.deinit();

        self.config.provider.deinit();
        self.allocator.destroy(self);
    }

    /// Send a user message and run the full agent loop
    pub fn sendMessage(self: *AgentSession, content: []const u8) !void {
        // Add user message
        try self.messages.append(.{
            .role = .user,
            .content = try self.allocator.dupe(u8, content),
            .allocator = self.allocator,
        });

        // Run agent loop
        try self.runAgentLoop();
    }

    /// Run one round: stream LLM → collect tool calls → execute → repeat
    fn runAgentLoop(self: *AgentSession) !void {
        var round: u32 = 0;
        
        while (round < self.config.max_tool_rounds) : (round += 1) {
            // Stream one round
            self.state = .streaming;
            self.current_streaming_content.clearRetainingCapacity();
            
            var assistant_msg = try self.streamRound();
            errdefer assistant_msg.deinit();

            // Add assistant message to history
            try self.messages.append(assistant_msg);

            // Check for tool calls
            if (assistant_msg.tool_calls == null or assistant_msg.tool_calls.?.len == 0) {
                // No tools, we're done
                self.state = .idle;
                return;
            }

            // Execute tools
            self.state = .executing_tools;
            const results = try self.executeTools(assistant_msg.tool_calls.?);
            defer {
                for (results) |*r| r.deinit();
                self.allocator.free(results);
            }

            // Add tool results as messages
            for (results) |result| {
                try self.messages.append(result);
            }
        }

        self.state = .idle;
    }

    /// Stream one LLM round, return complete assistant message
    fn streamRound(self: *AgentSession) !Message {
        const req = try self.config.provider.formatRequest(
            self.messages.items,
            self.config.tools,
        );

        // Build up content and tool calls during streaming
        var content_buffer = std.ArrayList(u8).init(self.allocator);
        errdefer content_buffer.deinit();

        var tool_calls = std.ArrayList(ToolCall).init(self.allocator);
        errdefer {
            for (tool_calls.items) |*tc| {
                self.allocator.free(tc.id);
                self.allocator.free(tc.name);
                self.allocator.free(tc.arguments);
            }
            tool_calls.deinit();
        }

        // Track partial tool calls during streaming
        var partial_tools: std.StringHashMap(std.ArrayList(u8)).init(self.allocator);
        defer {
            var it = partial_tools.iterator();
            while (it.next()) |entry| {
                self.allocator.free(entry.key_ptr.*);
                entry.value_ptr.deinit();
            }
            partial_tools.deinit();
        }

        // TODO: Actually make HTTP request and stream
        // For now, this is the structure - real impl uses your http.zig
        _ = req;

        // Placeholder: simulate receiving deltas
        // In real impl, this comes from SSE stream parsing
        
        return Message{
            .role = .assistant,
            .content = try content_buffer.toOwnedSlice(),
            .tool_calls = if (tool_calls.items.len > 0) try tool_calls.toOwnedSlice() else null,
            .allocator = self.allocator,
        };
    }

    /// Execute tool calls concurrently where safe
    fn executeTools(self: *AgentSession, calls: []const ToolCall) ![]Message {
        var results = std.ArrayList(Message).init(self.allocator);
        errdefer {
            for (results.items) |*r| r.deinit();
            results.deinit();
        }

        for (calls) |call| {
            // Find the tool
            const tool = self.findTool(call.name) orelse {
                // Unknown tool - return error
                const err_msg = try std.fmt.allocPrint(self.allocator, "Unknown tool: {s}", .{call.name});
                try results.append(.{
                    .role = .tool,
                    .content = err_msg,
                    .tool_call_id = try self.allocator.dupe(u8, call.id),
                    .allocator = self.allocator,
                });
                continue;
            };

            // Create execution record
            const exec = ToolExecution{
                .id = try self.allocator.dupe(u8, call.id),
                .tool_name = try self.allocator.dupe(u8, call.name),
                .status = .running,
                .result = null,
                .start_time = std.time.milliTimestamp(),
                .end_time = null,
            };
            try self.active_executions.append(exec);
            
            if (self.on_tool_start) |cb| {
                cb(self.on_tool_start_ctx, &self.active_executions.items[self.active_executions.items.len - 1]);
            }

            // Execute the tool
            const result = try self.tool_executor.execute(tool, call.arguments, self.config.work_dir);

            // Update execution record
            const exec_idx = self.active_executions.items.len - 1;
            self.active_executions.items[exec_idx].status = .completed;
            self.active_executions.items[exec_idx].end_time = std.time.milliTimestamp();
            self.active_executions.items[exec_idx].result = try self.allocator.dupe(u8, result);

            if (self.on_tool_end) |cb| {
                cb(self.on_tool_end_ctx, &self.active_executions.items[exec_idx]);
            }

            // Add result message
            try results.append(.{
                .role = .tool,
                .content = try self.allocator.dupe(u8, result),
                .tool_call_id = try self.allocator.dupe(u8, call.id),
                .allocator = self.allocator,
            });

            self.allocator.free(result);
        }

        return try results.toOwnedSlice();
    }

    fn findTool(self: *AgentSession, name: []const u8) ?Tool {
        if (self.config.tools) |tools| {
            for (tools) |tool| {
                if (std.mem.eql(u8, tool.name, name)) return tool;
            }
        }
        return null;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // FFI Callback Setters (called from .tsz)
    // ═════════════════════════════════════════════════════════════════════════

    pub fn setOnStreamChunk(self: *AgentSession, cb: ?*const fn (ctx: ?*anyopaque, text: []const u8) void, ctx: ?*anyopaque) void {
        self.on_stream_chunk = cb;
        self.on_stream_chunk_ctx = ctx;
    }

    pub fn setOnToolStart(self: *AgentSession, cb: ?*const fn (ctx: ?*anyopaque, exec: *const ToolExecution) void, ctx: ?*anyopaque) void {
        self.on_tool_start = cb;
        self.on_tool_start_ctx = ctx;
    }

    pub fn setOnToolEnd(self: *AgentSession, cb: ?*const fn (ctx: ?*anyopaque, exec: *const ToolExecution) void, ctx: ?*anyopaque) void {
        self.on_tool_end = cb;
        self.on_tool_end_ctx = ctx;
    }

    pub fn setOnError(self: *AgentSession, cb: ?*const fn (ctx: ?*anyopaque, err: []const u8) void, ctx: ?*anyopaque) void {
        self.on_error = cb;
        self.on_error_ctx = ctx;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// C FFI Exports (for QuickJS/Lua bridge)
// ═════════════════════════════════════════════════════════════════════════════

const c = @cImport({
    @cDefine("_GNU_SOURCE", "1");
});

export fn agent_session_create(
    provider_ctx: *anyopaque,
    provider_vtable: *const Provider.VTable,
    model: [*c]const u8,
    system_prompt: ?[*c]const u8,
    work_dir: ?[*c]const u8,
) ?*AgentSession {
    const allocator = std.heap.c_allocator;
    
    const provider = Provider{
        .ctx = provider_ctx,
        .vtable = provider_vtable,
    };

    const config = SessionConfig{
        .provider = provider,
        .model = std.mem.span(model),
        .system_prompt = if (system_prompt) |sp| std.mem.span(sp) else null,
        .work_dir = if (work_dir) |wd| std.mem.span(wd) else null,
    };

    return AgentSession.create(allocator, config) catch return null;
}

export fn agent_session_destroy(session: *AgentSession) void {
    session.destroy();
}

export fn agent_session_send_message(session: *AgentSession, content: [*c]const u8) c_int {
    session.sendMessage(std.mem.span(content)) catch return 0;
    return 1;
}

export fn agent_session_get_state(session: *AgentSession) SessionState {
    return session.state;
}

export fn agent_session_set_on_stream_chunk(
    session: *AgentSession,
    cb: ?*const fn (ctx: ?*anyopaque, text: [*c]const u8) callconv(.c) void,
    ctx: ?*anyopaque,
) void {
    const wrapper = struct {
        fn wrap(user_ctx: ?*anyopaque, text: []const u8) callconv(.c) void {
            const c_cb = @as(*const fn (?*anyopaque, [*c]const u8) callconv(.c) void, @ptrCast(user_ctx.?));
            c_cb(user_ctx, text.ptr);
        }
    }.wrap;
    
    session.setOnStreamChunk(if (cb != null) wrapper else null, ctx);
}
