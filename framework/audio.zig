//! Audio Subsystem — SDL3 audio stream + LuaJIT DSP engine
//!
//! Three-phase architecture per the research blueprint:
//!   1. Init (main thread): SDL3 device, buffers, LuaJIT VM, module registry
//!   2. Control (QuickJS): graph topology changes via atomic commits to MPSC queue
//!   3. DSP (audio callback): LuaJIT processes graph, writes to Zig-owned buffers
//!
//! The audio callback runs on an OS interrupt thread. It MUST NOT:
//!   - Allocate memory (malloc/free)
//!   - Lock mutexes
//!   - Do file I/O or logging
//!   - Trigger garbage collection
//!
//! All buffers are pre-allocated at init. The callback only reads atomics and
//! processes pre-allocated float buffers via LuaJIT FFI zero-copy pointers.

const std = @import("std");
const log = @import("log.zig");
const zluajit = @import("zluajit");

// SDL3 C imports
const sdl = @cImport({
    @cInclude("SDL3/SDL.h");
});

// ── Constants ───────────────────────────────────────────────────────

pub const SAMPLE_RATE: u32 = 44100;
pub const BUFFER_SIZE: u32 = 512;
pub const MAX_CHANNELS: u32 = 2;
pub const MAX_MODULES: u32 = 64;
pub const MAX_CONNECTIONS: u32 = 256;
pub const MAX_PORTS_PER_MODULE: u32 = 8;
pub const MAX_PARAMS_PER_MODULE: u32 = 16;
pub const MAX_COMMAND_QUEUE: u32 = 1024;

// ── Port and Param types ────────────────────────────────────────────

pub const PortType = enum(u8) { audio, control, midi };
pub const PortDir = enum(u8) { in_, out };
pub const ParamType = enum(u8) { float, int, bool_, enum_ };
pub const Waveform = enum(u8) { sine, saw, square, triangle, noise };

pub const Port = struct {
    name: [32]u8 = undefined,
    name_len: u8 = 0,
    port_type: PortType = .audio,
    direction: PortDir = .out,
    buffer: [*]f32 = undefined, // points into pre-allocated pool
};

pub const Param = struct {
    name: [32]u8 = undefined,
    name_len: u8 = 0,
    param_type: ParamType = .float,
    value: f64 = 0,
    min: f64 = 0,
    max: f64 = 1,
    default: f64 = 0,
};

// ── Module ──────────────────────────────────────────────────────────

pub const ModuleType = enum(u8) {
    oscillator,
    filter,
    amplifier,
    mixer,
    delay,
    envelope,
    lfo,
    sequencer,
    sampler,
    custom,
    pocket_voice,
};

pub const Module = struct {
    id: u32 = 0,
    slot_index: u32 = 0,
    module_type: ModuleType = .oscillator,
    active: bool = false,

    ports: [MAX_PORTS_PER_MODULE]Port = undefined,
    port_count: u8 = 0,

    params: [MAX_PARAMS_PER_MODULE]Param = undefined,
    param_count: u8 = 0,

    // DSP state (type-specific, pre-allocated)
    phase: f64 = 0,
    phase2: f64 = 0,
    envelope_stage: u8 = 0, // 0=idle, 1=attack, 2=decay, 3=sustain, 4=release
    envelope_level: f64 = 0,
    filter_y1: f64 = 0,
    filter_y2: f64 = 0,
    delay_write_pos: u32 = 0,
    delay_buffer: ?[*]f32 = null,
    trigger_time: f64 = 0,
    base_freq: f64 = 110,
    noise_seed: u32 = 1,
};

// ── Connection ──────────────────────────────────────────────────────

pub const Connection = struct {
    from_module: u32 = 0,
    from_port: u8 = 0,
    to_module: u32 = 0,
    to_port: u8 = 0,
    active: bool = false,
};

// ── Command queue (MPSC: QuickJS → audio thread) ────────────────────

pub const CommandType = enum(u8) {
    add_module,
    remove_module,
    connect,
    disconnect,
    set_param,
    note_on,
    note_off,
    set_master_gain,
};

pub const Command = struct {
    cmd_type: CommandType = .add_module,
    module_id: u32 = 0,
    module_type: ModuleType = .oscillator,
    port_a: u8 = 0,
    port_b: u8 = 0,
    target_module: u32 = 0,
    param_index: u8 = 0,
    value_f: f64 = 0,
    value_i: i32 = 0,
};

// ── Audio engine state (all pre-allocated) ──────────────────────────

const BufferPool = struct {
    // Pre-allocated float buffers for all module ports
    // MAX_MODULES * MAX_PORTS_PER_MODULE * BUFFER_SIZE floats
    data: []f32,

    fn getBuffer(self: *BufferPool, module_idx: u32, port_idx: u8) [*]f32 {
        const offset = (@as(usize, module_idx) * MAX_PORTS_PER_MODULE + port_idx) * BUFFER_SIZE;
        return self.data.ptr + offset;
    }
};

var g_engine: struct {
    // SDL3 audio
    device_id: sdl.SDL_AudioDeviceID = 0,
    stream: ?*sdl.SDL_AudioStream = null,

    // Module graph
    modules: [MAX_MODULES]Module = undefined,
    module_count: u32 = 0,
    connections: [MAX_CONNECTIONS]Connection = undefined,
    connection_count: u32 = 0,

    // Execution order (topological sort result)
    exec_order: [MAX_MODULES]u32 = undefined,
    exec_count: u32 = 0,
    order_dirty: bool = true,

    // Master output
    master_buffer: [BUFFER_SIZE * MAX_CHANNELS]f32 = [_]f32{0} ** (BUFFER_SIZE * MAX_CHANNELS),
    master_gain: f32 = 0.8,

    // Buffer pool
    buffer_pool: BufferPool = .{ .data = &.{} },
    buffer_storage: [MAX_MODULES * MAX_PORTS_PER_MODULE * BUFFER_SIZE]f32 = [_]f32{0} ** (MAX_MODULES * MAX_PORTS_PER_MODULE * BUFFER_SIZE),

    // Command queue (lock-free SPSC)
    commands: [MAX_COMMAND_QUEUE]Command = undefined,
    cmd_head: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),
    cmd_tail: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),

    // LuaJIT DSP engine
    lua_state: ?zluajit.State = null,
    lua_ready: bool = false,

    // Telemetry
    callback_count: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    underrun_count: std.atomic.Value(u32) = std.atomic.Value(u32).init(0),
    callback_us: std.atomic.Value(u64) = std.atomic.Value(u64).init(0),
    initialized: bool = false,
} = .{};

// ── Command queue operations ────────────────────────────────────────

