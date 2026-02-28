--[[
  llm.lua -- llama.cpp via LuaJIT FFI

  Provides local LLM inference using llama.cpp's C API.
  Same FFI pattern as sqlite.lua — no external Lua modules,
  just the shared libraries built from llama.cpp.

  Usage:
    local llm = require("llm")
    local model = llm.load("model.gguf")
    model:generate("Hello, who are you?", function(token_text)
      io.write(token_text)  -- streaming callback
    end)
    model:free()

  Requires: libllama.so + libggml*.so (built from llama.cpp)
  Fallback: Returns a stub module with .available = false
]]

local ffi = require("ffi")

local LLM = {}
LLM.available = false

-- ============================================================================
-- FFI declarations — llama.cpp C API subset
-- ============================================================================

-- We declare only the subset we need. Struct fields that reference ggml types
-- are declared as compatible primitives (void*, int) since we only use default
-- params and override a few fields.

ffi.cdef[[
  // Opaque types
  typedef struct llama_model llama_model;
  typedef struct llama_context llama_context;
  typedef struct llama_sampler llama_sampler;
  typedef struct llama_vocab llama_vocab;

  typedef int32_t llama_pos;
  typedef int32_t llama_token;
  typedef int32_t llama_seq_id;

  // ── Model params ──
  // We must match the exact memory layout of llama_model_params.
  // Fields we don't use are declared with compatible types.
  struct llama_model_params {
    void *devices;                    // ggml_backend_dev_t *
    const void *tensor_buft_overrides; // llama_model_tensor_buft_override *
    int32_t n_gpu_layers;
    int32_t split_mode;               // enum llama_split_mode
    int32_t main_gpu;
    const float *tensor_split;
    bool (*progress_callback)(float progress, void *user_data);
    void *progress_callback_user_data;
    const void *kv_overrides;         // llama_model_kv_override *
    bool vocab_only;
    bool use_mmap;
    bool use_direct_io;
    bool use_mlock;
    bool check_tensors;
    bool use_extra_bufts;
    bool no_host;
    bool no_alloc;
  };

  // ── Context params ──
  struct llama_context_params {
    uint32_t n_ctx;
    uint32_t n_batch;
    uint32_t n_ubatch;
    uint32_t n_seq_max;
    int32_t  n_threads;
    int32_t  n_threads_batch;
    int32_t  rope_scaling_type;       // enum
    int32_t  pooling_type;            // enum
    int32_t  attention_type;          // enum
    int32_t  flash_attn_type;         // enum
    float    rope_freq_base;
    float    rope_freq_scale;
    float    yarn_ext_factor;
    float    yarn_attn_factor;
    float    yarn_beta_fast;
    float    yarn_beta_slow;
    uint32_t yarn_orig_ctx;
    float    defrag_thold;
    void    *cb_eval;                 // ggml_backend_sched_eval_callback
    void    *cb_eval_user_data;
    int32_t  type_k;                  // enum ggml_type
    int32_t  type_v;                  // enum ggml_type
    void    *abort_callback;          // ggml_abort_callback
    void    *abort_callback_data;
    bool     embeddings;
    bool     offload_kqv;
    bool     no_perf;
    bool     op_offload;
    bool     swa_full;
    bool     kv_unified;
    void    *samplers;                // llama_sampler_seq_config *
    size_t   n_samplers;
  };

  // ── Sampler chain params ──
  struct llama_sampler_chain_params {
    bool no_perf;
  };

  // ── Batch ──
  struct llama_batch {
    int32_t     n_tokens;
    llama_token  *token;
    float        *embd;
    llama_pos    *pos;
    int32_t      *n_seq_id;
    llama_seq_id **seq_id;
    int8_t       *logits;
  };

  // ── Chat message ──
  struct llama_chat_message {
    const char *role;
    const char *content;
  };

  // ── Token data (for manual sampling if needed) ──
  typedef struct llama_token_data {
    llama_token id;
    float logit;
    float p;
  } llama_token_data;

  typedef struct llama_token_data_array {
    llama_token_data *data;
    size_t size;
    int64_t selected;
    bool sorted;
  } llama_token_data_array;

  // ── Default params ──
  struct llama_model_params         llama_model_default_params(void);
  struct llama_context_params       llama_context_default_params(void);
  struct llama_sampler_chain_params llama_sampler_chain_default_params(void);

  // ── Backend ──
  void llama_backend_init(void);
  void llama_backend_free(void);

  // ── Model ──
  llama_model *llama_model_load_from_file(const char *path_model, struct llama_model_params params);
  void         llama_model_free(llama_model *model);
  uint64_t     llama_model_size(const llama_model *model);
  uint64_t     llama_model_n_params(const llama_model *model);
  int32_t      llama_model_desc(const llama_model *model, char *buf, size_t buf_size);
  int32_t      llama_model_n_ctx_train(const llama_model *model);
  const char  *llama_model_chat_template(const llama_model *model, const char *name);

  // ── Vocab ──
  const llama_vocab *llama_model_get_vocab(const llama_model *model);
  int32_t llama_vocab_n_tokens(const llama_vocab *vocab);
  bool    llama_vocab_is_eog(const llama_vocab *vocab, llama_token token);
  llama_token llama_vocab_bos(const llama_vocab *vocab);
  llama_token llama_vocab_eos(const llama_vocab *vocab);
  llama_token llama_vocab_eot(const llama_vocab *vocab);
  bool llama_vocab_get_add_bos(const llama_vocab *vocab);

  // ── Context ──
  llama_context *llama_init_from_model(llama_model *model, struct llama_context_params params);
  void           llama_free(llama_context *ctx);
  uint32_t       llama_n_ctx(const llama_context *ctx);

  // ── Tokenization ──
  int32_t llama_tokenize(
    const llama_vocab *vocab,
    const char *text, int32_t text_len,
    llama_token *tokens, int32_t n_tokens_max,
    bool add_special, bool parse_special);

  int32_t llama_token_to_piece(
    const llama_vocab *vocab,
    llama_token token,
    char *buf, int32_t length,
    int32_t lstrip, bool special);

  // ── Chat template ──
  int32_t llama_chat_apply_template(
    const char *tmpl,
    const struct llama_chat_message *chat,
    size_t n_msg,
    bool add_ass,
    char *buf,
    int32_t length);

  // ── Batch ──
  struct llama_batch llama_batch_get_one(llama_token *tokens, int32_t n_tokens);
  struct llama_batch llama_batch_init(int32_t n_tokens, int32_t embd, int32_t n_seq_max);
  void               llama_batch_free(struct llama_batch batch);

  // ── Decode ──
  int32_t llama_decode(llama_context *ctx, struct llama_batch batch);

  // ── Logits ──
  float *llama_get_logits_ith(llama_context *ctx, int32_t i);

  // ── Sampler ──
  llama_sampler *llama_sampler_chain_init(struct llama_sampler_chain_params params);
  void           llama_sampler_chain_add(llama_sampler *chain, llama_sampler *smpl);
  void           llama_sampler_free(llama_sampler *smpl);

  llama_sampler *llama_sampler_init_greedy(void);
  llama_sampler *llama_sampler_init_dist(uint32_t seed);
  llama_sampler *llama_sampler_init_top_k(int32_t k);
  llama_sampler *llama_sampler_init_top_p(float p, size_t min_keep);
  llama_sampler *llama_sampler_init_min_p(float p, size_t min_keep);
  llama_sampler *llama_sampler_init_temp(float t);
  llama_sampler *llama_sampler_init_penalties(int32_t penalty_last_n, float penalty_repeat, float penalty_freq, float penalty_present);

  llama_token llama_sampler_sample(llama_sampler *smpl, llama_context *ctx, int32_t idx);

  // ── Embeddings ──
  int32_t llama_model_n_embd(const llama_model *model);
  void    llama_set_embeddings(llama_context *ctx, bool embeddings);
  float  *llama_get_embeddings(llama_context *ctx);
  float  *llama_get_embeddings_ith(llama_context *ctx, int32_t i);
  float  *llama_get_embeddings_seq(llama_context *ctx, llama_seq_id seq_id);

  // ── Memory (KV cache) ──
  typedef struct llama_memory llama_memory;
  llama_memory *llama_get_memory(llama_context *ctx);
  void          llama_memory_clear(llama_memory *mem, bool data);

  // ── Perf ──
  void llama_perf_context_print(const llama_context *ctx);

  // ── System info ──
  const char *llama_print_system_info(void);
]]

