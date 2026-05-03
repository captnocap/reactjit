// rjit-llm-worker — subprocess-based llama.cpp inference for ReactJIT.
//
// Why a subprocess: when the renderer (wgpu/Vulkan) and llama.cpp's
// ggml-vulkan backend live in the same process, both want to own a
// VkInstance on the same physical device — they fight, model load
// gets killed mid-way. Running inference in its own process gives
// each side an independent VkInstance. No fight, no fuss.
//
// Why we own this binary: lmstudio's pre-built backends use a llama.h
// version we don't have access to, so the struct ABI never matched.
// Building the worker from llama.cpp source we DO have means header
// + binary always match.
//
// Wire protocol (line-delimited, parent ↔ worker):
//
//   parent → worker (one command per line):
//     LOAD <abs_path_to_gguf>\n
//     CHAT <max_tokens>\n<system_prompt>\n<user_text>\n.\n
//     RESET\n             — drop chat history, keep model loaded
//     PING\n              — round-trip health check
//     QUIT\n              — shut down cleanly
//
//   worker → parent (one event per line):
//     READY\n             — model loaded, ready for CHAT
//     TOK <text>\n        — one token piece (text may contain spaces;
//                            newlines inside are escaped as \n)
//     DONE\n              — generation complete
//     PONG\n              — response to PING
//     ERR <message>\n     — fatal-ish error
//
// Output is line-buffered (one fflush per event). Tokens that contain
// literal '\n' get the byte escaped as backslash-n; the parent
// reverses the escape. This keeps the protocol trivially line-parseable.

#include "llama.h"
#include "chat.h"   // common_chat_templates_* — full Jinja + per-model tool-call parsers
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <sstream>
#include <vector>

// ── small helpers ───────────────────────────────────────────────────

static void emit(const char * line) {
    fputs(line, stdout);
    fputc('\n', stdout);
    fflush(stdout);
}

static void emit_err(const std::string & msg) {
    std::string out = "ERR " + msg;
    emit(out.c_str());
}

static std::string escape_newlines(const std::string & in) {
    std::string out;
    out.reserve(in.size());
    for (char c : in) {
        if (c == '\\') {
            out += "\\\\";
        } else if (c == '\n') {
            out += "\\n";
        } else if (c == '\r') {
            // drop
        } else {
            out += c;
        }
    }
    return out;
}

static std::string read_line_or_empty() {
    std::string l;
    if (!std::getline(std::cin, l)) return "";
    return l;
}

// Read lines until a single "." line. Returns the joined body without
// the terminator. Used for multi-line CHAT system + user payloads.
static std::string read_block_until_dot() {
    std::string out;
    while (true) {
        std::string l;
        if (!std::getline(std::cin, l)) return out;
        if (l == ".") return out;
        if (!out.empty()) out += '\n';
        out += l;
    }
}

// ── worker state ────────────────────────────────────────────────────

struct WorkerState {
    llama_model *   model    = nullptr;
    llama_context * ctx      = nullptr;
    llama_sampler * sampler  = nullptr;
    const llama_vocab * vocab = nullptr;
    common_chat_templates_ptr tmpls;     // initialized in load_model from the model's embedded Jinja
    std::vector<common_chat_msg> history;
    size_t prev_len = 0;                 // chars of the most recently rendered prompt (no gen prompt)
    int n_ctx = 4096;

    void reset_history() {
        history.clear();
        prev_len = 0;
        if (ctx) {
            llama_memory_clear(llama_get_memory(ctx), true);
        }
    }

    ~WorkerState() {
        reset_history();
        if (sampler) llama_sampler_free(sampler);
        if (ctx)     llama_free(ctx);
        if (model)   llama_model_free(model);
        // tmpls is a unique_ptr — destructor cleans up
    }
};

// ── load + generate ─────────────────────────────────────────────────

