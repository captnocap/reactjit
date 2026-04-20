const std = @import("std");
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const exe_mod = b.createModule(.{ .root_source_file = b.path("minimal.zig"), .target = target, .optimize = optimize });
    exe_mod.addImport("tls", b.createModule(.{ .root_source_file = b.path("src/root.zig"), .target = target, .optimize = optimize }));
    const exe = b.addExecutable(.{ .name = "minimal", .root_module = exe_mod });
    b.installArtifact(exe);
}
