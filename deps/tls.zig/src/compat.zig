const std = @import("std");

pub const Timestamp = struct {
    nanoseconds: i128,

    pub const zero: Timestamp = .{ .nanoseconds = 0 };

    pub fn now() Timestamp {
        return .{ .nanoseconds = std.time.nanoTimestamp() };
    }

    pub fn toSeconds(self: Timestamp) i64 {
        return @intCast(@divTrunc(self.nanoseconds, std.time.ns_per_s));
    }
};
