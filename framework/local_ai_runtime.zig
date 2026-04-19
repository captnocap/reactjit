//! Local AI runtime — background llama.cpp-backed inference service.
//!
//! Goals:
//!   - keep inference fully off the UI/render thread
//!   - expose a simple submit/poll session surface for QJS/Lua bridges
//!   - avoid a hard link-time dependency on llama symbols by dlopen'ing
//!     `libllama_ffi` on demand
//!
//! This initial version is chat-oriented and intentionally narrow:
//!   - one long-lived model/context per session
//!   - background thread handles all prompt formatting + decode work
//!   - main thread only submits text and polls events
//!   - designed so future task kinds (embed, summarize_file, rag_answer)
//!     can reuse the same queue/session infrastructure

const std = @import("std");
const builtin = @import("builtin");
const RingBuffer = @import("net/ring_buffer.zig").RingBuffer;

const llama_model = opaque {};
const llama_context = opaque {};
const llama_sampler = opaque {};
const llama_vocab = opaque {};
const llama_memory = opaque {};
const llama_pos = i32;
const llama_token = i32;
const llama_seq_id = i32;

const LlamaProgressFn = *const fn (progress: f32, user_data: ?*anyopaque) callconv(.c) bool;

const llama_model_params = extern struct {
    devices: ?*anyopaque,
    tensor_buft_overrides: ?*const anyopaque,
    n_gpu_layers: i32,
    split_mode: i32,
    main_gpu: i32,
    tensor_split: ?*const f32,
    progress_callback: ?LlamaProgressFn,
    progress_callback_user_data: ?*anyopaque,
    kv_overrides: ?*const anyopaque,
    vocab_only: bool,
    use_mmap: bool,
    use_direct_io: bool,
    use_mlock: bool,
    check_tensors: bool,
    use_extra_bufts: bool,
    no_host: bool,
    no_alloc: bool,
};

const llama_context_params = extern struct {
    n_ctx: u32,
    n_batch: u32,
    n_ubatch: u32,
    n_seq_max: u32,
    n_threads: i32,
    n_threads_batch: i32,
    rope_scaling_type: i32,
    pooling_type: i32,
    attention_type: i32,
    flash_attn_type: i32,
    rope_freq_base: f32,
    rope_freq_scale: f32,
    yarn_ext_factor: f32,
    yarn_attn_factor: f32,
    yarn_beta_fast: f32,
    yarn_beta_slow: f32,
    yarn_orig_ctx: u32,
    defrag_thold: f32,
    cb_eval: ?*anyopaque,
    cb_eval_user_data: ?*anyopaque,
    type_k: i32,
    type_v: i32,
    abort_callback: ?*anyopaque,
    abort_callback_data: ?*anyopaque,
    embeddings: bool,
    offload_kqv: bool,
    no_perf: bool,
    op_offload: bool,
    swa_full: bool,
    kv_unified: bool,
    samplers: ?*anyopaque,
    n_samplers: usize,
};

const llama_sampler_chain_params = extern struct {
    no_perf: bool,
};

const llama_batch = extern struct {
    n_tokens: i32,
    token: ?*llama_token,
    embd: ?*f32,
    pos: ?*llama_pos,
    n_seq_id: ?*i32,
    seq_id: ?*?*llama_seq_id,
    logits: ?*i8,
};

const llama_chat_message = extern struct {
    role: [*:0]const u8,
    content: [*:0]const u8,
};

