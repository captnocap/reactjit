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
//     TOOLS\n<json_array_of_{name,description,parameters}>\n.\n
//                         — register tool schemas; persists across CHATs
//                            until next TOOLS or RESET. Empty array clears.
//     CHAT <max_tokens>\n<system_prompt>\n<user_text>\n.\n
//     TOOL_RESULT <id>\n<result_text>\n.\n
//                         — sent in response to a worker-emitted TOOL_CALL
//                            during an active CHAT
//     RESET\n             — drop chat history + tools, keep model loaded
//     PING\n              — round-trip health check
//     QUIT\n              — shut down cleanly
//
//   worker → parent (one event per line):
//     READY\n             — model loaded, ready for CHAT
//     TOK <text>\n        — one token piece (text may contain spaces;
//                            newlines inside are escaped as \n)
//     TOOL_CALL <id>\n<name>\n<arguments_json>\n.\n
//                         — model wants to call a tool. Worker pauses
//                            generation and waits for TOOL_RESULT.
//     DONE\n              — generation complete (no further tool calls)
//     PONG\n              — response to PING
//     ERR <message>\n     — fatal-ish error
//
// Output is line-buffered (one fflush per event). Tokens that contain
// literal '\n' get the byte escaped as backslash-n; the parent
// reverses the escape. This keeps the protocol trivially line-parseable.

#include "llama.h"
#include "chat.h"   // common_chat_templates_* — full Jinja + per-model tool-call parsers
#include "nlohmann/json.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <sstream>
#include <vector>

using json = nlohmann::ordered_json;

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

// ── Hauhaucs XML tool-call fallback ─────────────────────────────────
//
// Several uncensored Qwen finetunes (HauhauCS-Aggressive family, etc.)
// are trained to emit tool calls as nested XML rather than the
// JSON-in-<tool_call> shape vanilla Qwen3 / Hermes / Mistral use:
//
//   <tool_call>
//   <function=get_weather>
//   <parameter=city>
//   tokyo
//   </parameter>
//   </function>
//   </tool_call>
//
// common_chat_parse won't recognize this (it's nobody's official format),
// so we run a regex pass on the raw model output as a fallback when the
// upstream parser returns no tool_calls. Plain whitespace/newlines around
// names and values are tolerated; values are passed through verbatim and
// emitted as JSON strings.

static std::string trim_ws(const std::string & s) {
    size_t a = 0;
    while (a < s.size() && std::isspace(static_cast<unsigned char>(s[a]))) a++;
    size_t b = s.size();
    while (b > a && std::isspace(static_cast<unsigned char>(s[b - 1]))) b--;
    return s.substr(a, b - a);
}

static std::string json_escape_str(const std::string & s) {
    std::string out;
    out.reserve(s.size() + 2);
    out += '"';
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out += c;
                }
        }
    }
    out += '"';
    return out;
}

