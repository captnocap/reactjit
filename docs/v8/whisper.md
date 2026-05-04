# Whisper Pipeline (V8 Runtime)

The V8 speech pipeline has two separable halves:

- `voice` captures microphone audio, runs WebRTC VAD, and stores utterance PCM
  by id.
- `whisper` takes one stored PCM buffer id plus a local whisper.cpp model path,
  runs transcription on a worker thread, and reports text back to JS on the
  engine tick.

This is local/offline speech-to-text. It does not use browser audio APIs, Web
Audio, server APIs, `fetch`, or DOM media capture.

## Public API

### `useVoiceInput`

Import:

```ts
import { useVoiceInput } from '@reactjit/runtime/hooks/useVoiceInput';
// or from the hook barrel:
import { useVoiceInput } from '@reactjit/runtime/hooks';
```

Shape:

```ts
type VoiceInputOptions = {
  mode?: 0 | 1 | 2 | 3;       // libfvad aggressiveness; default 2
  floor?: number;             // 0..1 amplitude floor; default 0/off
  autoRelease?: boolean;      // default true
  previewStrideMs?: number;   // live-preview snapshot interval; 0 disables
};

type VoiceInputResult = {
  isListening: boolean;
  isSpeaking: boolean;
  vadFrame: 0 | 1;
  level: number;              // 0..1 peak-dBFS meter
  transcript: string;         // last __voice_onTranscript result
  utteranceId: number;        // id of last finalised PCM buffer
  utteranceMs: number;
  start: () => boolean;
  stop: () => void;
};
```

Use `autoRelease: false` when you plan to call `transcribe()` yourself. The
default `autoRelease: true` frees the PCM buffer immediately after
`__voice_onSpeechEnd`, which is right for capture-only carts but wrong for
manual transcription.

### Raw Voice Subscriptions

`runtime/hooks/useVoiceInput.ts` also exports:

```ts
subscribeRawVadFrame(fn: (v: 0 | 1) => void): () => void;
subscribeRawLevel(fn: (level: number) => void): () => void;
subscribePreview(
  fn: (e: { id: number; lenSamples: number; durationMs: number }) => void,
): () => void;
subscribeSpeechStart(fn: () => void): () => void;
```

These bypass React state coalescing, which matters for frame-by-frame meters and
VAD traces.

### `transcribe`

Importing this file is what trips the Whisper build gate:

```ts
import { transcribe } from '@reactjit/runtime/hooks/whisper';
```

Shape:

```ts
type TranscribeResult = {
  bufId: number;
  model: string;
  text: string;
  elapsedMs: number;
  success: boolean;
};

function transcribe(bufId: number, modelPath: string): Promise<TranscribeResult>;
```

`bufId` comes from `useVoiceInput().utteranceId` or from `subscribePreview`.
`modelPath` must point to a local `ggml-*.bin` model. The Zig side expands a
leading `~/`, so paths like `~/.reactjit/models/ggml-base.en-q5_1.bin` work.

Important: the JS promise table in `runtime/hooks/whisper.ts` is keyed by
`bufId`, not `(bufId, modelPath)`. Existing callers run multiple models
sequentially against the same buffer. Do not start parallel `transcribe()` calls
for the same `bufId` unless the wrapper is changed.

### `useEnsembleTranscript`

Import:

```ts
import { useEnsembleTranscript } from '@reactjit/runtime/hooks/useEnsembleTranscript';
```

This hook composes `useVoiceInput({ autoRelease: false })` with `transcribe()`:

- runs a base model list sequentially for each final utterance;
- exposes the first result as `partial`;
- votes model outputs into an ROVER-style word-level `ensemble`;
- optionally escalates to larger models when any word has low vote count;
- optionally transcribes rolling preview buffers while the user is still
  speaking.

Core shape:

