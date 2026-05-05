# V8 audio pipeline

This is the end-to-end path from cart code to speakers for the V8 runtime.
The short version:

```text
Cart TSX / globalThis.__audio_* call
  -> runtime/audio.tsx or direct host function
  -> framework/v8_bindings_core.zig host callback
  -> framework/audio.zig lock-free command ring
  -> SDL3 audio stream callback
  -> process queued graph commands
  -> topological module order
  -> route port buffers
  -> DSP module processors
  -> terminal audio outputs mixed into master_buffer
  -> SDL_PutAudioStreamData(...)
```

The important rule: audio is not a layout or paint primitive. The React
wrappers render `null`; they exist only to translate React lifecycle and event
handlers into host commands consumed by the audio callback.

## Source map

- `runtime/primitives.tsx` exports the lazy `Audio` namespace.
- `runtime/audio.tsx` is the declarative React wrapper and `useAudio()` hook.
- `runtime/hooks/index.ts` re-exports `useAudio` and `AUDIO_MODULE_TYPE`.
- `runtime/synth.tsx` is an older higher-level synth facade over the same
  camelCase host functions.
- `cart/pocket_operator.tsx` is the current practical cart using the lower
  level snake_case API directly.
- `framework/v8_bindings_core.zig` registers the V8 host functions and converts
  JS arguments into `audio.pushCommand(...)` calls.
- `framework/audio.zig` owns SDL3 device setup, the command queue, module graph,
  port buffers, DSP processors, mixer, telemetry, and QuickJS aliases.
- `framework/ffi/audio.h` is an older C/TSZ FFI declaration surface.
- `framework/voice.zig`, `framework/v8_bindings_voice.zig`, `docs/v8/whisper.md`,
  and `docs/v8/usemedia.md` are separate media/voice-input paths, not this
  modular synth engine.

## Runtime surfaces

There are two active V8-facing APIs.

The declarative wrapper:

```tsx
import { Audio } from '@reactjit/runtime/primitives';
import { useAudio } from '@reactjit/runtime/hooks';

function Instrument() {
  return (
    <Audio gain={0.8}>
      <Audio.Module id="voice" type="pocket_voice" voice={0} tone={0.5} />
      <Audio.Module id="delay" type="delay" time={0.18} feedback={0.35} mix={0.25} />
      <Audio.Connection from="voice" to="delay" fromPort={0} toPort={0} />
    </Audio>
  );
}
```

The direct host-function surface:

```ts
globalThis.__audio_init?.();
globalThis.__audio_add_module?.(10, 10);      // id=10, pocket_voice
globalThis.__audio_add_module?.(20, 4);       // id=20, delay
globalThis.__audio_connect?.(10, 0, 20, 0);
globalThis.__audio_set_param?.(10, 0, 0);     // voice = kick
globalThis.__audio_note_on?.(10, 60);
```

`cart/pocket_operator.tsx` uses the direct path because it needs explicit
engine lifetime control and telemetry polling.

## Initialization

The SDL audio device is created only by `audio.init()` in `framework/audio.zig`.
In V8 that is exposed as:

| Function | Meaning |
| --- | --- |
| `__audio_init()` | Open default playback device, create SDL audio stream, bind callback, resume device. Returns `1` or `0`. |
| `__audio_deinit()` | Destroy stream/device and mark the engine uninitialized. |
| `__audio_is_initialized()` | Return `1` when `g_engine.initialized` is true. |
| `__audio_pause()` | Pause the SDL playback device if one is open. |
| `__audio_resume()` | Resume the SDL playback device if one is open. |

Current caveat: the comments in `runtime/audio.tsx` say the engine
auto-initializes on the first module add. The current V8 binding does not do
that. `__audioAddModule` and `__audio_add_module` only enqueue `add_module`.
If no code calls `__audio_init()` first, there is no SDL callback consuming the
queue and no audio reaches the device.

The known-working pattern is:

```ts
const ok =
  (globalThis.__audio_init?.() ?? 0) > 0 ||
  (globalThis.__audio_is_initialized?.() ?? 0) > 0;

if (ok) {
  globalThis.__audio_add_module?.(1, 10);
  globalThis.__audio_resume?.();
}
```

## React wrapper

`runtime/primitives.tsx` defines lazy functions so `runtime/audio.tsx` is loaded
only when a cart mounts an audio tree:

| JSX API | Implementation |
| --- | --- |
| `Audio` | Calls `require('./audio').Audio(props)`. |
| `Audio.Module` | Calls `require('./audio').Audio.Module(props)`. |
| `Audio.Connection` | Calls `require('./audio').Audio.Connection(props)`. |

`runtime/audio.tsx` then creates a React context holding:

| Field | Meaning |
| --- | --- |
| `names: Map<string, number>` | String module id to numeric module id. |
| `types: Map<number, AudioModuleType>` | Numeric id to module type for param-name lookup. |
| `nextId.current` | Per-`Audio` tree numeric id allocator, starting at `1`. |
| `getId(name)` | Resolve a string id. |
| `getType(idOrName)` | Resolve the module type. |

`<Audio gain={...}>` only provides the context and pushes master-gain changes:

```text
gain prop changes -> __audioMasterGain(gain)
children          -> React context provider
render output     -> null host nodes from children
```

`<Audio.Module id="voice" type="pocket_voice" ...params />`:

```text
first render -> allocate numeric id and register name/type in context
mount        -> __audioAddModule(numId, moduleTypeNumber)
render effect -> for each numeric typed param prop:
                 __audioSetParam(numId, paramIndex, value)
unmount      -> __audioRemoveModule(numId), delete context entries
```

`<Audio.Connection from="a" to="b" fromPort={0} toPort={0} />`:

```text
mount   -> setTimeout(..., 0) so sibling module mount effects run first
timer   -> resolve from/to ids, then __audioConnect(a, fromPort, b, toPort)
unmount -> clear pending timer and __audioDisconnect(...) if connected
```

`useAudio()` returns an imperative handle for events that do not fit a
declarative tree:

| Method | Host call |
| --- | --- |
| `getId(name)` | Context lookup only. |
| `noteOn(target, midi)` | `__audioNoteOn(id, midi)` |
| `noteOff(target)` | `__audioNoteOff(id)` |
| `setParam(target, name, value)` | Resolve module type, map param name to index, call `__audioSetParam`. |
| `setParamIndex(target, index, value)` | `__audioSetParam(id, index, value)` |

## V8 host functions

`framework/v8_bindings_core.zig` registers both camelCase and snake_case names.
The camelCase names are used by `runtime/audio.tsx` and `runtime/synth.tsx`.
The snake_case names match the QuickJS surface and are used by
`cart/pocket_operator.tsx`.

Command-producing calls:

| CamelCase | Snake_case | Command |
| --- | --- | --- |
| `__audioAddModule(id, type)` | `__audio_add_module(id, type)` | `add_module` |
| `__audioRemoveModule(id)` | `__audio_remove_module(id)` | `remove_module` |
| `__audioConnect(from, fromPort, to, toPort)` | `__audio_connect(...)` | `connect` |
| `__audioDisconnect(from, fromPort, to, toPort)` | `__audio_disconnect(...)` | `disconnect` |
| `__audioSetParam(id, index, value)` | `__audio_set_param(...)` | `set_param` |
| `__audioNoteOn(id, midi)` | `__audio_note_on(...)` | `note_on` |
| `__audioNoteOff(id)` | `__audio_note_off(id)` | `note_off` |
| `__audioMasterGain(gain)` | `__audio_set_master_gain(gain)` | `set_master_gain` |

Engine-control and telemetry calls are snake_case only:

| Function | Return |
| --- | --- |
| `__audio_init()` | `1` on successful init, else `0`. |
| `__audio_deinit()` | No meaningful value. |
| `__audio_is_initialized()` | `1` or `0`. |
| `__audio_pause()` / `__audio_resume()` | No meaningful value. |
| `__audio_get_module_count()` | `g_engine.module_count`. Includes inactive slots because removal marks modules inactive but does not compact. |
| `__audio_get_connection_count()` | `g_engine.connection_count`. Includes inactive connection slots. |
| `__audio_get_callback_count()` | Number of SDL callbacks that completed. |
| `__audio_get_callback_us()` | Last callback duration in microseconds. |
| `__audio_get_sample_rate()` | `44100`. |
| `__audio_get_buffer_size()` | `512`. |
| `__audio_get_peak_level()` | Peak absolute value in the current master buffer. |
| `__audio_get_param(id, index)` | Current param value or `0`. |
| `__audio_get_param_count(id)` | Active module param count or `0`. |
| `__audio_get_port_count(id)` | Active module port count or `0`. |
| `__audio_get_module_type(id)` | Module enum number or `-1`. |
| `__audio_get_param_min(id, index)` | Param metadata min or `0`. |
| `__audio_get_param_max(id, index)` | Param metadata max or `0`. |