/// Push a command from the control thread (QuickJS). Lock-free.
pub fn pushCommand(cmd: Command) bool {
    const tail = g_engine.cmd_tail.load(.acquire);
    const next = (tail + 1) % MAX_COMMAND_QUEUE;
    if (next == g_engine.cmd_head.load(.acquire)) return false; // full
    g_engine.commands[tail] = cmd;
    g_engine.cmd_tail.store(next, .release);
    return true;
}

/// Pop a command in the audio callback. Lock-free.
fn popCommand() ?Command {
    const head = g_engine.cmd_head.load(.acquire);
    if (head == g_engine.cmd_tail.load(.acquire)) return null;
    const cmd = g_engine.commands[head];
    g_engine.cmd_head.store((head + 1) % MAX_COMMAND_QUEUE, .release);
    return cmd;
}

// ── Module initialization helpers ───────────────────────────────────

fn initModulePorts(m: *Module) void {
    switch (m.module_type) {
        .oscillator => {
            addPort(m, "audio_out", .audio, .out);
            addPort(m, "freq_in", .control, .in_);
            addPort(m, "fm_in", .audio, .in_);
            addParam(m, "waveform", .enum_, 0, 4, 1); // sine=0, saw=1, square=2, tri=3, noise=4
            addParam(m, "frequency", .float, 20, 20000, 440);
            addParam(m, "detune", .float, -100, 100, 0);
            addParam(m, "gain", .float, 0, 1, 0.8);
            addParam(m, "fm_amount", .float, 0, 1000, 0);
        },
        .filter => {
            addPort(m, "audio_in", .audio, .in_);
            addPort(m, "audio_out", .audio, .out);
            addPort(m, "cutoff_in", .control, .in_);
            addParam(m, "cutoff", .float, 20, 20000, 1000);
            addParam(m, "resonance", .float, 0, 1, 0);
            addParam(m, "mode", .enum_, 0, 2, 0); // lowpass=0, highpass=1, bandpass=2
        },
        .amplifier => {
            addPort(m, "audio_in", .audio, .in_);
            addPort(m, "audio_out", .audio, .out);
            addPort(m, "gain_in", .control, .in_);
            addParam(m, "gain", .float, 0, 2, 1);
        },
        .mixer => {
            addPort(m, "in_1", .audio, .in_);
            addPort(m, "in_2", .audio, .in_);
            addPort(m, "in_3", .audio, .in_);
            addPort(m, "in_4", .audio, .in_);
            addPort(m, "audio_out", .audio, .out);
            addParam(m, "gain_1", .float, 0, 2, 1);
            addParam(m, "gain_2", .float, 0, 2, 1);
            addParam(m, "gain_3", .float, 0, 2, 1);
            addParam(m, "gain_4", .float, 0, 2, 1);
        },
        .delay => {
            addPort(m, "audio_in", .audio, .in_);
            addPort(m, "audio_out", .audio, .out);
            addParam(m, "time", .float, 0.001, 2.0, 0.25);
            addParam(m, "feedback", .float, 0, 0.95, 0.4);
            addParam(m, "mix", .float, 0, 1, 0.3);
        },
        .envelope => {
            addPort(m, "audio_in", .audio, .in_);
            addPort(m, "audio_out", .audio, .out);
            addPort(m, "gate_in", .control, .in_);
            addParam(m, "attack", .float, 0.001, 5.0, 0.01);
            addParam(m, "decay", .float, 0.001, 5.0, 0.1);
            addParam(m, "sustain", .float, 0, 1, 0.7);
            addParam(m, "release", .float, 0.001, 10.0, 0.3);
        },
        .lfo => {
            addPort(m, "control_out", .control, .out);
            addParam(m, "rate", .float, 0.01, 100, 1);
            addParam(m, "depth", .float, 0, 1, 1);
            addParam(m, "waveform", .enum_, 0, 3, 0);
        },
        .sequencer => {
            addPort(m, "freq_out", .control, .out);
            addPort(m, "gate_out", .control, .out);
            addParam(m, "bpm", .float, 20, 300, 120);
            addParam(m, "steps", .int, 1, 32, 8);
        },
        .sampler => {
            addPort(m, "audio_out", .audio, .out);
            addPort(m, "gate_in", .control, .in_);
            addParam(m, "gain", .float, 0, 2, 1);
            addParam(m, "loop", .bool_, 0, 1, 0);
        },
        .custom => {},
        .pocket_voice => {
            addPort(m, "audio_out", .audio, .out);
            addParam(m, "voice", .enum_, 0, 4, 0); // kick, snare, hat, bass, lead
            addParam(m, "tone", .float, 0, 1, 0.5);
            addParam(m, "decay", .float, 0.02, 1.5, 0.25);
            addParam(m, "color", .float, 0, 1, 0.4);
            addParam(m, "drive", .float, 0, 1, 0.2);
            addParam(m, "gain", .float, 0, 1.5, 0.8);
        },
    }
}

fn addPort(m: *Module, name: []const u8, port_type: PortType, direction: PortDir) void {
    if (m.port_count >= MAX_PORTS_PER_MODULE) return;
    var p = &m.ports[m.port_count];
    const len = @min(name.len, 31);
    @memcpy(p.name[0..len], name[0..len]);
    p.name_len = @intCast(len);
    p.port_type = port_type;
    p.direction = direction;
    p.buffer = g_engine.buffer_pool.getBuffer(m.slot_index, m.port_count);
    m.port_count += 1;
}

fn addParam(m: *Module, name: []const u8, param_type: ParamType, min: f64, max: f64, default: f64) void {
    if (m.param_count >= MAX_PARAMS_PER_MODULE) return;
    var p = &m.params[m.param_count];
    const len = @min(name.len, 31);
    @memcpy(p.name[0..len], name[0..len]);
    p.name_len = @intCast(len);
    p.param_type = param_type;
    p.min = min;
    p.max = max;
    p.default = default;
    p.value = default;
    m.param_count += 1;
}

// ── DSP processing (called from audio callback) ─────────────────────

fn processOscillator(m: *Module, num_samples: u32) void {
    const out_buf = m.ports[0].buffer; // audio_out
    const wf: Waveform = @enumFromInt(@as(u8, @intFromFloat(m.params[0].value)));
    var freq = m.params[1].value; // frequency
    const detune = m.params[2].value;
    const gain = m.params[3].value;
    const fm_amt = m.params[4].value;
    var phase = m.phase;
    const inv_sr = 1.0 / @as(f64, @floatFromInt(SAMPLE_RATE));

    // Detune: cents → multiplier
    const detune_mult = std.math.pow(f64, 2.0, detune / 1200.0);
    freq *= detune_mult;

    // Check freq control input
    if (m.port_count > 1) {
        const freq_in = m.ports[1].buffer; // freq_in
        const fv = freq_in[0];
        if (fv > 0) freq = @floatCast(fv);
    }

    const fm_buf = if (m.port_count > 2) m.ports[2].buffer else null; // fm_in

    for (0..num_samples) |i| {
        var f = freq;
        if (fm_buf) |fb| {
            f += @as(f64, @floatCast(fb[i])) * fm_amt;
        }

        const sample: f32 = @floatCast(generateSample(phase, wf) * gain);
        out_buf[i] = sample;
        phase += f * inv_sr;
        phase -= @floor(phase);
    }
    m.phase = phase;
}

