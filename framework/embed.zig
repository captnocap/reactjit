//! framework/embed.zig — local embedding + retrieval backed by libllama_ffi
//! and pgvector. Lifted (mostly verbatim) from
//! experiments/embed-bench/src/main.zig so the cart-side `useEmbed` /
//! `embed.ts` hooks talk to exactly the same code path that the
//! ingest/query benchmark used.
//!
//! Public surface (consumed by v8_bindings_embed.zig):
//!
//!   Embedder.init(modelPath)            load .gguf into VRAM
//!   Embedder.deinit()                   free model + context
//!   Embedder.nDim                       embedding dimension
//!   Embedder.embedText(allocator, text) -> ![]f32   single, normalized
//!   Embedder.embedBatch(allocator, []const []const u8) -> ![][]f32
//!
//!   Reranker.init(modelPath)
//!   Reranker.deinit()
//!   Reranker.score(allocator, query, doc) -> !f32
//!
//!   Store.open(allocator, modelSlug, dim) -> !Store
//!   Store.close()
//!   Store.upsert(...)
//!   Store.searchTopNFiltered(allocator, vec, n, sourceTypeFilter) -> ![]SearchHit
//!   Store.buildPartialHnsw(sourceType)
//!
//! Linked at build time against tsz/zig-out/lib/libllama_ffi.so. The cart
//! binary ships with `-rpath $ORIGIN`; scripts/ship copies the .so next to
//! the executable so it's self-contained.

const std = @import("std");
const pg = @import("pg");
const fpg = @import("pg.zig");

// ── llama.cpp ABI ───────────────────────────────────────────────────────
// Hand-rolled extern bindings. Layouts must match the .so we link against
// (currently the build at tsz/zig-out/lib/libllama_ffi.so). Mirrors what
// experiments/embed-bench uses, which we've validated against real models.

