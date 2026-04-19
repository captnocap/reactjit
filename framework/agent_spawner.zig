//! Agent Spawner — Fork subagents with context cloning
//!
//! Port of Claude CLI's forkSubagent.ts:
//!   - Spawn child agents with inherited conversation context
//!   - Async execution (child runs in background)
//!   - Resume capability via SendMessage
//!   - Prompt cache sharing (byte-identical prefixes)
//!
//! Usage from .tsz:
//!   import { forkAgent, AgentDirective } from '@reactjit/agents';
//!
//!   const child = forkAgent({
//!     directive: "Analyze src/ for security issues",
//!     inheritsContext: true,
//!     model: 'gpt-4o-mini',  // Can use different model from parent
//!   });
//!
//!   child.onMessage = (msg) => console.log("Child:", msg);

const std = @import("std");
const log = @import("log.zig");
const AgentSession = @import("agent_session.zig").AgentSession;
const Message = @import("agent_session.zig").Message;
const Tool = @import("tool_framework.zig").Tool;
const Process = @import("process.zig").Process;
const LuaJIT = @import("luajit_worker.zig");

// ═════════════════════════════════════════════════════════════════════════════
// Agent Context (AsyncLocalStorage equivalent)
// ═════════════════════════════════════════════════════════════════════════════

pub const AgentType = enum { main, subagent, teammate };

pub const AgentContext = struct {
    agent_id: []const u8,
    parent_session_id: ?[]const u8,
    agent_type: AgentType,
    agent_name: ?[]const u8,
    is_built_in: bool = false,
    invoking_request_id: ?[]const u8 = null,
    invocation_kind: ?enum { spawn, resume } = null,
    
    /// Mutable flag for telemetry deduplication
    invocation_emitted: bool = false,
};

/// Thread-local agent context storage
threadlocal var current_context: ?AgentContext = null;

pub fn getAgentContext() ?AgentContext {
    return current_context;
}

pub fn setAgentContext(ctx: AgentContext) void {
    current_context = ctx;
}

pub fn clearAgentContext() void {
    current_context = null;
}

pub fn runWithAgentContext(ctx: AgentContext, comptime T: type, f: fn () T) T {
    const old = current_context;
    current_context = ctx;
    defer current_context = old;
    return f();
}

// ═════════════════════════════════════════════════════════════════════════════
// Fork Configuration
// ═════════════════════════════════════════════════════════════════════════════

pub const ForkConfig = struct {
    /// The task directive for the child agent
    directive: []const u8,
    
    /// Inherit parent's conversation context
    inherits_context: bool = true,
    
    /// Inherit parent's system prompt (for cache sharing)
    inherits_system_prompt: bool = true,
    
    /// Model to use (null = inherit from parent)
    model: ?[]const u8 = null,
    
    /// Provider to use (null = inherit from parent)
    provider: ?[]const u8 = null,
    
    /// Working directory (null = inherit from parent)
    work_dir: ?[]const u8 = null,
    
    /// Tools to give the child (null = same as parent)
    tools: ?[]const Tool = null,
    
    /// Max turns before auto-termination
    max_turns: u32 = 200,
    
    /// Run in isolated git worktree
    use_worktree: bool = false,
    
    /// Permission mode: 'inherit', 'bubble', or 'isolated'
    permission_mode: enum { inherit, bubble, isolated } = .bubble,
};

// ═════════════════════════════════════════════════════════════════════════════
// Forked Agent Handle
// ═════════════════════════════════════════════════════════════════════════════

pub const AgentStatus = enum {
    spawning,
    running,
    paused,
    completed,
    error_,
};