fn generateSample(phase: f64, wf: Waveform) f64 {
    const TWO_PI = 2.0 * std.math.pi;
    return switch (wf) {
        .sine => @sin(phase * TWO_PI),
        .saw => 2.0 * (phase - @floor(phase + 0.5)),
        .square => if (@mod(phase, 1.0) < 0.5) @as(f64, 1.0) else @as(f64, -1.0),
        .triangle => 4.0 * @abs(phase - @floor(phase + 0.5)) - 1.0,
        .noise => blk: {
            // Simple LCG noise
            const x = @as(u32, @truncate(@as(u64, @bitCast(@as(i64, @intFromFloat(phase * 2147483647.0))))));
            break :blk @as(f64, @floatFromInt(@as(i32, @bitCast(x *% 1103515245 +% 12345)))) / 2147483647.0;
        },
    };
}

fn wrapPhase(v: f64) f64 {
    const wrapped = v - @floor(v);
    return if (wrapped < 0) wrapped + 1.0 else wrapped;
}

fn nextNoise(seed: *u32) f64 {
    seed.* = seed.* *% 1664525 +% 1013904223;
    return (@as(f64, @floatFromInt(seed.* >> 1)) / 1073741824.0) - 1.0;
}

fn softClip(x: f64) f64 {
    return x / (1.0 + @abs(x));
}

fn processFilter(m: *Module, num_samples: u32) void {
    const in_buf = m.ports[0].buffer;
    const out_buf = m.ports[1].buffer;
    var cutoff = m.params[0].value;
    const reso = m.params[1].value;
    var y1 = m.filter_y1;
    var y2 = m.filter_y2;

    // Check cutoff control input
    if (m.port_count > 2) {
        const cv = m.ports[2].buffer[0];
        if (cv > 0) cutoff = @floatCast(cv);
    }

    // Simple 2-pole resonant filter (SVF approximation)
    const f_norm = 2.0 * @sin(std.math.pi * cutoff / @as(f64, @floatFromInt(SAMPLE_RATE)));
    const q = 1.0 - reso * 0.99;

    for (0..num_samples) |i| {
        const x: f64 = @floatCast(in_buf[i]);
        const hp = x - y1 - q * (y1 - y2);
        y1 += f_norm * hp;
        y2 += f_norm * (y1 - y2);
        // mode: 0=lp, 1=hp, 2=bp
        const mode: u8 = @intFromFloat(m.params[2].value);
        out_buf[i] = @floatCast(switch (mode) {
            0 => y2, // lowpass
            1 => hp, // highpass
            else => y1 - y2, // bandpass
        });
    }
    m.filter_y1 = y1;
    m.filter_y2 = y2;
}

fn processAmplifier(m: *Module, num_samples: u32) void {
    const in_buf = m.ports[0].buffer;
    const out_buf = m.ports[1].buffer;
    var gain = m.params[0].value;

    // Check gain control input
    if (m.port_count > 2) {
        const gv = m.ports[2].buffer[0];
        if (gv > 0) gain = @floatCast(gv);
    }

    const g: f32 = @floatCast(gain);
    for (0..num_samples) |i| {
        out_buf[i] = in_buf[i] * g;
    }
}

fn processMixer(m: *Module, num_samples: u32) void {
    const out_idx: u8 = 4; // 5th port is output
    if (m.port_count <= out_idx) return;
    const out_buf = m.ports[out_idx].buffer;

    // Clear output
    for (0..num_samples) |i| out_buf[i] = 0;

    // Mix up to 4 inputs
    for (0..4) |ch| {
        if (ch >= m.port_count - 1) break;
        const in_buf = m.ports[ch].buffer;
        const g: f32 = @floatCast(m.params[ch].value);
        for (0..num_samples) |i| {
            out_buf[i] += in_buf[i] * g;
        }
    }
}

fn processEnvelope(m: *Module, num_samples: u32) void {
    const in_buf = m.ports[0].buffer;
    const out_buf = m.ports[1].buffer;
    const gate_val = m.ports[2].buffer[0]; // gate control
    const attack = m.params[0].value;
    const decay = m.params[1].value;
    const sustain = m.params[2].value;
    const release = m.params[3].value;
    var stage = m.envelope_stage;
    var level = m.envelope_level;
    const inv_sr = 1.0 / @as(f64, @floatFromInt(SAMPLE_RATE));

    // Gate on/off detection
    if (gate_val > 0.5 and stage == 0) stage = 1; // attack
    if (gate_val < 0.5 and stage > 0 and stage < 4) stage = 4; // release

    for (0..num_samples) |i| {
        switch (stage) {
            1 => { // attack
                level += inv_sr / @max(attack, 0.001);
                if (level >= 1.0) {
                    level = 1.0;
                    stage = 2;
                }
            },
            2 => { // decay
                level -= (1.0 - sustain) * inv_sr / @max(decay, 0.001);
                if (level <= sustain) {
                    level = sustain;
                    stage = 3;
                }
            },
            3 => {}, // sustain — hold level
            4 => { // release
                level -= level * inv_sr / @max(release, 0.001);
                if (level < 0.001) {
                    level = 0;
                    stage = 0;
                }
            },
            else => {},
        }
        out_buf[i] = in_buf[i] * @as(f32, @floatCast(level));
    }
    m.envelope_stage = stage;
    m.envelope_level = level;
}

fn processLfo(m: *Module, num_samples: u32) void {
    const out_buf = m.ports[0].buffer;
    const rate = m.params[0].value;
    const depth = m.params[1].value;
    const wf: Waveform = @enumFromInt(@as(u8, @intFromFloat(m.params[2].value)));
    var phase = m.phase;
    const inv_sr = 1.0 / @as(f64, @floatFromInt(SAMPLE_RATE));

    for (0..num_samples) |i| {
        const sample = generateSample(phase, wf) * depth;
        out_buf[i] = @floatCast(sample);
        phase += rate * inv_sr;
        phase -= @floor(phase);
    }
    m.phase = phase;
}

