# AI Appliance: Single-File AI Characters

## The Idea

A portable, self-contained binary that IS an AI character. Not a runtime that loads characters — the character itself compiled into an executable. Double-click it, the character is alive. No Python, no Docker, no API keys, no internet.

## What the User Sees

1. Open the **authoring tool** (itself an ReactJIT binary)
2. Design a character:
   - Portrait, sprites, images
   - Personality and dialogue style
   - Behaviors and sampling parameters
   - Abilities (mapped to tool-use patterns)
   - Memory rules
3. Drag in any GGUF model file (Llama, Mistral, Qwen, whatever)
4. Hit **Build**
5. Out comes a single file: `elena.bin` — your character, alive, portable, runs anywhere

## What's Inside the Binary

| Component | Size | Role |
|-----------|------|------|
| Love2D runtime + Lua + QuickJS | ~30 MB | Renderer and UI framework |
| llama.cpp shared library | ~2 MB | Inference engine |
| Character sheet (structured data) | KB | Personality, behaviors, abilities |
| Images and sprites | MB | Visual identity |
| Model weights (GGUF) | 5–50 GB | The brain — user's choice of model and quantization |
| React UI bundle | KB | The interaction surface |

Total: dominated by the model weights. Everything else is noise.

## Dual-Mode: Character + Infrastructure

The model is already loaded into RAM. Don't waste that. The binary serves two purposes simultaneously:

### Personality Mode
The character UI — a living widget with the authored persona, rendered in Love2D.

### Server Mode
An OpenAI-compatible HTTP API on localhost. Any tool on the machine can use it.

```
# Raw model, no character — just a local LLM API
curl localhost:8080/v1/chat/completions -d '{"messages": [...]}'

# Same endpoint, but with the character's personality injected
curl localhost:8080/v1/chat/completions?character=true -d '{"messages": [...]}'
```

Same weights, same memory footprint, zero additional cost. The character window and the API server share one loaded model.

## Why This Matters

**The model isn't double disk space — it's infrastructure.** You're already paying the RAM cost. Expose it. Now your "AI living box" is also:
- Your local Copilot backend
- Your script automation brain
- Your other apps' inference server
- Any tool that speaks the OpenAI API format

One process. One memory footprint. Multiple consumers.

**This solves the "why download 15 GB" problem.** It's not just a toy character. It's your local AI infrastructure that also happens to have a face when you interact with it directly.

## Technical Architecture

### Inference Bridge
- **llama.cpp** compiled as a shared library (`.so` / `.dylib` / `.dll`)
- Lua loads it via FFI, or it runs as a subprocess with piped I/O
- Tokens stream back into the React UI via the existing QuickJS bridge

### Character Sheet Format
Structured data that maps to inference configuration:
- **Personality** → system prompt template
- **Behaviors** → sampling parameters (temperature, top-p, repetition penalty)
- **Abilities** → tool-use definitions and function schemas
- **Memory rules** → context window management strategy

### Build Pipeline
Extends the existing `dist:love` self-extracting binary format:
```
[shell stub] + [compressed tarball containing:]
  ├── love2d runtime + glibc
  ├── lua/ runtime
  ├── libllama.so
  ├── bundle.js (React UI)
  ├── character.json (personality, behaviors, abilities)
  ├── assets/ (images, sprites)
  └── model.gguf (the weights)
```

### HTTP Server
- Embedded in the binary, starts on boot alongside the UI
- OpenAI-compatible `/v1/chat/completions` endpoint
- Optional character injection per request
- Configurable port, discoverable via mDNS/Bonjour (stretch goal)

## Constraints

**Memory is the real limit, not disk.** A 24B Q4 model needs ~14 GB RAM for weights alone. The target machine needs that available. Disk space and download size are solvable problems (people download bigger games). RAM availability is the hard gate.

**Startup time scales with model size.** Loading 15 GB of weights takes a few seconds. The UI framework is already there — show a loading screen while the model warms up.

**GPU is optional.** llama.cpp does CPU inference. Slower, but it works everywhere. GPU acceleration (CUDA, Metal, Vulkan) is a bonus, not a requirement.

## What Makes This Different

Every existing tool (Character.ai, SillyTavern, KoboldAI, Ollama) is a **runtime environment** where you load characters into a running app. This is the inverse: the character **becomes** the app. Each character is its own executable.

You don't install an AI framework and then configure a character. You receive a character — a file — and it runs.

## Open Questions

- **Authoring tool scope:** Full visual editor in ReactJIT, or CLI-driven build from a config file? The visual editor is more ambitious but more compelling.
- **Model updates:** If a better model comes out, can you re-bind the character sheet to new weights without the authoring tool? (Probably yes — just swap the GGUF and rebuild.)
- **Multi-character:** Can one binary host multiple characters sharing one model? (Probably — different system prompts, same weights.)
- **Networking:** Should characters be able to discover each other on a LAN? Characters talking to characters.
- **Platform targets:** Linux first (self-extracting binary exists). macOS and Windows would need their own packaging formats (`.app` bundle, `.exe` with embedded resources).