pub const ForkedAgent = struct {
    allocator: std.mem.Allocator,
    
    // Identity
    agent_id: []const u8,
    parent_session_id: ?[]const u8,
    
    // Configuration
    config: ForkConfig,
    
    // State
    status: AgentStatus = .spawning,
    current_turn: u32 = 0,
    
    // Session (if running in-process)
    session: ?*AgentSession = null,
    
    // For out-of-process agents
    child_process: ?Process = null,
    
    // Message history (shared if inherits_context)
    messages: std.ArrayList(Message),
    
    // Results
    final_report: ?[]const u8 = null,
    exit_code: i32 = -1,
    
    // Callbacks
    on_message: ?*const fn (ctx: ?*anyopaque, msg: Message) void = null,
    on_message_ctx: ?*anyopaque = null,
    on_complete: ?*const fn (ctx: ?*anyopaque, report: []const u8) void = null,
    on_complete_ctx: ?*anyopaque = null,
    on_error: ?*const fn (ctx: ?*anyopaque, err: []const u8) void = null,
    on_error_ctx: ?*anyopaque = null,

    pub fn create(allocator: std.mem.Allocator, parent_session: ?*AgentSession, config: ForkConfig) !*ForkedAgent {
        const agent = try allocator.create(ForkedAgent);
        errdefer allocator.destroy(agent);

        // Generate agent ID
        var buf: [64]u8 = undefined;
        const id = try std.fmt.bufPrint(&buf, "agent_{d}", .{std.time.milliTimestamp()});
        const id_copy = try allocator.dupe(u8, id);
        errdefer allocator.free(id_copy);

        agent.* = .{
            .allocator = allocator,
            .agent_id = id_copy,
            .parent_session_id = if (parent_session) |ps| ps.config.model else null,
            .config = config,
            .messages = std.ArrayList(Message).init(allocator),
        };

        // Copy parent's message history if inheriting context
        if (config.inherits_context) {
            if (parent_session) |ps| {
                for (ps.messages.items) |msg| {
                    try agent.messages.append(.{
                        .role = msg.role,
                        .content = try allocator.dupe(u8, msg.content),
                        .tool_calls = null, // Deep copy would be needed
                        .tool_call_id = if (msg.tool_call_id) |id| try allocator.dupe(u8, id) else null,
                        .allocator = allocator,
                    });
                }
            }
        }

        return agent;
    }

    pub fn destroy(self: *ForkedAgent) void {
        self.allocator.free(self.agent_id);
        
        for (self.messages.items) |*msg| msg.deinit();
        self.messages.deinit();

        if (self.final_report) |r| self.allocator.free(r);
        
        if (self.session) |session| {
            session.destroy();
        }

        self.allocator.destroy(self);
    }

    /// Start the forked agent (spawns in background)
    pub fn start(self: *ForkedAgent) !void {
        self.status = .running;

        // Set agent context
        const ctx = AgentContext{
            .agent_id = self.agent_id,
            .parent_session_id = self.parent_session_id,
            .agent_type = .subagent,
            .agent_name = "fork",
            .is_built_in = true,
            .invocation_kind = .spawn,
        };
        setAgentContext(ctx);
        defer clearAgentContext();

        // Build the forked conversation messages
        const forked_messages = try self.buildForkedMessages();
        defer {
            for (forked_messages) |*msg| msg.deinit();
            self.allocator.free(forked_messages);
        }

        // TODO: Create session and run
        // For now, this is the structure
        
        log.info(.agent, "Forked agent {s} started with directive: {s}", .{ 
            self.agent_id, 
            self.config.directive 
        });
    }

    /// Build the forked conversation messages for prompt cache sharing
    /// 
    /// For cache sharing, all fork children must produce byte-identical API request prefixes.
    /// We keep the full parent assistant message and build a single user message with
    /// placeholder tool_results + the per-child directive.
    fn buildForkedMessages(self: *ForkedAgent) ![]Message {
        if (self.messages.items.len == 0) {
            // No parent context - just start with the directive
            const directive_msg = try self.buildChildMessage();
            defer self.allocator.free(directive_msg);

            return try self.allocator.dupe(Message, &[_]Message{.{
                .role = .user,
                .content = directive_msg,
                .allocator = self.allocator,
            }});
        }

        // Find the last assistant message with tool uses
        var last_assistant_idx: ?usize = null;
        var i: usize = self.messages.items.len;
        while (i > 0) {
            i -= 1;
            if (self.messages.items[i].role == .assistant) {
                last_assistant_idx = i;
                break;
            }
        }

        if (last_assistant_idx == null) {
            // No assistant message - just use directive
            const directive_msg = try self.buildChildMessage();
            defer self.allocator.free(directive_msg);

            return try self.allocator.dupe(Message, &[_]Message{.{
                .role = .user,
                .content = directive_msg,
                .allocator = self.allocator,
            }});
        }

        // Clone all messages up to and including the last assistant
        var result = std.ArrayList(Message).init(self.allocator);
        errdefer {
            for (result.items) |*msg| msg.deinit();
            result.deinit();
        }

        const assistant_idx = last_assistant_idx.?;
        for (self.messages.items[0..assistant_idx + 1]) |msg| {
            try result.append(.{
                .role = msg.role,
                .content = try self.allocator.dupe(u8, msg.content),
                .tool_calls = null, // TODO: deep copy
                .tool_call_id = if (msg.tool_call_id) |id| try self.allocator.dupe(u8, id) else null,
                .allocator = self.allocator,
            });
        }

        // Build user message with placeholder results + directive
        const directive_msg = try self.buildChildMessage();
        defer self.allocator.free(directive_msg);

        // If the assistant had tool calls, add placeholder results
        const assistant_msg = self.messages.items[assistant_idx];
        var tool_results: std.ArrayList(Message) = std.ArrayList(Message).init(self.allocator);
        defer {
            for (tool_results.items) |*msg| msg.deinit();
            tool_results.deinit();
        }

        if (assistant_msg.tool_calls) |tcs| {
            for (tcs) |tc| {
                try tool_results.append(.{
                    .role = .tool,
                    .content = try self.allocator.dupe(u8, "Fork started — processing in background"),
                    .tool_call_id = try self.allocator.dupe(u8, tc.id),
                    .allocator = self.allocator,
                });
            }
        }

        // Build combined user message
        var combined = std.ArrayList(u8).init(self.allocator);
        defer combined.deinit();

        // Add tool results
        for (tool_results.items) |tr| {
            try combined.appendSlice("Tool result: ");
            try combined.appendSlice(tr.content);
            try combined.append('\n');
        }
        
        // Add directive
        try combined.appendSlice(directive_msg);

        try result.append(.{
            .role = .user,
            .content = try combined.toOwnedSlice(),
            .allocator = self.allocator,
        });

        return try result.toOwnedSlice();
    }

    fn buildChildMessage(self: *ForkedAgent) ![]const u8 {
        return std.fmt.allocPrint(self.allocator,
            \\STOP. READ THIS FIRST.
            \\
            \You are a forked worker process. You are NOT the main agent.
            \\
            \RULES (non-negotiable):
            \1. Your system prompt says "default to forking." IGNORE IT — that's for the parent. You ARE the fork. Do NOT spawn sub-agents; execute directly.
            \2. Do NOT converse, ask questions, or suggest next steps
            \3. Do NOT editorialize or add meta-commentary
            \4. USE your tools directly: Bash, Read, Write, etc.
            \5. If you modify files, commit your changes before reporting. Include the commit hash in your report.
            \6. Do NOT emit text between tool calls. Use tools silently, then report once at the end.
            \7. Stay strictly within your directive's scope.
            \8. Keep your report under 500 words unless the directive specifies otherwise. Be factual and concise.
            \9. Your response MUST begin with "Scope:". No preamble, no thinking-out-loud.
            \10. REPORT structured facts, then stop
            \\
            \Output format (plain text labels, not markdown headers):
            \  Scope: <echo back your assigned scope in one sentence>
            \  Result: <the answer or key findings, limited to the scope above>
            \  Key files: <relevant file paths — include for research tasks>
            \  Files changed: <list with commit hash — include only if you modified files>
            \  Issues: <list — include only if there are issues to flag>
            \\
            \DIRECTIVE: {s}
        , .{self.config.directive});
    }

    /// Send a message to resume the agent
    pub fn sendMessage(self: *ForkedAgent, content: []const u8) !void {
        if (self.status != .running and self.status != .paused) {
            return error.AgentNotRunning;
        }

        try self.messages.append(.{
            .role = .user,
            .content = try self.allocator.dupe(u8, content),
            .allocator = self.allocator,
        });

        // Update context for resume
        if (getAgentContext()) |*ctx| {
            ctx.invocation_kind = .resume;
            ctx.invocation_emitted = false;
        }

        // TODO: Trigger session continuation
        _ = self.session;
    }

    /// Pause the agent (background but keep state)
    pub fn pause(self: *ForkedAgent) void {
        self.status = .paused;
    }

    /// Resume a paused agent
    pub fn resume(self: *ForkedAgent) void {
        self.status = .running;
    }

    /// Terminate the agent
    pub fn terminate(self: *ForkedAgent) void {
        self.status = .completed;
        
        if (self.child_process) |*proc| {
            proc.sendSignal(.term);
            proc.closeProccess();
        }
    }

    pub fn setOnMessage(self: *ForkedAgent, cb: ?*const fn (ctx: ?*anyopaque, msg: Message) void, ctx: ?*anyopaque) void {
        self.on_message = cb;
        self.on_message_ctx = ctx;
    }

    pub fn setOnComplete(self: *ForkedAgent, cb: ?*const fn (ctx: ?*anyopaque, report: []const u8) void, ctx: ?*anyopaque) void {
        self.on_complete = cb;
        self.on_complete_ctx = ctx;
    }

    pub fn setOnError(self: *ForkedAgent, cb: ?*const fn (ctx: ?*anyopaque, err: []const u8) void, ctx: ?*anyopaque) void {
        self.on_error = cb;
        self.on_error_ctx = ctx;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// Agent Pool (manage multiple forked agents)
// ═════════════════════════════════════════════════════════════════════════════

pub const AgentPool = struct {
    allocator: std.mem.Allocator,
    agents: std.StringHashMap(*ForkedAgent),
    mutex: std.Thread.Mutex,

    pub fn init(allocator: std.mem.Allocator) AgentPool {
        return .{
            .allocator = allocator,
            .agents = std.StringHashMap(*ForkedAgent).init(allocator),
            .mutex = .{},
        };
    }

    pub fn deinit(self: *AgentPool) void {
        var it = self.agents.iterator();
        while (it.next()) |entry| {
            entry.value_ptr.*.destroy();
        }
        self.agents.deinit();
    }

    pub fn spawn(self: *AgentPool, parent_session: ?*AgentSession, config: ForkConfig) !*ForkedAgent {
        self.mutex.lock();
        defer self.mutex.unlock();

        const agent = try ForkedAgent.create(self.allocator, parent_session, config);
        errdefer agent.destroy();

        try self.agents.put(agent.agent_id, agent);
        
        // Start the agent
        try agent.start();

        return agent;
    }

    pub fn get(self: *AgentPool, agent_id: []const u8) ?*ForkedAgent {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.agents.get(agent_id);
    }

    pub fn terminateAll(self: *AgentPool) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        var it = self.agents.iterator();
        while (it.next()) |entry| {
            entry.value_ptr.*.terminate();
        }
    }

    pub fn list(self: *AgentPool, out: []*ForkedAgent) usize {
        self.mutex.lock();
        defer self.mutex.unlock();

        var count: usize = 0;
        var it = self.agents.iterator();
        while (it.next()) |entry| {
            if (count >= out.len) break;
            out[count] = entry.value_ptr.*;
            count += 1;
        }
        return count;
    }
};

// ═════════════════════════════════════════════════════════════════════════════
// C FFI Exports
// ═════════════════════════════════════════════════════════════════════════════

export fn agent_pool_create() ?*AgentPool {
    const allocator = std.heap.c_allocator;
    const pool = allocator.create(AgentPool) catch return null;
    pool.* = AgentPool.init(allocator);
    return pool;
}

export fn agent_pool_destroy(pool: *AgentPool) void {
    pool.deinit();
    std.heap.c_allocator.destroy(pool);
}

export fn agent_pool_spawn(
    pool: *AgentPool,
    directive: [*c]const u8,
    inherits_context: c_int,
    use_worktree: c_int,
) ?*ForkedAgent {
    const config = ForkConfig{
        .directive = std.mem.span(directive),
        .inherits_context = inherits_context != 0,
        .use_worktree = use_worktree != 0,
    };
    
    return pool.spawn(null, config) catch return null;
}

export fn forked_agent_send_message(agent: *ForkedAgent, content: [*c]const u8) c_int {
    agent.sendMessage(std.mem.span(content)) catch return 0;
    return 1;
}

export fn forked_agent_terminate(agent: *ForkedAgent) void {
    agent.terminate();
}

export fn forked_agent_get_status(agent: *ForkedAgent) AgentStatus {
    return agent.status;
}