const c = struct {
    pub const llama_model = opaque {};
    pub const llama_context = opaque {};
    pub const llama_vocab = opaque {};
    pub const llama_memory = opaque {};
    pub const llama_token = i32;
    pub const llama_pos = i32;
    pub const llama_seq_id = i32;

    pub const llama_model_params = extern struct {
        devices: ?*anyopaque,
        tensor_buft_overrides: ?*const anyopaque,
        n_gpu_layers: i32,
        split_mode: i32,
        main_gpu: i32,
        tensor_split: ?*const f32,
        progress_callback: ?*const anyopaque,
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

    pub const llama_context_params = extern struct {
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

    pub const llama_batch = extern struct {
        n_tokens: i32,
        token: [*c]llama_token,
        embd: [*c]f32,
        pos: [*c]llama_pos,
        n_seq_id: [*c]i32,
        seq_id: [*c][*c]llama_seq_id,
        logits: [*c]i8,
    };

    pub extern "c" fn llama_backend_init() void;
    pub extern "c" fn llama_backend_free() void;
    pub extern "c" fn llama_model_default_params() llama_model_params;
    pub extern "c" fn llama_context_default_params() llama_context_params;
    pub extern "c" fn llama_model_load_from_file(path: [*c]const u8, params: llama_model_params) ?*llama_model;
    pub extern "c" fn llama_model_free(model: ?*llama_model) void;
    pub extern "c" fn llama_model_get_vocab(model: ?*const llama_model) ?*const llama_vocab;
    pub extern "c" fn llama_model_n_embd(model: ?*const llama_model) i32;
    pub extern "c" fn llama_init_from_model(model: ?*llama_model, params: llama_context_params) ?*llama_context;
    pub extern "c" fn llama_free(ctx: ?*llama_context) void;
    pub extern "c" fn llama_n_ctx(ctx: ?*const llama_context) u32;
    pub extern "c" fn llama_get_memory(ctx: ?*llama_context) ?*llama_memory;
    pub extern "c" fn llama_memory_clear(mem: ?*llama_memory, data: bool) void;
    pub extern "c" fn llama_tokenize(
        vocab: ?*const llama_vocab,
        text: [*c]const u8,
        text_len: i32,
        tokens: [*c]llama_token,
        n_tokens_max: i32,
        add_special: bool,
        parse_special: bool,
    ) i32;
    pub extern "c" fn llama_batch_init(n_tokens: i32, embd: i32, n_seq_max: i32) llama_batch;
    pub extern "c" fn llama_batch_free(batch: llama_batch) void;
    pub extern "c" fn llama_decode(ctx: ?*llama_context, batch: llama_batch) i32;
    pub extern "c" fn llama_get_embeddings(ctx: ?*llama_context) [*c]f32;
    pub extern "c" fn llama_get_embeddings_seq(ctx: ?*llama_context, seq_id: llama_seq_id) [*c]f32;
    pub extern "c" fn llama_get_logits_ith(ctx: ?*llama_context, i: i32) [*c]f32;
};

// ── helpers ─────────────────────────────────────────────────────────────

pub fn shaHex(input: []const u8) [64]u8 {
    var hash: [32]u8 = undefined;
    std.crypto.hash.sha2.Sha256.hash(input, &hash, .{});
    var hex: [64]u8 = undefined;
    const alphabet = "0123456789abcdef";
    for (hash, 0..) |b, i| {
        hex[i * 2] = alphabet[b >> 4];
        hex[i * 2 + 1] = alphabet[b & 0xf];
    }
    return hex;
}

pub fn sanitizeUtf8(allocator: std.mem.Allocator, s: []const u8) ![]u8 {
    var out = std.array_list.Managed(u8).init(allocator);
    errdefer out.deinit();
    var i: usize = 0;
    while (i < s.len) {
        const len = std.unicode.utf8ByteSequenceLength(s[i]) catch {
            try out.append('?');
            i += 1;
            continue;
        };
        if (i + len > s.len) {
            try out.append('?');
            i += 1;
            continue;
        }
        const slice = s[i .. i + len];
        _ = std.unicode.utf8Decode(slice) catch {
            try out.append('?');
            i += 1;
            continue;
        };
        try out.appendSlice(slice);
        i += len;
    }
    return out.toOwnedSlice();
}

pub fn sqlEscape(allocator: std.mem.Allocator, s: []const u8) ![]u8 {
    var out = std.array_list.Managed(u8).init(allocator);
    errdefer out.deinit();
    for (s) |b| {
        if (b == '\'') {
            try out.appendSlice("''");
        } else {
            try out.append(b);
        }
    }
    return out.toOwnedSlice();
}

pub fn sanitizeTableSuffix(allocator: std.mem.Allocator, slug: []const u8) ![]u8 {
    var out = std.array_list.Managed(u8).init(allocator);
    errdefer out.deinit();
    for (slug) |b| {
        const lower = if (b >= 'A' and b <= 'Z') b + 32 else b;
        if ((lower >= 'a' and lower <= 'z') or (lower >= '0' and lower <= '9') or lower == '_') {
            try out.append(lower);
        } else {
            try out.append('_');
        }
    }
    return out.toOwnedSlice();
}

// ── Embedder (one process-wide model + one context) ────────────────────

pub const Embedder = struct {
    model: ?*c.llama_model,
    ctx: ?*c.llama_context,
    vocab: ?*const c.llama_vocab,
    n_embd: usize,
    n_ctx: u32,

    pub fn init(model_path: []const u8) !Embedder {
        c.llama_backend_init();

        var mparams = c.llama_model_default_params();
        mparams.n_gpu_layers = 999;

        const model_path_z = try std.heap.c_allocator.dupeZ(u8, model_path);
        defer std.heap.c_allocator.free(model_path_z);

        const model = c.llama_model_load_from_file(model_path_z.ptr, mparams);
        if (model == null) return error.FailedToLoadModel;

        const vocab = c.llama_model_get_vocab(model);
        const n_embd = c.llama_model_n_embd(model);

        var cparams = c.llama_context_default_params();
        cparams.n_ctx = 8192;
        cparams.n_batch = 8192;
        cparams.n_ubatch = 2048;
        cparams.embeddings = true;
        cparams.pooling_type = -1;
        cparams.no_perf = true;
        cparams.n_seq_max = 16;
        cparams.kv_unified = true;

        const ctx = c.llama_init_from_model(model, cparams);
        if (ctx == null) {
            c.llama_model_free(model);
            return error.FailedToInitContext;
        }

        return .{
            .model = model,
            .ctx = ctx,
            .vocab = vocab,
            .n_embd = @intCast(n_embd),
            .n_ctx = cparams.n_ctx,
        };
    }

    pub fn deinit(self: *Embedder) void {
        if (self.ctx) |x| c.llama_free(x);
        if (self.model) |m| c.llama_model_free(m);
        // Note: llama_backend_free is process-global. We leave it alone so a
        // cart that loads a second model doesn't deinitialize the backend
        // out from under the first.
    }

    /// Embed a single text. Caller owns the returned slice.
    pub fn embedText(self: *Embedder, allocator: std.mem.Allocator, text: []const u8) ![]f32 {
        const probe_len = -c.llama_tokenize(self.vocab, text.ptr, @intCast(text.len), null, 0, true, true);
        if (probe_len <= 0) return error.TokenizeProbeFailed;

        const max_tokens: usize = @min(@as(usize, @abs(probe_len)), @as(usize, @intCast(self.n_ctx)));
        const tokens = try allocator.alloc(c.llama_token, max_tokens);
        defer allocator.free(tokens);

        const tk = c.llama_tokenize(self.vocab, text.ptr, @intCast(text.len), tokens.ptr, @intCast(tokens.len), true, true);
        if (tk < 0) return error.TokenizeFailed;
        const n_tokens: usize = @intCast(tk);

        const mem = c.llama_get_memory(self.ctx);
        if (mem != null) c.llama_memory_clear(mem, true);

        var batch = c.llama_batch_init(@intCast(n_tokens), 0, 1);
        defer c.llama_batch_free(batch);

        var i: usize = 0;
        while (i < n_tokens) : (i += 1) {
            batch.token[i] = tokens[i];
            batch.pos[i] = @intCast(i);
            batch.n_seq_id[i] = 1;
            batch.seq_id[i][0] = 0;
            batch.logits[i] = if (i == n_tokens - 1) 1 else 0;
        }
        batch.n_tokens = @intCast(n_tokens);

        const dr = c.llama_decode(self.ctx, batch);
        if (dr != 0) return error.DecodeFailed;

        var raw = c.llama_get_embeddings_seq(self.ctx, 0);
        if (raw == null) raw = c.llama_get_embeddings(self.ctx);
        if (raw == null) return error.NoEmbeddingsReturned;

        const out = try allocator.alloc(f32, self.n_embd);
        var sumsq: f64 = 0.0;
        var k: usize = 0;
        while (k < self.n_embd) : (k += 1) {
            const v = raw[k];
            out[k] = v;
            sumsq += @as(f64, v) * @as(f64, v);
        }
        const norm = @sqrt(sumsq);
        if (norm > 0.0) {
            const inv: f32 = @floatCast(1.0 / norm);
            k = 0;
            while (k < self.n_embd) : (k += 1) out[k] *= inv;
        }
        return out;
    }

    /// Batched embed: pack N sequences into one llama_decode dispatch.
    pub fn embedBatch(self: *Embedder, allocator: std.mem.Allocator, texts: []const []const u8) ![][]f32 {
        if (texts.len == 0) return try allocator.alloc([]f32, 0);
        if (texts.len == 1) {
            const out = try allocator.alloc([]f32, 1);
            out[0] = try self.embedText(allocator, texts[0]);
            return out;
        }

        const per_seq_cap: usize = (@as(usize, @intCast(self.n_ctx)) - 8) / texts.len;
        if (per_seq_cap < 8) return error.BatchTooLarge;

        var seq_tokens = try allocator.alloc([]c.llama_token, texts.len);
        defer {
            for (seq_tokens) |t| allocator.free(t);
            allocator.free(seq_tokens);
        }
        for (seq_tokens) |*s| s.* = &.{};

        var total_tokens: usize = 0;
        for (texts, 0..) |text, i| {
            const probe_len = -c.llama_tokenize(self.vocab, text.ptr, @intCast(text.len), null, 0, true, true);
            if (probe_len <= 0) continue;
            const want: usize = @min(@as(usize, @abs(probe_len)), per_seq_cap);
            const buf = try allocator.alloc(c.llama_token, want);
            const tk = c.llama_tokenize(self.vocab, text.ptr, @intCast(text.len), buf.ptr, @intCast(want), true, true);
            if (tk <= 0) {
                allocator.free(buf);
                continue;
            }
            seq_tokens[i] = buf[0..@intCast(tk)];
            total_tokens += seq_tokens[i].len;
        }

        if (total_tokens == 0) {
            const out = try allocator.alloc([]f32, texts.len);
            for (out) |*v| {
                const z = try allocator.alloc(f32, self.n_embd);
                @memset(z, 0);
                v.* = z;
            }
            return out;
        }

        const mem = c.llama_get_memory(self.ctx);
        if (mem != null) c.llama_memory_clear(mem, true);

        var batch = c.llama_batch_init(@intCast(total_tokens), 0, @intCast(texts.len));
        defer c.llama_batch_free(batch);

        var tok_idx: usize = 0;
        for (seq_tokens, 0..) |toks, seq_idx| {
            for (toks, 0..) |tok, pos_in_seq| {
                batch.token[tok_idx] = tok;
                batch.pos[tok_idx] = @intCast(pos_in_seq);
                batch.n_seq_id[tok_idx] = 1;
                batch.seq_id[tok_idx][0] = @intCast(seq_idx);
                batch.logits[tok_idx] = if (pos_in_seq == toks.len - 1) 1 else 0;
                tok_idx += 1;
            }
        }
        batch.n_tokens = @intCast(total_tokens);

        const dr = c.llama_decode(self.ctx, batch);
        if (dr != 0) return error.DecodeFailed;

        var out = try allocator.alloc([]f32, texts.len);
        errdefer {
            for (out) |v| allocator.free(v);
            allocator.free(out);
        }

        for (0..texts.len) |seq_idx| {
            const v = try allocator.alloc(f32, self.n_embd);
            const raw = c.llama_get_embeddings_seq(self.ctx, @intCast(seq_idx));
            if (raw == null or seq_tokens[seq_idx].len == 0) {
                @memset(v, 0);
                out[seq_idx] = v;
                continue;
            }
            var sumsq: f64 = 0.0;
            for (0..self.n_embd) |k| {
                const x = raw[k];
                v[k] = x;
                sumsq += @as(f64, x) * @as(f64, x);
            }
            const norm = @sqrt(sumsq);
            if (norm > 0.0) {
                const inv: f32 = @floatCast(1.0 / norm);
                for (v) |*x| x.* *= inv;
            }
            out[seq_idx] = v;
        }
        return out;
    }
};

// ── Reranker (cross-encoder) ────────────────────────────────────────────

fn tokenizeOne(vocab: ?*const c.llama_vocab, text: []const u8) !c.llama_token {
    var buf: [4]c.llama_token = undefined;
    const tk = c.llama_tokenize(vocab, text.ptr, @intCast(text.len), &buf[0], buf.len, false, false);
    if (tk <= 0) return error.TokenizeFailed;
    return buf[0];
}

pub const Reranker = struct {
    model: ?*c.llama_model,
    ctx: ?*c.llama_context,
    vocab: ?*const c.llama_vocab,
    n_ctx: usize,
    yes_token: c.llama_token,
    no_token: c.llama_token,

    pub fn init(model_path: []const u8) !Reranker {
        c.llama_backend_init();

        var mparams = c.llama_model_default_params();
        mparams.n_gpu_layers = 999;

        const model_path_z = try std.heap.c_allocator.dupeZ(u8, model_path);
        defer std.heap.c_allocator.free(model_path_z);

        const model = c.llama_model_load_from_file(model_path_z.ptr, mparams);
        if (model == null) return error.FailedToLoadModel;

        const vocab = c.llama_model_get_vocab(model);

        var cparams = c.llama_context_default_params();
        cparams.n_ctx = 8192;
        cparams.n_batch = 8192;
        cparams.n_ubatch = 2048;
        cparams.embeddings = false;
        cparams.no_perf = true;

        const ctx = c.llama_init_from_model(model, cparams);
        if (ctx == null) {
            c.llama_model_free(model);
            return error.FailedToInitContext;
        }

        const yes_token = try tokenizeOne(vocab, "yes");
        const no_token = try tokenizeOne(vocab, "no");

        return .{
            .model = model,
            .ctx = ctx,
            .vocab = vocab,
            .n_ctx = 8192,
            .yes_token = yes_token,
            .no_token = no_token,
        };
    }

    pub fn deinit(self: *Reranker) void {
        if (self.ctx) |ctx| c.llama_free(ctx);
        if (self.model) |model| c.llama_model_free(model);
    }

    pub fn score(self: *Reranker, allocator: std.mem.Allocator, query: []const u8, document: []const u8) !f32 {
        const doc_max: usize = 6000;
        const query_max: usize = 500;
        const doc_use = if (document.len > doc_max) document[0..doc_max] else document;
        const query_use = if (query.len > query_max) query[0..query_max] else query;

        const instruction = "Given a search query, retrieve relevant chunks that answer the query.";
        const prompt = try std.fmt.allocPrint(
            allocator,
            "<|im_start|>system\n" ++
                "Judge whether the Document meets the requirements based on the Query and the Instruct provided. Note that the answer can only be \"yes\" or \"no\".<|im_end|>\n" ++
                "<|im_start|>user\n" ++
                "<Instruct>: {s}\n<Query>: {s}\n<Document>: {s}<|im_end|>\n" ++
                "<|im_start|>assistant\n<think>\n\n</think>\n\n",
            .{ instruction, query_use, doc_use },
        );
        defer allocator.free(prompt);

        const probe_len = -c.llama_tokenize(self.vocab, prompt.ptr, @intCast(prompt.len), null, 0, true, true);
        if (probe_len <= 0) return error.TokenizeProbeFailed;

        const max_tokens: usize = @min(@as(usize, @abs(probe_len)), self.n_ctx);
        const tokens = try allocator.alloc(c.llama_token, max_tokens);
        defer allocator.free(tokens);

        const tk = c.llama_tokenize(self.vocab, prompt.ptr, @intCast(prompt.len), tokens.ptr, @intCast(tokens.len), true, true);
        if (tk < 0) return error.TokenizeFailed;
        const n_tokens: usize = @intCast(tk);

        const mem = c.llama_get_memory(self.ctx);
        if (mem != null) c.llama_memory_clear(mem, true);

        var batch = c.llama_batch_init(@intCast(n_tokens), 0, 1);
        defer c.llama_batch_free(batch);

        var i: usize = 0;
        while (i < n_tokens) : (i += 1) {
            batch.token[i] = tokens[i];
            batch.pos[i] = @intCast(i);
            batch.n_seq_id[i] = 1;
            batch.seq_id[i][0] = 0;
            batch.logits[i] = if (i == n_tokens - 1) 1 else 0;
        }
        batch.n_tokens = @intCast(n_tokens);

        const dr = c.llama_decode(self.ctx, batch);
        if (dr != 0) return error.DecodeFailed;

        const logits = c.llama_get_logits_ith(self.ctx, -1);
        if (logits == null) return error.NoLogits;

        const yes_logit = logits[@as(usize, @intCast(self.yes_token))];
        const no_logit = logits[@as(usize, @intCast(self.no_token))];

        const max_l = @max(yes_logit, no_logit);
        const e_yes = @exp(yes_logit - max_l);
        const e_no = @exp(no_logit - max_l);
        return e_yes / (e_yes + e_no);
    }
};

// ── pgvector store ──────────────────────────────────────────────────────

pub const SearchHit = struct {
    id: []u8,
    source_id: []u8,
    chunk_index: i32,
    text_preview: []u8,
    display_text: []u8,
    dense_score: f64,
};

pub fn freeHits(allocator: std.mem.Allocator, hits: []SearchHit) void {
    for (hits) |*h| {
        allocator.free(h.id);
        allocator.free(h.source_id);
        allocator.free(h.text_preview);
        allocator.free(h.display_text);
    }
    allocator.free(hits);
}

pub const Store = struct {
    pool: *pg.Pool,
    allocator: std.mem.Allocator,
    dim: usize,
    /// Per-model table name like "chunks_qwen3_embedding_0_6b_q8_0". Owned.
    table: []u8,

    /// Opens the canonical table for `model_slug` against the framework's
    /// shared default pool (framework/pg.zig). `dim` is the model's n_embd;
    /// the table is created if it doesn't exist, with the standard schema
    /// (id PK, source_type, source_id, chunk_index, display_text,
    /// text_preview, metadata_json, model, embedded_at, text_sha, vector).
    pub fn open(allocator: std.mem.Allocator, model_slug: []const u8, dim: usize) !Store {
        const pool = fpg.defaultPool() orelse return error.PoolUnavailable;

        const suffix = try sanitizeTableSuffix(allocator, model_slug);
        defer allocator.free(suffix);
        const table = try std.fmt.allocPrint(allocator, "chunks_{s}", .{suffix});
        errdefer allocator.free(table);

        if (dim > 0) {
            const create_sql = try std.fmt.allocPrint(
                allocator,
                \\CREATE TABLE IF NOT EXISTS {s} (
                \\  id            TEXT PRIMARY KEY,
                \\  source_type   TEXT NOT NULL,
                \\  source_id     TEXT NOT NULL,
                \\  chunk_index   INTEGER NOT NULL,
                \\  display_text  TEXT NOT NULL,
                \\  text_preview  TEXT,
                \\  metadata_json TEXT,
                \\  model         TEXT NOT NULL,
                \\  embedded_at   TIMESTAMP NOT NULL,
                \\  text_sha      TEXT NOT NULL,
                \\  vector        vector({d}) NOT NULL
                \\);
            ,
                .{ table, dim },
            );
            defer allocator.free(create_sql);
            _ = try pool.exec(create_sql, .{});

            const idx_sql = try std.fmt.allocPrint(
                allocator,
                "CREATE INDEX IF NOT EXISTS {s}_source_idx ON {s}(source_type, source_id);",
                .{ table, table },
            );
            defer allocator.free(idx_sql);
            _ = try pool.exec(idx_sql, .{});
        }

        return .{ .allocator = allocator, .pool = pool, .dim = dim, .table = table };
    }

    pub fn close(self: *Store) void {
        self.allocator.free(self.table);
        // pool is shared/owned by framework/pg.zig — do NOT deinit.
    }

    /// Best-effort top-level HNSW for the whole table. Idempotent; safe to
    /// call repeatedly. Use buildPartialHnsw for source-type-filtered
    /// queries — pgvector 0.5.1 needs a partial index per filter slice.
    pub fn buildHnsw(self: *Store) !void {
        const sql = try std.fmt.allocPrint(
            self.allocator,
            "CREATE INDEX IF NOT EXISTS {s}_hnsw_idx ON {s} USING hnsw (vector vector_cosine_ops);",
            .{ self.table, self.table },
        );
        defer self.allocator.free(sql);
        _ = self.pool.exec(sql, .{}) catch |e| {
            std.debug.print("hnsw build: {s} (continuing)\n", .{@errorName(e)});
            return;
        };
    }

    pub fn buildPartialHnsw(self: *Store, source_type: []const u8) !void {
        const st_e = try sqlEscape(self.allocator, source_type);
        defer self.allocator.free(st_e);
        const sql = try std.fmt.allocPrint(
            self.allocator,
            "CREATE INDEX IF NOT EXISTS {s}_{s}_hnsw ON {s} USING hnsw (vector vector_cosine_ops) WHERE source_type = '{s}';",
            .{ self.table, st_e, self.table, st_e },
        );
        defer self.allocator.free(sql);
        _ = self.pool.exec(sql, .{}) catch |e| {
            std.debug.print("partial hnsw build: {s} (continuing)\n", .{@errorName(e)});
            return;
        };
    }

    pub fn upsert(
        self: *Store,
        id: []const u8,
        source_type: []const u8,
        source_id: []const u8,
        chunk_index: i32,
        display_text: []const u8,
        text_preview: []const u8,
        metadata_json: []const u8,
        model: []const u8,
        text_sha: []const u8,
        vector: []const f32,
    ) !void {
        var arr_buf = std.array_list.Managed(u8).init(self.allocator);
        defer arr_buf.deinit();
        try arr_buf.appendSlice("[");
        for (vector, 0..) |v, i| {
            if (i > 0) try arr_buf.append(',');
            try arr_buf.writer().print("{d}", .{v});
        }
        try arr_buf.appendSlice("]");

        const dt_clean = try sanitizeUtf8(self.allocator, display_text);
        defer self.allocator.free(dt_clean);
        const tp_clean = try sanitizeUtf8(self.allocator, text_preview);
        defer self.allocator.free(tp_clean);
        const mj_clean = try sanitizeUtf8(self.allocator, metadata_json);
        defer self.allocator.free(mj_clean);

        const id_e = try sqlEscape(self.allocator, id);
        defer self.allocator.free(id_e);
        const st_e = try sqlEscape(self.allocator, source_type);
        defer self.allocator.free(st_e);
        const sid_e = try sqlEscape(self.allocator, source_id);
        defer self.allocator.free(sid_e);
        const dt_e = try sqlEscape(self.allocator, dt_clean);
        defer self.allocator.free(dt_e);
        const tp_e = try sqlEscape(self.allocator, tp_clean);
        defer self.allocator.free(tp_e);
        const mj_e = try sqlEscape(self.allocator, mj_clean);
        defer self.allocator.free(mj_e);
        const m_e = try sqlEscape(self.allocator, model);
        defer self.allocator.free(m_e);
        const sha_e = try sqlEscape(self.allocator, text_sha);
        defer self.allocator.free(sha_e);

        const sql = try std.fmt.allocPrint(
            self.allocator,
            \\INSERT INTO {s}
            \\(id, source_type, source_id, chunk_index, display_text, text_preview, metadata_json, model, embedded_at, text_sha, vector)
            \\VALUES ('{s}', '{s}', '{s}', {d}, '{s}', '{s}', '{s}', '{s}', now(), '{s}', '{s}'::vector)
            \\ON CONFLICT (id) DO UPDATE SET
            \\  display_text = excluded.display_text,
            \\  text_preview = excluded.text_preview,
            \\  metadata_json = excluded.metadata_json,
            \\  embedded_at = now(),
            \\  text_sha = excluded.text_sha,
            \\  vector = excluded.vector;
        ,
            .{ self.table, id_e, st_e, sid_e, chunk_index, dt_e, tp_e, mj_e, m_e, sha_e, arr_buf.items },
        );
        defer self.allocator.free(sql);

        _ = try self.pool.exec(sql, .{});
    }

    pub fn searchTopNFiltered(
        self: *Store,
        allocator: std.mem.Allocator,
        vector: []const f32,
        n: usize,
        source_type_filter: []const u8,
    ) ![]SearchHit {
        var arr_buf = std.array_list.Managed(u8).init(self.allocator);
        defer arr_buf.deinit();
        try arr_buf.appendSlice("[");
        for (vector, 0..) |v, i| {
            if (i > 0) try arr_buf.append(',');
            try arr_buf.writer().print("{d}", .{v});
        }
        try arr_buf.appendSlice("]");

        const where_clause: []const u8 = if (source_type_filter.len > 0)
            try std.fmt.allocPrint(self.allocator, "WHERE source_type = '{s}'", .{source_type_filter})
        else
            try self.allocator.dupe(u8, "");
        defer self.allocator.free(where_clause);

        const sql = try std.fmt.allocPrint(
            self.allocator,
            \\SELECT id, source_id, chunk_index, text_preview, display_text,
            \\       CAST(1.0 - (vector <=> '{s}'::vector) AS DOUBLE PRECISION) AS score
            \\FROM {s}
            \\{s}
            \\ORDER BY vector <=> '{s}'::vector
            \\LIMIT {d};
        ,
            .{ arr_buf.items, self.table, where_clause, arr_buf.items, n },
        );
        defer self.allocator.free(sql);

        var result = try self.pool.query(sql, .{});
        defer result.deinit();

        var hits = std.array_list.Managed(SearchHit).init(allocator);
        errdefer {
            for (hits.items) |*h| {
                allocator.free(h.id);
                allocator.free(h.source_id);
                allocator.free(h.text_preview);
                allocator.free(h.display_text);
            }
            hits.deinit();
        }

        while (try result.next()) |row| {
            const id_s = try row.get([]const u8, 0);
            const sid_s = try row.get([]const u8, 1);
            const ci = try row.get(i32, 2);
            const tp_s = try row.get([]const u8, 3);
            const dt_s = try row.get([]const u8, 4);
            const sc = try row.get(f64, 5);
            try hits.append(.{
                .id = try allocator.dupe(u8, id_s),
                .source_id = try allocator.dupe(u8, sid_s),
                .chunk_index = ci,
                .text_preview = try allocator.dupe(u8, tp_s),
                .display_text = try allocator.dupe(u8, dt_s),
                .dense_score = sc,
            });
        }
        return hits.toOwnedSlice();
    }
};