const FnBackendInit = *const fn () callconv(.c) void;
const FnModelDefaultParams = *const fn () callconv(.c) llama_model_params;
const FnContextDefaultParams = *const fn () callconv(.c) llama_context_params;
const FnSamplerChainDefaultParams = *const fn () callconv(.c) llama_sampler_chain_params;
const FnModelLoadFromFile = *const fn (path: [*:0]const u8, params: llama_model_params) callconv(.c) ?*llama_model;
const FnModelFree = *const fn (model: *llama_model) callconv(.c) void;
const FnModelGetVocab = *const fn (model: *const llama_model) callconv(.c) *const llama_vocab;
const FnModelChatTemplate = *const fn (model: *const llama_model, name: ?[*:0]const u8) callconv(.c) ?[*:0]const u8;
const FnVocabIsEog = *const fn (vocab: *const llama_vocab, token: llama_token) callconv(.c) bool;
const FnInitFromModel = *const fn (model: *llama_model, params: llama_context_params) callconv(.c) ?*llama_context;
const FnFree = *const fn (ctx: *llama_context) callconv(.c) void;
const FnTokenize = *const fn (vocab: *const llama_vocab, text: [*]const u8, text_len: i32, tokens: ?*llama_token, n_max: i32, add_special: bool, parse_special: bool) callconv(.c) i32;
const FnTokenToPiece = *const fn (vocab: *const llama_vocab, token: llama_token, buf: [*]u8, length: i32, lstrip: i32, special: bool) callconv(.c) i32;
const FnChatApplyTemplate = *const fn (tmpl: ?[*:0]const u8, chat: [*]const llama_chat_message, n_msg: usize, add_ass: bool, buf: ?[*]u8, length: i32) callconv(.c) i32;
const FnBatchGetOne = *const fn (tokens: *llama_token, n_tokens: i32) callconv(.c) llama_batch;
const FnDecode = *const fn (ctx: *llama_context, batch: llama_batch) callconv(.c) i32;
const FnSamplerChainInit = *const fn (params: llama_sampler_chain_params) callconv(.c) ?*llama_sampler;
const FnSamplerChainAdd = *const fn (chain: *llama_sampler, smpl: *llama_sampler) callconv(.c) void;
const FnSamplerFree = *const fn (smpl: *llama_sampler) callconv(.c) void;
const FnSamplerInitTopK = *const fn (k: i32) callconv(.c) ?*llama_sampler;
const FnSamplerInitTopP = *const fn (p: f32, min_keep: usize) callconv(.c) ?*llama_sampler;
const FnSamplerInitMinP = *const fn (p: f32, min_keep: usize) callconv(.c) ?*llama_sampler;
const FnSamplerInitTemp = *const fn (t: f32) callconv(.c) ?*llama_sampler;
const FnSamplerInitPenalties = *const fn (n: i32, repeat: f32, freq: f32, present: f32) callconv(.c) ?*llama_sampler;
const FnSamplerInitDist = *const fn (seed: u32) callconv(.c) ?*llama_sampler;
const FnSamplerSample = *const fn (smpl: *llama_sampler, ctx: *llama_context, idx: i32) callconv(.c) llama_token;
const FnGetMemory = *const fn (ctx: *llama_context) callconv(.c) ?*llama_memory;
const FnMemoryClear = *const fn (mem: *llama_memory, data: bool) callconv(.c) void;

pub const SessionOptions = struct {
    cwd: ?[]const u8 = null,
    model_path: []const u8,
    system_prompt: ?[]const u8 = null,
    n_ctx: u32 = 2048,
    n_batch: u32 = 512,
    n_ubatch: u32 = 256,
    n_threads: i32 = 4,
    n_threads_batch: i32 = 4,
    n_gpu_layers: i32 = 99,
    max_history_messages: usize = 24,
    verbose: bool = true,
};

pub const TaskKind = enum {
    chat,
};

pub const SubmitOptions = struct {
    text: []const u8,
    task: TaskKind = .chat,
    system_prompt: ?[]const u8 = null,
    max_tokens: u32 = 256,
};

pub const EventKind = enum {
    system,
    assistant_part,
    status,
    result,
};

pub const OwnedEvent = struct {
    allocator: std.mem.Allocator = undefined,
    kind: EventKind,
    text: ?[]u8 = null,
    model: ?[]u8 = null,
    session_id: ?[]u8 = null,
    part_type: ?[]const u8 = null,
    is_error: bool = false,

    pub fn deinit(self: *OwnedEvent) void {
        if (self.text) |value| self.allocator.free(value);
        if (self.model) |value| self.allocator.free(value);
        if (self.session_id) |value| self.allocator.free(value);
    }
};

