//! Agent Core — Main integration module for agent orchestration
//!
//! Combines:
//!   - agent_session.zig (model-agnostic sessions)
//!   - tool_framework.zig (tool execution with concurrency)
//!   - agent_spawner.zig (fork subagents)
//!   - tools_builtin.zig (bash, file ops, search)
//!
//! Exports a clean C FFI for QuickJS/Lua bridge.

const std = @import("std");
const log = @import("log.zig");

// Re-export core types
pub const AgentSession = @import("agent_session.zig").AgentSession;
pub const SessionConfig = @import("agent_session.zig").SessionConfig;
pub const SessionState = @import("agent_session.zig").SessionState;
pub const Message = @import("agent_session.zig").Message;
pub const MessageRole = @import("agent_session.zig").MessageRole;
pub const ToolCall = @import("agent_session.zig").ToolCall;
pub const Provider = @import("agent_session.zig").Provider;
pub const StreamDelta = @import("agent_session.zig").StreamDelta;

pub const Tool = @import("tool_framework.zig").Tool;
pub const ToolResult = @import("tool_framework.zig").ToolResult;
pub const ToolContext = @import("tool_framework.zig").ToolContext;
pub const ProgressUpdate = @import("tool_framework.zig").ProgressUpdate;
pub const ToolRegistry = @import("tool_framework.zig").ToolRegistry;
pub const ToolExecutor = @import("tool_framework.zig").ToolExecutor;

pub const ForkedAgent = @import("agent_spawner.zig").ForkedAgent;
pub const ForkConfig = @import("agent_spawner.zig").ForkConfig;
pub const AgentPool = @import("agent_spawner.zig").AgentPool;
pub const AgentContext = @import("agent_spawner.zig").AgentContext;
pub const AgentType = @import("agent_spawner.zig").AgentType;

// Built-in tools
pub const tools_builtin = @import("tools_builtin.zig");

// ═════════════════════════════════════════════════════════════════════════════
// Global State (singletons)
// ═════════════════════════════════════════════════════════════════════════════

var g_tool_registry: ?ToolRegistry = null;
var g_agent_pool: ?AgentPool = null;
var g_allocator: std.mem.Allocator = std.heap.c_allocator;

pub fn init() void {
    if (g_tool_registry == null) {
        g_tool_registry = ToolRegistry.init(g_allocator);
        
        // Register built-in tools
        g_tool_registry.?.register(tools_builtin.bashTool()) catch {};
        g_tool_registry.?.register(tools_builtin.readFileTool()) catch {};
        g_tool_registry.?.register(tools_builtin.writeFileTool()) catch {};
        g_tool_registry.?.register(tools_builtin.fileEditTool()) catch {};
        g_tool_registry.?.register(tools_builtin.globTool()) catch {};
        g_tool_registry.?.register(tools_builtin.grepTool()) catch {};
        g_tool_registry.?.register(tools_builtin.taskCreateTool()) catch {};
    }
    
    if (g_agent_pool == null) {
        g_agent_pool = AgentPool.init(g_allocator);
    }
    
    log.info(.agent, "Agent core initialized", .{});
}

pub fn deinit() void {
    if (g_tool_registry) |*r| {
        r.deinit();
        g_tool_registry = null;
    }
    if (g_agent_pool) |*p| {
        p.deinit();
        g_agent_pool = null;
    }
}

pub fn getToolRegistry() *ToolRegistry {
    if (g_tool_registry == null) init();
    return &g_tool_registry.?;
}

pub fn getAgentPool() *AgentPool {
    if (g_agent_pool == null) init();
    return &g_agent_pool.?;
}

// ═════════════════════════════════════════════════════════════════════════════
// Provider Factory
// ═════════════════════════════════════════════════════════════════════════════

pub const ProviderType = enum {
    anthropic,
    openai,
    custom,
};

pub const ProviderConfig = struct {
    provider_type: ProviderType,
    api_key: []const u8,
    base_url: ?[]const u8 = null,
    model: []const u8,
};