// Pre-allocated delay line storage (shared across all delay modules)
const MAX_DELAY_SAMPLES = SAMPLE_RATE * 2; // 2 seconds max
const MAX_DELAY_MODULES = 8;
var g_delay_storage: [MAX_DELAY_MODULES][MAX_DELAY_SAMPLES]f32 = [_][MAX_DELAY_SAMPLES]f32{[_]f32{0} ** MAX_DELAY_SAMPLES} ** MAX_DELAY_MODULES;
var g_delay_alloc_count: u32 = 0;

fn processDelay(m: *Module, num_samples: u32) void {
    const in_buf = m.ports[0].buffer;
    const out_buf = m.ports[1].buffer;
    const delay_time = m.params[0].value; // seconds
    const feedback = m.params[1].value;
    const mix = m.params[2].value;

    // Lazy-allocate from pool
    if (m.delay_buffer == null) {
        if (g_delay_alloc_count < MAX_DELAY_MODULES) {
            m.delay_buffer = &g_delay_storage[g_delay_alloc_count];
            g_delay_alloc_count += 1;
        } else return;
    }
    const dbuf = m.delay_buffer.?;

    const delay_samples: u32 = @intFromFloat(@min(
        @as(f64, @floatFromInt(MAX_DELAY_SAMPLES - 1)),
        delay_time * @as(f64, @floatFromInt(SAMPLE_RATE)),
    ));
    if (delay_samples == 0) {
        @memcpy(out_buf[0..num_samples], in_buf[0..num_samples]);
        return;
    }

    var wp = m.delay_write_pos;
    for (0..num_samples) |i| {
        const rp = (wp + MAX_DELAY_SAMPLES - delay_samples) % MAX_DELAY_SAMPLES;
        const delayed: f64 = @floatCast(dbuf[rp]);
        const dry: f64 = @floatCast(in_buf[i]);
        dbuf[wp] = @floatCast(dry + delayed * feedback);
        out_buf[i] = @floatCast(dry * (1.0 - mix) + delayed * mix);
        wp = (wp + 1) % MAX_DELAY_SAMPLES;
    }
    m.delay_write_pos = wp;
}

fn processSequencer(m: *Module, num_samples: u32) void {
    const freq_out = m.ports[0].buffer;
    const gate_out = m.ports[1].buffer;
    const bpm = m.params[0].value;
    const steps_f = m.params[1].value;
    const steps: u32 = @intFromFloat(@max(1, @min(32, steps_f)));
    var phase = m.phase;
    const inv_sr = 1.0 / @as(f64, @floatFromInt(SAMPLE_RATE));
    const step_freq = bpm / 60.0; // steps per second

    // Simple C-major scale pattern
    const scale = [_]f64{ 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.5, 1174.7, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.5, 1174.7 };

    for (0..num_samples) |i| {
        const step: u32 = @intFromFloat(@mod(phase * step_freq, @as(f64, @floatFromInt(steps))));
        freq_out[i] = @floatCast(scale[step % 32]);
        // Gate: high for first 80% of step, low for last 20%
        const step_phase = @mod(phase * step_freq, 1.0);
        gate_out[i] = if (step_phase < 0.8) @as(f32, 1.0) else @as(f32, 0.0);
        phase += inv_sr;
    }
    m.phase = phase;
}

fn processPocketVoice(m: *Module, num_samples: u32) void {
    const out_buf = m.ports[0].buffer;
    var stage = m.envelope_stage;
    var env = m.envelope_level;

    if (stage == 0 or env <= 0.00001) {
        for (0..num_samples) |i| out_buf[i] = 0;
        m.envelope_stage = 0;
        m.envelope_level = 0;
        return;
    }

    const voice: u8 = @intFromFloat(@min(4.0, @max(0.0, m.params[0].value)));
    const tone = @min(1.0, @max(0.0, m.params[1].value));
    const decay = @max(0.01, m.params[2].value);
    const color = @min(1.0, @max(0.0, m.params[3].value));
    const drive = @min(1.0, @max(0.0, m.params[4].value));
    const gain = @max(0.0, m.params[5].value);
    const decay_coeff = std.math.exp(-1.0 / (decay * @as(f64, @floatFromInt(SAMPLE_RATE))));
    const dt = 1.0 / @as(f64, @floatFromInt(SAMPLE_RATE));

    var phase = m.phase;
    var phase2 = m.phase2;
    var t = m.trigger_time;
    const base_freq = if (m.base_freq > 0.0) m.base_freq else 110.0;
    var lp = m.filter_y1;
    var hp = m.filter_y2;
    var seed = if (m.noise_seed == 0) @as(u32, 1) else m.noise_seed;

    for (0..num_samples) |i| {
        if (stage == 0 or env <= 0.00005) {
            out_buf[i] = 0;
            env = 0;
            stage = 0;
            continue;
        }

        const noise = nextNoise(&seed);
        var sample: f64 = 0;

        switch (voice) {
            0 => { // kick
                const drop = std.math.exp(-t * (18.0 + tone * 50.0));
                const freq = 38.0 + tone * 82.0 + drop * (110.0 + color * 70.0) + base_freq * 0.06;
                const body = @sin(phase * 2.0 * std.math.pi);
                const click = noise * std.math.exp(-t * 120.0) * (0.04 + color * 0.12);
                sample = (body * 1.15 + click) * env;
                phase = wrapPhase(phase + freq * dt);
            },
            1 => { // snare
                const freq = 150.0 + tone * 180.0 + base_freq * 0.04;
                const ring = @sin(phase * 2.0 * std.math.pi) * 0.45 +
                    @sin(phase2 * 2.0 * std.math.pi) * 0.2;
                lp += (noise - lp) * (0.10 + tone * 0.12);
                const bright = noise - lp * (0.25 + (1.0 - color) * 0.1);
                sample = (bright * (0.75 + color * 0.45) + ring * (0.30 + (1.0 - color) * 0.20)) * env;
                phase = wrapPhase(phase + freq * dt);
                phase2 = wrapPhase(phase2 + freq * 1.77 * dt);
            },
            2 => { // hat
                const freq1 = 2100.0 + tone * 2800.0;
                const freq2 = 3200.0 + color * 3600.0;
                lp += (noise - lp) * 0.05;
                hp += ((noise - lp) - hp) * (0.35 + color * 0.25);
                const metal = generateSample(phase, .square) * 0.35 +
                    generateSample(phase2, .square) * 0.25;
                sample = (hp * 0.9 + metal * 0.55) * env * (0.7 + color * 0.4);
                phase = wrapPhase(phase + freq1 * dt);
                phase2 = wrapPhase(phase2 + freq2 * dt);
            },
            3 => { // bass
                const freq = @max(32.0, base_freq * (0.5 + tone * 0.8));
                const wobble = 1.0 + std.math.exp(-t * 8.0) * 0.06;
                const saw = generateSample(phase, .saw);
                const sub = @sin(phase2 * 2.0 * std.math.pi);
                sample = softClip((saw * (0.55 + tone * 0.20) + sub * 0.6) * (1.0 + drive * 4.0)) * env * (0.75 + color * 0.35);
                phase = wrapPhase(phase + freq * wobble * dt);
                phase2 = wrapPhase(phase2 + freq * 0.5 * dt);
            },
            else => { // lead
                const freq = @max(70.0, base_freq * (0.85 + tone * 0.35));
                const pulse = generateSample(phase, .square);
                const saw = generateSample(phase2, .saw);
                const vibrato = 1.0 + @sin(t * 7.0) * (0.002 + color * 0.01);
                sample = softClip((pulse * (0.55 + color * 0.15) + saw * 0.45) * (1.0 + drive * 5.0)) * env;
                phase = wrapPhase(phase + freq * vibrato * dt);
                phase2 = wrapPhase(phase2 + freq * (1.002 + color * 0.01) * dt);
            },
        }

        out_buf[i] = @floatCast(sample * gain);
        env *= decay_coeff;
        t += dt;

        if (env <= 0.00005) {
            env = 0;
            stage = 0;
        }
    }

    m.phase = phase;
    m.phase2 = phase2;
    m.trigger_time = t;
    m.envelope_level = env;
    m.envelope_stage = stage;
    m.filter_y1 = lp;
    m.filter_y2 = hp;
    m.noise_seed = seed;
}