const Request = struct {
    text: []u8,
    task: TaskKind,
    system_prompt: ?[]u8,
    max_tokens: u32,

    fn deinit(self: *Request, allocator: std.mem.Allocator) void {
        allocator.free(self.text);
        if (self.system_prompt) |value| allocator.free(value);
    }
};

const HistoryRole = enum {
    system,
    user,
    assistant,
};

const HistoryMessage = struct {
    role: HistoryRole,
    content: []u8,

    fn deinit(self: *HistoryMessage, allocator: std.mem.Allocator) void {
        allocator.free(self.content);
    }
};

const LlamaApi = struct {
    lib: std.DynLib,
    backend_init: FnBackendInit,
    model_default_params: FnModelDefaultParams,
    context_default_params: FnContextDefaultParams,
    sampler_chain_default_params: FnSamplerChainDefaultParams,
    model_load_from_file: FnModelLoadFromFile,
    model_free: FnModelFree,
    model_get_vocab: FnModelGetVocab,
    model_chat_template: FnModelChatTemplate,
    vocab_is_eog: FnVocabIsEog,
    init_from_model: FnInitFromModel,
    free_context: FnFree,
    tokenize: FnTokenize,
    token_to_piece: FnTokenToPiece,
    chat_apply_template: FnChatApplyTemplate,
    batch_get_one: FnBatchGetOne,
    decode: FnDecode,
    sampler_chain_init: FnSamplerChainInit,
    sampler_chain_add: FnSamplerChainAdd,
    sampler_free: FnSamplerFree,
    sampler_init_top_k: FnSamplerInitTopK,
    sampler_init_top_p: FnSamplerInitTopP,
    sampler_init_min_p: FnSamplerInitMinP,
    sampler_init_temp: FnSamplerInitTemp,
    sampler_init_penalties: FnSamplerInitPenalties,
    sampler_init_dist: FnSamplerInitDist,
    sampler_sample: FnSamplerSample,
    get_memory: FnGetMemory,
    memory_clear: FnMemoryClear,

    fn load(allocator: std.mem.Allocator, cwd: ?[]const u8) !LlamaApi {
        const ext = if (builtin.os.tag == .macos) ".dylib" else ".so";
        const lib_name = try std.fmt.allocPrint(allocator, "libllama_ffi{s}", .{ext});
        defer allocator.free(lib_name);

        var candidates: std.ArrayList([]u8) = .{};
        defer {
            for (candidates.items) |item| allocator.free(item);
            candidates.deinit(allocator);
        }

        try candidates.append(allocator, try allocator.dupe(u8, lib_name));

        if (cwd) |value| {
            try candidates.append(allocator, try std.fs.path.join(allocator, &.{ value, "tsz", "zig-out", "lib", lib_name }));
            try candidates.append(allocator, try std.fs.path.join(allocator, &.{ value, "zig-out", "lib", lib_name }));
            try candidates.append(allocator, try std.fs.path.join(allocator, &.{ value, "lib", lib_name }));
        }

        const exe_path = std.fs.selfExePathAlloc(allocator) catch null;
        defer if (exe_path) |value| allocator.free(value);
        if (exe_path) |path| {
            if (std.fs.path.dirname(path)) |dir| {
                try candidates.append(allocator, try std.fs.path.join(allocator, &.{ dir, "..", "lib", lib_name }));
                try candidates.append(allocator, try std.fs.path.join(allocator, &.{ dir, "lib", lib_name }));
            }
        }

        var last_err: ?anyerror = null;
        for (candidates.items) |candidate| {
            var lib = std.DynLib.open(candidate) catch |err| {
                last_err = err;
                continue;
            };
            errdefer lib.close();

            return .{
                .lib = lib,
                .backend_init = lib.lookup(FnBackendInit, "llama_backend_init") orelse return error.MissingSymbol,
                .model_default_params = lib.lookup(FnModelDefaultParams, "llama_model_default_params") orelse return error.MissingSymbol,
                .context_default_params = lib.lookup(FnContextDefaultParams, "llama_context_default_params") orelse return error.MissingSymbol,
                .sampler_chain_default_params = lib.lookup(FnSamplerChainDefaultParams, "llama_sampler_chain_default_params") orelse return error.MissingSymbol,
                .model_load_from_file = lib.lookup(FnModelLoadFromFile, "llama_model_load_from_file") orelse return error.MissingSymbol,
                .model_free = lib.lookup(FnModelFree, "llama_model_free") orelse return error.MissingSymbol,
                .model_get_vocab = lib.lookup(FnModelGetVocab, "llama_model_get_vocab") orelse return error.MissingSymbol,
                .model_chat_template = lib.lookup(FnModelChatTemplate, "llama_model_chat_template") orelse return error.MissingSymbol,
                .vocab_is_eog = lib.lookup(FnVocabIsEog, "llama_vocab_is_eog") orelse return error.MissingSymbol,
                .init_from_model = lib.lookup(FnInitFromModel, "llama_init_from_model") orelse return error.MissingSymbol,
                .free_context = lib.lookup(FnFree, "llama_free") orelse return error.MissingSymbol,
                .tokenize = lib.lookup(FnTokenize, "llama_tokenize") orelse return error.MissingSymbol,
                .token_to_piece = lib.lookup(FnTokenToPiece, "llama_token_to_piece") orelse return error.MissingSymbol,
                .chat_apply_template = lib.lookup(FnChatApplyTemplate, "llama_chat_apply_template") orelse return error.MissingSymbol,
                .batch_get_one = lib.lookup(FnBatchGetOne, "llama_batch_get_one") orelse return error.MissingSymbol,
                .decode = lib.lookup(FnDecode, "llama_decode") orelse return error.MissingSymbol,
                .sampler_chain_init = lib.lookup(FnSamplerChainInit, "llama_sampler_chain_init") orelse return error.MissingSymbol,
                .sampler_chain_add = lib.lookup(FnSamplerChainAdd, "llama_sampler_chain_add") orelse return error.MissingSymbol,
                .sampler_free = lib.lookup(FnSamplerFree, "llama_sampler_free") orelse return error.MissingSymbol,
                .sampler_init_top_k = lib.lookup(FnSamplerInitTopK, "llama_sampler_init_top_k") orelse return error.MissingSymbol,
                .sampler_init_top_p = lib.lookup(FnSamplerInitTopP, "llama_sampler_init_top_p") orelse return error.MissingSymbol,
                .sampler_init_min_p = lib.lookup(FnSamplerInitMinP, "llama_sampler_init_min_p") orelse return error.MissingSymbol,
                .sampler_init_temp = lib.lookup(FnSamplerInitTemp, "llama_sampler_init_temp") orelse return error.MissingSymbol,
                .sampler_init_penalties = lib.lookup(FnSamplerInitPenalties, "llama_sampler_init_penalties") orelse return error.MissingSymbol,
                .sampler_init_dist = lib.lookup(FnSamplerInitDist, "llama_sampler_init_dist") orelse return error.MissingSymbol,
                .sampler_sample = lib.lookup(FnSamplerSample, "llama_sampler_sample") orelse return error.MissingSymbol,
                .get_memory = lib.lookup(FnGetMemory, "llama_get_memory") orelse return error.MissingSymbol,
                .memory_clear = lib.lookup(FnMemoryClear, "llama_memory_clear") orelse return error.MissingSymbol,
            };
        }

        if (last_err) |err| return err;
        return error.LibraryNotFound;
    }

    fn close(self: *LlamaApi) void {
        self.lib.close();
    }
};