```ts
type EnsembleModel = { name: string; path: string };

type UseEnsembleTranscriptOptions = VoiceInputOptions & {
  models: EnsembleModel[];
  escalateTo?: EnsembleModel[];
  escalationThreshold?: number;       // default 2
  livePreviewModel?: EnsembleModel | null;
};

type UseEnsembleTranscriptResult = {
  partial: string;
  individual: Record<string, string>;
  ensemble: {
    words: Array<{
      word: string;
      votes: number;
      sources: string[];
      candidates: Array<{ word: string; sources: string[] }>;
    }>;
    anchor: string;
    modelCount: number;
  } | null;
  isProcessing: boolean;
  isEscalating: boolean;
  escalatedWith: string[];
  livePreview: string;
  livePreviewModelName: string;

  isListening: boolean;
  isSpeaking: boolean;
  level: number;
  utteranceId: number;
  utteranceMs: number;
  start: () => boolean;
  stop: () => void;
};
```

## Minimal Usage

Manual transcription:

```tsx
const voice = useVoiceInput({ mode: 1, floor: 0.333, autoRelease: false });

useEffect(() => {
  if (voice.utteranceId === 0) return;
  let cancelled = false;
  transcribe(voice.utteranceId, '~/.reactjit/models/ggml-base.en-q5_1.bin')
    .then((r) => {
      if (!cancelled) console.log(r.text, r.elapsedMs);
    })
    .finally(() => {
      (globalThis as any).__voice_release_buffer?.(voice.utteranceId);
    });
  return () => { cancelled = true; };
}, [voice.utteranceId]);
```

Ensemble dictation:

```tsx
const dictation = useEnsembleTranscript({
  mode: 1,
  floor: 0.333,
  models: [
    { name: 'tiny', path: '~/.reactjit/models/ggml-tiny.en-q5_1.bin' },
    { name: 'base', path: '~/.reactjit/models/ggml-base.en-q5_1.bin' },
    { name: 'small', path: '~/.reactjit/models/ggml-small.en-q5_1.bin' },
  ],
  escalateTo: [
    { name: 'medium', path: '~/.reactjit/models/ggml-medium.en-q5_0.bin' },
  ],
});
```

## Model Files

Helper script:

```sh
./scripts/fetch-whisper-models
./scripts/fetch-whisper-models --all
./scripts/fetch-whisper-models tiny base
```

Default destination:

```text
~/.reactjit/models/
```

The script downloads quantized English models from
`huggingface.co/ggerganov/whisper.cpp`:

- `tiny` -> `ggml-tiny.en-q5_1.bin`
- `base` -> `ggml-base.en-q5_1.bin`
- `small` -> `ggml-small.en-q5_1.bin`
- `medium` -> `ggml-medium.en-q5_0.bin`

You can override the destination with `RJIT_MODELS_DIR`, but code examples and
the Zig `~/` expansion assume `~/.reactjit/models`.

## Build Gating

Voice and Whisper are separate ingredients:

- `runtime/hooks/useVoiceInput.ts` in the shipped esbuild metafile enables
  `-Dhas-voice=true` and registers `__voice_*`.
- `runtime/hooks/whisper.ts` in the shipped metafile enables
  `-Dhas-whisper=true`, registers `__whisper_*`, and builds/links
  `deps/whisper.cpp`.

The gate is source-driven:

1. `scripts/cart-bundle.js` writes an esbuild metafile beside the bundle.
2. `scripts/ship-metafile-gate.js` walks `outputs[].inputs` and checks
   `sdk/dependency-registry.json`.
3. `scripts/ship` turns the positional gate output into build flags.
4. `build.zig` writes `zig-out/manifest/v8-ingredients/voice.flag` and
   `whisper.flag` so packaging can verify what actually shipped.

`voice.zig` itself is initialized by the engine unconditionally and libfvad is
always compiled because it is small. Without `-Dhas-voice=true`, JS simply has
no registered `__voice_start` / `__voice_stop` entry points.

Whisper is heavy and truly gated. When `-Dhas-whisper=true` is set, `build.zig`
builds `deps/whisper.cpp` and ggml CPU sources as a dynamic `libwhisper.so`,
adds whisper include paths, links the cart against the library, and sets
`$ORIGIN` rpath so `scripts/ship` can package the `.so` beside the binary.