-- ============================================================================
-- Library loading
-- ============================================================================

local lib

local function resolveLibPath(relpath)
  if relpath:sub(1, 1) == "/" then return relpath end
  -- In standalone mode, resolve relative to script directory
  local info = debug.getinfo(1, "S")
  if info and info.source and info.source:sub(1, 1) == "@" then
    local dir = info.source:sub(2):match("(.+)/[^/]+$")
    if dir then return dir .. "/" .. relpath end
  end
  return relpath
end

local function loadLib()
  -- The ggml libs must be loaded first (dependency order)
  local paths_ggml_base = {
    "lib/libggml-base.so",
    "libggml-base.so",
  }
  local paths_ggml_cpu = {
    "lib/libggml-cpu.so",
    "libggml-cpu.so",
  }
  local paths_ggml = {
    "lib/libggml.so",
    "libggml.so",
  }
  local paths_llama = {
    "lib/libllama.so",
    "libllama.so",
  }

  -- Load dependencies in order
  local function tryLoad(paths, name)
    for _, path in ipairs(paths) do
      local resolved = resolveLibPath(path)
      local ok, result = pcall(ffi.load, resolved)
      if ok then return result end
    end
    -- Try bare name as last resort (system ldconfig)
    local ok, result = pcall(ffi.load, name)
    if ok then return result end
    return nil
  end

  local ggml_base = tryLoad(paths_ggml_base, "ggml-base")
  if not ggml_base then
    print("[llm] could not load libggml-base.so")
    return false
  end

  local ggml_cpu = tryLoad(paths_ggml_cpu, "ggml-cpu")
  if not ggml_cpu then
    print("[llm] could not load libggml-cpu.so")
    return false
  end

  local ggml = tryLoad(paths_ggml, "ggml")
  if not ggml then
    print("[llm] could not load libggml.so")
    return false
  end

  lib = tryLoad(paths_llama, "llama")
  if not lib then
    print("[llm] could not load libllama.so")
    return false
  end

  return true