const WorkerState = struct {
    allocator: std.mem.Allocator,
    options: SessionOptions,
    api: ?LlamaApi = null,
    resolved_model_path: ?[]u8 = null,
    model: ?*llama_model = null,
    ctx: ?*llama_context = null,
    vocab: ?*const llama_vocab = null,
    chat_template: ?[:0]u8 = null,
    history: std.ArrayList(HistoryMessage),

    fn init(allocator: std.mem.Allocator, options: SessionOptions) WorkerState {
        return .{
            .allocator = allocator,
            .options = options,
            .history = .{},
        };
    }

    fn deinit(self: *WorkerState) void {
        for (self.history.items) |*item| item.deinit(self.allocator);
        self.history.deinit(self.allocator);
        if (self.chat_template) |value| self.allocator.free(value);
        if (self.ctx) |ctx| {
            if (self.api) |api| api.free_context(ctx);
        }
        if (self.model) |model| {
            if (self.api) |api| api.model_free(model);
        }
        if (self.resolved_model_path) |value| self.allocator.free(value);
        if (self.api) |*api| api.close();
    }

    fn load(self: *WorkerState) !void {
        var api = try LlamaApi.load(self.allocator, self.options.cwd);
        errdefer api.close();

        self.resolved_model_path = try resolveModelPathAlloc(self.allocator, self.options.cwd, self.options.model_path);
        errdefer {
            if (self.resolved_model_path) |value| self.allocator.free(value);
            self.resolved_model_path = null;
        }

        api.backend_init();

        const model_path_z = try self.allocator.dupeZ(u8, self.resolved_model_path.?);
        defer self.allocator.free(model_path_z);

        var mparams = api.model_default_params();
        mparams.n_gpu_layers = self.options.n_gpu_layers;

        const model = api.model_load_from_file(model_path_z, mparams) orelse return error.ModelLoadFailed;
        errdefer api.model_free(model);

        const vocab = api.model_get_vocab(model);

        if (api.model_chat_template(model, null)) |tmpl| {
            self.chat_template = try self.allocator.dupeZ(u8, std.mem.span(tmpl));
        }

        var cparams = api.context_default_params();
        cparams.n_ctx = self.options.n_ctx;
        cparams.n_batch = self.options.n_batch;
        cparams.n_ubatch = self.options.n_ubatch;
        cparams.n_threads = self.options.n_threads;
        cparams.n_threads_batch = self.options.n_threads_batch;
        cparams.no_perf = true;

        const ctx = api.init_from_model(model, cparams) orelse return error.ContextInitFailed;

        self.api = api;
        self.model = model;
        self.ctx = ctx;
        self.vocab = vocab;

        if (self.options.system_prompt) |value| {
            try self.history.append(self.allocator, .{
                .role = .system,
                .content = try self.allocator.dupe(u8, value),
            });
        }
    }

    fn generateReply(self: *WorkerState, session: *Session, req: *const Request) !void {
        const api = &(self.api orelse return error.NotReady);
        const ctx = self.ctx orelse return error.NotReady;
        const vocab = self.vocab orelse return error.NotReady;

        try self.history.append(self.allocator, .{
            .role = .user,
            .content = try self.allocator.dupe(u8, req.text),
        });
        errdefer {
            if (self.history.pop()) |last_value| {
                var last = last_value;
                last.deinit(self.allocator);
            }
        }

        trimHistory(self);

        const formatted = try self.buildPromptText();
        defer self.allocator.free(formatted);

        if (api.get_memory(ctx)) |mem| api.memory_clear(mem, true);

        const n_probe = api.tokenize(vocab, formatted.ptr, @intCast(formatted.len), null, 0, true, true);
        if (n_probe == 0) return error.TokenizeFailed;
        const token_count: i32 = if (n_probe < 0) -n_probe else n_probe;
        const tokens = try self.allocator.alloc(llama_token, @intCast(token_count));
        defer self.allocator.free(tokens);

        const tokenized = api.tokenize(vocab, formatted.ptr, @intCast(formatted.len), @ptrCast(tokens.ptr), token_count, true, true);
        if (tokenized < 0) return error.TokenizeFailed;

        var batch = api.batch_get_one(@ptrCast(tokens.ptr), tokenized);
        const prefill_rc = api.decode(ctx, batch);
        if (prefill_rc != 0) return error.PrefillFailed;

        var sampler_params = api.sampler_chain_default_params();
        sampler_params.no_perf = true;
        const sampler = api.sampler_chain_init(sampler_params) orelse return error.SamplerInitFailed;
        defer api.sampler_free(sampler);

        api.sampler_chain_add(sampler, api.sampler_init_top_k(40) orelse return error.SamplerInitFailed);
        api.sampler_chain_add(sampler, api.sampler_init_top_p(0.9, 1) orelse return error.SamplerInitFailed);
        api.sampler_chain_add(sampler, api.sampler_init_min_p(0.05, 1) orelse return error.SamplerInitFailed);
        api.sampler_chain_add(sampler, api.sampler_init_temp(0.7) orelse return error.SamplerInitFailed);
        api.sampler_chain_add(sampler, api.sampler_init_penalties(64, 1.1, 0, 0) orelse return error.SamplerInitFailed);
        api.sampler_chain_add(sampler, api.sampler_init_dist(@intCast(@mod(std.time.milliTimestamp(), std.math.maxInt(u32)))) orelse return error.SamplerInitFailed);

        var out: std.ArrayList(u8) = .{};
        defer out.deinit(self.allocator);

        var generated: u32 = 0;
        while (!session.should_stop.load(.seq_cst) and generated < req.max_tokens) : (generated += 1) {
            var token_id = api.sampler_sample(sampler, ctx, -1);
            if (api.vocab_is_eog(vocab, token_id)) break;

            var piece_buf: [512]u8 = undefined;
            const piece_len = api.token_to_piece(vocab, token_id, &piece_buf, piece_buf.len, 0, false);
            if (piece_len < 0) return error.PieceDecodeFailed;
            if (piece_len > 0) {
                const piece = piece_buf[0..@intCast(piece_len)];
                try out.appendSlice(self.allocator, piece);
                try session.pushAssistantPart(piece);
            }

            batch = api.batch_get_one(&token_id, 1);
            const decode_rc = api.decode(ctx, batch);
            if (decode_rc != 0) return error.DecodeFailed;
        }

        if (session.should_stop.load(.seq_cst)) return;

        const reply = try out.toOwnedSlice(self.allocator);
        errdefer self.allocator.free(reply);
        try self.history.append(self.allocator, .{
            .role = .assistant,
            .content = reply,
        });
        trimHistory(self);
    }

    fn buildPromptText(self: *WorkerState) ![]u8 {
        if (self.chat_template) |tmpl| {
            const n = self.history.items.len;
            const c_msgs = try self.allocator.alloc(llama_chat_message, n);
            defer self.allocator.free(c_msgs);

            const role_z = try self.allocator.alloc([:0]u8, n);
            defer self.allocator.free(role_z);
            const content_z = try self.allocator.alloc([:0]u8, n);
            defer {
                for (content_z) |value| self.allocator.free(value);
            }

            for (self.history.items, 0..) |msg, i| {
                role_z[i] = try self.allocator.dupeZ(u8, roleName(msg.role));
                content_z[i] = try self.allocator.dupeZ(u8, msg.content);
                c_msgs[i] = .{
                    .role = role_z[i].ptr,
                    .content = content_z[i].ptr,
                };
            }

            const api = &(self.api orelse return error.NotReady);
            const needed = api.chat_apply_template(tmpl.ptr, c_msgs.ptr, n, true, null, 0);
            if (needed < 0) return error.TemplateFailed;

            const buf = try self.allocator.alloc(u8, @intCast(needed + 1));
            errdefer self.allocator.free(buf);

            const written = api.chat_apply_template(tmpl.ptr, c_msgs.ptr, n, true, buf.ptr, needed + 1);
            if (written < 0) return error.TemplateFailed;
            return buf[0..@intCast(written)];
        }

        var buf: std.ArrayList(u8) = .{};
        defer buf.deinit(self.allocator);

        for (self.history.items) |msg| {
            try buf.writer(self.allocator).print("{s}: {s}\n", .{ roleName(msg.role), msg.content });
        }
        try buf.appendSlice(self.allocator, "assistant: ");
        return try buf.toOwnedSlice(self.allocator);
    }
};

