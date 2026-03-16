//! ReactJIT Animation System — Phases 1-3
//!
//! Easing functions (pure math), timing-based animation slots,
//! and spring physics slots. Compile-time allocated, zero heap.
//!
//! Same pattern as state.zig: fixed slot arrays, created at init,
//! ticked each frame. The compiler emits calls to this module
//! for useTransition() and useSpring() hooks.
//!
//! Reference: love2d/lua/animate.lua

const std = @import("std");

// ════════════════════════════════════════════════════════════════════════
// Phase 1: Easing Functions (pure math, zero state)
// Reference: love2d/lua/animate.lua:54-161
// ════════════════════════════════════════════════════════════════════════

pub fn linear(t: f32) f32 {
    return t;
}

pub fn easeIn(t: f32) f32 {
    return t * t;
}

pub fn easeOut(t: f32) f32 {
    return t * (2.0 - t);
}

pub fn easeInOut(t: f32) f32 {
    if (t < 0.5) return 2.0 * t * t;
    return -1.0 + (4.0 - 2.0 * t) * t;
}

/// Spring-like easing with overshoot (decaying sinusoid).
/// Reference: animate.lua:68-73
pub fn spring(t: f32) f32 {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const p: f32 = 0.3;
    return std.math.pow(f32, 2.0, -10.0 * t) * @sin((t - p / 4.0) * (2.0 * std.math.pi) / p) + 1.0;
}

/// Bounce easing (multiple bounces).
/// Reference: animate.lua:110-123
pub fn bounce(t: f32) f32 {
    if (t < 1.0 / 2.75) {
        return 7.5625 * t * t;
    } else if (t < 2.0 / 2.75) {
        const t2 = t - 1.5 / 2.75;
        return 7.5625 * t2 * t2 + 0.75;
    } else if (t < 2.5 / 2.75) {
        const t2 = t - 2.25 / 2.75;
        return 7.5625 * t2 * t2 + 0.9375;
    } else {
        const t2 = t - 2.625 / 2.75;
        return 7.5625 * t2 * t2 + 0.984375;
    }
}

/// Elastic easing with configurable bounciness.
/// Reference: animate.lua:128-136
pub fn elastic(t: f32, bounciness: f32) f32 {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const b = @max(bounciness, 0.001);
    const p = 0.3 / b;
    return std.math.pow(f32, 2.0, -10.0 * t) * @sin((t - p / 4.0) * (2.0 * std.math.pi) / p) + 1.0;
}

/// Cubic bezier easing via Newton-Raphson (8 iterations).
/// Reference: animate.lua:76-108
pub fn cubicBezier(x1: f32, y1: f32, x2: f32, y2: f32, t: f32) f32 {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    // Solve for u where bezierX(u) = t using Newton-Raphson
    var u: f32 = t;
    for (0..8) |_| {
        const x_est = bezierCurve(u, x1, x2) - t;
        if (@abs(x_est) < 1e-6) break;
        const dx = bezierDerivative(u, x1, x2);
        if (@abs(dx) < 1e-6) break;
        u -= x_est / dx;
    }
    u = std.math.clamp(u, 0.0, 1.0);
    return bezierCurve(u, y1, y2);
}

fn bezierCurve(t: f32, p1: f32, p2: f32) f32 {
    const mt = 1.0 - t;
    return 3.0 * mt * mt * t * p1 + 3.0 * mt * t * t * p2 + t * t * t;
}

fn bezierDerivative(t: f32, p1: f32, p2: f32) f32 {
    const mt = 1.0 - t;
    return 3.0 * mt * mt * p1 + 6.0 * mt * t * (p2 - p1) + 3.0 * t * t * (1.0 - p2);
}

// ════════════════════════════════════════════════════════════════════════
// Interpolation helpers
// ════════════════════════════════════════════════════════════════════════

/// Linear interpolation between two floats.
pub fn lerp(a: f32, b: f32, t: f32) f32 {
    return a + (b - a) * t;
}

/// Color type matching layout.zig's Color.
pub const Color = struct {
    r: u8,
    g: u8,
    b: u8,
    a: u8,
};