end

if not loadLib() then
  return LLM  -- stub with .available = false
end

LLM.available = true

-- ============================================================================
-- Initialize backend (once)
-- ============================================================================

lib.llama_backend_init()

-- ============================================================================
-- Model wrapper
-- ============================================================================

local Model = {}
Model.__index = Model

function LLM.load(path, opts)
  opts = opts or {}

  local mparams = lib.llama_model_default_params()
  mparams.n_gpu_layers = opts.n_gpu_layers or 0  -- CPU only by default

  print("[llm] loading model: " .. path)
  local model = lib.llama_model_load_from_file(path, mparams)
  if model == nil then
    error("[llm] failed to load model: " .. path)
  end

  local vocab = lib.llama_model_get_vocab(model)

  -- Get model description
  local desc_buf = ffi.new("char[256]")
  lib.llama_model_desc(model, desc_buf, 256)
  local desc = ffi.string(desc_buf)

  local n_params = tonumber(lib.llama_model_n_params(model))
  local model_size = tonumber(lib.llama_model_size(model))
  local n_ctx_train = lib.llama_model_n_ctx_train(model)
  local n_vocab = lib.llama_vocab_n_tokens(vocab)

  print(string.format("[llm] model: %s | params: %.1fB | size: %.0fMB | ctx_train: %d | vocab: %d",
    desc, n_params / 1e9, model_size / 1e6, n_ctx_train, n_vocab))

  -- Get chat template from model metadata
  local chat_tmpl_ptr = lib.llama_model_chat_template(model, nil)
  local chat_template = nil
  if chat_tmpl_ptr ~= nil then
    chat_template = ffi.string(chat_tmpl_ptr)
  end

  -- Get embedding dimensions (available for all models)
  local n_embd = lib.llama_model_n_embd(model)

  -- Create context
  local cparams = lib.llama_context_default_params()
  cparams.n_ctx = opts.n_ctx or 2048
  cparams.n_batch = opts.n_batch or 512
  cparams.n_threads = opts.n_threads or 4
  cparams.n_threads_batch = opts.n_threads_batch or cparams.n_threads
  cparams.no_perf = false

  -- Embedding mode: enable embeddings + mean pooling
  local is_embedding = opts.embeddings or false
  if is_embedding then
    cparams.embeddings = true
    cparams.pooling_type = 1  -- LLAMA_POOLING_TYPE_MEAN
  end

  local ctx = lib.llama_init_from_model(model, cparams)
  if ctx == nil then
    lib.llama_model_free(model)
    error("[llm] failed to create context")
  end

  local n_ctx = lib.llama_n_ctx(ctx)
  local mode_str = is_embedding and "embedding" or "generative"
  print(string.format("[llm] context: %d tokens, %d embd dims (%s mode)", n_ctx, n_embd, mode_str))

  local self = setmetatable({
    _model = model,
    _ctx = ctx,
    _vocab = vocab,
    _n_ctx = n_ctx,
    _n_ctx_train = n_ctx_train,
    _n_embd = n_embd,
    _chat_template = chat_template,
    _desc = desc,
    _is_embedding = is_embedding,
    _freed = false,
  }, Model)

  return self
end

-- ============================================================================
-- Tokenization
-- ============================================================================