pub const Session = struct {
    allocator: std.mem.Allocator,
    options: SessionOptions,
    requests: RingBuffer(Request, 32) = .{},
    events: RingBuffer(OwnedEvent, 1024) = .{},
    worker: ?std.Thread = null,
    should_stop: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),

    pub fn create(allocator: std.mem.Allocator, options: SessionOptions) !*Session {
        const session = try allocator.create(Session);
        errdefer allocator.destroy(session);

        session.* = .{
            .allocator = allocator,
            .options = .{
                .cwd = if (options.cwd) |value| try allocator.dupe(u8, value) else null,
                .model_path = try allocator.dupe(u8, options.model_path),
                .system_prompt = if (options.system_prompt) |value| try allocator.dupe(u8, value) else null,
                .n_ctx = options.n_ctx,
                .n_batch = options.n_batch,
                .n_ubatch = options.n_ubatch,
                .n_threads = options.n_threads,
                .n_threads_batch = options.n_threads_batch,
                .n_gpu_layers = options.n_gpu_layers,
                .max_history_messages = options.max_history_messages,
                .verbose = options.verbose,
            },
        };
        errdefer session.deinitInternal();

        session.worker = try std.Thread.spawn(.{ .stack_size = 4 * 1024 * 1024 }, workerMain, .{session});
        return session;
    }

    pub fn destroy(self: *Session) void {
        self.close();
        self.deinitInternal();
        self.allocator.destroy(self);
    }

    pub fn close(self: *Session) void {
        self.should_stop.store(true, .seq_cst);
        if (self.worker) |thread| {
            thread.join();
            self.worker = null;
        }
    }

    pub fn submit(self: *Session, options: SubmitOptions) !void {
        if (self.should_stop.load(.seq_cst)) return error.SessionClosed;

        var req = Request{
            .text = try self.allocator.dupe(u8, options.text),
            .task = options.task,
            .system_prompt = if (options.system_prompt) |value| try self.allocator.dupe(u8, value) else null,
            .max_tokens = options.max_tokens,
        };
        errdefer req.deinit(self.allocator);

        if (!self.requests.push(req)) return error.QueueFull;
    }

    pub fn poll(self: *Session) ?OwnedEvent {
        return self.events.pop();
    }

    fn pushAssistantPart(self: *Session, text: []const u8) !void {
        try self.pushEvent(.{
            .kind = .assistant_part,
            .text = try self.allocator.dupe(u8, text),
            .part_type = "text",
        });
    }

    fn pushSystem(self: *Session, model: []const u8, session_id: []const u8) !void {
        try self.pushEvent(.{
            .kind = .system,
            .model = try self.allocator.dupe(u8, model),
            .session_id = try self.allocator.dupe(u8, session_id),
        });
    }

    fn pushStatus(self: *Session, text: []const u8, is_error: bool) !void {
        try self.pushEvent(.{
            .kind = .status,
            .text = try self.allocator.dupe(u8, text),
            .is_error = is_error,
        });
    }

    fn pushResult(self: *Session, text: ?[]const u8, is_error: bool) !void {
        try self.pushEvent(.{
            .kind = .result,
            .text = if (text) |value| try self.allocator.dupe(u8, value) else null,
            .is_error = is_error,
        });
    }

    fn pushEvent(self: *Session, event: OwnedEvent) !void {
        var owned = event;
        owned.allocator = self.allocator;
        if (!self.events.push(owned)) {
            owned.deinit();
            return error.QueueFull;
        }
    }

    fn deinitInternal(self: *Session) void {
        if (self.options.cwd) |value| self.allocator.free(value);
        self.allocator.free(self.options.model_path);
        if (self.options.system_prompt) |value| self.allocator.free(value);

        while (self.requests.pop()) |req| {
            var owned = req;
            owned.deinit(self.allocator);
        }
        while (self.events.pop()) |evt| {
            var owned = evt;
            owned.deinit();
        }
    }
};

