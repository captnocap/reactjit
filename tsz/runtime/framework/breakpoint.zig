//! Breakpoint system — responsive layout tiers
//!
//! Tracks current breakpoint based on window width.
//! Breakpoints match the Love2D stack: sm=0, md=640, lg=1024, xl=1440.
//!
//! Usage:
//!   breakpoint.update(win_w);
//!   const bp = breakpoint.current(); // .sm, .md, .lg, .xl

const std = @import("std");

pub const Breakpoint = enum(u8) {
    sm = 0, // 0-639px (mobile)
    md = 1, // 640-1023px (tablet)
    lg = 2, // 1024-1439px (desktop)
    xl = 3, // 1440px+ (widescreen)
};

var current_bp: Breakpoint = .lg;
var current_width: f32 = 1280;

/// Update breakpoint from window width. Call on resize.
pub fn update(width: f32) void {
    current_width = width;
    if (width >= 1440) {
        current_bp = .xl;
    } else if (width >= 1024) {
        current_bp = .lg;
    } else if (width >= 640) {
        current_bp = .md;
    } else {
        current_bp = .sm;
    }
}

/// Get current breakpoint.
pub fn current() Breakpoint {
    return current_bp;
}

/// Get current width.
pub fn width() f32 {
    return current_width;
}

/// Check if current breakpoint is at least the given tier.
pub fn atLeast(bp: Breakpoint) bool {
    return @intFromEnum(current_bp) >= @intFromEnum(bp);
}

/// Get the breakpoint as a string (for debug display).
pub fn name() []const u8 {
    return switch (current_bp) {
        .sm => "sm",
        .md => "md",
        .lg => "lg",
        .xl => "xl",
    };
}