function Model:tokenize(text, add_special, parse_special)
  if add_special == nil then add_special = true end
  if parse_special == nil then parse_special = false end

  local text_len = #text

  -- First call: get required size
  local n = lib.llama_tokenize(self._vocab, text, text_len, nil, 0, add_special, parse_special)
  n = math.abs(n)  -- negative means "would need this many"

  local tokens = ffi.new("llama_token[?]", n)
  local actual = lib.llama_tokenize(self._vocab, text, text_len, tokens, n, add_special, parse_special)
  if actual < 0 then
    error("[llm] tokenization failed")
  end

  return tokens, actual
end

function Model:detokenize(token)
  local buf = ffi.new("char[256]")
  local n = lib.llama_token_to_piece(self._vocab, token, buf, 256, 0, false)
  if n < 0 then return "" end
  return ffi.string(buf, n)
end

-- ============================================================================
-- Chat template formatting
-- ============================================================================

function Model:apply_chat_template(messages, add_assistant)
  if add_assistant == nil then add_assistant = true end

  local n_msg = #messages
  local c_messages = ffi.new("struct llama_chat_message[?]", n_msg)

  -- Keep Lua references alive during the call
  local role_strs = {}
  local content_strs = {}

  for i, msg in ipairs(messages) do
    role_strs[i] = msg.role
    content_strs[i] = msg.content
    c_messages[i - 1].role = role_strs[i]
    c_messages[i - 1].content = content_strs[i]
  end

  -- Use the model's built-in template
  local tmpl = self._chat_template

  -- First call to get required size
  local needed = lib.llama_chat_apply_template(tmpl, c_messages, n_msg, add_assistant, nil, 0)
  if needed < 0 then
    error("[llm] failed to apply chat template (returned " .. needed .. ")")
  end

  local buf = ffi.new("char[?]", needed + 1)
  lib.llama_chat_apply_template(tmpl, c_messages, n_msg, add_assistant, buf, needed + 1)

  return ffi.string(buf, needed)
end

-- ============================================================================
-- Embedding extraction
-- ============================================================================

--- Extract an embedding vector for the given text.
--- Returns a Lua table of floats and the embedding dimension.
--- The model must be loaded with { embeddings = true }.
function Model:embed(text)
  if not self._is_embedding then
    error("[llm] model not loaded in embedding mode (pass { embeddings = true } to llm.load)")
  end

  -- Tokenize (no special tokens for embedding models)
  local tokens, n_tokens = self:tokenize(text, true, false)

  if n_tokens > self._n_ctx then
    error(string.format("[llm] text too long for embedding: %d tokens, context is %d", n_tokens, self._n_ctx))
  end

  -- Build batch with all logits enabled (needed to get embeddings)
  local batch = lib.llama_batch_init(n_tokens, 0, 1)
  batch.n_tokens = n_tokens
  for i = 0, n_tokens - 1 do
    batch.token[i] = tokens[i]
    batch.pos[i] = i
    batch.n_seq_id[i] = 1
    batch.seq_id[i][0] = 0
    batch.logits[i] = 1  -- request output for all tokens
  end

  -- Decode
  local rc = lib.llama_decode(self._ctx, batch)
  lib.llama_batch_free(batch)
  if rc ~= 0 then
    error("[llm] embedding decode failed, rc=" .. rc)
  end

  -- Get embedding (pooled by sequence id 0, since we set pooling_type = MEAN)
  local n_embd = self._n_embd
  local emb_ptr = lib.llama_get_embeddings_seq(self._ctx, 0)

  if emb_ptr == nil then
    -- Fallback: try getting embeddings for the last token
    emb_ptr = lib.llama_get_embeddings_ith(self._ctx, -1)
  end

  if emb_ptr == nil then
    error("[llm] failed to get embeddings (returned NULL)")
  end

  -- Copy to Lua table and L2-normalize
  local embedding = {}
  local norm = 0
  for i = 0, n_embd - 1 do
    local v = emb_ptr[i]
    embedding[i + 1] = v
    norm = norm + v * v
  end

  -- Normalize
  norm = math.sqrt(norm)
  if norm > 0 then
    for i = 1, n_embd do
      embedding[i] = embedding[i] / norm
    end
  end

  return embedding, n_embd
end

--- Embed multiple texts and return array of {embedding, n_embd} pairs.
function Model:embed_batch(texts)
  local results = {}
  for i, text in ipairs(texts) do
    local emb, dim = self:embed(text)
    results[i] = { embedding = emb, dimensions = dim }
  end
  return results
end

-- ============================================================================
-- Generation
-- ============================================================================