fn processModule(m: *Module, num_samples: u32) void {
    if (!m.active) return;
    switch (m.module_type) {
        .oscillator => processOscillator(m, num_samples),
        .filter => processFilter(m, num_samples),
        .amplifier => processAmplifier(m, num_samples),
        .mixer => processMixer(m, num_samples),
        .envelope => processEnvelope(m, num_samples),
        .lfo => processLfo(m, num_samples),
        .delay => processDelay(m, num_samples),
        .sequencer => processSequencer(m, num_samples),
        .pocket_voice => processPocketVoice(m, num_samples),
        .sampler, .custom => {},
    }
}

// ── Graph routing ───────────────────────────────────────────────────

fn routeConnections(num_samples: u32) void {
    for (0..g_engine.connection_count) |i| {
        const conn = &g_engine.connections[i];
        if (!conn.active) continue;

        const from_mod = findModule(conn.from_module) orelse continue;
        const to_mod = findModule(conn.to_module) orelse continue;
        if (conn.from_port >= from_mod.port_count) continue;
        if (conn.to_port >= to_mod.port_count) continue;

        const src = from_mod.ports[conn.from_port].buffer;
        const dst = to_mod.ports[conn.to_port].buffer;

        // Copy or add (for mixing multiple inputs into one port)
        for (0..num_samples) |j| {
            dst[j] += src[j];
        }
    }
}

fn clearInputBuffers(num_samples: u32) void {
    for (0..g_engine.module_count) |i| {
        const m = &g_engine.modules[i];
        if (!m.active) continue;
        for (0..m.port_count) |p| {
            if (m.ports[p].direction == .in_) {
                const buf = m.ports[p].buffer;
                for (0..num_samples) |j| buf[j] = 0;
            }
        }
    }
}

// ── Topological sort ────────────────────────────────────────────────

fn rebuildExecOrder() void {
    // Simple topological sort via dependency counting
    var in_degree: [MAX_MODULES]u32 = [_]u32{0} ** MAX_MODULES;
    var id_to_idx: [MAX_MODULES]u32 = [_]u32{0} ** MAX_MODULES;

    // Map module IDs to indices
    for (0..g_engine.module_count) |i| {
        id_to_idx[i] = g_engine.modules[i].id;
    }

    // Count incoming connections per module
    for (0..g_engine.connection_count) |i| {
        const conn = &g_engine.connections[i];
        if (!conn.active) continue;
        for (0..g_engine.module_count) |j| {
            if (g_engine.modules[j].id == conn.to_module and g_engine.modules[j].active) {
                in_degree[j] += 1;
            }
        }
    }

    // BFS: start with modules that have no inputs
    var queue: [MAX_MODULES]u32 = undefined;
    var q_head: u32 = 0;
    var q_tail: u32 = 0;
    g_engine.exec_count = 0;

    for (0..g_engine.module_count) |i| {
        if (g_engine.modules[i].active and in_degree[i] == 0) {
            queue[q_tail] = @intCast(i);
            q_tail += 1;
        }
    }

    while (q_head < q_tail) {
        const idx = queue[q_head];
        q_head += 1;
        g_engine.exec_order[g_engine.exec_count] = idx;
        g_engine.exec_count += 1;

        const mod_id = g_engine.modules[idx].id;
        for (0..g_engine.connection_count) |i| {
            const conn = &g_engine.connections[i];
            if (!conn.active or conn.from_module != mod_id) continue;
            for (0..g_engine.module_count) |j| {
                if (g_engine.modules[j].id == conn.to_module and g_engine.modules[j].active) {
                    in_degree[j] -= 1;
                    if (in_degree[j] == 0) {
                        queue[q_tail] = @intCast(j);
                        q_tail += 1;
                    }
                }
            }
        }
    }

    g_engine.order_dirty = false;
}

fn findModule(id: u32) ?*Module {
    for (0..g_engine.module_count) |i| {
        if (g_engine.modules[i].id == id and g_engine.modules[i].active) return &g_engine.modules[i];
    }
    return null;
}

// ── Command processing (in audio callback) ──────────────────────────