/// Create a provider from config
pub fn createProvider(config: ProviderConfig) !Provider {
    // This would dispatch to specific provider implementations
    // For now, return a placeholder
    _ = config;
    return error.NotImplemented;
}

// ═════════════════════════════════════════════════════════════════════════════
// QuickJS Bridge
// ═════════════════════════════════════════════════════════════════════════════

/// Opaque handle for JS
pub const JSSessionHandle = opaque {};
pub const JSToolHandle = opaque {};
pub const JSAgentHandle = opaque {};

// Callback types for JS
pub const JSOnStreamChunk = *const fn (ctx: ?*anyopaque, text: [*c]const u8) callconv(.c) void;
pub const JSOnToolStart = *const fn (ctx: ?*anyopaque, tool_use_id: [*c]const u8, tool_name: [*c]const u8) callconv(.c) void;
pub const JSOnToolEnd = *const fn (ctx: ?*anyopaque, tool_use_id: [*c]const u8, result: [*c]const u8, is_error: c_int) callconv(.c) void;
pub const JSOnComplete = *const fn (ctx: ?*anyopaque, report: [*c]const u8) callconv(.c) void;
pub const JSOnError = *const fn (ctx: ?*anyopaque, error: [*c]const u8) callconv(.c) void;

// Session management
export fn agent_core_create_session(
    provider_type: [*c]const u8,
    model: [*c]const u8,
    api_key: [*c]const u8,
    system_prompt: ?[*c]const u8,
    work_dir: ?[*c]const u8,
) ?*JSSessionHandle {
    init();
    
    const pt = std.mem.span(provider_type);
    const prov_type = if (std.mem.eql(u8, pt, "anthropic"))
        ProviderType.anthropic
    else if (std.mem.eql(u8, pt, "openai"))
        ProviderType.openai
    else
        ProviderType.custom;
    
    const prov_config = ProviderConfig{
        .provider_type = prov_type,
        .api_key = std.mem.span(api_key),
        .model = std.mem.span(model),
    };
    
    const provider = createProvider(prov_config) catch return null;
    
    const config = SessionConfig{
        .provider = provider,
        .model = prov_config.model,
        .system_prompt = if (system_prompt) |sp| std.mem.span(sp) else null,
        .work_dir = if (work_dir) |wd| std.mem.span(wd) else null,
        .tools = null, // Would get from registry
    };
    
    const session = AgentSession.create(g_allocator, config) catch return null;
    return @ptrCast(session);
}

export fn agent_core_destroy_session(handle: *JSSessionHandle) void {
    const session = @as(*AgentSession, @ptrCast(@alignCast(handle)));
    session.destroy();
}

export fn agent_core_session_send(handle: *JSSessionHandle, content: [*c]const u8) c_int {
    const session = @as(*AgentSession, @ptrCast(@alignCast(handle)));
    session.sendMessage(std.mem.span(content)) catch return 0;
    return 1;
}

export fn agent_core_session_set_callbacks(
    handle: *JSSessionHandle,
    on_stream_chunk: ?JSOnStreamChunk,
    on_stream_chunk_ctx: ?*anyopaque,
    on_tool_start: ?JSOnToolStart,
    on_tool_start_ctx: ?*anyopaque,
    on_tool_end: ?JSOnToolEnd,
    on_tool_end_ctx: ?*anyopaque,
    on_error: ?JSOnError,
    on_error_ctx: ?*anyopaque,
) void {
    const session = @as(*AgentSession, @ptrCast(@alignCast(handle)));
    
    // Wrap C callbacks in Zig closures
    if (on_stream_chunk) |cb| {
        const wrapper = struct {
            fn wrap(user_ctx: ?*anyopaque, text: []const u8) void {
                const c_cb = @as(JSOnStreamChunk, @ptrCast(user_ctx));
                c_cb(user_ctx, text.ptr);
            }
        }.wrap;
        session.setOnStreamChunk(wrapper, on_stream_chunk_ctx);
        _ = cb;
    }
    
    // Similar wrapping for other callbacks...
    _ = on_tool_start;
    _ = on_tool_start_ctx;
    _ = on_tool_end;
    _ = on_tool_end_ctx;
    _ = on_error;
    _ = on_error_ctx;
}