fn workerMain(session: *Session) void {
    var state = WorkerState.init(session.allocator, session.options);
    defer state.deinit();

    session.pushStatus("loading local model...", false) catch {};
    state.load() catch |err| {
        const text = std.fmt.allocPrint(session.allocator, "local init failed: {s}", .{@errorName(err)}) catch null;
        defer if (text) |value| session.allocator.free(value);
        if (text) |value| {
            session.pushStatus(value, true) catch {};
            session.pushResult(value, true) catch {};
        }
        return;
    };

    const model_label = basenameFromPath(state.resolved_model_path.?);
    const session_id = std.fmt.allocPrint(session.allocator, "local:{s}", .{model_label}) catch null;
    defer if (session_id) |value| session.allocator.free(value);
    if (session_id) |value| {
        session.pushSystem(state.resolved_model_path.?, value) catch {};
    }
    session.pushStatus("local model ready", false) catch {};

    while (!session.should_stop.load(.seq_cst)) {
        if (session.requests.pop()) |req| {
            var owned = req;
            defer owned.deinit(session.allocator);

            if (owned.system_prompt) |override| {
                setSystemPrompt(&state, override) catch {};
            }

            state.generateReply(session, &owned) catch |err| {
                const text = std.fmt.allocPrint(session.allocator, "local generation failed: {s}", .{@errorName(err)}) catch null;
                defer if (text) |value| session.allocator.free(value);
                if (text) |value| {
                    session.pushStatus(value, true) catch {};
                    session.pushResult(value, true) catch {};
                }
                continue;
            };

            if (!session.should_stop.load(.seq_cst)) {
                session.pushResult(null, false) catch {};
            }
        } else {
            std.Thread.sleep(1 * std.time.ns_per_ms);
        }
    }
}