fn processCommands() void {
    while (popCommand()) |cmd| {
        switch (cmd.cmd_type) {
            .add_module => {
                if (g_engine.module_count >= MAX_MODULES) continue;
                var m = &g_engine.modules[g_engine.module_count];
                m.* = Module{};
                m.id = cmd.module_id;
                m.slot_index = g_engine.module_count;
                m.module_type = cmd.module_type;
                m.active = true;
                initModulePorts(m);
                g_engine.module_count += 1;
                g_engine.order_dirty = true;
            },
            .remove_module => {
                if (findModule(cmd.module_id)) |m| {
                    m.active = false;
                    // Remove connections involving this module
                    for (0..g_engine.connection_count) |i| {
                        const c = &g_engine.connections[i];
                        if (c.from_module == cmd.module_id or c.to_module == cmd.module_id) {
                            c.active = false;
                        }
                    }
                    g_engine.order_dirty = true;
                }
            },
            .connect => {
                if (g_engine.connection_count >= MAX_CONNECTIONS) continue;
                var c = &g_engine.connections[g_engine.connection_count];
                c.from_module = cmd.module_id;
                c.from_port = cmd.port_a;
                c.to_module = cmd.target_module;
                c.to_port = cmd.port_b;
                c.active = true;
                g_engine.connection_count += 1;
                g_engine.order_dirty = true;
            },
            .disconnect => {
                for (0..g_engine.connection_count) |i| {
                    const c = &g_engine.connections[i];
                    if (c.from_module == cmd.module_id and c.from_port == cmd.port_a and
                        c.to_module == cmd.target_module and c.to_port == cmd.port_b)
                    {
                        c.active = false;
                        g_engine.order_dirty = true;
                    }
                }
            },
            .set_param => {
                if (findModule(cmd.module_id)) |m| {
                    if (cmd.param_index < m.param_count) {
                        m.params[cmd.param_index].value = cmd.value_f;
                    }
                }
            },
            .note_on => {
                if (findModule(cmd.module_id)) |m| {
                    // Set frequency from MIDI note and trigger gate
                    const note_freq = 440.0 * std.math.pow(f64, 2.0, (@as(f64, @floatFromInt(cmd.value_i)) - 69.0) / 12.0);
                    switch (m.module_type) {
                        .oscillator => {
                            if (m.param_count > 1) m.params[1].value = note_freq;
                        },
                        .pocket_voice => {
                            m.base_freq = note_freq;
                            m.trigger_time = 0;
                            m.noise_seed = m.noise_seed *% 1664525 +% 1013904223;
                        },
                        else => {},
                    }
                    // Trigger envelope if connected
                    m.envelope_stage = 1;
                    m.envelope_level = 0;
                    if (m.module_type == .pocket_voice) m.envelope_level = 1;
                }
            },
            .note_off => {
                if (findModule(cmd.module_id)) |m| {
                    m.envelope_stage = 4; // release
                }
            },
            .set_master_gain => {
                g_engine.master_gain = @floatCast(cmd.value_f);
            },
        }
    }
}

// ── SDL3 audio callback ─────────────────────────────────────────────

fn audioCallback(userdata: ?*anyopaque, stream: ?*sdl.SDL_AudioStream, additional_amount: c_int, _: c_int) callconv(.c) void {
    _ = userdata;
    if (additional_amount <= 0) return;

    const t0 = std.time.microTimestamp();

    // Process pending commands from QuickJS
    processCommands();

    // Rebuild execution order if graph changed
    if (g_engine.order_dirty) rebuildExecOrder();

    const num_samples = BUFFER_SIZE;

    // Clear input buffers
    clearInputBuffers(num_samples);

    // Route connections (copy upstream outputs to downstream inputs)
    routeConnections(num_samples);

    // Process modules in topological order
    for (0..g_engine.exec_count) |i| {
        const idx = g_engine.exec_order[i];
        processModule(&g_engine.modules[idx], num_samples);
    }

    // Mix to master (sum all modules with audio outputs)
    @memset(&g_engine.master_buffer, 0);
    for (0..g_engine.module_count) |i| {
        const m = &g_engine.modules[i];
        if (!m.active) continue;
        for (0..m.port_count) |p| {
            if (m.ports[p].direction == .out and m.ports[p].port_type == .audio) {
                const buf = m.ports[p].buffer;
                // Check if this port has any downstream connection — if not, it's a terminal output
                var has_downstream = false;
                for (0..g_engine.connection_count) |c| {
                    const conn = &g_engine.connections[c];
                    if (conn.active and conn.from_module == m.id and conn.from_port == @as(u8, @intCast(p))) {
                        has_downstream = true;
                        break;
                    }
                }
                if (!has_downstream) {
                    for (0..num_samples) |j| {
                        g_engine.master_buffer[j] += buf[j] * g_engine.master_gain;
                    }
                }
            }
        }
    }

    // Feed SDL3 stream
    if (stream) |s| {
        _ = sdl.SDL_PutAudioStreamData(s, &g_engine.master_buffer, @intCast(num_samples * @sizeOf(f32)));
    }

    _ = g_engine.callback_count.fetchAdd(1, .monotonic);
    const t1 = std.time.microTimestamp();
    g_engine.callback_us.store(@intCast(@max(0, t1 - t0)), .monotonic);
}

// ── Public API (called from engine.zig init / QuickJS host functions) ──

pub fn init() bool {
    if (g_engine.initialized) return true;

    // Wire buffer pool
    g_engine.buffer_pool.data = &g_engine.buffer_storage;

    // Open SDL3 audio device
    const spec = sdl.SDL_AudioSpec{
        .format = sdl.SDL_AUDIO_F32,
        .channels = 1,
        .freq = @intCast(SAMPLE_RATE),
    };

    g_engine.device_id = sdl.SDL_OpenAudioDevice(sdl.SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, &spec);
    if (g_engine.device_id == 0) {
        std.log.err("[audio] Failed to open audio device: {s}", .{sdl.SDL_GetError()});
        return false;
    }

    // Create audio stream
    g_engine.stream = sdl.SDL_CreateAudioStream(&spec, &spec);
    if (g_engine.stream == null) {
        std.log.err("[audio] Failed to create audio stream: {s}", .{sdl.SDL_GetError()});
        sdl.SDL_CloseAudioDevice(g_engine.device_id);
        return false;
    }

    // Set callback
    _ = sdl.SDL_SetAudioStreamGetCallback(g_engine.stream, audioCallback, null);

    // Bind stream to device
    if (!sdl.SDL_BindAudioStream(g_engine.device_id, g_engine.stream)) {
        std.log.err("[audio] Failed to bind stream: {s}", .{sdl.SDL_GetError()});
        sdl.SDL_DestroyAudioStream(g_engine.stream);
        sdl.SDL_CloseAudioDevice(g_engine.device_id);
        return false;
    }

    // Resume playback
    _ = sdl.SDL_ResumeAudioDevice(g_engine.device_id);

    g_engine.initialized = true;
    std.log.info("[audio] Initialized: {d}Hz, {d} samples/buffer, F32 mono", .{ SAMPLE_RATE, BUFFER_SIZE });
    return true;
}

pub fn deinit() void {
    if (!g_engine.initialized) return;
    if (g_engine.stream) |s| sdl.SDL_DestroyAudioStream(s);
    if (g_engine.device_id != 0) sdl.SDL_CloseAudioDevice(g_engine.device_id);
    g_engine.initialized = false;
}

pub fn isInitialized() bool {
    return g_engine.initialized;
}

// ── Telemetry ───────────────────────────────────────────────────────

