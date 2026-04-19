//! easing.zig — CSS easing functions for the transition engine
//!
//! Pure math, zero dependencies beyond framework/math.zig.
//! All functions: f32 → f32, input 0.0–1.0, output 0.0–1.0 (may overshoot for spring/elastic).
//!
//! Easing functions:
//!   linear, easeIn, easeOut, easeInOut, spring, bounce, elastic
//!   cubicBezier (CSS cubic-bezier with Newton-Raphson solver)

const std = @import("std");
const m = @import("math.zig");

/// Easing function signature: normalized time (0–1) → eased value.
pub const EasingFn = *const fn (f32) f32;

/// Named easing presets. Matches CSS transition-timing-function names.
pub const EasingType = enum {
    linear,
    ease_in,
    ease_out,
    ease_in_out,
    spring,
    bounce,
    elastic,
    // cubic_bezier is handled separately via CubicBezierEasing

    /// Resolve a named easing type to its function pointer.
    pub fn resolve(self: EasingType) EasingFn {
        return switch (self) {
            .linear => &linear,
            .ease_in => &easeIn,
            .ease_out => &easeOut,
            .ease_in_out => &easeInOut,
            .spring => &spring,
            .bounce => &bounce,
            .elastic => &elasticDefault,
        };
    }
};

// ============================================================================
// Easing functions
// ============================================================================

/// Linear: no acceleration.
pub fn linear(t: f32) f32 {
    return t;
}

/// Ease in: quadratic acceleration from zero velocity.
pub fn easeIn(t: f32) f32 {
    return t * t;
}

/// Ease out: quadratic deceleration to zero velocity.
pub fn easeOut(t: f32) f32 {
    return t * (2.0 - t);
}

/// Ease in-out: quadratic acceleration then deceleration.
pub fn easeInOut(t: f32) f32 {
    if (t < 0.5) return 2.0 * t * t;
    return -1.0 + (4.0 - 2.0 * t) * t;
}

/// Spring: decaying sinusoidal overshoot. Reaches 1.0 with damped oscillation.
pub fn spring(t: f32) f32 {
    if (t <= 0.0) return 0.0;
    if (t >= 1.0) return 1.0;
    const p: f32 = 0.3;
    const pi2 = std.math.pi * 2.0;
    return std.math.pow(f32, 2.0, -10.0 * t) * @sin((t - p / 4.0) * pi2 / p) + 1.0;
}

/// Bounce: simulates a bouncing ball.
pub fn bounce(t: f32) f32 {
    const k: f32 = 7.5625;
    const d: f32 = 2.75;
    if (t < 1.0 / d) {
        return k * t * t;
    } else if (t < 2.0 / d) {
        const t2 = t - 1.5 / d;
        return k * t2 * t2 + 0.75;
    } else if (t < 2.5 / d) {
        const t2 = t - 2.25 / d;
        return k * t2 * t2 + 0.9375;
    } else {
        const t2 = t - 2.625 / d;
        return k * t2 * t2 + 0.984375;
    }
}

/// Elastic easing with configurable bounciness.
pub fn elastic(t: f32, bounciness: f32) f32 {
    if (t <= 0.0) return 0.0;
    if (t >= 1.0) return 1.0;
    const p = 0.3 / @max(bounciness, 0.001);
    const pi2 = std.math.pi * 2.0;
    return std.math.pow(f32, 2.0, -10.0 * t) * @sin((t - p / 4.0) * pi2 / p) + 1.0;
}

/// Elastic with default bounciness (1.0). Used as the EasingFn for .elastic.
fn elasticDefault(t: f32) f32 {
    return elastic(t, 1.0);
}

// ============================================================================
// CSS cubic-bezier
// ============================================================================

/// Pre-computed cubic bezier easing curve.
/// CSS cubic-bezier(x1, y1, x2, y2) with fixed endpoints (0,0) and (1,1).
pub const CubicBezierEasing = struct {
    x1: f32,
    y1: f32,
    x2: f32,
    y2: f32,

    /// Evaluate the easing curve at normalized time t.
    /// Uses Newton-Raphson to solve for the bezier parameter u where B_x(u) = t,
    /// then returns B_y(u).
    pub fn eval(self: CubicBezierEasing, t: f32) f32 {
        if (t <= 0.0) return 0.0;
        if (t >= 1.0) return 1.0;

        // Newton-Raphson: solve for u where sampleX(u) = t
        var u = t;
        for (0..8) |_| {
            const x_est = sampleCurve(u, self.x1, self.x2) - t;
            if (@abs(x_est) < 1e-6) break;
            const dx = sampleDerivative(u, self.x1, self.x2);
            if (@abs(dx) < 1e-6) break;
            u -= x_est / dx;
        }
        u = m.clamp(u, 0.0, 1.0);
        return sampleCurve(u, self.y1, self.y2);
    }

    /// Sample a 1D cubic bezier with fixed endpoints 0 and 1.
    /// B(t) = 3*(1-t)^2*t*p1 + 3*(1-t)*t^2*p2 + t^3
    fn sampleCurve(t: f32, p1: f32, p2: f32) f32 {
        const mt = 1.0 - t;
        return 3.0 * mt * mt * t * p1 + 3.0 * mt * t * t * p2 + t * t * t;
    }

    /// Derivative of the 1D cubic bezier.
    fn sampleDerivative(t: f32, p1: f32, p2: f32) f32 {
        const mt = 1.0 - t;
        return 3.0 * mt * mt * p1 + 6.0 * mt * t * (p2 - p1) + 3.0 * t * t * (1.0 - p2);
    }
};