/// Channel-wise color interpolation.
/// Reference: animate.lua:251-261
pub fn lerpColor(a: Color, b: Color, t: f32) Color {
    return .{
        .r = @intFromFloat(lerp(@floatFromInt(a.r), @floatFromInt(b.r), t)),
        .g = @intFromFloat(lerp(@floatFromInt(a.g), @floatFromInt(b.g), t)),
        .b = @intFromFloat(lerp(@floatFromInt(a.b), @floatFromInt(b.b), t)),
        .a = @intFromFloat(lerp(@floatFromInt(a.a), @floatFromInt(b.a), t)),
    };
}

// ════════════════════════════════════════════════════════════════════════
// Easing function type + resolver
// ════════════════════════════════════════════════════════════════════════

pub const EasingFn = *const fn (f32) f32;

/// Resolve an easing name to a function pointer.
/// Used by the compiler to map string literals like 'easeOut' to function pointers.
pub fn resolveEasing(name: []const u8) EasingFn {
    if (std.mem.eql(u8, name, "linear")) return linear;
    if (std.mem.eql(u8, name, "easeIn")) return easeIn;
    if (std.mem.eql(u8, name, "easeOut")) return easeOut;
    if (std.mem.eql(u8, name, "easeInOut")) return easeInOut;
    if (std.mem.eql(u8, name, "spring")) return spring;
    if (std.mem.eql(u8, name, "bounce")) return bounce;
    return easeInOut; // default
}

// ════════════════════════════════════════════════════════════════════════
// Phase 2: Animation Slots (timing-based)
// Reference: animate.lua:360-368 (state), animate.lua:494-510 (tick)
// ════════════════════════════════════════════════════════════════════════

pub const MAX_ANIM_SLOTS = 64;

pub const AnimSlot = struct {
    from: f32 = 0,
    to: f32 = 0,
    current: f32 = 0,
    progress: f32 = 0, // 0.0 → 1.0
    duration_ms: f32 = 300,
    start_time: f32 = 0, // seconds (from SDL_GetTicks / 1000)
    easing: EasingFn = easeInOut,
    active: bool = false,
    done: bool = true,
};

var anim_slots: [MAX_ANIM_SLOTS]AnimSlot = [_]AnimSlot{.{}} ** MAX_ANIM_SLOTS;
var anim_slot_count: usize = 0;
var _anims_active: bool = false;

/// Create a timing-based animation slot. Returns the slot ID.
/// Called once at init time (like state.createSlot).
pub fn createAnim(duration_ms: f32, easing: EasingFn) usize {
    const id = anim_slot_count;
    std.debug.assert(id < MAX_ANIM_SLOTS);
    anim_slots[id] = .{
        .duration_ms = duration_ms,
        .easing = easing,
    };
    anim_slot_count += 1;
    return id;
}

/// Start (or restart) an animation from one value to another.
pub fn startAnim(id: usize, from: f32, to: f32) void {
    var s = &anim_slots[id];
    s.from = from;
    s.to = to;
    s.current = from;
    s.progress = 0;
    s.start_time = -1; // will be set on first tick
    s.active = true;
    s.done = false;
    _anims_active = true;
}

/// Get the current animated value for a slot.
pub fn getAnimValue(id: usize) f32 {
    return anim_slots[id].current;
}

/// Get the target value for a slot (used to detect target changes).
pub fn getAnimTarget(id: usize) f32 {
    return anim_slots[id].to;
}

/// Check if an animation has completed.
pub fn isAnimDone(id: usize) bool {
    return anim_slots[id].done;
}