fn setSystemPrompt(state: *WorkerState, text: []const u8) !void {
    if (state.history.items.len > 0 and state.history.items[0].role == .system) {
        var old = state.history.items[0];
        old.deinit(state.allocator);
        state.history.items[0] = .{
            .role = .system,
            .content = try state.allocator.dupe(u8, text),
        };
        return;
    }

    try state.history.insert(state.allocator, 0, .{
        .role = .system,
        .content = try state.allocator.dupe(u8, text),
    });
}

fn trimHistory(state: *WorkerState) void {
    while (state.history.items.len > state.options.max_history_messages) {
        const remove_idx: usize = if (state.history.items.len > 0 and state.history.items[0].role == .system) 1 else 0;
        if (remove_idx >= state.history.items.len) break;
        var msg = state.history.orderedRemove(remove_idx);
        msg.deinit(state.allocator);
    }
}

fn roleName(role: HistoryRole) []const u8 {
    return switch (role) {
        .system => "system",
        .user => "user",
        .assistant => "assistant",
    };
}

fn basenameFromPath(path: []const u8) []const u8 {
    return std.fs.path.basename(path);
}

fn resolveModelPathAlloc(allocator: std.mem.Allocator, cwd: ?[]const u8, model_path: []const u8) ![]u8 {
    if (std.fs.path.isAbsolute(model_path)) return allocator.dupe(u8, model_path);
    if (cwd) |value| return std.fs.path.join(allocator, &.{ value, model_path });
    return allocator.dupe(u8, model_path);
}

test "basenameFromPath keeps tail segment" {
    try std.testing.expectEqualStrings("qwen.gguf", basenameFromPath("/tmp/models/qwen.gguf"));
}

test "resolveModelPathAlloc joins cwd when relative" {
    const allocator = std.testing.allocator;
    const joined = try resolveModelPathAlloc(allocator, "/tmp/project", "models/qwen.gguf");
    defer allocator.free(joined);
    try std.testing.expectEqualStrings("/tmp/project/models/qwen.gguf", joined);
}