// Parse Hauhaucs-style XML tool calls out of `text`. Returns the parsed
// calls (empty if none found) and writes the non-tool-call content (with
// any <think>...</think> reasoning preserved as `reasoning_out`) into
// `content_out`.
static std::vector<common_chat_tool_call> parse_hauhaucs_tool_calls(
    const std::string & text,
    std::string &       content_out,
    std::string &       reasoning_out)
{
    std::vector<common_chat_tool_call> calls;
    content_out.clear();
    reasoning_out.clear();

    // Split reasoning out of `text`. Two patterns:
    //   1. Implicit-open: Qwen3-thinking and similar models have <think>
    //      pre-injected by the chat template, so the model emits only
    //      </think>. Everything before the FIRST </think> is reasoning,
    //      provided no <think> precedes it.
    //   2. Explicit pairs: <think>…</think> blocks scattered in output.
    std::string remaining = text;

    {
        size_t close_pos = remaining.find("</think>");
        size_t open_pos  = remaining.find("<think>");
        if (close_pos != std::string::npos &&
            (open_pos == std::string::npos || close_pos < open_pos)) {
            reasoning_out.append(remaining, 0, close_pos);
            remaining.erase(0, close_pos + 8);
        }
    }

    std::string body;
    {
        size_t pos = 0;
        while (pos < remaining.size()) {
            size_t open = remaining.find("<think>", pos);
            if (open == std::string::npos) {
                body.append(remaining, pos, std::string::npos);
                break;
            }
            body.append(remaining, pos, open - pos);
            size_t close = remaining.find("</think>", open);
            if (close == std::string::npos) {
                if (!reasoning_out.empty()) reasoning_out += "\n";
                reasoning_out.append(remaining, open + 7, std::string::npos);
                break;
            }
            if (!reasoning_out.empty()) reasoning_out += "\n";
            reasoning_out.append(remaining, open + 7, close - (open + 7));
            pos = close + 8;
        }
    }

    size_t pos = 0;
    while (pos < body.size()) {
        size_t open = body.find("<tool_call>", pos);
        if (open == std::string::npos) {
            content_out.append(body, pos, std::string::npos);
            break;
        }
        content_out.append(body, pos, open - pos);
        size_t close = body.find("</tool_call>", open);
        if (close == std::string::npos) {
            // Unterminated — abort fallback, treat as plain content
            content_out.append(body, open, std::string::npos);
            break;
        }
        const std::string block = body.substr(open + 11, close - (open + 11));
        pos = close + 12;

        // Extract function name: <function=NAME>
        const std::string func_open = "<function=";
        size_t f_at = block.find(func_open);
        if (f_at == std::string::npos) continue;
        size_t f_end = block.find(">", f_at + func_open.size());
        if (f_end == std::string::npos) continue;
        std::string fn_name = trim_ws(block.substr(f_at + func_open.size(), f_end - (f_at + func_open.size())));

        // Walk <parameter=KEY>…</parameter> blocks, build JSON args.
        std::string args_json = "{";
        bool first = true;
        size_t p = f_end + 1;
        const std::string param_open = "<parameter=";
        while (p < block.size()) {
            size_t pa = block.find(param_open, p);
            if (pa == std::string::npos) break;
            size_t pa_end = block.find(">", pa + param_open.size());
            if (pa_end == std::string::npos) break;
            std::string key = trim_ws(block.substr(pa + param_open.size(), pa_end - (pa + param_open.size())));
            size_t vstart = pa_end + 1;
            size_t pclose = block.find("</parameter>", vstart);
            if (pclose == std::string::npos) break;
            std::string val = trim_ws(block.substr(vstart, pclose - vstart));
            if (!first) args_json += ",";
            args_json += json_escape_str(key);
            args_json += ":";
            args_json += json_escape_str(val);
            first = false;
            p = pclose + 12;
        }
        args_json += "}";

        common_chat_tool_call tc;
        tc.name      = fn_name;
        tc.arguments = args_json;
        // tc.id stays empty — caller will mint one
        calls.push_back(tc);
    }

    content_out = trim_ws(content_out);
    reasoning_out = trim_ws(reasoning_out);
    return calls;
}

// ── worker state ────────────────────────────────────────────────────

struct WorkerState {
    llama_model *   model    = nullptr;
    llama_context * ctx      = nullptr;
    llama_sampler * sampler  = nullptr;
    const llama_vocab * vocab = nullptr;
    common_chat_templates_ptr tmpls;     // initialized in load_model from the model's embedded Jinja
    std::vector<common_chat_msg> history;
    std::vector<common_chat_tool> tools; // registered via TOOLS command; persists until RESET
    size_t prev_len = 0;                 // chars of the most recently rendered prompt (no gen prompt)
    int n_ctx = 4096;