/// Common CSS presets.
pub const css_ease = CubicBezierEasing{ .x1 = 0.25, .y1 = 0.1, .x2 = 0.25, .y2 = 1.0 };
pub const css_ease_in = CubicBezierEasing{ .x1 = 0.42, .y1 = 0.0, .x2 = 1.0, .y2 = 1.0 };
pub const css_ease_out = CubicBezierEasing{ .x1 = 0.0, .y1 = 0.0, .x2 = 0.58, .y2 = 1.0 };
pub const css_ease_in_out = CubicBezierEasing{ .x1 = 0.42, .y1 = 0.0, .x2 = 0.58, .y2 = 1.0 };

// ============================================================================
// Tests
// ============================================================================

fn expectApprox(expected: f32, actual: f32) !void {
    if (@abs(expected - actual) > 0.01) {
        std.debug.print("expected {d:.4}, got {d:.4}\n", .{ expected, actual });
        return error.TestUnexpectedResult;
    }
}

test "linear is identity" {
    try expectApprox(0.0, linear(0.0));
    try expectApprox(0.5, linear(0.5));
    try expectApprox(1.0, linear(1.0));
}

test "easeIn starts slow" {
    try expectApprox(0.0, easeIn(0.0));
    try expectApprox(0.25, easeIn(0.5)); // 0.5^2 = 0.25
    try expectApprox(1.0, easeIn(1.0));
}

test "easeOut ends slow" {
    try expectApprox(0.0, easeOut(0.0));
    try expectApprox(0.75, easeOut(0.5)); // 0.5 * (2 - 0.5) = 0.75
    try expectApprox(1.0, easeOut(1.0));
}

test "easeInOut symmetric" {
    try expectApprox(0.0, easeInOut(0.0));
    try expectApprox(0.5, easeInOut(0.5));
    try expectApprox(1.0, easeInOut(1.0));
    // First half slower than second half
    const q1 = easeInOut(0.25);
    const q3 = easeInOut(0.75);
    try expectApprox(q1, 1.0 - q3); // symmetric around 0.5
}

test "spring overshoots then converges" {
    try expectApprox(0.0, spring(0.0));
    try expectApprox(1.0, spring(1.0));
    // Spring should overshoot 1.0 at some point
    var max_val: f32 = 0;
    for (0..100) |i| {
        const t: f32 = @as(f32, @floatFromInt(i)) / 100.0;
        max_val = @max(max_val, spring(t));
    }
    try std.testing.expect(max_val > 1.0);
}

test "bounce endpoints" {
    try expectApprox(0.0, bounce(0.0));
    try expectApprox(1.0, bounce(1.0));
}

test "elastic endpoints and overshoot" {
    try expectApprox(0.0, elastic(0.0, 1.0));
    try expectApprox(1.0, elastic(1.0, 1.0));
    var max_val: f32 = 0;
    for (0..100) |i| {
        const t: f32 = @as(f32, @floatFromInt(i)) / 100.0;
        max_val = @max(max_val, elastic(t, 1.0));
    }
    try std.testing.expect(max_val > 1.0);
}

test "cubicBezier endpoints" {
    const bez = CubicBezierEasing{ .x1 = 0.42, .y1 = 0.0, .x2 = 0.58, .y2 = 1.0 };
    try expectApprox(0.0, bez.eval(0.0));
    try expectApprox(1.0, bez.eval(1.0));
    try expectApprox(0.5, bez.eval(0.5)); // ease-in-out is symmetric
}

test "cubicBezier linear" {
    // cubic-bezier(0, 0, 1, 1) should be approximately linear
    const bez = CubicBezierEasing{ .x1 = 0.0, .y1 = 0.0, .x2 = 1.0, .y2 = 1.0 };
    for (0..11) |i| {
        const t: f32 = @as(f32, @floatFromInt(i)) / 10.0;
        try expectApprox(t, bez.eval(t));
    }
}

test "css presets are sane" {
    // All presets should map 0→0 and 1→1
    try expectApprox(0.0, css_ease.eval(0.0));
    try expectApprox(1.0, css_ease.eval(1.0));
    try expectApprox(0.0, css_ease_in.eval(0.0));
    try expectApprox(1.0, css_ease_in.eval(1.0));
    try expectApprox(0.0, css_ease_out.eval(0.0));
    try expectApprox(1.0, css_ease_out.eval(1.0));
    try expectApprox(0.0, css_ease_in_out.eval(0.0));
    try expectApprox(1.0, css_ease_in_out.eval(1.0));
}