pub fn logTelemetry() void {
    if (!g_engine.initialized) return;
    log.print("[audio] modules: {d} | connections: {d} | callbacks: {d} | last: {d}us\n", .{
        g_engine.module_count,
        g_engine.connection_count,
        g_engine.callback_count.load(.monotonic),
        g_engine.callback_us.load(.monotonic),
    });
}

// ── V8-binding wrappers (engine internals exposed to v8_bindings_core.zig) ──

pub fn resumeDevice() void {
    if (g_engine.device_id != 0) _ = sdl.SDL_ResumeAudioDevice(g_engine.device_id);
}

pub fn pauseDevice() void {
    if (g_engine.device_id != 0) _ = sdl.SDL_PauseAudioDevice(g_engine.device_id);
}

pub fn getModuleCount() u32 {
    return g_engine.module_count;
}

pub fn getConnectionCount() u32 {
    return g_engine.connection_count;
}

pub fn getCallbackCount() u64 {
    return g_engine.callback_count.load(.monotonic);
}

pub fn getCallbackUs() u64 {
    return g_engine.callback_us.load(.monotonic);
}

pub fn getPeakLevel() f32 {
    var peak: f32 = 0;
    for (0..BUFFER_SIZE) |i| {
        const v = @abs(g_engine.master_buffer[i]);
        if (v > peak) peak = v;
    }
    return peak;
}

pub fn getParam(module_id: u32, param_idx: u8) f64 {
    if (findModule(module_id)) |m| {
        if (param_idx < m.param_count) return m.params[param_idx].value;
    }
    return 0;
}

pub fn getParamCount(module_id: u32) u8 {
    if (findModule(module_id)) |m| return m.param_count;
    return 0;
}

pub fn getPortCount(module_id: u32) u8 {
    if (findModule(module_id)) |m| return m.port_count;
    return 0;
}

pub fn getModuleType(module_id: u32) i32 {
    if (findModule(module_id)) |m| return @intFromEnum(m.module_type);
    return -1;
}

pub fn getParamMin(module_id: u32, param_idx: u8) f64 {
    if (findModule(module_id)) |m| {
        if (param_idx < m.param_count) return m.params[param_idx].min;
    }
    return 0;
}

pub fn getParamMax(module_id: u32, param_idx: u8) f64 {
    if (findModule(module_id)) |m| {
        if (param_idx < m.param_count) return m.params[param_idx].max;
    }
    return 0;
}

// ── QuickJS host functions (registered via qjs_runtime.registerHostFn) ──
// These get raw JSValue access with proper f64 extraction — no c_long truncation.

const build_options = @import("build_options");
const HAS_QUICKJS = if (@hasDecl(build_options, "has_quickjs")) build_options.has_quickjs else true;

const qjs = if (HAS_QUICKJS) @cImport({
    @cDefine("_GNU_SOURCE", "1");
    @cDefine("QUICKJS_NG_BUILD", "1");
    @cInclude("quickjs.h");
}) else struct {
    pub const JSValue = extern struct { u: extern union { int32: i32 } = .{ .int32 = 0 }, tag: i64 = 0 };
    pub const JSContext = opaque {};
};
const QJS_UNDEFINED = if (HAS_QUICKJS) (qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 }) else qjs.JSValue{};

fn extractF64(ctx: ?*qjs.JSContext, argv: [*c]qjs.JSValue, idx: usize) f64 {
    var v: f64 = 0;
    _ = qjs.JS_ToFloat64(ctx, &v, argv[idx]);
    return v;
}

fn extractI32(ctx: ?*qjs.JSContext, argv: [*c]qjs.JSValue, idx: usize) i32 {
    var v: i32 = 0;
    _ = qjs.JS_ToInt32(ctx, &v, argv[idx]);
    return v;
}

fn jsFloat(v: f64) qjs.JSValue {
    return qjs.JS_NewFloat64(null, v);
}

// --- Host function implementations ---

fn hostAudioInit(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return jsFloat(if (init()) 1 else 0);
}

fn hostAudioDeinit(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    deinit();
    return QJS_UNDEFINED;
}

fn hostAudioAddModule(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return QJS_UNDEFINED;
    const id: u32 = @intCast(extractI32(ctx, argv, 0));
    const mod_type: u8 = @intCast(extractI32(ctx, argv, 1));
    return jsFloat(if (pushCommand(.{
        .cmd_type = .add_module,
        .module_id = id,
        .module_type = @enumFromInt(mod_type),
    })) 1 else 0);
}

fn hostAudioRemoveModule(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    return jsFloat(if (pushCommand(.{
        .cmd_type = .remove_module,
        .module_id = @intCast(extractI32(ctx, argv, 0)),
    })) 1 else 0);
}

fn hostAudioConnect(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 4) return QJS_UNDEFINED;
    return jsFloat(if (pushCommand(.{
        .cmd_type = .connect,
        .module_id = @intCast(extractI32(ctx, argv, 0)),
        .port_a = @intCast(extractI32(ctx, argv, 1)),
        .target_module = @intCast(extractI32(ctx, argv, 2)),
        .port_b = @intCast(extractI32(ctx, argv, 3)),
    })) 1 else 0);
}

fn hostAudioDisconnect(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 4) return QJS_UNDEFINED;
    return jsFloat(if (pushCommand(.{
        .cmd_type = .disconnect,
        .module_id = @intCast(extractI32(ctx, argv, 0)),
        .port_a = @intCast(extractI32(ctx, argv, 1)),
        .target_module = @intCast(extractI32(ctx, argv, 2)),
        .port_b = @intCast(extractI32(ctx, argv, 3)),
    })) 1 else 0);
}

fn hostAudioSetParam(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 3) return QJS_UNDEFINED;
    return jsFloat(if (pushCommand(.{
        .cmd_type = .set_param,
        .module_id = @intCast(extractI32(ctx, argv, 0)),
        .param_index = @intCast(extractI32(ctx, argv, 1)),
        .value_f = extractF64(ctx, argv, 2), // proper f64 — no truncation
    })) 1 else 0);
}

fn hostAudioGetParam(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return jsFloat(0);
    var mid: i32 = 0;
    var pidx: i32 = 0;
    _ = qjs.JS_ToInt32(null, &mid, argv[0]);
    _ = qjs.JS_ToInt32(null, &pidx, argv[1]);
    if (findModule(@intCast(mid))) |m| {
        if (pidx >= 0 and pidx < m.param_count) {
            return jsFloat(m.params[@intCast(pidx)].value);
        }
    }
    return jsFloat(0);
}

fn hostAudioNoteOn(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return QJS_UNDEFINED;
    return jsFloat(if (pushCommand(.{
        .cmd_type = .note_on,
        .module_id = @intCast(extractI32(ctx, argv, 0)),
        .value_i = extractI32(ctx, argv, 1),
    })) 1 else 0);
}