V8 command functions ignore `audio.pushCommand(...)`'s boolean return, so queue
overflow is not reported to JS. The QuickJS host implementations in
`framework/audio.zig` return `1` or `0` for most command pushes, but V8 aliases
do not.

## Module types

The numeric module enum is shared by `runtime/audio.tsx`,
`runtime/synth.tsx`, `cart/pocket_operator.tsx`, and `framework/audio.zig`.

| Number | Type |
| --- | --- |
| `0` | `oscillator` |
| `1` | `filter` |
| `2` | `amplifier` |
| `3` | `mixer` |
| `4` | `delay` |
| `5` | `envelope` |
| `6` | `lfo` |
| `7` | `sequencer` |
| `8` | `sampler` |
| `9` | `custom` |
| `10` | `pocket_voice` |

The V8 add-module binding clamps incoming type values to `0..10` before
casting to the Zig enum.

## Params and ports

Param order is the ABI. JSX param names in `Audio.Module` are converted to
these indices before reaching Zig.

| Type | Ports | Params |
| --- | --- | --- |
| `oscillator` | `0 audio_out`, `1 freq_in`, `2 fm_in` | `0 waveform`, `1 frequency`, `2 detune`, `3 gain`, `4 fm_amount` |
| `filter` | `0 audio_in`, `1 audio_out`, `2 cutoff_in` | `0 cutoff`, `1 resonance`, `2 mode` |
| `amplifier` | `0 audio_in`, `1 audio_out`, `2 gain_in` | `0 gain` |
| `mixer` | `0 in_1`, `1 in_2`, `2 in_3`, `3 in_4`, `4 audio_out` | `0 gain_1`, `1 gain_2`, `2 gain_3`, `3 gain_4` |
| `delay` | `0 audio_in`, `1 audio_out` | `0 time`, `1 feedback`, `2 mix` |
| `envelope` | `0 audio_in`, `1 audio_out`, `2 gate_in` | `0 attack`, `1 decay`, `2 sustain`, `3 release` |
| `lfo` | `0 control_out` | `0 rate`, `1 depth`, `2 waveform` |
| `sequencer` | `0 freq_out`, `1 gate_out` | `0 bpm`, `1 steps` |
| `sampler` | `0 audio_out`, `1 gate_in` | `0 gain`, `1 loop` |
| `custom` | none | none |
| `pocket_voice` | `0 audio_out` | `0 voice`, `1 tone`, `2 decay`, `3 color`, `4 drive`, `5 gain` |

Parameter metadata also stores `ParamType`, `min`, `max`, and `default`.
`set_param` does not clamp values when commands are applied. Some DSP functions
clamp locally when reading params, and others assume sane values.

Waveform values:

| Value | Waveform |
| --- | --- |
| `0` | sine |
| `1` | saw |
| `2` | square |
| `3` | triangle |
| `4` | noise |

Filter mode values:

| Value | Mode |
| --- | --- |
| `0` | lowpass |
| `1` | highpass |
| `2` | bandpass |

Pocket voice values:

| Value | Voice |
| --- | --- |
| `0` | kick |
| `1` | snare |
| `2` | hat |
| `3` | bass |
| `4` | lead |

## Engine state

`framework/audio.zig` preallocates almost all state in the global `g_engine`:

| Field | Meaning |
| --- | --- |
| `device_id`, `stream` | SDL3 playback device and audio stream. |
| `modules[MAX_MODULES]` | Fixed module slots, max `64`. |
| `connections[MAX_CONNECTIONS]` | Fixed patch-cable slots, max `256`. |
| `exec_order[MAX_MODULES]` | Topological sort result. |
| `master_buffer[BUFFER_SIZE * MAX_CHANNELS]` | Mixed output buffer. |
| `master_gain` | Applied when terminal outputs are summed. Default `0.8`. |
| `buffer_storage` | Port buffer pool for all module/port pairs. |
| `commands[MAX_COMMAND_QUEUE]` | Atomic ring of graph/control commands, max `1024`. |
| `callback_count`, `callback_us` | Telemetry updated by the audio callback. |
| `initialized` | Whether SDL stream/device are open. |

Constants:

| Constant | Value |
| --- | --- |
| `SAMPLE_RATE` | `44100` |
| `BUFFER_SIZE` | `512` |
| `MAX_CHANNELS` | `2` |
| `MAX_MODULES` | `64` |
| `MAX_CONNECTIONS` | `256` |
| `MAX_PORTS_PER_MODULE` | `8` |
| `MAX_PARAMS_PER_MODULE` | `16` |
| `MAX_COMMAND_QUEUE` | `1024` |