/// Tick all active timing-based animations.
/// Call once per frame. `now_ms` = SDL_GetTicks() (milliseconds).
pub fn tickAnims(now_ms: u32) void {
    const now: f32 = @as(f32, @floatFromInt(now_ms)) / 1000.0;
    var any_active = false;

    for (0..anim_slot_count) |i| {
        var s = &anim_slots[i];
        if (!s.active) continue;

        // Set start time on first tick
        if (s.start_time < 0) {
            s.start_time = now;
        }

        const elapsed = (now - s.start_time) * 1000.0; // back to ms
        const duration = s.duration_ms;

        if (duration <= 0) {
            // Instant
            s.current = s.to;
            s.progress = 1.0;
            s.active = false;
            s.done = true;
            continue;
        }

        s.progress = std.math.clamp(elapsed / duration, 0.0, 1.0);
        const eased = s.easing(s.progress);
        s.current = lerp(s.from, s.to, eased);

        if (s.progress >= 1.0) {
            s.current = s.to;
            s.active = false;
            s.done = true;
        } else {
            any_active = true;
        }
    }

    _anims_active = any_active;
}

// ════════════════════════════════════════════════════════════════════════
// Phase 3: Spring Slots (physics-based)
// Reference: animate.lua:342-356 (state), animate.lua:468-493 (tick)
// ════════════════════════════════════════════════════════════════════════

pub const MAX_SPRING_SLOTS = 64;

pub const SpringSlot = struct {
    target: f32 = 0,
    current: f32 = 0,
    velocity: f32 = 0,
    stiffness: f32 = 100,
    damping: f32 = 10,
    mass: f32 = 1,
    rest_threshold: f32 = 0.01,
    active: bool = false,
};

var spring_slots: [MAX_SPRING_SLOTS]SpringSlot = [_]SpringSlot{.{}} ** MAX_SPRING_SLOTS;
var spring_slot_count: usize = 0;
var _springs_active: bool = false;

/// Create a spring-based animation slot. Returns the slot ID.
pub fn createSpring(stiffness: f32, damping: f32) usize {
    const id = spring_slot_count;
    std.debug.assert(id < MAX_SPRING_SLOTS);
    spring_slots[id] = .{
        .stiffness = stiffness,
        .damping = damping,
    };
    spring_slot_count += 1;
    return id;
}

/// Set the spring's target value. If different from current target,
/// the spring becomes active and starts moving toward it.
pub fn setSpringTarget(id: usize, target: f32) void {
    var s = &spring_slots[id];
    if (target != s.target or !s.active) {
        s.target = target;
        s.active = true;
        _springs_active = true;
    }
}

/// Set the spring's current value directly (for initialization).
pub fn setSpringValue(id: usize, value: f32) void {
    spring_slots[id].current = value;
}

/// Get the current spring value.
pub fn getSpringValue(id: usize) f32 {
    return spring_slots[id].current;
}

/// Check if a spring has reached rest.
pub fn isSpringAtRest(id: usize) bool {
    return !spring_slots[id].active;
}

/// Tick all active springs with Verlet integration.
/// `dt` is delta time in seconds (typically ~0.016 for 60fps).
/// Reference: animate.lua:468-493
pub fn tickSprings(dt_raw: f32) void {
    // Clamp dt to prevent physics explosion on frame hitches
    const dt = @min(dt_raw, 0.064);
    var any_active = false;

    for (0..spring_slot_count) |i| {
        var s = &spring_slots[i];
        if (!s.active) continue;

        const displacement = s.current - s.target;
        const spring_force = -s.stiffness * displacement;
        const damping_force = -s.damping * s.velocity;
        const acceleration = (spring_force + damping_force) / s.mass;

        s.velocity += acceleration * dt;
        s.current += s.velocity * dt;

        // Rest detection: snap to target when close enough and slow enough
        if (@abs(s.velocity) < s.rest_threshold and @abs(s.current - s.target) < s.rest_threshold) {
            s.current = s.target;
            s.velocity = 0;
            s.active = false;
        } else {
            any_active = true;
        }
    }

    _springs_active = any_active;
}

// ════════════════════════════════════════════════════════════════════════
// Global queries
// ════════════════════════════════════════════════════════════════════════

/// Returns true if any animation or spring is currently active.
/// Used by the main loop to decide whether to repaint even when
/// state hasn't changed.
pub fn isActive() bool {
    return _anims_active or _springs_active;
}

/// Reset all slots (for testing or hot-reload).
pub fn reset() void {
    anim_slot_count = 0;
    spring_slot_count = 0;
    _anims_active = false;
    _springs_active = false;
}