function Model:generate(prompt, callback, opts)
  opts = opts or {}
  local max_tokens = opts.max_tokens or 512
  local temperature = opts.temperature or 0.7
  local top_k = opts.top_k or 40
  local top_p = opts.top_p or 0.9
  local min_p = opts.min_p or 0.05
  local repeat_penalty = opts.repeat_penalty or 1.1
  local seed = opts.seed  -- nil = random

  -- Tokenize prompt
  local tokens, n_tokens = self:tokenize(prompt, true, true)

  if n_tokens + max_tokens > self._n_ctx then
    local available = self._n_ctx - n_tokens
    if available <= 0 then
      error(string.format("[llm] prompt too long: %d tokens, context is %d", n_tokens, self._n_ctx))
    end
    max_tokens = available
    print(string.format("[llm] warning: clamping max_tokens to %d (prompt=%d, ctx=%d)", max_tokens, n_tokens, self._n_ctx))
  end

  -- Build sampler chain
  local sparams = lib.llama_sampler_chain_default_params()
  sparams.no_perf = false
  local smpl = lib.llama_sampler_chain_init(sparams)

  lib.llama_sampler_chain_add(smpl, lib.llama_sampler_init_top_k(top_k))
  lib.llama_sampler_chain_add(smpl, lib.llama_sampler_init_top_p(top_p, 1))
  lib.llama_sampler_chain_add(smpl, lib.llama_sampler_init_min_p(min_p, 1))
  lib.llama_sampler_chain_add(smpl, lib.llama_sampler_init_temp(temperature))
  lib.llama_sampler_chain_add(smpl, lib.llama_sampler_init_penalties(64, repeat_penalty, 0.0, 0.0))

  if seed then
    lib.llama_sampler_chain_add(smpl, lib.llama_sampler_init_dist(seed))
  else
    lib.llama_sampler_chain_add(smpl, lib.llama_sampler_init_dist(0xFFFFFFFF))
  end

  -- Clear KV cache before each generation (stateless per call)
  local mem = lib.llama_get_memory(self._ctx)
  if mem ~= nil then lib.llama_memory_clear(mem, true) end

  -- Process prompt in chunks of n_batch
  local n_batch = 512
  local pos = 0
  while pos < n_tokens do
    local chunk_size = math.min(n_batch, n_tokens - pos)
    local chunk_tokens = tokens + pos  -- pointer arithmetic
    local batch = lib.llama_batch_get_one(chunk_tokens, chunk_size)
    local rc = lib.llama_decode(self._ctx, batch)
    if rc ~= 0 then
      lib.llama_sampler_free(smpl)
      error("[llm] failed to decode prompt chunk, rc=" .. rc)
    end
    pos = pos + chunk_size
  end

  -- Generate tokens
  local generated = {}
  local n_generated = 0

  for i = 1, max_tokens do
    local new_token = lib.llama_sampler_sample(smpl, self._ctx, -1)

    -- Check for end of generation
    if lib.llama_vocab_is_eog(self._vocab, new_token) then
      break
    end

    -- Detokenize
    local piece = self:detokenize(new_token)
    table.insert(generated, piece)
    n_generated = n_generated + 1

    -- Stream callback
    if callback then
      local should_stop = callback(piece, n_generated)
      if should_stop then break end
    end

    -- Decode next token
    local next_token = ffi.new("llama_token[1]", new_token)
    batch = lib.llama_batch_get_one(next_token, 1)
    rc = lib.llama_decode(self._ctx, batch)
    if rc ~= 0 then
      print("[llm] decode error at token " .. i .. ", rc=" .. rc)
      break
    end
  end

  lib.llama_sampler_free(smpl)

  return table.concat(generated), n_generated
end

-- ============================================================================
-- Chat-style generation (applies template automatically)
-- ============================================================================

function Model:chat(messages, callback, opts)
  local formatted = self:apply_chat_template(messages, true)
  return self:generate(formatted, callback, opts)
end

-- ============================================================================
-- KV cache management
-- ============================================================================

function Model:clear_context()
  local mem = lib.llama_get_memory(self._ctx)
  if mem ~= nil then
    lib.llama_memory_clear(mem, true)
  end
end

-- ============================================================================
-- Cleanup
-- ============================================================================

function Model:free()
  if self._freed then return end
  self._freed = true

  if self._ctx ~= nil then
    lib.llama_free(self._ctx)
    self._ctx = nil
  end
  if self._model ~= nil then
    lib.llama_model_free(self._model)
    self._model = nil
  end
end

Model.__gc = Model.free

-- ============================================================================
-- System info
-- ============================================================================

function LLM.system_info()
  return ffi.string(lib.llama_print_system_info())
end

return LLM