// Agent spawning
export fn agent_core_fork_agent(
    directive: [*c]const u8,
    inherits_context: c_int,
    use_worktree: c_int,
) ?*JSAgentHandle {
    init();
    
    const config = ForkConfig{
        .directive = std.mem.span(directive),
        .inherits_context = inherits_context != 0,
        .use_worktree = use_worktree != 0,
    };
    
    const agent = getAgentPool().spawn(null, config) catch return null;
    return @ptrCast(agent);
}

export fn agent_core_agent_send(handle: *JSAgentHandle, content: [*c]const u8) c_int {
    const agent = @as(*ForkedAgent, @ptrCast(@alignCast(handle)));
    agent.sendMessage(std.mem.span(content)) catch return 0;
    return 1;
}

export fn agent_core_agent_terminate(handle: *JSAgentHandle) void {
    const agent = @as(*ForkedAgent, @ptrCast(@alignCast(handle)));
    agent.terminate();
}

export fn agent_core_agent_set_callbacks(
    handle: *JSAgentHandle,
    on_message: ?*const fn (ctx: ?*anyopaque, role: [*c]const u8, content: [*c]const u8) callconv(.c) void,
    on_message_ctx: ?*anyopaque,
    on_complete: ?JSOnComplete,
    on_complete_ctx: ?*anyopaque,
    on_error: ?JSOnError,
    on_error_ctx: ?*anyopaque,
) void {
    const agent = @as(*ForkedAgent, @ptrCast(@alignCast(handle)));
    
    // Wrap callbacks
    _ = agent;
    _ = on_message;
    _ = on_message_ctx;
    _ = on_complete;
    _ = on_complete_ctx;
    _ = on_error;
    _ = on_error_ctx;
}

// Tool execution
export fn agent_core_execute_tool_sync(
    tool_name: [*c]const u8,
    input_json: [*c]const u8,
    work_dir: ?[*c]const u8,
    out_result: *[*c]const u8,
    out_is_error: *c_int,
) c_int {
    init();
    
    const name = std.mem.span(tool_name);
    const input = std.mem.span(input_json);
    const cwd = if (work_dir) |wd| std.mem.span(wd) else null;
    
    const registry = getToolRegistry();
    const tool = registry.get(name) orelse return 0;
    
    var executor = ToolExecutor.init(g_allocator);
    defer executor.deinit();
    
    const result = executor.execute(tool, input, cwd) catch return 0;
    defer g_allocator.free(result);
    
    // Allocate result for C caller
    const result_copy = std.heap.c_allocator.dupe(u8, result) catch return 0;
    out_result.* = result_copy.ptr;
    out_is_error.* = 0; // TODO: track errors
    
    return 1;
}

// ═════════════════════════════════════════════════════════════════════════════
// Lua Bridge (simpler - just expose as Lua module)
// ═════════════════════════════════════════════════════════════════════════════

// For LuaJIT FFI, we just need the C exports above
// The Lua module would load via FFI and wrap these functions

// ═════════════════════════════════════════════════════════════════════════════
// TypeScript Declaration Generation Helpers
// ═════════════════════════════════════════════════════════════════════════════

// These are here to ensure the TS types stay in sync with the Zig code

comptime {
    // Verify that our C exports match what we expect in TS
    _ = agent_core_create_session;
    _ = agent_core_destroy_session;
    _ = agent_core_session_send;
    _ = agent_core_session_set_callbacks;
    _ = agent_core_fork_agent;
    _ = agent_core_agent_send;
    _ = agent_core_agent_terminate;
    _ = agent_core_execute_tool_sync;
}