fn hostAudioNoteOff(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    return jsFloat(if (pushCommand(.{
        .cmd_type = .note_off,
        .module_id = @intCast(extractI32(ctx, argv, 0)),
    })) 1 else 0);
}

fn hostAudioSetMasterGain(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return QJS_UNDEFINED;
    return jsFloat(if (pushCommand(.{
        .cmd_type = .set_master_gain,
        .value_f = extractF64(ctx, argv, 0), // 0.0-1.0 directly
    })) 1 else 0);
}

fn hostAudioPause(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (g_engine.device_id != 0) _ = sdl.SDL_PauseAudioDevice(g_engine.device_id);
    return QJS_UNDEFINED;
}

fn hostAudioResume(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (g_engine.device_id != 0) _ = sdl.SDL_ResumeAudioDevice(g_engine.device_id);
    return QJS_UNDEFINED;
}

fn hostAudioGetModuleCount(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return jsFloat(@floatFromInt(g_engine.module_count));
}

fn hostAudioGetCallbackCount(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return jsFloat(@floatFromInt(g_engine.callback_count.load(.monotonic)));
}

fn hostAudioGetCallbackUs(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return jsFloat(@floatFromInt(g_engine.callback_us.load(.monotonic)));
}

fn hostAudioGetSampleRate(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return jsFloat(@floatFromInt(SAMPLE_RATE));
}

fn hostAudioGetBufferSize(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return jsFloat(@floatFromInt(BUFFER_SIZE));
}

fn hostAudioGetPeakLevel(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    // Scan master buffer for peak
    var peak: f32 = 0;
    for (0..BUFFER_SIZE) |i| {
        const v = @abs(g_engine.master_buffer[i]);
        if (v > peak) peak = v;
    }
    return jsFloat(@floatCast(peak));
}

fn hostAudioGetParamCount(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return jsFloat(0);
    var mid: i32 = 0;
    _ = qjs.JS_ToInt32(null, &mid, argv[0]);
    if (findModule(@intCast(mid))) |m| return jsFloat(@floatFromInt(m.param_count));
    return jsFloat(0);
}

fn hostAudioGetPortCount(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return jsFloat(0);
    var mid: i32 = 0;
    _ = qjs.JS_ToInt32(null, &mid, argv[0]);
    if (findModule(@intCast(mid))) |m| return jsFloat(@floatFromInt(m.port_count));
    return jsFloat(0);
}

fn hostAudioGetModuleType(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 1) return jsFloat(-1);
    var mid: i32 = 0;
    _ = qjs.JS_ToInt32(null, &mid, argv[0]);
    if (findModule(@intCast(mid))) |m| return jsFloat(@floatFromInt(@intFromEnum(m.module_type)));
    return jsFloat(-1);
}

fn hostAudioGetParamMin(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return jsFloat(0);
    var mid: i32 = 0;
    var pidx: i32 = 0;
    _ = qjs.JS_ToInt32(null, &mid, argv[0]);
    _ = qjs.JS_ToInt32(null, &pidx, argv[1]);
    if (findModule(@intCast(mid))) |m| {
        if (pidx >= 0 and pidx < m.param_count) return jsFloat(m.params[@intCast(pidx)].min);
    }
    return jsFloat(0);
}

fn hostAudioGetParamMax(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    if (argc < 2) return jsFloat(0);
    var mid: i32 = 0;
    var pidx: i32 = 0;
    _ = qjs.JS_ToInt32(null, &mid, argv[0]);
    _ = qjs.JS_ToInt32(null, &pidx, argv[1]);
    if (findModule(@intCast(mid))) |m| {
        if (pidx >= 0 and pidx < m.param_count) return jsFloat(m.params[@intCast(pidx)].max);
    }
    return jsFloat(0);
}

fn hostAudioGetConnectionCount(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return jsFloat(@floatFromInt(g_engine.connection_count));
}

fn hostAudioIsInitialized(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {
    return jsFloat(if (g_engine.initialized) 1 else 0);
}

/// Register all audio host functions onto the QuickJS global object.
/// Called from engine.zig after qjs_runtime.initVM().
pub fn registerQjsHostFunctions() void {
    const reg = @import("qjs_runtime.zig").registerHostFn;
    reg("__audio_init", @ptrCast(&hostAudioInit), 0);
    reg("__audio_deinit", @ptrCast(&hostAudioDeinit), 0);
    reg("__audio_add_module", @ptrCast(&hostAudioAddModule), 2);
    reg("__audio_remove_module", @ptrCast(&hostAudioRemoveModule), 1);
    reg("__audio_connect", @ptrCast(&hostAudioConnect), 4);
    reg("__audio_disconnect", @ptrCast(&hostAudioDisconnect), 4);
    reg("__audio_set_param", @ptrCast(&hostAudioSetParam), 3);
    reg("__audio_get_param", @ptrCast(&hostAudioGetParam), 2);
    reg("__audio_note_on", @ptrCast(&hostAudioNoteOn), 2);
    reg("__audio_note_off", @ptrCast(&hostAudioNoteOff), 1);
    reg("__audio_set_master_gain", @ptrCast(&hostAudioSetMasterGain), 1);
    reg("__audio_pause", @ptrCast(&hostAudioPause), 0);
    reg("__audio_resume", @ptrCast(&hostAudioResume), 0);
    reg("__audio_get_module_count", @ptrCast(&hostAudioGetModuleCount), 0);
    reg("__audio_get_callback_count", @ptrCast(&hostAudioGetCallbackCount), 0);
    reg("__audio_get_callback_us", @ptrCast(&hostAudioGetCallbackUs), 0);
    reg("__audio_get_sample_rate", @ptrCast(&hostAudioGetSampleRate), 0);
    reg("__audio_get_buffer_size", @ptrCast(&hostAudioGetBufferSize), 0);
    reg("__audio_get_peak_level", @ptrCast(&hostAudioGetPeakLevel), 0);
    reg("__audio_get_param_count", @ptrCast(&hostAudioGetParamCount), 1);
    reg("__audio_get_port_count", @ptrCast(&hostAudioGetPortCount), 1);
    reg("__audio_get_module_type", @ptrCast(&hostAudioGetModuleType), 1);
    reg("__audio_get_param_min", @ptrCast(&hostAudioGetParamMin), 2);
    reg("__audio_get_param_max", @ptrCast(&hostAudioGetParamMax), 2);
    reg("__audio_get_connection_count", @ptrCast(&hostAudioGetConnectionCount), 0);
    reg("__audio_is_initialized", @ptrCast(&hostAudioIsInitialized), 0);
}