The SDL stream is currently opened as `SDL_AUDIO_F32`, `channels = 1`,
`freq = 44100`, so output is mono even though `MAX_CHANNELS` and
`master_buffer` reserve stereo-sized storage.

## Command queue

JS/V8 runs on the control side and calls `audio.pushCommand(cmd)`.

```text
pushCommand:
  tail = cmd_tail
  next = (tail + 1) % MAX_COMMAND_QUEUE
  if next == cmd_head: queue full -> false
  commands[tail] = cmd
  cmd_tail = next
```

The SDL callback consumes commands with `popCommand()` before processing each
audio buffer. The comments call this both MPSC and SPSC in different places;
the implementation is a single atomic ring with one expected JS producer and
one audio-thread consumer.

Commands are applied only on the audio callback thread:

| Command | Audio-thread effect |
| --- | --- |
| `add_module` | Initialize next module slot, assign id/type/port buffers/default params, mark graph dirty. |
| `remove_module` | Mark module inactive and deactivate related connections, mark graph dirty. |
| `connect` | Append active connection, mark graph dirty. |
| `disconnect` | Mark matching connection inactive, mark graph dirty. |
| `set_param` | Assign `params[index].value` if the module and index exist. |
| `note_on` | Convert MIDI note to frequency; oscillator writes frequency param, pocket voice writes `base_freq`; trigger envelope state. |
| `note_off` | Set envelope stage to release. |
| `set_master_gain` | Assign `g_engine.master_gain`. No clamp is applied here. |

Module and connection arrays are not compacted after removal. Counts are slot
watermarks; active checks determine behavior.

## SDL callback

`audio.init()` performs setup on the main/control side:

```text
buffer_pool.data = &buffer_storage
SDL_OpenAudioDevice(default playback, F32 mono 44100)
SDL_CreateAudioStream(&spec, &spec)
SDL_SetAudioStreamGetCallback(stream, audioCallback, null)
SDL_BindAudioStream(device, stream)
SDL_ResumeAudioDevice(device)
initialized = true
```

When SDL requests data, `audioCallback(...)` runs:

```text
if additional_amount <= 0: return

processCommands()
if order_dirty: rebuildExecOrder()

num_samples = BUFFER_SIZE
clearInputBuffers(num_samples)
routeConnections(num_samples)

for idx in exec_order:
  processModule(modules[idx], num_samples)

clear master_buffer
for every active module audio out port:
  if that out port has no active downstream connection:
    master_buffer += port_buffer * master_gain

SDL_PutAudioStreamData(stream, master_buffer, BUFFER_SIZE * sizeof(f32))
update callback telemetry
```

Two details matter:

1. `additional_amount` is used only as a positive/zero signal. The callback
   always renders `BUFFER_SIZE` samples.
2. `routeConnections()` runs before module processing. That means a downstream
   module input receives whatever was in the upstream output buffer before the
   current callback's `processModule` pass. For current-buffer graph semantics,
   routing would need to happen as each upstream module finishes, or inside the
   topological processing loop.

## Graph order and routing

`rebuildExecOrder()` computes a simple topological order:

```text
count active incoming connections per active module
queue modules with zero incoming edges
pop queue, append to exec_order
for outgoing edges: decrement downstream in_degree
when downstream reaches zero: queue it
```

Cycles are not reported. Modules left with nonzero in-degree after the BFS do
not enter `exec_order`, so they do not process.

`routeConnections(num_samples)` then loops active connections:

```text
from module/port -> source buffer
to module/port   -> destination buffer
dst[j] += src[j] for every sample
```

Multiple connections into one input port are additive.

Master output is implicit. There is no real module id `0` in `audio.zig`;
terminal audio output ports are mixed automatically. Older wrappers such as
`runtime/synth.tsx` use a `MASTER_ID = 0` convention and `toMaster`, but the
Zig engine does not special-case id `0`.

## DSP modules

All processors write into their own output port buffers.

`oscillator`:

- Generates sine, saw, square, triangle, or noise.
- Reads `frequency`, applies cents `detune`, `gain`, and `fm_amount`.
- If `freq_in` buffer sample `0` is positive, it overrides frequency.
- If `fm_in` exists, per-sample FM is added as `fm_in[i] * fm_amount`.

`filter`:

- Reads `audio_in`, writes `audio_out`.
- Uses a simple two-pole state-variable-style filter.
- `cutoff_in` sample `0` can override cutoff when positive.
- `mode`: lowpass, highpass, or bandpass.

`amplifier`:

- Multiplies `audio_in` by `gain`.
- `gain_in` sample `0` can override gain when positive.

`mixer`:

- Sums up to four audio inputs into `audio_out`.
- Uses `gain_1..gain_4` per input.

`delay`:

- Uses preallocated global delay storage: eight delay modules, two seconds
  maximum per module.
- Lazy-assigns a delay buffer from that pool.
- Applies dry/wet `mix` and feedback.

`envelope`:

- ADSR envelope driven by `gate_in` or `note_on`/`note_off` state.
- Multiplies `audio_in` into `audio_out`.

`lfo`:

- Generates a control waveform into `control_out`.
- Uses `rate`, `depth`, and `waveform`.

`sequencer`:

- Emits a built-in C-major frequency pattern and gate signal.
- Uses `bpm` and `steps`.

`pocket_voice`:

- Generates one-shot voices for kick, snare, hat, bass, and lead.
- `note_on` sets `base_freq`, resets trigger time, changes noise seed, and
  starts the envelope.
- Params shape tone, decay, color, drive, and output gain.

`sampler` and `custom`:

- Ports/params exist for `sampler`, but both `sampler` and `custom` are no-op
  in `processModule()` today.

## Practical pocket_operator flow

`cart/pocket_operator.tsx` is the clearest current end-to-end user of the
engine:

```text
mount:
  __audio_init()
  __audio_add_module(MIXER_ID, mixer)
  __audio_add_module(DELAY_ID, delay)
  for each track:
    __audio_add_module(track.moduleId, pocket_voice)
    __audio_connect(track.moduleId, 0, MIXER_ID, trackIndex)
    __audio_set_param(MIXER_ID, trackIndex, 1)
  __audio_connect(MIXER_ID, 4, DELAY_ID, 0)
  __audio_resume()

controls:
  master gain -> __audio_set_master_gain
  delay knobs -> __audio_set_param(DELAY_ID, ...)
  track knobs -> __audio_set_param(track.moduleId, ...)

sequencer tick:
  accent params -> __audio_set_param(...)
  trigger voice -> __audio_note_on(track.moduleId, midiNote)

telemetry:
  poll __audio_get_peak_level()
  poll __audio_get_callback_us()

unmount:
  remove track modules, delay, mixer
  __audio_deinit()
```

Because the delay's output is terminal, it is mixed to the master buffer
automatically.

## Sharp edges

- The declarative `Audio` wrapper does not call `__audio_init()`. A cart using
  only `<Audio>` must initialize audio elsewhere or the queue will never drain.
- V8 command host functions do not return queue success/failure.
- `master_gain` and most params are not clamped at command application time.
- Output is currently F32 mono.
- `routeConnections()` currently happens before module processing, so connected
  graphs can behave like they are one callback behind.
- `sampler` and `custom` are registered but not implemented.
- `runtime/synth.tsx` has a master-id convention that the Zig engine does not
  implement.
- Velocity arguments to `note_on` are ignored; the command stores only module id
  and MIDI note.
- The `framework/audio.zig` header still describes a LuaJIT DSP engine. The
  current processing path in this file is Zig DSP; `lua_state` fields are
  present but unused in the callback.
- Removal marks slots inactive but does not reclaim module ids, compact arrays,
  or decrement count telemetry.

## Minimal working sequence

For direct host usage under V8:

```ts
const host = globalThis as any;

if ((host.__audio_init?.() ?? 0) > 0) {
  host.__audio_add_module(1, 10); // pocket_voice
  host.__audio_set_param(1, 0, 0); // kick
  host.__audio_set_param(1, 1, 0.5); // tone
  host.__audio_set_param(1, 5, 0.8); // gain
  host.__audio_set_master_gain(0.7);
  host.__audio_resume();
  host.__audio_note_on(1, 60);
}
```

For declarative usage, add explicit initialization until the wrapper or binding
grows auto-init:

```tsx
function App() {
  React.useEffect(() => {
    globalThis.__audio_init?.();
    globalThis.__audio_resume?.();
    return () => globalThis.__audio_deinit?.();
  }, []);

  return (
    <Audio gain={0.7}>
      <Audio.Module id="kick" type="pocket_voice" voice={0} tone={0.5} gain={0.8} />
    </Audio>
  );
}
```