    void reset_history() {
        history.clear();
        tools.clear();
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
        } else if (line == "TOOLS") {
            std::string body = read_block_until_dot();
            w.tools.clear();
            if (body.empty()) {
                // explicit clear is also valid
            } else {
                try {
                    auto j = json::parse(body);
                    if (!j.is_array()) {
                        emit_err("TOOLS body must be a JSON array");
                        continue;
                    }
                    for (auto & t : j) {
                        common_chat_tool tool;
                        tool.name        = t.value("name", "");
                        tool.description = t.value("description", "");
                        // parameters is an object — re-serialize so the
                        // template engine receives canonical JSON.
                        if (t.contains("parameters")) {
                            tool.parameters = t["parameters"].dump();
                        } else {
                            tool.parameters = "{}";
                        }
                        w.tools.push_back(tool);
                    }
                } catch (const std::exception & e) {
                    emit_err(std::string("TOOLS parse failed: ") + e.what());
                    continue;
                }
            }
            emit("READY");
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

            // Tool-call loop. Each iteration:
            //  1. render history (+ tools, +gen prompt) → prompt
            //  2. generate response (streamed via TOK)
            //  3. parse — if no tool calls, push assistant msg, exit
            //  4. else: emit TOOL_CALL events, await TOOL_RESULT,
            //     append assistant (with tool_calls) and tool turns,
            //     loop for next assistant turn
            const size_t MAX_TOOL_ROUNDS = 8;
            size_t round = 0;
            bool aborted = false;
            for (; round < MAX_TOOL_ROUNDS; round++) {
                common_chat_templates_inputs inputs;
                inputs.messages              = w.history;
                inputs.tools                 = w.tools;
                inputs.add_generation_prompt = true;
                inputs.use_jinja             = true;
                common_chat_params params;
                try {
                    params = common_chat_templates_apply(w.tmpls.get(), inputs);
                } catch (const std::exception & e) {
                    emit_err(std::string("chat_templates_apply failed: ") + e.what());
                    aborted = true;
                    break;
                }
                const std::string & full = params.prompt;
                std::string prompt = w.prev_len <= full.size() ? full.substr(w.prev_len) : full;

                std::string response = generate(w, prompt, max_tokens);
                fprintf(stderr, "[worker] generate done: %zu chars, tools=%zu, parsing...\n", response.size(), w.tools.size()); fflush(stderr);

                // Parse model output. If no tools were registered (or the
                // model didn't emit a call), parsed.tool_calls stays empty
                // and we treat this as a normal assistant turn.
                common_chat_parser_params pp(params);
                common_chat_msg parsed;
                bool parse_ok = true;
                try {
                    parsed = common_chat_parse(response, false, pp);
                    fprintf(stderr, "[worker] common_chat_parse OK: tool_calls=%zu content.len=%zu\n", parsed.tool_calls.size(), parsed.content.size()); fflush(stderr);
                } catch (const std::exception & e) {
                    fprintf(stderr, "[worker] common_chat_parse THREW: %s\n", e.what()); fflush(stderr);
                    parse_ok = false;
                }

                // Fallback: Hauhaucs-style XML tool calls that
                // common_chat_parse doesn't recognize OR throws on. Run
                // whenever we end up with no calls AND tools are
                // registered — `parse_ok` doesn't gate it, since a
                // throw is exactly when we want to try the fallback.
                if (parsed.tool_calls.empty() && !w.tools.empty()) {
                    std::string fb_content, fb_reasoning;
                    auto fb_calls = parse_hauhaucs_tool_calls(response, fb_content, fb_reasoning);
                    fprintf(stderr, "[worker] hauhaucs fallback: %zu calls\n", fb_calls.size()); fflush(stderr);
                    if (!fb_calls.empty()) {
                        parsed.tool_calls       = fb_calls;
                        parsed.content          = fb_content;
                        parse_ok = true;  // we have valid calls now, take the tool-call branch
                        if (!fb_reasoning.empty() && parsed.reasoning_content.empty()) {
                            parsed.reasoning_content = fb_reasoning;
                        }
                    }
                }

                if (!parse_ok || parsed.tool_calls.empty()) {
                    common_chat_msg asst;
                    asst.role    = "assistant";
                    asst.content = parse_ok ? parsed.content : response;
                    if (parse_ok && !parsed.reasoning_content.empty()) {
                        asst.reasoning_content = parsed.reasoning_content;
                    }
                    w.history.push_back(asst);

                    common_chat_templates_inputs inp_post;
                    inp_post.messages              = w.history;
                    inp_post.tools                 = w.tools;
                    inp_post.add_generation_prompt = false;
                    inp_post.use_jinja             = true;
                    try {
                        auto p_post = common_chat_templates_apply(w.tmpls.get(), inp_post);
                        w.prev_len = p_post.prompt.size();
                    } catch (const std::exception &) {
                        w.prev_len = full.size() + response.size();
                    }
                    break;
                }

                // Tool calls present. Push assistant turn carrying them,
                // then emit each one and await a TOOL_RESULT before
                // continuing to the next round.
                fprintf(stderr, "[worker] entering tool-call branch (%zu calls)\n", parsed.tool_calls.size()); fflush(stderr);
                common_chat_msg asst;
                asst.role       = "assistant";
                asst.content    = parsed.content;
                asst.tool_calls = parsed.tool_calls;
                if (!parsed.reasoning_content.empty()) {
                    asst.reasoning_content = parsed.reasoning_content;
                }
                w.history.push_back(asst);
                fprintf(stderr, "[worker] pushed assistant turn, beginning emit loop\n"); fflush(stderr);

                bool tool_round_aborted = false;
                for (size_t i = 0; i < parsed.tool_calls.size(); i++) {
                    auto & tc = parsed.tool_calls[i];
                    std::string call_id = tc.id.empty()
                        ? ("tc" + std::to_string(round) + "-" + std::to_string(i))
                        : tc.id;

                    fprintf(stderr, "[worker] EMIT TOOL_CALL %zu/%zu id=%s name=%s args.len=%zu\n",
                        i+1, parsed.tool_calls.size(), call_id.c_str(), tc.name.c_str(), tc.arguments.size()); fflush(stderr);
                    emit(("TOOL_CALL " + call_id).c_str());
                    emit(tc.name.c_str());
                    // arguments is JSON; emit raw, then "." terminator
                    fputs(tc.arguments.c_str(), stdout);
                    fputc('\n', stdout);
                    emit(".");
                    fprintf(stderr, "[worker] TOOL_CALL %zu emitted, awaiting TOOL_RESULT...\n", i+1); fflush(stderr);

                    std::string rl = read_line_or_empty();
                    if (rl.empty()) {
                        emit_err("EOF waiting for TOOL_RESULT");
                        tool_round_aborted = true;
                        aborted = true;
                        break;
                    }
                    if (rl.rfind("TOOL_RESULT ", 0) != 0) {
                        emit_err(std::string("expected TOOL_RESULT, got: ") + rl);
                        tool_round_aborted = true;
                        aborted = true;
                        break;
                    }
                    std::string result_id   = rl.substr(12);
                    std::string result_body = read_block_until_dot();

                    common_chat_msg tool_msg;
                    tool_msg.role         = "tool";
                    tool_msg.tool_call_id = result_id;
                    tool_msg.content      = result_body;
                    w.history.push_back(tool_msg);
                }
                if (tool_round_aborted) break;

                // Update prev_len so the next iteration's render delta
                // covers only the new turn boundary.
                common_chat_templates_inputs inp_mid;
                inp_mid.messages              = w.history;
                inp_mid.tools                 = w.tools;
                inp_mid.add_generation_prompt = false;
                inp_mid.use_jinja             = true;
                try {
                    auto p_mid = common_chat_templates_apply(w.tmpls.get(), inp_mid);
                    w.prev_len = p_mid.prompt.size();
                } catch (const std::exception &) {
                    // Best-effort — leave prev_len; next render's delta
                    // computation will cope with a small overshoot.
                }
            }
            if (round == MAX_TOOL_ROUNDS) {
                emit_err("tool-call loop hit MAX_TOOL_ROUNDS");
            }
            if (!aborted) emit("DONE");
        } else if (line.rfind("TOOL_RESULT ", 0) == 0) {
            // Out-of-band TOOL_RESULT (no active tool-call awaited). Drain
            // its body so we don't leave dangling lines for the next CHAT
            // and surface the protocol mistake to the parent.
            (void)read_block_until_dot();
            emit_err("unexpected TOOL_RESULT outside CHAT tool loop");
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