static bool load_model(WorkerState & w, const std::string & path) {
    fprintf(stderr, "[worker] load_model entry: path=%s\n", path.c_str()); fflush(stderr);

    llama_model_params mp = llama_model_default_params();
    mp.n_gpu_layers = 99;
    // Default progress callback prints dots to stderr; null it for cleaner logs.
    mp.progress_callback = nullptr;
    mp.progress_callback_user_data = nullptr;

    fprintf(stderr, "[worker] calling llama_model_load_from_file...\n"); fflush(stderr);
    w.model = llama_model_load_from_file(path.c_str(), mp);
    fprintf(stderr, "[worker] llama_model_load_from_file returned %p\n", (void*)w.model); fflush(stderr);
    if (!w.model) {
        emit_err("model load failed: " + path);
        return false;
    }

    w.vocab = llama_model_get_vocab(w.model);

    llama_context_params cp = llama_context_default_params();
    cp.n_ctx   = w.n_ctx;
    cp.n_batch = w.n_ctx;
    cp.no_perf = true;

    fprintf(stderr, "[worker] calling llama_init_from_model...\n"); fflush(stderr);
    w.ctx = llama_init_from_model(w.model, cp);
    fprintf(stderr, "[worker] llama_init_from_model returned %p\n", (void*)w.ctx); fflush(stderr);
    if (!w.ctx) {
        emit_err("context init failed");
        return false;
    }

    w.sampler = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(w.sampler, llama_sampler_init_min_p(0.05f, 1));
    llama_sampler_chain_add(w.sampler, llama_sampler_init_temp(0.8f));
    llama_sampler_chain_add(w.sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    // Initialize the chat-template engine from the model's embedded Jinja.
    // Empty override = use whatever the GGUF ships. This handles every
    // chat format llama.cpp upstream supports — Qwen, Hermes, Mistral,
    // Llama-3, Gemma, DeepSeek, GLM, etc — and is the prereq for the
    // tool-calling path landing in step 4.
    w.tmpls = common_chat_templates_init(w.model, "");
    if (!w.tmpls) {
        emit_err("common_chat_templates_init failed");
        return false;
    }

    return true;
}

// Generate a streaming response to the given prompt slice. Emits one
// `TOK <piece>` line per sampled token, then either DONE on EOG/limit
// or ERR on decode failure. Returns the full assistant response text.
static std::string generate(WorkerState & w, const std::string & prompt, int max_tokens) {
    std::string response;

    const bool is_first = llama_memory_seq_pos_max(llama_get_memory(w.ctx), 0) == -1;

    int n_prompt = -llama_tokenize(w.vocab, prompt.c_str(), prompt.size(), NULL, 0, is_first, true);
    std::vector<llama_token> prompt_tokens(n_prompt);
    if (llama_tokenize(w.vocab, prompt.c_str(), prompt.size(), prompt_tokens.data(), prompt_tokens.size(), is_first, true) < 0) {
        emit_err("tokenize failed");
        return response;
    }

    llama_batch batch = llama_batch_get_one(prompt_tokens.data(), prompt_tokens.size());
    llama_token new_id;
    int produced = 0;

    while (true) {
        int n_ctx_lim  = llama_n_ctx(w.ctx);
        int n_ctx_used = llama_memory_seq_pos_max(llama_get_memory(w.ctx), 0) + 1;
        if (n_ctx_used + batch.n_tokens > n_ctx_lim) {
            emit_err("context exceeded");
            break;
        }

        if (llama_decode(w.ctx, batch) != 0) {
            emit_err("decode failed");
            break;
        }

        new_id = llama_sampler_sample(w.sampler, w.ctx, -1);

        if (llama_vocab_is_eog(w.vocab, new_id)) break;
        if (max_tokens > 0 && produced >= max_tokens) break;

        char buf[256];
        int n = llama_token_to_piece(w.vocab, new_id, buf, sizeof(buf), 0, true);
        if (n < 0) { emit_err("token_to_piece failed"); break; }

        std::string piece(buf, n);
        response += piece;

        std::string out = "TOK " + escape_newlines(piece);
        emit(out.c_str());

        produced++;
        batch = llama_batch_get_one(&new_id, 1);
    }

    return response;
}

// ── command dispatch ────────────────────────────────────────────────

int main(int argc, char ** argv) {
    (void)argc; (void)argv;

    // Quiet llama.cpp logs to stderr; only errors. Stdout is the
    // wire protocol — anything llama.cpp prints to stdout would
    // poison the parent's parser.
    // Log INFO and above to stderr — we want to see backend init,
    // device selection, tensor offload, etc. for debugging.
    llama_log_set([](enum ggml_log_level level, const char * text, void *) {
        if (level >= GGML_LOG_LEVEL_INFO) {
            fprintf(stderr, "%s", text);
        }
    }, nullptr);

    ggml_backend_load_all();

    WorkerState w;

    while (true) {
        std::string line = read_line_or_empty();
        if (line.empty()) {
            // EOF on stdin — parent went away
            break;
        }

        if (line.rfind("LOAD ", 0) == 0) {
            std::string path = line.substr(5);
            if (w.model) {
                emit_err("LOAD twice not supported");
                continue;
            }
            if (load_model(w, path)) {
                emit("READY");
            }
        } else if (line.rfind("CHAT ", 0) == 0) {
            if (!w.model) { emit_err("CHAT before LOAD"); continue; }
            int max_tokens = 0;
            try { max_tokens = std::stoi(line.substr(5)); } catch (...) { emit_err("bad CHAT max_tokens"); continue; }

            std::string system_prompt = read_block_until_dot();
            std::string user_text     = read_block_until_dot();

            // Push system on first turn (Jinja knows whether the model
            // actually supports a system role and folds it into user when
            // not — we no longer need the manual gemma workaround).
            if (w.history.empty() && !system_prompt.empty()) {
                common_chat_msg sys_msg;
                sys_msg.role    = "system";
                sys_msg.content = system_prompt;
                w.history.push_back(sys_msg);
            }
            common_chat_msg user_msg;
            user_msg.role    = "user";
            user_msg.content = user_text;
            w.history.push_back(user_msg);

            // Render full conversation with generation prompt; feed only
            // the delta past prev_len to llama_decode (KV cache already
            // holds the earlier turns).
            common_chat_templates_inputs inputs;
            inputs.messages              = w.history;
            inputs.add_generation_prompt = true;
            inputs.use_jinja             = true;
            common_chat_params params;
            try {
                params = common_chat_templates_apply(w.tmpls.get(), inputs);
            } catch (const std::exception & e) {
                emit_err(std::string("chat_templates_apply failed: ") + e.what());
                continue;
            }
            const std::string & full = params.prompt;
            std::string prompt = w.prev_len <= full.size() ? full.substr(w.prev_len) : full;

            std::string response = generate(w, prompt, max_tokens);

            // Append assistant turn and re-render WITHOUT generation prompt
            // so prev_len marks the boundary the next user turn will append
            // past. Same pattern the previous llama_chat_apply_template
            // path used, just via the Jinja-capable API.
            common_chat_msg asst_msg;
            asst_msg.role    = "assistant";
            asst_msg.content = response;
            w.history.push_back(asst_msg);

            common_chat_templates_inputs inputs2;
            inputs2.messages              = w.history;
            inputs2.add_generation_prompt = false;
            inputs2.use_jinja             = true;
            try {
                auto params2 = common_chat_templates_apply(w.tmpls.get(), inputs2);
                w.prev_len = params2.prompt.size();
            } catch (const std::exception & e) {
                emit_err(std::string("chat_templates_apply (post) failed: ") + e.what());
                w.prev_len = full.size() + response.size(); // best-effort fallback
            }

            emit("DONE");
        } else if (line == "RESET") {
            w.reset_history();
            emit("READY");
        } else if (line == "PING") {
            emit("PONG");
        } else if (line == "QUIT") {
            break;
        } else {
            emit_err(std::string("unknown command: ") + line);
        }
    }

    return 0;
}