Current dev-host caveat: `scripts/sdk-dependency-resolve.js` drops
`has-whisper` when it would also enable `has-embed`, because both bring ggml
symbols into one process. Standalone `scripts/ship` only enables what the cart
actually imports.

## End-To-End Pipeline

### 1. Hook Installs JS Callbacks

`useVoiceInput.ts` installs global callback receivers once:

```text
__voice_onLevel(rms_x100, vad_verdict)
__voice_onSpeechStart()
__voice_onSpeechEnd(id, lenSamples)
__voice_onPreviewReady(id, lenSamples)
__voice_onTranscript(text)
```

It fans these events into module-local subscriber sets and React state.

`whisper.ts` installs:

```text
__whisper_onResult(json)
```

That callback parses the JSON payload and resolves the pending promise for
`buf_id`.

### 2. JS Starts Capture

`useVoiceInput().start()` calls:

```text
globalThis.__voice_start()
```

`framework/v8_bindings_voice.zig` forwards that to `voice.start()` and returns a
boolean to JS.

Options map to host calls:

```text
mode            -> __voice_set_mode(mode)
floor           -> __voice_set_floor(round(floor * 10000))
previewStrideMs -> __voice_set_preview_stride_ms(ms)
```

### 3. Zig Opens Microphone + VAD

`framework/voice.zig` lazily creates:

- a libfvad instance at 16 kHz;
- an SDL3 default recording stream with `SDL_AUDIO_S16LE`, mono, 16 kHz.

It does not use callbacks. The engine frame loop calls:

```zig
voice.tick(dt_ms);
```

Each tick drains complete 30 ms frames from the SDL stream:

```text
sample rate: 16000 Hz
frame size: 480 samples
format: int16 mono
```

For each frame it computes a peak-dBFS-derived level (`0..10000`), runs
`fvad_process`, applies the optional amplitude floor, and stores the raw
per-frame VAD verdict.

### 4. Voice State Machine Builds Utterances

`voice.zig` has four phases:

```text
idle -> candidate_speech -> speaking -> candidate_silence
```

Debounce constants:

```text
speech start: 3 speech frames  ~= 90 ms
speech end:   25 silent frames ~= 750 ms
hard cap:     30 seconds
```

The first candidate speech frame is included in the utterance buffer so the
front of a sentence is not cut off.

When an utterance ends, `finaliseUtterance()`:

1. copies the collected PCM into an owned `[]i16`;
2. stores it in `S.buffers` under `next_buf_id`;
3. calls `__voice_onSpeechEnd(id, lenSamples)`.

While speech is still in progress, `snapshotPreview()` can periodically copy the
current utterance into the same buffer store and call
`__voice_onPreviewReady(id, lenSamples)`. The default preview stride is about
1.5 seconds after at least 1 second of speech; passing `previewStrideMs: 0`
disables previews.

### 5. JS Submits Transcription

`transcribe(bufId, modelPath)` calls:

```text
globalThis.__whisper_transcribe(bufId, modelPath)
```

`framework/v8_bindings_whisper.zig` converts arguments and calls:

```zig
whisper.enqueueTranscribe(buf_id, model_path)
```

`enqueueTranscribe` rejects empty or too-long model paths, missing PCM buffers,
and allocation failures. On success it copies the model path, appends a job to
the worker queue, signals the worker condition variable, and returns `true`.

### 6. Whisper Worker Loads Model Lazily

`framework/whisper.zig` owns one `whisper_context`.

The worker thread is started by `whisper.init()` and loops on the job queue. For
each job it reloads the model only if the requested `model_path` differs from
the currently loaded one.

Path handling:

- leading `~/` expands to `$HOME/...`;
- paths longer than 1024 bytes are rejected;
- model load uses `whisper_init_from_file`.

There is no public `__whisper_load_model` binding in the current V8 surface.
Model loading is implicit on the first transcription for a path.

### 7. Worker Converts PCM + Runs whisper.cpp

The worker reads the PCM by id from `voice.getBuffer(buf_id)` and converts
`i16` samples to `f32` in `[-1, 1]`.

Current whisper.cpp parameters:

```text
sampling:         WHISPER_SAMPLING_GREEDY
language:         en
translate:        false
single_segment:   false
no_context:       true
suppress_blank:   true
suppress_nst:     true
print_*:          false
n_threads:        4
```

Then it calls:

```c
whisper_full(ctx, params, samples, sample_count)
```

After success, it concatenates all segment text via
`whisper_full_get_segment_text`.

### 8. Result Drains On Engine Tick

The worker posts a `Result` into `S.results`.

The engine frame loop calls:

```zig
whisper.tick(dt_ms);
```

`whisper.tick` drains ready results and fires two JS callbacks:

```text
__voice_onTranscript(text)
__whisper_onResult(json)
```

`__voice_onTranscript` is the simple hook-facing path. It updates
`useVoiceInput().transcript`.

`__whisper_onResult` carries benchmark/detail data:

```json
{
  "buf_id": 1,
  "model": "~/.reactjit/models/ggml-base.en-q5_1.bin",
  "text": "hello world",
  "elapsed_ms": 312,
  "success": true
}
```

Current caveat: `framework/whisper.zig` uses a placeholder `jsonEscape` that
does not actually escape quotes or backslashes. `__voice_onTranscript(text)` is
still the safer text channel if transcripts might contain JSON-breaking
characters; `__whisper_onResult` is mainly used by benchmark carts.

### 9. Buffer Lifetime Ends In JS

PCM buffers are owned by `voice.zig` until JS calls:

```text
__voice_release_buffer(id)
```

Patterns:

- capture-only `useVoiceInput()` defaults to auto-release on speech end;
- manual `transcribe()` callers must use `autoRelease: false` and release after
  the promise settles;
- `useEnsembleTranscript` forces `autoRelease: false`, runs all selected models
  sequentially, then releases the final utterance buffer;
- live-preview snapshots are released by the preview consumer after the preview
  transcription resolves or is dropped.

Do not release a buffer before its queued Whisper job has copied it on the worker
thread.

## Carts And Tests

- `cart/testing_carts/voice_lab.tsx` exercises microphone capture, amplitude,
  raw VAD frames, and debounced speech edges without importing Whisper.
- `cart/app/isolated_tests/whisper_bench.tsx` captures one utterance and runs
  selected models sequentially, showing text, audio duration, inference time,
  and realtime multiplier.
- `cart/app/isolated_tests/dictation.tsx` uses `useEnsembleTranscript`, checks
  model files, can download missing models through FS/HTTP hooks, and renders
  word-level consensus.
- `cart/app/settings/page_old.tsx` contains an older settings design for Whisper
  model download and ensemble normalization.
- `framework/WHISPER_TODO.md` is historical. Several items listed there have
  landed, but the final API differs: the current binding is
  `__whisper_transcribe(buf_id, model_path)` with implicit lazy model loading.

## Source Map

- `runtime/hooks/useVoiceInput.ts` — React hook, voice event callback install,
  capture control, buffer auto-release.
- `runtime/hooks/whisper.ts` — `transcribe()` promise wrapper and
  `__whisper_onResult` handling.
- `runtime/hooks/useEnsembleTranscript.ts` — multi-model transcription,
  word-level voting, escalation, live-preview management.
- `framework/v8_bindings_voice.zig` — `__voice_*` host function registration.
- `framework/voice.zig` — SDL3 microphone capture, libfvad, utterance buffers,
  preview snapshots.
- `framework/v8_bindings_whisper.zig` — `__whisper_transcribe` host binding.
- `framework/whisper.zig` — worker queue, model context ownership,
  whisper.cpp invocation, result dispatch.
- `framework/engine.zig` — initializes/deinitializes voice and whisper, ticks
  both every frame.
- `build.zig` — libfvad compilation, gated libwhisper build/link, ingredient
  manifest.
- `sdk/dependency-registry.json` — source triggers for `voice` and `whisper`.
- `scripts/ship-metafile-gate.js` / `scripts/ship` — metafile gate to Zig flags.
- `scripts/fetch-whisper-models` — local model downloader.

