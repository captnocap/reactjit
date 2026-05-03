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
    std::vector<llama_chat_message> history;
    std::vector<char> formatted;
    int prev_len = 0;
    int n_ctx = 4096;

    void reset_history() {
        for (auto & msg : history) {
            free(const_cast<char *>(msg.role));
            free(const_cast<char *>(msg.content));
        }
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

    w.formatted.resize(w.n_ctx);
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

            // llama.cpp's apply_template handles a fixed set of named
            // formats but can't render arbitrary Jinja. The model's
            // embedded template is full Jinja, so we sniff it for known
            // marker tokens and pick the closest hardcoded name.
            const char * embedded = llama_model_chat_template(w.model, nullptr);
            const char * tmpl_name = "chatml";
            if (embedded) {
                if (strstr(embedded, "start_of_turn") || strstr(embedded, "<|turn>")) tmpl_name = "gemma";
                else if (strstr(embedded, "|im_start|")) tmpl_name = "chatml";
                else if (strstr(embedded, "[INST]")) tmpl_name = "llama2";
                else if (strstr(embedded, "<|user|>")) tmpl_name = "phi3";
            }

            // gemma2/gemma3/gemma4 templates DO NOT support a system role —
            // they raise "System role not supported". Workaround: prepend
            // the system text into the first user message.
            std::string effective_user = user_text;
            if (w.history.empty() && !system_prompt.empty()) {
                effective_user = system_prompt + "\n\n" + user_text;
            }
            w.history.push_back({ strdup("user"), strdup(effective_user.c_str()) });

            int new_len = llama_chat_apply_template(tmpl_name, w.history.data(), w.history.size(), true, w.formatted.data(), w.formatted.size());
            if (new_len > (int)w.formatted.size()) {
                w.formatted.resize(new_len);
                new_len = llama_chat_apply_template(tmpl_name, w.history.data(), w.history.size(), true, w.formatted.data(), w.formatted.size());
            }
            if (new_len < 0) { emit_err(std::string("chat_apply_template failed for ") + tmpl_name); continue; }

            std::string prompt(w.formatted.begin() + w.prev_len, w.formatted.begin() + new_len);
            std::string response = generate(w, prompt, max_tokens);

            w.history.push_back({ strdup("assistant"), strdup(response.c_str()) });
            w.prev_len = llama_chat_apply_template(tmpl_name, w.history.data(), w.history.size(), false, nullptr, 0);

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
